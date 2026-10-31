// @ts-nocheck
/* bazer-flow - thin hook wiring only. Logic: engine/runtime. Payloads: adapter. Store: store. */
import { Plugin } from '@opencode/plugin';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRuntime, classifyPlanResult } from './runtime.mjs';
import { LADDER_FILE } from './ladder.mjs';
import { toReq, toRes, toChatMessage, toLink, toDeleted, toPermissionReq, toToolEvent, toInboxUser, toAgentEvent, agentOf, agentFieldOf, sessionIdOf, roleOf } from './adapter.mjs';
import { fsStore, ringLog, pruneState, loadSpecFile } from './store.mjs';
import { createDiag, createFlowLog, codeOf, bootEntry, shapeOf, shapeDeep, ctxNames } from './diag.mjs';
import { isTempPath, defaultTempRoots, isGateCliCommand } from './paths.mjs';
import { sharedState, recordHook } from './shared.mjs';
import { runPerm } from './permhook.mjs';
import { credentialPath } from './rules.mjs';
const DIR = path.join(os.homedir(), '.local', 'state', 'opencode', 'bazer-flow', 'v2');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEBUG = process.env.BAZER_FLOW_DEBUG === '1';
const BUILD = '2ad'; const INST = crypto.randomBytes(2).toString('hex');
const CLOSED_HINT = 'STOP. Flow unavailable - project writes are closed. Tell the user to restart OpenCode.';
const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const SPEC_URL = new URL('./flow.spec.json', import.meta.url);
const HOOKS = ['agent.transform', 'tool.execute.before', 'tool.execute.after', 'permission.evaluate', 'session.context', 'event.subscribe'];
const chat = { rt: null, emit: null };
const missSeen = new Set();
const G = sharedState();
const CATALOG = /(\.updated$)|^session\.(text|reasoning|step|usage|execution|tool\.input|tool\.progress)\.|^session\.(renamed|viewed|instructions\.updated|retry\.scheduled|tool\.progress)$|^project\.updated$|^form\./;
const DEEP = new Set(['session.inbox.enqueued', 'session.tool.success', 'session.tool.called', 'session.agent.selected']);
function hookSeen(name) {
  try {
    if (!chat.emit || !recordHook(name)) return;
    chat.emit({ event: 'hook-seen', hook: name, inst: INST });
  } catch { /* diagnostics never break the host */ }
}
function setRules(agent, rules) {
  agent.permissions = Array.isArray(agent.permissions) ? agent.permissions : [];
  for (const rule of rules) {
    agent.permissions = agent.permissions.filter((c) => !(c.action === rule.action && c.resource === rule.resource));
    agent.permissions.push(rule);
  }
}
/** chat.message hook (Plannotator index.js:16853-16869). Applies commands before the hook returns. */
function onChatMessage(input, output) {
  try {
    hookSeen('chat.message');
    const msg = toChatMessage(input, output);
    const shape = !msg || !msg.text ? shapeOf({ input, output }) : '';
    if (!msg) {
      if (chat.emit && !missSeen.has(shape) && missSeen.size < 30) { missSeen.add(shape); chat.emit({ event: 'user-miss', shape }); }
      return;
    }
    if (!chat.emit) return;
    const info = chat.rt ? chat.rt.info(msg.sid) : null;
    const text = msg.text.trim();
    const cmd = text.startsWith('>>') ? text.toLowerCase() : 'plain';
    const res = chat.rt && text ? chat.rt.userChat(msg) : { applied: false, why: text ? 'no-runtime' : 'empty' };
    chat.emit({ event: 'user', cmd, sid6: msg.sid.slice(-6), root6: info && info.root ? info.root.slice(-6) : null, agent: msg.agent, ...(res.applied ? {} : { why: res.why }) });
    if (!text && !missSeen.has(shape) && missSeen.size < 30) { missSeen.add(shape); chat.emit({ event: 'user-miss', shape }); }
  } catch (e) {
    if (chat.emit) chat.emit({ event: 'error', hook: 'chat.message', msg: String((e && e.message) || e).slice(0, 200) });
  }
}
export default Plugin.define({
  id: 'bazer.flow',
  'chat.message': async (input, output) => onChatMessage(input, output),
  async setup(ctx) {
    const store = fsStore(DIR);
    const ring = ringLog(path.join(DIR, 'log.tsv'), 1500);
    let seq = 0;
    const emit = (entry) => { try { ring({ ...entry, seq: ++seq, at: entry && entry.at ? entry.at : Date.now(), inst: INST, pid: process.pid }); } catch { /* never throw */ } };
    const diag = createDiag(emit, 30, DEBUG ? 3 : 0);
    const fail = (hook, sid, err) => {
      emit({ event: 'error', hook, msg: String((err && err.message) || err).slice(0, 200) });
      try { store.badge(sid || '__flow__', 'FLOW ERR'); } catch { /* cosmetic */ }
    };
    const deny = (hint) => Object.assign(new Error('bazer-flow: ' + hint), { bazerDeny: true });
    chat.emit = emit;    try {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(SPEC_URL))).digest('hex').slice(0, 8);
      emit(bootEntry({ build: BUILD, hooks: HOOKS, spec: hash, dir: PLUGIN_DIR, ctx }));
      fs.writeFileSync(path.join(DIR, 'ctx.txt'), ctxNames(ctx).join('\n') + '\n', 'utf8');
    } catch (e) { fail('boot', '', e); }
    pruneState(DIR, WEEK_MS, Date.now());
    let rt = null;
    try {
      rt = createRuntime({ spec: loadSpecFile(SPEC_URL), store, now: () => Date.now(), log: emit, badgeSink: (sid, text) => store.badge(sid, text), ladderPath: LADDER_FILE(os.homedir()) });
    } catch (e) { fail('setup', '', e); }
    chat.rt = rt;
    try { if (ctx.chat && typeof ctx.chat.hook === 'function') await ctx.chat.hook('message', onChatMessage); } catch (e) { fail('chat.register', '', e); }
    const flowLog = createFlowLog(emit, () => rt, G.flow);
    const temps = defaultTempRoots();
    const fallback = (req) => {
      if (req.tool === 'read') return { allow: true, hint: '' };
      if (req.tool === 'write' && isTempPath(req.path, temps)) return { allow: true, hint: '' };
      return { allow: false, hint: CLOSED_HINT };
    };
    const before = (sid, req) => (rt ? rt.before(sid, req) : fallback(req));
    const peek = (sid, req, effect, action, resources, reqAgent) => (rt ? rt.peek(sid, req, effect, action, resources, reqAgent) : fallback(req));
    try {
      await ctx.agent.transform((editor) => {
        const builder = editor.get('builder');
        if (!builder) return;
        editor.update('builder', (draft) => setRules(draft, [
          { action: 'submit_plan', resource: '*', effect: 'deny' },
          { action: 'subagent', resource: '*', effect: 'deny' },
        ]));
      });
      hookSeen('agent.transform');
    } catch (e) { fail('agent.transform', '', e); }
    await ctx.tool.hook('execute.before', (event) => {
      const sid = sessionIdOf(event) || String(event.sessionID || '');
      hookSeen('execute.before');
      try {
        if (DEBUG) diag.sample('execute.before', event);
        const req = toReq(event);
        if (!event || !event.tool) diag.miss('execute.before', event);
        const verdict = before(sid, req);
        if (!verdict.allow) { flowLog.deny('execute.before', sid, req, verdict.detail || codeOf(verdict.hint)); throw deny(verdict.hint); }
      } catch (e) {
        if (e && e.bazerDeny) throw e;
        fail('execute.before', sid, e);
        throw deny('STOP. Flow error - project writes are closed. Tell the user to restart OpenCode.');
      }
    });
    await ctx.tool.hook('execute.after', (event) => {
      const sid = sessionIdOf(event) || String(event.sessionID || '');
      hookSeen('execute.after');
      try {
        if (DEBUG) diag.sample('execute.after', event);
        if (!event || !event.tool) { diag.miss('execute.after', event); return; }
        const res = toRes(event);
        if (res.tool === 'task' || res.tool === 'submit_plan') {
          const i = rt ? rt.info(sid) : null;
          const entry = { event: 'after', sid6: String(sid).slice(-6), root6: i && i.root ? String(i.root).slice(-6) : null, tool: res.tool };
          if (res.subagent) entry.subagent = res.subagent;
          if (res.tool === 'submit_plan') entry.outcome = res.error ? 'error' : classifyPlanResult(res.output);
          entry.raw = String(res.output || '').slice(0, 120);
          emit(entry);
        }
        if (rt) rt.after(sid, res);
      } catch (e) { fail('execute.after', sid, e); }
    });
    const permSeen = (G.perm = G.perm || new Map());
    const skipSeen = (G.skip = G.skip || new Map());
    const onPerm = (event) => {
      const sid = sessionIdOf(event) || String(event.sessionID || '');
      hookSeen('permission.evaluate');
      runPerm(event, {
        sid, toReq: toPermissionReq, peek, emit, deny: flowLog.deny, miss: diag.miss, codeOf, permSeen, skipSeen, credentialPath,
        fail: (e) => fail('permission.evaluate', sid, e),
      });
    };
    await ctx.permission.hook('evaluate', (event) => {
      try { onPerm(event); } catch (e) { if (!G.perr) { G.perr = 1; try { emit({ event: 'perm-err', msg: String((e && e.message) || e).slice(0, 120) }); } catch { /* log never throws */ } } }
    });
    await ctx.session.hook('context', (event) => {
      const sid = sessionIdOf(event) || String(event.sessionID || '');
      hookSeen('session.context');
      try {
        if (!rt) return;
        const text = rt.remind(sid);
        if (text) event.system.push({ type: 'text', text });
      } catch (e) { fail('session.context', sid, e); }
    });
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          try {
            hookSeen('event.subscribe');
            if (DEBUG) diag.sample('event.subscribe', event);
            const type = String((event && event.type) || ''); const deep = DEEP.has(type);
            if (!CATALOG.test(type)) {
              const shape = deep ? shapeDeep(event.data, 4) : shapeOf(event);
              const key = type + '|' + shape;
              if (!G.evt.has(key) && (deep || G.evt.size < 40)) { G.evt.set(key, 1); emit({ event: 'evt-shape', type, shape }); }
            }
            const tool = toToolEvent(event);
            if (tool && rt) {
              if (tool.kind === 'called' && isGateCliCommand(tool.command)) rt.rememberGate(tool.callId);
              else if (tool.kind === 'success') rt.gateEvent(tool.sid, tool.callId, tool.leaves, tool.metadata);
            }
            if (type === 'session.shell.ended' && rt) rt.shellEnded(event.data);
            const inbox = toInboxUser(event); if (inbox && rt) rt.inboxUser(inbox);
            const sel = toAgentEvent(event); if (sel && rt) flowLog.agent(sel.sid, rt.setAgent(sel.sid, sel.agent), sel.agent, 'session.agent.selected');
            const link = toLink(event);
            if (link && rt) rt.linkSession(link.child, link.parent);
            const sid = sessionIdOf(event);
            const agent = agentOf(event);
            const src = agentFieldOf(event);
            if (sid) flowLog.root(sid);
            if (sid && agent && rt) flowLog.agent(sid, rt.setAgent(sid, agent), agent, src);
            if (type === 'session.deleted') {
              const dead = toDeleted(event);
              if (!dead) diag.miss('event.subscribe/deleted', event);
              else if (rt) rt.purge(dead);
            }
            if (type.startsWith('message.') && !roleOf(event)) diag.miss('event.subscribe/message', event);
          } catch (e) { fail('event.subscribe', '', e); }
        }
      } catch { /* aborted */ }
    })();
    return () => controller.abort();
  },
});
