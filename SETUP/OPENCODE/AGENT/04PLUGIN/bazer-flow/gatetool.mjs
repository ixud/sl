/* bazer-flow gate tool results - Plannotator plan-submit tool (spec `gateTools`). */
import { stringLeaves } from './diag.mjs';

/** Anchored, case-sensitive classification of the tool's first text leaf. */
export function gateToolOutcome(text, error) {
  if (error) return 'error';
  const t = String(text || '');
  if (t.startsWith('Plan approved')) return 'approved';
  if (t.startsWith('YOUR PLAN WAS NOT APPROVED')) return 'feedback';
  return '';
}

/** Unwrap JSON envelopes (host returns {content:[{type:'text',text}]}) then list strings. */
export function toolLeaves(output) {
  let cur = output;
  for (let i = 0; i < 3 && typeof cur === 'string'; i++) {
    const t = cur.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) break;
    try { cur = JSON.parse(t); } catch { break; }
  }
  if (cur && typeof cur === 'object') {
    const parts = Array.isArray(cur) ? cur : Array.isArray(cur.content) ? cur.content : null;
    if (parts) {
      const texts = parts.filter((p) => p && p.type === 'text' && typeof p.text === 'string').map((p) => p.text);
      if (texts.length) return texts;
    }
  }
  return stringLeaves(cur, 5);
}

export const gateToolHead = (leaves) => String((leaves && leaves[0]) || '').slice(0, 160);

/** Anchored classification: only the START of the trimmed output counts
    (or a leading `{"decision":"…"}` object). Never a substring search. */
export function classifyPlanResult(output) {
  if (typeof output !== 'string') return 'pending';
  const text = output.trim();
  if (!text) return 'pending';
  if (/^\{"decision"\s*:\s*"annotated"/i.test(text)) return 'feedback';
  if (/^\{"decision"\s*:\s*"approved"/i.test(text)) return 'approved';
  if (/^\{"decision"\s*:\s*"pending"/i.test(text)) return 'pending';
  if (/^\{"decision"\s*:\s*"denied"/i.test(text)) return 'feedback';
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const decision = parsed && typeof parsed.decision === 'string' ? parsed.decision.toLowerCase() : '';
      if (decision === 'approved') return 'approved';
      if (decision === 'annotated' || decision === 'denied') return 'feedback';
      if (decision === 'pending') return 'pending';
      if (decision === 'error') return 'error';
    } catch { /* not a whole-output object */ }
  }
  if (/^YOUR PLAN WAS NOT APPROVED/i.test(text)) return 'feedback';
  if (/^Plan changes requested/i.test(text)) return 'feedback';
  if (/^Plan approved with notes!/i.test(text)) return 'approved';
  if (/^Plan approved!/i.test(text)) return 'approved';
  if (/^approved:\s*true/i.test(text)) return 'approved';
  if (/^approved:\s*false/i.test(text) && /feedback|changes/i.test(text)) return 'feedback';
  if (/^\[Plannotator\] Failed to open plan review/i.test(text)) return 'error';
  if (/^Error[: ]/.test(text)) return 'error';
  return 'pending';
}

/** Last output line that is exactly one JSON object carrying a string `decision`. */
export function lastGateDecision(output) {
  const lines = String(output == null ? '' : output).split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('{') || !line.endsWith('}')) continue;
    try { const parsed = JSON.parse(line); if (parsed && typeof parsed.decision === 'string') return parsed.decision.toLowerCase(); } catch { /* not this line */ }
  }
  return null;
}
