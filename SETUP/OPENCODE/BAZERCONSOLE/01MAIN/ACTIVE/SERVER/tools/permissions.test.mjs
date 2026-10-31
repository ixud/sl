/* K4a: single permission owner (opencode.jsonc agent.<id>.permission). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyEntries, writeEntry, setPolicy, undoPolicy, rollback, stamp,
  readState, writeState, makeStore,
} from '../apply.mjs';
import { manifest, srcPath } from '../manifest.mjs';
import { policyLevel, policyPermission } from '../plan.mjs';
import { parseJsonc, getAtPath } from '../jsonc.mjs';
import { ROOT } from '../env.mjs';
import * as probe from '../probe.mjs';

const ALL = ['read', 'edit', 'glob', 'grep', 'list', 'shell', 'subagent', 'webfetch', 'websearch', 'external_directory', 'question', 'doom_loop'];
const A = 'allow', D = 'deny', K = 'ask';
const norm = (o) => Object.fromEntries(ALL.map((k) => [k, (o && o[k]) || K]));
const entryFor = (agent) => manifest.entries.find((e) => e.valuePath === `agent.${agent}.permission`);
const level = (id = '3') => policyLevel('buddha-ladder', id);
const computed = (agent, id = '3') => policyPermission(entryFor(agent), level(id));

const EXPECT = {
  buddha: { read: A, edit: A, glob: A, grep: A, list: A, shell: A, subagent: A, webfetch: A, websearch: A, external_directory: A },
  bazer: { read: A, edit: A, glob: A, grep: A, list: A, shell: A, subagent: A, webfetch: A, websearch: A, external_directory: A },
  snack: { read: A, edit: A, glob: D, grep: D, list: D, shell: K, subagent: D, webfetch: A, websearch: A, external_directory: A },
  advisor: { read: A, edit: D, glob: D, grep: D, list: D, shell: D, subagent: D, webfetch: K, websearch: K, external_directory: K },
  'arena-runner': { read: A, edit: A, glob: A, grep: A, list: A, shell: A, subagent: D, webfetch: A, websearch: A, external_directory: A },
  'arena-judge': { read: A, edit: D, glob: A, grep: A, list: A, shell: D, subagent: D, webfetch: A, websearch: A, external_directory: A },
};

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k4a-perm-'));
  const home = path.join(root, 'home');
  const store = makeStore(path.join(root, 'var'));
  fs.mkdirSync(path.join(home, '.config', 'opencode', 'agents'), { recursive: true });
  fs.mkdirSync(store.dir, { recursive: true });
  return { root, home, store, cfg: path.join(home, '.config', 'opencode', 'opencode.jsonc') };
}
const seed = (store, lvl = '3', prev = '2') => writeState({
  entries: {},
  locks: {},
  policies: { 'buddha-ladder': { level: lvl, prev, at: 'x' }, 'bazer-ladder': { level: lvl, prev, at: 'x' } },
}, store);
const readCfg = (box) => parseJsonc(fs.readFileSync(box.cfg, 'utf8'));
const cfgPerm = (box, agent) => getAtPath(fs.readFileSync(box.cfg, 'utf8'), ['agent', agent, 'permission']);
const writeCfg = (box, obj) => fs.writeFileSync(box.cfg, JSON.stringify(obj, null, 2), 'utf8');

test('P1 data: six cfg entries reproduce A1 effective at level 3', () => {
  for (const agent of Object.keys(EXPECT)) {
    const e = entryFor(agent);
    assert.ok(e, `cfg entry for ${agent}`);
    assert.ok(e.replace, `${agent} replace`);
    assert.equal(e.onlyIfMissing, undefined, `${agent} no onlyIfMissing`);
    assert.deepEqual(norm(computed(agent)), norm(EXPECT[agent]), agent);
  }
});

test('P2 install writes config by replace at the stored level', () => {
  const box = sandbox();
  seed(box.store, '3');
  writeCfg(box, { agent: {
    buddha: { permission: { shell: 'ask', webfetch: 'allow', bogus: 'allow' } },
    snack: { permission: { read: 'allow', marker: 'keep' } },
  } });
  const r = applyEntries(box.home, ['cfg.buddha-default'], box.store);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(norm(cfgPerm(box, 'buddha')), norm(EXPECT.buddha));
  assert.equal(cfgPerm(box, 'buddha').bogus, undefined);
  assert.equal(cfgPerm(box, 'snack').marker, 'keep');
});

test('P2 install strips md permission for the six (backup kept)', () => {
  const box = sandbox();
  seed(box.store, '3');
  writeCfg(box, { agent: {} });
  const ids = [['agent.buddha', 'buddha'], ['agent.bazer', 'bazer'], ['agent.snack', 'snack'], ['agent.advisor', 'advisor'], ['subsub.arena-runner', 'arena-runner'], ['subsub.arena-judge', 'arena-judge']];
  const st = stamp();
  for (const [id, name] of ids) {
    const md = path.join(box.home, '.config', 'opencode', 'agents', `${name}.md`);
    fs.writeFileSync(md, '---\nname: ' + name + '\npermission:\n  shell: allow\n  bogus: deny\n---\nOLD BODY\n', 'utf8');
    writeEntry(manifest.entries.find((x) => x.id === id), box.home, st, box.store);
    const text = fs.readFileSync(md, 'utf8');
    assert.equal(/^permission\s*:/m.test(text), false, name);
    assert.equal(text.includes('bogus'), false, name);
  }
  assert.ok(fs.existsSync(path.join(box.store.backupDir, st, 'manifest.json')), 'backup manifest');
});

test('P2 install strips md even when stateOf already looks clean', () => {
  const box = sandbox();
  seed(box.store, '3');
  writeCfg(box, { agent: {} });
  const e = manifest.entries.find((x) => x.id === 'agent.buddha');
  const src = fs.readFileSync(srcPath(e), 'utf8');
  const m = /^((---\r?\n[\s\S]*?)(\r?\n---))/.exec(src);
  assert.ok(m, 'frontmatter');
  const md = path.join(box.home, '.config', 'opencode', 'agents', 'buddha.md');
  fs.writeFileSync(md, m[2] + '\npermission:\n  shell: allow' + m[3] + src.slice(m[0].length), 'utf8');
  const r = applyEntries(box.home, ['agent.buddha'], box.store);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(/^permission\s*:/m.test(fs.readFileSync(md, 'utf8')), false);
});

test('P3 equivalence: findLast(config, md) equals A1 at level 3', () => {
  const eff = (cfg, md) => {
    const rules = [...Object.entries(cfg), ...Object.entries(md)].map(([action, effect]) => ({ action, effect }));
    const out = {};
    for (const k of ALL) {
      const hit = rules.filter((r) => r.action === k).at(-1);
      out[k] = hit ? hit.effect : K;
    }
    return out;
  };
  for (const agent of Object.keys(EXPECT)) {
    assert.deepEqual(norm(eff(computed(agent), {})), norm(EXPECT[agent]), agent);
  }
  const stale = { ...computed('buddha'), shell: 'deny' };
  assert.equal(eff(computed('buddha'), stale).shell, 'deny', 'file wins per key if a block remains');
});

test('P3 downgrade 3->1 removes stale web/external allows', () => {  const box = sandbox();
  seed(box.store, '3');
  applyEntries(box.home, ['cfg.buddha-default'], box.store);
  const p3 = cfgPerm(box, 'buddha');
  assert.equal(p3.webfetch, 'allow');
  seed(box.store, '1', '3');
  const r = applyEntries(box.home, ['cfg.buddha-default'], box.store);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const p1 = cfgPerm(box, 'buddha');
  assert.deepEqual(norm(p1), norm({ read: A, edit: A, glob: A, grep: A, list: A, shell: K, subagent: A }));
  for (const k of ['webfetch', 'websearch', 'external_directory']) assert.equal(p1[k], undefined, k);
  applyEntries(box.home, ['cfg.buddha-default', 'cfg.bazer-default', 'cfg.snack-permission', 'cfg.advisor-permission', 'cfg.arena-runner-permission', 'cfg.arena-judge-permission'], box.store);
  for (const agent of Object.keys(EXPECT)) {
    const p = cfgPerm(box, agent) || {};
    for (const k of ['webfetch', 'websearch']) assert.notEqual(p[k], 'allow', `${agent}.${k}`);
    if (!['arena-runner', 'arena-judge'].includes(agent)) assert.notEqual(p.external_directory, 'allow', `${agent}.external_directory`);
  }
});

test('P4 undo and rollback still restore permission', () => {
  const box = sandbox();
  seed(box.store, '3', '2');
  applyEntries(box.home, ['cfg.buddha-default'], box.store);
  setPolicy(box.home, 'buddha-ladder', '1', box.store);
  assert.equal(cfgPerm(box, 'buddha').shell, 'ask');
  undoPolicy(box.home, 'buddha-ladder', box.store);
  assert.deepEqual(norm(cfgPerm(box, 'buddha')), norm(EXPECT.buddha));

  const custom = { agent: { buddha: { permission: { shell: 'deny' } } } };
  writeCfg(box, custom);
  const st = stamp();
  writeEntry(entryFor('buddha'), box.home, st, box.store);
  assert.notEqual(fs.readFileSync(box.cfg, 'utf8'), JSON.stringify(custom, null, 2));
  rollback(box.home, st, box.store);
  assert.equal(fs.readFileSync(box.cfg, 'utf8'), JSON.stringify(custom, null, 2));
});

test('P5 probe drift helper: md block and config != computed', () => {
  const e = entryFor('buddha');
  const want = computed('buddha');
  const ok = probe.permissionDrift(e, level(), want, '---\nname: buddha\n---\n');
  assert.equal(ok.hasBlock, false);
  assert.deepEqual(ok.diff, []);
  const block = probe.permissionDrift(e, level(), want, '---\nname: buddha\npermission:\n  read: allow\n---\n');
  assert.equal(block.hasBlock, true);
  const drift = probe.permissionDrift(e, level(), { ...want, bogus: 'allow' }, '');
  assert.ok(drift.diff.some((x) => x.startsWith('bogus')));
  assert.ok(probe.permissionDrift(e, level(), { ...want, shell: 'deny' }, '').diff.some((x) => x.startsWith('shell')));
});

test('P6 repo md: six files carry no permission block', () => {
  const files = ['01PRIMARY/BUDDHA.md', '01PRIMARY/BAZER.md', '01PRIMARY/SNACK.md', '01PRIMARY/ADVISOR.md', '02SUBAGENT/ARENA-RUNNER.md', '02SUBAGENT/ARENA-JUDGE.md'];
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, 'AGENT', f), 'utf8');
    assert.equal(/^permission\s*:/m.test(text), false, f);
  }
});
