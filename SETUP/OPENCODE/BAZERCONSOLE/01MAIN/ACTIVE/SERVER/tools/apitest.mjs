/**
 * apitest.mjs — integration test ของเซิร์ฟเวอร์ (รันได้เอง: สตาร์ท → ยิง HTTP → ปิด)
 * ใช้ home ปลอมที่มีช่องว่างในชื่อ เพื่อทดสอบ path ของ Windows
 * node tools/apitest.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(__dirname, '..', 'index.mjs');
const PORT = 4477;
const HOME = path.join(os.tmpdir(), 'bazer', 'api test home');
const STORE_DIR = path.join(HOME, '.bazerconsole', 'var');
const TOKEN_FILE = path.join(STORE_DIR, `token-${PORT}`);

let pass = 0;
const fails = [];
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fails.push(name); console.error(`FAIL  ${name}${extra ? `\n      ${extra}` : ''}`); }
};

fs.rmSync(HOME, { recursive: true, force: true });
fs.mkdirSync(HOME, { recursive: true });

const srv = spawn(process.execPath, [SERVER, `--port=${PORT}`, `--home=${HOME}`, '--no-open'], { stdio: ['ignore', 'pipe', 'pipe'] });
const base = `http://127.0.0.1:${PORT}`;
const token = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('เซิร์ฟเวอร์ไม่ขึ้นใน 15 วินาที')), 15000);
  srv.stdout.on('data', (b) => {
    const s = b.toString();
    if (s.includes('http://127.0.0.1')) {
      clearTimeout(t);
      resolve(fs.readFileSync(TOKEN_FILE, 'utf8').trim());
    }
  });
  srv.on('exit', (c) => { clearTimeout(t); reject(new Error(`เซิร์ฟเวอร์ออกก่อนกำหนด (code ${c})`)); });
});

const H = { 'content-type': 'application/json', 'x-bazer-token': token };
const get = async (p, headers = {}) => {
  const r = await fetch(base + p, { headers });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }
  return { status: r.status, text, json };
};
const post = async (body, headers = H) => {
  const r = await fetch(base + '/api/action', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }
  return { status: r.status, text, json };
};

try {
  const s = await get('/api/state');
  check('state ตอบ 200 + มี plan', s.status === 200 && Array.isArray(s.json?.plan?.entries), `status=${s.status}`);
  check('state มี actions/policies/settings ครบ', !!(s.json?.actions?.length && s.json?.policies?.length && s.json?.settings?.groups?.length));

  check('POST ไม่มี token → 403', (await post({ id: 'plan' }, { 'content-type': 'application/json' })).status === 403);
  check('POST token ผิด → 403', (await post({ id: 'plan' }, { 'content-type': 'application/json', 'x-bazer-token': 'deadbeef' })).status === 403);
  check('POST JSON พัง → 400', (await post('{oops')).status === 400);

  const unknown = await post({ id: 'nope-nope' });
  check('action ที่ไม่รู้จัก → ok:false พร้อมข้อความ', unknown.json?.ok === false && /ไม่รู้จัก/.test(unknown.json?.summary || ''));

  const noConfirm = await post({ id: 'policy-set', params: { level: '2' } });
  check('write + popup ที่ไม่ยืนยัน → needsConfirm', noConfirm.json?.needsConfirm === true, JSON.stringify(noConfirm.json).slice(0, 160));

  const badLevel = await post({ id: 'policy-set', params: { level: '99', confirmed: true } });
  check('policy-set ระดับที่ไม่มี → ok:false ไม่ crash', badLevel.json?.ok === false && badLevel.status === 200, badLevel.text.slice(0, 160));

  const badCtl = await post({ id: 'settings-save', params: { confirmed: true, patches: [{ id: 'ไม่มีจริง', value: 'x' }] } });
  check('settings-save control ที่ไม่มี → รายงานรายช่อง', badCtl.json?.settings?.results?.[0]?.ok === false);

  const badStamp = await post({ id: 'rollback', params: { stamp: '19000101-000000', confirmed: true } });
  check('rollback stamp ที่ไม่มี → ok:false', badStamp.json?.ok === false);

  const law = await post({ id: 'law-check' });
  check('law-check ผ่าน', law.json?.ok === true, law.json?.summary);

  const plan = await post({ id: 'plan' });
  check('plan ทำงานบน home ว่าง (มี missing)', plan.json?.ok === true && plan.json.plan.summary.missing > 0, plan.json?.summary);

  const probeEarly = await post({ id: 'probe' });
  check('probe ก่อนติดตั้ง → เตือน ไม่ใช่ fail', probeEarly.json?.ok === true && probeEarly.json?.warn === true, probeEarly.json?.summary);
  const loc = await post({ id: 'plannotator-locate' });
  check('plannotator-locate ไม่เจอ → เตือน ไม่ใช่ error', loc.json?.ok === true && loc.json?.warn === true, loc.json?.summary);
  const selfEarly = await post({ id: 'self-check' });
  check('self-check ก่อนติดตั้ง → เตือน (กฎผ่าน)', selfEarly.json?.warn === true && selfEarly.json?.law?.ok === true, selfEarly.json?.summary);

  const early = await post({ id: 'settings-save', params: { confirmed: true, patches: [{ id: 'pstack.judgment', value: 'a/b' }] } });
  check('บันทึก role ก่อนติดตั้ง → ล้มอย่างสุภาพ (ไม่ throw)', early.json?.ok === false && /template|ไฟล์/.test(JSON.stringify(early.json?.settings || {})), JSON.stringify(early.json?.settings || {}).slice(0, 160));

  const VAR = STORE_DIR;
  const stateFile = path.join(VAR, 'state.json');
  const keep = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
  fs.mkdirSync(VAR, { recursive: true });
  fs.writeFileSync(stateFile, '{ พัง ไม่ใช่ json');
  const corrupt = await get('/api/state');
  check('state.json พัง → เซิร์ฟเวอร์ยังตอบได้', corrupt.status === 200 && Array.isArray(corrupt.json?.plan?.entries));
  if (keep) fs.writeFileSync(stateFile, keep); else fs.rmSync(stateFile, { force: true });

  const histFile = path.join(VAR, 'history.tsv');
  if (fs.existsSync(histFile)) fs.appendFileSync(histFile, 'บรรทัดพังไม่มีแท็บ\n', 'utf8');
  const badHist = await post({ id: 'history-list' });
  check('history.tsv มีบรรทัดพัง → ไม่ crash', badHist.json?.ok === true);

  // --- เคสล้มกลางทาง: วาง "โฟลเดอร์" ทับที่ไฟล์ปลายทาง ทำให้เขียนไม่ได้ ---
  const blocked = path.join(HOME, '.config', 'opencode', 'agents', 'buddha.md');
  fs.mkdirSync(blocked, { recursive: true });
  const failApply = await post({ id: 'apply', params: { confirmed: true } });
  const cfgAfterFail = path.join(HOME, '.config', 'opencode', 'opencode.jsonc');
  check('apply ที่ล้มกลางทาง → ok:false + รายงาน error', failApply.json?.ok === false && (failApply.json?.apply?.errors?.length ?? 0) === 1,
    JSON.stringify(failApply.json?.apply?.errors || []).slice(0, 200));
  check('ล้มกลางทาง → rollback อัตโนมัติ (คืนไฟล์ที่เขียนไปแล้ว)', !!failApply.json?.apply?.rolledBack && !failApply.json.apply.rolledBack.error,
    JSON.stringify(failApply.json?.apply?.rolledBack || {}).slice(0, 200));
  check('rollback ลบไฟล์ที่เพิ่งสร้างในรอบที่ล้ม', !fs.existsSync(cfgAfterFail));
  fs.rmSync(blocked, { recursive: true, force: true });

  // --- binary ต้องไม่ถูกอ่านเป็นข้อความ ---
  const { ROOT } = await import('../env.mjs');
  const { writeEntry } = await import('../apply.mjs');
  const { stamp } = await import('../apply.mjs');
  const binSrc = path.join(HOME, 'bintest');
  const binSrcRel = path.relative(ROOT, binSrc);
  fs.rmSync(binSrc, { recursive: true, force: true });
  fs.mkdirSync(path.join(binSrc, 'bin'), { recursive: true });
  const binFile = path.join(binSrc, 'bin', 'x.bin');
  fs.writeFileSync(binFile, Buffer.from([0, 1, 2, 255, 254, 0, 65, 66]));
  let binNote = '';
  try {
    writeEntry({ id: 'test.bin', kind: 'skill', title: 'binary', source: binSrcRel, target: '${HOME}/bin-out', strategy: 'copy-tree', owner: 'ours', status: 'ready' }, HOME, stamp());
  } catch (e) { binNote = e.message; }
  const copiedPath = path.join(HOME, 'bin-out', 'bin', 'x.bin');
  const copied = fs.existsSync(copiedPath) ? fs.readFileSync(copiedPath) : Buffer.alloc(0);
  check('copy-tree ไฟล์ไบนารีไม่เพี้ยน (bytes เดิม)', copied.length > 0 && Buffer.compare(copied, fs.readFileSync(binFile)) === 0, binNote);
  fs.rmSync(binSrc, { recursive: true, force: true });

  const install = await post({ id: 'install-tools', params: {} });
  check('install-tools dry-run ไม่รันอะไร', install.json?.ok === true && install.json.applied === false, install.json?.summary);

  const apply1 = await post({ id: 'apply', params: { confirmed: true } });
  const applied1 = apply1.json?.apply?.applied?.length ?? 0;
  check('apply ครั้งแรกเขียนจริง', applied1 > 0, `applied=${applied1} errors=${JSON.stringify(apply1.json?.apply?.errors || []).slice(0, 200)}`);

  const apply2 = await post({ id: 'apply', params: { confirmed: true } });
  check('apply ครั้งที่สองไม่เขียนซ้ำ (idempotent)', (apply2.json?.apply?.applied?.length ?? -1) === 0, `applied=${apply2.json?.apply?.applied?.length}`);

  const hist = await post({ id: 'history-list' });
  check('history มีรายการหลัง apply', (hist.json?.history?.length ?? 0) > 0);

  const kb = await post({ id: 'settings-save', params: { confirmed: true, patches: [{ id: 'keybind.copy', value: ['ctrl+alt+m', 'ctrl+alt+o'] }] } });
  const tuiRaw = fs.readFileSync(path.join(HOME, '.config', 'opencode', 'tui.json'), 'utf8');
  const tui = JSON.parse(tuiRaw.replace(/^\uFEFF/, '').replace(/\/\/.*$/gm, ''));
  check('คีย์ลัดถูกเขียนเป็น array (ไม่ใช่สตริง)', kb.json?.ok === true && Array.isArray(tui.keybinds.messages_copy), JSON.stringify(tui.keybinds));

  // --- full settings: เขียนทับทั้งไฟล์ ---
  const tuiPath = path.join(HOME, '.config', 'opencode', 'tui.json');
  const fullText = '{\n  "$schema": "https://opencode.ai/tui.json",\n  "keybinds": { "messages_copy": ["ctrl+x"] },\n  "theme": "old"\n}';
  const fullOk = await post({ id: 'settings-full', params: { confirmed: true, file: 'tui', content: fullText } });
  const tuiAfter = fs.readFileSync(tuiPath, 'utf8');
  check('settings-full เขียนทับทั้งไฟล์ (ค่าที่ไม่อยู่ในเนื้อหาหาย)', fullOk.json?.ok === true && tuiAfter.includes('"ctrl+x"') && !tuiAfter.includes('ctrl+alt+m'));
  const beforeBad = fs.readFileSync(tuiPath, 'utf8');
  const fullBad = await post({ id: 'settings-full', params: { confirmed: true, file: 'tui', content: '{oops' } });
  check('settings-full JSON พัง → ไม่เขียนทับ', fullBad.json?.ok === false && fs.readFileSync(tuiPath, 'utf8') === beforeBad);

  const icon = await fetch(base + '/icon.ico');
  const iconBuf = Buffer.from(await icon.arrayBuffer());
  check('favicon/logo เสิร์ฟ .ico จริง', icon.status === 200 && (icon.headers.get('content-type') || '').includes('image/x-icon') && iconBuf[0] === 0 && iconBuf[1] === 0 && iconBuf[2] === 1 && iconBuf[3] === 0);

  // --- Plannotator: ไม่มี action แพตช์แล้ว (ถอดปุ่มผี) + config options ต้องทำงาน ---
  const plGone = await post({ id: 'plannotator-patch', params: { confirmed: true, target: 'buddha', apply: true } });
  check('plannotator-patch ถูกถอดออกจากสัญญา', plGone.json?.ok === false && /ไม่รู้จัก/.test(plGone.json?.summary || ''), plGone.json?.summary);
  const plLocate = await post({ id: 'plannotator-locate' });
  check('plannotator-locate ยังทำงาน (ไม่เจอ = warn)', plLocate.json?.ok === true, plLocate.json?.summary);

  const role = await post({ id: 'settings-save', params: { confirmed: true, patches: [{ id: 'pstack.judgment', value: 'x/y-z' }] } });
  const models = fs.readFileSync(path.join(HOME, '.agents', 'pstack-models.md'), 'utf8');
  check('บันทึก role ของ PSTACK ลงไฟล์บรรทัดเดียวได้', role.json?.ok === true && /^judgment and prose: x\/y-z$/m.test(models));

  const policy = await post({ id: 'policy-set', params: { level: '3', confirmed: true } });
  const cfgText = fs.readFileSync(path.join(HOME, '.config', 'opencode', 'opencode.jsonc'), 'utf8');
  check('policy-set เขียน permission ระดับ 3 ลง config', policy.json?.ok === true && /webfetch/.test(cfgText) && /external_directory/.test(cfgText));

  // --- บันได BAZER แยกจาก BUDDHA ---
  const bazerLv = await post({ id: 'policy-set', params: { confirmed: true, policy: 'bazer-ladder', level: '1' } });
  const cfgBz = fs.readFileSync(path.join(HOME, '.config', 'opencode', 'opencode.jsonc'), 'utf8');
  check('บันได BAZER เขียน agent.bazer.permission (แยกจาก BUDDHA)',
    bazerLv.json?.ok === true && /"bazer":\s*\{\s*"permission"/.test(cfgBz) && /"shell": "ask"/.test(cfgBz),
    bazerLv.json?.summary);
  const stPol = await get('/api/state');
  check('ระบบรู้ว่าอยู่ขั้นไหน (per-policy)',
    stPol.json?.policyStateAll?.['bazer-ladder']?.level === '1' && stPol.json?.policyStateAll?.['buddha-ladder']?.level === '3',
    JSON.stringify(stPol.json?.policyStateAll));

  // --- reset template: ไฟล์ระบบรุ่นเก่าค้าง (เช่น AGENTS.md) ---
  const agentsMd = path.join(HOME, '.config', 'opencode', 'AGENTS.md');
  fs.appendFileSync(agentsMd, '\n<!-- OLD-RULE: ต้องอยู่ครบ 7 เฟส -->\n', 'utf8');
  const reset = await post({ id: 'reset-template', params: { id: 'tpl.agents-md', confirmed: true } });
  const afterReset = fs.readFileSync(agentsMd, 'utf8');
  check('reset-template เขียนทับไฟล์เก่าด้วยแม่แบบใหม่', reset.json?.ok === true && !afterReset.includes('OLD-RULE') && afterReset.includes('BAZER-MAJOR'));
  const resetBad = await post({ id: 'reset-template', params: { id: 'agent.buddha', confirmed: true } });
  check('reset-template ปฏิเสธ entry ที่ไม่ใช่ template', resetBad.json?.ok === false);

  // --- cleanup: ของเก่า → quarantine ---
  const cfgPath = path.join(HOME, '.config', 'opencode', 'opencode.jsonc');
  const oldAgent = path.join(HOME, '.config', 'opencode', 'agents', 'old-thing.md');
  const oldDisabled = path.join(HOME, '.config', 'opencode', 'agents', 'old-thing.md.disabled');
  const oldMirror = path.join(HOME, '.agents', 'skills', 'BAZERs-EXTENSION-Old', 'SKILL.md');
  const oldPluginDir = path.join(HOME, '.config', 'opencode', 'plugins', 'legacy-plugin');
  fs.writeFileSync(oldAgent, '# old', 'utf8');
  fs.writeFileSync(oldDisabled, '# old disabled', 'utf8');
  fs.mkdirSync(path.dirname(oldMirror), { recursive: true });
  fs.writeFileSync(oldMirror, '# old mirror', 'utf8');
  fs.mkdirSync(oldPluginDir, { recursive: true });
  fs.writeFileSync(path.join(oldPluginDir, 'index.ts'), '// old plugin', 'utf8');
  const { setAtPath } = await import('../jsonc.mjs');
  fs.writeFileSync(cfgPath, setAtPath(fs.readFileSync(cfgPath, 'utf8'), ['plugins'], ['./plugins/legacy-plugin']), 'utf8');

  const st1 = await get('/api/state');
  const g = (id) => st1.json.cleanup.groups.find((x) => x.id === id)?.count ?? 0;
  check('cleanup เห็นของเก่าครบ 4 กลุ่ม', g('agents') >= 2 && g('mirrors') >= 1 && g('plugins') === 1 && g('plugin-dirs') >= 1,
    JSON.stringify(st1.json.cleanup.groups.map((x) => [x.id, x.count])));

  const dry = await post({ id: 'cleanup-old', params: { apply: false } });
  check('cleanup dry-run ไม่ย้ายอะไร', dry.json?.ok === true && dry.json.cleanup.moved === undefined && fs.existsSync(oldAgent));

  const done = await post({ id: 'cleanup-old', params: { apply: true, groups: ['agents', 'mirrors', 'plugins', 'plugin-dirs'], confirmed: true } });
  const q = done.json?.cleanup?.quarantine;
  check('cleanup ย้ายของเก่าแล้ว', done.json?.ok === true && (done.json.cleanup.moved?.length ?? 0) >= 3, JSON.stringify(done.json?.cleanup?.moved || []).slice(0, 200));
  check('ของเก่าหายจากที่เดิม', !fs.existsSync(oldAgent) && !fs.existsSync(oldDisabled) && !fs.existsSync(path.dirname(oldMirror)) && !fs.existsSync(oldPluginDir));
  check('ปลั๊กอินเก่าถูกถอดจาก config', !fs.readFileSync(cfgPath, 'utf8').includes('legacy-plugin'));
  check('quarantine มี manifest', !!(q && fs.existsSync(path.join(q, 'quarantine.json'))));

  const st2 = await get('/api/state');
  check('หลัง cleanup: ไม่เหลือของเก่าในกลุ่มที่เลือก', st2.json.cleanup.groups.filter((x) => ['agents', 'mirrors', 'plugins', 'plugin-dirs'].includes(x.id)).every((x) => x.count === 0));

  const diff = await get('/api/diff?entry=agent.buddha');
  check('diff ของ entry ที่มีอยู่ → 200', diff.status === 200 && typeof diff.json?.after === 'string');
  check('diff ของ entry ที่ไม่มี → 400', (await get('/api/diff?entry=zzz')).status === 400);

  const html = await get('/');
  check('หน้าแรกฉีด token จริง (ไม่เหลือ __TOKEN__)', html.status === 200 && html.text.includes('bazer-token') && !html.text.includes('__TOKEN__'));
  check('app.js โหลดได้', (await get('/app.js')).status === 200);
  check('/../ อ่านไฟล์นอก UI ไม่ได้', (await get('/../README.md')).status !== 200 || !(await get('/../README.md')).text.includes('MAJOR'));
  check('ไฟล์ที่ไม่มี → 404', (await get('/nope.css')).status === 404);

  const finalState = await get('/api/state');
  check('หลัง apply: doctors/blockers สะอาด', (finalState.json?.plan?.blockers?.length ?? 1) === 0, JSON.stringify(finalState.json?.plan?.blockers || []).slice(0, 200));
  check('หลัง apply: ไม่มี stale ที่ auto=true', (finalState.json?.plan?.entries || []).filter((e) => e.auto && e.writable).length === 0);

  // --- [ULTRA LOOP 3] builtin-toggle: "คืน Plan & Build" ต้องเปลี่ยนค่าจริง (merge ลึก 2 ชั้น) ---
  const bOff = await post({ id: 'builtin-toggle', params: { mode: 'off', confirmed: true } });
  const bOffText = fs.readFileSync(cfgPath, 'utf8');
  const bOn = await post({ id: 'builtin-toggle', params: { mode: 'on', confirmed: true } });
  const bOnText = fs.readFileSync(cfgPath, 'utf8');
  check('builtin-toggle off → plan/build เป็น subagent + hidden',
    bOff.json?.ok === true && /"mode": "subagent"/.test(bOffText), bOffText.match(/"plan"[\s\S]{0,60}/)?.[0] || '');
  check('builtin-toggle on → คืน plan/build เป็น primary (ไม่ใช่ no-op)',
    bOn.json?.ok === true && /"plan":\s*\{\s*"mode": "primary"/.test(bOnText) && /"hidden": false/.test(bOnText),
    bOnText.match(/"plan"[\s\S]{0,60}/)?.[0] || '');

  // --- [ULTRA LOOP 3] lock → drift → lock-restore ต้องทำงานครบวง ---
  const { writeState: writeStateT, readState: readStateT, makeStore } = await import('../apply.mjs');
  const TSTORE = makeStore(STORE_DIR);
  const stClean = readStateT(TSTORE);
  delete stClean.modelsSnapshot;
  delete stClean.snapshotHome;
  stClean.locks = { ...(stClean.locks || {}), models: true };
  writeStateT(stClean, TSTORE);
  await post({ id: 'settings-save', params: { confirmed: true, patches: [
    { id: 'model.buddha', value: 'p/one' }, { id: 'model.bazer', value: 'p/two' },
    { id: 'model.snack', value: 'p/three' }, { id: 'model.advisor', value: 'p/four' },
  ] } });
  await post({ id: 'settings-save', params: { confirmed: true, patches: [{ id: 'lock.models', value: true }] } });
  await post({ id: 'settings-save', params: { confirmed: true, patches: [{ id: 'model.buddha', value: 'p/CHANGED' }] } });
  const drift = await get('/api/state');
  check('lock: เปลี่ยนโมเดลหลังล็อก → เห็น drift',
    (drift.json?.drift || []).some((d) => d.mode === 'buddha' && d.now.model === 'p/CHANGED'),
    JSON.stringify(drift.json?.drift || []).slice(0, 200));
  const restore = await post({ id: 'lock-restore', params: { confirmed: true } });
  const restoredText = fs.readFileSync(cfgPath, 'utf8');
  check('lock-restore: คืนโมเดลจาก snapshot จริง',
    restore.json?.ok === true && /"model": "p\/one"/.test(restoredText) && !/p\/CHANGED/.test(restoredText),
    restore.json?.summary);
  const stHijack = readStateT(TSTORE);
  writeStateT({ ...stHijack, snapshotHome: path.join(os.tmpdir(), 'bazer', 'other-home') }, TSTORE);
  const hijack = await post({ id: 'lock-restore', params: { confirmed: true } });
  check('lock-restore: snapshot ของ home ทดสอบ → ปฏิเสธ', hijack.json?.ok === false && /snapshot มาจากโฟลเดอร์ทดสอบ/.test(hijack.json?.summary || ''), hijack.json?.summary);

  // per-mode: snapshot แยกโหมด + คืนเฉพาะโหมด
  const snapB = await post({ id: 'lock-snapshot', params: { mode: 'buddha' } });
  check('lock-snapshot: ถ่ายเฉพาะโหมด buddha', snapB.json?.ok === true && (snapB.json?.modes || []).join() === 'buddha', JSON.stringify(snapB.json?.modes));
  const snapS = await post({ id: 'lock-restore', params: { confirmed: true, mode: 'snack' } });
  check('lock-restore: ระบุโหมด = คืนเฉพาะโหมดนั้น', snapS.json?.ok === true && snapS.json?.run?.mode === 'snack', snapS.json?.summary);
  const kbFix = await post({ id: 'settings-save', params: { confirmed: true, patches: [{ id: 'keybind.copy', value: ['ctrl+alt+m', 'ctrl+alt+o'] }] } });
  const tuiKey = JSON.parse(fs.readFileSync(path.join(HOME, '.config', 'opencode', 'tui.json'), 'utf8').replace(/^\uFEFF/, ''));
  check('คีย์ลัดคงที่เขียนลง tui.json ได้', kbFix.json?.ok === true && JSON.stringify(tuiKey.keybinds.messages_copy) === JSON.stringify(['ctrl+alt+m', 'ctrl+alt+o']), JSON.stringify(tuiKey.keybinds));

  // --- [ULTRA LOOP 3] installer: min ตรวจผ่าน probe + optional ไม่ถูกนับเป็นขาด ---
  const inst = await post({ id: 'install-tools', params: {} });
  check('install-tools คืน need (required) แยกจาก advisory (optional)',
    Array.isArray(inst.json?.need) && Array.isArray(inst.json?.advisory) && !inst.json.need.some((n) => n.id === 'plannotator'),
    JSON.stringify({ need: inst.json?.need?.map((n) => n.id), advisory: inst.json?.advisory?.map((a) => a.id) }));
  const { PASSIVE_DIR } = await import('../env.mjs');
  const instSpec = JSON.parse(fs.readFileSync(path.join(PASSIVE_DIR, '02INSTALLER', 'install.json'), 'utf8'));
  check('install.json: step ที่มี min ต้องตรวจผ่าน probe',
    instSpec.steps.filter((s) => s.min).every((s) => !!s.check?.probe),
    JSON.stringify(instSpec.steps.filter((s) => s.min).map((s) => [s.id, s.check?.probe])));

  // --- [ULTRA LOOP 3] open-target: โฟลเดอร์ไม่มี → เตือน ไม่ใช่ "สำเร็จ" ---
  const missingOpen = await post({ id: 'open-target', params: { which: 'major' } });
  check('open-target: โฟลเดอร์มีจริง → เปิดได้', missingOpen.json?.ok === true && missingOpen.json?.opened === true, missingOpen.json?.summary);
  const home2 = path.join(os.tmpdir(), 'bazer', 'api test home 2');
  fs.rmSync(home2, { recursive: true, force: true });
  fs.mkdirSync(home2, { recursive: true });
  const srv2 = spawn(process.execPath, [SERVER, `--port=${PORT + 1}`, `--home=${home2}`, '--no-open'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const token2 = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('เซิร์ฟเวอร์ตัวที่ 2 ไม่ขึ้น')), 15000);
    srv2.stdout.on('data', (b) => {
      if (b.toString().includes('http://127.0.0.1')) { clearTimeout(t); resolve(fs.readFileSync(path.join(home2, '.bazerconsole', 'var', `token-${PORT + 1}`), 'utf8').trim()); }
    });
  });
  const H2 = { 'content-type': 'application/json', 'x-bazer-token': token2 };
  const r2 = await fetch(`http://127.0.0.1:${PORT + 1}/api/action`, { method: 'POST', headers: H2, body: JSON.stringify({ id: 'open-target', params: { confirmed: true, which: 'config' } }) });
  const j2 = await r2.json();
  check('open-target: โฟลเดอร์ไม่มี → warn (ไม่ใช่ ok)', j2?.warn === true && j2?.opened === false, JSON.stringify(j2).slice(0, 160));
  srv2.kill();
  fs.rmSync(home2, { recursive: true, force: true });

  // --- [ULTRA LOOP 3] พอร์ตชน: ต้องพิมพ์ URL ครั้งเดียวและเป็นพอร์ตจริง ---
  const srv3 = spawn(process.execPath, [SERVER, `--port=${PORT}`, `--home=${path.join(os.tmpdir(), 'bazer', 'api test home 3')}`, '--no-open'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log3 = '';
  srv3.stdout.on('data', (b) => { log3 += b.toString(); });
  srv3.stderr.on('data', (b) => { log3 += b.toString(); });
  await new Promise((r) => setTimeout(r, 3500));
  const urlLines = log3.split(/\r?\n/).filter((l) => l.includes('127.0.0.1:')).length;
  const port3 = Number(/127\.0\.0\.1:(\d+)/.exec(log3)?.[1] || 0);
  srv3.kill();
  check('พอร์ตชน: พิมพ์ URL ครั้งเดียว และเป็นพอร์ตใหม่', urlLines === 1 && port3 > PORT, `lines=${urlLines} port=${port3}`);

  // --- [WAVE B] ปลั๊กอิน gate: ติดตั้ง/ลงทะเบียน/prune ---
  const reg = await post({ id: 'plugin-register', params: { confirmed: true, name: 'bazer-flow' } });
  const cfgPlug = fs.readFileSync(cfgPath, 'utf8');
  check('plugin-register เพิ่ม ./plugins/bazer-flow ใน config', reg.json?.ok === true && cfgPlug.includes('./plugins/bazer-flow'), reg.json?.summary);
  const reg2 = await post({ id: 'plugin-register', params: { confirmed: true, name: 'bazer-flow' } });
  check('plugin-register รันซ้ำไม่เพิ่มซ้ำ', (fs.readFileSync(cfgPath, 'utf8').match(/\.\/plugins\/bazer-flow/g) || []).length === 1 && reg2.json?.ok === true);

  const pl = await post({ id: 'apply', params: { confirmed: true, ids: ['plugin.bazer-flow'] } });
  const plugDir = path.join(HOME, '.config', 'opencode', 'plugins', 'bazer-flow');
  const plugFiles = fs.existsSync(plugDir) ? fs.readdirSync(plugDir) : [];
  check('ติดตั้งปลั๊กอินลงเครื่อง (copy-tree, ไม่มีไฟล์ dev)', pl.json?.ok === true && plugFiles.includes('index.ts') && !plugFiles.includes('logic.mjs') && !plugFiles.includes('guard.test.mjs'), plugFiles.join(','));
  const orphan = path.join(plugDir, 'old-junk.mjs');
  fs.writeFileSync(orphan, '// ของเก่า', 'utf8');
  const pl2 = await post({ id: 'apply', params: { confirmed: true, ids: ['plugin.bazer-flow'] } });
  const prunedDir = fs.readdirSync(plugDir);
  check('prune: ไฟล์ซากรุ่นเก่าถูกย้ายออกจากปลายทาง', !prunedDir.includes('old-junk.mjs'), prunedDir.join(','));
  check('prune: ยังเก็บสำเนาไว้ (ไม่ลบ)', (pl2.json?.apply?.applied?.length ?? 0) >= 0 && fs.existsSync(path.join(VAR, 'backups')));

  const bkList = await post({ id: 'backup-list', params: {} });
  check('backup-list คืนรายรอบ + ไฟล์', bkList.json?.ok === true && Array.isArray(bkList.json.backups) && bkList.json.backups.length > 0, `${bkList.json?.summary}`);
  const firstWithFiles = (bkList.json?.backups || []).find((b) => b.items && b.items.length);
  if (firstWithFiles) {
    const item = firstWithFiles.items[0];
    const bkRestore = await post({ id: 'backup-restore', params: { confirmed: true, stamp: firstWithFiles.stamp, target: item.target } });
    check('backup-restore คืนไฟล์เดียวได้', bkRestore.json?.ok === true && bkRestore.json?.run?.from === firstWithFiles.stamp, bkRestore.json?.summary);
  } else {
    check('backup-restore คืนไฟล์เดียวได้', false, 'ไม่พบรอบที่มีไฟล์');
  }
  const bkBad = await post({ id: 'backup-restore', params: { confirmed: true, stamp: '19990101-000000-000', target: cfgPath } });
  check('backup-restore รอบที่ไม่มี → ล้มอย่างสุภาพ', bkBad.json?.ok === false && bkBad.status === 200);

  const plCfg = await post({ id: 'plannotator-config', params: { confirmed: true, target: 'buddha' } });
  check('plannotator-config: ไม่มีปลั๊กอินใน config → บอกตรง ๆ', plCfg.json?.ok === false && /plannotator/.test(plCfg.json?.summary || ''), plCfg.json?.summary);

  // --- [WAVE B] arena: เก็บ effort inline (model#effort) + ลบบรรทัด efforts รุ่นเก่า ---
  const modelsFile = path.join(HOME, '.agents', 'pstack-models.md');
  if (fs.existsSync(modelsFile)) {
    const withLegacy = `${fs.readFileSync(modelsFile, 'utf8')}\narena runner efforts: low, low\narena judge efforts: max\n`;
    fs.writeFileSync(modelsFile, withLegacy, 'utf8');
    const arenaSave = await post({ id: 'settings-save', params: { confirmed: true, patches: [
      { id: 'arena.runners', value: 'opencode-go/beam-free#low, opencode-go/deepseek-v4.1-flash#max' },
      { id: 'arena.judge', value: 'opencode-go/glm-5#high' },
    ] } });
    const arenaText = fs.readFileSync(modelsFile, 'utf8');
    check('arena: บันทึกเป็น model#effort inline',
      arenaSave.json?.ok === true && /^arena runners: opencode-go\/beam-free#low, opencode-go\/deepseek-v4\.1-flash#max$/m.test(arenaText),
      arenaText.split(/\r?\n/).filter((l) => l.startsWith('arena')).join(' | '));
    check('arena: บรรทัด efforts รุ่นเก่าถูกลบ (ไม่ให้ขัดกัน)',
      !/^arena runner efforts:/m.test(arenaText) && !/^arena judge efforts:/m.test(arenaText));
    const arenaState = await get('/api/state');
    check('arena: Console อ่านกลับเป็น 2 ที่นั่งของ runner + 1 judge',
      String(arenaState.json.settingsValues['arena.runners']).includes('#low') && String(arenaState.json.settingsValues['arena.judge']).includes('#high'),
      String(arenaState.json.settingsValues['arena.runners']));
  } else {
    check('arena: บันทึกเป็น model#effort inline', false, 'ไม่พบ pstack-models.md');
  }

  const ladderFile = path.join(HOME, '.config', 'opencode', 'agents', 'buddha.md');
  const beforeLadder = fs.readFileSync(ladderFile, 'utf8');
  const lv2 = await post({ id: 'policy-set', params: { confirmed: true, level: '2' } });
  const afterLadder = fs.readFileSync(ladderFile, 'utf8');
  check('บันไดเขียนลง frontmatter ของ agent file ด้วย',
    lv2.json?.ok === true && afterLadder !== beforeLadder && /permission:/.test(afterLadder) && /shell: allow/.test(afterLadder),
    (afterLadder.match(/permission:[\s\S]{0,160}/) || [''])[0].slice(0, 120));
  const afterState = await get('/api/state');
  const buddhaEntry = afterState.json.plan.entries.find((e) => e.id === 'agent.buddha');
  check('บันไดไม่ทำให้ agent ขึ้น stale ปลอม', buddhaEntry?.state === 'ok', buddhaEntry?.state);
} catch (e) {
  fails.push(`exception: ${e.message}`);
  console.error('EXCEPTION', e);
} finally {
  srv.kill();
  await new Promise((r) => setTimeout(r, 300));
  fs.rmSync(HOME, { recursive: true, force: true });
}

console.log(`\n${pass} passed${fails.length ? ` · ${fails.length} FAILED` : ''}`);
if (fails.length) process.exitCode = 1;
