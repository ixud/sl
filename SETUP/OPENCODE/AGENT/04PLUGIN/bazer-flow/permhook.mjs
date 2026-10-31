/* permission.evaluate body. Pure: every dependency is injected.
   Mutates event.effect only for a ladder grant or a flow deny; exceptions leave it unchanged. */
export function runPerm(event, deps) {
  const sid = String((deps && deps.sid) || '');
  const action = String((event && event.action) || '');
  const resources = Array.isArray(event && event.resources) ? event.resources : [];
  const agent = String((event && event.agent) || '');
  const key = sid + '|' + action;
  try {
    if (!event || event.effect == null || event.effect === '') {
      const sk = sid + '|no-effect';
      if (!deps.skipSeen.has(sk)) {
        deps.skipSeen.set(sk, 1);
        deps.emit({ event: 'ladder-skip', sid6: sid.slice(-6), reqAgent: agent, action, effect: '', reason: 'no-effect', level: 0, rootKnown: false });
      }
      return;
    }
    const req = deps.toReq(event);
    if (resources.some((r) => deps.credentialPath && deps.credentialPath(String(r)))) { event.effect = 'deny'; event.message = 'STOP. Protected credential/state file. Do not read or write it. Tell the user.'; return; }
    if (!action) deps.miss('permission.evaluate', event);
    const verdict = deps.peek(sid, req, String(event.effect), action, resources, agent);
    if (!verdict.allow) {
      deps.deny('permission.evaluate', sid, req, verdict.detail || (deps.codeOf ? deps.codeOf(verdict.hint) : ''));
      event.effect = 'deny';
      event.message = 'bazer-flow: ' + verdict.hint;
    } else if (verdict.ladder === 'allow') event.effect = 'allow';
  } catch (e) {
    if (deps.fail) deps.fail(e);
  } finally {
    const ck = key + (event.effect === 'ask' ? '|ask' : '|x');
    const n = deps.permSeen.get(ck) || 0;
    if (event.effect === 'ask' || n < 5) {
      deps.permSeen.set(ck, n + 1);
      const meta = event && event.metadata && typeof event.metadata === 'object' ? event.metadata : null;
      deps.emit({ event: 'perm', sid6: sid.slice(-6), agent, action, n: resources.length, lens: resources.slice(0, 5).map((r) => String(r).length), hasMeta: !!meta, metaKeys: meta ? Object.keys(meta).slice(0, 8) : [], effect: String((event && event.effect) || ''), source: String((event && event.source && event.source.type) || '') });
    }
  }
}
