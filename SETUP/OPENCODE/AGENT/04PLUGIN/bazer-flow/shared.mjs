/* One validated process-wide slot for bazer-flow state.
   Never trust an existing value: repair fields in place on every call. */
const KEY = Symbol.for('bazer.flow.shared');
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export function sharedState() {
  let g = globalThis[KEY];
  if (!isObj(g)) g = globalThis[KEY] = {};
  if (!(g.hooks instanceof Set)) g.hooks = new Set();
  if (!(g.evt instanceof Map)) g.evt = new Map();
  if (!isObj(g.flow)) g.flow = {};
  return g;
}
export function sharedBox() {
  const g = sharedState();
  for (const k of ['checks', 'dups', 'plain', 'sh', 'gca', 'mig', 'ta', 'gcl']) if (!(g[k] instanceof Set)) g[k] = new Set();
  return g;
}
/** Diagnostics only: true when the hook name is newly recorded; never throws. */
export function recordHook(name) {
  try {
    const g = sharedState();
    if (g.hooks.has(name)) return false;
    g.hooks.add(name);
    return true;
  } catch { return false; }
}
