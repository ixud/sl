/* 2ad: protected paths/reads, danger additions, perm cap, ladder unk. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isProtectedPath, protectedInCommand, credentialInCommand } from './paths.mjs';
import { runPerm } from './permhook.mjs';
import { createRuntime } from './runtime.mjs';
import { credentialPath } from './rules.mjs';
import * as ladder from './ladder.mjs';

const spec = JSON.parse(fs.readFileSync(new URL('./flow.spec.json', import.meta.url), 'utf8'));
const LFILE = path.join(os.tmpdir(), 'bazer', 'k6-rules-ladder.json');
const HOME = path.join('C:', 'Users', 'u');
const NOW = 1_700_000_000_000;
const writeLadder = (n) => { fs.mkdirSync(path.dirname(LFILE), { recursive: true }); fs.writeFileSync(LFILE, JSON.stringify({ v: 1, level: n, expires: null }), 'utf8'); };
const SHELL = (command) => ({ tool: 'shell', command });

test('R1 protected writes: project config/.opencode/git hooks/token/cache', () => {
  for (const p of ['C:\\x\\.opencode\\plugins\\a.js', 'C:\\x\\opencode.json', 'C:\\x\\opencode.jsonc', 'C:\\x\\.git\\hooks\\pre-commit', 'C:\\x\\.husky\\pre-commit', 'C:\\x\\var\\token-4310', 'C:\\Users\\u\\.local\\share\\opencode\\auth.json', 'C:\\Users\\u\\.cache\\opencode\\bin\\x']) {
    assert.equal(isProtectedPath(p, { HOME }), true, p);
  }
  assert.equal(isProtectedPath('C:\\x\\opencode-notes.md', { HOME }), false);
  assert.equal(isProtectedPath('C:\\BCS\\x\\var\\state.json', { HOME }), false);
  assert.equal(protectedInCommand('Set-Content "C:\\x\\.opencode\\plugins\\a.js" x', { HOME }), true);
});

test('R2 credential mentions: token file/auth.json only', () => {
  assert.equal(credentialInCommand('Get-Content "C:\\x\\var\\token-4310"'), true);
  assert.equal(credentialInCommand('type "C:\\Users\\u\\.local\\share\\opencode\\auth.json"'), true);
  assert.equal(credentialInCommand('Get-Content "C:\\BCS\\x\\var\\state.json"'), false);
  assert.equal(credentialInCommand('Get-Content "C:\\x\\token-notes.md"'), false);
});

test('R3 danger additions; safe lookalikes stay safe', () => {
  for (const s of ['Clear-Disk -Number 1', 'Remove-Partition -DiskNumber 1', 'Initialize-Disk -Number 1', 'git push -fu', 'git push origin +main', 'git push --delete origin x', 'Add-MpPreference -ExclusionPath C:\\x', 'Set-MpPreference -ExclusionPath C:\\x', 'Start-Process cmd -Verb RunAs', 'Invoke-WebRequest http://127.0.0.1:4310/api/state', 'curl http://localhost:4311/api/action']) {
    assert.equal(ladder.classifySegment(s, {}), 'DANGER', s);
  }
  for (const s of ['Format-Table', 'Get-Content format.txt', 'git push origin main', 'git log --format=%H']) assert.notEqual(ladder.classifySegment(s, {}), 'DANGER', s);
});

test('R4 inner cmd/powershell text is checked', () => {
  assert.equal(ladder.classifySegment('cmd /c "Clear-Disk -Number 1"', {}), 'DANGER');
  assert.equal(ladder.classifySegment('powershell -Command "Add-MpPreference -ExclusionPath C:\\x"', {}), 'DANGER');
  assert.equal(ladder.classifySegment('pwsh -c "git push --force"', {}), 'DANGER');
});

test('R5 ask is never capped; allow stays capped', () => {
  const rows = [];
  const deps = (sid) => ({ sid, toReq: (e) => ({ tool: 'shell', command: e.resources[0] }), peek: () => ({ allow: true }), emit: (x) => rows.push(x), deny: () => {}, miss: () => {}, codeOf: () => '', permSeen: new Map(), skipSeen: new Map() });
  const ask = deps('ask1');
  for (let i = 0; i < 9; i++) runPerm({ sessionID: 'ask1', agent: 'snack', action: 'shell', resources: ['Get-Content x'], effect: 'ask' }, ask);
  assert.equal(rows.filter((e) => e.event === 'perm' && e.effect === 'ask').length, 9);
  const allow = deps('allow1');
  for (let i = 0; i < 9; i++) runPerm({ sessionID: 'allow1', agent: 'snack', action: 'shell', resources: ['Get-Content x'], effect: 'allow' }, allow);
  assert.equal(rows.filter((e) => e.event === 'perm' && e.effect === 'allow').length, 5);
});

test('R7 protected read: runtime shell and permhook read deny; state.json allowed', () => {
  const rt = createRuntime({ spec, store: (() => { const m = new Map(); return { get: (k) => (m.has(k) ? JSON.parse(JSON.stringify(m.get(k))) : undefined), set: (k, v) => m.set(k, v), del: (k) => m.delete(k), has: (k) => m.has(k) }; })(), now: () => NOW, home: HOME });
  rt.setAgent('s', 'snack');
  assert.equal(rt.before('s', SHELL('Get-Content "C:\\x\\var\\token-4310"')).detail, 'protected');
  assert.equal(rt.before('s', SHELL('Get-Content "C:\\BCS\\x\\var\\state.json"')).allow, true);

  const token = { sessionID: 's', agent: 'snack', action: 'read', resources: ['C:\\x\\.local\\share\\opencode\\auth.json'], effect: 'ask' };
  runPerm(token, { sid: 's', toReq: () => ({ tool: 'read' }), peek: () => ({ allow: true }), emit: () => {}, deny: () => {}, miss: () => {}, codeOf: () => '', permSeen: new Map(), skipSeen: new Map(), credentialPath });
  assert.equal(token.effect, 'deny');
  const state = { sessionID: 's', agent: 'snack', action: 'read', resources: ['C:\\BCS\\x\\var\\state.json'], effect: 'ask' };
  runPerm(state, { sid: 's', toReq: () => ({ tool: 'read' }), peek: () => ({ allow: true }), emit: () => {}, deny: () => {}, miss: () => {}, codeOf: () => '', permSeen: new Map(), skipSeen: new Map(), credentialPath });
  assert.equal(state.effect, 'ask');
});

test('R6 ladder unk texts are capped, redacted, control-free', () => {
  writeLadder(2);
  const rows = [];
  const S = ladder.loadLadderSpec(spec);
  ladder.applyLadder({
    r: { flow: null, root: 'unk1' }, req: SHELL('Set-Content C:\\proj\\a hi'), effect: 'ask', agent: 'snack', sid: 'unk1',
    spec: spec, specLadder: S, file: LFILE, env: {}, temps: [], now: NOW, log: (e) => rows.push(e),
    action: 'shell', resources: ['Set-Content C:\\proj\\a hi', 'custom-tool --token abc123', 'x'.repeat(200) + '\u0001'],
  });
  const row = rows.find((e) => e.event === 'ladder');
  assert.ok(row && Array.isArray(row.unk));
  assert.ok(row.unk.length <= 5 && row.unk.every((t) => t.length <= 80));
  assert.equal(row.unk.join(' ').includes('abc123'), false);
  assert.equal(row.unk.join(' ').includes('\u0001'), false);
});
