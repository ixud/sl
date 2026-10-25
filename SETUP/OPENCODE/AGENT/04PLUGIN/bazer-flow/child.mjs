/* bazer-flow child guard + deny hints (spec-driven). */
import { toolLeaves } from './gatetool.mjs';

const TEMP_DIR = '%TEMP%\\bazer\\<task>\\';

/** Replace an engine deny hint for task/write denials; '' = keep the engine hint. */
export function denyHint(flow, phaseId, phase, spec, ask) {
  const who = String(flow).toUpperCase() + ' ' + phaseId + ' ' + phase.name;
  if (ask && ask.t === 'subagent') {
    const names = [phase.expect, ...(phase.also || []), ...((spec.defaults && spec.defaults.helpers) || [])].filter(Boolean);
    return ('STOP. ' + who + ' allows only: ' + names.join(', ') + '. Do not ask the user.').slice(0, 160);
  }
  if (ask && ask.t === 'write') {
    return ('STOP. Project writes are closed in ' + who + '. Use the write/edit tool with a full literal path under ' + TEMP_DIR + '.').slice(0, 160);
  }
  return '';
}

/** tempOnly agents answer at any phase of any flow: temp is their only writable root. */
export function tempOnlyHint(agent) {
  return ('STOP. ' + String(agent || 'this agent') + ' may write only under ' + TEMP_DIR + ' Copy what you need into temp; project writes stay closed.').slice(0, 160);
}

/** true when name is listed in that phase's requires */
export function requiredAgent(phase, name) {
  return !!(phase && (phase.requires || []).some((r) => r.agent === name));
}

/** B1: reset only on real drift (phase gone or changed expect); a version-only
    mismatch keeps phase/round/counters — deserialize fills any new fields. */
export function migrateOf(stored, spec, flow) {
  const f = spec && spec.flows && spec.flows[flow];
  if (!f) return null;
  const from = String((stored && stored.phase) || '');
  const phase = f.phases[from];
  const notice = ('Flow state migrated: ' + (from || '?') + ' -> ' + f.start + '. No action needed.').slice(0, 160);
  if (!phase) return { kind: 'reset', from, to: f.start, notice };
  if (stored.expect !== undefined && String(stored.expect == null ? '' : stored.expect) !== String(phase.expect == null ? '' : phase.expect)) {
    return { kind: 'reset', from, to: f.start, notice };
  }
  if (stored.v === spec.version) return null;
  return { kind: 'keep', from, to: from, notice: '' };
}

/** B2: running or error results are never 'done'. */
export function taskStatus(res) {
  if (res && String(res.status || '') === 'running') return 'running';
  if (res && res.error) return 'error';
  return 'ok';
}

/** B3: one task-after row; head = error text if any, else first text leaf, <=160. */
export function taskAfter(sid, res, name, caller) {
  const err = res && typeof res.errorText === 'string' ? res.errorText : res && typeof res.error === 'string' ? res.error : '';
  const head = String(err || ((toolLeaves(res && res.output) || [])[0]) || '').slice(0, 160);
  return {
    event: 'task-after',
    sid6: String(sid || '').slice(-6),
    caller: String(caller || ''),
    subagent: String(name || ''),
    status: taskStatus(res),
    head,
  };
}
