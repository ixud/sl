/* bazer-flow shell-end mapping — backgrounded gate CLI calls (store-backed). */

export const RUNNING_HINT = 'STOP. Gate review still running. Tell the user to finish it in the browser, then end your turn. Do not retry.';
const KEY = 'shids';

export function shellIdFrom(meta, leaves) {
  const m = meta || {};
  if (m.shellID) return String(m.shellID);
  if (m.shellId) return String(m.shellId);
  for (const leaf of leaves || []) {
    const hit = /"shellID"\s*:\s*"([^"]+)"/.exec(String(leaf));
    if (hit) return hit[1];
  }
  return '';
}

export function shellEndLeaves(data) {
  const out = [];
  const add = (v, depth) => {
    if (typeof v === 'string') { if (v) out.push(v); return; }
    if (depth < 0 || v == null || typeof v !== 'object') return;
    for (const k of Object.keys(v)) add(v[k], depth - 1);
  };
  add(data && data.output, 5);
  add(data && data.shell && data.shell.output, 5);
  return out;
}

export function createShellMap(store) {
  const list = () => { const v = store.get(KEY); return Array.isArray(v) ? v.slice() : []; };
  const put = (l) => store.set(KEY, l.slice(-50));
  return {
    remember(shellId, info) {
      const id = String(shellId || '');
      if (!id) return;
      const l = list().filter((x) => x !== id);
      l.push(id);
      put(l);
      store.set('shid:' + id, { ...info, id });
    },
    take(shellId) {
      const id = String(shellId || '');
      const v = store.get('shid:' + id);
      if (v) store.del('shid:' + id);
      put(list().filter((x) => x !== id));
      return v || null;
    },
    running(sid, root) {
      for (const id of list()) {
        const v = store.get('shid:' + id);
        if (v && (v.sid === sid || (root && v.root === root))) return true;
      }
      return false;
    },
  };
}
