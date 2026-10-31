/* Ladder L0-L2: external state file + conservative shell classifier.
   Never writes the file; grants only when host effect is 'ask'; DANGER/UNKNOWN never. */
import fs from 'node:fs';
import path from 'node:path';
import { isTempPath, defaultTempRoots, shellWrite, expandShell, protectedInCommand, isProtectedPath } from './paths.mjs';
import { sharedState } from './shared.mjs';
import { DANGER, redact } from './rules.mjs';
const RANK = { READ: 0, TEMPWRITE: 1, PROJWRITE: 2, BUILD: 3, UNKNOWN: 4, DANGER: 5 };
const ZERO = { v: 1, level: 0, expires: null, setBy: '' };
const CACHE = { file: '', at: 0, mtime: -1, entry: ZERO, seen: new Map(), err: false, parse: 'missing', skip: new Map() };
const BUILD = /^\s*(?:(?:npm|pnpm|yarn)\s+(?:test|run\s+(?:test|build|lint|typecheck))|node\s+--test|tsc|pytest|dotnet\s+(?:build|test)|git\s+(?:add|commit|stash))\b/i;
const DELETE = /(?:^|[;&|{(\s])(?:remove-item|rm|del|rd|rmdir|erase)\b/i;
const READ = /^\s*(?:get-content|get-childitem|select-string|get-item|test-path|get-location|get-date|measure-object|sort-object|where-object|foreach-object|out-string|write-output|cat|ls|dir|type|head|tail|rg|grep|new-object\s+system\.text)\b/i;
const GIT_READ = /^\s*git\s+(?:status|diff|log|show|branch(?!\s+-[dD]\b)|rev-parse|ls-files)\b/i;
const FIND_READ = /^\s*find\b(?![\s\S]*-(?:delete|exec))/i;
const DOTNET_READ = /^\s*(?:\[System\.IO\.File\]::(?:ReadAllText|ReadAllLines|Exists)|\[Console\]::OutputEncoding\s*=)/i;
const EXPR = /^(?:\$|\[|"|'|if\b|foreach\b|for\b|while\b|try\b|\}|\{)/;
export function loadLadder(store, file, now = Date.now()) {
  if (!file) { CACHE.file = ''; CACHE.entry = ZERO; CACHE.parse = 'missing'; return ZERO; }
  let st;
  try { st = fs.statSync(file); } catch { CACHE.file = file; CACHE.at = now; CACHE.mtime = -1; CACHE.entry = ZERO; CACHE.parse = 'missing'; return ZERO; }
  if (CACHE.file === file && CACHE.entry && CACHE.mtime === st.mtimeMs && now > CACHE.at && now - CACHE.at < 2000) return CACHE.entry;
  let e = ZERO, parse = 'invalid';
  try {
    const o = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (o && o.v === 1 && Number.isInteger(o.level) && o.level >= 0 && o.level <= 2 && (o.expires == null || Number.isFinite(o.expires))) { e = { v: 1, level: o.level, expires: o.expires == null ? null : Number(o.expires), setBy: String(o.setBy || '') }; parse = 'ok'; }
  } catch { /* invalid -> L0 */ }
  CACHE.parse = parse;
  CACHE.file = file; CACHE.at = now; CACHE.mtime = st.mtimeMs; CACHE.entry = e;
  return e;
}
export function levelOf(e, now = Date.now()) { return e && e.level === 2 && e.expires != null && now > e.expires ? 1 : (e && e.level) || 0; }
export function levelNow(now = Date.now()) { return levelOf(CACHE.entry || ZERO, now); }
const sourceOf = (o, now) => (typeof o.loader === 'function' ? o.loader(now) : loadLadder(null, o.file, now));
export function sourceInfo(file, now = Date.now()) {
  if (!file) return { event: 'ladder-src', path: '', exists: false, mtime: 0, level: 0, parse: 'missing' };
  let st;
  try { st = fs.statSync(file); } catch { return { event: 'ladder-src', path: String(file), exists: false, mtime: 0, level: 0, parse: 'missing' }; }
  loadLadder(null, file, now);
  return { event: 'ladder-src', path: String(file), exists: true, mtime: st.mtimeMs, level: levelNow(now), parse: CACHE.parse };
}
export function dangerVerdict(o = {}) {
  try {
    const listed = o.r.flow ? o.specLadder.flows.includes(o.r.flow) : o.specLadder.agents.includes(String(o.agent || '').toLowerCase());
    if (!listed || levelOf(sourceOf(o, o.now), o.now) < 1) return null;
    return classifyAll(String((o.req && o.req.command) || ''), { env: o.env, temps: o.temps, cwd: String((o.req && o.req.workdir) || '') }).worst === 'DANGER' ? { allow: false, hint: 'STOP. Dangerous command blocked by the permission ladder. Ask the user to run it themselves.', detail: 'ladder-danger' } : null;
  } catch { return null; }
}
export function loadLadderSpec(spec) {
  const l = spec && spec.ladder;
  if (!l || typeof l !== 'object' || Array.isArray(l)) throw new Error('spec: ladder');
  const list = (v, name) => {
    if (!Array.isArray(v) || !v.length || v.some((x) => typeof x !== 'string' || !x.trim())) throw new Error('spec: ladder ' + name);
    return [...new Set(v.map((x) => x.trim().toLowerCase()))];
  };
  return { agents: list(l.agents, 'agents'), flows: list(l.flows, 'flows') };
}
/** Quote/paren-aware split; keeps $( ), quotes and backticks together. */
export function splitStatements(text) {
  const out = []; let cur = '', q = '', depth = 0; const src = String(text || '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { cur += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (depth === 0 && (ch === ';' || ch === '\n' || ch === '\r')) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    if (depth === 0 && ch === '|' && src[i + 1] !== '|') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    if (depth === 0 && ch === '&' && src[i + 1] === '&') { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function innerScript(s) {
  const m = /(?:powershell(?:\.exe)?|pwsh|bash|sh|cmd(?:\.exe)?)\s+(?:-c|\/c|-Command)\s+(["'])/i.exec(s);
  if (!m) return '';
  const start = m.index + m[0].length, end = s.lastIndexOf(m[1]);
  return end > start ? s.slice(start, end) : '';
}
export function classifySegment(text, ctx = {}) {
  const s = String(text || '').trim();
  if (!s) return 'READ';
  const env = ctx.env || {}, temps = ctx.temps || defaultTempRoots();
  if (DANGER.some((re) => re.test(s)) || protectedInCommand(expandShell(s, env), env)) return 'DANGER';
  const inner = innerScript(s);
  if (inner) { const c = classifyAll(inner, ctx).worst; return c === 'READ' ? 'READ' : c; }
  if (BUILD.test(s)) return 'BUILD';
  const w = ctx.scope ? { write: ctx.scope !== 'read', scope: ctx.scope, detail: ctx.detail || '' } : shellWrite(s, env, { cwd: ctx.cwd || '', tempRoots: temps });
  if (DELETE.test(s)) return w.scope === 'temp' && w.detail !== 'unresolved-var' ? 'TEMPWRITE' : 'DANGER';
  if (w.write) return w.scope === 'temp' && w.detail !== 'unresolved-var' ? 'TEMPWRITE' : 'PROJWRITE';
  if (READ.test(s) || GIT_READ.test(s) || FIND_READ.test(s) || DOTNET_READ.test(s) || EXPR.test(s)) return 'READ';
  return 'UNKNOWN';
}
export function classifyAll(text, ctx = {}) {
  const s = String(text || ''); const classes = [];
  if (DANGER.some((re) => re.test(s))) classes.push('DANGER');
  const full = shellWrite(s, ctx.env || {}, { cwd: ctx.cwd || '', tempRoots: ctx.temps || defaultTempRoots() });
  const cc = { ...ctx, scope: full.write ? full.scope : 'read', detail: full.detail || '' };
  const segments = [];
  for (const stmt of splitStatements(s)) { const kind = classifySegment(stmt, cc); classes.push(kind); segments.push({ text: stmt, kind }); }
  if (!classes.length) classes.push('READ');
  return { worst: classes.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'READ'), classes: [...new Set(classes)].slice(0, 6), segments };
}
const actionOf = (req) => (req && req.tool === 'shell' ? 'shell' : req && req.tool === 'write' ? 'edit' : req && req.tool === 'task' ? 'subagent' : 'read');
const writeOK = (r, spec) => !r.flow || !!(r.state && spec && spec.flows && spec.flows[r.flow] && spec.flows[r.flow].phases[r.state.phase] && spec.flows[r.flow].phases[r.state.phase].writeProject);
const usable = (p) => typeof p === 'string' && !!p.trim() && !/[*?[\]]/.test(p) && path.isAbsolute(p);
const dirGlob = (p) => {
  if (typeof p !== 'string' || !p.trim()) return null;
  const m = /^(.*[\\/])\*$/.exec(p.trim());
  if (!m || /[*?[\]]/.test(m[1]) || !path.isAbsolute(m[1])) return null;
  return m[1];
};
export function applyLadder(opts = {}) {
  try {
    const { r, req, effect, agent, specLadder, spec, file, env = {}, temps = defaultTempRoots(), now = Date.now(), log, action, resources } = opts;
    if (effect === undefined) return null;
    const act = String(action || actionOf(req));
    const level = levelOf(sourceOf(opts, now), now);
    const reqAgent = String(opts.reqAgent || '').toLowerCase();
    const rootKnown = !!(agent && String(agent).trim());
    const S = sharedState();
    if (!S.ladderSrc) {
      S.ladderSrc = 1;
      if (typeof log === 'function') log(sourceInfo(opts.loader ? null : file, now));
    }
    const skip = (reason) => {
      const key = String((r && r.root) || '') + '|' + reason;
      const n = CACHE.skip.get(key) || 0;
      if (n < 1 && typeof log === 'function') {
        CACHE.skip.set(key, n + 1);
        log({ event: 'ladder-skip', sid6: String((r && r.root) || '').slice(-6), reqAgent, action: act, effect: String(effect || ''), reason, level, rootKnown });
      }
      return null;
    };
    if (!r || !r.root) return skip('no-root');
    if (!specLadder) return skip('no-spec');
    if (effect !== 'ask') return skip('not-ask');
    let known = String(agent || '').toLowerCase();
    if (!known && !r.flow && String(r.root) === String(opts.sid || '') && specLadder.agents.includes(reqAgent)) { known = reqAgent; skip('fallback'); }
    const listed = r.flow ? specLadder.flows.includes(r.flow) : specLadder.agents.includes(known);
    if (!listed) return skip('not-listed');
    if (level < 1) return skip(CACHE.parse === 'ok' ? 'level0' : 'bad-file');
    const given = Array.isArray(resources) ? resources : Array.isArray(req && req.resources) ? req.resources : [];
    let kinds = [], n = 0, ok = false, unkText = [];
    if (act === 'shell') {
      const list = Array.isArray(resources) || Array.isArray(req && req.resources) ? given : [req && req.command];
      n = list.length;
      if (!n || list.some((r) => typeof r !== 'string' || !r.trim())) return skip('unusable');
      const cs = list.map((cmd) => classifyAll(cmd, { env, temps, cwd: String((req && req.workdir) || '') }));
      kinds = [...new Set(cs.flatMap((c) => c.classes))].slice(0, 6);
      unkText = cs.flatMap((c) => c.segments || []).filter((x) => x.kind === 'UNKNOWN' || x.kind === 'PROJWRITE').slice(0, 5).map((x) => redact(x.text));
      const worst = cs.reduce((a, c) => (RANK[c.worst] > RANK[a] ? c.worst : a), 'READ');
      ok = worst === 'READ' || worst === 'TEMPWRITE' || (level >= 2 && (worst === 'PROJWRITE' || worst === 'BUILD') && writeOK(r, spec));
    } else if (act === 'edit' || act === 'write' || act === 'patch') {
      const paths = given.length ? given : [req && req.path];
      kinds = ['EDIT']; n = paths.length;
      ok = n > 0 && paths.every((p) => usable(p) && isTempPath(p, temps));
      if (!ok && level >= 2 && writeOK(r, spec) && n > 0) ok = paths.every((p) => usable(p) && !isProtectedPath(p, env));
    } else if (act === 'external_directory') {
      kinds = ['EXTERNAL']; n = given.length; ok = n > 0 && given.every((p) => { const d = dirGlob(p); return d ? isTempPath(d, temps) : usable(p) && isTempPath(p, temps); });
    } else if (act === 'webfetch' || act === 'websearch') {
      kinds = ['NET']; n = 1; ok = level >= 2;
    } else return skip('other');
    const seen = CACHE.seen.get(r.root) || 0;
    if (seen < 10 && typeof log === 'function') {
      CACHE.seen.set(r.root, seen + 1);
      log({ event: 'ladder', sid6: String(r.root).slice(-6), agent: String(known || ''), action: act, level, verdict: ok ? 'allow' : 'leave', n, kinds: kinds.slice(0, 6), unk: unkText || [], before: 'ask', after: ok ? 'allow' : 'leave' });
    }
    return ok ? { allow: true, hint: '', ladder: 'allow', level, kinds } : null;
  } catch (e) {
    if (typeof opts.log === 'function') opts.log({ event: 'ladder-err', msg: String((e && e.message) || e).slice(0, 120) });
    return null;
  }
}
export const LADDER_FILE = (home) => path.join(String(home || ''), '.local', 'state', 'opencode', 'bazer-flow', 'ladder.json');
