/**
 * apply.mjs — เขียนไฟล์จริงแบบมีหลักประกัน
 * ลำดับ: backup → atomic write → อ่านกลับเทียบ hash → history
 * ล้มกลางทาง = หยุด + rollback รอบนั้น
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BACKUP_DIR, HISTORY_FILE, STATE_FILE, VAR_DIR, makeResolver } from './env.mjs';
import { manifest, settings, policies, sha256File, sha256, srcPath, treeFiles, walk } from './manifest.mjs';
import { stateOf, policyLevel as policyLevelOf, policyPermission, ladderPermission } from './plan.mjs';
import { setAtPath, removeArrayItem, getAtPath } from './jsonc.mjs';
import { setFrontmatterPermission } from './frontmatter.mjs';

const now = () => new Date().toISOString();
/** อ่านแบบดิบ — ไม่ตัด BOM (ใช้กับ path ที่จะเขียนกลับ เพื่อคง BOM เดิม) */
const readTextRaw = (p) => fs.readFileSync(p, 'utf8');
const readText = (p) => readTextRaw(p).replace(/^\uFEFF/, '');
const exists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const walkTree = (dir) => walk(dir);

/**
 * ที่เก็บ state / backup / history — ปกติคือ var/ ของ Console
 * ตอนทดสอบใน temp home ให้ส่งที่เก็บชั่วคราวมาแทน (ไม่แตะ state จริง)
 */
export function makeStore(dir) {
  const abs = path.resolve(dir);
  return {
    dir: abs,
    stateFile: path.join(abs, 'state.json'),
    backupDir: path.join(abs, 'backups'),
    historyFile: path.join(abs, 'history.tsv'),
  };
}

const defaultStore = () => ({ dir: VAR_DIR, stateFile: STATE_FILE, backupDir: BACKUP_DIR, historyFile: HISTORY_FILE });

const REAL_HOME = path.resolve(os.homedir());
const homeKey = (p) => { const s = path.resolve(p || REAL_HOME); return process.platform === 'win32' ? s.toLowerCase() : s; };
const underTmp = (p) => { const r = path.relative(path.resolve(os.tmpdir()), path.resolve(p)); return !r.startsWith('..') && !path.isAbsolute(r); };
/** store ของ home นั้น — บ้านจริง/ไม่ระบุ = var/ จริง, home อื่น = <home>/.bazerconsole/var */
export function storeFor(home) { const h = path.resolve(home || REAL_HOME); return homeKey(h) === homeKey(REAL_HOME) ? defaultStore() : makeStore(path.join(h, '.bazerconsole', 'var')); }
/** snapshot ใช้ได้เฉพาะเมื่อ snapshotHome ตรงกับ home ที่ใช้งานและไม่ใช่โฟลเดอร์ทดสอบ */
export const snapshotTrusted = (state, home) => {
  const h = state?.snapshotHome;
  if (!h) return true;
  const cur = path.resolve(home || REAL_HOME);
  if (homeKey(h) !== homeKey(cur)) return false;
  return homeKey(cur) !== homeKey(REAL_HOME) || !underTmp(h);
};
export const trustedSnapshot = (state, home) => (snapshotTrusted(state, home) ? (state?.modelsSnapshot || null) : null);

function ensureStore(store) {
  fs.mkdirSync(store.dir, { recursive: true });
  fs.mkdirSync(store.backupDir, { recursive: true });
}

export function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export function readState(store = defaultStore()) {
  try { return JSON.parse(readText(store.stateFile)); } catch { return { entries: {}, policy: null, locks: {} }; }
}
export function writeState(s, store = defaultStore()) {
  ensureStore(store);
  fs.writeFileSync(store.stateFile, JSON.stringify(s, null, 2), 'utf8');
}

function safeRel(target) {
  // ต้องไม่ชนกัน: ใช้ hash ของพาธเต็มนำหน้า แล้วต่อท้ายด้วยชื่อไฟล์ (อ่านง่าย)
  const h = sha256(Buffer.from(target.toLowerCase(), 'utf8')).slice(0, 12);
  return `${h}_${path.basename(target)}`;
}

const looksBinary = (buf) => buf.includes(0);

export function backupFile(st, target, store = defaultStore()) {
  const existed = exists(target);
  const dst = path.join(store.backupDir, st, 'files', safeRel(target));
  // รอบเดียวอาจเขียนไฟล์เดิมหลายครั้ง (เช่น policy เขียน 3 agent) — ต้องเก็บต้นฉบับไว้ครั้งเดียว
  const had = fs.existsSync(dst);
  const hashBefore = existed ? (had ? sha256File(dst) : sha256File(target)) : null;
  if (existed && !had) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(target, dst);
  }
  return { target, existed, hashBefore };
}

export function record(st, items, store = defaultStore()) {
  ensureStore(store);
  const dir = path.join(store.backupDir, st);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'manifest.json');
  let doc = { stamp: st, at: now(), items: [] };
  if (fs.existsSync(file)) { try { doc = JSON.parse(readText(file)); } catch { /* เขียนใหม่ */ } }
  const seen = new Set(doc.items.map((i) => i.target));
  for (const it of items) if (!seen.has(it.target)) doc.items.push(it);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
  pruneBackups(store);
}

export function history(row, store = defaultStore()) {
  ensureStore(store);
  const line = [row.at || now(), row.stamp, row.entry || '-', row.action || 'write', row.target, row.hashBefore || '-', row.hashAfter || '-', row.result || 'ok'].join('\t');
  fs.appendFileSync(store.historyFile, line + '\n', 'utf8');
}

const ROUND_RE = /^\d{8}-\d{6}-\d{3}$/;
export const PRUNED_MSG = 'รอบสำรองนี้ถูกลบตามนโยบายเก็บ 100 รอบ';

/** เก็บ 100 รอบล่าสุด + รอบที่ lastApply อ้างถึง — เฉพาะโฟลเดอร์ใน store.backupDir ที่ชื่อเป็น stamp */
export function pruneBackups(store = defaultStore(), keep = 100) {
  const root = path.resolve(store.backupDir);
  let names;
  try { names = fs.readdirSync(root); } catch { return []; }
  const rounds = names.filter((n) => ROUND_RE.test(n) && isDir(path.join(root, n))).sort().reverse();
  if (rounds.length <= keep) return [];
  const last = readState(store).lastApply || {};
  const protect = new Set([last.stamp, last.rolledBack?.stamp].filter((s) => s && ROUND_RE.test(s)));
  const drop = rounds.slice(keep).filter((n) => !protect.has(n));
  for (const n of drop) {
    const abs = path.join(root, n);
    if (path.dirname(abs) === root) { try { fs.rmSync(abs, { recursive: true, force: true }); } catch { /* เก็บไว้ถ้าลบไม่ได้ */ } }
  }
  return drop;
}

export function writeTextAtomic(target, text) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.bazer-tmp-${process.pid}`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, target);
  return sha256File(target);
}

/** เขียนหนึ่ง entry — เรียกหลัง stateOf บอกว่า writable (export เพื่อใช้ทดสอบ) */
export function writeEntry(entry, home, st, store = storeFor(home)) {
  const { resolve } = makeResolver(home);
  const target = resolve(entry.target);
  const written = [];
  const push = (t, text) => {
    const b = backupFile(st, t, store);
    const h = writeTextAtomic(t, text);
    record(st, [{ ...b, hashAfter: h }], store);
    written.push({ ...b, hashAfter: h });
    history({ stamp: st, entry: entry.id, action: 'write', target: t, hashBefore: b.hashBefore, hashAfter: h }, store);
  };
  const pushFile = (t, srcAbs) => {
    const b = backupFile(st, t, store);
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.copyFileSync(srcAbs, t);
    const h = sha256File(t);
    record(st, [{ ...b, hashAfter: h }], store);
    written.push({ ...b, hashAfter: h });
    history({ stamp: st, entry: entry.id, action: 'copy', target: t, hashBefore: b.hashBefore, hashAfter: h }, store);
  };

  switch (entry.strategy) {
    case 'overwrite':
    case 'create-only':
    case 'template-once': {
      if (entry.strategy !== 'overwrite' && exists(target)) return { skipped: 'มีอยู่แล้ว (ไม่ทับ)' };
      let text = readText(srcPath(entry));
      // agent ที่ผูกกับบันได: ต้องแนบ permission ของ "ขั้นที่ตั้งอยู่จริง" ลง frontmatter
      // (ถ้าใช้ defaultLevel ตรง ๆ กด apply ทีเดียวขั้นที่ผู้ใช้ตั้งไว้จะหาย)
      if (entry.ladderPolicy && entry.ladderAgent) {
        const st = readState(store);
        const cur = (st.policies || {})[entry.ladderPolicy]?.level
          || (st.policy?.policyId === entry.ladderPolicy ? st.policy.level : null)
          || policies[entry.ladderPolicy]?.defaultLevel;
        text = setFrontmatterPermission(text, ladderPermission(entry.ladderAgent, entry.ladderPolicy, cur));
      }
      push(target, text);
      break;
    }
    case 'jsonc-merge': {
      // readTextRaw: คง BOM เดิมไว้ (setAtPath จัดการ BOM เอง)
      const cur = exists(target) ? readTextRaw(target) : '{\n}\n';
      const desired = entry.fromPolicy ? policyPermission(entry, policyLevelOf(entry.fromPolicy)) : entry.value;
      const next = setAtPath(cur, entry.valuePath.split('.'), desired, { merge: true });
      if (next !== cur) push(target, next);
      break;
    }
    case 'jsonc-remove-array-item': {
      const cur = readTextRaw(target);
      const next = removeArrayItem(cur, entry.valuePath.split('.'), entry.remove);
      if (next !== cur) push(target, next);
      break;
    }
    case 'copy-tree': {
      const wanted = new Set();
      for (const f of treeFiles(entry)) {
        const dst = path.join(target, f.rel);
        wanted.add(path.normalize(dst).toLowerCase());
        const srcHash = sha256File(f.abs);
        if (exists(dst) && sha256File(dst) === srcHash) continue;
        const buf = fs.readFileSync(f.abs);
        // ไฟล์ไบนารี (มี NUL) ห้ามอ่านเป็นข้อความ — จะพัง
        if (looksBinary(buf)) pushFile(dst, f.abs);
        else push(dst, buf.toString('utf8'));
      }
      // prune: ไฟล์ในปลายทางที่ไม่มีในต้นทาง = ซากของรุ่นเก่า → ย้ายเข้า backup (ไม่ลบทิ้ง)
      const pruned = [];
      if (entry.prune && isDir(target)) {
        for (const abs of walkTree(target)) {
          if (wanted.has(path.normalize(abs).toLowerCase())) continue;
          const holder = path.join(store.backupDir, st, 'pruned', safeRel(abs));
          fs.mkdirSync(path.dirname(holder), { recursive: true });
          fs.renameSync(abs, holder);
          pruned.push({ from: abs, to: holder });
          history({ stamp: st, entry: `${entry.id}.prune`, action: 'prune', target: abs, result: 'moved' }, store);
        }
      }
      written.pruned = pruned;
      break;
    }
    case 'line': {
      const cur = exists(target) ? readText(target) : null;
      if (cur === null) throw new Error(`ไม่พบไฟล์ ${target} — ติดตั้ง template ก่อน`);
      const next = setLineText(cur, entry.line, entry.value);
      if (next !== cur) push(target, next);
      break;
    }
    default:
      throw new Error(`strategy "${entry.strategy}" ยังไม่พร้อม`);
  }
  return { written };
}

export function setLineText(text, prefix, value) {
  const lines = text.split(/\r?\n/);
  const want = `${prefix} ${value}`.trimEnd();
  let hit = false;
  const out = lines.map((l) => {
    if (!l.trim().startsWith(prefix)) return l;
    hit = true;
    return want;
  });
  if (!hit) out.push(want);
  return out.join('\n');
}

export function applyEntries(home, ids, store = storeFor(home)) {
  ensureStore(store);
  const st = stamp();
  const state = readState(store);
  const applied = [], skipped = [], errors = [];
  const targets = ids && ids.length ? manifest.entries.filter((e) => ids.includes(e.id)) : manifest.entries;

  for (const entry of targets) {
    if (entry.status === 'design') { skipped.push({ id: entry.id, why: 'status=design' }); continue; }
    if (entry.strategy === 'patch') { skipped.push({ id: entry.id, why: 'strategy patch ยังไม่พร้อม' }); continue; }
    if (!entry.auto && !(ids && ids.includes(entry.id))) { skipped.push({ id: entry.id, why: 'auto=false (ต้องสั่งเอง)' }); continue; }
    if (entry.owner === 'user' && exists((makeResolver(home).resolve(entry.target)))) {
      skipped.push({ id: entry.id, why: 'owner=user (ไม่ทับ)' }); continue;
    }
    let stt;
    try { stt = stateOf(entry, home); } catch (e) { errors.push({ id: entry.id, why: e.message }); continue; }
    if (!stt.writable) { skipped.push({ id: entry.id, why: stt.note || stt.state }); continue; }
    try {
      const r = writeEntry(entry, home, st, store);
      applied.push({ id: entry.id, files: r.written?.length || 0 });
      state.entries[entry.id] = { at: now(), hash: r.written?.[0]?.hashAfter || null };
    } catch (e) {
      errors.push({ id: entry.id, why: e.message });
      break; // หยุดทั้งชุด
    }
  }
  state.lastApply = { at: now(), stamp: st, applied: applied.length, skipped: skipped.length, errors: errors.length, rolledBack: null };
  writeState(state, store);

  // ล้มกลางทาง = หยุดทั้งชุด + คืนไฟล์จาก backup ของรอบนี้ (สัญญาใน README §4)
  let rolledBack = null;
  if (errors.length) {
    try {
      rolledBack = rollback(home, st, store);
      state.lastApply.rolledBack = rolledBack;
      state.lastApply.errorsDetail = errors;
      writeState(state, store);
    } catch (e) {
      rolledBack = { error: e.message };
      state.lastApply.rolledBack = rolledBack;
      writeState(state, store);
    }
  }
  return { stamp: st, applied, skipped, errors, rolledBack, ok: errors.length === 0 };
}

/** เขียนค่า config เดียว (ใช้โดย settings-save / policy-set / toggle) */
export function writeJsonc(home, targetTemplate, keys, value, { merge = false, entry = 'settings', st = stamp(), store = storeFor(home) } = {}) {
  const { resolve } = makeResolver(home);
  const target = resolve(targetTemplate);
  const cur = exists(target) ? readTextRaw(target) : '{\n}\n';
  const next = setAtPath(cur, keys, value, { merge });
  if (next === cur) return { changed: false, target, stamp: st };
  const b = backupFile(st, target, store);
  const h = writeTextAtomic(target, next);
  record(st, [{ ...b, hashAfter: h }], store);
  history({ stamp: st, entry, action: 'write', target, hashBefore: b.hashBefore, hashAfter: h }, store);
  return { changed: true, target, stamp: st, hashAfter: h };
}

/** เขียนข้อความที่เตรียมมาแล้ว (คงรูปเดิมทั้งไฟล์) — backup → atomic → history */
export function writeTextWithBackup(home, targetTemplate, text, { entry = 'raw', st = stamp(), store = storeFor(home) } = {}) {
  const { resolve } = makeResolver(home);
  const target = resolve(targetTemplate);
  const cur = exists(target) ? readTextRaw(target) : null;
  if (cur === text) return { changed: false, target, stamp: st };
  const b = backupFile(st, target, store);
  const h = writeTextAtomic(target, text);
  record(st, [{ ...b, hashAfter: h }], store);
  history({ stamp: st, entry, action: 'write', target, hashBefore: b.hashBefore, hashAfter: h }, store);
  return { changed: true, target, stamp: st, hashAfter: h };
}

/** entry ที่ผูกกับ policy นี้ — บันไดหนึ่งครอบได้หลาย agent */
export function policyEntries(policyId) {
  return manifest.entries.filter((e) => e.fromPolicy === policyId);
}

/** เขียน permission ลง frontmatter ของไฟล์ agent ที่ติดตั้งแล้ว (ถ้ามีไฟล์) */
export function writeAgentPermission(home, agentId, permission, { st = stamp(), store = storeFor(home) } = {}) {
  const { resolve } = makeResolver(home);
  const file = resolve(`\${CONFIG}/agents/${agentId}.md`);
  if (!exists(file)) return { changed: false, id: agentId, note: 'ยังไม่มีไฟล์ agent (ติดตั้งก่อน)' };
  const cur = readTextRaw(file);
  let next;
  try { next = setFrontmatterPermission(cur, permission); }
  catch (e) { return { changed: false, id: agentId, note: e.message }; }
  if (next === cur) return { changed: false, id: agentId };
  const b = backupFile(st, file, store);
  const h = writeTextAtomic(file, next);
  record(st, [{ ...b, hashAfter: h }], store);
  history({ stamp: st, entry: `policy.file.${agentId}`, action: 'write', target: file, hashBefore: b.hashBefore, hashAfter: h }, store);
  return { changed: true, id: agentId, target: file };
}

/** agentId จาก valuePath ของ entry ที่ผูกบันได (agent.buddha.permission → buddha) */
const agentIdOf = (entry) => String(entry.valuePath || '').split('.')[1] || null;

/** เขียนระดับของบันไดลงทุก entry ที่ผูกไว้ — config + frontmatter ของ agent file */
export function setPolicy(home, policyId, levelId, store = storeFor(home)) {
  const level = policyLevelOf(policyId, levelId);
  const entries = policyEntries(policyId);
  if (!entries.length) throw new Error(`ไม่มี entry ที่ผูกกับ policy ${policyId}`);
  const state = readState(store);
  const cur = (state.policies || {})[policyId];
  const prev = cur && cur.level
    ? cur.level
    : String(policies[policyId]?.defaultLevel ?? policyLevelOf(policyId).id);
  const st = stamp();
  const written = [];
  const files = [];
  for (const entry of entries) {
    const permission = policyPermission(entry, level);
    const r = writeJsonc(home, entry.target, entry.valuePath.split('.'), permission, { entry: `policy.${policyId}`, st, store });
    written.push({ id: entry.id, valuePath: entry.valuePath, changed: r.changed, target: r.target });
    // ไฟล์ agent ชนะ config → ต้องเขียนสองที่ด้วยชุดค่าเดียวกัน
    const aid = agentIdOf(entry);
    if (aid) files.push(writeAgentPermission(home, aid, permission, { st, store }));
  }
  state.policies = state.policies || {};
  state.policies[policyId] = { level: String(level.id), at: now(), prev };
  // compat: ให้โค้ดรุ่นเก่า/หน้าเว็บที่อ่าน state.policy ยังเห็นบันได BUDDHA
  if (policyId === 'buddha-ladder') state.policy = { policyId, level: String(level.id), at: now(), prev };
  writeState(state, store);
  return {
    ...written[0],
    changed: written.some((w) => w.changed) || files.some((f) => f.changed),
    level: level.id,
    name: level.name,
    prev,
    written,
    files,
    targets: written.length + files.filter((f) => f.changed).length,
  };
}

export function undoPolicy(home, policyId = 'buddha-ladder', store = storeFor(home)) {
  const state = readState(store);
  const cur = (state.policies || {})[policyId];
  const fallback = policyId === 'buddha-ladder' && state.policy && state.policy.policyId === policyId ? state.policy : null;
  const p = cur && cur.prev ? { policyId, ...cur } : fallback && fallback.prev ? { policyId, ...fallback } : null;
  if (!p) throw new Error('ยังไม่มีการเปลี่ยนระดับให้ย้อน');
  const level = policyLevelOf(p.policyId, p.prev);
  const entries = policyEntries(p.policyId);
  if (!entries.length) throw new Error(`ไม่มี entry ที่ผูกกับ policy ${p.policyId}`);
  const st = stamp();
  const written = [];
  const files = [];
  for (const entry of entries) {
    const permission = policyPermission(entry, level);
    const r = writeJsonc(home, entry.target, entry.valuePath.split('.'), permission, { entry: `policy.${p.policyId}`, st, store });
    written.push({ id: entry.id, valuePath: entry.valuePath, changed: r.changed, target: r.target });
    const aid = agentIdOf(entry);
    if (aid) files.push(writeAgentPermission(home, aid, permission, { st, store }));
  }
  state.policies = state.policies || {};
  state.policies[p.policyId] = { level: String(level.id), at: now(), prev: p.level };
  if (p.policyId === 'buddha-ladder') state.policy = { policyId: p.policyId, level: String(level.id), at: now(), prev: p.level };
  writeState(state, store);
  return {
    ...written[0],
    changed: written.some((w) => w.changed) || files.some((f) => f.changed),
    level: level.id,
    name: level.name,
    written,
    files,
    targets: written.length + files.filter((f) => f.changed).length,
  };
}

export function setBuiltin(home, mode, store = storeFor(home)) {
  const state = mode === 'off'
    ? { plan: { mode: 'subagent', hidden: true }, build: { mode: 'subagent', hidden: true } }
    : { plan: { mode: 'primary', hidden: false }, build: { mode: 'primary', hidden: false } };
  return writeJsonc(home, '${CONFIG}/opencode.jsonc', ['agent'], state, { merge: true, entry: 'builtin-toggle', store });
}

export function retireOldFlow(home, name = 'bazer-flow', store = storeFor(home)) {
  // ไม่ผูกกับ manifest entry แล้ว: การมี entry ที่ "ตั้งใจถอด" ปนกับ entry ที่ "ตั้งใจติดตั้ง"
  // ทำให้ plan รายงาน stale ตลอด (เจตนาตรงข้ามกัน) — ที่นี่สร้างค่าจากชื่อปลั๊กอินตรง ๆ
  const { resolve } = makeResolver(home);
  const target = resolve('${CONFIG}/opencode.jsonc');
  const value = `./plugins/${String(name || 'bazer-flow').replace(/[\\/]+/g, '')}`;
  if (!exists(target)) return { changed: false, note: 'ไม่มี opencode.jsonc' };
  const cur = readTextRaw(target);
  const next = removeArrayItem(cur, ['plugins'], value);
  if (next === cur) return { changed: false, note: `ไม่มี ${value} ค้างอยู่แล้ว` };
  const st = stamp();
  const b = backupFile(st, target, store);
  const h = writeTextAtomic(target, next);
  record(st, [{ ...b, hashAfter: h }], store);
  history({ stamp: st, entry: 'retire-old-flow', action: 'write', target, hashBefore: b.hashBefore, hashAfter: h }, store);
  return { changed: true, target, stamp: st, removed: value };
}

export function rollback(home, st, store = storeFor(home)) {
  const dir = path.join(store.backupDir, st);
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) {
    if (ROUND_RE.test(String(st))) return { stamp: st, restored: 0, deleted: 0, pruned: true, summary: PRUNED_MSG };
    throw new Error(`ไม่พบ backup รอบ ${st}`);
  }
  const doc = JSON.parse(readText(file));
  const out = { stamp: st, restored: 0, deleted: 0 };
  for (const item of doc.items) {
    const bak = path.join(dir, 'files', safeRel(item.target));
    if (item.existed) {
      if (!fs.existsSync(bak)) throw new Error(`backup หาย: ${bak}`);
      fs.mkdirSync(path.dirname(item.target), { recursive: true });
      fs.copyFileSync(bak, item.target);
      out.restored++;
    } else if (fs.existsSync(item.target)) {
      fs.rmSync(item.target, { force: true });
      out.deleted++;
    }
    history({ stamp: st, entry: 'rollback', action: 'restore', target: item.target, result: item.existed ? 'restored' : 'deleted' }, store);
  }
  return out;
}

export function readHistory(limit = 80, store = defaultStore()) {
  if (!fs.existsSync(store.historyFile)) return [];
  const lines = readText(store.historyFile).split(/\r?\n/).filter(Boolean).slice(-limit);
  return lines.map((l) => {
    const [at, st, entry, action, target, hashBefore, hashAfter, result] = l.split('\t');
    return { at, stamp: st, entry, action, target, hashBefore, hashAfter, result };
  }).reverse();
}

/* -------------------- template reset -------------------- */

export function resetTemplate(home, id, store = storeFor(home)) {
  const entry = manifest.entries.find((e) => e.id === id);
  if (!entry) throw new Error(`ไม่พบ entry: ${id}`);
  if (entry.strategy !== 'template-once') throw new Error(`รีเซ็ตได้เฉพาะ template-once (${id} = ${entry.strategy})`);
  const { resolve } = makeResolver(home);
  const target = resolve(entry.target);
  const st = stamp();
  const text = readText(srcPath(entry));
  const b = backupFile(st, target, store);
  const h = writeTextAtomic(target, text);
  record(st, [{ ...b, hashAfter: h }], store);
  history({ stamp: st, entry: `reset.${entry.id}`, action: 'reset', target, hashBefore: b.hashBefore, hashAfter: h }, store);
  return { id: entry.id, target, stamp: st, created: !b.existed };
}

/* -------------------- cleanup (ของเก่า → quarantine) -------------------- */

export function cleanupPlan(home) {
  const { resolve } = makeResolver(home);
  const agentsDir = resolve('${CONFIG}/agents');
  const skillsDir = resolve('${SKILLS}');
  const pluginsDir = resolve('${CONFIG}/plugins');
  const cfgFile = resolve('${CONFIG}/opencode.jsonc');

  const oursAgents = new Set(
    manifest.entries.filter((e) => e.target && /\/agents\//.test(e.target)).map((e) => path.basename(resolve(e.target)).toLowerCase()),
  );
  const pstack = manifest.entries.find((e) => e.id === 'skills.pstack');
  const oursSkills = pstack ? new Set(treeFiles(pstack).map((f) => f.rel.split(/[\\/]/)[0])) : new Set();
  const listDir = (dir) => { try { return fs.readdirSync(dir); } catch { return []; } };
  const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

  const agentItems = listDir(agentsDir)
    .filter((n) => {
      const low = n.toLowerCase();
      const isAgentFile = low.endsWith('.md') || low.endsWith('.md.disabled');
      return isAgentFile && !oursAgents.has(low);
    })
    .map((n) => ({ name: n, abs: path.join(agentsDir, n) }));

  const skillNames = listDir(skillsDir).filter((n) => isDir(path.join(skillsDir, n)));
  const mirrors = skillNames.filter((n) => /^BAZERs-EXTENSION/i.test(n));
  const others = skillNames.filter((n) => !oursSkills.has(n) && !mirrors.includes(n));

  let pluginValues = [];
  if (fs.existsSync(cfgFile)) {
    try {
      const arr = getAtPath(readText(cfgFile), ['plugins']);
      if (Array.isArray(arr)) pluginValues = arr;
    } catch { /* config พัง = ไม่มีอะไรให้ลบ */ }
  }
  const oursPlugins = new Set(manifest.entries.filter((e) => e.kind === 'plugin' && e.status === 'ready').map((e) => path.basename(resolve(e.target))));
  const foreignPlugins = pluginValues.filter((p) => ![...oursPlugins].some((o) => String(p).includes(o)));
  const pluginDirs = listDir(pluginsDir).filter((n) => isDir(path.join(pluginsDir, n)) && !oursPlugins.has(n));

  const groups = [
    { id: 'agents', title: 'agent เก่า (ไม่ใช่ของ MAJOR)', hint: 'ย้ายออกจากโฟลเดอร์ agents — เก็บสำเนาไว้กู้คืนได้', items: agentItems },
    { id: 'mirrors', title: 'mirror เก่า (BAZERs-EXTENSION-*)', hint: 'ดีไซน์ใหม่ไม่ใช้ mirror แล้ว', items: mirrors.map((n) => ({ name: n, abs: path.join(skillsDir, n) })) },
    { id: 'skills-other', title: 'skill อื่นที่ไม่ใช่ PSTACK', hint: 'อาจเป็น skill ที่คุณเขียนเอง — อ่านรายการก่อนเลือก', items: others.map((n) => ({ name: n, abs: path.join(skillsDir, n) })) },
    { id: 'plugins', title: 'ปลั๊กอินใน config ที่ไม่ใช่ของ MAJOR', hint: 'ถอดออกจาก opencode.jsonc', items: foreignPlugins.map((p) => ({ name: String(p), abs: null, value: p })) },
    { id: 'plugin-dirs', title: 'โฟลเดอร์ปลั๊กอินเก่า', hint: 'ย้ายโฟลเดอร์ใน .config/opencode/plugins', items: pluginDirs.map((n) => ({ name: n, abs: path.join(pluginsDir, n) })) },
  ];
  return { at: new Date().toISOString(), groups: groups.map((g) => ({ ...g, count: g.items.length })) };
}

export function cleanupOld(home, { apply = false, groups = ['agents', 'mirrors', 'plugins', 'plugin-dirs'] } = {}, store = storeFor(home)) {
  const plan = cleanupPlan(home);
  const chosen = plan.groups.filter((g) => groups.includes(g.id));
  const items = chosen.flatMap((g) => g.items.map((i) => ({ ...i, group: g.id })));
  if (!apply) return { apply: false, count: items.length, groups: chosen.map((g) => ({ id: g.id, count: g.count })), items: items.map((i) => ({ group: i.group, name: i.name })) };

  const st = stamp();
  let qdir = path.join(store.dir, 'quarantine', st);
  for (let i = 2; fs.existsSync(qdir); i++) qdir = path.join(store.dir, 'quarantine', `${st}-${i}`);
  const moved = [];
  for (const it of items) {
    if (it.group === 'plugins' || !it.abs) continue;
    if (!fs.existsSync(it.abs)) continue;
    const dest = path.join(qdir, it.group, it.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try { fs.renameSync(it.abs, dest); }
    catch { fs.cpSync(it.abs, dest, { recursive: true }); fs.rmSync(it.abs, { recursive: true, force: true }); }
    moved.push({ group: it.group, from: it.abs, to: dest });
    history({ stamp: st, entry: `cleanup.${it.group}`, action: 'quarantine', target: it.abs, result: 'moved' }, store);
  }

  const cfgGroup = chosen.find((g) => g.id === 'plugins');
  if (cfgGroup && cfgGroup.items.length) {
    const { resolve } = makeResolver(home);
    const cfgFile = resolve('${CONFIG}/opencode.jsonc');
    if (fs.existsSync(cfgFile)) {
      const arr = getAtPath(readText(cfgFile), ['plugins']) || [];
      const drop = new Set(cfgGroup.items.map((i) => i.value));
      const keep = arr.filter((p) => !drop.has(p));
      const r = writeJsonc(home, '${CONFIG}/opencode.jsonc', ['plugins'], keep, { entry: 'cleanup.plugins', store });
      moved.push({ group: 'plugins', from: cfgFile, removed: [...drop], changed: r.changed });
    }
  }

  fs.mkdirSync(qdir, { recursive: true });
  fs.writeFileSync(path.join(qdir, 'quarantine.json'), JSON.stringify({ stamp: st, at: now(), moved }, null, 2), 'utf8');
  return { apply: true, stamp: st, quarantine: qdir, count: items.length, moved };
}

/* -------------------- backup: ดูรายการ + คืนไฟล์เดียว -------------------- */

/** รายการ backup ล่าสุด (อ่าน manifest ของแต่ละรอบ) */
export function listBackups(store = defaultStore(), limit = 40) {
  const root = store.backupDir;
  if (!isDir(root)) return [];
  const out = [];
  const names = fs.readdirSync(root).filter((n) => isDir(path.join(root, n))).sort().reverse();
  for (const st of names) {
    const dir = path.join(root, st);
    const mf = path.join(dir, 'manifest.json');
    let doc = { at: null, items: [] };
    if (fs.existsSync(mf)) { try { doc = JSON.parse(readText(mf)); } catch { /* รอบที่ manifest พัง = แสดงเท่าที่อ่านได้ */ } }
    out.push({
      stamp: st,
      at: doc.at || null,
      count: (doc.items || []).length,
      pruned: isDir(path.join(dir, 'pruned')),
      items: (doc.items || []).map((i) => ({ target: i.target, existed: !!i.existed, name: path.basename(String(i.target)) })),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** คืนไฟล์เดียวจาก backup ของรอบที่ระบุ (สำรองของปัจจุบันก่อนเขียนทับ) */
export function restoreBackupFile(stampId, target, store = defaultStore()) {
  const dir = path.join(store.backupDir, stampId);
  const mf = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mf)) {
    if (ROUND_RE.test(String(stampId))) return { stamp: stampId, pruned: true, summary: PRUNED_MSG };
    throw new Error(`ไม่พบ backup รอบ ${stampId}`);
  }
  const doc = JSON.parse(readText(mf));
  const item = (doc.items || []).find((i) => path.resolve(String(i.target)) === path.resolve(String(target)));
  if (!item) throw new Error(`รอบ ${stampId} ไม่มีไฟล์นี้ในรายการ`);
  const bak = path.join(dir, 'files', safeRel(item.target));
  const st = stamp();
  const guard = backupFile(st, item.target, store);   // กันพลาด: สำรองของปัจจุบันก่อน
  if (item.existed) {
    if (!fs.existsSync(bak)) throw new Error(`ไฟล์สำรองหาย: ${bak}`);
    fs.mkdirSync(path.dirname(item.target), { recursive: true });
    fs.copyFileSync(bak, item.target);
  } else if (fs.existsSync(item.target)) {
    fs.rmSync(item.target, { force: true });
  }
  record(st, [{ ...guard, hashAfter: exists(item.target) ? sha256File(item.target) : null }], store);
  history({ stamp: st, entry: 'backup.restore', action: 'restore', target: item.target, result: item.existed ? 'restored' : 'deleted' }, store);
  return { stamp: st, from: stampId, target: item.target, restored: !!item.existed };
}

/* -------------------- full settings (overwrite ทั้งไฟล์) -------------------- */

export function writeFullSettings(home, fileId, content, store = storeFor(home)) {
  const spec = (settings.full?.files || []).find((f) => f.id === fileId);
  if (!spec) throw new Error(`ไม่รู้จักไฟล์ตั้งค่า: ${fileId}`);
  if (typeof content !== 'string' || !content.trim()) throw new Error('เนื้อหาว่าง');
  const text = content.replace(/^\uFEFF/, '');
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { throw new Error(`JSON ไม่ถูกต้อง: ${e.message}`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('ต้องเป็น JSON object');

  const { resolve } = makeResolver(home);
  const target = resolve(spec.target);
  const st = stamp();
  const hadBom = exists(target) && fs.readFileSync(target, 'utf8').charCodeAt(0) === 0xfeff;
  const b = backupFile(st, target, store);
  const out = `${hadBom ? '\uFEFF' : ''}${text.endsWith('\n') ? text : `${text}\n`}`;
  const h = writeTextAtomic(target, out);
  record(st, [{ ...b, hashAfter: h }], store);
  history({ stamp: st, entry: `full.${fileId}`, action: 'overwrite', target, hashBefore: b.hashBefore, hashAfter: h }, store);
  // อ่านกลับและ parse อีกครั้ง — ไฟล์เสีย = คืนทันที
  try { JSON.parse(readText(target)); }
  catch (e) {
    if (b.existed) fs.copyFileSync(path.join(store.backupDir, st, 'files', safeRel(target)), target);
    else fs.rmSync(target, { force: true });
    throw new Error(`เขียนแล้วอ่านกลับไม่ได้ (คืนไฟล์เดิมแล้ว): ${e.message}`);
  }
  return { file: fileId, label: spec.label, target, bytes: Buffer.byteLength(out), stamp: st };
}

/* -------------------- settings -------------------- */

/** บรรทัดรุ่นเก่าที่ต้องลบทิ้งเมื่อบันทึก Arena แบบใหม่ (model#effort) */
const LEGACY_LINES = {
  'arena.runners': ['arena runner efforts:'],
  'arena.judge': ['arena judge efforts:'],
};

function stripLines(text, prefixes) {
  return text
    .split(/\r?\n/)
    .filter((l) => !prefixes.some((p) => l.trim().startsWith(p)))
    .join('\n');
}

export function allControls() {
  const out = [];
  for (const g of settings.groups) for (const c of g.controls) out.push(c);
  for (const r of settings.pstack.roles) out.push({ id: `pstack.${r.id}`, label: r.line, type: 'text', target: settings.pstack.target, strategy: 'line', line: r.line });
  out.push({ id: settings.pstack.budget.id, label: 'budget', type: 'text', target: settings.pstack.target, strategy: 'line', line: settings.pstack.budget.line });
  return out;
}

export function saveSettings(home, patches, store = storeFor(home)) {
  const controls = allControls();
  const results = [];
  const st = stamp();
  for (const patch of patches || []) {
    const c = controls.find((x) => x.id === patch.id);
    if (!c) { results.push({ id: patch.id, ok: false, why: 'ไม่พบ control' }); continue; }
    try {
      if (c.strategy === 'jsonc-set') {
        const value = c.type === 'number' ? Number(patch.value) : patch.value;
        const r = writeJsonc(home, c.target, c.path.split('.'), value, { entry: `settings.${c.id}`, st, store });
        results.push({ id: c.id, ok: true, changed: r.changed });
      } else if (c.strategy === 'line') {
        const { resolve } = makeResolver(home);
        const target = resolve(c.target);
        if (!exists(target)) throw new Error('ยังไม่มีไฟล์ — ติดตั้ง template ก่อน');
        const cur = readText(target);
        let next = setLineText(cur, c.line, patch.value);
        // Arena แบบใหม่เก็บ effort inline (model#effort) → ลบบรรทัด efforts รุ่นเก่า ไม่ให้ขัดกัน
        if (LEGACY_LINES[c.id]) next = stripLines(next, LEGACY_LINES[c.id]);
        if (next !== cur) {
          const b = backupFile(st, target, store);
          const h = writeTextAtomic(target, next);
          record(st, [{ ...b, hashAfter: h }], store);
          history({ stamp: st, entry: `settings.${c.id}`, action: 'write', target, hashBefore: b.hashBefore, hashAfter: h }, store);
        }
        results.push({ id: c.id, ok: true, changed: next !== cur });
      } else if (c.strategy === 'internal') {
        const state = readState(store);
        state.locks = state.locks || {};
        state.locks[c.path] = !!patch.value;
        writeState(state, store);
        results.push({ id: c.id, ok: true, changed: true });
      } else {
        throw new Error(`strategy ${c.strategy} ไม่รองรับ`);
      }
    } catch (e) {
      results.push({ id: c.id, ok: false, why: e.message });
    }
  }
  const out = readState(store);
  // snapshot เฉพาะตอน "เพิ่งเปิด lock" (หรือยังไม่มีเลย) — ถ้าถ่ายทุกครั้งที่บันทึก
  // ค่าที่เพิ่งเปลี่ยนจะกลายเป็น snapshot แล้ว drift จะไม่มีวันตรวจเจอ (lock ตายทั้งฟีเจอร์)
  const turningOn = (patches || []).some((p) => p.id === 'lock.models' && p.value === true);
  const noSnap = !out.modelsSnapshot || Object.keys(out.modelsSnapshot).length === 0;
  if (out.locks?.models && (turningOn || noSnap)) snapshotModels(home, undefined, store);
  return { stamp: st, results, ok: results.every((r) => r.ok) };
}

/** โหมดที่ snapshot/lock ดูแล (เรียงตามแท็บใน Quick Access) */
export const LOCK_MODES = ['buddha', 'bazer', 'snack', 'advisor'];

/**
 * บันทึกค่าปัจจุบันของโมเดล/effort ไว้เทียบ — แยกต่อโหมด
 * @param {string[]} modes ถ้าไม่ส่ง = ทุกโหมด (คงค่า snapshot ของโหมดอื่นไว้ ไม่ล้างทั้งก้อน)
 */
export function snapshotModels(home, modes = LOCK_MODES, store = storeFor(home)) {
  const paths = (Array.isArray(modes) ? modes : [modes]).filter((m) => LOCK_MODES.includes(m));
  const state = readState(store);
  state.modelsSnapshot = state.modelsSnapshot || {};
  const { resolve } = makeResolver(home);
  const file = resolve('${CONFIG}/opencode.jsonc');
  if (!exists(file)) return [];
  const text = readText(file);
  for (const m of paths) {
    state.modelsSnapshot[m] = {
      model: getAtPath(text, ['agent', m, 'model']) ?? null,
      variant: getAtPath(text, ['agent', m, 'variant']) ?? null,
      at: new Date().toISOString(),
    };
  }
  // ผูก snapshot กับ home — กัน Console อีกตัว (หรือ --home sandbox) เอาค่าไปใช้ข้ามเครื่อง
  state.snapshotHome = path.resolve(home || os.homedir());
  writeState(state, store);
  return paths;
}

/**
 * คืนค่า model/effort จาก snapshot — ระบุ mode = คืนเฉพาะโหมดนั้น
 */
export function restoreLockedModels(home, mode, store = storeFor(home)) {
  const state = readState(store);
  const snap = state.modelsSnapshot;
  if (!snap || !Object.keys(snap).length) throw new Error('ยังไม่มี snapshot — กด “ถ่าย snapshot” ของโหมดนั้นก่อน');
  if (!snapshotTrusted(state, home)) throw new Error('snapshot มาจากโฟลเดอร์ทดสอบ - สร้าง snapshot ใหม่');
  if (mode && !LOCK_MODES.includes(mode)) throw new Error(`ไม่รู้จักโหมด: ${mode}`);
  if (mode && !snap[mode]) throw new Error(`โหมด ${mode} ยังไม่มี snapshot — กด “ถ่าย snapshot” ของโหมดนี้ก่อน`);
  const wanted = mode ? [mode] : LOCK_MODES.filter((m) => snap[m]);
  const st = stamp();
  const changed = [];
  const skipped = [];
  for (const m of wanted) {
    const v = snap[m];
    if (!v) continue;
    for (const key of ['model', 'variant']) {
      if (v[key] == null || v[key] === '') { skipped.push(`${m}.${key}`); continue; }
      const r = writeJsonc(home, '${CONFIG}/opencode.jsonc', ['agent', m, key], v[key], { entry: `lock.${m}.${key}`, st, store });
      if (r.changed) changed.push(`${m}.${key}`);
    }
  }
  return { stamp: st, mode: mode || 'all', changed, skipped };
}

export function pstackPreset(home, mode, modelA, modelB, store = storeFor(home)) {
  if (!modelA) throw new Error('ต้องระบุโมเดลอย่างน้อยหนึ่งตัว');
  const coding = new Set(['feature', 'bugfix', 'perf', 'hillclimb', 'how-explorer', 'why-investigators', 'reflect-tooling', 'swarm']);
  const patches = [];
  for (const r of settings.pstack.roles) {
    const model = mode === 'split' ? (coding.has(r.id) ? modelA : (modelB || modelA)) : modelA;
    patches.push({ id: `pstack.${r.id}`, value: model });
  }
  return saveSettings(home, patches, store);
}
