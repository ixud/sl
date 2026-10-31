/* permission.evaluate body: full host object -> ladder/deny/leave. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRuntime } from './runtime.mjs';
import { toPermissionReq } from './adapter.mjs';
import { runPerm } from './permhook.mjs';

const spec = JSON.parse(fs.readFileSync(new URL('./flow.spec.json', import.meta.url), 'utf8'));
const NOW = 1_700_000_000_000;
const HOME = path.join('C:', 'Users', 'u');
const LFILE = path.join(os.tmpdir(), 'bazer', 'k5-permhook-ladder.json');
const TMP = path.join(os.tmpdir(), 'bazer', 'x.txt');
const PROJ = path.join('C:', 'proj', 'x.txt');
const writeLadder = (level) => { fs.mkdirSync(path.dirname(LFILE), { recursive: true }); fs.writeFileSync(LFILE, JSON.stringify({ v: 1, level, expires: null, setBy: 'test' }), 'utf8'); };
const memStore = () => { const m = new Map(); return { get: (k) => (m.has(k) ? JSON.parse(JSON.stringify(m.get(k))) : undefined), set: (k, v) => m.set(k, v), del: (k) => m.delete(k), has: (k) => m.has(k) }; };
const ev = (o = {}) => ({ sessionID: 's', agent: 'snack', action: 'shell', resources: ['git status --short'], metadata: undefined, source: { type: 'tool' }, effect: 'ask', ...o });
const deps = (o = {}) => ({ sid: 's', toReq: toPermissionReq, peek: () => ({ allow: true }), emit: () => {}, deny: () => {}, miss: () => {}, closedHint: 'closed', permSeen: new Map(), skipSeen: new Map(), ...o });

test('H1 full object reaches peek; dropping to (sid,req) loses the grant', () => {
  const seen = [];
  const spy = (sid, req, effect, action, resources, agent) => { seen.push([effect, action, resources, agent]); return { allow: true, ladder: 'allow' }; };
  const e = ev();
  runPerm(e, deps({ peek: spy }));
  assert.deepEqual(seen[0], ['ask', 'shell', ['git status --short'], 'snack']);
  assert.equal(e.effect, 'allow');

  const e2 = ev();
  const strict = (sid, req, effect) => ({ allow: true, ladder: effect === 'ask' ? 'allow' : undefined });
  const dropping = (sid, req) => strict(sid, req);
  runPerm(e2, deps({ peek: dropping }));
  assert.equal(e2.effect, 'ask', 'old wrapper cannot grant');
});

test('H2 real ladder: read-only shell allows at L1; allow/deny untouched', () => {
  writeLadder(1);
  const rows = [];
  const rt = createRuntime({ spec, store: memStore(), now: () => NOW, home: HOME, ladderPath: LFILE, log: (x) => rows.push(x) });
  rt.setAgent('s', 'snack');
  const base = { peek: (...a) => rt.peek(...a), emit: (x) => rows.push(x) };
  const e = ev({ resources: ['git status --short', 'Write-Output "---"', 'Get-Content C:\\KOLE\\a.md'] });
  runPerm(e, deps(base));
  assert.equal(e.effect, 'allow');
  assert.ok(rows.some((x) => x.event === 'ladder' && x.after === 'allow'));

  const ea = ev({ effect: 'allow' });
  runPerm(ea, deps(base));
  assert.equal(ea.effect, 'allow');
  assert.ok(rows.some((x) => x.event === 'ladder-skip' && x.reason === 'not-ask'));
  const ed = ev({ effect: 'deny' });
  runPerm(ed, deps(base));
  assert.equal(ed.effect, 'deny');
});

test('H3 edit temp allows, project stays ask, unknown stays ask', () => {
  writeLadder(1);
  const rows = [];
  const rt = createRuntime({ spec, store: memStore(), now: () => NOW, home: HOME, ladderPath: LFILE, log: (x) => rows.push(x) });
  rt.setAgent('s', 'snack');
  const base = { peek: (...a) => rt.peek(...a), emit: (x) => rows.push(x) };
  const temp = ev({ action: 'edit', resources: [TMP] });
  runPerm(temp, deps(base));
  assert.equal(temp.effect, 'allow');
  const proj = ev({ action: 'edit', resources: [PROJ] });
  runPerm(proj, deps(base));
  assert.equal(proj.effect, 'ask');
  const unk = ev({ resources: ['custom-tool --x'] });
  runPerm(unk, deps(base));
  assert.equal(unk.effect, 'ask');
});

test('H4 missing effect and exceptions leave effect unchanged and log a skip', () => {
  const rows = [];
  const e = ev({ effect: undefined });
  runPerm(e, deps({ emit: (x) => rows.push(x) }));
  assert.equal(e.effect, undefined);
  assert.ok(rows.some((x) => x.event === 'ladder-skip' && x.reason === 'no-effect'));

  const e2 = ev({ effect: 'ask' });
  runPerm(e2, deps({ peek: () => { throw new Error('boom'); }, emit: (x) => rows.push(x), fail: (x) => rows.push({ event: 'perm-err', msg: String(x) }) }));
  assert.equal(e2.effect, 'ask');
  assert.ok(rows.some((x) => x.event === 'perm-err'));
});
