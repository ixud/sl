/* bazer-flow adapter — OpenCode hook payload -> runtime input.
   Field access copied from the pre-refactor index.ts; no payload shapes invented. */

const lower = (v) => String(v == null ? '' : v).trim().toLowerCase();
import { stringLeaves } from './diag.mjs';

export function subagentTarget(input) {
  const a = input || {};
  return lower(a.subagent_type ?? a.subagentType ?? a.agent_type ?? a.agentType ?? a.agent ?? a.subagent ?? a.name ?? '');
}

export function writePath(input) {
  const a = input || {};
  return String(a.filePath ?? a.file_path ?? a.path ?? a.file ?? a.filename ?? a.target ?? '');
}

export function toolOf(event) {
  const t = String((event && event.tool) || '');
  return t === 'subagent' ? 'task' : t;
}

/** tool-call id carried by hook payloads (top-level `id` seen in v2 log shapes) */
export function callIdOf(event) {
  const id = event && event.id;
  return id == null ? '' : String(id);
}

export function sessionIdOf(event) {
  const props = (event && event.properties) || {};
  const info = props.info || (event && event.data && event.data.info) || {};
  const sid = (event && event.sessionID)
    ?? props.sessionID
    ?? (event && event.data && event.data.sessionID)
    ?? (String((event && event.type) || '').startsWith('session.') ? (info.sessionID ?? info.id ?? props.id) : info.sessionID);
  return sid ? String(sid) : '';
}

export function agentOf(event) {
  const props = (event && event.properties) || {};
  const info = props.info || (event && event.data && event.data.info) || {};
  const agent = info.agent ?? props.agent ?? (event && event.data && event.data.agent);
  return agent ? lower(agent) : '';
}

export function roleOf(event) {
  const props = (event && event.properties) || {};
  const info = props.info || (event && event.data && event.data.info) || {};
  return lower(info.role ?? props.role ?? '');
}

/** Which payload field carries the agent id (for the 'agent' log entry). */
export function agentFieldOf(event) {
  const props = (event && event.properties) || {};
  const info = props.info || (event && event.data && event.data.info) || {};
  if (info.agent != null) return 'info.agent';
  if (props.agent != null) return 'props.agent';
  if (event && event.data && event.data.agent != null) return 'data.agent';
  return '';
}

export function toReq(event) {
  const input = (event && event.input) || {};
  const t = toolOf(event);
  const id = callIdOf(event);
  if (t === 'task') return { tool: 'task', subagent: subagentTarget(input), id };
  if (t === 'submit_plan') return { tool: 'submit_plan', id };
  if (t === 'edit' || t === 'write' || t === 'patch' || t === 'multiedit' || t === 'apply_patch') {
    return { tool: 'write', path: writePath(input), id, workdir: String(input.workdir || '') };
  }
  if (t === 'bash' || t === 'shell') return { tool: 'shell', command: String(input.command ?? ''), id, workdir: String(input.workdir || '') };
  return { tool: 'read', id };
}

export function toRes(event) {
  const t = toolOf(event);
  const out = event && event.result;
  const text = typeof out === 'string' ? out : out == null ? '' : JSON.stringify(out);
  const status = String((event && event.status) || '');
  const failed = !!(event && event.error) || (!!status && status !== 'completed' && status !== 'running');
  const errRaw = event && event.error;
  const errText = failed ? (typeof errRaw === 'string' ? errRaw : errRaw && typeof errRaw === 'object' ? String(errRaw.message || errRaw.name || '') : '') : '';
  const res = { tool: t, output: text || errText, error: failed, status, id: callIdOf(event), metadata: (event && event.metadata) || {} };
  if (errText) res.errorText = errText;
  if (t === 'task') res.subagent = subagentTarget((event && event.input) || {});
  return res;
}

/** chat.message hook payload (index.js:16853-16869): input.sessionID, output.message{id,agent}, output.parts[]. */
export function toChatMessage(input, output) {
  const sid = input && input.sessionID != null ? String(input.sessionID) : '';
  if (!sid) return null;
  const message = (output && output.message) || {};
  const role = message.role == null ? '' : lower(message.role);
  if (role && role !== 'user') return null;
  const parts = Array.isArray(output && output.parts) ? output.parts : [];
  const text = parts
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => String(part.text))
    .join('\n')
    .trim();
  return { sid, agent: lower(message.agent || ''), messageId: message.id == null ? '' : String(message.id), role, text };
}

export function toUserMsg(event) {
  const props = (event && event.properties) || {};
  const info = props.info || (event && event.data && event.data.info) || {};
  const role = lower(info.role ?? props.role ?? '');
  if (role !== 'user') return null;
  const sid = sessionIdOf(event);
  if (!sid) return null;
  const lists = [props.parts, info.parts, event && event.data && event.data.parts];
  const out = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const part of list) if (part && part.type === 'text' && part.text) out.push(String(part.text));
  }
  if (!out.length && typeof props.text === 'string') out.push(props.text);
  return { sid, role, text: out.join('\n') };
}

export function toLink(event) {
  const props = (event && event.properties) || {};
  const info = props.info || (event && event.data && event.data.info) || {};
  const sid = sessionIdOf(event);
  const parent = info.parentID ?? info.parentId ?? props.parentID ?? (event && event.data && event.data.parentID);
  if (!sid || !parent) return null;
  return { child: sid, parent: String(parent) };
}

export function toDeleted(event) {
  if (!event || event.type !== 'session.deleted') return null;
  const props = event.properties || {};
  const info = props.info || (event.data && event.data.info) || {};
  const id = props.sessionID ?? props.id ?? (event.data && event.data.sessionID) ?? info.id;
  return id ? String(id) : null;
}

export function toAgentEvent(event) {
  if (!event || event.type !== 'session.agent.selected') return null;
  const d = event.data || {};
  return { sid: String(d.sessionID || ''), agent: lower(d.agent || '') };
}

/** host event envelope {id,created,type,data} */
export function toToolEvent(event) {
  const type = String((event && event.type) || '');
  const d = (event && event.data) || {};
  if (type === 'session.tool.called') return { kind: 'called', sid: String(d.sessionID || ''), callId: String(d.id || ''), command: String((d.input && d.input.command) || ''), workdir: String((d.input && d.input.workdir) || '') };
  if (type === 'session.tool.success') return { kind: 'success', sid: String(d.sessionID || ''), callId: String(d.id || ''), leaves: stringLeaves(d.content, 5), metadata: d.metadata || {} };
  return null;
}

export function toInboxUser(event) {
  if (!event || event.type !== 'session.inbox.enqueued') return null;
  const d = event.data || {};
  const item = d.item || {};
  return { sid: String(d.sessionID || ''), messageId: String(d.inboxID || ''), itemType: String(item.type || ''), delivery: String(item.delivery || ''), payload: item.payload || {}, leaves: stringLeaves(item.payload, 4) };
}

export function toPermissionReq(event) {
  const action = String((event && event.action) || '');
  const resources = Array.isArray(event && event.resources) ? event.resources : [];
  const first = String(resources[0] == null ? '' : resources[0]);
  const keep = resources.slice();
  if (action === 'edit' || action === 'write' || action === 'patch') return { tool: 'write', path: first, resources: keep };
  if (action === 'bash' || action === 'shell') return { tool: 'shell', command: first, resources: keep };
  if (action === 'task' || action === 'subagent') return { tool: 'task', subagent: lower(first) };
  if (action === 'external_directory') return { tool: 'read', resources: keep };
  return { tool: 'read' };
}
