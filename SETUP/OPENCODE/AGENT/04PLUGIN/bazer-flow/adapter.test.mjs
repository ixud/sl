/* bazer-flow adapter — payload fixtures copied from the pre-refactor index.ts shapes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toReq, toRes, toUserMsg, toChatMessage, toLink, toDeleted, toPermissionReq, subagentTarget, writePath, agentOf, agentFieldOf, sessionIdOf, roleOf,
} from './adapter.mjs';

test('toReq maps task tools (including the subagent alias) to a task request', () => {
  assert.deepEqual(toReq({ sessionID: 's', agent: 'buddha', tool: 'task', input: { subagent_type: 'builder' } }), { tool: 'task', subagent: 'builder', id: '' });
  assert.deepEqual(toReq({ tool: 'subagent', input: { agentType: 'arena-runner' } }), { tool: 'task', subagent: 'arena-runner', id: '' });
  assert.deepEqual(toReq({ tool: 'task', input: { name: 'poteto' } }), { tool: 'task', subagent: 'poteto', id: '' });
  assert.deepEqual(toReq({ tool: 'task', input: {} }), { tool: 'task', subagent: '', id: '' });
});

test('toReq maps write tools and takes the path from the known field names', () => {
  assert.deepEqual(toReq({ tool: 'edit', input: { filePath: 'C:/p/x.ts' } }), { tool: 'write', path: 'C:/p/x.ts', id: '', workdir: '' });
  assert.deepEqual(toReq({ tool: 'write', input: { file_path: 'C:/p/y.ts' } }), { tool: 'write', path: 'C:/p/y.ts', id: '', workdir: '' });
  assert.deepEqual(toReq({ tool: 'patch', input: { path: 'C:/p/z.ts' } }), { tool: 'write', path: 'C:/p/z.ts', id: '', workdir: '' });
  assert.deepEqual(toReq({ tool: 'multiedit', input: { filename: 'a.ts' } }), { tool: 'write', path: 'a.ts', id: '', workdir: '' });
  assert.deepEqual(toReq({ tool: 'edit', input: { filePath: 'x.ts', workdir: 'C:/proj' } }), { tool: 'write', path: 'x.ts', id: '', workdir: 'C:/proj' });
});

test('toReq maps shell, submit_plan and everything else', () => {
  assert.deepEqual(toReq({ tool: 'bash', input: { command: 'echo hi > x' } }), { tool: 'shell', command: 'echo hi > x', id: '', workdir: '' });
  assert.deepEqual(toReq({ tool: 'shell', input: { command: 'ls' } }), { tool: 'shell', command: 'ls', id: '', workdir: '' });
  assert.deepEqual(toReq({ tool: 'submit_plan', input: { edits: [] } }), { tool: 'submit_plan', id: '' });
  assert.deepEqual(toReq({ tool: 'read', input: {} }), { tool: 'read', id: '' });
  assert.deepEqual(toReq({ tool: 'grep', input: {} }), { tool: 'read', id: '' });
});

test('toReq maps the shapes seen in v2 log to harmless reads and keeps the call id', () => {
  assert.deepEqual(
    toReq({ tool: 'question', sessionID: 's', agent: 'buddha', messageID: 'm', id: 'call-1', input: { questions: [] } }),
    { tool: 'read', id: 'call-1' },
  );
  assert.deepEqual(
    toReq({ tool: 'mystery', sessionID: 's', agent: 'buddha', messageID: 'm', id: 'call-2', input: { id: 'x' } }),
    { tool: 'read', id: 'call-2' },
  );
  assert.deepEqual(
    toReq({ tool: 'task', sessionID: 's', id: 'call-3', input: { subagent_type: 'builder' } }),
    { tool: 'task', subagent: 'builder', id: 'call-3' },
  );
});

test('toRes carries tool, subagent, output text, failure flag and call id', () => {
  const ok = toRes({ tool: 'task', status: 'completed', id: 'c1', input: { subagent_type: 'builder' }, result: 'done' });
  assert.equal(ok.tool, 'task');
  assert.equal(ok.subagent, 'builder');
  assert.equal(ok.output, 'done');
  assert.equal(ok.error, false);
  assert.equal(ok.id, 'c1');

  const bad = toRes({ tool: 'subagent', status: 'error', id: 'c2', input: { subagent_type: 'builder' } });
  assert.equal(bad.tool, 'task');
  assert.equal(bad.error, true);
  assert.equal(bad.id, 'c2');

  const plan = toRes({ tool: 'submit_plan', status: 'completed', result: 'Plan approved!' });
  assert.equal(plan.output, 'Plan approved!');
  assert.equal(plan.error, false);
  assert.equal(plan.id, '');

  const obj = toRes({ tool: 'submit_plan', status: 'completed', result: { decision: 'approved' } });
  assert.match(obj.output, /"decision":"approved"/);
});

test('toUserMsg keeps only role=user and joins text parts', () => {
  const event = {
    type: 'message.updated',
    properties: { sessionID: 's1', info: { role: 'user', parts: [{ type: 'text', text: '>>approve' }] } },
  };
  assert.deepEqual(toUserMsg(event), { sid: 's1', role: 'user', text: '>>approve' });
  assert.equal(toUserMsg({ properties: { sessionID: 's1', info: { role: 'assistant', parts: [{ type: 'text', text: '>>approve' }] } } }), null);
  assert.equal(toUserMsg({ properties: { sessionID: 's1', info: { role: 'system' } } }), null);
  assert.deepEqual(
    toUserMsg({ properties: { sessionID: 's2', info: { role: 'user' }, text: 'hi' } }),
    { sid: 's2', role: 'user', text: 'hi' },
  );
});

test('toLink and toDeleted read the ids used by the old session maps', () => {
  assert.deepEqual(toLink({ properties: { sessionID: 'child', info: { parentID: 'root' } } }), { child: 'child', parent: 'root' });
  assert.deepEqual(toLink({ properties: { sessionID: 'child', info: { parentId: 'root' } } }), { child: 'child', parent: 'root' });
  assert.equal(toLink({ properties: { sessionID: 'child', info: {} } }), null);
  assert.equal(toDeleted({ type: 'session.deleted', properties: { sessionID: 's1' } }), 's1');
  assert.equal(toDeleted({ type: 'session.deleted', properties: { info: { id: 's2' } } }), 's2');
  assert.equal(toDeleted({ type: 'message.updated', properties: { sessionID: 's1' } }), null);
});

test('toPermissionReq maps permission actions to runtime requests', () => {
  assert.deepEqual(toPermissionReq({ action: 'edit', resources: ['C:/p/x.ts'] }), { tool: 'write', path: 'C:/p/x.ts' });
  assert.deepEqual(toPermissionReq({ action: 'bash', resources: ['echo hi'] }), { tool: 'shell', command: 'echo hi' });
  assert.deepEqual(toPermissionReq({ action: 'task', resources: ['builder'] }), { tool: 'task', subagent: 'builder' });
  assert.deepEqual(toPermissionReq({ action: 'read', resources: [] }), { tool: 'read' });
});

test('U26 toChatMessage reads chat.message fields only (index.js:16853-16869)', () => {
  const input = { sessionID: 'ses_1' };
  const output = { message: { id: 'msg_1', agent: 'BAZER' }, parts: [{ type: 'text', text: ' hello ' }, { type: 'text', text: '>>approve' }, { type: 'tool', tool: 'x' }] };
  assert.deepEqual(toChatMessage(input, output), { sid: 'ses_1', agent: 'bazer', messageId: 'msg_1', role: '', text: 'hello \n>>approve' });
  assert.equal(toChatMessage({}, output), null);
  assert.equal(toChatMessage(input, { message: { id: 'm', agent: 'buddha', role: 'assistant' }, parts: [{ type: 'text', text: 'x' }] }), null);
  const user = toChatMessage(input, { message: { id: 'm2', agent: 'buddha', role: 'user' }, parts: [{ type: 'text', text: '>>abort' }] });
  assert.equal(user.role, 'user');
  assert.equal(user.text, '>>abort');
  assert.equal(toChatMessage(input, { message: { id: 'm3' }, parts: [{ type: 'tool', tool: 'x' }] }).text, '');
});

test('U98 failed task exposes the error text for task-after', () => {
  const r = toRes({ tool: 'task', status: 'error', id: 'x', input: { subagent_type: 'arena-runner' }, error: { message: 'spawn ENOENT' } });
  assert.equal(r.error, true);
  assert.equal(r.errorText, 'spawn ENOENT');
  assert.equal(r.output, 'spawn ENOENT');
  const s = toRes({ tool: 'task', status: 'error', error: 'plain failure' });
  assert.equal(s.errorText, 'plain failure');
  assert.equal(toRes({ tool: 'task', status: 'completed', result: 'done' }).errorText, undefined);
});

test('field accessors keep the old precedence', () => {
  assert.equal(subagentTarget({ subagent_type: 'A', name: 'B' }), 'a');
  assert.equal(writePath({ filePath: 'one', path: 'two' }), 'one');
  assert.equal(sessionIdOf({ properties: { sessionID: 's' } }), 's');
  assert.equal(sessionIdOf({ sessionID: 'hook', tool: 'task', input: {} }), 'hook');
  assert.equal(agentOf({ properties: { info: { agent: 'Buddha' } } }), 'buddha');
  assert.equal(agentOf({ properties: {} }), '');
  assert.equal(roleOf({ properties: { info: { role: 'USER' } } }), 'user');
  assert.equal(roleOf({ properties: { role: 'assistant' } }), 'assistant');
  assert.equal(roleOf({ properties: {} }), '');
  assert.equal(agentFieldOf({ properties: { info: { agent: 'buddha' } } }), 'info.agent');
  assert.equal(agentFieldOf({ properties: { agent: 'bazer' } }), 'props.agent');
  assert.equal(agentFieldOf({ data: { agent: 'snack' } }), 'data.agent');
  assert.equal(agentFieldOf({ properties: {} }), '');
});
