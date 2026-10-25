/**
 * isolation.test.mjs — K1: prove every writer uses the home-derived store.
 * Read-only on the real var/; state.json + history.tsv are copied to
 * %TEMP%\bazer\k1-backup and restored byte-identical in finally.
 * Run: node --test tools/isolation.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { STATE_FILE, VAR_DIR } from '../env.mjs';
import {
  makeStore, storeFor, writeState, applyEntries, setPolicy, undoPolicy, retireOldFlow,
  saveSettings, writeFullSettings, pstackPreset, rollback, snapshotModels,
  restoreLockedModels, cleanupOld, resetTemplate, snapshotTrusted, trustedSnapshot,
} from '../apply.mjs';
import { runAction } from '../actions.mjs';

const HIST_FILE = path.join(VAR_DIR, 'history.tsv');
const K1 = path.join(os.tmpdir(), 'bazer', 'k1-backup');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const dirs = (p) => {
  try { return fs.readdirSync(p).filter((n) => fs.statSync(path.join(p, n)).isDirectory()).sort(); }
  catch { return []; }
};

function fingerprint() {
  const st = fs.existsSync(STATE_FILE) ? fs.statSync(STATE_FILE) : null;
  const hist = fs.existsSync(HIST_FILE) ? fs.readFileSync(HIST_FILE) : Buffer.alloc(0);
  const lines = hist.length ? hist.toString('utf8').split(/\r?\n/).filter(Boolean) : [];
  return {
    stateHash: st ? sha(fs.readFileSync(STATE_FILE)) : null,
    stateMtime: st ? st.mtimeMs : null,
    histHash: sha(hist),
    histLines: lines.length,
    histLast: lines.length ? lines[lines.length - 1] : null,
    backups: dirs(path.join(VAR_DIR, 'backups')),
    quarantine: dirs(path.join(VAR_DIR, 'quarantine')),
  };
}

function backupReal() {
  fs.mkdirSync(K1, { recursive: true });
  return [STATE_FILE, HIST_FILE].map((f) => {
    const exists = fs.existsSync(f);
    const st = exists ? fs.statSync(f) : null;
    if (exists) fs.copyFileSync(f, path.join(K1, path.basename(f)));
    return { f, exists, atime: st?.atimeMs, mtime: st?.mtimeMs };
  });
}

function restoreReal(saved) {
  for (const s of saved) {
    if (s.exists) {
      fs.copyFileSync(path.join(K1, path.basename(s.f)), s.f);
      try { fs.utimesSync(s.f, new Date(s.atime), new Date(s.mtime)); } catch { /* best effort */ }
    } else {
      fs.rmSync(s.f, { force: true });
    }
  }
}

test('K1: every writer stays in <home>/.bazerconsole/var; real var is untouched', () => {
  const before = fingerprint();
  const saved = backupReal();
  const home = path.join(os.tmpdir(), 'bazer', 'k1-home');
  try {
    fs.rmSync(home, { recursive: true, force: true });
    const cfg = path.join(home, '.config', 'opencode');
    fs.mkdirSync(cfg, { recursive: true });
    fs.mkdirSync(path.join(home, '.agents'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'opencode.jsonc'), JSON.stringify({
      agent: {
        buddha: { model: 'a/one' }, bazer: { model: 'a/two' },
        snack: { model: 'a/three' }, advisor: { model: 'a/four' },
      },
      plugins: ['./plugins/legacy'],
    }, null, 2), 'utf8');
    fs.writeFileSync(path.join(cfg, 'tui.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(home, '.agents', 'pstack-models.md'), '# models\n', 'utf8');

    const calls = [
      () => applyEntries(home, null),
      () => setPolicy(home, 'buddha-ladder', '2'),
      () => undoPolicy(home, 'buddha-ladder'),
      () => retireOldFlow(home),
      () => saveSettings(home, [{ id: 'lock.models', value: true }]),
      () => writeFullSettings(home, 'tui', '{"$schema":"https://opencode.ai/tui.json"}'),
      () => pstackPreset(home, 'uniform', 'a/b'),
      () => rollback(home, '19990101-000000-000'),
      () => snapshotModels(home),
      () => restoreLockedModels(home),
      () => cleanupOld(home, { apply: true }),
      () => resetTemplate(home, 'tpl.agents-md'),
    ];
    for (const fn of calls) { try { fn(); } catch { /* handler errors are fine; leaks are not */ } }

    // The same paths through actions.mjs (apply is called directly above: its handler runs probes/opencode).
    const ctx = { home, store: storeFor(home) };
    const handlers = [
      ['policy-set', { level: '2', confirmed: true }],
      ['policy-undo', { confirmed: true }],
      ['builtin-toggle', { mode: 'off', confirmed: true }],
      ['retire-old-flow', { confirmed: true }],
      ['settings-save', { confirmed: true, patches: [{ id: 'lock.models', value: true }] }],
      ['settings-full', { confirmed: true, file: 'tui', content: '{"$schema":"https://opencode.ai/tui.json"}' }],
      ['pstack-preset', { confirmed: true, mode: 'uniform', modelA: 'a/b' }],
      ['rollback', { confirmed: true, stamp: '19990101-000000-000' }],
      ['lock-snapshot', { confirmed: true }],
      ['lock-restore', { confirmed: true }],
      ['cleanup-old', { confirmed: true, apply: true }],
      ['reset-template', { confirmed: true, id: 'tpl.agents-md' }],
    ];
    for (const [id, params] of handlers) { try { runAction(id, ctx, params); } catch { /* same */ } }

    const store = storeFor(home);
    assert.equal(store.stateFile, path.join(home, '.bazerconsole', 'var', 'state.json'));
    assert.ok(fs.existsSync(store.stateFile), 'sandbox state.json was not created');
    assert.deepEqual(fingerprint(), before, 'real var/ changed during sandbox calls');
  } finally {
    restoreReal(saved);
  }
});

test('K1/B4: snapshot from a test folder is absent, restore refuses, drift is hidden', () => {
  const home = path.join(os.tmpdir(), 'bazer', 'k1-guard-home');
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  const store = makeStore(path.join(home, '.bazerconsole', 'var'));
  const polluted = {
    entries: {}, policy: null, locks: { models: true }, policies: {},
    modelsSnapshot: { buddha: { model: 'p/one', variant: null } },
    snapshotHome: path.join(os.tmpdir(), 'bazer', 'api test home'),
  };
  writeState(polluted, store);
  assert.equal(snapshotTrusted(polluted, home), false);
  assert.equal(trustedSnapshot(polluted, home), null);
  const r = runAction('lock-restore', { home, store }, { confirmed: true });
  assert.equal(r.ok, false);
  assert.equal(r.summary, 'snapshot มาจากโฟลเดอร์ทดสอบ - สร้าง snapshot ใหม่');
  fs.rmSync(home, { recursive: true, force: true });
});
