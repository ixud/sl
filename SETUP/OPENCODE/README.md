# MAJOR — BAZER Stack (v0.1)

ชุดควบคุม OpenCode + Plannotator + pStack ที่ **แยกข้อมูลออกจากโปรแกรม** และมีสัญญากลางไฟล์เดียว

A control pack for OpenCode + Plannotator + pStack. Data and program are separated, with one central contract.

## What this is (EN)

- **Data vs program:** `AGENT/**` and `BAZERCONSOLE/01MAIN/PASSIVE/**` are data only. Code lives in `ACTIVE/**`.
- **One manifest owns the truth:** `PASSIVE/01MANIFEST/manifest.json` says what goes where; the server never hardcodes target paths.
- **Plan before write:** `plan` is a dry run (5 states); `apply` backs up, writes atomically, re-hashes, and rolls back the whole run on failure.
- **Four modes:** BUDDHA · BAZER · SNACK · ADVISOR (the built-in Plan/Build are hidden via config, not deleted).
- **Safety rails:** R1–R4 are enforced by code, old files are quarantined (never deleted), and every write is recorded in `history.tsv`.
- **No dependencies / no build step:** Node built-ins + plain HTML/CSS/JS. Clone and run.

## เริ่มตรงไหน

| อยาก… | ไปที่ |
|---|---|
| ใช้งานเลย | ดับเบิลคลิก `BAZERCONSOLE\03WINDOWS\BAZER CONSOLE.vbs` |
| เข้าใจว่าอะไรคุมอะไร | `DOCS/FLOW.md` |
| ใช้แบบไม่เขียนโค้ด | `DOCS/GUIDE.md` |
| แก้ไฟล์โหมด | `AGENT/01PRIMARY/` (อ่าน `GUIDELINE.md` ก่อน) |
| เพิ่มของ/ปุ่ม/ค่า | `BAZERCONSOLE/01MAIN/PASSIVE/01MANIFEST/README.md` |
| รู้ว่าห้ามทำอะไร | `GUIDELINE.md` (กฎ R1–R4) |

## โครงสร้าง

```
MAJOR/
├─ GUIDELINE.md              กฎแม่ 4 ข้อ
├─ AGENT/
│  ├─ 01PRIMARY/             BUDDHA · BAZER · SNACK · ADVISOR
│  ├─ 02SUBAGENT/            poteto · plannotator · builder · arena-runner · arena-judge
│  ├─ 03SKILLS/              PSTACK (53) · BAZER (ว่าง)
│  └─ 04PLUGIN/              ที่เดียวที่เป็นโค้ดได้ (ยังไม่เขียนใหม่)
├─ BAZERCONSOLE/
│  ├─ 01MAIN/
│  │  ├─ PASSIVE/            สัญญา: MANIFEST · INSTALLER · SLASHCOMMAND · PLANNOTATOR
│  │  ├─ ACTIVE/             SERVER + UI + var (runtime)
│  │  └─ CONFIGTEMPLATEFORAPPLY/
│  ├─ 02SHORTCUT/            ตัวสร้างทางลัด
│  ├─ 03WINDOWS/             ตัวเปิด (รองรับตอนนี้)
│  ├─ 04MACOS/ 05LINUX/      ยังว่างโดยเจตนา
└─ DOCS/                     FLOW · GUIDE
```

## สถานะ v0.1 (ซื่อตรง)

- ติดตั้ง/อัพเดต/ย้อนกลับ/ตรวจกฎ/ตรวจความครบ/ตั้งค่า ทำงานจริงบน Windows
- `patch.plannotator` และปลั๊กอินทั้งสองตัว = **ยังไม่ทำ** (สถานะ `design` ใน manifest)
- PSTACK skills ยังเป็น `raw` — ดู `AGENT/03SKILLS/PSTACK/ADAPT-OPENCODE.md`

## ตรวจตัวเอง

```powershell
node "BAZERCONSOLE\01MAIN\ACTIVE\SERVER\tools\selftest.mjs"
```

แล้วเปิด Console → `ตรวจทุกอย่าง`
