/* bazer-flow engine — one test per T-id. Run: node --test engine.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadSpec, init, check, apply, remind, badge, serialize, deserialize } from './engine.mjs';

const spec = loadSpec(JSON.parse(fs.readFileSync(new URL('./flow.spec.json', import.meta.url), 'utf8')));
const NOW = 1_700_000_000_000;
const clone = (o) => JSON.parse(JSON.stringify(o));
const st = (flow, phase) => {
  const s = init(flow, spec, NOW);
  s.phase = phase;
  return s;
};
const phasesOf = (flow) => Object.keys(spec.flows[flow].phases);
const BUDDHA = phasesOf('buddha');
const BAZER = phasesOf('bazer');
const ALL = [['buddha', BUDDHA], ['bazer', BAZER]];
const sub = (s, name) => check(s, { t: 'subagent', name });
const project = (s) => check(s, { t: 'write', scope: 'project' }).allow;
const plan = (s) => check(s, { t: 'submit_plan' }).allow;

test('T01 buddha happy path: project writes closed until BUILD, closed again at DONE', () => {
  for (const p of ['P0', 'P1', 'P2', 'P3', 'P4', 'P5']) assert.equal(project(st('buddha', p)), false, p);
  assert.equal(project(st('buddha', 'P6')), true);
  assert.equal(project(st('buddha', 'P7')), false);
});

test('T02 bazer happy path: write denied B12,B3; allowed B4,B5', () => {
  assert.equal(project(st('bazer', 'B12')), false);
  assert.equal(project(st('bazer', 'B3')), false);
  assert.equal(project(st('bazer', 'B4')), true);
  assert.equal(project(st('bazer', 'B5')), true);
});

test('T03 subagent denied in P0,P1,P2 with hint naming phase and next step', () => {
  for (const p of ['P0', 'P1', 'P2']) {
    const r = sub(st('buddha', p), 'builder');
    assert.equal(r.allow, false, p);
    assert.match(r.hint, new RegExp('\\b' + p + '\\b'));
    assert.match(r.hint, /next step/);
  }
});

test('T04 builder start denied before P6 / B4', () => {
  for (const p of ['P0', 'P1', 'P2', 'P3', 'P4', 'P5']) assert.equal(sub(st('buddha', p), 'builder').allow, false, p);
  for (const p of ['B12', 'B3']) assert.equal(sub(st('bazer', p), 'builder').allow, false, p);
  assert.equal(sub(st('buddha', 'P6'), 'builder').allow, true);
  assert.equal(sub(st('bazer', 'B4'), 'builder').allow, true);
});

test('T05 submit_plan denied in every non-gate phase', () => {
  for (const [flow, list] of ALL) {
    for (const p of list) {
      const gate = spec.flows[flow].phases[p].gate;
      assert.equal(plan(st(flow, p)), gate, flow + ' ' + p);
    }
  }
});

test('T06 approved moves only from gate phases, ignored elsewhere', () => {
  assert.equal(apply(st('buddha', 'P2'), { t: 'plan', outcome: 'approved' }, NOW + 1).phase, 'P3');
  assert.equal(apply(st('buddha', 'P5'), { t: 'plan', outcome: 'approved' }, NOW + 1).phase, 'P6');
  assert.equal(apply(st('bazer', 'B3'), { t: 'plan', outcome: 'approved' }, NOW + 1).phase, 'B4');
  for (const p of ['P0', 'P1', 'P3', 'P4', 'P6', 'P7']) {
    assert.deepEqual(apply(st('buddha', p), { t: 'plan', outcome: 'approved' }, NOW + 1), st('buddha', p), p);
  }
  assert.deepEqual(apply(st('bazer', 'B12'), { t: 'plan', outcome: 'approved' }, NOW + 1), st('bazer', 'B12'));
});

test('T07 feedback stays at the gate, counter++, hint at 3, never blocks', () => {
  for (const [flow, phase] of [['buddha', 'P2'], ['buddha', 'P5'], ['bazer', 'B3']]) {
    const one = apply(st(flow, phase), { t: 'plan', outcome: 'feedback' }, NOW + 1);
    assert.equal(one.phase, phase, flow + ' ' + phase);
    assert.equal(one.feedback[phase], 1, flow + ' ' + phase);
  }
  let s = st('buddha', 'P2');
  for (let i = 1; i <= 3; i++) s = apply(s, { t: 'plan', outcome: 'feedback' }, NOW + i);
  assert.equal(Object.values(s.feedback).reduce((x, y) => x + y, 0), 3);
  assert.match(remind(s, NOW + 4), /ask the human/);
  assert.equal(sub(s, 'poteto').allow, true);
});

test('T08 pending and error never approve; each has its own counter and hint', () => {
  const pend = apply(st('buddha', 'P2'), { t: 'plan', outcome: 'pending' }, NOW + 1);
  assert.deepEqual(pend.approvals, {});
  assert.equal(pend.phase, 'P2');
  assert.equal(pend.pending, 1);
  assert.equal(pend.planErrors, 0);
  assert.match(remind(pend, NOW + 2), />>approve/);

  const err = apply(st('buddha', 'P2'), { t: 'plan', outcome: 'error' }, NOW + 1);
  assert.deepEqual(err.approvals, {});
  assert.equal(err.phase, 'P2');
  assert.equal(err.pending, 0);
  assert.equal(err.planErrors, 1);
  assert.match(remind(err, NOW + 2), /plan review tool failed/);
});

test('T09 >>approve works at P2,P5,B3 (manual) and is ignored elsewhere', () => {
  for (const [flow, phase, next] of [['buddha', 'P2', 'P3'], ['buddha', 'P5', 'P6'], ['bazer', 'B3', 'B4']]) {
    const s = apply(st(flow, phase), { t: 'user', text: '  >>APPROVE ' }, NOW + 1);
    assert.equal(s.phase, next);
    assert.equal(s.approvals[phase].manual, true);
  }
  for (const [flow, phase] of [['buddha', 'P1'], ['buddha', 'P4'], ['bazer', 'B12'], ['buddha', 'P6']]) {
    assert.deepEqual(apply(st(flow, phase), { t: 'user', text: '>>approve' }, NOW + 1), st(flow, phase));
  }
});

test('T10 >>skip works only at a skippable phase and records it', () => {
  const s = apply(st('buddha', 'P3'), { t: 'user', text: '>>skip' }, NOW + 1);
  assert.equal(s.phase, 'P4');
  assert.deepEqual(s.skipped, ['P3']);
  for (const [flow, phase] of [['buddha', 'P1'], ['buddha', 'P5'], ['bazer', 'B3']]) {
    assert.deepEqual(apply(st(flow, phase), { t: 'user', text: '>>skip' }, NOW + 1), st(flow, phase));
  }
});

test('T11 >>abort from every phase returns to start with writes closed', () => {
  for (const [flow, list] of ALL) {
    for (const p of list) {
      const s = apply(st(flow, p), { t: 'user', text: '>>abort' }, NOW + 5);
      assert.equal(s.phase, spec.flows[flow].start, flow + ' ' + p);
      assert.deepEqual(s.approvals, {});
      assert.deepEqual(s.feedback, {});
      assert.equal(s.pending, 0);
      assert.equal(s.errors, 0);
      assert.deepEqual(s.skipped, []);
      assert.equal(project(s), false, flow + ' ' + p);
    }
  }
});

test('T12 command text inside non-user events changes nothing', () => {
  const base = st('buddha', 'P2');
  assert.deepEqual(apply(base, { t: 'subagent', name: '>>approve', phase: 'start' }, NOW + 1), base);
  assert.deepEqual(apply(base, { t: 'plan', outcome: '>>approve' }, NOW + 1), base);
  assert.deepEqual(apply(base, { t: 'user', text: 'please >>approve the plan' }, NOW + 1), base);
  assert.deepEqual(apply(base, { t: 'user', text: '>>approve now' }, NOW + 1), base);
});

test('T13 plain user message: no change mid-flow, restart cleared at terminal', () => {
  assert.deepEqual(apply(st('buddha', 'P3'), { t: 'user', text: 'hello' }, NOW + 1), st('buddha', 'P3'));
  const t = apply(apply(st('buddha', 'P2'), { t: 'plan', outcome: 'approved' }, NOW + 1), { t: 'user', text: 'ok' }, NOW + 2);
  assert.equal(t.phase, 'P3');
  const done = apply(apply(st('buddha', 'P6'), { t: 'subagent', name: 'builder', phase: 'done' }, NOW + 1), { t: 'user', text: 'new task' }, NOW + 2);
  assert.equal(done.phase, 'P0');
  assert.deepEqual(done.approvals, {});
  const fix = apply(apply(st('bazer', 'B4'), { t: 'subagent', name: 'builder', phase: 'done' }, NOW + 1), { t: 'user', text: 'new task' }, NOW + 2);
  assert.equal(fix.phase, 'B12');
});

test('T14 builder error stays, errors++, hint at 2, builder still allowed', () => {
  let s = apply(st('buddha', 'P6'), { t: 'subagent', name: 'builder', phase: 'error' }, NOW + 1);
  assert.equal(s.phase, 'P6');
  assert.equal(s.errors, 1);
  assert.equal(sub(s, 'builder').allow, true);
  s = apply(s, { t: 'subagent', name: 'builder', phase: 'error' }, NOW + 2);
  assert.equal(s.errors, 2);
  assert.match(remind(s, NOW + 3), /ask the human/);
  let b = apply(st('bazer', 'B4'), { t: 'subagent', name: 'builder', phase: 'error' }, NOW + 1);
  assert.equal(b.phase, 'B4');
  assert.equal(b.errors, 1);
});

test('T15 stall is flagged from injected now and never transitions', () => {
  const s = st('buddha', 'P3');
  const quiet = remind(s, NOW + 10);
  assert.doesNotMatch(quiet, /stalled/);
  const late = remind(s, NOW + spec.defaults.stallMs + 1);
  assert.match(late, />>skip/);
  assert.equal(s.phase, 'P3');
  assert.ok(late.length <= 160);
});

test('T16 serialize/deserialize round-trip is equal for every phase', () => {
  for (const [flow, list] of ALL) {
    for (const p of list) {
      const s = st(flow, p);
      assert.deepEqual(deserialize(serialize(s), NOW + 10), s, flow + ' ' + p);
    }
  }
});

test('T17 deserialize fails closed on garbage, unknown phase/flow, expired', () => {
  const hashes = [
    null,
    'garbage',
    42,
    { v: 1, flow: 'nope', phase: 'P0', at: NOW },
    { ...serialize(st('buddha', 'P0')), phase: 'ZZ' },
    { ...serialize(st('buddha', 'P6')), at: NOW - spec.defaults.ttlMs - 1 },
  ];
  for (const [i, bad] of hashes.entries()) {
    const s = deserialize(bad, NOW);
    assert.equal(s.phase, spec.flows[Object.keys(spec.flows)[0]].start, 'case ' + i);
    assert.equal(project(s), false, 'case ' + i);
  }
});

test('T21 requires gate exits; counters reset on move', () => {
  const s = st('buddha', 'P3');
  assert.equal(sub(s, 'poteto').allow, false);
  const started = apply(s, { t: 'subagent', name: 'arena-runner', phase: 'start' }, NOW + 1);
  assert.equal(started.req['arena-runner'].started, 1);
  const done = apply(started, { t: 'subagent', name: 'arena-judge', phase: 'done' }, NOW + 2);
  assert.equal(done.phase, 'P3');
  assert.equal(sub(done, 'poteto').allow, true);
  const moved = apply(done, { t: 'subagent', name: 'poteto', phase: 'start' }, NOW + 3);
  assert.equal(moved.phase, 'P4');
  assert.deepEqual(moved.req, {});
});

test('T18 out-of-order notifications leave state identical', () => {
  const cases = [
    ['buddha', 'P5', { t: 'subagent', name: 'poteto', phase: 'done' }],
    ['buddha', 'P3', { t: 'subagent', name: 'builder', phase: 'done' }],
    ['buddha', 'P4', { t: 'subagent', name: 'poteto', phase: 'start' }],
    ['bazer', 'B4', { t: 'subagent', name: 'poteto', phase: 'done' }],
  ];
  for (const [flow, phase, ev] of cases) {
    assert.deepEqual(apply(st(flow, phase), ev, NOW + 1), st(flow, phase), flow + ' ' + phase);
  }
});

test('T19 helpers are allowed in every phase of both flows', () => {
  for (const [flow, list] of ALL) {
    for (const p of list) {
      for (const h of spec.defaults.helpers) assert.equal(sub(st(flow, p), h).allow, true, flow + ' ' + p + ' ' + h);
    }
  }
});

test('T20 remind() is <=160 chars and carries phase id + next step everywhere', () => {
  for (const [flow, list] of ALL) {
    for (const p of list) {
      const text = remind(st(flow, p), NOW + 1);
      assert.ok(text.length <= 160, flow + ' ' + p + ' ' + text.length);
      assert.match(text, new RegExp('\\b' + p + '\\b'));
      assert.match(text, /next:/);
      assert.ok(badge(st(flow, p)).length <= 12);
    }
  }
});

test('T21 spec sanity + engine hardcodes no phase ids or agent names', () => {
  for (const [flow, list] of ALL) {
    const phases = spec.flows[flow].phases;
    for (const p of list) {
      for (const [ev, target] of Object.entries(phases[p].transitions)) {
        assert.ok(target === 'stay' || phases[target], flow + ' ' + p + ' ' + ev + ' -> ' + target);
      }
    }
    const seen = new Set([spec.flows[flow].start]);
    const queue = [spec.flows[flow].start];
    let terminal = false;
    while (queue.length) {
      const cur = phases[queue.shift()];
      if (cur.terminal) terminal = true;
      for (const target of Object.values(cur.transitions)) {
        if (target !== 'stay' && !seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      }
    }
    assert.ok(terminal, flow + ' terminal reachable');
  }

  const src = fs.readFileSync(new URL('./engine.mjs', import.meta.url), 'utf8');
  const words = new Set([...BUDDHA, ...BAZER, ...spec.defaults.helpers]);
  for (const [, list] of ALL) {
    for (const p of list) {
      const ph = spec.flows[flowOfSpec(p)].phases[p];
      if (ph.expect) words.add(ph.expect);
      for (const a of ph.also || []) words.add(a);
    }
  }
  for (const w of words) assert.equal(new RegExp('\\b' + w + '\\b').test(src), false, 'engine hardcodes ' + w);
});

test('T23 feedback x4 never leaves a gate; submit_plan stays allowed; approved advances', () => {
  for (const [flow, phase, next] of [['buddha', 'P2', 'P3'], ['buddha', 'P5', 'P6'], ['bazer', 'B3', 'B4']]) {
    let s = st(flow, phase);
    for (let i = 0; i < 4; i++) {
      s = apply(s, { t: 'plan', outcome: 'feedback' }, NOW + i);
      assert.equal(s.phase, phase, flow + ' ' + phase + ' round ' + i);
      assert.equal(plan(s), true, flow + ' ' + phase + ' round ' + i);
    }
    assert.equal(s.feedback[phase], 4);
    assert.match(badge(s), / r5$/);
    assert.equal(apply(s, { t: 'plan', outcome: 'approved' }, NOW + 9).phase, next);
  }
});

test('T22 P3 admits its extra subagents; poteto needs the requires met', () => {
  const extra = spec.flows.buddha.phases.P3.also.filter((n) => n !== 'poteto');
  assert.ok(Array.isArray(extra) && extra.length > 0, 'P3.also present');
  for (const name of extra) {
    assert.equal(sub(st('buddha', 'P3'), name).allow, true, name + ' @P3');
    assert.equal(sub(st('buddha', 'P2'), name).allow, false, name + ' @P2');
    assert.equal(sub(st('buddha', 'P4'), name).allow, false, name + ' @P4');
  }
  assert.equal(sub(st('buddha', 'P3'), 'poteto').allow, false);
});

function flowOfSpec(phase) {
  return BUDDHA.includes(phase) ? 'buddha' : 'bazer';
}
