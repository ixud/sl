/* Spec-driven agent modes for flow-less roots: readOnly | open.
   No agent names live here; names come from spec keys / session meta. */
import { isTempPath, shellWrite, defaultTempRoots } from './paths.mjs';

const MODES = new Set(['readOnly', 'open']);
const hintOf = (agent) => ('STOP. ' + String(agent || 'this agent') + ' is read-only. Tell the user to switch mode for edits.').slice(0, 160);

/** Validate spec.agents and return {agentId: mode}. Missing section = all open. */
export function loadAgentModes(spec) {
  const src = spec && spec.agents;
  if (src === undefined) return {};
  if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('spec: agents must be an object');
  const out = {};
  for (const [id, v] of Object.entries(src)) {
    const mode = v && typeof v === 'object' && !Array.isArray(v) ? v.mode : undefined;
    if (!id || !MODES.has(mode)) throw new Error('spec: agent ' + id + ' mode');
    out[String(id).toLowerCase()] = mode;
  }
  return out;
}

export function modeOf(modes, agent) {
  return (modes && modes[String(agent || '').toLowerCase()]) || 'open';
}

/** Extra verdict for a flow-less request, or null when the mode allows it. */
export function modeVerdict(mode, req, agent, env = {}, tempRoots = defaultTempRoots()) {
  if (mode !== 'readOnly') return null;
  const t = req && req.tool;
  if (t === 'write') {
    if (isTempPath(String((req && req.path) || ''), tempRoots)) return null;
    return { allow: false, hint: hintOf(agent), detail: 'readOnly' };
  }
  if (t === 'shell') {
    const w = shellWrite(String((req && req.command) || ''), env, { cwd: String((req && req.workdir) || '') });
    if (!w.write || w.scope === 'temp') return null;
    return { allow: false, hint: hintOf(agent), detail: 'readOnly' };
  }
  return null;
}
