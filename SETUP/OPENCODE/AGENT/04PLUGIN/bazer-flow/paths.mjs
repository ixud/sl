/* bazer-flow paths - temp-root and shell-write classification.
   Moved out of logic.mjs (pure, no imports). */

export function normalizedPath(value) {
  return String(value ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

const TEMP_SUBDIRS = ['bazer', 'opencode'];

export function defaultTempRoots() {
  const base = process.env.TEMP || process.env.TMP || '';
  const roots = ['/tmp/bazer'];
  if (base) {
    const b = normalizedPath(base).replace(/\/+$/, '');
    for (const sub of TEMP_SUBDIRS) roots.push(b + '/' + sub);
  }
  return roots;
}

export function isTempPath(filePath, tempRoots = defaultTempRoots()) {
  const p = normalizedPath(filePath);
  if (!p) return false;
  if (p.split('/').includes('..')) return false;
  return (tempRoots || []).some((root) => {
    const r = normalizedPath(root);
    return !!r && (p === r || p.startsWith(r + '/'));
  });
}

const WRITE_VERB = /(^|[\s;&|])(set-content|add-content|out-file|remove-item|move-item|rename-item|new-item|copy-item|rm|del|erase|mv|cp|copy|tee|touch|mkdir|rmdir)\b/i;
const IO_WRITE = /\[(?:System\.)?IO\.File\]::(?:Write|Append)/i;
const REDIRECT_WRITE = /(^|[^>])>{1,2}\s*[^&|]/;
const UNRESOLVED = /\$env:|\$[A-Za-z_]\w*|%\w+%/i;
const BUILTIN = /\$(?:LASTEXITCODE|\?|null|true|false|_|PSScriptRoot|PWD|HOME|args|input|Error|ErrorActionPreference)\b/gi;
const unresolved = (s) => UNRESOLVED.test(String(s ?? '').replace(BUILTIN, ' '));
const mapWsl = (s) => String(s ?? '').replace(/\/mnt\/([a-zA-Z])\//g, (m, d) => d.toUpperCase() + ':\\');
const isAbs = (p) => /^([A-Za-z]:[\\/]|\/)/.test(p);

/** null/merge redirections are not writes: 2>&1, 2>$null, >$null, 2>nul */
const NEUTRAL_REDIRECT = /\d?>\s*(?:&[12]|\$null\b|nul\b|\/dev\/null\b)/gi;
const stripNeutral = (s) => String(s ?? '').replace(NEUTRAL_REDIRECT, ' ');

export function looksLikeWrite(command, env = {}) {
  return shellWrite(command, env).write;
}

/* ---------------------------------------------------------------- gate CLI
   `plannotator annotate - --gate --json --require-approval --result-file -` */

const PLANNATOR_TOKEN = /(^|[\s"'`(&|;])(?:[^\s"'`]*[\\/])?plannotator(?:\.exe)?(?=$|[\s"'`)&|;])/i;
const EXIT_ARG = /^(?:exit\s*=\s*)?\$lastexitcode$|^\$lastexitcode$|^\?$/i;

/** why-code for a candidate command; accepted only for a clean plannotator annotate run */
export function gateCliVerdict(command) {
  const s = String(command ?? '');
  if (!PLANNATOR_TOKEN.test(s)) return { accepted: false, why: 'no-token' };
  if (!/--gate\b/.test(s)) return { accepted: false, why: 'no-gate' };
  if (!/--json\b/.test(s)) return { accepted: false, why: 'no-json' };
  if (/(^|[\s;&|])Set-Content\b|(^|[\s;&|])Out-File\b|(^|[\s;&|])printf\b/i.test(s)) return { accepted: false, why: 'spoof-write' };
  const rf = /--result-file\s+("[^"]*"|'[^']*'|[^\s]+)/i.exec(s);
  if (rf && /decision|approved|\{/i.test(rf[1])) return { accepted: false, why: 'spoof-literal' };
  if (s.replace(NEUTRAL_REDIRECT, ' ').includes('>')) return { accepted: false, why: 'redirect' };
  for (const m of s.matchAll(/(?:^|[;&|\n])\s*(?:echo|write-host|write-output)\b([^;&|\n]*)/gi)) {
    const arg = m[1].replace(/["']/g, '').trim();
    if (/decision|approved|\{/i.test(arg)) return { accepted: false, why: 'spoof-literal' };
    if (!EXIT_ARG.test(arg)) return { accepted: false, why: 'spoof-echo' };
  }
  for (const m of s.matchAll(/(?:^|[;&|\n])\s*("[^"]*"|'[^']*')\s*(?=$|[;&|\n])/g)) {
    const arg = m[1].replace(/["']/g, '').trim();
    if (/decision|approved|\{/i.test(arg)) return { accepted: false, why: 'spoof-literal' };
    if (!EXIT_ARG.test(arg)) return { accepted: false, why: 'spoof-echo' };
  }
  return { accepted: true, why: 'ok' };
}

export function isGateCliCommand(command) {
  return gateCliVerdict(command).accepted;
}

/* ---------------------------------------------------------------- shell variables
   Simple same-command literals only. Anything unresolved stays project (fail closed). */

export function resolveShellVars(command) {
  const vars = new Map();
  const conflict = new Set();
  const expandValue = (v) => {
    let out = String(v);
    for (let i = 0; i < 3; i++) {
      const before = out;
      for (const [k, val] of vars) out = out.replace(new RegExp(k.replace(/\$/g, '\\$') + '(?!\\w)', 'gi'), val);
      if (out === before) break;
    }
    return out;
  };
  const src = String(command ?? '');
  src.replace(/(?:^|[;\s])(\$env:)?\$([A-Za-z_]\w*)\s*=\s*("([^"]*)"|'([^']*)')/g, (m, ep, name, q, dq, sq) => {
    const key = (ep ? '$env:' : '$') + name.toLowerCase();
    const val = expandValue(dq ?? sq ?? '');
    if (vars.has(key) && vars.get(key) !== val) conflict.add(key);
    else if (!vars.has(key)) vars.set(key, val);
    return m;
  });
  let out = src;
  for (const key of conflict) vars.delete(key);
  for (const [key, val] of vars) out = out.replace(new RegExp(key.replace(/\$/g, '\\$') + '(?!\\w)', 'gi'), val);
  return out;
}

export function shellScope(command, env = {}) {
  return shellWrite(command, env).scope;
}

export function expandShell(command, env = {}) {
  let out = String(command ?? '');
  for (const key of ['TEMP', 'TMP', 'LOCALAPPDATA', 'USERPROFILE', 'APPDATA']) {
    const value = String((env && env[key]) || process.env[key] || '');
    if (!value) continue;
    out = out.replace(new RegExp('\\$env:' + key + '\\b', 'gi'), value).replace(new RegExp('%' + key + '%', 'gi'), value);
  }
  return resolveShellVars(out);
}

const cleanArg = (v) => String(v).replace(/^["']|["']$/g, '');
export function resolveJoinPath(s) {
  return String(s ?? '').replace(/Join-Path\s+("[^"]*"|'[^']*'|[^\s;]+)\s+("[^"]*"|'[^']*'|[^\s;]+)/gi, (m, a, b) => {
    const left = cleanArg(a);
    const right = cleanArg(b);
    if (UNRESOLVED.test(left) || UNRESOLVED.test(right)) return m;
    return left.replace(/[\\/]+$/, '') + '\\' + right.replace(/^[\\/]+/, '');
  });
}

const cleanTarget = (t) => String(t).replace(/^[\s"'`\\]+|[\s"'`\\]+$/g, '');
const pathish = (t) => /[\\/]|^[A-Za-z]:|^\$|^%/.test(t);
function targetsIn(stmt) {
  const out = [];
  for (const m of stmt.matchAll(/>{1,2}\s*([^\s;&|]+)/g)) out.push(m[1]);
  for (const m of stmt.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) {
    const v = m[1] ?? m[2] ?? m[3];
    if (!/[>|;&]/.test(v)) out.push(v);
  }
  for (const m of stmt.matchAll(/(?:^|[\s;&|])(?:set-content|add-content|out-file|remove-item|move-item|copy-item|new-item|rename-item|mkdir|rm|mv|cp)\b([^;&|]*)/gi)) {
    for (const tok of m[1].split(/\s+/)) out.push(tok);
  }
  return out.map(cleanTarget).filter((t) => t && pathish(t));
}

const unresolvedTarget = (t) => UNRESOLVED.test(String(t).replace(BUILTIN, ' '));

function classifyWrite(raw, env, detail, cwd) {
  const resolved = mapWsl(resolveJoinPath(expandShell(raw, env)));
  const targets = [];
  for (const stmt of stripNeutral(resolved).split(/\r?\n|;/)) {
    if (/^\s*(?:\$env:)?\$[A-Za-z_]\w*\s*=/.test(stmt)) continue;
    targets.push(...targetsIn(stmt));
  }
  if (!targets.length) {
    if (shellTouchesTemp(resolved)) return { write: true, detail, scope: 'temp' };
    const rel = [...resolved.matchAll(/>{1,2}\s*([^\s;&|"']+)/g)].map((m) => m[1]).filter((t) => !isAbs(t));
    if (rel.length && cwd && shellTouchesTemp(cwd)) return { write: true, detail, scope: 'temp' };
    return { write: true, detail, scope: 'project' };
  }
  for (const t of targets) {
    if (unresolvedTarget(t)) return { write: true, detail: 'unresolved-var', scope: 'project' };
    if (!isTempPath(t)) return { write: true, detail, scope: 'project' };
  }
  return { write: true, detail, scope: 'temp' };
}



const INTERP = /(python[0-9.]*|node|perl|ruby)\s+(-c|-e)\b/i;
const INTERP_WRITE = /open\s*\([^)]*['"][wa]b?['"]|writeFile|File\.write|>{1,2}/i;
const innerOf = (cmd) => {
  const m = /(?:bash|sh|cmd|powershell(?:\.exe)?)\s+(?:-c|\/c|-Command)\s+(["'])/i.exec(cmd);
  if (!m) return '';
  const q = m[1];
  const start = m.index + m[0].length;
  const tail = String(cmd).slice(start);
  const semi = tail.indexOf(';');
  const seg = semi >= 0 ? tail.slice(0, semi) : tail;
  const end = seg.lastIndexOf(q);
  if (end < 0) return '';
  return seg.slice(0, end).replace(/`"/g, '"').replace(/\\"/g, '"');
};
const cwdIn = (cmd, base) => {
  const m = /(?:^|[;&|]\s*)(?:cd\s+(?:\/d\s+)?|set-location\s+)("[^"]*"|'[^']*'|[^\s;&|]+)/i.exec(cmd);
  return m ? mapWsl(m[1].replace(/^["']|["']$/g, '')) : base;
};

/** write? + detail + scope for one shell command (inner -c scripts analysed too) */
export function shellWrite(command, env = {}, opts = {}) {
  const raw = expandShell(String(command ?? ''), env);
  const inner = innerOf(raw);
  if (inner) {
    const nested = shellWrite(inner, env, { cwd: cwdIn(inner, cwdIn(raw, opts.cwd)) });
    if (nested.write) return nested;
  }
  const cwd = cwdIn(raw, opts.cwd);
  if (INTERP.test(raw) && INTERP_WRITE.test(raw)) return { write: true, detail: 'interpreter-write', scope: 'project' };
  if (REDIRECT_WRITE.test(stripNeutral(raw))) return classifyWrite(raw, env, 'redirect', cwd);
  if (IO_WRITE.test(raw)) return classifyWrite(raw, env, 'io-write', cwd);
  if (WRITE_VERB.test(raw)) return classifyWrite(raw, env, 'write-verb', cwd);
  return { write: false, detail: '', scope: 'read' };
}


/** shell command that writes: allowed only when every path it names is inside a temp root */
export function shellTouchesTemp(command, tempRoots = defaultTempRoots()) {
  const s = normalizedPath(command);
  return (tempRoots || []).some((root) => {
    const r = normalizedPath(root);
    return !!r && (s.includes(r + '/') || s.endsWith(r));
  });
}

/* ---------------------------------------------------------------- protected paths
   Config/state/skills/plannotator live under HOME. Never writable by any flow phase. */

const PROTECTED_REL = ['.config/opencode', '.local/state/opencode', '.agents', '.plannotator'];

function homeOf(env) {
  const fromEnv = env && (env.HOME || env.USERPROFILE);
  const raw = fromEnv || process.env.HOME || process.env.USERPROFILE || '';
  return String(raw).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function expandHome(value, home) {
  let s = String(value == null ? '' : value);
  s = s.replace(/%userprofile%/gi, home).replace(/\$home\b/gi, home);
  s = s.replace(/^~(?=[\\/]|$)/, home);
  s = s.replace(/([\s"'=:(])~(?=[\\/])/g, (m, pre) => pre + home);
  return s.replace(/\\/g, '/').toLowerCase();
}

function normalizeSegments(s) {
  const parts = [];
  for (const seg of String(s).split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.join('/');
}

/** true when p resolves inside a protected root under HOME */
export function isProtectedPath(p, env = {}) {
  const home = homeOf(env);
  if (!home) return false;
  const norm = normalizeSegments(expandHome(p, home));
  if (!norm) return false;
  return PROTECTED_REL.some((rel) => {
    const root = normalizeSegments(home + '/' + rel);
    return !!root && (norm === root || norm.startsWith(root + '/'));
  });
}

/** true when any path-like token in the command resolves inside a protected root */
export function protectedInCommand(cmd, env = {}) {
  const home = homeOf(env);
  if (!home) return false;
  const expanded = expandHome(mapWsl(cmd), home);
  for (const rel of PROTECTED_REL) {
    const root = normalizeSegments(home + '/' + rel);
    if (root && expanded.includes(root)) return true;
  }
  for (const token of expanded.split(/[\s"'`|;&<>(),=]+/)) {
    if (!token || token.length < 3) continue;
    if (isProtectedPath(token, env)) return true;
  }
  return false;
}
