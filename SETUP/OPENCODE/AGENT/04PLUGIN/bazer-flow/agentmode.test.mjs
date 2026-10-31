/* Agent modes from spec `agents`: validator + readOnly/open enforcement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRuntime } from './runtime.mjs';
import { loadAgentModes, modeOf } from './agentmode.mjs';

const spec = JSON.parse(fs.readFileSync(new URL('./flow.spec.json', import.meta.url), 'utf8'));
const NOW = 1_700_000_000_000;
const HOME = path.join('C:', 'Users', 'u');
const PROJ = path.join('C:', 'proj', 'x.txt');
const TEMP = path.join(os.tmpdir(), 'bazer', 'x.txt');
const CFG = path.join(HOME, '.config', 'opencode', 'x.json');

const memStore = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return {
    get: (k) => (m.has(k) ? JSON.parse(JSON.stringify(m.get(k))) : undefined),
    set: (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); },
    del: (k) => { m.delete(k); },
    has: (k) => m.has(k),
  };
};
const boot = ({ s = spec, store = memStore() } = {}) => createRuntime({ spec: s, store, now: () => NOW, home: HOME });
const WRITE = (p) => ({ tool: 'write', path: p });
const SHELL = (command) => ({ tool: 'shell', command });

test('A1 spec agents loader validates modes and defaults to open', () => {
  assert.deepEqual(loadAgentModes(spec), { advisor: 'readOnly', snack: 'open' });
  assert.deepEqual(loadAgentModes({}), {});
  assert.deepEqual(loadAgentModes({ agents: { X: { mode: 'readOnly' } } }), { x: 'readOnly' });
  assert.equal(modeOf({}, 'ghost'), 'open');
  assert.equal(modeOf({ advisor: 'readOnly' }, 'ADVISOR'), 'readOnly');
  assert.throws(() => loadAgentModes({ agents: { advisor: { mode: 'nope' } } }), /spec: agent advisor mode/);
  assert.throws(() => loadAgentModes({ agents: { advisor: {} } }), /spec: agent advisor mode/);
  assert.throws(() => loadAgentModes({ agents: [] }), /spec: agents/);
});

test('A2 readOnly denies project writes/shell writes, allows reads and temp', () => {
  const rt = boot();
  rt.setAgent('a', 'advisor');
  const proj = rt.before('a', WRITE(PROJ));
  assert.equal(proj.allow, false);
  assert.equal(proj.detail, 'readOnly');
  assert.match(proj.hint, /advisor is read-only/);
  assert.ok(proj.hint.length <= 160);
  assert.equal(rt.before('a', WRITE(TEMP)).allow, true);
  assert.equal(rt.before('a', { tool: 'read' }).allow, true);

  const shell = rt.before('a', SHELL('Set-Content "C:\\proj\\a.txt" hi'));
  assert.equal(shell.allow, false);
  assert.equal(shell.detail, 'readOnly');
  assert.equal(rt.before('a', SHELL('Get-Content "C:\\proj\\a.txt"')).allow, true);
  assert.equal(rt.before('a', SHELL('git status --porcelain')).allow, true);
  assert.equal(rt.before('a', SHELL('Set-Content "' + TEMP + '" hi')).allow, true);
  assert.equal(rt.before('a', SHELL('node -e "require(\'fs\').writeFileSync(\'C:/proj/a\',\'x\')"')).allow, false);
  assert.equal(rt.before('a', SHELL('Set-Content "$x\\a.txt" hi')).allow, false);
});

test('A3 protected path wins over readOnly and children inherit the root mode', () => {
  const rt = boot();
  rt.setAgent('a', 'advisor');
  const prot = rt.before('a', WRITE(CFG));
  assert.equal(prot.allow, false);
  assert.equal(prot.detail, 'protected');
  assert.match(prot.hint, /Protected path/);
  const shellProt = rt.before('a', SHELL('Set-Content "' + CFG + '" hi'));
  assert.equal(shellProt.detail, 'protected');

  rt.setAgent('kid', 'somechild');
  rt.linkSession('kid', 'a');
  const kid = rt.before('kid', WRITE(PROJ));
  assert.equal(kid.allow, false);
  assert.equal(kid.detail, 'readOnly');
  assert.equal(rt.before('kid', WRITE(TEMP)).allow, true);
});

test('A4 open and unknown agents keep today behaviour; flow agents unchanged', () => {
  const rt = boot();
  rt.setAgent('s', 'snack');
  assert.equal(rt.before('s', WRITE(PROJ)).allow, true);
  assert.equal(rt.before('s', SHELL('Set-Content "C:\\proj\\a.txt" hi')).allow, true);
  rt.setAgent('g', 'ghost');
  assert.equal(rt.before('g', WRITE(PROJ)).allow, true);

  const flow = boot();
  flow.setAgent('b', 'buddha');
  assert.equal(flow.before('b', WRITE(PROJ)).allow, false, 'P0 stays closed');
  const store = memStore();
  store.set('b.buddha', { v: 2, flow: 'buddha', phase: 'P6', at: NOW, lastEventAt: NOW });
  const open = boot({ store });
  open.setAgent('b', 'buddha');
  assert.equal(open.before('b', WRITE(PROJ)).allow, true, 'P6 stays open');
});
