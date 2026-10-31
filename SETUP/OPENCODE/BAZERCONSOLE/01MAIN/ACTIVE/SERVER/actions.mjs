/**
 * actions.mjs — registry ของปุ่มทั้งหมด (R3: ต้องตรงกับ actions.json 1:1)
 * handler ทุกตัวคืนรูปแบบเดียวกัน: { ok, summary, ...payload }
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { makeResolver, PASSIVE_DIR } from './env.mjs';
import { manifest, settings, actions, policies } from './manifest.mjs';
import { computePlan, diffFor } from './plan.mjs';
import { runProbes, verifyProofs } from './probe.mjs';
import { checkLaw } from './law.mjs';
import {
  applyEntries, setPolicy, undoPolicy, setBuiltin, retireOldFlow,
  saveSettings, pstackPreset, readHistory, rollback, readState,
  cleanupPlan, cleanupOld, resetTemplate, writeFullSettings, restoreLockedModels,
  listBackups, restoreBackupFile, writeTextWithBackup, snapshotModels,
  writeLadder, history, stamp,
} from './apply.mjs';
import { appendArrayItem, getAtPath, setAtPath, parseJsonc } from './jsonc.mjs';
const ok = (summary, extra = {}) => ({ ok: true, summary, ...extra });
const bad = (summary, extra = {}) => ({ ok: false, summary, ...extra });
const warn = (summary, extra = {}) => ({ ok: true, warn: true, level: 'warn', summary, ...extra });
const clipText = (s, n) => (String(s ?? '').length > n ? String(s).slice(0, n) : String(s ?? ''));
export function blockerSummary(blockers) {
  const list = Array.isArray(blockers) ? blockers : [];
  if (!list.length) return 'มี blocker 0 รายการ';
  const parts = list.slice(0, 3).map((b) => {
    const s = String(b), at = s.indexOf(': ');
    return `${at < 0 ? s : s.slice(0, at)} (${clipText(at < 0 ? '' : s.slice(at + 2), 30)})`;
  });
  const more = list.length - parts.length;
  return clipText(`มี blocker ${list.length} รายการ: ${parts.join(', ')}${more ? ` +${more}` : ''}`, 160);
}
export function pendingSummary(entries) {
  const list = (Array.isArray(entries) ? entries : []).filter((e) => e && ['missing', 'stale'].includes(e.state));
  if (!list.length) return 'ต้องทำ 0 รายการ';
  const parts = list.slice(0, 3).map((e) => String(e.title || e.id || ''));
  const more = list.length - parts.length;
  return clipText(`ต้องทำ ${list.length} รายการ: ${parts.join(', ')}${more ? ` +${more}` : ''}`, 160);
}

/* probe ที่ "ตก" ได้ตามปกติก่อนติดตั้ง — ใช้แยก "ยังไม่ติดตั้ง" ออกจาก "พังจริง" */
const PREINSTALL_PROBES = new Set(['builtin-hidden', 'permission-level', 'permission-arena-runner', 'permission-arena-judge', 'modes-present']);

function probeVerdict(pr, plan) {
  const pending = plan.summary.missing + plan.summary.stale;
  const fails = pr.results.filter((r) => !r.ok && r.severity === 'fail');
  const onlyPre = fails.length > 0 && fails.every((r) => PREINSTALL_PROBES.has(r.id));
  if (pending > 0 && onlyPre) {
    return { kind: 'warn', summary: `ยังไม่ได้ติดตั้ง ${pending} รายการ — probe ${fails.length} ข้อจะผ่านหลังติดตั้ง` };
  }
  if (pr.ok) return { kind: 'ok', summary: `ผ่าน ${pr.results.filter((r) => r.ok).length}/${pr.results.length}` };
  return { kind: 'err', summary: `ตก ${pr.failed} ข้อ · ${fails.map((r) => r.id).join(', ')}` };
}

const HANDLERS = {
  'law-check': () => {
    const r = checkLaw({ handlerIds: Object.keys(HANDLERS) });
    return r.ok ? ok(`ผ่านทั้ง ${r.rules.length} ข้อ (${r.filesScanned} ไฟล์)`, { law: r }) : bad(`ไม่ผ่าน ${r.failed} ข้อ`, { law: r });
  },

  'plan': (ctx) => {
    const lawR = checkLaw({ handlerIds: Object.keys(HANDLERS) });
    const p = computePlan(ctx.home, { lawResult: lawR });
    return ok(
      `ติดตั้งได้เลย ${p.summary.actionable} · ต้องสั่งเอง ${p.summary.manualOnly} · รอคุณตัดสินใจ ${p.summary.locked} · ปกติ ${p.summary.ok}`,
      { plan: p },
    );
  },

  'self-check': (ctx) => {
    const lawR = checkLaw({ handlerIds: Object.keys(HANDLERS) });
    const p = computePlan(ctx.home, { lawResult: lawR });
    const pr = runProbes(ctx.home, ctx.store);
    const proofs = verifyProofs(ctx.home, pr, ctx.store);
    const pending = p.summary.missing + p.summary.stale;
    const failIds = pr.results.filter((r) => !r.ok && r.severity === 'fail').map((r) => r.id);
    const onlyPre = failIds.length > 0 && failIds.every((id) => PREINSTALL_PROBES.has(id));
    const payload = { law: lawR, plan: p, probes: pr, proofs };

    if (lawR.ok && p.blockers.length === 0 && pr.ok) {
      return ok('ทุกอย่างผ่าน — กฎ ความครบ และ probe', payload);
    }
    if (lawR.ok && p.blockers.length === 0 && pending > 0 && onlyPre) {
      return warn(`ยังไม่ได้ติดตั้ง ${pending} รายการ (กฎผ่าน · probe รอติดตั้ง ${failIds.length} ข้อ)`, payload);
    }
    return bad(clipText(`กฎ ${lawR.ok ? 'ผ่าน' : 'ไม่ผ่าน'} · ${pendingSummary(p.entries)} · probe ตก ${pr.failed}`, 160), payload);
  },

  'probe': (ctx) => {
    const pr = runProbes(ctx.home, ctx.store);
    const plan = computePlan(ctx.home, {});
    const v = probeVerdict(pr, plan);
    const payload = { probes: pr, plan };
    if (v.kind === 'ok') return ok(v.summary, payload);
    if (v.kind === 'warn') return warn(v.summary, payload);
    return bad(v.summary, payload);
  },

  'apply': (ctx, params) => {
    const lawR = checkLaw({ handlerIds: Object.keys(HANDLERS) });
    if (!lawR.ok) return bad('กฎไม่ผ่าน — หยุดก่อนติดตั้ง', { law: lawR });
    const p = computePlan(ctx.home, { lawResult: lawR });
    if (p.blockers.length) return bad(blockerSummary(p.blockers), { plan: p });
    const r = applyEntries(ctx.home, Array.isArray(params?.ids) ? params.ids : null, ctx.store);
    const pr = runProbes(ctx.home, ctx.store);
    const summary = r.errors.length
      ? `ล้มเหลว ${r.errors.length} · เขียน ${r.applied.length}`
      : `เขียน ${r.applied.length} · ข้าม ${r.skipped.length} · probe ${pr.ok ? 'ผ่าน' : `ตก ${pr.failed}`}`;
    return (r.errors.length === 0 ? ok : bad)(summary, { apply: r, probes: pr });
  },

  'policy-set': (ctx, params) => {
    if (!params?.level) return bad('ต้องระบุระดับ');
    const policyId = params?.policy === 'bazer-ladder' ? 'bazer-ladder' : 'buddha-ladder';
    const r = setPolicy(ctx.home, policyId, params.level, ctx.store);
    const lv = policies[policyId].levels.find((l) => String(l.id) === String(params.level));
    const who = policyId === 'bazer-ladder' ? 'BAZER' : 'BUDDHA';
    return ok(`${who} = ${lv.id} ${lv.name} · เขียน ${r.targets} ที่ (config + agent file) · มีผลกับ session ใหม่`, { policy: r, level: lv, policyId });
  },

  'policy-undo': (ctx, params) => {
    const policyId = params?.policy === 'bazer-ladder' ? 'bazer-ladder' : 'buddha-ladder';
    const r = undoPolicy(ctx.home, policyId, ctx.store);
    const who = policyId === 'bazer-ladder' ? 'BAZER' : 'BUDDHA';
    return ok(`${who} ย้อนเป็นระดับ ${r.level} ${r.name} · เขียน ${r.targets} ที่`, { policy: r, policyId });
  },

  'ladder-set': (ctx, params) => {
    const level = Number(params?.level), hours = params?.hours == null ? 8 : Number(params.hours);
    if (![0, 1, 2].includes(level)) return bad('ระดับต้องเป็น 0, 1 หรือ 2');
    if (!Number.isInteger(hours) || hours < 1 || hours > 24) return bad('hours ต้องเป็นจำนวนเต็ม 1–24');
    if (level === 2 && params?.confirm !== 'เหมาเข่ง') {
      return bad('L2 ต้องพิมพ์ "เหมาเข่ง" เพื่อยืนยัน — L2 เปิด: เขียนไฟล์โปรเจกต์หลังผ่าน GATE 2 · build/test/commit · เรียกเว็บ; ยังบล็อก/ถามเสมอ: protected paths · force-push · reset --hard · clean -f · ลบนอก %TEMP% · คำสั่งที่จำแนกไม่ได้');
    }
    try {
      const r = writeLadder(ctx.home, level, hours);
      history({ stamp: stamp(), entry: 'ladder-set', action: 'write', target: r.target, hashBefore: r.hashBefore, hashAfter: r.hashAfter }, ctx.store);
      const when = new Date(r.expires).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
      return ok(`ตั้งบันได L${level} · หมดอายุ ${when}`, { ladder: { level, expires: r.expires, path: r.target } });
    } catch (e) { return bad(e.message); }
  },

  'builtin-toggle': (ctx, params) => {
    const mode = params?.mode === 'on' ? 'on' : 'off';
    const r = setBuiltin(ctx.home, mode, ctx.store);
    return ok(mode === 'off' ? 'ซ่อน Plan/Build แล้ว' : 'คืน Plan/Build แล้ว', { result: r });
  },

  'retire-old-flow': (ctx) => {
    const r = retireOldFlow(ctx.home, undefined, ctx.store);
    return r.changed ? ok('ถอด bazer-flow เก่าออกจาก config แล้ว', { result: r }) : ok(r.note || 'ไม่มีอะไรต้องถอด', { result: r });
  },

  'settings-save': (ctx, params) => {
    const patches = Array.isArray(params?.patches) ? params.patches : [];
    if (!patches.length) return bad('ไม่มีค่าที่เปลี่ยน');
    const r = saveSettings(ctx.home, patches, ctx.store);
    return r.ok ? ok(`บันทึก ${r.results.filter((x) => x.changed).length} ช่อง`, { settings: r }) : bad('มีช่องที่บันทึกไม่ได้', { settings: r });
  },

  'settings-full': (ctx, params) => {
    if (!params?.file) return bad('ต้องระบุไฟล์ (tui / cli)');
    const r = writeFullSettings(ctx.home, params.file, params.content, ctx.store);
    return ok(`เขียนทับ ${r.label} แล้ว (${r.bytes} bytes)`, { full: r });
  },

  'pstack-preset': (ctx, params) => {
    const mode = params?.mode === 'split' ? 'split' : 'uniform';
    const r = pstackPreset(ctx.home, mode, params?.modelA, params?.modelB, ctx.store);
    return r.ok ? ok(`เติม ${r.results.length} role แล้ว`, { settings: r }) : bad('มี role ที่เขียนไม่ได้', { settings: r });
  },

  'history-list': (ctx) => ok('อ่านประวัติแล้ว', { history: readHistory(200, ctx.store) }),

  'rollback': (ctx, params) => {
    if (!params?.stamp) return bad('ต้องระบุ stamp');
    const r = rollback(ctx.home, params.stamp, ctx.store);
    if (r.pruned) return bad(r.summary, { rollback: r });
    return ok(`คืน ${r.restored} · ลบ ${r.deleted}`, { rollback: r });
  },

  'plannotator-locate': (ctx) => {
    const pr = runProbes(ctx.home, ctx.store).results.find((x) => x.id === 'plannotator-locate');
    return pr?.ok ? ok(pr.detail, { locate: pr.extra }) : warn(pr?.detail || 'ไม่พบไฟล์ Plannotator', { locate: pr?.extra });
  },

  'lock-snapshot': (ctx, params) => {
    const mode = String(params?.mode || '');
    const done = snapshotModels(ctx.home, mode ? [mode] : undefined, ctx.store);
    if (!done.length) return warn('ยังไม่มีไฟล์ config ให้ถ่าย snapshot — ติดตั้งชุด MAJOR ก่อน');
    return ok(`ถ่าย snapshot ${done.length} โหมด: ${done.join(', ')}`, { modes: done });
  },

  'lock-restore': (ctx, params) => {
    const mode = params?.mode ? String(params.mode) : undefined;
    const r = restoreLockedModels(ctx.home, mode, ctx.store);
    const label = mode ? `โหมด ${mode}` : 'ทุกโหมด';
    return r.changed.length
      ? ok(`คืนค่า ${label}: ${r.changed.length} ช่อง (${r.changed.join(', ')})`, { run: r })
      : ok(`${label} ตรงกับ snapshot อยู่แล้ว`, { run: r });
  },

  'cleanup-plan': (ctx) => {
    const c = cleanupPlan(ctx.home);
    const total = c.groups.reduce((a, g) => a + g.count, 0);
    return ok(total ? `พบของเก่า ${total} รายการ` : 'ไม่พบของเก่า', { cleanup: c });
  },

  'cleanup-old': (ctx, params) => {
    const groups = Array.isArray(params?.groups) && params.groups.length ? params.groups : undefined;
    const r = cleanupOld(ctx.home, { apply: !!params?.apply, groups }, ctx.store);
    if (!r.apply) return ok(`dry-run: จะย้าย ${r.count} รายการ`, { cleanup: r });
    return ok(`ย้าย ${r.moved.length} รายการไป ${r.quarantine}`, { cleanup: r });
  },

  'reset-template': (ctx, params) => {
    if (!params?.id) return bad('ต้องระบุ id ของ template (เช่น tpl.agents-md)');
    const r = resetTemplate(ctx.home, params.id, ctx.store);
    return ok(`${r.id}: เขียนใหม่จาก template แล้ว (${r.created ? 'สร้างใหม่' : 'ทับของเดิม'})`, { run: r });
  },

  'install-tools': (ctx, params) => {
    const steps = JSON.parse(fs.readFileSync(path.join(PASSIVE_DIR, '02INSTALLER', 'install.json'), 'utf8')).steps;
    // รัน probe ครั้งเดียวแล้วใช้ซ้ำ (ไม่ spawn opencode ต่อ step และตรวจ version จริงผ่าน probe)
    const pr = runProbes(ctx.home, ctx.store);
    const missing = [];
    for (const s of steps) {
      const probeId = s.check?.probe || s.check?.kind;
      let absent = false;
      if (probeId) {
        const r = pr.results.find((x) => x.id === probeId);
        absent = !r?.ok;
      } else if (s.check?.cmd) {
        const r = spawnSync(s.check.cmd, { shell: true, encoding: 'utf8', windowsHide: true });
        absent = r.status !== 0;
      } else {
        absent = true;
      }
      if (absent) missing.push({ id: s.id, label: s.label, cmd: s.install, why: s.why, required: s.required !== false });
    }
    const need = missing.filter((m) => m.required);
    const advisory = missing.filter((m) => !m.required);
    if (!need.length) {
      return ok(advisory.length
        ? `เครื่องมือหลักครบแล้ว (ยังไม่มี: ${advisory.map((a) => a.label).join(', ')} — ไม่บังคับ)`
        : 'เครื่องมือครบแล้ว', { need, advisory, applied: false });
    }
    const withCmd = need.filter((n) => n.cmd);
    if (!params?.apply) return ok('ยังขาด: ' + need.map((n) => n.label).join(', '), { need, advisory, applied: false });
    if (!withCmd.length) return bad('ไม่มีคำสั่งติดตั้งที่ยืนยันได้สำหรับ: ' + need.map((n) => n.label).join(', '), { need, advisory });
    const out = [];
    for (const n of withCmd) {
      const r = spawnSync(n.cmd, { shell: true, encoding: 'utf8', timeout: 600000, windowsHide: true });
      out.push({ tool: n.id, code: r.status, out: (r.stdout || '').slice(-800), err: (r.stderr || '').slice(-800) });
    }
    return ok('สั่งติดตั้งแล้ว (ตรวจซ้ำด้วยปุ่ม ตรวจของจริง)', { results: out, need, advisory });
  },

  'open-target': (ctx, params) => {
    const { resolve } = makeResolver(ctx.home);
    const map = {
      config: '${CONFIG}', skills: '${SKILLS}', major: '${MAJOR}', backups: '${VAR}/backups',
      plugins: '${CONFIG}/plugins', plannotator: '${PLANNOTATOR}',
    };
    const target = resolve(map[params?.which] || '${CONFIG}');
    if (!fs.existsSync(target)) {
      return warn(`ยังไม่มีโฟลเดอร์นี้: ${target}`, { target, opened: false });
    }
    const cmd = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    try { spawn(cmd, [target], { detached: true, stdio: 'ignore' }).unref(); }
    catch (e) { return bad(`เปิดโฟลเดอร์ไม่ได้: ${e.message}`, { target, opened: false }); }
    return ok(`เปิด ${target}`, { target, opened: true });
  },

  /* ---------- ปลั๊กอิน gate: ติดตั้ง/อัปเดต/ลงทะเบียน ---------- */

  'plugin-register': (ctx, params) => {
    // เพิ่ม "./plugins/<name>" ใน plugins[] ของ opencode.jsonc (ไม่แตะรายการอื่น/คอมเมนต์)
    const name = params?.name ? String(params.name) : 'bazer-flow';
    const value = `./plugins/${name.replace(/[\\/]+/g, '')}`;
    const { resolve } = makeResolver(ctx.home);
    const target = resolve('${CONFIG}/opencode.jsonc');
    if (!fs.existsSync(target)) return bad('ยังไม่มี opencode.jsonc — ติดตั้งชุด MAJOR ก่อน');
    const cur = fs.readFileSync(target, 'utf8');
    const arr = getAtPath(cur, ['plugins']) || [];
    if (arr.some((v) => (typeof v === 'object' ? String(v?.package || '') === value : v === value))) {
      return ok(`${value} ลงทะเบียนอยู่แล้ว`, { changed: false, value });
    }
    const next = appendArrayItem(cur, ['plugins'], value);
    const r = writeTextWithBackup(ctx.home, '${CONFIG}/opencode.jsonc', next, { entry: 'plugin.register' });
    return r.changed
      ? ok(`ลงทะเบียน ${value} แล้ว — เปิด OpenCode ใหม่ให้มีผล`, { value })
      : warn(`ไม่ได้เขียนอะไร (ตรวจไฟล์เอง): ${value}`, { value });
  },

  'plugin-list': (ctx) => {
    const r = spawnSync('opencode plugin list', { shell: true, encoding: 'utf8', timeout: 60000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    const text = `${r.stdout || ''}\n${r.stderr || ''}`.trim();
    if (r.status !== 0 && !text) return bad(`เรียก opencode plugin list ไม่ได้ (exit ${r.status})`);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^[-=]+$/.test(l));
    return ok(`ปลั๊กอินที่ OpenCode เห็น: ${lines.length} บรรทัด`, { list: lines, raw: text.slice(0, 4000) });
  },

  'plugin-update': (ctx, params) => {
    const pkg = params?.package ? String(params.package) : '@plannotator/opencode';
    if (!/^[@a-z0-9/._-]+$/i.test(pkg)) return bad('ชื่อแพ็กเกจไม่ถูกต้อง');
    if (!params?.apply) return ok(`dry-run: จะรัน opencode plugin add ${pkg}`, { package: pkg, applied: false });
    const r = spawnSync(`opencode plugin add ${pkg}`, { shell: true, encoding: 'utf8', timeout: 600000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    const out = ((r.stdout || '') + (r.stderr || '')).slice(-1200);
    return r.status === 0
      ? ok(`อัพเดต ${pkg} แล้ว`, { package: pkg, out })
      : bad(`อัพเดต ${pkg} ไม่สำเร็จ (exit ${r.status})`, { package: pkg, out });
  },

  /* ---------- Plannotator: ตั้งค่ากลไกที่ใช้ได้จริงกับรุ่น CLI ---------- */

  'plannotator-config': (ctx, params) => {
    const target = params?.target === 'bazer' ? 'bazer' : 'buddha';
    const WF = ['plan-agent', 'user-managed', 'all-agents', 'manual'];
    const workflow = WF.includes(params?.workflow) ? params.workflow : 'plan-agent';
    const runtime = params?.runtime === 'cli' ? 'cli' : null;
    const { resolve } = makeResolver(ctx.home);
    const file = resolve('${CONFIG}/opencode.jsonc');
    if (!fs.existsSync(file)) return bad('ยังไม่มี opencode.jsonc — ติดตั้งชุด MAJOR ก่อน');
    const cur = fs.readFileSync(file, 'utf8');
    const arr = getAtPath(cur, ['plugins']) || [];
    const idx = arr.findIndex((v) => typeof v === 'object' && String(v?.package || '').startsWith('@plannotator/opencode'));
    if (idx < 0) return bad('ยังไม่มีปลั๊กอิน @plannotator/opencode ใน config — กด "ติดตั้งเครื่องมือที่ขาด" ก่อน');
    const next = arr.map((v, i) => (i === idx
      ? (() => {
        const options = { ...(v.options || {}), workflow, planningAgents: [target] };
        if (runtime) options.runtime = runtime; else delete options.runtime;
        return { ...v, options };
      })()
      : v));
    if (JSON.stringify(next) === JSON.stringify(arr)) return ok('ค่าตรงกับที่ตั้งไว้แล้ว', { target, workflow, runtime });
    const text = setAtPath(cur, ['plugins'], next);
    writeTextWithBackup(ctx.home, '${CONFIG}/opencode.jsonc', text, { entry: 'plannotator.config' });
    return ok(
      `ตั้ง Plannotator: workflow=${workflow} · planningAgents=[${target}]${runtime ? ` · runtime=${runtime}` : ''} — เปิด OpenCode ใหม่`,
      {
        target,
        workflow,
        runtime,
        note: 'การเลือก "อนุมัติแล้วกลับโหมดไหน" เป็นค่าที่เลือกในหน้า review UI (ปลั๊กอินเรียก session.switchAgent ให้) — ไม่ใช่ไฟล์ที่ Console แพตช์ได้',
      },
    );
  },

  /* ---------- backup: ดูรายการ + คืนไฟล์เดียว ---------- */

  'backup-list': (ctx, params) => {
    const rows = listBackups(ctx.store, Number(params?.limit) || 30);
    const total = rows.reduce((a, r) => a + r.count, 0);
    return ok(rows.length ? `${rows.length} รอบ · ${total} ไฟล์` : 'ยังไม่มี backup', { backups: rows });
  },

  'backup-restore': (ctx, params) => {
    if (!params?.stamp || !params?.target) return bad('ต้องระบุ stamp และ target');
    const r = restoreBackupFile(String(params.stamp), String(params.target), ctx.store);
    if (r.pruned) return bad(r.summary, { run: r });
    return ok(`${r.restored ? 'คืน' : 'ลบ'} ${path.basename(r.target)} จากรอบ ${r.from}`, { run: r });
  },
};

export const actionIds = Object.keys(HANDLERS);
export function runAction(id, ctx, params) {
  const fn = HANDLERS[id];
  if (!fn) return bad(`ไม่รู้จัก action: ${id}`);
  const meta = actions.actions.find((a) => a.id === id);
  const mustConfirm = meta?.confirmUnlessParam ? params?.[meta.confirmUnlessParam] === true : true;
  if (meta?.kind === 'write' && meta.confirm === 'popup' && !params?.confirmed && mustConfirm) {
    return { ok: false, needsConfirm: true, risk: meta.risk, summary: 'ต้องยืนยันก่อน' };
  }
  try { return fn(ctx, params || {}); }
  catch (e) { return bad(e.message); }
}

export { settings, manifest };
