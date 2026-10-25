/* bazer-flow diag — shape-only payload diagnostics. Never logs values. */

export function shapeOf(value, depth = 1) {
  if (value == null) return String(value);
  if (Array.isArray(value)) return depth < 0 ? 'array' : '[' + (value.length ? shapeOf(value[0], depth - 1) : '') + ']';
  if (typeof value !== 'object') return typeof value;
  const keys = Object.keys(value).slice(0, 20).map((k) => k + ':' + (depth < 0 ? typeof value[k] : shapeOf(value[k], depth - 1)));
  return '{' + keys.join(',') + '}';
}

/** miss(): dedupe by hook+shape, at most maxDistinct entries per process.
    sample(): first `debugPayloads` payload shapes per hook (env-gated by caller). */
export function createDiag(log, maxDistinct = 30, debugPayloads = 0) {  const seen = new Set();
  const samples = new Map();
  const emit = (entry) => {
    if (typeof log !== 'function') return;
    try { log(entry); } catch { /* diagnostics never throw */ }
  };
  return {
    miss(hook, payload) {
      const shape = String(hook) + '|' + shapeOf(payload);
      if (seen.has(shape) || seen.size >= maxDistinct) return;
      seen.add(shape);
      emit({ event: 'adapter-miss', hook: String(hook), shape });
    },
    sample(hook, payload) {
      const used = samples.get(hook) || 0;
      if (used >= debugPayloads) return;
      samples.set(hook, used + 1);
      emit({ event: 'debug-payload', hook: String(hook), shape: shapeOf(payload) });
    },
  };
}

/** Short reason code for a deny hint. */
export function codeOf(hint) {
  const text = String(hint || '');
  if (/Protected path/i.test(text)) return 'protected';
  if (/Flow link missing/i.test(text)) return 'orphan';
  if (/flow error|Flow unavailable/i.test(text)) return 'error';
  return 'phase-order';
}

/** Names + typeof only, depth-limited, cycle-safe, never throws. */
export function introspect(root, maxDepth = 3, cap = 200, skip = null) {
  const out = [];
  const methods = [];
  const seen = new WeakSet();
  const walk = (obj, depth, prefix) => {
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return;
    if (out.length >= cap) return;
    if (typeof obj === 'object') {
      if (seen.has(obj)) return;
      seen.add(obj);
    }
    let names = [];
    try { names = Object.getOwnPropertyNames(obj); } catch { return; }
    for (const name of names) {
      if (skip && skip.has(name)) continue;
      if (out.length >= cap) break;
      let value;
      let type;
      try { value = obj[name]; type = typeof value; } catch { out.push(prefix + name + ':throws'); continue; }
      out.push(prefix + name + ':' + type);
      if (/hook|on|subscribe|register/i.test(name) && type === 'function') methods.push(prefix + name);
      if (depth < maxDepth && value && (type === 'object' || type === 'function') && name !== 'constructor') {
        walk(value, depth + 1, prefix + name + '.');
      }
    }
  };
  walk(root, 0, '');
  return { ctxKeys: out, ctxMethods: methods };
}

const CTX_SKIP = new Set(['length', 'name', 'prototype', 'constructor', 'arguments', 'caller']);

/** Flat name list for v2/ctx.txt (no .length/.name entries, cap 800 by default). */
export function ctxNames(root, cap = 800) {
  return introspect(root, 3, cap, CTX_SKIP).ctxKeys;
}

export function bootEntry({ build, hooks, spec, dir, ctx }) {
  const { ctxMethods } = introspect(ctx, 3, 800, CTX_SKIP);
  return { event: 'boot', build, hooks: [...(hooks || [])], spec: String(spec || ''), dir: String(dir || ''), ctxMethods };
}

/** every string leaf, depth-limited */export function stringLeaves(value, depth = 5, out = []) {
  if (typeof value === 'string') { if (value) out.push(value); return out; }
  if (depth < 0 || value == null || typeof value !== 'object') return out;
  if (Array.isArray(value)) for (const item of value) stringLeaves(item, depth - 1, out);
  else for (const key of Object.keys(value)) stringLeaves(value[key], depth - 1, out);
  return out;
}

const ENUM_KEYS = new Set(['type', 'delivery']);
/** shape with string lengths; enum-ish keys keep their value */
export function shapeDeep(value, depth = 4, key = '', plain = false) {
  if (value == null) return String(value);
  if (typeof value === 'string') return !plain && ENUM_KEYS.has(key) ? value.slice(0, 24) : 's' + value.length;
  if (typeof value !== 'object') return typeof value;
  if (Array.isArray(value)) return '[' + (value.length ? shapeDeep(value[0], depth - 1, key, plain) : '') + ']';
  if (depth < 0) return '{}';
  return '{' + Object.keys(value).slice(0, 12).map((k) => k + ':' + shapeDeep(value[k], depth - 1, k, plain)).join(',') + '}';
}

/** any key named like the given names, depth-limited */
export function hasKey(value, names, depth = 4) {
  if (!value || typeof value !== 'object' || depth < 0) return false;
  for (const key of Object.keys(value)) {
    if (names.has(key)) return true;
    if (hasKey(value[key], names, depth - 1)) return true;
  }
  return false;
}


export function createFlowLog(emit, getRt, shared) {
  const lastDeny = new Map();
  const box = shared && typeof shared === 'object' ? shared : {};
  if (!box.roots) box.roots = new Map();
  if (!box.agents) box.agents = new Map();
  const roots = box.roots;
  const agents = box.agents;
  const s8 = (v) => String(v || '').slice(-6);
  const info = (sid) => {
    const rt = getRt();
    return (rt && rt.info && rt.info(sid)) || { root: null, hops: 0, flow: null, phase: null };
  };
  return {
    root(sid) {
      if (!sid) return;
      const i = info(sid);
      const key = i.root || '';
      if (roots.get(sid) === key) return;
      roots.set(sid, key);
      emit({ event: 'root', sid6: s8(sid), root6: i.root ? s8(i.root) : null, hops: i.hops || 0 });
    },
    agent(sid, from, to, src) {
      if (!sid || !to) return;
      if (agents.get(sid) === String(to)) return;
      agents.set(sid, String(to));
      if (String(from || '') === String(to)) return;
      emit({ event: 'agent', sid6: s8(sid), from: String(from || ''), to: String(to), src: String(src || '') });
    },
    deny(hook, sid, req, reason) {
      if (!sid) return;
      const i = info(sid);
      const detail = req && req.subagent
        ? { subagent: String(req.subagent) }
        : req && req.path
          ? { path: String(req.path).slice(0, 200) }
          : req && req.command
            ? { cmd: String(req.command).slice(0, 200) }
            : {};
      const sig = [hook, (req && req.tool) || '', detail.subagent || detail.path || detail.cmd || '', reason].join('|');
      if (lastDeny.get(sid) === sig) return;
      lastDeny.set(sid, sig);
      emit({
        event: 'deny',
        hook: String(hook),
        sid6: s8(sid),
        root6: i.root ? s8(i.root) : null,
        flow: i.flow || null,
        phase: i.phase || null,
        tool: (req && req.tool) || '',
        ...detail,
        reasonCode: String(reason || 'phase'),
      });
    },
  };
}
