/* bazer-flow engine — explicit phase state, spec-driven.
   Pure: no IO, no OpenCode imports, time is injected. No ids or agent names live here. */
const VERSION = 2;
let active = null;

const clone = (o) => JSON.parse(JSON.stringify(o));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const ok = () => ({ allow: true, hint: '' });

export function loadSpec(obj) {
  const bad = (m) => { throw new Error('spec: ' + m); };
  if (!obj || typeof obj !== 'object') bad('not an object');
  if (obj.version !== VERSION) bad('unsupported version');
  const d = obj.defaults;
  if (!d || typeof d !== 'object') bad('defaults missing');
  for (const k of ['stallMs', 'ttlMs', 'feedbackHintAt', 'errHintAt']) {
    if (!isNum(d[k]) || d[k] < 0) bad(k + ' must be a non-negative number');
  }
  if (!Array.isArray(d.helpers) || d.helpers.some((h) => typeof h !== 'string')) bad('helpers must be strings');
  if (!obj.flows || typeof obj.flows !== 'object') bad('flows missing');

  const flows = {};
  for (const [fid, f] of Object.entries(obj.flows)) {
    if (!f || typeof f !== 'object' || !f.phases || typeof f.phases !== 'object') bad('flow ' + fid);
    const phases = {};
    for (const [pid, p] of Object.entries(f.phases)) {
      if (!p || typeof p !== 'object') bad('phase ' + pid);
      if (typeof p.name !== 'string' || !p.name) bad('phase ' + pid + ' name');
      if (typeof p.gate !== 'boolean' || typeof p.writeProject !== 'boolean') bad('phase ' + pid + ' flags');
      if (p.expect != null && typeof p.expect !== 'string') bad('phase ' + pid + ' expect');
      if (p.also != null && (!Array.isArray(p.also) || p.also.some((a) => typeof a !== 'string'))) bad('phase ' + pid + ' also');
      const rq = Array.isArray(p.requires) ? p.requires : [];
      for (const r of rq) if (!r || typeof r.agent !== 'string' || !r.agent || (r.state !== 'started' && r.state !== 'done') || !isNum(r.min) || r.min < 1) bad('phase ' + pid + ' requires');
      const tr = {};
      for (const [k, v] of Object.entries(p.transitions || {})) {
        if (v !== 'stay' && !f.phases[v]) bad('phase ' + pid + ' transition ' + k + ' -> ' + v);
        tr[k] = v;
      }
      phases[pid] = {
        name: p.name,
        expect: p.expect == null ? null : p.expect,
        also: Array.isArray(p.also) ? [...p.also] : [],
        requires: rq.map((r) => ({ agent: r.agent, state: r.state, min: Math.floor(r.min) })),
        gate: p.gate,
        writeProject: p.writeProject,
        terminal: p.terminal === true,
        skippable: p.skippable === true,
        transitions: tr,
      };
    }
    if (!phases[f.start]) bad('flow ' + fid + ' start');
    flows[fid] = { start: f.start, phases };
  }
  if (!Object.keys(flows).length) bad('no flows');

  active = {
    version: VERSION,
    defaults: {
      stallMs: d.stallMs,
      ttlMs: d.ttlMs,
      feedbackHintAt: d.feedbackHintAt,
      errHintAt: d.errHintAt,
      helpers: [...d.helpers],
    },
    flows,
  };
  return active;
}

const flowOf = (s) => (active && s && active.flows[s.flow]) || null;
const phaseOf = (s) => { const f = flowOf(s); return (f && f.phases[s.phase]) || null; };
const firstFlow = () => Object.keys(active.flows)[0];

function nextStep(p) {
  for (const v of Object.values(p.transitions)) if (v !== 'stay') return v;
  return 'end';
}

function fresh(flowId, now) {
  const f = active.flows[flowId];
  return {
    v: VERSION,
    flow: flowId,
    phase: f.start,
    at: now,
    lastEventAt: now,
    feedback: {},
    pending: 0,
    planErrors: 0,
    req: {},
    errors: 0,
    approvals: {},
    skipped: [],
  };
}

export function init(flowId, spec, now) {
  if (spec) loadSpec(spec);
  if (!active || !active.flows[flowId]) throw new Error('unknown flow: ' + flowId);
  return fresh(flowId, now);
}

function deny(s, p, why) {
  const who = String(s.flow).toUpperCase() + ' ' + s.phase + ' ' + p.name;
  const hint = 'STOP. Do not work around. ' + why + '. Tell the user: ' + who + ', next step ' + nextStep(p) + '; user can type >>approve / >>skip / >>abort.';
  return { allow: false, hint: hint.slice(0, 200) };
}

function missing(s, p) {
  return (p.requires || []).filter((r) => ((((s.req || {})[r.agent] || {})[r.state]) || 0) < r.min);
}

export function reqHint(s, p) {
  const items = missing(s, p).map((r) => r.agent + ' ' + r.state + ' (min ' + r.min + ')').join(', ');
  return ('STOP. ' + s.phase + ' ' + p.name + ' requires ' + items + '; next: ' + nextStep(p) + ', or user types >>skip.').slice(0, 160);
}

export function check(state, req) {
  const p = phaseOf(state);
  if (!p) return { allow: false, hint: 'unknown phase — restart the flow' };
  const t = req && req.t;
  if (t === 'read') return ok();
  if (t === 'subagent') {
    const name = String((req && req.name) || '');
    const allowed = name === p.expect || active.defaults.helpers.includes(name) || p.also.includes(name);
    const leaving = (name + '.start') in p.transitions && missing(state, p).length > 0;
    if (allowed && !leaving) return ok();
    if (!allowed) return deny(state, p, 'subagent ' + (name || '(none)') + ' not allowed');
    return { allow: false, hint: reqHint(state, p), detail: 'requires' };
  }
  if (t === 'submit_plan') return p.gate ? ok() : deny(state, p, 'plan review is closed');
  if (t === 'write') {
    if (req.scope !== 'project') return ok();
    return p.writeProject ? ok() : deny(state, p, 'project writes are closed');
  }
  return deny(state, p, 'unknown request');
}

function move(s, target, now) {
  if (target && target !== 'stay') { s.phase = target; s.req = {}; }
  s.lastEventAt = now;
  return s;
}

function reset(s, f, now) {
  s.phase = f.start;
  s.at = now;
  s.lastEventAt = now;
  s.feedback = {};
  s.pending = 0;
  s.planErrors = 0;
  s.req = {};
  s.errors = 0;
  s.approvals = {};
  s.skipped = [];
  return s;
}

export function apply(state, ev, now) {
  const s = clone(state);
  const f = flowOf(s);
  const p = f && f.phases[s.phase];
  if (!p || !ev || typeof ev !== 'object') return s;

  if (ev.t === 'user') {
    const text = String(ev.text == null ? '' : ev.text).trim().toLowerCase();
    if (text === '>>abort') return reset(s, f, now);
    if (text === '>>approve') {
      if (!p.gate) return s;
      s.approvals[s.phase] = { at: now, manual: true };
      return move(s, p.transitions.approved, now);
    }
    if (text === '>>skip') {
      if (!p.skippable || !p.transitions.skip) return s;
      s.skipped = [...s.skipped, s.phase];
      return move(s, p.transitions.skip, now);
    }
    return p.terminal ? reset(s, f, now) : s;
  }

  if (ev.t === 'plan') {
    const out = String(ev.outcome == null ? '' : ev.outcome);
    if (out !== 'approved' && out !== 'feedback' && out !== 'pending' && out !== 'error') return s;
    if (out === 'approved') {
      if (!p.gate) return s;
      s.approvals[s.phase] = { at: now, manual: false };
      return move(s, p.transitions.approved, now);
    }
    if (out === 'feedback') {
      s.feedback[s.phase] = (s.feedback[s.phase] || 0) + 1;
      return move(s, p.transitions.feedback, now);
    }
    s.lastEventAt = now;
    if (out === 'pending') s.pending += 1;
    else s.planErrors += 1;
    return s;
  }

  if (ev.t === 'subagent') {
    const name = String(ev.name == null ? '' : ev.name);
    const kind = String(ev.phase == null ? '' : ev.phase);
    const key = name + '.' + kind;
    if ((p.requires || []).some((r) => r.agent === name)) {
      const c = s.req[name] || (s.req[name] = { started: 0, done: 0 });
      if (kind === 'start') c.started = (c.started || 0) + 1;
      else if (kind === 'done') c.done = (c.done || 0) + 1;
      else if (kind === 'error') c.started = Math.max(0, (c.started || 0) - 1);
      s.lastEventAt = now;
    }
    if (!(key in p.transitions)) return s;
    if (kind !== 'error' && missing(s, p).length) return s;
    if (key.endsWith('.error')) s.errors += 1;
    return move(s, p.transitions[key], now);
  }

  return s;
}

export function remind(state, now) {
  const p = phaseOf(state);
  if (!p) return '[unknown phase] restart the flow'.slice(0, 160);
  if ((p.requires || []).length && missing(state, p).length) return reqHint(state, p);  const d = active.defaults;
  const total = Object.values(state.feedback || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  let out = '[' + String(state.flow).toUpperCase() + ' ' + state.phase + ' ' + p.name + '] next: ' + nextStep(p) + ' · project writes: ' + (p.writeProject ? 'open' : 'closed');
  let hint = '';
  if (total >= d.feedbackHintAt) hint = 'ask the human: feedback keeps coming back';
  else if (state.planErrors >= 1) hint = 'plan review tool failed; check the gate tool, or >>approve';
  else if (p.gate && state.pending >= 1) hint = '>>approve if you reviewed the plan yourself';
  else if (state.errors >= d.errHintAt) hint = 'ask the human: subagent keeps failing';
  else if (isNum(now) && isNum(state.lastEventAt) && now - state.lastEventAt > d.stallMs) hint = 'stalled: use >>skip or >>abort';
  return (hint ? out + ' · ' + hint : out).slice(0, 160);
}

export function badge(state) {
  const p = phaseOf(state);
  if (!p) return '?';
  if (p.gate) {
    const total = Object.values(state.feedback || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    return (state.phase + ' ' + p.name + ' r' + (total + 1)).slice(0, 12);
  }
  return (state.phase + ' ' + p.name).slice(0, 12);
}

export function serialize(state) {
  const s = clone(state);
  s.v = VERSION;
  const p = phaseOf(s);
  s.expect = p ? p.expect : null;
  return s;
}

export function deserialize(obj, now) {
  if (!active) throw new Error('no spec loaded');
  const known = obj && typeof obj === 'object' && active.flows[obj.flow];
  const phaseOk = known && active.flows[obj.flow].phases[obj.phase];
  const freshOk = phaseOk && isNum(obj.at) && isNum(now) && now - obj.at <= active.defaults.ttlMs;
  if (!freshOk) return fresh(firstFlow(), now);

  const s = fresh(obj.flow, now);
  s.phase = obj.phase;
  s.at = obj.at;
  s.lastEventAt = isNum(obj.lastEventAt) ? obj.lastEventAt : obj.at;
  if (obj.feedback && typeof obj.feedback === 'object') {
    for (const [k, v] of Object.entries(obj.feedback)) if (active.flows[obj.flow].phases[k] && isNum(v)) s.feedback[k] = v;
  }
  if (isNum(obj.pending) && obj.pending > 0) s.pending = obj.pending;
  if (isNum(obj.planErrors) && obj.planErrors > 0) s.planErrors = obj.planErrors;
  if (obj.req && typeof obj.req === 'object') {
    for (const [name, v] of Object.entries(obj.req)) {
      if (!v || typeof v !== 'object') continue;
      const kept = {};
      for (const k of ['started', 'done']) if (isNum(v[k]) && v[k] > 0) kept[k] = Math.floor(v[k]);
      if (Object.keys(kept).length) s.req[name] = kept;
    }
  }
  if (isNum(obj.errors) && obj.errors > 0) s.errors = obj.errors;
  if (obj.approvals && typeof obj.approvals === 'object') {
    for (const [k, v] of Object.entries(obj.approvals)) {
      if (active.flows[obj.flow].phases[k] && v) s.approvals[k] = { at: isNum(v.at) ? v.at : obj.at, manual: v.manual === true };
    }
  }
  if (Array.isArray(obj.skipped)) s.skipped = obj.skipped.filter((x) => typeof x === 'string' && active.flows[obj.flow].phases[x]);
  return s;
}
