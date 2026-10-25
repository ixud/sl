/**
 * hygiene.test.mjs — K2: message names, patch blocker, token naming, backup retention.
 * Sandbox stores only; never touches the real var/.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as apply from '../apply.mjs';
import * as actions from '../actions.mjs';
import * as plan from '../plan.mjs';
import { ROOT } from '../env.mjs';

const tmp = (name) => path.join(os.tmpdir(), 'bazer', name);
const ROUND = /^\d{8}-\d{6}-\d{3}$/;
const stampOf = (i) => `20200101-${String(i).padStart(6, '0')}-000`;

test('B1 blocker summary: 0/1/3/7 items, reason clipped to 30, <=160 chars', () => {
  assert.equal(typeof actions.blockerSummary, 'function');
  assert.equal(actions.blockerSummary([]), 'มี blocker 0 รายการ');
  assert.equal(actions.blockerSummary(['a: x']), 'มี blocker 1 รายการ: a (x)');
  assert.equal(
    actions.blockerSummary(['a: x', 'b: y', 'c: z']),
    'มี blocker 3 รายการ: a (x), b (y), c (z)',
  );
  assert.equal(
    actions.blockerSummary(['a: r1', 'b: r2', 'c: r3', 'd: r4', 'e: r5', 'f: r6', 'g: r7']),
    'มี blocker 7 รายการ: a (r1), b (r2), c (r3) +4',
  );
  const long = actions.blockerSummary([`a: ${'r'.repeat(50)}`]);
  assert.match(long, /\(r{30}\)/);
  assert.ok(actions.blockerSummary(Array.from({ length: 7 }, (_, i) => `id-${i}: ${'z'.repeat(50)}`)).length <= 160);
});

test('B1 pending summary: 0/1/3/7 items, only missing/stale, <=160 chars', () => {
  assert.equal(typeof actions.pendingSummary, 'function');
  const e = (id, title, state) => ({ id, title, state });
  assert.equal(actions.pendingSummary([]), 'ต้องทำ 0 รายการ');
  assert.equal(actions.pendingSummary([e('a', 'Alpha', 'missing')]), 'ต้องทำ 1 รายการ: Alpha');
  assert.equal(
    actions.pendingSummary([e('a', 'Alpha', 'missing'), e('b', 'Beta', 'stale'), e('c', 'Gamma', 'missing')]),
    'ต้องทำ 3 รายการ: Alpha, Beta, Gamma',
  );
  assert.equal(
    actions.pendingSummary([
      e('a', 'T1', 'missing'), e('b', 'T2', 'stale'), e('c', 'T3', 'missing'),
      e('d', 'T4', 'missing'), e('e', 'T5', 'stale'), e('f', 'T6', 'missing'), e('g', 'T7', 'stale'),
      e('x', 'Skip', 'ok'),
    ]),
    'ต้องทำ 7 รายการ: T1, T2, T3 +4',
  );
  assert.ok(actions.pendingSummary(Array.from({ length: 7 }, (_, i) => e(String(i), 'T'.repeat(80), 'missing'))).length <= 160);
});

test('B2 strategy patch is a blocker, never a silent design', () => {
  assert.equal(typeof plan.blockerText, 'function');
  const entry = { id: 'x.patch', kind: 'config', title: 'Patch', strategy: 'patch', status: 'ready' };
  const st = plan.stateOf(entry, tmp('k2-patch-home'));
  assert.equal(st.state, 'broken');
  assert.equal(st.blocker, true);
  assert.equal(plan.blockerText(entry), 'strategy patch ยังไม่รองรับ: x.patch');
});

test('B3 token naming/cleanup picks only stale token-<port> files', async () => {
  const idx = await import('../index.mjs');
  assert.equal(typeof idx.tokenName, 'function');
  assert.equal(typeof idx.staleTokenNames, 'function');
  assert.equal(idx.tokenName(4311), 'token-4311');
  const files = ['token-4310', 'token-4311', 'token-4500', 'token', 'notes.txt'];
  assert.deepEqual(idx.staleTokenNames(files, 4311, (p) => p === 4310), ['token-4500']);
  assert.deepEqual(idx.staleTokenNames(['token-4311'], 4311, () => false), []);
});

test('B6 retention: newest 100 + lastApply stay, oldest 30 pruned, pruned restore is a summary', () => {  assert.equal(typeof apply.pruneBackups, 'function');
  const home = tmp('k2-prune-home');
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  const store = apply.makeStore(path.join(home, '.bazerconsole', 'var'));
  fs.mkdirSync(store.backupDir, { recursive: true });
  for (let i = 0; i < 130; i++) fs.mkdirSync(path.join(store.backupDir, stampOf(i)), { recursive: true });
  fs.mkdirSync(path.join(store.backupDir, 'keep-me'), { recursive: true });
  apply.writeState({ entries: {}, policy: null, locks: {}, lastApply: { stamp: stampOf(0) } }, store);

  apply.record('20990101-000000-000', [], store);
  assert.equal(apply.pruneBackups(store).length, 0);

  const rounds = fs.readdirSync(store.backupDir).filter((n) => ROUND.test(n));
  assert.equal(rounds.length, 101);
  assert.ok(fs.existsSync(path.join(store.backupDir, stampOf(0))), 'protected lastApply round was pruned');
  assert.ok(fs.existsSync(path.join(store.backupDir, '20990101-000000-000')));
  for (let i = 1; i <= 30; i++) assert.ok(!fs.existsSync(path.join(store.backupDir, stampOf(i))), `not pruned: ${i}`);
  for (let i = 31; i <= 129; i++) assert.ok(fs.existsSync(path.join(store.backupDir, stampOf(i))), `missing: ${i}`);
  assert.ok(fs.existsSync(path.join(store.backupDir, 'keep-me')), 'non-round dir was touched');

  const msg = 'รอบสำรองนี้ถูกลบตามนโยบายเก็บ 100 รอบ';
  const ctx = { home, store };
  const br = actions.runAction('backup-restore', ctx, { confirmed: true, stamp: stampOf(1), target: 'C:/nope/x' });
  assert.equal(br.ok, false);
  assert.equal(br.summary, msg);
  const rb = actions.runAction('rollback', ctx, { confirmed: true, stamp: stampOf(1) });
  assert.equal(rb.ok, false);
  assert.equal(rb.summary, msg);

  fs.rmSync(home, { recursive: true, force: true });
});

test('B1 apitest plugin check excludes the deleted dev files', () => {
  const src = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/SERVER/tools/apitest.mjs'), 'utf8');
  assert.match(src, /!plugFiles\.includes\('logic\.mjs'\)/);
  assert.match(src, /!plugFiles\.includes\('guard\.test\.mjs'\)/);
});

test('B2 prose no longer names the deleted logic.mjs', () => {
  const guideline = fs.readFileSync(path.join(ROOT, 'AGENT/04PLUGIN/GUIDELINE.md'), 'utf8');
  const usecases = fs.readFileSync(path.join(ROOT, 'DOCS/USECASES.md'), 'utf8');
  assert.ok(!/logic\.mjs/.test(guideline), 'GUIDELINE still names logic.mjs');
  assert.ok(!/logic\.mjs/.test(usecases), 'USECASES still names logic.mjs');
});

test('B3 min OpenCode version is identical everywhere', () => {
  const inst = JSON.parse(fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/PASSIVE/02INSTALLER/install.json'), 'utf8'));
  const probes = JSON.parse(fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/PASSIVE/01MANIFEST/probes.json'), 'utf8'));
  assert.equal(inst.steps.find((s) => s.id === 'opencode')?.min, '2.0.30');
  assert.equal(probes.probes.find((p) => p.id === 'opencode')?.params?.min, '2.0.30');
  assert.ok(fs.readFileSync(path.join(ROOT, 'DOCS/USECASES.md'), 'utf8').includes('2.0.30'));
});
