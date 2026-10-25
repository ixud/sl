# GUIDELINE — 04PLUGIN

โฟลเดอร์นี้เป็น **ที่เดียวใน `AGENT/` ที่มีโค้ดได้** (กฎ R1 ยกเว้นไว้แล้ว — ถ้าแก้ `law.json` ต้องคง exception นี้)

```
04PLUGIN/
└─ bazer-flow/          ปลั๊กอิน gate (BAZER FLOW v2)
   ├─ index.ts          ตัวปลั๊กอินฝั่งเซิร์ฟเวอร์ (hook execute/permission/context)
   ├─ engine.mjs        ตรรกะบริสุทธิ์ (decide/phaseFor/approvalOf) — ไม่มี I/O
   ├─ runtime.mjs       สถานะ/ด่าน (ฉีด store + clock) — ไม่มี I/O โดยตรง
   ├─ tui.tsx           badge PLAN/ARENA/BUILD บน TUI
   └─ package.json      exports "." → index.ts · "./tui" → tui.tsx
```

## กติกา

1. **ห้ามแก้ปลั๊กอินที่ติดตั้งแล้วด้วยมือ** (`~/.config/opencode/plugins/bazer-flow`) — ให้แก้ที่โฟลเดอร์นี้แล้วติดตั้งผ่าน Console (`manifest: plugin.bazer-flow` · strategy `copy-tree` · `prune: true`)
2. `engine.mjs`/`runtime.mjs` ต้องไม่มี I/O โดยตรงและไม่มี dependency — เพื่อให้ `node --test` ตรวจได้โดยไม่ต้องรัน OpenCode
3. กติกาที่ยืนยันแล้ว (อย่าถอยกลับ):
   - **SNACK ไม่ถูก gate** — โหมดนี้คือ "แก้ไฟล์เร็ว ไม่มีแผน"
   - **BUDDHA ต้องอนุมัติ 2 ครั้ง** (GATE 1 Arena → GATE 2 Build)
   - **BAZER ต้องอนุมัติ 1 ครั้ง**
   - **ARENA / POTETO-MODE เขียนได้เฉพาะ `%TEMP%\bazer`** แม้อนุมัติแล้ว
   - ข้อความ feedback ของ Plannotator (`# Plan Feedback`, "I've reviewed this plan…") **ไม่ใช่** user prompt ใหม่ → ต้องไม่รีเซ็ต approval
   - Plan ห้ามมีข้อยกเว้น `edit *.md` (ช่องรั่วที่เคยมี)
4. ทุกครั้งที่แก้: เพิ่มเทสต์ใน `AGENT/04PLUGIN/bazer-flow/*.test.mjs` (`node --test`) และอัพเดต `CHANGELOG.md` + `LOGS.md`
5. เวอร์ชันของปลั๊กอิน = `version` ใน `package.json` — Console ใช้ hash ของไฟล์เป็นตัวตัดสิน stale (ไม่ใช้ version)

## ติดตั้ง / ถอด

```
Console → แท็บ ระบบ → ปลั๊กอิน gate
  ติดตั้ง/อัปเดตไฟล์  → copy-tree (+ prune ซากเข้า backup)
  ลงทะเบียนใน config  → เพิ่ม ./plugins/bazer-flow ใน plugins[]
  ถอดจาก config       → retire-old-flow
```
หลังติดตั้ง/ถอด **ต้องปิด-เปิด OpenCode** ให้ปลั๊กอินถูกโหลดใหม่
