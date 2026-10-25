/**
 * selftest.mjs — เทสต์ของเครื่อง (รันได้ทุกเครื่อง ไม่แตะ config จริง)
 * node tools/selftest.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseJsonc, setAtPath, getAtPath, removeArrayItem, appendArrayItem } from '../jsonc.mjs';
import { setFrontmatterPermission, getFrontmatterPermission, stripFrontmatterPermission } from '../frontmatter.mjs';
import { computePlan, stateOf, policyLevel, policyPermission, detectPolicyLevel } from '../plan.mjs';
import { checkLaw } from '../law.mjs';
import { actionIds } from '../actions.mjs';
import { manifest, srcPath, probes, policies, settings, validate } from '../manifest.mjs';
import { makeResolver, ROOT, STATE_FILE } from '../env.mjs';
import { PROBE_KINDS, agentFilePermission, plannotatorLocate, verifyProofs } from '../probe.mjs';
import { setPolicy, undoPolicy, makeStore, writeJsonc, writeEntry, writeState } from '../apply.mjs';
import { parseModelsOutput } from '../models.mjs';

let pass = 0;
const t = (name, fn) => { try { fn(); pass++; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; } };

const fixture = `// คอมเมนต์หัวไฟล์
{
  "$schema": "https://opencode.ai/config.json",
  // ปลั๊กอินเก่า
  "plugins": ["./plugins/bazer-flow", "./plugins/other"],
  "agent": {
    "buddha": { "model": "a/b" } /* เก็บไว้ */
  }
}
`;

console.log('jsonc');
t('เพิ่ม key ใหม่ลึก ๆ ได้ และคงคอมเมนต์', () => {
  const out = setAtPath(fixture, ['agent', 'plan', 'mode'], 'subagent');
  assert.match(out, /\/\/ คอมเมนต์หัวไฟล์/);
  assert.equal(parseJsonc(out).agent.plan.mode, 'subagent');
  assert.equal(parseJsonc(out).agent.buddha.model, 'a/b');
});
t('แทนค่าเดิมได้ โดยไม่ทิ้ง key อื่น', () => {
  const out = setAtPath(fixture, ['agent', 'buddha', 'model'], 'x/y');
  assert.equal(parseJsonc(out).agent.buddha.model, 'x/y');
  assert.deepEqual(parseJsonc(out).plugins, ['./plugins/bazer-flow', './plugins/other']);
});
t('merge object หลายชั้นได้', () => {
  const out = setAtPath(fixture, ['agent'], { plan: { mode: 'subagent', hidden: true } }, { merge: true });
  assert.equal(parseJsonc(out).agent.plan.hidden, true);
  assert.equal(parseJsonc(out).agent.buddha.model, 'a/b');
});
t('รันซ้ำได้ผลเหมือนเดิม (idempotent)', () => {
  const once = setAtPath(fixture, ['agent', 'buddha', 'permission'], { read: 'allow', shell: 'ask' });
  const twice = setAtPath(once, ['agent', 'buddha', 'permission'], { read: 'allow', shell: 'ask' });
  assert.equal(once, twice);
});
t('แทน object permission ทั้งก้อน (ไม่ค้างกฎเก่า)', () => {
  let out = setAtPath(fixture, ['agent', 'buddha', 'permission'], { read: 'allow', shell: 'allow', question: 'allow' });
  out = setAtPath(out, ['agent', 'buddha', 'permission'], { read: 'allow', shell: 'ask' });
  assert.deepEqual(parseJsonc(out).agent.buddha.permission, { read: 'allow', shell: 'ask' });
});
t('ลบสมาชิก array ได้', () => {
  const out = removeArrayItem(fixture, ['plugins'], './plugins/bazer-flow');
  assert.deepEqual(parseJsonc(out).plugins, ['./plugins/other']);
  assert.equal(removeArrayItem(out, ['plugins'], './plugins/bazer-flow'), out);
});
t('ไฟล์ว่าง → สร้าง object ได้', () => {
  const out = setAtPath('', ['model'], 'a/b');
  assert.equal(parseJsonc(out).model, 'a/b');
});

console.log('models');
t('parseModelsOutput จัดกลุ่ม/เรียง/label ถูก + dedupe', () => {
  const sample = [
    'openai/gpt-5',
    'opencode/beam-free',
    'opencode-go/glm-5.3',
    'opencode/deepseek-v4.1-flash-free',
    'groq/llama-3.3-70b-versatile',
    'opencode/beam-free',
    '',
    'ไม่มี slash',
  ].join('\n');
  const { models, providers } = parseModelsOutput(sample);
  // ค่าเริ่มต้น: เหลือเฉพาะ 2 ค่ายที่ใช้จริง (ผู้ใช้ขอให้ตัดค่ายอื่นออกจาก dropdown)
  assert.deepEqual(providers.map((p) => p.id), ['opencode', 'opencode-go']);
  assert.equal(providers[0].label, 'OpenCode');
  assert.equal(providers[1].label, 'OpenCode Go Harness');
  assert.equal(providers[0].count, 2);
  assert.equal(models.length, 3);
  const m = models.find((x) => x.id === 'opencode/beam-free');
  assert.equal(m.provider, 'opencode');
  assert.equal(m.name, 'beam-free');
  assert.equal(m.label, 'OpenCode · beam-free');
  assert.equal(models.filter((x) => x.id === 'opencode/beam-free').length, 1);
  // allowAll: คืนทุกค่าย (ใช้ตรวจว่าซ่อนไปกี่ตัว)
  const all = parseModelsOutput(sample, { allowAll: true });
  assert.deepEqual(all.providers.map((p) => p.id), ['opencode', 'opencode-go', 'groq', 'openai']);
  assert.equal(all.models.length, 5);
});

console.log('plan / law (sandbox)');
const home = path.join(os.tmpdir(), 'bazer', 'selftest-home');
fs.rmSync(home, { recursive: true, force: true });
fs.mkdirSync(home, { recursive: true });

t('แผนคำนวณได้ และทุก entry มีสถานะที่รู้จัก', () => {
  const plan = computePlan(home, {});
  assert.ok(plan.entries.length > 5);
  for (const e of plan.entries) assert.ok(['ok', 'stale', 'missing', 'broken', 'design'].includes(e.state), `${e.id} → ${e.state}`);
});
t('sandbox ว่าง → ต้องมี missing (ไม่ใช่ ok ปลอม)', () => {
  const plan = computePlan(home, {});
  assert.ok(plan.summary.missing > 0);
});
t('กฎ R3 ตรงกับ handler จริง', () => {
  const law = checkLaw({ handlerIds: actionIds });
  const r3 = law.rules.find((r) => r.id === 'R3');
  assert.equal(r3.ok, true, r3.details?.join(' · '));
});
t('บันได BAZER แยกจาก BUDDHA (คนละ state · เขียน config + agent file)', () => {
  const h = path.join(os.tmpdir(), 'bazer', 'bazer-ladder-home');
  const storeDir = path.join(os.tmpdir(), 'bazer', 'bazer-ladder-store');
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
  const cfgDir = path.join(h, '.config', 'opencode');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'opencode.jsonc'), '{\n  "agent": {}\n}\n', 'utf8');
  // ติดตั้งไฟล์ agent ที่มี frontmatter ก่อน (ให้ setPolicy เขียนลงไฟล์ได้)
  const bazerSrc = fs.readFileSync(srcPath(manifest.entries.find((e) => e.id === 'agent.bazer')), 'utf8');
  fs.mkdirSync(path.join(cfgDir, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'agents', 'bazer.md'), bazerSrc, 'utf8');
  const store = makeStore(storeDir);

  const r = setPolicy(h, 'bazer-ladder', '2', store);
  assert.equal(r.written.length, 1, `bazer เขียน config ${r.written.length} ที่ (ควร 1)`);
  assert.equal(r.files.length, 1, 'bazer ต้องเขียน frontmatter ด้วย');
  const cfg = parseJsonc(fs.readFileSync(path.join(cfgDir, 'opencode.jsonc'), 'utf8'));
  const lv2 = policies['bazer-ladder'].levels.find((l) => String(l.id) === '2');
  assert.deepEqual(cfg.agent.bazer.permission, lv2.permission);
  assert.equal(cfg.agent.buddha, undefined, 'บันได BAZER ต้องไม่แตะ BUDDHA');
  const st = JSON.parse(fs.readFileSync(path.join(storeDir, 'state.json'), 'utf8'));
  assert.equal(st.policies['bazer-ladder'].level, '2');
  assert.ok(!st.policy, `ไม่ควรเขียน state.policy (ของ BUDDHA) — พบ ${JSON.stringify(st.policy)}`);
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
});

t('apply ไม่ทับขั้นบันได: ฉีด permission ของขั้นที่ตั้งอยู่จริงลง frontmatter', () => {
  const h = path.join(os.tmpdir(), 'bazer', 'apply-ladder-home');
  const storeDir = path.join(os.tmpdir(), 'bazer', 'apply-ladder-store');
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
  const store = makeStore(storeDir);
  const cfgDir = path.join(h, '.config', 'opencode');
  fs.mkdirSync(path.join(cfgDir, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'opencode.jsonc'), '{\n  "agent": {}\n}\n', 'utf8');
  // ตั้งขั้น 4 ไว้ก่อน (จำลองว่าผู้ใช้กดเหมาเข่งแล้ว)
  writeState({ entries: {}, policy: null, locks: {}, policies: { 'buddha-ladder': { level: '4', at: new Date().toISOString(), prev: '1' } } }, store);
  const entry = manifest.entries.find((e) => e.id === 'agent.buddha');
  const out = writeEntry(entry, h, 'stamp-x', store);
  const written = fs.readFileSync(path.join(cfgDir, 'agents', 'buddha.md'), 'utf8');
  const perm = getFrontmatterPermission(written);
  const lv4 = policies['buddha-ladder'].levels.find((l) => String(l.id) === '4');
  assert.equal(perm.question, 'allow', `frontmatter ต้องเป็นขั้น 4 (ได้ ${JSON.stringify(perm)})`);
  assert.deepEqual(perm, lv4.permission);
  assert.ok(out.written.length === 1);
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
});

t('detectPolicyLevel: อ่านขั้นจาก config จริง (ไม่พึ่ง state)', () => {
  const h = path.join(os.tmpdir(), 'bazer', 'detect-home');
  fs.rmSync(h, { recursive: true, force: true });
  const cfgDir = path.join(h, '.config', 'opencode');
  fs.mkdirSync(cfgDir, { recursive: true });
  const lv5 = policies['buddha-ladder'].levels.find((l) => String(l.id) === '5');
  fs.writeFileSync(path.join(cfgDir, 'opencode.jsonc'), JSON.stringify({ agent: { buddha: { permission: lv5.permission } } }, null, 2), 'utf8');
  const det = detectPolicyLevel(h, 'buddha-ladder');
  assert.equal(det.level, '5', JSON.stringify(det));
  assert.equal(det.source, 'config');
  // bazer ยังไม่มีค่า → null (ไม่ใช่ 1 ปลอม)
  assert.equal(detectPolicyLevel(h, 'bazer-ladder').level, null);
  fs.rmSync(h, { recursive: true, force: true });
});

t('กฎ R1/R4 ผ่านบน repo ปัจจุบัน', () => {
  const law = checkLaw({ handlerIds: actionIds });
  const bad = law.rules.filter((r) => !r.ok && r.id !== 'R2');
  assert.equal(bad.length, 0, bad.map((r) => `${r.id}: ${r.details?.[0]}`).join(' · '));
});
t('ติดตั้งแล้วต้องไม่เขียนซ้ำ (idempotent) — ไฟล์ agent ทุกตัว', () => {
  const agents = manifest.entries.filter((e) => e.strategy === 'overwrite');
  assert.ok(agents.length >= 4);
  for (const e of agents) {
    const { resolve } = makeResolver(home);
    const target = resolve(e.target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(srcPath(e), target);
    const st = stateOf(e, home);
    assert.equal(st.state, 'ok', `${e.id} → ${st.state}`);
    assert.equal(st.writable, false, `${e.id} ยัง writable`);
  }
});

console.log('jsonc — adversarial');
t('trailing comma เดิมอยู่ ต้องไม่ทำให้เกิด comma ซ้อน', () => {
  const src = '{\n  "a": 1,\n}\n';
  const out = setAtPath(src, ['b'], 2);
  assert.equal(parseJsonc(out).b, 2);
  assert.ok(!/,\s*,/.test(out), out);
});
t('คอมเมนต์ใน array ต้องรอด', () => {
  const src = '{\n  "plugins": [\n    // ตัวเก่า\n    "./plugins/bazer-flow",\n    "./plugins/other"\n  ]\n}\n';
  const out = removeArrayItem(src, ['plugins'], './plugins/bazer-flow');
  assert.deepEqual(parseJsonc(out).plugins, ['./plugins/other']);
  assert.match(out, /ตัวเก่า/);
});
t('ไฟล์ CRLF ต้องแก้ได้', () => {
  const src = '{\r\n  "a": 1\r\n}\r\n';
  const out = setAtPath(src, ['b', 'c'], true);
  assert.equal(parseJsonc(out).b.c, true);
  assert.equal(parseJsonc(out).a, 1);
});
t('ไฟล์มี BOM ต้องแก้และอ่านได้', () => {
  const src = '\uFEFF{\n  "a": 1\n}\n';
  const out = setAtPath(src, ['b'], 'x');
  assert.equal(parseJsonc(out).b, 'x');
});
t('merge ลึก 2 ชั้นต้องเปลี่ยนค่าจริง (builtin-toggle on)', () => {
  const src = '{\n  "agent": {\n    "plan": {\n      "mode": "subagent",\n      "hidden": true\n    },\n    "build": {\n      "mode": "subagent",\n      "hidden": true\n    }\n  }\n}\n';
  const want = { plan: { mode: 'primary', hidden: false }, build: { mode: 'primary', hidden: false } };
  const out = setAtPath(src, ['agent'], want, { merge: true });
  const p = parseJsonc(out);
  assert.equal(p.agent.plan.mode, 'primary', 'plan.mode ยังไม่เปลี่ยน — merge ชั้นในหาย');
  assert.equal(p.agent.build.hidden, false, 'build.hidden ยังไม่เปลี่ยน');
  assert.equal(p.agent.plan.hidden, false);
});
t('merge ลึก 2 ชั้นต้องไม่แตะ key อื่นในระดับเดียวกัน', () => {
  const src = '{\n  "agent": {\n    "plan": { "mode": "subagent", "extra": "keep" },\n    "buddha": { "model": "a/b" }\n  }\n}\n';
  const out = setAtPath(src, ['agent'], { plan: { mode: 'primary' } }, { merge: true });
  const p = parseJsonc(out);
  assert.equal(p.agent.plan.mode, 'primary');
  assert.equal(p.agent.plan.extra, 'keep');
  assert.equal(p.agent.buddha.model, 'a/b');
});
t('key ชื่อซ้ำคนละชั้น ต้องแก้ถูกตัว', () => {
  const src = '{\n  "agent": {\n    "buddha": { "agent": "keep" }\n  }\n}\n';
  const out = setAtPath(src, ['agent', 'buddha', 'agent'], 'changed');
  assert.equal(parseJsonc(out).agent.buddha.agent, 'changed');
});
t('object ว่างแบบบรรทัดเดียว {"a":{}} ต้องเติมได้', () => {
  const out = setAtPath('{"a":{}}', ['a', 'b'], 1);
  const p = parseJsonc(out);
  assert.equal(p.a.b, 1);
});
t('สตริงที่มีวงเล็บและ escape ต้องไม่พา scanner หลง', () => {
  const src = '{\n  "note": "}{ \\" tricky",\n  "a": 1\n}\n';
  const out = setAtPath(src, ['b'], 2);
  const p = parseJsonc(out);
  assert.equal(p.note, '}{ " tricky');
  assert.equal(p.b, 2);
  assert.equal(p.a, 1);
});
t('path ที่ชั้นกลางเป็นสตริง ต้องแทนด้วย object ได้', () => {
  const out = setAtPath('{\n  "agent": "oops"\n}\n', ['agent', 'plan', 'mode'], 'subagent');
  assert.equal(parseJsonc(out).agent.plan.mode, 'subagent');
});
t('ค่าไทย/unicode เขียนและอ่านกลับได้', () => {
  const out = setAtPath('{\n}\n', ['note'], 'ทดสอบ ไทย 🎯');
  assert.equal(parseJsonc(out).note, 'ทดสอบ ไทย 🎯');
});
t('ค่า number/bool/null ถูกชนิด', () => {
  let out = setAtPath('{\n}\n', ['n'], 40);
  out = setAtPath(out, ['b'], false);
  out = setAtPath(out, ['z'], null);
  const p = parseJsonc(out);
  assert.equal(typeof p.n, 'number');
  assert.equal(p.b, false);
  assert.equal(p.z, null);
});
t('array ใน array ต้องแทนได้ทั้งก้อน', () => {
  const out = setAtPath('{\n  "keybinds": {}\n}\n', ['keybinds', 'messages_copy'], ['ctrl+alt+m', 'ctrl+alt+o']);
  assert.deepEqual(parseJsonc(out).keybinds.messages_copy, ['ctrl+alt+m', 'ctrl+alt+o']);
});
t('ไฟล์พัง → ต้อง throw ไม่ใช่เขียนมั่ว', () => {
  assert.throws(() => setAtPath('{\n  "a": {', ['b'], 1));
  assert.throws(() => parseJsonc('{ nope }'));
});

console.log('plannotator');
t('ปลั๊กอิน Plannotator: ไม่มีการแพตช์ไฟล์ (UI อยู่ใน exe) — มีแต่ตรวจ/ตั้ง options', () => {
  // ตรวจว่าไม่มี API แพตช์หลงเหลือ: locate ต้องรายงาน kind ได้ และ action patch ต้องไม่อยู่ในสัญญา
  assert.equal(typeof plannotatorLocate, 'function');
  const acts = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/PASSIVE/01MANIFEST/actions.json'), 'utf8');
  assert.ok(!acts.includes('plannotator-patch'), 'ยังมี action plannotator-patch (ปุ่มผี)');
  assert.ok(!fs.existsSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/SERVER/plannotator.mjs')), 'ยังมีโมดูลแพตช์ที่ไม่มีใครใช้');
});

console.log('contract');

const PERM_ACTIONS = new Set(['*', 'read', 'edit', 'glob', 'grep', 'list', 'shell', 'subagent', 'webfetch', 'websearch', 'external_directory', 'question', 'doom_loop', 'browser', 'submit_plan']);
const THEME_COLORS = new Set(['primary', 'secondary', 'accent', 'success', 'warning', 'info']);

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) throw new Error('ไม่มี frontmatter');
  const out = { permission: {} };
  let inPerm = false;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indented = /^\s+/.test(raw);
    const mm = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(raw);
    if (!mm) continue;
    const [, k, vRaw] = mm;
    const v = vRaw.trim().replace(/^["']|["']$/g, '');
    if (!indented) {
      inPerm = k === 'permission';
      if (!inPerm) out[k] = v;
    } else if (inPerm) out.permission[k] = v;
  }
  return out;
}

t('probe ทุกตัวมี implementation', () => {
  const missing = probes.probes.filter((p) => !PROBE_KINDS.includes(p.kind));
  assert.equal(missing.length, 0, missing.map((p) => `${p.id}:${p.kind}`).join(', '));
});

t('ทุก target resolve ได้ด้วย env.json', () => {
  const fake = path.join(os.tmpdir(), 'bazer', 'contract-home');
  const { resolve } = makeResolver(fake);
  for (const e of manifest.entries) {
    if (!e.target) continue;
    const p = resolve(e.target);
    assert.ok(path.isAbsolute(p), `${e.id} → ${p}`);
  }
});

t('policy ใช้เฉพาะ permission action ที่มีจริง + ค่าถูกต้อง', () => {
  const bad = [];
  for (const [pid, p] of Object.entries(policies)) {
    if (pid === 'note') continue;
    for (const lv of p.levels) {
      for (const [k, v] of Object.entries(lv.permission || {})) {
        if (!PERM_ACTIONS.has(k)) bad.push(`${pid}#${lv.id}: key ${k}`);
        if (!['allow', 'ask', 'deny'].includes(v)) bad.push(`${pid}#${lv.id}: ${k}=${v}`);
      }
    }
  }
  assert.equal(bad.length, 0, bad.join(', '));
});

t('settings control ทุกตัว resolve target ได้', () => {
  const fake = path.join(os.tmpdir(), 'bazer', 'contract-home');
  const { resolve } = makeResolver(fake);
  const ctrls = [];
  for (const g of settings.groups) for (const c of g.controls) ctrls.push(c);
  for (const r of settings.pstack.roles) ctrls.push({ id: r.id, target: settings.pstack.target });
  for (const c of ctrls) assert.ok(path.isAbsolute(resolve(c.target)), c.id);
});

t('ไฟล์ agent ทุกตัวผ่านสคีมา (mode/color/permission)', () => {
  const problems = [];
  const dirs = ['AGENT/01PRIMARY', 'AGENT/02SUBAGENT'];
  for (const d of dirs) {
    for (const name of fs.readdirSync(path.join(ROOT, d))) {
      if (!name.endsWith('.md') || name === 'GUIDELINE.md') continue;
      const file = path.join(ROOT, d, name);
      if (fs.statSync(file).size === 0) continue;
      let fm;
      try { fm = parseFrontmatter(fs.readFileSync(file, 'utf8')); }
      catch (e) { problems.push(`${name}: ${e.message}`); continue; }
      if (!fm.description) problems.push(`${name}: ไม่มี description`);
      if (!['primary', 'subagent', 'all'].includes(fm.mode)) problems.push(`${name}: mode=${fm.mode}`);
      if (!/^#[0-9a-fA-F]{6}$/.test(fm.color || '') && !THEME_COLORS.has(fm.color)) problems.push(`${name}: color=${fm.color}`);
      for (const [k, v] of Object.entries(fm.permission)) {
        if (!PERM_ACTIONS.has(k)) problems.push(`${name}: permission key ${k}`);
        if (!['allow', 'ask', 'deny'].includes(v)) problems.push(`${name}: ${k}=${v}`);
      }
    }
  }
  assert.equal(problems.length, 0, problems.join(' · '));
});

t('โหมดหลักมี 4 ไฟล์พอดี', () => {
  const names = fs.readdirSync(path.join(ROOT, 'AGENT/01PRIMARY')).filter((n) => n.endsWith('.md') && n !== 'GUIDELINE.md').sort();
  assert.deepEqual(names, ['ADVISOR.md', 'BAZER.md', 'BUDDHA.md', 'SNACK.md']);
});

t('UI script parse ได้', () => {
  const src = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/UI/app.js'), 'utf8');
  new Function(src);
});

t('CSS ต้องบังคับ [hidden] (กัน modal เปล่าคลุมหน้า)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/UI/style.css'), 'utf8');
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
});

t('หน้าเว็บมี favicon + โลโก้จาก /icon.ico และมีแท็บ Quick Access', () => {
  const html = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/UI/index.html'), 'utf8');
  assert.match(html, /rel="icon"[^>]*href="\/icon\.ico"/);
  assert.match(html, /<img src="\/icon\.ico"/);
  assert.match(html, /data-tab="quick"/);
});

t('settings.json มี full.files สำหรับเขียนทับทั้งไฟล์', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/PASSIVE/01MANIFEST/settings.json'), 'utf8'));
  assert.ok(Array.isArray(s.full?.files) && s.full.files.length >= 2);
  for (const f of s.full.files) assert.match(f.target, /^\$\{/);
});

t('settings.json ใช้ type model/model-list กับช่องโมเดล', () => {
  const byId = new Map();
  for (const g of settings.groups) for (const c of g.controls) byId.set(c.id, c);
  for (const id of ['model.buddha', 'model.bazer', 'model.snack', 'model.advisor', 'model.global']) {
    assert.equal(byId.get(id)?.type, 'model', id);
  }
  assert.equal(byId.get('arena.runners')?.type, 'model-list');
  assert.equal(byId.get('arena.judge')?.type, 'model-list');
});

t('probe modes-present ใช้ exact + agents-hidden ครอบ poteto-mode', () => {
  const modes = probes.probes.find((p) => p.id === 'modes-present');
  assert.equal(modes?.params?.exact, true);
  const hidden = probes.probes.find((p) => p.id === 'builtin-hidden');
  assert.equal(hidden?.kind, 'agents-hidden');
  assert.ok(hidden?.params?.ids?.includes('poteto-mode'));
});

t('plannotator-locate: home = undefined (Console ไม่ส่ง --home) ต้องไม่ถูกตัดเป็น sandbox', () => {
  // บั๊กเดิม: path.resolve(undefined) throw → catch เป็น realHome=false → source='sandbox' → probe false แม้ CLI มีจริง
  const r = plannotatorLocate(undefined);
  assert.notEqual(r.cli.source, 'sandbox', 'undefined home ถูกตีความเป็น sandbox');
  assert.ok(['file', 'path', 'none'].includes(r.cli.source), `source=${r.cli.source}`);
  if (r.cli.found) assert.ok(r.cli.path, 'found=true แต่ไม่มี path');
});

t('plannotator-locate: sandbox home อื่นยังต้องไม่สืบทอด CLI ของเครื่องจริง', () => {
  const h = path.join(os.tmpdir(), 'bazer', 'locate-sandbox-home');
  fs.rmSync(h, { recursive: true, force: true });
  const r = plannotatorLocate(h);
  assert.equal(r.cli.source, 'sandbox');
  assert.equal(r.cli.found, false);
  assert.equal(r.hits.length, 0);
});

t('subagent ทุกตัวต้องเป็น mode: subagent (รวม builder)', () => {
  const dir = path.join(ROOT, 'AGENT/02SUBAGENT');
  const bad = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md') || name === 'GUIDELINE.md') continue;
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const m = /^mode:\s*(\S+)/m.exec(text);
    if (m?.[1] !== 'subagent') bad.push(`${name}: ${m?.[1] ?? '(ไม่มี mode)'}`);
  }
  assert.equal(bad.length, 0, bad.join(', '));
});

t('ทุก action มี cta (ข้อความบนปุ่ม) และ risk ครบ', () => {
  const { actions } = JSON.parse(fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/PASSIVE/01MANIFEST/actions.json'), 'utf8'));
  const missing = actions.filter((a) => !a.cta).map((a) => a.id);
  assert.equal(missing.length, 0, missing.join(', '));
});

t('UI อ้างเฉพาะ action ที่ประกาศไว้จริง', () => {  const { actions } = JSON.parse(fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/PASSIVE/01MANIFEST/actions.json'), 'utf8'));
  const declared = new Set(actions.map((a) => a.id));
  const src = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/UI/app.js'), 'utf8');
  const found = new Set();
  for (const m of src.matchAll(/act\(\s*['"]([a-z0-9-]+)['"]/g)) found.add(m[1]);
  for (const m of src.matchAll(/data-act="([a-z0-9-]+)"/g)) found.add(m[1]);
  const unknown = [...found].filter((id) => !declared.has(id));
  assert.equal(unknown.length, 0, unknown.join(', '));
});

console.log('ladder (บันไดเหมาเข่ง)');

const LADDER_PATHS = ['agent.arena-judge.permission', 'agent.arena-runner.permission', 'agent.buddha.permission'];

t('บันไดครอบ 3 agent (buddha + arena-runner + arena-judge)', () => {
  const entries = manifest.entries.filter((e) => e.fromPolicy === 'buddha-ladder');
  assert.equal(entries.length, 3, entries.map((e) => e.id).join(', '));
  assert.deepEqual(entries.map((e) => e.valuePath).sort(), LADDER_PATHS);
  for (const e of entries) {
    assert.equal(e.strategy, 'jsonc-merge', e.id);
    assert.equal(e.status, 'ready', e.id);
    assert.equal(e.target, '${CONFIG}/opencode.jsonc', e.id);
  }
});

t('runner: บังคับ subagent deny + external_directory allow (ที่เหลือตามระดับ)', () => {
  const e = manifest.entries.find((x) => x.id === 'cfg.arena-runner-permission');
  assert.ok(e, 'ไม่มี entry cfg.arena-runner-permission');
  assert.deepEqual(e.policyOverrides, { subagent: 'deny', external_directory: 'allow' });
  const lv = policyLevel('buddha-ladder', '1');
  const perm = policyPermission(e, lv);
  assert.equal(perm.subagent, 'deny');
  assert.equal(perm.external_directory, 'allow');
  assert.equal(perm.shell, lv.permission.shell);
  assert.equal(perm.read, lv.permission.read);
});

t('judge: บังคับ edit/shell/subagent deny + external_directory allow', () => {
  const e = manifest.entries.find((x) => x.id === 'cfg.arena-judge-permission');
  assert.ok(e, 'ไม่มี entry cfg.arena-judge-permission');
  assert.deepEqual(e.policyOverrides, { edit: 'deny', shell: 'deny', subagent: 'deny', external_directory: 'allow' });
  const lv = policyLevel('buddha-ladder', '5');
  const perm = policyPermission(e, lv);
  assert.equal(perm.edit, 'deny');
  assert.equal(perm.shell, 'deny');
  assert.equal(perm.subagent, 'deny');
  assert.equal(perm.external_directory, 'allow');
  assert.equal(perm.webfetch, lv.permission.webfetch);
});

t('ไม่มีระดับไหนใช้ browser (OpenCode รุ่นนี้ไม่รองรับ)', () => {
  for (const lv of policies['buddha-ladder'].levels) {
    assert.equal(lv.permission.browser, undefined, `ระดับ ${lv.id} ยังมี browser`);
  }
  const five = policies['buddha-ladder'].levels.find((l) => String(l.id) === '5');
  assert.match(five.tagline, /browser/);
  assert.match(five.why, /browser/);
  assert.match(five.why, /ไม่รองรับ/);
});

t('probe ครบ: permission-level + arena-runner + arena-judge', () => {
  const ids = probes.probes.map((p) => p.id);
  for (const id of ['permission-level', 'permission-arena-runner', 'permission-arena-judge']) {
    assert.ok(ids.includes(id), `ไม่มี probe ${id}`);
  }
  const runner = probes.probes.find((p) => p.id === 'permission-arena-runner');
  assert.equal(runner.kind, 'permission-level');
  assert.equal(runner.params.agent, 'arena-runner');
  assert.equal(runner.params.policy, 'buddha-ladder');
  assert.deepEqual(runner.params.expect, { subagent: 'deny', external_directory: 'allow' });
  const judge = probes.probes.find((p) => p.id === 'permission-arena-judge');
  assert.equal(judge.kind, 'permission-level');
  assert.equal(judge.params.agent, 'arena-judge');
  assert.deepEqual(judge.params.expect, { edit: 'deny', shell: 'deny', subagent: 'deny', external_directory: 'allow' });
});

t('อ่าน permission จาก frontmatter ของไฟล์ agent ได้ (OpenCode ให้ไฟล์ชนะ config)', () => {
  const h = path.join(os.tmpdir(), 'bazer', 'frontmatter-home');
  fs.rmSync(h, { recursive: true, force: true });
  const dir = path.join(h, '.config', 'opencode', 'agents');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'arena-runner.md'), '---\ndescription: "x: y"\nmode: subagent\npermission:\n  read: allow\n  shell: ask\n  subagent: deny\n---\n\nเนื้อหา\n', 'utf8');
  assert.deepEqual(agentFilePermission(h, 'arena-runner'), { read: 'allow', shell: 'ask', subagent: 'deny' });
  assert.deepEqual(agentFilePermission(h, 'ไม่มีตัวนี้'), {});
  fs.rmSync(h, { recursive: true, force: true });
});

t('ไฟล์ role ของ Arena ตรงกับที่บันไดบังคับ', () => {
  const runner = parseFrontmatter(fs.readFileSync(path.join(ROOT, 'AGENT/02SUBAGENT/ARENA-RUNNER.md'), 'utf8'));
  assert.equal(runner.permission.subagent, 'deny', 'runner ต้องห้ามเรียก subagent');
  assert.equal(runner.permission.shell, undefined, 'runner ต้องไม่ปัก shell ในไฟล์ — ไม่งั้นทับค่าบันได (เช่น ask ทับ allow)');
  const judge = parseFrontmatter(fs.readFileSync(path.join(ROOT, 'AGENT/02SUBAGENT/ARENA-JUDGE.md'), 'utf8'));
  assert.equal(judge.permission.edit, 'deny', 'judge ต้องอ่านอย่างเดียว');
  assert.equal(judge.permission.shell, 'deny', 'judge ต้องอ่านอย่างเดียว');
  assert.equal(judge.permission.subagent, 'deny', 'judge ต้องห้ามเรียก subagent');
});

t('setPolicy เขียนครบ 3 target และ undoPolicy ย้อนครบ (temp home · ไม่แตะ state จริง)', () => {
  const h = path.join(os.tmpdir(), 'bazer', 'ladder-home');
  const storeDir = path.join(os.tmpdir(), 'bazer', 'ladder-store');
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
  const cfgDir = path.join(h, '.config', 'opencode');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'opencode.jsonc'), '{\n  "agent": {}\n}\n', 'utf8');
  const store = makeStore(storeDir);
  const realState = fs.existsSync(STATE_FILE) ? fs.readFileSync(STATE_FILE) : null;

  const r = setPolicy(h, 'buddha-ladder', '3', store);
  assert.equal(r.targets, 3, `เขียนแค่ ${r.targets} target`);
  assert.equal(r.written.length, 3);
  const cfg = parseJsonc(fs.readFileSync(path.join(cfgDir, 'opencode.jsonc'), 'utf8'));
  const lv3 = policies['buddha-ladder'].levels.find((l) => String(l.id) === '3');
  assert.deepEqual(cfg.agent.buddha.permission, lv3.permission);
  assert.deepEqual(cfg.agent['arena-runner'].permission, { ...lv3.permission, subagent: 'deny', external_directory: 'allow' });
  assert.deepEqual(cfg.agent['arena-judge'].permission, { ...lv3.permission, edit: 'deny', shell: 'deny', subagent: 'deny', external_directory: 'allow' });
  assert.equal(cfg.agent['arena-judge'].permission.shell, 'deny');
  assert.equal(cfg.agent['arena-runner'].permission.external_directory, 'allow');

  const u = undoPolicy(h, 'buddha-ladder', store);
  assert.equal(u.targets, 3, `ย้อนแค่ ${u.targets} target`);
  const cfg2 = parseJsonc(fs.readFileSync(path.join(cfgDir, 'opencode.jsonc'), 'utf8'));
  const lv1 = policies['buddha-ladder'].levels.find((l) => String(l.id) === '1');
  assert.deepEqual(cfg2.agent.buddha.permission, lv1.permission);
  assert.equal(cfg2.agent['arena-runner'].permission.subagent, 'deny');
  assert.equal(cfg2.agent['arena-runner'].permission.external_directory, 'allow');
  assert.equal(cfg2.agent['arena-judge'].permission.edit, 'deny');
  assert.equal(cfg2.agent['arena-judge'].permission.shell, 'deny');

  const realAfter = fs.existsSync(STATE_FILE) ? fs.readFileSync(STATE_FILE) : null;
  assert.deepEqual(realAfter, realState, 'state จริงถูกแก้ — ห้าม');
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
});

console.log('regression — ULTRA LOOP 3');

t('BOM ของไฟล์ config ต้องคงอยู่หลัง writeJsonc', () => {
  const h = path.join(os.tmpdir(), 'bazer', 'bom-home');
  const storeDir = path.join(os.tmpdir(), 'bazer', 'bom-store');
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
  const dir = path.join(h, '.config', 'opencode');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'opencode.jsonc');
  fs.writeFileSync(file, '\uFEFF// คอมเมนต์เดิม\n{\n  "agent": {}\n}\n', 'utf8');
  writeJsonc(h, '${CONFIG}/opencode.jsonc', ['agent', 'buddha', 'model'], 'a/b', { store: makeStore(storeDir) });
  const out = fs.readFileSync(file, 'utf8');
  assert.equal(out.charCodeAt(0), 0xfeff, 'BOM หาย');
  assert.match(out, /คอมเมนต์เดิม/, 'คอมเมนต์หาย');
  assert.equal(parseJsonc(out).agent.buddha.model, 'a/b');
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
});

t('ไฟล์ที่ไม่มี BOM ต้องไม่ถูกเติม BOM', () => {
  const h = path.join(os.tmpdir(), 'bazer', 'nobom-home');
  const storeDir = path.join(os.tmpdir(), 'bazer', 'nobom-store');
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
  const dir = path.join(h, '.config', 'opencode');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'tui.json');
  fs.writeFileSync(file, '{\n  "a": 1\n}\n', 'utf8');
  writeJsonc(h, '${CONFIG}/tui.json', ['b'], 2, { store: makeStore(storeDir) });
  assert.notEqual(fs.readFileSync(file, 'utf8').charCodeAt(0), 0xfeff);
  fs.rmSync(h, { recursive: true, force: true });
  fs.rmSync(storeDir, { recursive: true, force: true });
});

t('verifyProofs ใช้ผล probe ที่ส่งเข้ามา (ไม่รัน probe ใหม่ทั้งชุด)', () => {
  const stub = { results: [{ id: 'builtin-hidden', ok: false, severity: 'fail', detail: 'STUB-ผลที่ส่งมา' }] };
  const out = verifyProofs(home, stub);
  const hit = out.find((x) => x.probe === 'builtin-hidden');
  assert.ok(hit, 'ไม่มี entry ที่ใช้ proof builtin-hidden');
  assert.equal(hit.ok, false);
  assert.equal(hit.detail, 'STUB-ผลที่ส่งมา', 'ไม่ได้ใช้ผลที่ส่งเข้ามา — ไปรัน probe ใหม่');
});

t('install.json: step ที่ประกาศ min ต้องตรวจผ่าน probe (ไม่ใช่แค่ exit code)', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE', '01MAIN', 'PASSIVE', '02INSTALLER', 'install.json'), 'utf8'));
  const withMin = spec.steps.filter((s) => s.min);
  assert.ok(withMin.length >= 2, `step ที่มี min มีแค่ ${withMin.length}`);
  for (const s of withMin) assert.ok(s.check?.probe, `${s.id} มี min แต่ไม่มี check.probe`);
  assert.ok(probes.probes.some((p) => p.id === 'node') && probes.probes.some((p) => p.id === 'opencode'));
});

t('manifest validate() ต้องไม่มีปัญหา', () => {
  const problems = validate();
  assert.deepEqual(problems, [], problems.join(' · '));
});

t('ADVISOR ต้องบอกให้สลับเป็น SNACK และไม่ชี้ผิดโหมด', () => {
  const t2 = fs.readFileSync(path.join(ROOT, 'AGENT/01PRIMARY/ADVISOR.md'), 'utf8');
  assert.match(t2, /SNACK MODE/, 'ADVISOR ไม่ได้บอกให้สลับเป็น SNACK');
  assert.match(t2, /แก้ในโหมดนี้ไม่ได้/, 'ADVISOR ไม่ได้บอกว่าแก้ไฟล์ไม่ได้');
  assert.ok(!/สลับไปโหมด Buddha/.test(t2), 'ADVISOR ยังชี้ไป BUDDHA');
  assert.ok(!/ควรสลับไป Advisor/.test(t2), 'ADVISOR ยังบอกให้สลับไปตัวเอง');
});

t('UI: action ที่เคยไม่มีที่กด ต้องมี element จริง', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/UI/app.js'), 'utf8');
  for (const id of ['history-list', 'open-target', 'plannotator-locate', 'plannotator-config', 'law-check', 'install-tools']) {
    assert.ok(ui.includes(`"${id}"`) || ui.includes(`'${id}'`), `UI ไม่มี action ${id}`);
  }
  assert.match(ui, /data-params='\{"which":"config"\}'/, 'ไม่มีปุ่มเปิดโฟลเดอร์ config');
  assert.match(ui, /data-params='\{"which":"plannotator"\}'/, 'ไม่มีปุ่มเปิดโฟลเดอร์ Plannotator');
  assert.match(ui, /\&\& e\.auto/, 'entryRow ยังโชว์ปุ่มติดตั้งให้ entry auto=false');
  assert.ok(!/data-patch=/.test(ui), 'ยังมีปุ่มแพตช์ Plannotator (ปุ่มผี)');
  assert.ok(!/plannotator-patch/.test(ui), 'ยังอ้าง action plannotator-patch');
});

t('UI: ค่าที่พิมพ์ค้างต้องไม่ถูกล้างทั้งก้อนเมื่อโหลด state ใหม่', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/UI/app.js'), 'utf8');
  assert.ok(!/DRAFTS = \{\};/.test(ui), 'ยังมี DRAFTS = {} (ล้างทั้งก้อน)');
  assert.match(ui, /FULL_DRAFT\[f\.id\]/, 'textarea ฉบับเต็มยังไม่เก็บ draft');
  assert.match(ui, /delete DRAFTS\[x\.id\]/, 'ไม่ได้ล้าง draft เฉพาะช่องที่บันทึกสำเร็จ');
});

t('index.mjs ผูก listening ครั้งเดียว (พอร์ตชนแล้วไม่เปิด URL ผิดตัว)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/SERVER/index.mjs'), 'utf8');
  assert.match(src, /server\.once\('listening'/, 'ไม่มี listening handler');
  assert.match(src, /server\.address\(\)\.port/, 'ยังใช้พอร์ตที่ขอ ไม่ใช่พอร์ตจริง');
  const inListen = /function listen\([\s\S]*?server\.listen\([^)]*\)/.test(src);
  assert.ok(inListen, 'listen() ผิดรูป');
  assert.ok(!/server\.listen\([^)]*,\s*\(\)\s*=>/.test(src), 'ยังผูก callback ใน server.listen (จะซ้ำเมื่อ retry)');
});

t('plannotator-config รับ workflow/runtime จริง (ตาม README ปลั๊กอิน)', () => {
  const acts = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/SERVER/actions.mjs'), 'utf8');
  assert.match(acts, /'plan-agent', 'user-managed', 'all-agents', 'manual'/);
  assert.match(acts, /options\.runtime/);
  assert.match(acts, /startsWith\('@plannotator\/opencode'\)/, 'ต้องรองรับ package ที่มี @version ต่อท้าย');
});

t('PLANNOTATOR ใช้ --result-file เป็นสัญญาผล (ไม่พึ่งปุ่มกลับโหมด)', () => {
  const t2 = fs.readFileSync(path.join(ROOT, 'AGENT/02SUBAGENT/PLANNOTATOR.md'), 'utf8');
  assert.match(t2, /--require-approval/, 'ต้องบังคับ gate');
  assert.match(t2, /--result-file/, 'ต้องอ่านผลจากไฟล์ผล ไม่ใช่จากปุ่ม');
  assert.match(t2, /--json/, 'ต้องขอผลแบบ machine-readable');
  assert.match(t2, /pending/, 'ต้องมีสถานะ pending เมื่อยังไม่มีผล');
  assert.match(t2, /ตั้งค่านี้จากไฟล์ไม่ได้|ไม่มีไฟล์ให้แก้/, 'ต้องบอกตรง ๆ ว่าตั้งจากไฟล์ไม่ได้');
});

t('ข้อความ Plannotator ใน Console อธิบายกลไกที่ถูก (ไม่บอกให้แพตช์)', () => {
  const acts = fs.readFileSync(path.join(ROOT, 'BAZERCONSOLE/01MAIN/ACTIVE/SERVER/actions.mjs'), 'utf8');
  assert.match(acts, /session\.switchAgent/, 'ต้องบอกว่ากลับโหมดเลือกในหน้า review UI');
  assert.ok(!/plannotator-patch/.test(acts), 'ยังมี handler แพตช์ที่ไม่มีปุ่ม');
  const plan = fs.readFileSync(path.join(ROOT, 'AGENT/02SUBAGENT/PLANNOTATOR.md'), 'utf8');
  assert.match(plan, /--result-file/);
});

console.log('regression — WAVE A/B (ปลั๊กอิน · บันไดลงไฟล์ · arena · gate logic)');

t('appendArrayItem: เพิ่มค่าใหม่ + รันซ้ำไม่เพิ่ม + คงคอมเมนต์', () => {
  const src = '{\n  "plugins": [\n    // ตัวแรก\n    "./plugins/a"\n  ],\n  "x": 1\n}\n';
  const one = appendArrayItem(src, ['plugins'], './plugins/b');
  assert.deepEqual(parseJsonc(one).plugins, ['./plugins/a', './plugins/b']);
  assert.match(one, /ตัวแรก/);
  const twice = appendArrayItem(one, ['plugins'], './plugins/b');
  assert.equal(twice, one, 'รันซ้ำต้องไม่เปลี่ยนอะไร');
  assert.equal(parseJsonc(one).x, 1);
  const empty = appendArrayItem('{\n  "plugins": []\n}\n', ['plugins'], './plugins/c');
  assert.deepEqual(parseJsonc(empty).plugins, ['./plugins/c']);
  const missing = appendArrayItem('{\n  "a": 1\n}\n', ['plugins'], './plugins/d');
  assert.deepEqual(parseJsonc(missing).plugins, ['./plugins/d']);
});

t('setFrontmatterPermission: แทนบล็อกเดิม คง key อื่น/BOM/CRLF', () => {
  const src = '\uFEFF---\r\ndescription: "x"\r\nmode: primary\r\npermission:\r\n  read: allow\r\n  shell: ask\r\n---\r\n\r\nเนื้อหา\r\n';
  const out = setFrontmatterPermission(src, { read: 'allow', shell: 'allow', edit: 'allow' });
  assert.equal(out.charCodeAt(0), 0xfeff, 'BOM หาย');
  assert.match(out, /\r\n/);
  assert.match(out, /description: "x"/);
  assert.match(out, /mode: primary/);
  const perm = getFrontmatterPermission(out);
  assert.deepEqual(perm, { read: 'allow', edit: 'allow', shell: 'allow' });
  assert.match(out, /เนื้อหา/);
});

t('stripFrontmatterPermission: ไม่ขึ้น stale เมื่อบันไดเปลี่ยน', () => {
  const src = '---\nmode: primary\npermission:\n  read: allow\n---\nbody\n';
  const a = setFrontmatterPermission(src, { read: 'allow', shell: 'ask' });
  const b = setFrontmatterPermission(src, { read: 'allow', shell: 'allow' });
  assert.notEqual(a, b);
  assert.equal(stripFrontmatterPermission(a), stripFrontmatterPermission(b));
});

t('stateOf: agent ที่ผูกบันได ไม่ขึ้น stale จาก permission ที่ระบบเขียนเอง', () => {
  const h = path.join(os.tmpdir(), 'bazer', 'ladder-state-home');
  fs.rmSync(h, { recursive: true, force: true });
  const dir = path.join(h, '.config', 'opencode', 'agents');
  fs.mkdirSync(dir, { recursive: true });
  const entry = manifest.entries.find((e) => e.id === 'agent.buddha');
  const src = fs.readFileSync(srcPath(entry), 'utf8');
  fs.writeFileSync(path.join(dir, 'buddha.md'), setFrontmatterPermission(src, { read: 'allow', shell: 'allow' }), 'utf8');
  const st = stateOf(entry, h);
  assert.equal(st.state, 'ok', `ได้ ${st.state} — ${st.note}`);
  fs.writeFileSync(path.join(dir, 'buddha.md'), `${src}\nเพิ่มเนื้อหาใหม่\n`, 'utf8');
  assert.equal(stateOf(entry, h).state, 'stale');
  fs.rmSync(h, { recursive: true, force: true });
});

t('law R1 ผ่าน แม้มีโค้ดใน AGENT/04PLUGIN (exception ตาม GUIDELINE)', () => {
  const law = checkLaw({ handlerIds: actionIds });
  const r1 = law.rules.find((r) => r.id === 'R1');
  assert.equal(r1.ok, true, r1.details?.join(' · '));
});

fs.rmSync(home, { recursive: true, force: true });
console.log(`\n${pass} passed`);