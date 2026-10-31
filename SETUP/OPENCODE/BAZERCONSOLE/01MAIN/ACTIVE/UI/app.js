(() => {
  'use strict';
  const TOKEN = document.querySelector('meta[name="bazer-token"]').content;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STATE_TH = { ok: 'ตรง', stale: 'ต้องอัพเดต', missing: 'ยังไม่มี', broken: 'ไม่ทำงาน', design: 'ยังไม่พร้อม', raw: 'raw', foreign: 'ไม่รู้จัก' };
  const RISK_TH = { 1: 'ปลอดภัยมาก', 2: 'ดูเหมือนปลอดภัย', 3: 'ไม่ปลอดภัย' };
  const MODE_COLORS = { buddha: '#EB895B', bazer: '#D9480F', snack: '#40E0D0', advisor: '#B26BFF' };
  const MODE_ROLE = {
    buddha: 'วางแผน Arena → GATE 1 → Arena ในเซสชัน → GATE 2 → สร้างในเซสชัน',
    bazer: 'แผนเดียว → GATE → แก้เฉพาะไฟล์ที่ระบุพาธ',
    snack: 'ถามเร็วตอบเร็ว อ่านได้เฉพาะพาธที่ระบุ แก้ไม่ได้',
    advisor: 'คุยจากบริบทในแชต อ่าน/แก้ไม่ได้เลย',
  };

  let S = null, TAB = 'overview', FILE_SUB = 'all', SET_SUB = 'full', DRAFTS = {}, FULL_DRAFT = {}, BUSY = false, PALETTE_SEL = 0, PALETTE_ITEMS = [];
  let MODELS = { ok: false, models: [], providers: [], error: '' };

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'x-bazer-token': TOKEN, 'content-type': 'application/json', ...(opts.headers || {}) },
    });
    return res.json();
  }

  /* ---------------- chrome ---------------- */
  function toast(title, msg, kind = 'ok') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<strong>${esc(title)}</strong>${esc(msg)}`;
    $('#toasts').append(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(18px)'; }, 4200);
    setTimeout(() => el.remove(), 4600);
  }

  function openModal({ title, body, foot = '' }) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('#modalFoot').innerHTML = foot;
    $('#modalRoot').hidden = false;
  }
  const closeModal = () => { $('#modalRoot').hidden = true; };

  function riskBadge(level, why, withWhy = true) {
    return `<span class="risk l${level}">${RISK_TH[level]}</span>${withWhy && why ? `<span class="risk-why">${esc(why)}</span>` : ''}`;
  }
  const badge = (st) => `<span class="badge ${st}">${STATE_TH[st] || st}</span>`;

  function confirmSheet({ title, risk, body, confirmText = 'ยืนยัน', onConfirm }) {
    openModal({
      title,
      body: `<div class="cols">
        <div>${body}</div>
        <div class="card" style="margin:0">${riskBadge(risk.level, risk.why)}</div>
      </div>`,
      foot: `<button class="btn ghost" data-close="1">ยกเลิก</button><button class="btn primary" id="confirmGo">${esc(confirmText)}</button>`,
    });
    $('#confirmGo').onclick = () => { closeModal(); onConfirm(); };
  }

  /* ---------------- data ---------------- */
  async function load(withProbes = false) {
    // state กับ models โหลดพร้อมกัน — models พังต้องไม่ทำให้หน้าโหลดไม่ขึ้น
    const [stateRes, modelsRes] = await Promise.allSettled([
      api(`/api/state${withProbes ? '?probes=1' : ''}`),
      api('/api/models'),
    ]);
    if (stateRes.status === 'rejected') {
      toast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', stateRes.reason?.message || String(stateRes.reason), 'err');
      return;
    }
    S = stateRes.value;
    if (!S || !S.plan) {
      toast('อ่านสถานะไม่ได้', S?.error || 'ผลตอบกลับไม่ครบ', 'err');
      return;
    }
    const mr = modelsRes.status === 'fulfilled' ? modelsRes.value : null;
    MODELS = {
      ok: !!(mr && mr.ok),
      models: Array.isArray(mr?.models) ? mr.models : [],
      providers: Array.isArray(mr?.providers) ? mr.providers : [],
      error: mr?.error || (modelsRes.status === 'rejected' ? modelsRes.reason?.message || 'โหลดรายชื่อโมเดลไม่ได้' : ''),
    };
    // ไม่ล้าง DRAFTS ทั้งก้อน — ผู้ใช้อาจพิมพ์ค้างไว้แล้วมี action อื่นทำงานเบื้องหลัง
    // (ค่าที่บันทึกสำเร็จจะถูกล้างเป็นราย id ใน act({ dropDrafts }))
    render();
  }

  async function act(id, params = {}, { confirmed = false } = {}) {
    if (BUSY) return toast('รอสักครู่', 'มีงานกำลังทำอยู่', 'err');
    const meta = S.actions.find((a) => a.id === id);
    if (meta?.kind === 'write' && meta.confirm === 'popup' && !confirmed) {
      return confirmSheet({
        title: meta.title,
        risk: meta.risk,
        body: `<p>${esc(meta.subtitle || '')}</p><p class="mono muted">${esc(id)}</p>`,
        onConfirm: () => act(id, params, { confirmed: true }),
      });
    }
    BUSY = true;
    document.body.classList.add('busy');
    try {
      const r = await api('/api/action', { method: 'POST', body: JSON.stringify({ id, params: { ...params, confirmed: true } }) });
      const kind = r.ok ? (r.warn ? 'warn' : 'ok') : 'err';
      const label = r.ok ? (r.warn ? 'ยังไม่พร้อม' : 'สำเร็จ') : 'ไม่สำเร็จ';
      toast(label, r.summary || '', kind);
      if (r.law) S.law = r.law;
      // ล้างเฉพาะช่องที่บันทึกสำเร็จจริง (ช่องที่ล้มต้องไม่หายจากจอ)
      if (id === 'settings-save' && r.ok !== false) ARENA = null;
      for (const x of r.settings?.results || []) if (x.ok) delete DRAFTS[x.id];
      if (r.full?.file) delete FULL_DRAFT[r.full.file];
      if (Array.isArray(r.list)) SYS.list = r.list;
      if (Array.isArray(r.backups)) SYS.backups = r.backups;
      if (r.locate) SYS.locate = r.locate;
      if (r.patch) SYS.locate = r.patch;
      await load(id === 'probe' || id === 'self-check');
    } catch (e) {
      toast('ผิดพลาด', e.message, 'err');
    } finally {
      BUSY = false;
      document.body.classList.remove('busy');
    }
  }

  /* ---------------- models ---------------- */
  function ensureModelDatalist() {
    let dl = $('#bazer-models');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'bazer-models';
      document.body.append(dl);
    }
    dl.innerHTML = (MODELS.models || [])
      .map((m) => `<option value="${esc(m.id)}" label="${esc(m.label || m.id)}"></option>`)
      .join('');
    return dl;
  }

  function modelHint() {
    if (MODELS.ok) {
      return `รายชื่อโมเดลจริง: ${MODELS.models.length} รายการ จาก ${MODELS.providers.length} provider — พิมพ์เองได้ถ้าไม่พบในรายการ`;
    }
    return `โหลดรายชื่อโมเดลไม่ได้${MODELS.error ? ` (${MODELS.error})` : ''} — ช่องโมเดลยังพิมพ์เองได้`;
  }

  /* ---------------- render ---------------- */
  function render() {
    try {
      ensureModelDatalist();
      renderHeader();
      renderOverview();
      renderQuick();
      renderModes();
      renderFiles();
      renderSettings();
      renderSystem();
      renderHistory();
      showTab(TAB);
    } catch (e) {
      console.error(e);
      toast('หน้าจอเรนเดอร์ไม่สำเร็จ', e.message, 'err');
    }
  }

  function renderHeader() {
    const p = S.plan;
    const todo = p.summary.actionable ?? (p.summary.missing + p.summary.stale);
    const manual = p.summary.manualOnly || 0;
    $('#subtitle').textContent = `${S.app.platform} · node ${S.app.node} · ${S.app.root}`;
    $('#cmdBtn').textContent = S.app.platform === 'darwin' ? '⌘ K' : 'Ctrl K';
    const ladder = S.policies.find((x) => x.mode === 'buddha') || S.policies[0];
    const pol = S.policyState?.policyId === ladder.id
      ? ladder.levels.find((l) => String(l.id) === String(S.policyState.level))
      : ladder.levels.find((l) => String(l.id) === String(ladder.defaultLevel));
    $('#statusStrip').innerHTML = [
      `<span class="pill ${todo ? 'warn' : 'ok'}"><span class="dot"></span>ติดตั้งได้ <b>${todo}</b></span>`,
      manual ? `<span class="pill warn"><span class="dot"></span>ต้องสั่งเอง <b>${manual}</b></span>` : '',
      `<span class="pill ${p.summary.broken ? 'bad' : 'ok'}"><span class="dot"></span>ไม่ทำงาน <b>${p.summary.broken}</b></span>`,
      `<span class="pill ${S.law.ok ? 'ok' : 'bad'}"><span class="dot"></span>กฎ <b>${S.law.ok ? 'ผ่าน' : 'ไม่ผ่าน'}</b></span>`,
      `<span class="pill"><span class="dot" style="background:var(--buddha)"></span>BUDDHA <b>${esc(pol?.name || '-')}</b></span>`,
    ].join('');
  }

  function actionCard(a) {
    const cls = a.kind === 'write' ? 'danger' : '';
    return `<div class="card">
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.subtitle || '')}</p>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn ${cls}" data-act="${esc(a.id)}">${esc(a.cta || 'ทำ')}</button>
        ${riskBadge(a.risk.level, a.risk.why)}
      </div>
    </div>`;
  }

  function lawCard(r) {
    return `<div class="card">
      <div class="row" style="justify-content:space-between"><h3>${esc(r.id)} · ${esc(r.title)}</h3><span class="badge ${r.ok ? 'ok' : 'broken'}">${r.ok ? 'ผ่าน' : 'ไม่ผ่าน'}</span></div>
      ${r.details?.length ? `<ul class="small muted" style="margin:8px 0 0 16px">${r.details.slice(0, 6).map((d) => `<li class="mono">${esc(d)}</li>`).join('')}${r.more ? `<li>… อีก ${r.more}</li>` : ''}</ul>` : ''}
    </div>`;
  }

  function renderOverview() {
    const p = S.plan;
    const wired = new Set(['policy-set', 'policy-undo', 'settings-save', 'settings-full', 'pstack-preset', 'rollback', 'apply', 'builtin-toggle', 'retire-old-flow', 'history-list', 'probe', 'plannotator-locate', 'lock-snapshot', 'cleanup-plan', 'cleanup-old', 'reset-template', 'lock-restore', 'law-check', 'install-tools', 'open-target']);
    const heroIds = new Set(['self-check', 'plan', 'apply']);
    const hero = [...heroIds].map((id) => S.actions.find((a) => a.id === id)).filter(Boolean);
    // ปุ่มที่มีที่กดเฉพาะที่แล้ว (ไม่ต้องลงการ์ด "เครื่องมืออื่น" ซ้ำ)
    const placed = new Set(['install-tools', 'law-check']);
    const installAct = S.actions.find((a) => a.id === 'install-tools');
    const acts = S.actions.filter((a) => (a.group === 'overview' || !wired.has(a.id)) && !heroIds.has(a.id) && !placed.has(a.id));
    const probeRows = S.probes ? S.probes.results.map((r) => `<tr>
        <td>${esc(r.title)}</td><td>${r.ok ? '<span class="badge ok">ผ่าน</span>' : `<span class="badge ${r.severity === 'fail' ? 'missing' : 'stale'}">${r.severity === 'fail' ? 'ตก' : 'เตือน'}</span>`}</td>
        <td class="mono muted">${esc(r.detail || '')}</td></tr>`).join('') : '';

    $('#view-overview').innerHTML = `
      <div class="card" style="border-color:rgba(235,137,91,0.38)">
        <div class="btn-row">
          ${hero.map((a) => `<button class="btn ${a.id === 'apply' ? 'primary' : ''}" data-act="${esc(a.id)}">${esc(a.cta || a.title)}</button>`).join('')}
          ${installAct ? `<button class="btn danger" data-act="install-tools">${esc(installAct.cta || installAct.title)}</button>` : ''}
        </div>
        <p class="hint" style="margin-top:10px">${(p.summary.actionable || 0) > 0
          ? `มี ${p.summary.actionable} รายการที่ “ติดตั้ง / อัพเดตทั้งหมด” เขียนให้ได้เลย (backup ทุกไฟล์)`
          : 'ไม่มีอะไรให้ติดตั้งอัตโนมัติ — ดูรายการ “ต้องสั่งเอง” ด้านล่าง'}</p>
        ${(p.summary.manualOnly || 0) > 0 ? `<div class="card" style="margin-top:10px;border-color:rgba(255,196,0,.35)">
          <p><strong>ต้องสั่งเอง ${p.summary.manualOnly} รายการ</strong> <span class="small muted">(auto=false — ตั้งใจไม่ให้ “ติดตั้งทั้งหมด” แตะ ต้องสั่งเป็นรายตัว)</span></p>
          <ul class="small" style="margin:8px 0 0 16px">${p.entries.filter((e) => ['missing', 'stale'].includes(e.state) && e.writable && !e.auto).map((e) => `<li>${esc(e.title)} <span class="mono muted">${esc(e.id)}</span> <button class="btn tiny" data-apply-one="${esc(e.id)}">ติดตั้งรายตัว</button></li>`).join('')}</ul>
        </div>` : ''}
        ${(p.summary.locked || 0) > 0 ? `<p class="hint">มี ${p.summary.locked} ไฟล์ที่เป็นของคุณเอง (ต่างจากแม่แบบ) — ระบบไม่ทับให้ กด “รีเซ็ต” ในแท็บ ไฟล์ &amp; สกิล ถ้าต้องการให้ตรงแม่แบบ</p>` : ''}
        <p class="hint">ยังไม่มี Node/OpenCode/Plannotator บนเครื่อง? กด “ติดตั้งเครื่องมือที่ขาด” (ต้องมีเน็ต · ไม่ติดตั้งอะไรโดยไม่ยืนยัน)</p>
      </div>
      <div class="grid c4" style="margin-top:12px">
        <div class="card"><p>ต้องติดตั้ง</p><div class="big" style="color:var(--bad)">${p.summary.missing}</div></div>
        <div class="card"><p>ต้องอัพเดต</p><div class="big" style="color:var(--warn)">${p.summary.stale}</div></div>
        <div class="card"><p>ไม่ทำงาน</p><div class="big" style="color:var(--bad)">${p.summary.broken}</div></div>
        <div class="card"><p>ของนอก manifest</p><div class="big">${p.foreignTotal}</div></div>
      </div>
      ${p.blockers.length ? `<h2 class="section">ตัวที่ทำให้ยังกดติดตั้งไม่ได้</h2><div class="card"><ul class="small">${p.blockers.map((b) => `<li class="mono">${esc(b)}</li>`).join('')}</ul></div>` : ''}
      ${(S.drift || []).length ? `<h2 class="section">ค่าถูกเปลี่ยนหลังล็อก</h2><div class="card"><ul class="small">${S.drift.map((d) => `<li><strong>${esc(d.mode)}</strong>: ตั้งไว้ <code>${esc(d.was.model || '-')}/${esc(d.was.variant || '-')}</code> แต่ตอนนี้ <code>${esc(d.now.model || '-')}/${esc(d.now.variant || '-')}</code></li>`).join('')}</ul><div class="btn-row" style="margin-top:10px"><button class="btn primary" data-act="lock-restore">ล็อกคืนตาม snapshot</button></div></div>` : ''}
      <h2 class="section">เครื่องมืออื่น</h2>
      <div class="grid c3">${acts.map(actionCard).join('')}</div><h2 class="section">กฎ 4 ข้อ</h2>
      <div class="btn-row" style="margin-bottom:10px"><button class="btn ghost" data-act="law-check">ตรวจกฎ 4 ข้ออีกครั้ง</button></div>
      <div class="grid c2">${S.law.rules.map(lawCard).join('')}</div>
      <h2 class="section">ของจริง (probe)</h2>
      <div class="card">
        ${S.probes ? `<table><thead><tr><th>ข้อ</th><th>ผล</th><th>รายละเอียด</th></tr></thead><tbody>${probeRows}</tbody></table>` : '<p>ยังไม่ได้รัน probe ในหน้านี้</p>'}
        <div class="btn-row" style="margin-top:12px"><button class="btn" data-act="probe">รัน probe เดี๋ยวนี้</button></div>
      </div>`;
  }

  /* ---------------- models: dropdown ---------------- */
  const MODEL_IDS = () => (MODELS.models || []).map((m) => m.id);
  const MODEL_LABEL = (id) => (MODELS.models || []).find((m) => m.id === id)?.name || id;
  const EFFORTS = ['default', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

  function modelDropdown(id, value, { placeholder = '— ยังไม่ตั้ง —' } = {}) {
    const opts = MODEL_IDS();
    const custom = !!value && !opts.includes(value);
    return `<select data-model="${esc(id)}">
        <option value="">${esc(placeholder)}</option>
        ${opts.map((m) => `<option value="${esc(m)}" ${m === value ? 'selected' : ''}>${esc(m)}</option>`).join('')}
        <option value="__custom" ${custom ? 'selected' : ''}>กำหนดเอง…</option>
      </select>
      <input data-draft="${esc(id)}" data-custom-input="1" value="${esc(value || '')}" placeholder="provider/model-id" ${custom ? '' : 'hidden'} />`;
  }

  /* ---------------- arena editor (runner/judge กี่ตัวก็ได้ · effort รายตัว) ---------------- */
  let ARENA = null;
  const parseList = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  function arenaState() {
    if (ARENA) return ARENA;
    // รูปแบบหลัก: model#effort (Console เก็บแบบนี้ตั้งแต่บันทึก)
    // รองรับไฟล์เก่า: model เดี่ยว + บรรทัด `arena runner efforts: …` แยก
    const legacy = (v) => parseList(v);
    const mk = (models, efforts) => parseList(models).map((raw, i) => {
      const hash = raw.lastIndexOf('#');
      const inlineModel = hash > 0 ? raw.slice(0, hash) : raw;
      const inlineEffort = hash > 0 ? raw.slice(hash + 1) : '';
      const fromLegacy = legacy(efforts)[i];
      const effort = EFFORTS.includes(inlineEffort) ? inlineEffort : EFFORTS.includes(fromLegacy) ? fromLegacy : 'default';
      return { model: inlineModel, effort };
    });
    ARENA = {
      runners: mk(S.settingsValues['arena.runners'], S.settingsValues['arena.runnerEffort']),
      judges: mk(S.settingsValues['arena.judge'], S.settingsValues['arena.judgeEffort']),
    };
    return ARENA;
  }
  const which = (side) => (side === 'runners' ? 'runners' : 'judges');
  const nth = (list, model, idx) => list.slice(0, idx + 1).filter((s) => s.model === model).length;

  function arenaChip(side, idx, s) {
    const list = arenaState()[which(side)];
    const n = nth(list, s.model, idx);
    const total = list.filter((x) => x.model === s.model).length;
    return `<span class="chip" data-side="${esc(side)}" data-idx="${idx}">
      <b>${side === 'runners' ? 'runner' : 'judge'}</b>
      <span class="chip-name" title="${esc(s.model)}">${esc(s.model)}</span>
      ${total > 1 ? `<i>#${n}</i>` : ''}
      <span class="chip-eff">${esc(s.effort)}</span>
      <button class="chip-x" data-chip-dup="${esc(side)}:${idx}" title="เพิ่มตัวซ้ำ">＋</button>
      <button class="chip-x" data-chip-rm="${esc(side)}:${idx}" title="ลบ">×</button>
    </span>`;
  }

  function renderArenaEditor() {
    const a = arenaState();
    const row = (side, title, hint) => `
      <div class="arena-row">
        <div class="arena-row-head"><strong>${title}</strong> <span class="small muted">${hint}</span></div>
        <div class="chips">
          ${a[side].map((s, i) => arenaChip(side === 'runners' ? 'runners' : 'judges', i, s)).join('') || '<span class="empty small">ยังไม่มี — กด “เพิ่มโมเดล”</span>'}
        </div>
        <div class="btn-row" style="margin-top:8px">
          <button class="btn tiny" data-arena-add="${side}">+ เพิ่มโมเดล</button>
          ${a[side].length ? `<button class="btn tiny ghost" data-arena-dup="${side}">+ ซ้ำตัวสุดท้าย</button>` : ''}
        </div>
      </div>`;

    const matrix = EFFORTS.map((eff) => {
      const slots = [];
      for (const side of ['runners', 'judges']) {
        a[side].forEach((s, i) => {
          if (s.effort === eff) slots.push({ side, idx: i, s });
        });
      }
      return `<div class="eff-box" data-eff="${eff}">
        <div class="eff-head"><strong>${eff}</strong><span class="small muted">${slots.length} ตัว</span></div>
        <div class="chips">${slots.map((x) => `<span class="chip small">
            <b>${x.side === 'runners' ? 'runner' : 'judge'}</b> ${esc(x.s.model)}${nth(a[x.side], x.s.model, x.idx) > 1 ? `<i>#${nth(a[x.side], x.s.model, x.idx)}</i>` : ''}
            <button class="chip-x" data-eff-reset="${x.side}:${x.idx}" title="กลับเป็น default">×</button>
          </span>`).join('') || '<span class="small muted">—</span>'}</div>
        <button class="btn tiny ghost" data-eff-add="${eff}" style="margin-top:6px">+ เลือกโมเดล</button>
      </div>`;
    }).join('');

    const total = a.runners.length + a.judges.length;
    return `<div class="card">
      ${row('runners', 'ผู้แข่ง (runner)', 'กี่ตัวก็ได้ · ซ้ำได้ · รันพร้อมกัน ลำดับไม่สำคัญ')}
      ${row('judges', 'กรรมการ (judge)', 'ควรต่างตระกูลจาก runner')}
      <details class="adv" ${total > 1 ? 'open' : ''}>
        <summary>กำหนด effort รายตัว (${total} ที่นั่ง)</summary>
        <p class="hint">แต่ละโมเดลตั้ง effort แยกได้ — กด “+ เลือกโมเดล” ในกล่องที่ต้องการ</p>
        <div class="eff-grid">${matrix}</div>
      </details>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn primary" data-save-group="arena">บันทึก ARENA</button>
        <button class="btn ghost" data-reload="1">โหลดค่าใหม่</button>
        <span class="small muted">${MODELS.excluded ? `ซ่อน ${MODELS.excluded} โมเดลที่ไม่ใช่ Harness` : ''}</span>
      </div>
    <p class="hint">เขียนลง <code>~/.agents/pstack-models.md</code> — <code>arena runners: model#effort, model#effort</code> · <code>arena cross-judge pool: model#effort</code> (ลำดับ = ที่นั่ง · ซ้ำได้)</p>
      <p class="hint">${esc(modelHint())}</p>
    </div>`;
  }

  /** เปิด panel เลือกหลายรายการ (ค้นหาได้ · ไม่ใช้ <select multiple>) */
  function openPick({ title, note = '', items, selected = [], onDone }) {
    const sel = new Set(selected);
    const render = (q = '') => {
      const list = items.filter((i) => `${i.label} ${i.id}`.toLowerCase().includes(q.toLowerCase()));
      $('#modalBody').innerHTML = `
        <p class="hint">${esc(note)}</p>
        <input id="pickSearch" placeholder="ค้นหา…" value="${esc(q)}" />
        <div class="pick-list">${list.map((i) => `<label class="pick-row">
          <input type="checkbox" data-pick="${esc(i.id)}" ${sel.has(i.id) ? 'checked' : ''} />
          <span>${esc(i.label)}</span>
          <code class="small">${esc(i.id)}</code>
        </label>`).join('') || '<div class="empty">ไม่พบ</div>'}</div>`;
      const search = $('#pickSearch');
      search.oninput = () => render(search.value);
      $$('[data-pick]').forEach((el) => {
        el.onchange = () => { if (el.checked) sel.add(el.dataset.pick); else sel.delete(el.dataset.pick); };
      });
      search.focus();
      search.setSelectionRange(q.length, q.length);
    };
    openModal({
      title,
      body: '',
      foot: '<button class="btn ghost" data-close="1">ยกเลิก</button><button class="btn primary" id="pickGo">ตกลง</button>',
    });
    render('');
    $('#pickGo').onclick = () => { closeModal(); onDone([...sel]); };
  }

  const modelItems = () => (MODELS.models || []).map((m) => ({ id: m.id, label: m.label || m.id }));

  function arenaAdd(side) {
    const cur = new Set(arenaState()[side].map((s) => s.model));
    openPick({
      title: `เพิ่ม${side === 'runners' ? 'ผู้แข่ง' : 'กรรมการ'}`,
      note: MODELS.ok ? `เลือกได้หลายตัว (ซ้ำได้ภายหลังด้วยปุ่ม ＋) · ${MODELS.models.length} โมเดล` : esc(modelHint()),
      items: modelItems().filter((i) => !cur.has(i.id) || true),
      selected: [],
      onDone: (ids) => {
        if (!ids.length) return;
        for (const id of ids) arenaState()[side].push({ model: id, effort: 'default' });
        renderModes();
      },
    });
  }

  function arenaPickEffort(eff) {
    const a = arenaState();
    const slots = [];
    for (const side of ['runners', 'judges']) a[side].forEach((s, i) => slots.push({ id: `${side}:${i}`, label: `${side === 'runners' ? 'runner' : 'judge'}-${s.model}`, cur: s.effort, side, idx: i }));
    const items = slots.map((s) => ({ id: s.id, label: `${s.label} (ตอนนี้: ${s.cur})` }));
    const selected = slots.filter((s) => s.cur === eff).map((s) => s.id);
    openPick({
      title: `ตั้ง effort = ${eff}`,
      note: 'เลือกที่นั่งที่จะใช้ effort นี้ (เอาออกจากกล่องอื่นให้อัตโนมัติ)',
      items,
      selected,
      onDone: (ids) => {
        const chosen = new Set(ids);
        for (const s of slots) {
          const next = chosen.has(s.id) ? eff : s.cur === eff ? 'default' : s.cur;
          arenaState()[s.side][s.idx].effort = next;
        }
        renderModes();
      },
    });
  }

  /* ---------------- แท็บ ระบบ ---------------- */
  let SYS = { backups: null, list: null, patch: null, locate: null };

  function renderSystem() {
    const p = S.plan;
    const plugin = p.entries.find((e) => e.id === 'plugin.bazer-flow');
    const plugProbe = (S.probes?.results || []).find((r) => r.id === 'plugin-registered');
    const app = S.app;
    const up = Math.max(0, Math.round((Date.now() - (app.startedAt || Date.now())) / 1000));
    const hhmm = `${Math.floor(up / 3600)} ชม. ${Math.floor((up % 3600) / 60)} น.`;
    const backups = SYS.backups || [];
    const loc = SYS.locate;

    $('#view-system').innerHTML = `
      <h2 class="section">ปลั๊กอิน gate (bazer-flow)</h2>
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:center">
          <h3>ต้นทางใน MAJOR → ปลายทางในเครื่อง</h3>
          <span>${badge(plugin?.state || 'design')}</span>
        </div>
        <p class="muted">Console เทียบไฟล์จริงกับ <code>AGENT/04PLUGIN/bazer-flow</code> — กดติดตั้งแล้วไฟล์ส่วนเกิน (ซากรุ่นเก่า) จะถูกย้ายเข้า backup ไม่ลบทิ้ง</p>
        <p class="hint">ลงทะเบียนใน config: ${plugProbe ? (plugProbe.ok ? '<b>มีแล้ว</b>' : '<b>ยังไม่มี</b>') : 'ยังไม่ได้ตรวจ (กด “ตรวจของจริง”)'} · ${esc(plugin?.target || '')}</p>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn primary" data-apply-one="plugin.bazer-flow">ติดตั้ง / อัปเดตไฟล์</button>
          <button class="btn danger" data-act="plugin-register" data-params='{"name":"bazer-flow"}'>ลงทะเบียนใน config</button>
          <button class="btn ghost" data-act="retire-old-flow">ถอดจาก config</button>
          <button class="btn ghost" data-act="probe">ตรวจของจริง</button>
        </div>
      </div>

      <h2 class="section">เครื่องมือ</h2>
      <div class="grid c2">
        <div class="card"><h3>ติดตั้งเครื่องมือที่ขาด</h3>
          <p>Node · OpenCode · ปลั๊กอิน Plannotator — ตรวจผ่าน probe (รวม version ขั้นต่ำ)</p>
          <div class="btn-row" style="margin-top:10px"><button class="btn" data-act="install-tools">ตรวจ/ติดตั้ง</button></div>
        </div>
        <div class="card"><h3>ปลั๊กอินที่ OpenCode เห็น</h3>
          <p>อ่านจาก <code>opencode plugin list</code></p>
          <div class="btn-row" style="margin-top:10px">
            <button class="btn ghost" data-act="plugin-list">ดูรายการ</button>
            <button class="btn danger" data-act="plugin-update" data-params='{"package":"@plannotator/opencode"}'>อัพเดต Plannotator plugin</button>
          </div>
          ${SYS.list ? `<pre class="code small" style="margin-top:10px">${esc(SYS.list.join('\n'))}</pre>` : ''}
        </div>
      </div>

      <h2 class="section">Plannotator</h2>
      <div class="card">
        <p class="muted">"อนุมัติแล้วกลับโหมดไหน" เป็น <strong>ค่าที่เลือกในหน้า review UI</strong> ของ Plannotator (ปลั๊กอินจะเรียก <code>session.switchAgent</code> ให้) — ไม่มีไฟล์ให้ Console แพตช์ · ที่ Console ตั้งได้คือ <code>options</code> ของปลั๊กอิน</p>
        ${loc ? `<p class="hint">รูปแบบที่ตรวจเจอ: <b>${esc(loc.kind === 'cli-only' ? 'UI ฝังใน exe (CLI)' : loc.kind === 'files' ? 'มีไฟล์ปลั๊กอิน' : 'ไม่พบ')}</b> · สแกน ${loc.scanned} ไฟล์ ใน ${loc.roots.length} โฟลเดอร์</p>` : ''}
        <div class="btn-row" style="margin-top:10px">
          <button class="btn ghost" data-act="plannotator-locate">ตรวจ Plannotator</button>
          <button class="btn ghost" data-act="open-target" data-params='{"which":"plannotator"}'>เปิดโฟลเดอร์ข้อมูล (plans/config)</button>
        </div>
        <p class="hint">Console แตะ Plannotator ได้ 3 อย่างเท่านั้น: <strong>ตรวจ</strong> (เจอ CLI/ปลั๊กอินไหม) · <strong>ตั้ง options</strong> (workflow/runtime/planningAgents) · <strong>เปิดโฟลเดอร์ข้อมูล</strong> — ไม่มีการแพตช์ไฟล์ เพราะ UI อยู่ใน exe</p>
        <div class="arena-bar" style="margin-top:14px">
          <div class="field"><label>workflow</label>
            <select id="plWorkflow">
              <option value="plan-agent">plan-agent (ค่าเริ่มต้น)</option>
              <option value="user-managed">user-managed (Console/เรา คุม permission เอง)</option>
              <option value="all-agents">all-agents</option>
              <option value="manual">manual (ไม่ลงทะเบียน tool)</option>
            </select>
          </div>
          <div class="field"><label>runtime</label>
            <select id="plRuntime">
              <option value="">auto</option>
              <option value="cli">cli (บังคับใช้ CLI)</option>
            </select>
          </div>
          <div class="field"><label>planningAgents</label>
            <select id="plTarget">
              <option value="buddha">buddha</option>
              <option value="bazer">bazer</option>
            </select>
          </div>
          <button class="btn primary" id="plSave">บันทึก options</button>
        </div>
        <p class="hint">งานของเราใช้ <code>user-managed</code> ได้ถ้าไม่อยากให้ปลั๊กอินแก้ prompt/permission เอง (gate เป็นหน้าที่ของ <code>bazer-flow</code> + <code>PLANNOTATOR</code> อยู่แล้ว) · มีผลหลังเปิด OpenCode ใหม่</p>
      </div>

      <h2 class="section">Backup</h2>
      <div class="card">
        <div class="btn-row" style="margin-bottom:10px"><button class="btn ghost" data-act="backup-list">ดูรายการ backup</button></div>
        ${backups.length ? `<table><thead><tr><th>รอบ</th><th>เวลา</th><th>ไฟล์</th><th></th></tr></thead><tbody>${backups.map((b) => `<tr>
            <td class="mono small">${esc(b.stamp)}</td>
            <td class="small muted">${esc((b.at || '').replace('T', ' ').slice(0, 19))}</td>
            <td class="small">${b.count} ไฟล์${b.pruned ? ' · มีไฟล์ที่ถูก prune' : ''}</td>
            <td><button class="btn tiny ghost" data-bk-open="${esc(b.stamp)}">ดูไฟล์</button></td>
          </tr>`).join('')}</tbody></table>` : '<div class="empty">กด “ดูรายการ backup” เพื่ออ่านจาก var/backups</div>'}
      </div>

      <h2 class="section">เซิร์ฟเวอร์</h2>
      <div class="card">
        <table><tbody>
          <tr><td class="muted">พอร์ต</td><td class="mono">${app.port}</td></tr>
          <tr><td class="muted">PID</td><td class="mono">${app.pid}</td></tr>
          <tr><td class="muted">ทำงานมา</td><td class="mono">${hhmm}</td></tr>
          <tr><td class="muted">โหมด home</td><td class="mono small">${esc(app.home || '(เครื่องนี้)')}</td></tr>
          <tr><td class="muted">MAJOR</td><td class="mono small">${esc(app.root)}</td></tr>
          <tr><td class="muted">node</td><td class="mono small">${esc(app.node)}</td></tr>
        </tbody></table>
        <div class="btn-row" style="margin-top:10px"><button class="btn ghost" data-act="open-target" data-params='{"which":"plugins"}'>เปิดโฟลเดอร์ปลั๊กอิน</button></div>
      </div>`;
  }

  function openBackupFiles(stamp) {
    const b = (SYS.backups || []).find((x) => x.stamp === stamp);
    if (!b) return;
    openModal({
      title: `backup ${stamp}`,
      body: `<p class="hint">เลือกไฟล์ที่จะคืน — ระบบสำรองของปัจจุบันก่อนเขียนทับเสมอ</p>
        <table><thead><tr><th>ไฟล์</th><th>ปลายทาง</th><th></th></tr></thead><tbody>
        ${b.items.map((it) => `<tr>
          <td class="mono small">${esc(it.name)}</td>
          <td class="mono small muted">${esc(it.target)}</td>
          <td><button class="btn tiny danger" data-bk-restore="${esc(it.target)}" data-bk-stamp="${esc(stamp)}">คืนไฟล์นี้</button></td>
        </tr>`).join('') || '<tr><td colspan="3" class="empty">รอบนี้ไม่มีไฟล์</td></tr>'}
        </tbody></table>`,
      foot: '<button class="btn ghost" data-close="1">ปิด</button>',
    });
  }

  function renderModes() {
    const agents = S.plan.entries.filter((e) => e.kind === 'agent');
    const ladderCard = () => {
      const L = S.ladder || { level: 0, expires: null, valid: true };
      const left = L.expires == null ? null : Math.max(0, L.expires - Date.now());
      const leftText = left == null ? 'ไม่กำหนด' : `${Math.floor(left / 3600000)} ชม. ${Math.floor((left % 3600000) / 60000)} น.`;
      const expText = L.expires == null ? 'ไม่กำหนด' : new Date(L.expires).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
      return `<h2 class="section">บันได 3 ขั้น · BUDDHA / BAZER</h2>
      <div class="card">
        <p class="muted">L0 อ่านอย่างเดียว · L1 แก้ตาม GATE · L2 เหมาเข่ง (ต้องพิมพ์ยืนยัน) · เขียน <code>ladder.json</code> ของปลั๊กอิน</p>
        <div class="ladder" style="margin-top:12px">
          ${[0, 1, 2].map((lv) => `<label class="step ${L.level === lv ? 'active' : ''}" style="cursor:pointer">
            <input type="radio" name="ladderLevel" data-ladder-level="${lv}" ${L.level === lv ? 'checked' : ''}>
            <div class="num">L${lv}</div>
            <div><div class="name">${lv === 0 ? 'อ่านอย่างเดียว' : lv === 1 ? 'แก้โปรเจกต์ตาม GATE' : 'เหมาเข่ง'}</div>
            <span class="risk-why">${lv === 0 ? 'ไม่เขียนไฟล์โปรเจกต์' : lv === 1 ? 'เขียน/รันได้หลังผ่านด่าน' : 'เปิดงานเขียน build/test/commit เว็บ — ยังกันของอันตราย'}</span></div>
          </label>`).join('')}
        </div>
        <p class="small muted">ระดับปัจจุบัน L${L.level} · หมดอายุ ${esc(expText)} · เหลือ ${esc(leftText)}${L.valid ? '' : ' · ไฟล์ไม่ถูกต้อง/หมดอายุ → ใช้ L0'}${S.ladderNotice ? ` · ${esc(S.ladderNotice)}` : ''}</p>
      </div>`;
    };
    const arenaCtl = S.settings.groups.find((g) => g.id === 'arena')?.controls || [];

    const modeCards = agents.map((e) => {
      const key = e.id.split('.').pop();
      return `<div class="card mode-card ${key}">
        <h3><span class="mode-dot" style="background:${MODE_COLORS[key] || '#999'}"></span>${esc(e.title.replace('โหมด ', ''))}</h3>
        <p>${esc(MODE_ROLE[key] || '')}</p>
        <div class="btn-row" style="margin-top:10px">${badge(e.state)}<span class="mono muted small">${esc(e.target || '')}</span></div>
      </div>`;
    }).join('');

    $('#view-modes').innerHTML = `
      <h2 class="section">โหมดหลัก</h2>
      <div class="grid c2">${modeCards}</div>

      ${ladderCard()}

      <h2 class="section">โมเดล &amp; Effort ของ ARENA</h2>
      ${renderArenaEditor()}

      <h2 class="section">Plannotator</h2>
      <div class="card">
        <p class="muted">"อนุมัติแล้วกลับโหมดไหน" เลือกในหน้า review UI (ปลั๊กอินเรียก <code>session.switchAgent</code>) — งานของเราไม่พึ่งค่านั้น เพราะ <code>bazer-flow</code> ล็อกเซสชันไว้ และ <code>PLANNOTATOR</code> อ่านผลจาก <code>--result-file</code></p>
        <p class="hint">ตั้ง <code>workflow</code> / <code>runtime</code> / <code>planningAgents</code> ได้ที่ <strong>แท็บ ระบบ → Plannotator</strong></p>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn ghost" data-act="plannotator-locate">ตรวจ Plannotator</button>
          <button class="btn ghost" data-act="open-target" data-params='{"which":"plannotator"}'>เปิดโฟลเดอร์ข้อมูล</button>
        </div>
      </div>

      <h2 class="section">โหมดที่มากับ OpenCode</h2>
      <div class="grid c2">
        <div class="card"><h3>Plan &amp; Build</h3><p>ซ่อนด้วย config (ไม่ลบไฟล์) — ย้อนกลับได้ทุกเมื่อ</p>
          <div class="btn-row" style="margin-top:10px">
            <button class="btn" data-act="builtin-toggle" data-params='{"mode":"off"}'>ซ่อน</button>
            <button class="btn ghost" data-act="builtin-toggle" data-params='{"mode":"on"}'>คืนค่า</button>
          </div></div>
        <div class="card"><h3>ปลั๊กอินเก่า bazer-flow</h3><p>ถอดออกจาก config เมื่อติดตั้งชุดใหม่เสร็จแล้วเท่านั้น</p>
          <div class="btn-row" style="margin-top:10px"><button class="btn danger" data-act="retire-old-flow">ถอด</button></div></div>
      </div>`;
  }

  function entryRow(e) {
    const canApply = ['missing', 'stale'].includes(e.state) && e.writable && e.auto;
    const manual = ['missing', 'stale'].includes(e.state) && e.writable && !e.auto;
    const canReset = e.strategy === 'template-once';
    return `<tr>
      <td><div><strong>${esc(e.title)}</strong></div><div class="mono muted small">${esc(e.id)}</div></td>
      <td>${badge(e.state)}</td>
      <td class="mono small muted">${esc(e.target || '')}</td>
      <td class="small muted">${esc(e.note || '')}</td>
      <td style="white-space:nowrap">
        <button class="btn tiny ghost" data-diff="${esc(e.id)}">ดู diff</button>
        ${canApply ? `<button class="btn tiny" data-apply-one="${esc(e.id)}">ติดตั้ง</button>` : ''}
        ${manual ? '<span class="small muted" title="auto=false — ต้องสั่งจากหน้า โหมด &amp; สิทธิ์ หรือ Ctrl+K">สั่งเอง</span>' : ''}
        ${canReset ? `<button class="btn tiny danger" data-reset="${esc(e.id)}">รีเซ็ต</button>` : ''}
      </td></tr>`;
  }

  function renderCleanup() {
    const c = S.cleanup;
    if (!c) return '<div class="empty">ยังไม่มีข้อมูล — กด ตรวจใหม่</div>';
    const total = c.groups.reduce((a, g) => a + g.count, 0);
    if (!total) return '<div class="empty">สะอาดแล้ว — ไม่มีของเก่าที่ไม่ใช่ของ MAJOR</div>';
    const defaultOn = new Set(['agents', 'mirrors', 'plugins', 'plugin-dirs']);
    return `<div class="card">
      <h3>เคลียร์ของเก่า</h3>
      <p>ย้ายออกจากโฟลเดอร์ระบบไปเก็บที่ <code>ACTIVE/var/quarantine/&lt;เวลา&gt;</code> — ไม่ได้ลบทิ้ง กู้คืนได้</p>
      <table style="margin-top:12px">
        <thead><tr><th>เลือก</th><th>กลุ่ม</th><th>จำนวน</th><th>รายการ</th></tr></thead>
        <tbody>${c.groups.map((g) => `<tr>
          <td><input type="checkbox" data-clean-group="${esc(g.id)}" ${defaultOn.has(g.id) && g.count ? 'checked' : ''} ${g.count ? '' : 'disabled'} style="width:auto"></td>
          <td><strong>${esc(g.title)}</strong><div class="hint">${esc(g.hint || '')}</div></td>
          <td>${g.count}</td>
          <td class="mono small muted">${g.items.slice(0, 8).map((i) => esc(i.name)).join('<br>')}${g.count > 8 ? `<br>… อีก ${g.count - 8}` : ''}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn danger" id="cleanupGo">ย้ายของเก่าไป quarantine</button>
        <button class="btn ghost" data-act="cleanup-plan">ตรวจใหม่</button>
      </div>
    </div>`;
  }

  function renderFiles() {
    const all = S.plan.entries;
    const rows = FILE_SUB === 'pstack' ? all.filter((e) => e.kind === 'skill')
      : FILE_SUB === 'bazer' ? all.filter((e) => e.kind === 'skill' && /03SKILLS[\\/]BAZER/i.test(S.manifest.entries.find((m) => m.id === e.id)?.source || ''))
      : all;
    const oldTotal = (S.cleanup?.groups || []).reduce((a, g) => a + g.count, 0);

    $('#view-files').innerHTML = `
      <div class="subtabs">
        ${[['all', 'ทั้งหมด'], ['pstack', 'PSTACK'], ['bazer', 'BAZER'], ['foreign', `ของเก่า (${oldTotal})`]]
          .map(([k, t]) => `<button data-filesub="${k}" class="${FILE_SUB === k ? 'active' : ''}">${t}</button>`).join('')}
      </div>
      <div class="btn-row" style="margin:0 0 10px">
        <span class="small muted">เปิดโฟลเดอร์:</span>
        <button class="btn tiny ghost" data-params='{"which":"config"}' data-act="open-target">ตั้งค่า OpenCode</button>
        <button class="btn tiny ghost" data-params='{"which":"skills"}' data-act="open-target">สกิล</button>
        <button class="btn tiny ghost" data-params='{"which":"major"}' data-act="open-target">MAJOR</button>
        <button class="btn tiny ghost" data-params='{"which":"backups"}' data-act="open-target">backups</button>
      </div>
      ${FILE_SUB === 'foreign'
        ? renderCleanup()
        : `<div class="card"><table><thead><tr><th>รายการ</th><th>สถานะ</th><th>ปลายทาง</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>${rows.map(entryRow).join('')}</tbody></table></div>`}
      ${FILE_SUB === 'bazer' ? '<div class="empty" style="margin-top:12px">03SKILLS/BAZER ยังว่างโดยเจตนา — เติมเมื่อมี skill ของเราเอง</div>' : ''}`;
  }

  function controlField(c) {
    const v = DRAFTS[c.id] ?? S.settingsValues[c.id] ?? '';
    const isModel = c.type === 'model';
    const isList = c.type === 'keybind-list';
    const input = c.type === 'select'
      ? `<select data-draft="${esc(c.id)}">${(c.options || []).map((o) => `<option value="${esc(o)}" ${String(o) === String(v) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : c.type === 'toggle'
        ? `<label class="small"><input type="checkbox" data-draft="${esc(c.id)}" ${v ? 'checked' : ''} style="width:auto"> เปิด</label>`
        : isModel ? modelDropdown(c.id, String(v ?? ''))
          : `<input data-draft="${esc(c.id)}" ${isList ? 'data-list="1"' : ''} value="${esc(Array.isArray(v) ? v.join(', ') : v)}" placeholder="${esc(c.placeholder || '')}" type="${c.type === 'number' ? 'number' : 'text'}" />`;
    return `<div class="field"><label>${esc(c.label)}</label>${input}${riskBadge(c.risk.level, c.risk.why)}</div>`;
  }

  let QUICK_SUB = 'buddha';
  const QUICK_MODES = ['buddha', 'bazer', 'snack', 'advisor'];
  const QUICK_MODE_LABEL = { buddha: 'BUDDHA', bazer: 'BAZER', snack: 'SNACK', advisor: 'ADVISOR' };
  const KEYBIND_FIXED = ['ctrl+alt+m', 'ctrl+alt+o'];
  const quickDrift = (mode) => (S.drift || []).find((d) => d.mode === mode);

  function renderQuick() {
    const group = S.settings.groups.find((g) => g.id === 'quick');
    if (!group) { $('#view-quick').innerHTML = '<div class="empty">ไม่พบกลุ่ม Quick Access ใน settings.json</div>'; return; }
    const byId = new Map(group.controls.map((c) => [c.id, c]));
    const lock = byId.get('lock.models');
    const sub = QUICK_SUB === 'keys' ? 'keys' : (QUICK_MODES.includes(QUICK_SUB) ? QUICK_SUB : 'buddha');

    const tabs = `
      <div class="subtabs">
        ${QUICK_MODES.map((m) => `<button data-quicksub="${m}" class="${sub === m ? 'active' : ''}">${QUICK_MODE_LABEL[m]}</button>`).join('')}
        <button data-quicksub="keys" class="${sub === 'keys' ? 'active' : ''}">คีย์ลัด</button>
      </div>`;

    if (sub === 'keys') {
      const cfg = byId.get('keybind.copy');
      const cur = S.settingsValues['keybind.copy'];
      const curTxt = Array.isArray(cur) ? cur.join(', ') : String(cur ?? '');
      const want = KEYBIND_FIXED.join(', ');
      $('#view-quick').innerHTML = `
        ${tabs}
        <div class="card">
          <h3>คีย์ copy ข้อความล่าสุด</h3>
          <p class="hint">ค่าคงที่ของระบบ — ไม่ให้แก้ (เลี่ยงคีย์ชนกัน)</p>
          <div class="row" style="gap:10px;align-items:center;margin-top:10px">
            <code class="mono">${esc(want)}</code>
            ${curTxt === want ? '<span class="badge ok">ตรงแล้ว</span>' : `<span class="badge stale">ตอนนี้: ${esc(curTxt || '(ไม่มี)')}</span>`}
          </div>
          <div class="btn-row" style="margin-top:12px">
            <button class="btn primary" data-fixed-keybind="1" ${curTxt === want ? 'disabled title="ตรงกับค่าคงที่อยู่แล้ว"' : ''}>เขียนคีย์ลัดลงระบบ</button>
            <button class="btn ghost" data-reload="1">โหลดค่าใหม่</button>
          </div>
          ${cfg?.risk ? `<p class="hint">${riskBadge(cfg.risk.level, cfg.risk.why)}</p>` : ''}
          <p class="hint">เขียนลง <code>tui.json → keybinds.messages_copy</code> (array) — ไม่ทับคีย์อื่น</p>
        </div>`;
      return;
    }

    const d = quickDrift(sub);
    $('#view-quick').innerHTML = `
      ${tabs}
      <div class="card">
        <h3>${QUICK_MODE_LABEL[sub]}</h3>
        <p class="hint">โมเดล + effort ของโหมดนี้ — snapshot/คืนค่าแยกจากโหมดอื่น</p>
        <div class="grid c2" style="margin-top:12px">
          ${[byId.get(`model.${sub}`), byId.get(`variant.${sub}`)].filter(Boolean).map(controlField).join('')}
        </div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn primary" data-quick-save="${sub}">บันทึกเฉพาะช่องที่แก้</button>
          <button class="btn ghost" data-reload="1">โหลดค่าใหม่</button>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn" data-lock-snap="${sub}">ถ่าย snapshot โหมดนี้</button>
          <button class="btn ${d ? 'danger' : ''}" data-lock-back="${sub}" ${d ? '' : 'disabled title="ยังไม่มี drift ของโหมดนี้"'}>คืนค่าตาม snapshot</button>
          ${d ? `<span class="small" style="color:var(--warn)">drift: ตั้งไว้ <code>${esc(d.was.model || '-')}/${esc(d.was.variant || '-')}</code> · ตอนนี้ <code>${esc(d.now.model || '-')}/${esc(d.now.variant || '-')}</code></span>` : ''}
        </div>
        <p class="hint" style="margin-top:10px">Quick Access แก้เฉพาะคีย์ที่เปลี่ยน — ถ้าต้องแก้ทั้งไฟล์ ไปที่ <strong>ตั้งค่า → การตั้งค่าฉบับเต็ม</strong></p>
        <p class="hint">${esc(modelHint())}</p>
      </div>
      ${lock ? `<div class="card" style="margin-top:12px">
        <h3>การเฝ้าค่า (ทั้งระบบ)</h3>
        ${controlField(lock)}
        <p class="hint">เป็นการเฝ้าระวัง ไม่ได้บล็อก: ถ้าไฟล์ config ถูกเปลี่ยน ระบบจะขึ้นแบนเนอร์เตือนตอนเปิด Console (ค่าที่เปลี่ยนผ่าน /models ใน session มองไม่เห็น)</p>
      </div>` : ''}`;
  }

  function renderSettings() {
    const full = S.settings.full;
    const ps = S.settings.pstack;
    const other = S.settings.groups.find((g) => g.id === 'other');
    const pstackRows = ps.roles.map((r) => `<tr>
        <td class="mono small">${esc(r.line)}</td>
        <td><input data-draft="pstack.${esc(r.id)}" data-list="1" list="bazer-models" value="${esc(DRAFTS[`pstack.${r.id}`] ?? S.settingsValues[`pstack.${r.id}`] ?? r.default ?? '')}" /></td>
      </tr>`).join('');
    const editors = (full?.files || []).map((f) => {
      const raw = (S.rawSettings || {})[f.id] || { text: '', file: '', exists: false };
      return `<div class="card" style="margin-top:12px">
        <div class="row" style="justify-content:space-between;align-items:center">
          <h3>${esc(f.label)}</h3>
          ${raw.exists ? '<span class="badge ok">มีไฟล์</span>' : '<span class="badge missing">ยังไม่มี — จะสร้างใหม่</span>'}
        </div>
        <p class="hint">${esc(f.note || '')} · <span class="mono">${esc(raw.file || '')}</span></p>
        <textarea class="code" data-full="${esc(f.id)}" spellcheck="false">${esc(FULL_DRAFT[f.id] ?? raw.text ?? '{\n}\n')}</textarea>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn" data-validate="${esc(f.id)}">ตรวจ JSON</button>
          <button class="btn danger" data-fullsave="${esc(f.id)}">เขียนทับทั้งไฟล์</button>
        </div>
      </div>`;
    }).join('');

    $('#view-settings').innerHTML = `
      <div class="subtabs">
        <button data-setsub="full" class="${SET_SUB === 'full' ? 'active' : ''}">การตั้งค่าฉบับเต็ม</button>
        <button data-setsub="pstack" class="${SET_SUB === 'pstack' ? 'active' : ''}">PSTACK roles</button>
        <button data-setsub="other" class="${SET_SUB === 'other' ? 'active' : ''}">ตั้งค่าอื่น ๆ</button>
      </div>
      ${SET_SUB === 'pstack' ? `
        <div class="card">
          <h3>Preset</h3><p>เลือกวิธีเติมทั้ง 15 role — ไม่ต้องนั่งไล่ทีละบรรทัด</p>
          <div class="arena-bar" style="margin-top:12px">
            <div class="field"><label>แบบ</label><select id="presetMode">
              <option value="uniform">ใช้ตัวเดียวทั้งชุด</option>
              <option value="split">แยกงานเขียน / งานตัดสิน</option>
            </select></div>
            <div class="field"><label>โมเดล A (งานเขียน)</label><input id="presetA" list="bazer-models" placeholder="เช่น grok-4.7-xhigh-fast" /></div>
            <div class="field"><label>โมเดล B (งานตัดสิน)</label><input id="presetB" list="bazer-models" placeholder="เช่น claude-opus-5-5-xhigh" /></div>
            <button class="btn primary" id="presetGo">เติมทั้งชุด</button>
          </div>
          <p class="hint">${esc(modelHint())}</p>
        </div>
        <div class="card" style="margin-top:12px">
          <table><thead><tr><th>role</th><th>โมเดล</th></tr></thead><tbody>${pstackRows}</tbody></table>
          <div class="btn-row" style="margin-top:12px"><button class="btn primary" data-save-group="pstack">บันทึก PSTACK</button></div>
        </div>`
      : SET_SUB === 'full' ? `
        <div class="card">
          <h3>${esc(full?.title || 'การตั้งค่าฉบับเต็ม')}</h3>
          <p>${esc(full?.subtitle || '')}</p>
          <p class="hint">การบันทึกที่นี่ = <strong>เขียนทับทั้งไฟล์</strong> ต่างจาก Quick Access ที่แก้เฉพาะบรรทัด — ระบบตรวจ JSON และสำรองไฟล์เดิมก่อนทุกครั้ง</p>
        </div>
        ${editors}`
      : `<div class="card">
          <h3>${esc(other?.title || 'ตั้งค่าอื่น ๆ')}</h3><p>${esc(other?.subtitle || '')}</p>
          <div class="grid c2" style="margin-top:12px">${(other?.controls || []).map(controlField).join('')}</div>
          <div class="btn-row" style="margin-top:14px">
            <button class="btn primary" data-save-group="other">บันทึก</button>
            <button class="btn ghost" data-reload="1">โหลดค่าใหม่</button>
          </div>
        </div>`}`;
  }

  function renderHistory() {
    const rows = S.history.map((h) => `<tr>
      <td class="mono small">${esc((h.at || '').replace('T', ' ').slice(0, 19))}</td>
      <td class="mono small">${esc(h.entry)}</td>
      <td class="mono small muted">${esc(h.target)}</td>
      <td>${esc(h.result || '')}</td>
      <td><button class="btn tiny danger" data-rollback="${esc(h.stamp)}">ย้อนรอบนี้</button></td></tr>`).join('');
    $('#view-history').innerHTML = `
      <h2 class="section">ประวัติการเขียนไฟล์</h2>
      <div class="btn-row" style="margin-bottom:10px"><button class="btn ghost" data-act="history-list">อ่านประวัติล่าสุด (200)</button></div>
      <div class="card">${rows ? `<table><thead><tr><th>เวลา</th><th>รายการ</th><th>ไฟล์</th><th>ผล</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">ยังไม่มีการเขียนไฟล์</div>'}</div>`;
  }

  function showTab(tab) {
    TAB = tab;
    $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.view').forEach((v) => { v.hidden = v.id !== `view-${tab}`; });
    const active = $(`#view-${tab}`);
    if (active) { active.style.animation = 'none'; void active.offsetWidth; active.style.animation = ''; }
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-close],[data-tab],[data-quicksub],[data-quick-save],[data-lock-snap],[data-lock-back],[data-fixed-keybind],[data-act],[data-diff],[data-apply-one],[data-reset],[data-ladder],[data-filesub],[data-setsub],[data-save-group],[data-reload],[data-rollback],[data-validate],[data-fullsave]');
    if (!t) return;

    if (t.dataset.close) return closeModal();
    if (t.dataset.tab) return showTab(t.dataset.tab);
    if (t.dataset.filesub) { FILE_SUB = t.dataset.filesub; return renderFiles(); }
    if (t.dataset.setsub) { SET_SUB = t.dataset.setsub; return renderSettings(); }
    if (t.dataset.reload) return load();

    if (t.dataset.validate) {
      const ta = $(`[data-full="${t.dataset.validate}"]`);
      try { JSON.parse(ta.value); toast('JSON ถูกต้อง', `${ta.value.length} ตัวอักษร`, 'ok'); }
      catch (e) { toast('JSON ไม่ถูกต้อง', e.message, 'err'); }
      return;
    }

    if (t.dataset.fullsave) {
      const id = t.dataset.fullsave;
      const ta = $(`[data-full="${id}"]`);
      try { JSON.parse(ta.value); } catch (e) { return toast('JSON ไม่ถูกต้อง', e.message, 'err'); }
      return confirmSheet({
        title: `เขียนทับทั้งไฟล์ · ${id}.json`,
        risk: { level: 3, why: 'ค่าที่ไม่ได้อยู่ในเนื้อหาจะหายไป — ระบบสำรองไฟล์เดิมไว้ใน var/backups และตรวจ JSON ก่อนเขียน' },
        body: `<p>จะเขียนทับทั้งไฟล์ด้วยเนื้อหาที่แก้ (${ta.value.length} ตัวอักษร)</p><p class="hint">ต่างจาก Quick Access ที่แก้เฉพาะบรรทัด</p>`,
        confirmText: 'เขียนทับทั้งไฟล์',
        onConfirm: () => act('settings-full', { file: id, content: ta.value }, { confirmed: true }),
      });
    }

    if (t.dataset.diff) {
      const d = await api(`/api/diff?entry=${encodeURIComponent(t.dataset.diff)}`);
      if (d.error) return toast('ผิดพลาด', d.error, 'err');
      const body = d.files
        ? `<table><thead><tr><th>ไฟล์</th><th>สถานะ</th></tr></thead><tbody>${d.files.map((f) => `<tr><td class="mono small">${esc(f.rel)}</td><td>${f.state === 'new' ? '<span class="badge missing">ใหม่</span>' : f.state === 'diff' ? '<span class="badge stale">ต่าง</span>' : '<span class="badge ok">ตรง</span>'}</td></tr>`).join('')}</tbody></table>`
        : `<div class="diff"><div><p class="diff-head">ก่อน</p><pre class="old">${esc(d.before || '(ไม่มีไฟล์)')}</pre></div><div><p class="diff-head">หลัง</p><pre class="new">${esc(d.after || '')}</pre></div></div>`;
      return openModal({ title: `diff · ${d.id}`, body, foot: `<button class="btn ghost" data-close="1">ปิด</button>` });
    }

    if (t.dataset.applyOne) return act('apply', { ids: [t.dataset.applyOne] });

    if (t.dataset.reset) {
      return confirmSheet({
        title: `รีเซ็ต ${t.dataset.reset} จาก template`,
        risk: { level: 3, why: 'เขียนทับไฟล์ในเครื่องด้วยแม่แบบจาก MAJOR — ค่าที่คุณแก้เองจะหาย (สำรองไว้ใน var/backups)' },
        body: '<p>ใช้เมื่อไฟล์ระบบรุ่นเก่าค้างอยู่ (เช่น AGENTS.md ที่ยังมีกฎเก่า) และคุณต้องการให้ตรงกับ MAJOR เท่านั้น</p>',
        confirmText: 'เขียนทับ',
        onConfirm: () => act('reset-template', { id: t.dataset.reset }, { confirmed: true }),
      });
    }

    if (t.dataset.ladderLevel) {
      const level = Number(t.dataset.ladderLevel);
      const go = (confirm) => act('ladder-set', { level, confirm: String(confirm || '') });
      if (level !== 2) return go();
      openModal({
        title: 'L2 เหมาเข่ง — ต้องพิมพ์ยืนยัน',
        body: `<p>L2 เปิด: เขียนไฟล์โปรเจกต์หลังผ่าน GATE 2 · build/test/commit · เรียกเว็บ</p>
          <p class="small muted">ยังบล็อก/ถามเสมอ: protected paths · force-push · reset --hard · clean -f · ลบนอก %TEMP% · คำสั่งที่จำแนกไม่ได้</p>
          <input id="ladderConfirm" style="width:100%;margin-top:10px" placeholder="พิมพ์ เหมาเข่ง">`,
        foot: '<button class="btn ghost" data-close="1">ยกเลิก</button><button class="btn primary" id="ladderGo">ยืนยัน L2</button>',
      });
      $('#ladderGo').onclick = () => {
        const v = $('#ladderConfirm').value.trim();
        if (v !== 'เหมาเข่ง') return toast('ยังไม่ยืนยัน', 'ต้องพิมพ์ เหมาเข่ง ให้ตรง', 'err');
        closeModal();
        go(v);
      };
      return;
    }

    if (t.dataset.saveGroup) {
      const groupId = t.dataset.saveGroup;
      if (groupId === 'arena') {
        const a = arenaState();
        if (!a.runners.length) return toast('ยังไม่มีผู้แข่ง', 'เลือก runner อย่างน้อย 1 ตัวก่อนบันทึก', 'err');
        const patches = [
          { id: 'arena.runners', value: a.runners.map((s) => `${s.model}#${s.effort}`).join(', ') },
          { id: 'arena.judge', value: a.judges.map((s) => `${s.model}#${s.effort}`).join(', ') },
        ];
        return act('settings-save', { patches });
      }
      const controls = groupId === 'pstack'
        ? S.settings.pstack.roles.map((r) => ({ id: `pstack.${r.id}`, cur: S.settingsValues[`pstack.${r.id}`] }))
        : (S.settings.groups.find((g) => g.id === groupId) || { controls: [] }).controls.map((c) => ({ id: c.id, cur: S.settingsValues[c.id] }));
      const patches = [];
      for (const c of controls) {
        const el = $(`[data-draft="${c.id}"]`);
        if (!el) continue;
        let val = el.type === 'checkbox' ? el.checked : el.value;
        if (typeof val === 'string') val = val.trim();
        // ฟิลด์ประเภทลิสต์ (เช่นคีย์ลัด/โมเดลหลายตัว) ต้องเขียนเป็น array ไม่ใช่สตริง
        if (el.dataset.list === '1' && typeof val === 'string') {
          val = val.split(',').map((s) => s.trim()).filter(Boolean);
        }
        // line strategy เก็บเป็นสตริง — รวมลิสต์กลับก่อนเทียบ/เขียน
        const cur = c.cur ?? '';
        const next = Array.isArray(val) && !Array.isArray(cur) ? val.join(', ') : val;
        if (JSON.stringify(next) !== JSON.stringify(cur)) patches.push({ id: c.id, value: next });
      }
      if (!patches.length) return toast('ไม่มีอะไรเปลี่ยน', 'แก้ช่องที่ต้องการก่อน', 'ok');
      return act('settings-save', { patches });
    }

    if (t.dataset.rollback) {
      return confirmSheet({
        title: `ย้อนรอบ ${t.dataset.rollback}`,
        risk: { level: 3, why: 'เขียนทับไฟล์ระบบด้วยสำเนาเก่า — งานที่ทำหลังรอบนั้นจะหายไป' },
        body: `<p>จะคืนไฟล์ทั้งหมดที่ถูกเขียนในรอบนี้ และลบไฟล์ที่เพิ่งสร้างใหม่ในรอบนั้น</p>`,
        confirmText: 'ย้อนกลับ',
        onConfirm: () => act('rollback', { stamp: t.dataset.rollback }, { confirmed: true }),
      });
    }

    if (t.dataset.act) {
      const params = t.dataset.params ? JSON.parse(t.dataset.params) : {};
      return act(t.dataset.act, params);
    }
  });

  document.addEventListener('input', (ev) => {
    const d = ev.target.closest('[data-draft]');
    if (d) DRAFTS[d.dataset.draft] = d.type === 'checkbox' ? d.checked : d.value;
    const f = ev.target.closest('[data-full]');
    if (f) FULL_DRAFT[f.dataset.full] = f.value;
  });

  // dropdown โมเดล: เลือกแล้ว sync ลง input ที่ saveGroup อ่าน (และสลับช่อง "กำหนดเอง")
  document.addEventListener('change', (ev) => {
    const sel = ev.target.closest('[data-model]');
    if (!sel) return;
    const id = sel.dataset.model;
    const input = $(`[data-draft="${id}"]`);
    if (!input) return;
    if (sel.value === '__custom') {
      input.hidden = false;
      input.focus();
      return;
    }
    input.hidden = true;
    input.value = sel.value;
    DRAFTS[id] = sel.value;
  });

  document.addEventListener('click', (ev) => {
    const go = ev.target.closest('#presetGo');    if (go) {
      const mode = $('#presetMode').value;
      const a = $('#presetA').value.trim();
      const b = $('#presetB').value.trim();
      if (!a) return toast('ต้องระบุโมเดล', 'ช่องโมเดล A ว่าง', 'err');
      act('pstack-preset', { mode, modelA: a, modelB: b });
      return;
    }

    /* ---- Quick Access: แท็บต่อโหมด ---- */
    const qs = ev.target.closest('[data-quicksub]');
    if (qs) { QUICK_SUB = qs.dataset.quicksub; return renderQuick(); }
    const qsave = ev.target.closest('[data-quick-save]');
    if (qsave) {
      const mode = qsave.dataset.quickSave;
      const patches = [];
      for (const id of [`model.${mode}`, `variant.${mode}`]) {
        const el = $(`[data-draft="${id}"]`);
        if (!el) continue;
        const val = String(el.value ?? '').trim();
        const cur = String(S.settingsValues[id] ?? '');
        if (val !== cur) patches.push({ id, value: val });
      }
      if (!patches.length) return toast('ไม่มีอะไรเปลี่ยน', `โหมด ${mode}`, 'ok');
      return act('settings-save', { patches });
    }
    const snap = ev.target.closest('[data-lock-snap]');
    if (snap) return act('lock-snapshot', { mode: snap.dataset.lockSnap });
    const back = ev.target.closest('[data-lock-back]');
    if (back) {
      const mode = back.dataset.lockBack;
      return confirmSheet({
        title: `คืนค่าโมเดล/effort · ${mode.toUpperCase()}`,
        risk: { level: 2, why: 'เขียนทับค่าใน opencode.jsonc ด้วย snapshot ของโหมดนี้ (backup ทุกไฟล์)' },
        body: `<p>คืน <code>agent.${esc(mode)}.model</code> และ <code>.variant</code> เป็นค่าที่ถ่าย snapshot ไว้</p>`,
        confirmText: 'คืนค่าโหมดนี้',
        onConfirm: () => act('lock-restore', { mode }),
      });
    }
    const kb = ev.target.closest('[data-fixed-keybind]');
    if (kb) return act('settings-save', { patches: [{ id: 'keybind.copy', value: KEYBIND_FIXED }] });

    /* ---- plannotator options ---- */
    const plSave = ev.target.closest('#plSave');
    if (plSave) {
      return act('plannotator-config', {
        target: $('#plTarget').value,
        workflow: $('#plWorkflow').value,
        runtime: $('#plRuntime').value,
      });
    }

    /* ---- arena editor ---- */
    const add = ev.target.closest('[data-arena-add]');
    if (add) return arenaAdd(add.dataset.arenaAdd);
    const dup = ev.target.closest('[data-arena-dup]');
    if (dup) {
      const side = dup.dataset.arenaDup;
      const list = arenaState()[side];
      if (list.length) list.push({ ...list[list.length - 1] });
      return renderModes();
    }
    const rm = ev.target.closest('[data-chip-rm]');
    if (rm) {
      const [side, idx] = rm.dataset.chipRm.split(':');
      arenaState()[side].splice(Number(idx), 1);
      return renderModes();
    }
    const dupe = ev.target.closest('[data-chip-dup]');
    if (dupe) {
      const [side, idx] = dupe.dataset.chipDup.split(':');
      const s = arenaState()[side][Number(idx)];
      arenaState()[side].push({ ...s });
      return renderModes();
    }
    const effAdd = ev.target.closest('[data-eff-add]');
    if (effAdd) return arenaPickEffort(effAdd.dataset.effAdd);
    const effReset = ev.target.closest('[data-eff-reset]');
    if (effReset) {
      const [side, idx] = effReset.dataset.effReset.split(':');
      arenaState()[side][Number(idx)].effort = 'default';
      return renderModes();
    }

    /* ---- system: backup ---- */
    const bkOpen = ev.target.closest('[data-bk-open]');
    if (bkOpen) return openBackupFiles(bkOpen.dataset.bkOpen);
    const bkRestore = ev.target.closest('[data-bk-restore]');
    if (bkRestore) {
      const target = bkRestore.dataset.bkRestore;
      const stamp = bkRestore.dataset.bkStamp;
      return confirmSheet({
        title: `คืนไฟล์จาก backup ${stamp}`,
        risk: { level: 3, why: 'เขียนทับไฟล์จริงด้วยสำเนาเก่า — ระบบสำรองของปัจจุบันก่อนเสมอ' },
        body: `<p class="mono small">${esc(target)}</p>`,
        confirmText: 'คืนไฟล์นี้',
        onConfirm: () => { closeModal(); act('backup-restore', { stamp, target }); },
      });
    }

    const clean = ev.target.closest('#cleanupGo');    if (clean) {
      const groups = $$('[data-clean-group]').filter((el) => el.checked).map((el) => el.dataset.cleanGroup);
      if (!groups.length) return toast('ยังไม่ได้เลือก', 'เลือกอย่างน้อยหนึ่งกลุ่ม', 'err');
      const info = S.cleanup.groups.filter((g) => groups.includes(g.id)).map((g) => `<li>${esc(g.title)} — ${g.count} รายการ</li>`).join('');
      return confirmSheet({
        title: 'ย้ายของเก่าไป quarantine',
        risk: { level: 3, why: 'ของเก่าจะหายจาก OpenCode จนกว่าจะกู้คืนจาก ACTIVE/var/quarantine' },
        body: `<p>จะย้าย:</p><ul class="small">${info}</ul><p class="hint">ไม่มีการลบถาวร — ทุกไฟล์ถูกย้ายไปเก็บพร้อม manifest</p>`,
        confirmText: 'ย้ายเลย',
        onConfirm: () => act('cleanup-old', { apply: true, groups }),
      });
    }
  });

  $('#cmdBtn').onclick = () => openPalette();
  $('#logToggle').onclick = () => { const l = $('#logbar'); l.classList.toggle('collapsed'); $('#logToggle').textContent = l.classList.contains('collapsed') ? 'ขยาย' : 'ย่อ'; };

  /* ---------------- palette ---------------- */
  function openPalette() {
    const items = [
      ...S.actions.map((a) => ({ label: a.title, sub: `ปุ่ม · ${a.id}`, run: () => act(a.id) })),
      { label: 'ไป ภาพรวม', sub: 'แท็บ', run: () => showTab('overview') },
      { label: 'ไป Quick Access', sub: 'แท็บ', run: () => showTab('quick') },
      { label: 'ไป โหมด & สิทธิ์', sub: 'แท็บ', run: () => showTab('modes') },
      { label: 'ไป ไฟล์ & สกิล', sub: 'แท็บ', run: () => showTab('files') },
      { label: 'ไป ตั้งค่า', sub: 'แท็บ', run: () => showTab('settings') },
      { label: 'ไป ระบบ', sub: 'แท็บ', run: () => showTab('system') },
      { label: 'ไป ประวัติ', sub: 'แท็บ', run: () => showTab('history') },
    ];
    PALETTE_ITEMS = items;
    PALETTE_SEL = 0;
    $('#palette').hidden = false;
    $('#paletteInput').value = '';
    renderPalette('');
    $('#paletteInput').focus();
  }
  function renderPalette(q) {
    const list = PALETTE_ITEMS.filter((i) => `${i.label} ${i.sub}`.toLowerCase().includes(q.toLowerCase()));
    PALETTE_SEL = Math.min(PALETTE_SEL, Math.max(0, list.length - 1));
    $('#paletteList').innerHTML = list.map((i, idx) => `<button data-pal="${idx}" class="${idx === PALETTE_SEL ? 'sel' : ''}">${esc(i.label)}<small>${esc(i.sub)}</small></button>`).join('') || '<div class="empty">ไม่พบ</div>';
    $('#paletteList')._list = list;
    $$('#paletteList button').forEach((b) => { b.onclick = () => { const it = list[+b.dataset.pal]; closePalette(); it.run(); }; });
  }
  function closePalette() { $('#palette').hidden = true; }
  $('#paletteInput').addEventListener('input', (e) => renderPalette(e.target.value));
  $('#palette').addEventListener('keydown', (e) => {
    const list = $('#paletteList')._list || [];
    if (e.key === 'Escape') return closePalette();
    if (e.key === 'ArrowDown') { PALETTE_SEL = Math.min(list.length - 1, PALETTE_SEL + 1); renderPalette($('#paletteInput').value); e.preventDefault(); }
    if (e.key === 'ArrowUp') { PALETTE_SEL = Math.max(0, PALETTE_SEL - 1); renderPalette($('#paletteInput').value); e.preventDefault(); }
    if (e.key === 'Enter' && list[PALETTE_SEL]) { const it = list[PALETTE_SEL]; closePalette(); it.run(); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    if (e.key === 'Escape') { closePalette(); closeModal(); }
  });

  /* ---------------- live log ---------------- */
  function connectLog() {
    const es = new EventSource('/api/log');
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data);
      const row = document.createElement('div');
      row.className = ev.type || 'info';
      row.textContent = `${new Date(ev.at).toLocaleTimeString()} · ${ev.msg}`;
      $('#logBody').prepend(row);
      while ($('#logBody').children.length > 120) $('#logBody').lastChild.remove();
      $('#logbar').classList.add('flash');
      setTimeout(() => $('#logbar').classList.remove('flash'), 600);
      $('#logState').textContent = ev.type === 'err' ? 'มีปัญหา' : 'ทำงานอยู่';
    };
    es.onerror = () => { $('#logState').textContent = 'ขาดการเชื่อมต่อ — กำลังต่อใหม่'; };
  }

  /* ---------------- boot ---------------- */
  load().then(() => { connectLog(); });
})();
