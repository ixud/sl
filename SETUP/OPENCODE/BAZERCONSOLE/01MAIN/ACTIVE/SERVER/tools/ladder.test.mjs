import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeStore, readLadder, writeLadder, migrateLadder, ladderFile } from '../apply.mjs';
import { runAction } from '../actions.mjs';
import { ladderPermission } from '../plan.mjs';
import { makeResolver } from '../env.mjs';
import { ladderProbe } from '../probe.mjs';
import { actions } from '../manifest.mjs';
import { actionIds } from '../actions.mjs';

const SERVER = path.dirname(fileURLToPath(import.meta.url));
const mkTmp = (tag) => fs.mkdtempSync(path.join(os.tmpdir(), `bazer-ladder-${tag}-`));
const sha = (p) => (fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : 'missing');
const ctxOf = () => {
  const root = mkTmp('ctx');
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });
  return { root, home, store: makeStore(path.join(root, 'store')) };
};

test('actions.json and handler registry agree on ladder-set (R3)', () => {
  assert.ok(actionIds.includes('ladder-set'));
  const meta = actions.actions.find((a) => a.id === 'ladder-set');
  assert.ok(meta);
  assert.deepEqual(meta.params, ['level', 'confirm', 'hours']);
});

test('ladder-set: L2 refused without/wrong confirm, accepted with typed confirm', () => {
  const ctx = ctxOf();
  const no = runAction('ladder-set', ctx, { level: 2 });
  assert.equal(no.ok, false);
  assert.match(no.summary, /GATE 2/);
  assert.match(no.summary, /protected paths/);
  assert.match(no.summary, /force-push/);
  assert.equal(fs.existsSync(ladderFile(ctx.home)), false);

  const wrong = runAction('ladder-set', ctx, { level: 2, confirm: 'เหมา' });
  assert.equal(wrong.ok, false);
  assert.equal(fs.existsSync(ladderFile(ctx.home)), false);

  const yes = runAction('ladder-set', ctx, { level: 2, confirm: 'เหมาเข่ง', hours: 2 });
  assert.equal(yes.ok, true);
  assert.equal(readLadder(ctx.home).level, 2);
  const hist = fs.readFileSync(ctx.store.historyFile, 'utf8');
  assert.match(hist, /ladder-set/);
  assert.match(hist, /ladder\.json/);
});

test('ladder-set: L0/L1 need no confirm; invalid level/hours refused', () => {
  const ctx = ctxOf();
  assert.equal(runAction('ladder-set', ctx, { level: 0 }).ok, true);
  assert.equal(runAction('ladder-set', ctx, { level: 1 }).ok, true);
  for (const p of [{ level: 3 }, { level: -1 }, { level: 1, hours: 0 }, { level: 1, hours: 25 }, { level: 1, hours: 1.5 }]) {
    const r = runAction('ladder-set', ctx, p);
    assert.equal(r.ok, false, JSON.stringify(p));
  }
});

test('expiry arithmetic and invalid/expired -> level 0', () => {
  const ctx = ctxOf();
  const now = 1_700_000_000_000;
  const r = writeLadder(ctx.home, 1, 8, { now });
  assert.equal(r.expires, now + 8 * 3600 * 1000);
  assert.equal(readLadder(ctx.home, { now: r.expires - 1 }).valid, true);
  assert.equal(readLadder(ctx.home, { now: r.expires - 1 }).level, 1);
  const later = readLadder(ctx.home, { now: r.expires });
  assert.equal(later.valid, false);
  assert.equal(later.level, 0);
  const keys = Object.keys(readLadder(ctx.home, { now })).sort();
  assert.deepEqual(keys, ['expires', 'level', 'mtime', 'path', 'valid']);
});

test('migration table 1->0, 2..5->1 (never 2), old keys untouched, idempotent', () => {
  for (const [old, want] of [[1, 0], [2, 1], [3, 1], [4, 1], [5, 1]]) {
    const ctx = ctxOf();
    fs.mkdirSync(ctx.store.dir, { recursive: true });
    const state = { policies: { 'buddha-ladder': { level: String(old), prev: '4' } }, policy: { policyId: 'buddha-ladder', level: String(old) } };
    fs.writeFileSync(ctx.store.stateFile, JSON.stringify(state, null, 2), 'utf8');
    const before = sha(ctx.store.stateFile);
    const m = migrateLadder(ctx.home, ctx.store);
    assert.equal(m.migrated, true);
    assert.equal(m.level, want, `old ${old}`);
    assert.equal(m.notice, 'ตั้งบันไดเป็น L1 อัตโนมัติ');
    assert.equal(sha(ctx.store.stateFile), before, 'old policy keys must not change');
    const mtime = readLadder(ctx.home).mtime;
    const again = migrateLadder(ctx.home, ctx.store);
    assert.equal(again.migrated, false);
    assert.equal(again.notice, undefined);
    assert.equal(readLadder(ctx.home).mtime, mtime);
  }
});

test('atomic write leaves no partial/temp file', () => {
  const ctx = ctxOf();
  writeLadder(ctx.home, 2, 1, { now: 42 });
  const dir = path.dirname(ladderFile(ctx.home));
  const names = fs.readdirSync(dir);
  assert.deepEqual(names.filter((n) => n.includes('bazer-tmp')), []);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'ladder.json'), 'utf8')), { v: 1, level: 2, expires: 42 + 3600 * 1000, setBy: 'console' });
});

test('ladder path is injectable and never falls back to the real file', () => {
  const ctx = ctxOf();
  const custom = path.join(ctx.root, 'elsewhere', 'ladder.json');
  writeLadder(ctx.home, 1, 1, { file: custom });
  assert.equal(readLadder(ctx.home, { file: custom }).path, path.resolve(custom));
  assert.equal(readLadder(ctx.home, { file: custom }).level, 1);
  assert.equal(fs.existsSync(ladderFile(ctx.home)), false);
});

test('advisor row after manifest fix; SNACK unchanged', () => {
  const adv = ladderPermission('advisor', 'buddha-ladder', '1');
  assert.equal(adv.glob, 'allow');
  assert.equal(adv.grep, 'allow');
  assert.equal(adv.list, 'allow');
  assert.equal(adv.shell, 'ask');
  assert.equal(adv.edit, 'deny');
  assert.equal(adv.read, 'allow');
  const snack = ladderPermission('snack', 'buddha-ladder', '1');
  assert.equal(snack.glob, 'deny');
  assert.equal(snack.shell, 'ask');
  assert.equal(snack.edit, 'allow');
});

test('probe ladder-state is warn-only: file expiry + plugin spec lists ladder', () => {
  const ctx = ctxOf();
  const r0 = ladderProbe(ctx.home);
  assert.equal(r0.ok, false);
  writeLadder(ctx.home, 1, 1);
  const specDir = path.join(ctx.home, '.config', 'opencode', 'plugins', 'bazer-flow');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, 'flow.spec.json'), '{"features":["ladder"]}', 'utf8');
  const r1 = ladderProbe(ctx.home);
  assert.equal(r1.ok, true);
  assert.match(r1.detail, /spec มี ladder/);
  fs.rmSync(path.join(specDir, 'flow.spec.json'));
  assert.equal(ladderProbe(ctx.home).ok, false);
});

test('real state/config/agents/ladder hashes unchanged by sandboxed ladder writes', () => {
  const { vars } = makeResolver(os.homedir());
  const activeVar = path.resolve(SERVER, '..', 'var');
  const files = [
    path.join(activeVar, 'state.json'), path.join(activeVar, 'history.tsv'),
    path.join(vars.CONFIG, 'opencode.jsonc'),
    ...(() => { try { return fs.readdirSync(path.join(vars.CONFIG, 'agents')).filter((n) => n.endsWith('.md')).map((n) => path.join(vars.CONFIG, 'agents', n)); } catch { return []; } })(),
    path.join(vars.STATE, 'bazer-flow', 'ladder.json'),
  ];
  const before = files.map(sha);
  const ctx = ctxOf();
  writeLadder(ctx.home, 2, 1);
  migrateLadder(ctx.home, ctx.store);
  assert.deepEqual(files.map(sha), before);
});
