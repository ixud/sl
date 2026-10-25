/* bazer-flow runtime — stateful layer over engine.mjs.
   No OpenCode imports, no IO: store, clock and sinks are injected.
   State and meta are read from the store on every access (no in-memory state cache). */
import { loadSpec, init, check, apply, remind, badge as engineBadge, serialize, deserialize } from './engine.mjs';
import { isTempPath, looksLikeWrite, shellTouchesTemp, defaultTempRoots, isProtectedPath, protectedInCommand, isGateCliCommand, gateCliVerdict, shellWrite, resolveShellVars, expandShell } from './paths.mjs';
import { shapeDeep, stringLeaves, hasKey } from './diag.mjs';
import { createShellMap, shellIdFrom, shellEndLeaves, RUNNING_HINT } from './shellend.mjs';
import { denyHint, tempOnlyHint, migrateOf, taskAfter, taskStatus, requiredAgent } from './child.mjs';
import { gateToolOutcome, gateToolHead, toolLeaves, classifyPlanResult, lastGateDecision } from './gatetool.mjs';
export { classifyPlanResult } from './gatetool.mjs';
import os from 'node:os';

const META_KEY = 'meta';
const PROTECTED_HINT = 'Protected path. Never edit plugin/config/state. Stop and tell the user.';
const WRITE_TOOL_HINT = 'Use the write/edit tool with a full literal path under %TEMP%\\bazer\\<task>\\ instead of shell redirects.';
const DETAIL_HINT = {
  'unresolved-var': 'STOP. Each shell call is a separate process; variables do not persist. Use full literal paths in this one command, or use the write tool.',
  redirect: WRITE_TOOL_HINT,
  'io-write': WRITE_TOOL_HINT,
  'interpreter-write': WRITE_TOOL_HINT,
};
const ORPHAN_HINT = 'STOP. Flow link missing — project writes are closed. Tell the user to restart OpenCode.';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rawOf = (v) => String(v == null ? '' : v).slice(0, 120);

/** Version of the Plannotator OpenCode plugin whose output strings we classify. */
export const PLANNOTATOR_VERSION = '0.28.23';

export function createRuntime({ spec, store, now, log, badgeSink, home, env: envIn = {} } = {}) {
  const clock = typeof now === 'function' ? now : () => Date.now();
  const ENV = Object.assign({}, process.env, envIn || {});
  const env = { HOME: String(home || ENV.USERPROFILE || os.homedir()) };
  loadSpec(spec);

  const flowIds = new Set(Object.keys(spec.flows));
  const subagentIds = new Set([...(spec.defaults.helpers || [])]);
  for (const f of Object.values(spec.flows)) {
    for (const p of Object.values(f.phases)) {
      if (p.expect) subagentIds.add(p.expect);
      for (const a of p.also || []) subagentIds.add(a);
    }
  }

  const calls = new Map();
  const temps = defaultTempRoots();
  const shells = createShellMap(store);

  function readMeta() {
    const m = store.get(META_KEY);
    return m && typeof m === 'object' && m.agents && m.links ? m : { agents: {}, links: {} };
  }
  function saveMeta(m) { store.set(META_KEY, m); }
  function agentOf(sid) { return String(readMeta().agents[String(sid)] || ''); }

  function seenList() { const v = store.get('seen'); return Array.isArray(v) ? v.slice() : []; }
  function seenOnce(key) {
    if (!key) return true;
    const list = seenList();
    if (list.includes(key)) return false;
    list.push(key);
    while (list.length > 200) list.shift();
    store.set('seen', list);
    return true;
  }
  function rootOf(sid) {
    const r = resolveRoot(sid);
    return r.root == null ? String(sid == null ? '' : sid) : r.root;
  }

  function resolveRoot(sid) {
    const links = readMeta().links;
    const id = String(sid == null ? '' : sid);
    if (!id) return { root: null, hops: 0 };
    let cur = id;
    const seen = new Set([cur]);
    let hops = 0;
    for (let i = 0; i < 5; i++) {
      const parent = links[cur];
      if (!parent) return { root: cur, hops };
      if (seen.has(parent)) return { root: null, hops: hops + 1 };
      seen.add(String(parent));
      cur = String(parent);
      hops += 1;
    }
    return { root: cur, hops };
  }

  function flowOf(root) {
    const agent = readMeta().agents[root];
    return agent && flowIds.has(agent) ? agent : null;
  }

  /** root/hops/flow/phase/agent for diagnostics (reads the store, never writes) */
  function info(sid) {
    const id = String(sid == null ? '' : sid);
    const r = resolveRoot(id);
    const flow = r.root ? flowOf(r.root) : null;
    const phase = flow ? getState(r.root, flow).phase : null;
    const agent = agentOf(id) || (r.root ? agentOf(r.root) : '');
    return { root: r.root, hops: r.hops, flow, phase, agent };
  }

  function getState(root, flow) {
    const key = root + '.' + flow;
    const stored = store.get(key);
    let s = null;
    if (stored) {
      const mig = migrateOf(stored, spec, flow);
      try { s = mig && mig.kind === 'reset' ? null : deserialize(stored, clock()); } catch { s = null; }
      if (mig) {
        const b = sharedBox(); const mk = 'mig:' + key + ':' + mig.kind + ':' + mig.from;
        if (!b.mig.has(mk)) { b.mig.add(mk); gateLog({ event: 'migrate', kind: mig.kind, flow, from: mig.from, to: mig.to }); }
        store.set(key, serialize(s || init(flow, undefined, clock())));
        if (mig.notice) store.set('notice.' + key, { text: mig.notice });
      }
    }
    if (!s || s.flow !== flow) s = init(flow, undefined, clock());
    return s;
  }

  function record(root, flow, prev, next, event, extra, onceKey) {
    store.set(root + '.' + flow, serialize(next));
    const b = onceKey ? sharedBox() : null;
    const skip = b ? b.gcl.has(onceKey) : false;
    if (b) b.gcl.add(onceKey);
    const entry = { at: clock(), root, flow, from: prev ? prev.phase : null, to: next.phase, event };
    if (extra) Object.assign(entry, extra);
    if (typeof log === 'function' && !skip) {
      try { log(entry); } catch { /* logging never breaks the gate */ }
    }
    if (typeof badgeSink === 'function') {
      const text = engineBadge(next);
      try { badgeSink(root, text); } catch { /* badge is cosmetic */ }
      for (const sid of Object.keys(readMeta().agents)) {
        if (sid === root) continue;
        if (rootOf(sid) !== root) continue;
        try { badgeSink(sid, text); } catch { /* badge is cosmetic */ }
      }
    }
  }

  function remember(id, name) {
    if (!id || !name) return;
    if (calls.has(id)) calls.delete(id);
    calls.set(id, name);
    while (calls.size > 50) calls.delete(calls.keys().next().value);
  }

  function rememberGate(id) {
    const gid = String(id || '');
    if (!gid) return;
    const list = gateList().filter((x) => x !== gid);
    list.push(gid);
    while (list.length > 50) list.shift();
    store.set('gcli', list);
  }
  function gateList() { const v = store.get('gcli'); return Array.isArray(v) ? v.slice() : []; }
  function gateHas(id) { return !!id && gateList().includes(String(id)); }
  function gateDrop(id) { store.set('gcli', gateList().filter((x) => x !== String(id || ''))); }

  function sharedBox() {
    const box = globalThis[Symbol.for('bazer.flow.shared')] || (globalThis[Symbol.for('bazer.flow.shared')] = {});
    box.checks = box.checks || new Set(); box.dups = box.dups || new Set(); box.plain = box.plain || new Set(); box.sh = box.sh || new Set(); box.gca = box.gca || new Set(); box.mig = box.mig || new Set(); box.ta = box.ta || new Set(); box.gcl = box.gcl || new Set();
    return box;
  }

  function gateCheck(callId, cmd) {
    const gid = String(callId || ''); const box = sharedBox(); const key = gid || cmd;
    if (box.checks.has(key)) return;
    box.checks.add(key);
    const v = gateCliVerdict(cmd);
    gateLog({ event: 'gate-cli-check', callId6: gid.slice(-6), accepted: v.accepted, why: v.why });
  }

  function candidateText(leaves) {
    const parts = [leaves.join('\n')];
    for (const leaf of leaves) {
      for (let v = leaf, i = 0; i < 3 && typeof v === 'string'; i++) {
        const t = v.trim();
        if (!/^[{["]/.test(t)) break;
        try { v = JSON.parse(t); } catch { break; }
        parts.push(stringLeaves(v, 5).join('\n'));
      }
      parts.push(leaf.replace(/\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\"/g, '"'));
    }
    return parts.join('\n');
  }

  function engineReq(req) {
    const t = req && req.tool;
    if (t === 'task') return { t: 'subagent', name: String((req && req.subagent) || '') };
    if (t === 'submit_plan') return { t: 'submit_plan' };
    if (t === 'write') return { t: 'write', scope: isTempPath(String((req && req.path) || ''), temps) ? 'temp' : 'project' };
    if (t === 'shell') {
      const w = shellWrite(String((req && req.command) || ''), ENV, { cwd: String((req && req.workdir) || '') });
      return w.write ? { t: 'write', scope: w.scope, detail: w.detail } : { t: 'read', detail: '' };
    }
    return { t: 'read' };
  }

  function protectedVerdict(req) {
    const t = req && req.tool;
    if (t === 'write' && isProtectedPath(req.path, env)) return { allow: false, hint: PROTECTED_HINT, detail: 'protected' };
    if (t === 'shell') {
      const cmd = expandShell(String(req.command || ''), ENV);
      if (shellWrite(cmd, ENV).write && protectedInCommand(cmd, env)) return { allow: false, hint: PROTECTED_HINT, detail: 'protected' };
    }
    return null;
  }

  /** verdict only — reads state, never writes state/store/log */
  function evaluate(sid, req) {
    const id = String(sid == null ? '' : sid);
    const root = rootOf(id);
    const flow = flowOf(root);
    const guarded = protectedVerdict(req);
    if (guarded) return { root, flow, state: null, ask: null, verdict: guarded };
    if (!flow) {
      const agent = agentOf(id) || agentOf(root);
      const path = req && req.tool === 'write' ? String(req.path || '') : '';
      const to = (spec.tempOnly || []).includes(agent);
      const orphan = (subagentIds.has(agent) || to) && path && !isTempPath(path, temps);
      return {
        root,
        flow: null,
        state: null,
        ask: null,
        verdict: orphan ? { allow: false, hint: to ? tempOnlyHint(agent) : ORPHAN_HINT } : { allow: true, hint: '' },
      };
    }
    const state = getState(root, flow);
    const ask = engineReq(req);
    const tempAgent = (spec.tempOnly || []).includes(agentOf(id));
    if (tempAgent && ask.t === 'write' && ask.scope === 'project') return { root, flow, state, ask, verdict: { allow: false, hint: tempOnlyHint(agentOf(id)), detail: 'tempOnly' } };
    const verdict = check(state, ask);
    if (ask.detail) verdict.detail = ask.detail;
    if (!verdict.allow && DETAIL_HINT[ask.detail]) verdict.hint = DETAIL_HINT[ask.detail];
    const ph = flow ? spec.flows[flow]?.phases[state.phase] : null;
    if (!verdict.allow && ph?.gate && shells.running(id, root)) { verdict.hint = RUNNING_HINT; verdict.detail = 'running'; }
    if (!verdict.allow && ph && !verdict.detail) { const h = denyHint(flow, state.phase, ph, spec, ask); if (h) verdict.hint = h; }
    return { root, flow, state, ask, verdict };
  }

  function before(sid, req) {
    if (req && req.tool === 'shell' && /plannotator/i.test(String(req.command || ''))) gateCheck(req.id, String(req.command));
    const r = evaluate(sid, req);
    const cid = req && req.id ? 'b:' + String(req.id) : '';
    if (r.flow && r.verdict.allow && seenOnce(cid)) {
      if (r.ask.t === 'subagent') remember(req && req.id, r.ask.name);
      if (req && req.tool === 'shell' && isGateCliCommand(req.command)) rememberGate(String(req.id || ''));
      if (r.ask.t === 'subagent') {
        const next = apply(r.state, { t: 'subagent', name: r.ask.name, phase: 'start' }, clock());
        if (!same(next, r.state)) record(r.root, r.flow, r.state, next, 'task.start');
        const before = (r.state.req && r.state.req[r.ask.name]) || {};
        const after = (next.req && next.req[r.ask.name]) || {};
        if ((after.started || 0) > (before.started || 0)) gateLog({ event: 'child', kind: 'counted', phase: next.phase, agent: r.ask.name, caller: agentOf(sid) || r.flow });
      }
    }
    return r.verdict;
  }

  /** Same answer as before(), zero mutation of state/store/log. */
  function peek(sid, req) {
    return evaluate(sid, req).verdict;
  }

  function gateLog(entry) {
    if (typeof log !== 'function') return;
    try { log({ at: clock(), ...entry }); } catch { /* logging never breaks the gate */ }
  }
  function applyGate(sid, callId, leaves, via, shape, error, meta, toolMode) {
    const gid = String(callId || ''), id = String(sid || ''); const root = rootOf(id), flow = flowOf(root);
    const isTool = !!toolMode && Array.isArray(spec.gateTools) && spec.gateTools.includes(String((meta && meta.tool) || ''));
    if (!isTool && !gateHas(gid)) return null;
    const text = candidateText(leaves);
    const base = { event: 'gate-cli-after', via, callId6: gid.slice(-6), shape, tail: text.slice(-100) };
    const put = (x) => { const b = sharedBox(); const key = 'gca:' + (gid || via); if (b.gca.has(key)) return; b.gca.add(key); gateLog({ ...base, ...x }); };
    if (!flow) { put({ why: 'flow' }); return null; }
    const state = getState(root, flow), phase = spec.flows[flow].phases[state.phase];
    const head = gateToolHead(leaves);
    const decision = error ? '' : lastGateDecision(text);
    const pendingKind = error || isTool ? '' : /Timed out before completion/i.test(text) ? 'timeout' : /"status"\s*:\s*"running"/.test(text) || /status[:=]\s*running/i.test(text) ? 'running' : '';
    const outcome = isTool ? (gateToolOutcome(head, !!error) || classifyPlanResult(String((meta && meta.raw) || ''))) : error ? 'error' : decision === 'approved' ? 'approved' : decision === 'annotated' ? 'feedback' : 'pending';
    if (isTool) gateLog({ event: 'plan', tool: String((meta && meta.tool) || ''), sid6: id.slice(-6), agent: agentOf(id), head, outcome, raw: rawOf((meta && meta.raw) || head) });
    const decisive = outcome === 'approved' || outcome === 'feedback';
    const caller = agentOf(id);
    let why = decisive && gid && seenList().includes('g:' + gid) ? 'dup'
      : !phase || !phase.gate ? 'not-gate'
        : caller !== phase.expect && !(isTool && caller === flow) ? 'agent' : '';
    if (why) {
      if (why === 'dup') { const b = sharedBox(); if (b.dups.has(gid)) return state; b.dups.add(gid); }
      put({ root, flow, from: state.phase, to: state.phase, why });
      return state;
    }
    if (pendingKind) {
      const shid = shellIdFrom(meta, leaves); if (shid) shells.remember(shid, { callId: gid, sid: id, root, phase: state.phase, ts: clock() });
      put({ root, flow, from: state.phase, to: state.phase, outcome: pendingKind }); return state;
    }
    if (decisive && gid) { seenOnce('g:' + gid); gateDrop(gid); }
    const next = apply(state, { t: 'plan', outcome }, clock());
    put({ root, flow, from: state.phase, to: next.phase, outcome: pendingKind || outcome });
    if (same(next, state)) return state;
    record(root, flow, state, next, 'gate-cli', { callId6: gid.slice(-6) }, gid);
    return next;
  }

  const gateEvent = (sid, callId, leaves, meta) => applyGate(sid, callId, Array.isArray(leaves) ? leaves : [], 'event', shapeDeep(leaves || [], 3), false, meta);

  function shellEnded(data) {
    const id = String((data && data.shell && data.shell.id) || ''); const entry = id ? shells.take(id) : null;
    const leaves = shellEndLeaves(data);
    const hasDec = hasKey(data || {}, new Set(['decision']));
    const box = sharedBox();
    if (id && !box.sh.has(id) && (entry || hasDec)) { box.sh.add(id); gateLog({ event: 'shell-evt', kind: 'ended', sid6: String((entry && entry.sid) || (data && data.sessionID) || '').slice(-6), mapped: !!entry, hasDecisionKey: hasDec, shape: shapeDeep(data || {}, 4, '', true) }); }
    return entry ? applyGate(entry.sid, entry.callId, leaves, 'shell-ended', shapeDeep(leaves, 3, '', true), false, { shellID: id }) : null;
  }

  function inboxUser(evt) {
    const itemType = String((evt && evt.itemType) || '');
    if (itemType === 'synthetic') {
      const b = sharedBox(); const mid = String((evt && evt.messageId) || '');
      const dedupe = 'syn:' + mid;
      if (!b.syn) b.syn = new Set();
      if (!b.syn.has(dedupe)) {
        b.syn.add(dedupe);
        const payload = (evt && evt.payload) || {};
        const where = info(evt && evt.sid);
        gateLog({
          event: 'synthetic',
          sid6: String((evt && evt.sid) || '').slice(-6),
          root6: where.root ? String(where.root).slice(-6) : null,
          shape: shapeDeep(payload, 4, '', true),
          hasDecisionKey: hasKey(payload, new Set(['decision'])),
          hasShellId: hasKey(payload, new Set(['shellID', 'shellId', 'shell_id'])),
          ...(typeof payload.text === 'string' && payload.text.length <= 80 ? { head: payload.text } : {}),
        });
      }
      return { applied: false, why: 'item-type' };
    }
    if (itemType !== 'user') { gateLog({ event: 'user', cmd: 'ignored', why: 'item-type', itemType }); return { applied: false, why: 'item-type' }; }
    const leaves = Array.isArray(evt && evt.leaves) ? evt.leaves : [];
    const cmd = leaves.map((s) => String(s).trim().toLowerCase()).find((s) => s === '>>approve' || s === '>>skip' || s === '>>abort');
    const meta = { event: 'user', itemType, delivery: String((evt && evt.delivery) || '') };
    const sid = String((evt && evt.sid) || '');    if (!cmd) {
      const b = sharedBox(); const mid = String((evt && evt.messageId) || '');
      if (!b.plain.has(mid)) { b.plain.add(mid); gateLog({ ...meta, cmd: 'plain' }); }
      return { applied: false, why: 'plain' };
    }
    const res = userChat({ sid, agent: agentOf(sid), messageId: String((evt && evt.messageId) || ''), text: cmd });
    gateLog({ ...meta, cmd, ...(res.applied ? {} : { why: res.why }) });
    return res;
  }
  function after(sid, res) {
    const id = String(sid == null ? '' : sid);
    const root = rootOf(id);
    const flow = flowOf(root);
    if (!flow || !res || typeof res !== 'object') return null;
    const state = getState(root, flow);
    if (res.id && !seenOnce('a:' + String(res.id))) return state;
    let next = state;
    if (res.tool === 'task') {
      const remembered = calls.get(String(res.id || '')) || '';
      const name = String(res.subagent || '') || remembered;
      const tk = 'ta:' + id + ':' + String(res.id || name); const box = sharedBox();
      if (!box.ta.has(tk)) { box.ta.add(tk); gateLog(taskAfter(id, res, name, agentOf(id) || flow)); }
      if (res.error && !box.esh) { box.esh = true; gateLog({ event: 'task-err-shape', shape: shapeDeep(res, 4) }); }
      if (!name) {
        if (typeof log === 'function') {
          try { log({ at: clock(), root, flow, from: state.phase, to: state.phase, event: 'after-miss', tool: 'task', why: 'no subagent' }); } catch { /* logging never breaks the gate */ }
        }
        return state;
      }
      if (res.id) calls.delete(String(res.id));
      if (taskStatus(res) === 'running') return state; else next = apply(state, { t: 'subagent', name, phase: res.error ? 'error' : 'done' }, clock());
      if (taskStatus(res) === 'error' && requiredAgent(spec.flows[flow].phases[state.phase], name)) gateLog({ event: 'child', kind: 'failed', phase: state.phase, agent: name });
    } else if (Array.isArray(spec.gateTools) && spec.gateTools.includes(res.tool)) {
      const rawOut = typeof res.output === 'string' ? res.output : JSON.stringify(res.output || '');
      return applyGate(id, res.id, toolLeaves(res.output), 'gate-tool', shapeDeep(res, 3), !!res.error, { tool: res.tool, raw: rawOut }, true);
    } else if (res.tool === 'submit_plan') {
      next = apply(state, { t: 'plan', outcome: res.error ? 'error' : classifyPlanResult(res.output) }, clock());
    } else if (res.tool === 'shell') {
      const gid = String(res.id || '');
      if (!gid || !gateHas(gid)) return state;
      if (typeof log === 'function') { try { log({ at: clock(), event: 'after-seen', tool: res.tool, hasId: true }); } catch { /* logging never breaks the gate */ } }
      return applyGate(id, gid, stringLeaves(res.output, 5), 'hook', shapeDeep(res, 3), !!res.error, res.metadata);
    } else {
      return state;
    }
    if (next.childBlocked && !state.childBlocked) gateLog({ event: 'child', kind: 'missing', phase: state.phase });
    if (same(next, state)) {
      const mph = spec.flows[flow]?.phases[state.phase];
      if (res.tool === 'submit_plan' && typeof log === 'function') {
        const outcome = res.error ? 'error' : classifyPlanResult(res.output);
        try {
          log({ at: clock(), root, flow, from: state.phase, to: state.phase, event: 'plan', outcome, raw: rawOf(res.output) });
        } catch { /* logging never breaks the gate */ }
      }
      return state;
    }
    const extra = res.tool === 'submit_plan'
      ? { outcome: res.error ? 'error' : classifyPlanResult(res.output), raw: rawOf(res.output) }
      : undefined;
    record(root, flow, state, next, res.tool === 'task' ? 'task' : res.tool === 'shell' ? 'gate-cli' : 'plan', extra);
    return next;
  }

  const NOTICE_TEXT = {
    '>>approve': 'manual approval recorded',
    '>>skip': 'phase skipped on request',
    '>>abort': 'flow reset on request',
  };

  function userMessage(sid, msg) {
    if (!msg || msg.role !== 'user') return null;
    const root = rootOf(String(sid == null ? '' : sid));
    const flow = flowOf(root);
    if (!flow) return null;
    const state = getState(root, flow);
    const text = String(msg.text == null ? '' : msg.text);
    const next = apply(state, { t: 'user', text }, clock());
    if (same(next, state)) return null;
    record(root, flow, state, next, 'user');
    const cmd = text.trim().toLowerCase();
    if (NOTICE_TEXT[cmd]) {
      const ph = spec.flows[flow].phases[next.phase];
      store.set('notice.' + root + '.' + flow, { text: '[' + flow.toUpperCase() + ' ' + next.phase + ' ' + ph.name + '] ' + NOTICE_TEXT[cmd] });
    }
    return next;
  }

  /** Trust rule: only a root session whose message agent is a spec flow key may run a command. */
  function userChat(msg) {
    const sid = String((msg && msg.sid) || '');
    const text = String((msg && msg.text) || '');
    const messageId = String((msg && msg.messageId) || '');
    if (!sid || !text) return { applied: false, why: 'empty' };
    if (rootOf(sid) !== sid) return { applied: false, why: 'child' };
    const agent = String((msg && msg.agent) || '');
    if (!flowIds.has(agent)) return { applied: false, why: 'agent' };
    if (messageId && !seenOnce('m:' + messageId)) return { applied: false, why: 'duplicate' };
    const out = userMessage(sid, { role: 'user', text });
    return out ? { applied: true } : { applied: false, why: 'nochange' };
  }

  function remindFor(sid) {
    const id = String(sid == null ? '' : sid);
    const root = rootOf(id);
    if (root !== id) return null;
    const flow = flowOf(root);
    if (!flow) return null;
    const key = 'notice.' + root + '.' + flow;
    const notice = store.get(key);
    if (notice && typeof notice.text === 'string') {
      store.del(key);
      if (typeof log === 'function') {
        const state = getState(root, flow);
        try { log({ at: clock(), root, flow, from: state.phase, to: state.phase, event: 'notice' }); } catch { /* logging never breaks the gate */ }
      }
      return notice.text.slice(0, 160);
    }
    return remind(getState(root, flow), clock());
  }

  function badgeFor(sid) {
    const root = rootOf(String(sid == null ? '' : sid));
    const flow = flowOf(root);
    if (!flow) return '';
    return engineBadge(getState(root, flow));
  }

  function purge(sid) {
    const id = String(sid == null ? '' : sid);
    const root = rootOf(id);
    for (const f of flowIds) {
      store.del(root + '.' + f);
      store.del('notice.' + root + '.' + f);
    }
    const m = readMeta();
    delete m.agents[id];
    if (root !== id) delete m.agents[root];
    for (const [child, parent] of Object.entries(m.links)) {
      if (child === id || parent === id) delete m.links[child];
    }
    saveMeta(m);
  }

  function linkSession(childId, parentId) {
    const child = String(childId == null ? '' : childId);
    const parent = String(parentId == null ? '' : parentId);
    if (!child || !parent || child === parent) return;
    const m = readMeta();
    m.links[child] = parent;
    saveMeta(m);
  }

  function setAgent(sid, agentId) {
    const id = String(sid == null ? '' : sid);
    if (!id) return '';
    const m = readMeta();
    const from = m.agents[id] || '';
    const to = String(agentId == null ? '' : agentId);
    if (from === to) return from;
    m.agents[id] = to;
    saveMeta(m);
    return from;
  }

  return { rootOf, info, linkSession, setAgent, userMessage, userChat, before, peek, after, shellEnded, remind: remindFor, badge: badgeFor, purge, rememberGate, gateEvent, inboxUser };
}
