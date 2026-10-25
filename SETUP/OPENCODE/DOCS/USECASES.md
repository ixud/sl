# USECASES — ทะเบียน Use Case ของ BAZERCONSOLE

> **สถานะ:** ทะเบียนกลาง (source of truth ของ "ระบบนี้ต้องทำอะไรได้")
> **ที่มา:** ULTRA LOOP 1 ของ BUDDHA MODE — Arena 3 candidate (contract-first · journey-first · failure-first) → base = contract-first + graft จากอีก 2 ทาง
> **ตัวเลขจริง ณ 2026-10-20:** actions **22** · manifest entries **23** · probes **11** · settings controls **16** (+15 PSTACK role + budget) · law **4**
> **วิธีใช้:** ทุก UC มี "วิธีพิสูจน์" ที่รันซ้ำได้ — ถ้าเพิ่ม action/entry/probe ใหม่ ต้องเพิ่ม UC ในไฟล์นี้ในคอมมิตเดียวกัน

## Coverage

| สัญญา | จำนวน | UC ที่ครอบ |
|---|---|---|
| actions.json | 22 | ครบทุกตัว (UC-11…UC-101) |
| manifest.json | 23 | ครบทุก entry |
| probes.json | 11 | ครบทุก probe |
| settings.json controls | 16 (+15 role +budget) | ครบทุก control |
| law.json | 4 | R1–R4 (UC-117…UC-120) |

รวม **120 UC** ใน 12 กลุ่ม

## กลุ่มที่ 1 — boot (UC-01…UC-10)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-01 | เปิด Console ด้วยตัวเปิด Windows | คน | `03WINDOWS/BAZER CONSOLE.vbs` | ดับเบิลคลิก | พิมพ์ `BAZERCONSOLE 0.1.0 · http://127.0.0.1:4310/?t=…` + เบราว์เซอร์เปิด |
| UC-02 | เปิดด้วยพารามิเตอร์เอง | คน | `SERVER/index.mjs --port= --home= --no-open` | `node index.mjs --port=4499 --no-open` | URL ใช้พอร์ตที่สั่ง + เกิด `ACTIVE/var/token-4499` |
| UC-03 | token ต่อการเปิด + ฉีดลงหน้าเว็บ | Console | `index.mjs` (token/`__TOKEN__`) | `GET /` แล้วค้น `__TOKEN__` | ไม่พบ `__TOKEN__`; meta `bazer-token` = เนื้อหา `token-<port>` |
| UC-04 | POST ต้องมี token | Console | header `x-bazer-token` | POST ไม่มี header / ใส่ผิด | 403 + `summary:"token ไม่ถูกต้อง"` |
| UC-05 | พอร์ตชนแล้วเลื่อนเอง | Console | `listen()` EADDRINUSE | เปิด instance ที่ 2 พอร์ตเดียวกัน | ได้พอร์ตใหม่ (≤ +10) ไม่ crash · พิมพ์ URL ครั้งเดียว = พอร์ตจริง |
| UC-06 | กัน path traversal + 404 | Console | `index.mjs` static | `GET /../README.md`, `GET /nope.css` | ไม่ 200; 404 ตามจริง |
| UC-07 | favicon/logo จาก 02SHORTCUT | Console | `/icon.ico` | `GET /icon.ico` | 200 + `image/x-icon` |
| UC-08 | sandbox home ไม่แตะเครื่องจริง | Console | `--home` + `env.json` | เปิด `--home=%TEMP%\bazer\sb` → `GET /api/state` | `app.home` = path นั้น; ไฟล์เขียนใต้ sandbox |
| UC-09 | **ข้อจำกัด:** token/backups ยังอยู่ project `var/` | Console | `VAR_DIR` คงที่ | เปิด `--home=<temp>` แล้วดู `01MAIN/ACTIVE/var/` | มี `token-<port>` ใน project var → ยอมรับเป็นข้อจำกัด (Console เป็นตัวเดียวต่อเครื่อง) |
| UC-10 | ปิดหน้าต่างดำ = ปิด Console | คน | หน้าต่าง terminal | ปิดหน้าต่างดำ → refresh | หน้าเว็บต่อไม่ได้ |

## กลุ่มที่ 2 — overview (UC-11…UC-20)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-11 | ตรวจทุกอย่าง (self-check) | คน | `self-check` | กด ตรวจทุกอย่าง | payload มี law+plan+probes+proofs; summary ตรงสถานะ |
| UC-12 | สถานะ 5 ค่าไม่รั่ว | Console | `plan.entries[].state` | `GET /api/state` | ทุกค่าอยู่ใน {ok, stale, missing, broken, design} |
| UC-13 | ตัวเลขสรุป 4 ช่อง | คน | `renderOverview` | เปิดแท็บภาพรวม | missing/stale/broken/foreignTotal ตรง `plan.summary` |
| UC-14 | แสดง blockers ก่อนติดตั้ง | คน | `plan.blockers` | ดูการ์ด "ตัวที่ทำให้ยังกดติดตั้งไม่ได้" | มี blocker → apply ตอบ ok:false |
| UC-15 | ตรวจกฎ 4 ข้อ | คน | `law-check` | กด (หรือ Ctrl+K) | rules.length=4 · filesScanned>0 |
| UC-16 | ตรวจของจริง (probe) | คน | `probe` | กด ตรวจของจริง | results.length=11; ก่อนติดตั้ง → warn |
| UC-17 | foreign ไม่ถูกแตะ | Console | `scanForeign` | สร้าง agent นอก manifest → apply | foreign ยังอยู่หลัง apply |
| UC-18 | เปิดโฟลเดอร์ปลายทาง 4 เป้า | คน | `open-target {which}` | กด เปิดโฟลเดอร์ (config/skills/major/backups) | เปิด path ที่ resolve จาก env.json · ไม่มีโฟลเดอร์ = เตือน ไม่ใช่ "สำเร็จ" |
| UC-19 | palette เรียกได้ทุก action | คน | `#cmdBtn` / Ctrl+K | Ctrl+K พิมพ์คำค้น | รายการ = 22 actions + 6 แท็บ |
| UC-20 | ไฟล์พังแล้วระบบยังเดินได้ | Console | `parseJsonc`, `readState`, `readHistory` | ใส่ `{ "agent": {` ใน config · เติม BOM · CRLF · เขียน `{ พัง` ทับ state.json · ต่อ history.tsv บรรทัดไม่มีแท็บ | entry นั้น = broken+blocker; BOM/CRLF ยังแก้ค่าได้; `/api/state` ยัง 200 |

## กลุ่มที่ 3 — plan-apply (UC-21…UC-37)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-21 | plan dry-run | คน | `plan` | กด ตรวจว่ามีอะไรใหม่ | missing/stale/ok ครบ · history ไม่เพิ่ม |
| UC-22 | diff ตาม strategy | คน | `data-diff` → `/api/diff` | กด ดู diff ที่ `agent.buddha` | overwrite คืน before/after; copy-tree คืน `files[]` |
| UC-23 | diff entry ไม่มี → 400 | Console | `/api/diff?entry=zzz` | ยิง GET | 400 + `error` |
| UC-24 | apply ทั้งหมด | คน | `apply` (confirm) | กด ติดตั้ง / อัพเดตทั้งหมด → ยืนยัน | applied>0 · errors=0 · design/auto=false ถูกข้าม |
| UC-25 | apply ซ้ำ idempotent | Console | `applyEntries` | กดซ้ำทันที | `applied.length = 0` |
| UC-26 | ติดตั้งรายตัว | คน | `data-apply-one` | กด ติดตั้ง ที่แถวเดียว | applied มี id นั้นตัวเดียว |
| UC-27 | entry design ถูกข้าม | Console | 4 entries design | apply | skipped why=`status=design` |
| UC-28 | auto=false ต้องสั่งเอง | Console | `cfg.retire-old-flow` | apply ปกติ | skipped why=`auto=false (ต้องสั่งเอง)` · UI ไม่โชว์ปุ่มติดตั้งรายแถว |
| UC-29 | template-once ไม่ทับของ user | Console | `tpl.agents-md`, `tpl.pstack-models` | apply 2 ครั้ง | ครั้ง 2 skipped `owner=user`; เนื้อหาเดิมไม่เปลี่ยน |
| UC-30 | template เปลี่ยน → stale แต่ไม่ทับ | Console | `stateOf` template-once | แก้ template → plan | `state=stale`, `writable=false`, `locked=true` |
| UC-31 | backup ก่อนเขียน | Console | `var/backups/<stamp>/files/` | apply entry ที่มีไฟล์เดิม | มี backup + `manifest.json` items ตรง |
| UC-32 | history 8 คอลัมน์ | Console | `var/history.tsv` | apply | at/stamp/entry/action/target/hashBefore/hashAfter/result |
| UC-33 | atomic write ไม่มีไฟล์ค้าง | Console | `writeTextAtomic` | apply แล้วค้น `*.bazer-tmp-*` | ไม่พบไฟล์ค้าง |
| UC-34 | copy-tree พาโฟลเดอร์ย่อย + exclude | Console | `skills.pstack` | apply | มี references/ playbooks/ scripts/ · ไม่มี GUIDELINE.md/ADAPT-OPENCODE.md/README.md |
| UC-35 | copy-tree ไบนารีไม่เพี้ยน | Console | `looksBinary` | apitest case binary | `Buffer.compare(copy, src)=0` |
| UC-36 | jsonc-merge คงคอมเมนต์ + BOM | Console | `cfg.*` (jsonc-merge) | apply แล้วเปิด config | คอมเมนต์เดิมอยู่ · BOM ยังอยู่ · key เป้าหมายถูกเพิ่ม |
| UC-37 | ไฟล์ปลายทางเป็นโฟลเดอร์ → rollback อัตโนมัติ | Console | `writeEntry`+`applyEntries`+`rollback` | mkdir `agents/buddha.md` → apply | ok:false · errors=1 · rolledBack ไม่มี error · ไฟล์ที่เพิ่งสร้างถูกลบ |

## กลุ่มที่ 4 — modes-ladder (UC-38…UC-50)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-38 | 4 โหมดหลักแสดง | คน | `agent.*` 4 entries | แท็บ โหมด & สิทธิ์ | 4 การ์ด + badge ตรง plan state |
| UC-39 | บันได 5 ระดับพร้อมความเสี่ยง | คน | `policies.levels` | เปิดแท็บ | 5 steps + risk badge + why |
| UC-40 | ตั้งระดับ N (1–5) | คน | `policy-set {level}` | กด step 3 → ยืนยัน | `agent.buddha.permission` = ระดับ 3 ครบ key |
| UC-41 | เขียน 3 agent ต่อครั้ง | Console | entry ×3 `fromPolicy` | policy-set | targets=3 · runner `subagent=deny` · judge `edit/shell/subagent=deny` |
| UC-42 | policy-undo คืนระดับก่อน | คน | `policy-undo` | ตั้ง 3 → ย้อน | level=prev + targets=3 |
| UC-43 | ย้อนได้ครั้งเดียว (prev สลับ) | Console | `state.policy.prev` | ย้อน 2 ครั้ง | ครั้ง 2 กลับไประดับก่อนหน้า (ไม่มี stack) |
| UC-44 | ระดับไม่มีจริง | Console | `policy-set 99` | POST confirmed | ok:false · HTTP 200 · ไม่ crash |
| UC-45 | ซ่อน Plan/Build/Poteto | คน | `builtin-toggle mode=off` | กดซ่อน → ตรวจของจริง | probe `builtin-hidden` ผ่าน |
| UC-46 | คืน Plan/Build | คน | `builtin-toggle mode=on` | กดคืน | plan/build `mode=primary, hidden=false` |
| UC-47 | permission มีผลจริง 3 ชั้น | Console | probe `permission-level` | ตรวจของจริง | ok เฉพาะเมื่อ config+ผลจริงตรง; detail ระบุ cfgWrong/shadowed |
| UC-48 | frontmatter ทับบันได → รายงาน | Console | `agentFilePermission` | ใส่ shell ในไฟล์ runner → ตรวจ | detail มี "ไฟล์ agent บังคับ … (บันไดยกไม่ได้)" |
| UC-49 | ถอด bazer-flow เก่า | คน | `retire-old-flow` | กดถอด | `plugins[]` ไม่มี `./plugins/bazer-flow`; ไม่มีของ → note |
| UC-50 | default ไม่ทับระดับที่ตั้งไว้ | Console | `onlyIfMissing` (`cfg.buddha-default`) | ตั้งระดับ 3 → apply | permission ยังเป็น 3 |

## กลุ่มที่ 5 — settings (UC-51…UC-71)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-51 | โมเดล BUDDHA + datalist | คน | `model.buddha`, `/api/models` | เลือก/พิมพ์ → บันทึก | `agent.buddha.model` เปลี่ยน · datalist มีรายชื่อจริง |
| UC-52 | effort 4 โหมด | คน | `variant.*` | เลือก xhigh → บันทึก | variant = ที่แก้ |
| UC-53 | โมเดล bazer/snack/advisor | คน | `model.bazer\|snack\|advisor` | บันทึก | 3 path เปลี่ยนค่า |
| UC-54 | คีย์ลัด copy เป็น array | คน | `keybind.copy` | บันทึก `ctrl+alt+m, ctrl+alt+o` | `tui.json#keybinds.messages_copy` เป็น array |
| UC-55 | lock.models + snapshot | คน | `lock.models` | เปิด lock → บันทึก | `locks.models=true` + `modelsSnapshot` 4 โหมด |
| UC-56 | drift ตรวจพบเมื่อมีคนเปลี่ยน | Console | `modelDrift` | เปลี่ยน model แล้วโหลด state | `drift[]` มี mode/was/now |
| UC-57 | lock-restore คืนค่า | คน | `lock-restore` | เปลี่ยนค่าให้ drift → กด ล็อกคืน | changed[] มีช่องที่คืน; ไม่มี snapshot → ok:false |
| UC-58 | lock.keybinds | คน | `lock.keybinds` | เปิด toggle | `locks.keybinds=true` |
| UC-59 | ARENA runners/judge (line) | คน | `arena.runners`, `arena.judge` | กด บันทึก ARENA | `pstack-models.md` มี `arena runners: …` |
| UC-60 | model.global | คน | `model.global` | บันทึก | `opencode.jsonc#model` เปลี่ยน |
| UC-61 | steps buddha/bazer | คน | `steps.*` | ใส่ 60 / 40 | `agent.buddha.steps=60` (number) |
| UC-62 | PSTACK role เดี่ยว | คน | `pstack.feature` | บันทึก | บรรทัด `feature, refactoring:` เปลี่ยนค่า |
| UC-63 | budget | คน | `pstack.budget` | ตั้ง `large` | บรรทัด `# budget: large` |
| UC-64 | preset uniform | คน | `pstack-preset mode=uniform` | เติมทั้งชุด A | 15 role = A |
| UC-65 | preset split | คน | `mode=split` A/B | เติม | coding 8 role = A · ที่เหลือ = B |
| UC-66 | settings-full tui | คน | `settings-full file=tui` | แก้ textarea → ตรวจ JSON → เขียนทับ | ไฟล์ = เนื้อหาใหม่ + backup |
| UC-67 | settings-full JSON พัง → ไม่เขียน | Console | `writeFullSettings` | ส่ง `{oops` | ok:false · ไฟล์เดิมไม่เปลี่ยน |
| UC-68 | settings-full ไฟล์อื่น | Console | `file=zzz` | POST | ok:false "ไม่รู้จักไฟล์ตั้งค่า" |
| UC-69 | saveSettings ไม่มีค่าที่เปลี่ยน | Console | `patches=[]` | กดบันทึกโดยไม่แก้ | UI toast "ไม่มีอะไรเปลี่ยน" |
| UC-70 | control ไม่มีจริง | Console | `patches[{id:'ไม่มีจริง'}]` | POST | `results[0].ok=false why="ไม่พบ control"` |
| UC-71 | line control ก่อนมีไฟล์ | Console | `pstack.*` (line) | บันทึกก่อนติดตั้ง template | ok:false "ยังไม่มีไฟล์ — ติดตั้ง template ก่อน" |

## กลุ่มที่ 6 — files-cleanup (UC-72…UC-82)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-72 | ตาราง entry + subtab | คน | `renderFiles` | เปิด ไฟล์ & สกิล | 23 แถว + 4 subtab (all/pstack/bazer/foreign) |
| UC-73 | subtab PSTACK | คน | `kind=skill` | กด PSTACK | เหลือ `skills.pstack` |
| UC-74 | cleanup-plan 5 กลุ่ม | คน | `cleanup-plan` | กด ดูของเก่า | groups=5 + count แต่ละกลุ่ม |
| UC-75 | ย้ายของเก่า 4 กลุ่ม | คน | `#cleanupGo` → `cleanup-old {apply:true}` | ติ๊ก 4 กลุ่ม → ยืนยัน | moved ≥ 3 · ไฟล์หายจากที่เดิม |
| UC-76 | skills-other ไม่ถูกติ๊กเอง | คน | `defaultOn` | เปิด subtab ของเก่า | checkbox `skills-other` ไม่ checked |
| UC-77 | ถอดปลั๊กอินใน config | Console | `cleanupOld plugins` | ย้ายกลุ่ม plugins | `plugins[]` ไม่มีค่าเดิม + `quarantine.json` |
| UC-78 | quarantine กู้คืนได้ | คน | `var/quarantine/<stamp>/<group>/` | เปิดโฟลเดอร์ | ไฟล์ครบ + manifest ระบุ from/to |
| UC-79 | cleanup ซ้ำ = 0 | Console | `cleanupPlan` | กดตรวจใหม่ | count กลุ่มที่เลือก = 0 |
| UC-80 | reset AGENTS.md | คน | `reset-template tpl.agents-md` | กด รีเซ็ต → ยืนยัน | ไฟล์ = template (มี `BAZER-MAJOR`) + backup |
| UC-81 | reset pstack-models | คน | `tpl.pstack-models` | กด รีเซ็ต | ไฟล์ = template |
| UC-82 | reset entry ผิด | Console | `reset-template agent.buddha` | POST | ok:false "รีเซ็ตได้เฉพาะ template-once" |

## กลุ่มที่ 7 — history-rollback (UC-83…UC-88)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-83 | history-list ผ่าน API + ปุ่มบนแท็บประวัติ | คน/Console | `history-list` | กดบนแท็บ ประวัติ | history.length>0 หลัง apply · มีปุ่ม "ตรวจใหม่" |
| UC-84 | แท็บประวัติ 40 แถว | คน | `renderHistory` | เปิดแท็บ ประวัติ | ตาราง เวลา/entry/target/ผล + ปุ่ม ย้อนรอบนี้ |
| UC-85 | rollback ทั้งรอบ | คน | `data-rollback` → `rollback {stamp}` | กดย้อนรอบล่าสุด | restored>0 · ไฟล์กลับเนื้อหาเดิม |
| UC-86 | rollback ลบไฟล์ที่สร้างใหม่ | Console | `rollback existed=false` | ย้อนรอบที่สร้างไฟล์ | deleted>0 · ไฟล์หาย |
| UC-87 | stamp ไม่มี | Console | `rollback 19000101-000000` | POST confirmed | ok:false "ไม่พบ backup รอบ …" |
| UC-88 | history พังไม่ crash | Console | `readHistory` | ต่อท้ายบรรทัดไม่มีแท็บ | ok:true · แถวพังไม่ throw |

## กลุ่มที่ 8 — plannotator (UC-89…UC-95)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-89 | locate เจอ CLI | คน | `plannotator-locate` | กด ตรวจ Plannotator | ok + detail path |
| UC-90 | locate ไม่เจอ → warn | Console | probe `plannotator-locate` | ใช้ sandbox home | ok:true · warn:true |
| UC-91 | patch dry-run | Console | `{target, apply:false}` | POST | todo = จำนวนไฟล์ที่ต้องแพตช์ |
| UC-92 | patch apply | Console | `{target:'buddha', apply:true}` | POST | ไฟล์มี `switchTo:"buddha"` · remaining=0 |
| UC-93 | patch ซ้ำ | Console | `plannotatorPatch` | POST ซ้ำ | changed.length=0 |
| UC-94 | ไม่มีไฟล์ปลั๊กอิน | Console | `plan.files=[]` | POST apply | warn + แนะนำ CLI gate |
| UC-95 | ปุ่มแพตช์ (ขั้นสูง) เข้าถึงได้ | คน | `data-patch` | แท็บ โหมด & สิทธิ์ → การ์ด Plannotator | มีปุ่ม risk 3 + confirm; ไม่มีไฟล์ = เตือน |

## กลุ่มที่ 9 — installer (UC-96…UC-101)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-96 | install-tools dry-run | คน | `install-tools` | กด ติดตั้งเครื่องมือที่ขาด | `applied:false` + `need[]` เฉพาะที่ขาด |
| UC-97 | install-tools apply | คน | `{apply:true}` | กดยืนยัน | `results[]` มี code ต่อ tool · ไม่มี cmd → ok:false |
| UC-98 | probe node/opencode ตรวจ version จริง | Console | probes `node`, `opencode` | ตรวจของจริง | ok เมื่อ ≥ 20 / ≥ 2.0.30 · ใช้ `min` จาก install.json |
| UC-99 | probe tui/pstack-models (warn) | Console | `json-file`, `file-exists` | ตรวจของจริง | ตกเป็น warn ไม่ทำให้ `probes.ok=false` |
| UC-100 | probe plannotator-plugin | Console | `cmd-contains` | `opencode plugin list` | ok เมื่อพบ `@plannotator/opencode` |
| UC-101 | required vs optional | Console | `install.json.required` | เครื่องที่ไม่มี plannotator | optional ไม่ถูกนับเป็น "ยังขาด" (แยกเป็น advisory) |

## กลุ่มที่ 10 — ui (UC-102…UC-106)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-102 | confirm sheet ตาม risk | คน | `confirmSheet` | กดปุ่ม write ใด ๆ | modal มี risk level + why + ปุ่มยืนยัน |
| UC-103 | กันกดซ้อน (BUSY) | คน | `act()` BUSY | กดรัวระหว่างรอ | toast "รอสักครู่" |
| UC-104 | toast 3 สถานะ | คน | `toast kind` | ทำ action ok/warn/err | "สำเร็จ/ยังไม่พร้อม/ไม่สำเร็จ" |
| UC-105 | `[hidden]` ต้องซ่อนจริง | Console | `style.css` | `node tools/selftest.mjs` (case CSS) | ผ่าน |
| UC-106 | modal เปล่าไม่คลุมหน้า | คน | `#modalRoot hidden` | เปิดหน้าใหม่ | ไม่มี backdrop ค้าง |

## กลุ่มที่ 11 — agent-flow (UC-107…UC-114)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-107 | 4 primary ครบ marker ใหม่ | Console | probe `modes-present` exact | ตรวจของจริง | 4 ตัว + ไม่มีโหมดเกิน + marker ครบ |
| UC-108 | subagent mode ถูกทุกไฟล์ | Console | selftest case | รัน selftest | ผ่าน |
| UC-109 | ARENA runner/judge สิทธิ์ | Console | `permission-arena-runner/judge` | ตรวจของจริง | runner subagent=deny+external allow · judge edit/shell/subagent=deny |
| UC-110 | BUDDHA gate ก่อนเขียน | คน | `AGENTS.md` flow gate | สั่งแก้ไฟล์ก่อน approved | ถูกบล็อก |
| UC-111 | approved → builder เท่านั้น | คน | `AGENT/02SUBAGENT/BUILDER.md` | อ่าน + ทดลองเรียก | builder เป็น subagent · primary ไม่เขียนเอง |
| UC-112 | SNACK/ADVISOR ไม่แตะไฟล์ | คน | frontmatter snack/advisor | `opencode debug agents` | edit=deny ตามไฟล์ (ADVISOR ต้องบอกให้สลับเป็น SNACK) |
| UC-113 | PLANNOTATOR คืนผลให้ผู้เรียก | คน | `AGENT/02SUBAGENT/PLANNOTATOR.md` | เรียกผ่าน task | ได้ approved/feedback กลับ ไม่สลับ agent |
| UC-114 | เปิด OpenCode ใหม่ให้ค่าใหม่มีผล | คน | `opencode debug agents` | ตั้งระดับ/ซ่อนโหมด → ปิด-เปิด OpenCode | 4 โหมด + สิทธิ์ตรงระดับที่ตั้ง |

## กลุ่มที่ 12 — docs-contract (UC-115…UC-120)

| UC | ชื่อ | ผู้ทำ | อ้างอิง | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|---|
| UC-115 | GUIDE ตรงกับแท็บจริง | คน | `DOCS/GUIDE.md` vs `index.html` | เทียบรายชื่อแท็บ | 6 แท็บตรงกัน |
| UC-116 | validate() ไม่มีปัญหา | Console | `validate()` | `GET /api/state.manifest.problems` | `[]` |
| UC-117 | R1/R4 ผ่านบน tree จริง | Console | law rules | law-check | R1/R4 ok |
| UC-118 | R3 actions ↔ handlers | Console | law R3 | law-check | 22/22 ไม่มี "ประกาศแต่ไม่มี handler" |
| UC-119 | ตัวเลขเอกสาร vs จริง | คน | `manifest.json`, `probes.json`, LOGS | นับด้วยสคริปต์ | entries=23 · probes=11 · actions=22 (LOGS รุ่นเก่าเขียน 24/13 → แก้แล้ว) |
| UC-120 | env.json ครอบทุก `${VAR}` | Console | `env.json` + targets | selftest 'ทุก target resolve ได้' | ผ่าน · ไม่มีตัวแปรแปลก |

---

## ที่ถูกทิ้งจาก Arena (และเหตุผล)

| ทิ้ง | เพราะ |
|---|---|
| C2 (journey-first) 56/58 แถว | ซ้ำกับ contract-first แต่วัดผลไม่ได้ (เกณฑ์เป็นคำอธิบาย ไม่ใช่คำสั่ง/การกด) — เก็บเฉพาะ 2 ขั้นที่คนพลาดจริง (UC-10, UC-114) |
| C3 (failure-first) 87/89 แถว | คุณค่าคือ failure breadth แต่ถ้านำมาทั้งก้อนจะกลายเป็น test plan ไม่ใช่ UC registry — เก็บ 2 cluster ที่กระทบผู้ใช้ (UC-20, UC-37) |
| matrix ของ C3 ที่อ้างว่า "ครบ 22 actions" | ตรวจแล้วระบุตรงตัวเพียง 14 → ใช้ matrix ที่ตรวจด้วยสคริปต์แทน |
| UC แบบ API-only ของ C1 | เก็บไว้แต่ระบุผู้ทำ = Console ไม่ใช่ "ปุ่ม" (UC-83, 91–94) |

## กลุ่มที่ 16 — ladder (เพิ่ม 2026-10-20 · บันได BAZER)

| UC | ชื่อ | ผู้ทำ | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|
| UC-141 | บันได BAZER แยกจาก BUDDHA | คน | ตั้งขั้น BUDDHA 3 · ตั้งขั้น BAZER 5 | config มี `agent.buddha.permission` และ `agent.bazer.permission` คนละชุด |
| UC-142 | ระบบบอกขั้นที่ตั้งอยู่จริง | Console | แก้ `opencode.jsonc` เอง → เปิด Console | การ์ดบันไดไฮไลต์ขั้นที่ตรงกับ config (`policyDetected.source=config`) หรือขึ้น "กำหนดเอง" ถ้าไม่ตรงขั้นไหน |
| UC-143 | กดเหมาเข่งแล้วเขียนลง agent file | Console | ตั้งขั้น 4 → เปิด `agents/buddha.md` | frontmatter `permission:` = ชุดของขั้น 4 |
| UC-144 | apply ไม่ทับขั้นที่ตั้งไว้ | Console | ตั้งขั้น 5 → กด "ติดตั้ง/อัปเดตทั้งหมด" | `agents/buddha.md` ยังเป็นชุดของขั้น 5 (ไม่กลับไปขั้น 1) |

## ข้อจำกัดที่บันทึกไว้ (ไม่ใช่บั๊ก)

1. `probe` ที่ต้องอ่าน agent จาก OpenCode (`agents-present`, `agents-hidden`, `permission-level`) **ไม่ผูกกับ `--home`** → บน sandbox จะเห็นค่าของเครื่องจริง (ยอมรับ: Console ตั้งใจให้เป็นตัวเดียวต่อเครื่อง)
2. `var/` (state/backups/history/token/quarantine) เป็นของ Console ไม่ได้แยกตาม home → รัน 2 instance พร้อมกันจะแชร์ state (UC-09)
3. ปุ่มอนุมัติ Plannotator เป็นค่า global ใน localStorage → แพตช์เป็น per-agent ไม่ได้ (UC-89…UC-95 ใช้ CLI gate แทน)

---

# ภาคผนวก A — UC ที่เพิ่มใน Wave A/B (2026-10-20)

> เพิ่มต่อจาก 120 UC ด้านบน (ไม่เปลี่ยนเลขเดิม) — ทุกข้อมีปุ่ม/action จริงและเทสต์

## กลุ่มที่ 13 — plugin (UC-121…UC-126)

| UC | ชื่อ | ผู้ทำ | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|
| UC-121 | เห็นสถานะปลั๊กอิน gate (ไฟล์จริง vs ต้นทาง MAJOR) | คน | แท็บ ระบบ → การ์ดปลั๊กอิน | badge = `missing/stale/ok` ตรงกับไฟล์ในเครื่อง |
| UC-122 | ติดตั้ง/อัปเดตปลั๊กอินจาก Console | คน | กด `ติดตั้ง / อัปเดตไฟล์` | ไฟล์ครบ + index.ts/engine.mjs/runtime.mjs ตรงต้นทาง |
| UC-123 | prune ซากรุ่นเก่า (ไม่ลบทิ้ง) | Console | วางไฟล์ปลอมในโฟลเดอร์ปลายทาง → apply | ไฟล์ปลอมหายจากปลายทาง + มีสำเนาใน `backups/<stamp>/pruned/` |
| UC-124 | ลงทะเบียนปลั๊กอินใน config | คน | กด `ลงทะเบียนใน config` | `plugins[]` มี `./plugins/bazer-flow` · รันซ้ำไม่เพิ่ม |
| UC-125 | ถอดปลั๊กอินจาก config | คน | กด `ถอดจาก config` | `plugins[]` ไม่มีค่านี้ + ไม่มีไฟล์อื่นถูกแตะ |
| UC-126 | Console บอกว่าปลั๊กอินถูกลงทะเบียนหรือยัง | Console | probe `plugin-registered` | ok เมื่อมีใน array, warn เมื่อไม่มี |

## กลุ่มที่ 14 — arena (UC-127…UC-132)

| UC | ชื่อ | ผู้ทำ | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|
| UC-127 | เลือก runner/judge หลายตัว | คน | `+ เพิ่มโมเดล` (panel ค้นหา) | chips ตรงจำนวนที่เลือก |
| UC-128 | โมเดลซ้ำได้ (เช่น deepseek ×2) | คน | กด `＋` บนชิป | มี 2 slot ของโมเดลเดิม + แสดง `#1/#2` |
| UC-129 | effort รายตัว 7 ระดับ | คน | เปิด “กำหนด effort รายตัว” → `+ เลือกโมเดล` ในกล่อง | ที่นั่งถูกย้ายเข้า effort นั้น และบันทึกเป็น `model#effort` |
| UC-130 | บันทึก Arena ลง pstack-models.md (inline) | คน | กด `บันทึก ARENA` | `arena runners: model#effort, …` · `arena cross-judge pool: model#effort` · ไม่มีบรรทัด efforts รุ่นเก่า |
| UC-131 | dropdown โมเดลเหลือ 2 ค่าย | คน | เปิดช่องโมเดลใด ๆ | มีเฉพาะ `opencode/*` + `opencode-go/*` + “กำหนดเอง…” |
| UC-132 | Console บอกจำนวนโมเดลที่ซ่อน | คน | ดูใต้ `บันทึก ARENA` | แสดง “ซ่อน N โมเดล…” เมื่อ N>0 |

## กลุ่มที่ 15 — system (UC-133…UC-140)

| UC | ชื่อ | ผู้ทำ | วิธีพิสูจน์ | เกณฑ์ผ่าน |
|---|---|---|---|---|
| UC-133 | ดูปลั๊กอินที่ OpenCode เห็น | คน | `ดูรายการปลั๊กอิน` | ตาราง/ข้อความจาก `opencode plugin list` |
| UC-134 | อัพเดตแพ็กเกจปลั๊กอิน | คน | `อัพเดตปลั๊กอิน` → ยืนยัน | dry-run ก่อน, apply ต้องมี exit code |
| UC-135 | ตั้ง Plannotator ส่งกลับ BUDDHA/BAZER | คน | `ตั้งให้ส่งกลับ …` | `options.planningAgents=[target]` ใน config |
| UC-136 | แพตช์ปุ่มเฉพาะเมื่อมีไฟล์ | คน | เปิดแท็บ ระบบ | ถ้า `kind=cli-only` ปุ่มถูก disable + เหตุผลบนจอ |
| UC-137 | ดู backup รายรอบ | คน | `ดูรายการ backup` | มี stamp/เวลา/จำนวนไฟล์ |
| UC-138 | คืนไฟล์เดียวจาก backup | คน | `ดูไฟล์` → `คืนไฟล์นี้` → ยืนยัน | ไฟล์กลับเนื้อหาเดิม + สำรองของปัจจุบันก่อน |
| UC-139 | เห็นพอร์ต/PID/uptime | คน | การ์ดเซิร์ฟเวอร์ | ตรงกับ process จริง |
| UC-140 | บันไดเหมาเข่งมีผลกับไฟล์ agent ด้วย | Console | `policy-set` → เปิด `agents/buddha.md` | frontmatter `permission:` = ระดับที่ตั้ง + ไม่ขึ้น stale |

