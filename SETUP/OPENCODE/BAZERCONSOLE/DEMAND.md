1 -

> **อัพเดต 2026-10-20:** ข้อกำหนดที่ผ่านการเทียบกับ `BAZERCONSOLE/LOGS.md` แล้ว (LOGS ชนะเมื่อขัดกัน + ข้อที่ LOGS ไม่มีถูกยกมา) อยู่ที่ **`DOCS/REQUIREMENTS.md`** — ไฟล์นี้เก็บไว้เป็นประวัติคำขอต้นฉบับ ห้ามลบ

อ่านบริบทจาก
"C:\BCS\00.02 LLM Slavery\SETUP\OPENCODE"
คร่าว ๆ ว่ามันทำงานยังไง

2-

ผม **ไม่ให้คุณก๊อปโค้ดมาทั้งดุ้น** เพราะผมจะรื้อใหม่ทั้งหมด
ผมจะเริ่มใหม่ที่
"C:\BCS\00.02 LLM Slavery\SETUP\MAJOR"
*พูดง่าย ๆ คืออย่าให้โค้ดเก่าชี้นำการออกแบบโค้ดใหม่ของคุณ

3 -

ปัญหาของเก่าคือ

3.1 -

script มันกระจัดกระจายไปหมด console ควบคุมไม่ได้จริง

4 -

วิธีแก้

4.1 -

แยกที่เก็บ primary mode, sub agents, skills, และ plug-in ออกจากกัน

4.2 -

แยก folder ให้ชัด อย่าให้มั่ว

4.3 -

เอาหน้าที่ console ให้ชัด คือ 1. มันเช็คว่าไฟล์ระบบตั้งอะไรไว้ และมีหรือไม่มีอะไร 2. มันเอาสิ่งที่อยู่ใน /MAJOR ไป apply ที่ไฟล์ระบบ และให้มี command ให้กด install ทุกอย่างที่จำเป็นตั้งแต่ต้นเลย ซึ่งหลัก ๆ ก็จะมีตัว OpenCode เอง กับ Plannotator

4.4 -

ผมเขย่า Primary Mode ใหม่หมดเลย เอา Plan and Built Mode ที่มากับตัว OpenCode ออก

Primary Mode ตอนนี้จะเหลือ

BUDDHA MODE

Toggle จาก CONSOLE ระหว่าง DEFAULT ALLOW LIST กับ “เหมาเข่ง” ALLOW LIST ซึ่งการกด “เหมาเข่ง” ต้องมีปุ่มยืนยันความเสี่ยง

WORKFLOW

Plain BUDDHA MODE

v

POTETO SUBAGENT (In Line): WRITE AN ARENA MODE’s PLAN

v

PLANNOTATOR SUBAGENT (In Line): SUBMIT A PLAN

v

(USER) 

if Click Feedback > Loop to `POTETO SUBAGENT (In Line): WRITE AN ARENA MODE’s PLAN`

if Click Approve and BUDDHA > NEXT STEP

v

Plain BUDDHA MODE

v

ARENA SUBAGENT (In Line): Main ARENA Workflow

ARENA SUBAGENT (BACKGROUND): Loop Within ARENA SUBAGENT’s  SUBAGENT

v

ARENA LOOP

v

ARENA SUBAGENT (In Line): DONE

v

Plain BUDDHA MODE

v

POTETO SUBAGENT (In Line): WRITE AN `ACTUAL CODEBASE EDIT` PLAN

v

PLANNOTATOR SUBAGENT (In Line): SUBMIT A PLAN

v

(USER) 

if Click Feedback > Loop to `POTETO SUBAGENT (In Line): WRITE A PLAN`

if Click Approve and BUDDHA > NEXT STEP

v

BUDDHA MODE: EDIT AN ACTUAL CODEBASE

v

BUDDHA MODE: WRITE A CONCLUSION AND GIT COMMIT

BAZER MODE

WORKFLOW

Plain BAZER MODE: No Loop Thinks, No Unnecessary Think, Even In Max Effort

v

Plain BAZER MODE: Write A Plan

v

PLANNOTATOR SUBAGENT (In Line): SUBMIT A PLAN

v

(USER) 

if Click Feedback > Loop to `Plain BAZER MODE: Write A Plan`

if Click Approve and BAZER > NEXT STEP

v

BAZER MODE: EDIT ACTUAL CODEBASE

v

BAZER MODE: WRITE A CONCLUSION AND GIT COMMIT

SNACK MODE

ADVISOR MODE

SUBAGENTS

POTETO

เรียก Skills ใน PSTACKS ยกเว้น ARENA

PLANNOTATOR SUBAGENT

เรียก PLUGIN PLANNOTATOR

ARENA

SUBSUBAGENTS

ตามสเปกของ ARENA

4.5 - 

PLANNOTATOR CONFIG จะซับซ้อนนิดนึงคือ 

ถ้าเรียกจาก BUDDHA MODE ให้กลับหา BUDDHA MODE by DEFAULT (ไม่ต้องเลือก ปุ่มที่ให้กดคือ กลับหา BUDDHA MODE เลย)

ถ้าเรียกจาก BAZER MODE ให้กลับหา BAZER MODE by DEFAULT (ไม่ต้องเลือก ปุ่มที่ให้กดคือ กลับหา BAZER MODE เลย)

|  | Max Efficiency on Max Effort | No Loops Think, No Unnecessary Think | EXTREMELY OBVIOUS FILE/FOLDER PATH | Read that PATH content | Edit that PATH content |
| --- | --- | --- | --- | --- | --- |
| SNACK | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADVISOR | ✅ | ✅ | ✅ | ✅ | ❌ |

ส่วน SNACK กับ ADVISOR สลับไปมาได้ แค่บางช่วงให้แก้ไฟล์ บางช่วงไม่ให้แก้ไฟล์ ซึ่งเราต้องเขียนรายละเอียดที่ OpenCode อ่านโหมดดี ๆ ที่ ADVISOR.md ต้องบอก user ว่าเขาแก้ไฟล์ไม่ได้ ต้องให้ user สลับเป็น SNACK MODE

MODE BUDDHA และ BAZER จะสมบูรณ์ด้วยตัวของมันเอง จะไม่มีการเปลี่ยน MODE กลางแชท

GIT COMMIT FORMAT: [Very Breif Phrase about this change] [Rare emoji but resonate what change in the commit]: [Less Breif Phrase about this change]

5 -

อ่านสเปกของ POTETO, ARENA, และ PSTACK ที่ "C:\BCS\00.00 BCS Launch\00.03 pStack”

6 -

ให้ถามคำถามผมเพิ่มเกี่ยวกับสเปก ก่อนจะเขียน .md จริง

(TURN นี้สุดตรงนี้)

7 - 

คุณจะต้องตอบว่า

1 - ต้องมีไฟล์กับโฟลเดอร์อะไรเพิ่มบ้าง

2 - Console ทำงานยังไง 

เรียก “OUR SPEC FOR APPLYING REAL SYSTEM FILE” ยังไง

เรียก SYSTEM FILE มาเช็คว่า “ของครบ” “ของไม่ครบ” ยังไง

APPLY จริงยังไง 

3 - UXUI ของ BAZER CONSOLE จะเป็นยังไง มีแผนยังไงให้ปุ่มทุกปุ่มทำงานได้ดี

ตรงนี้ผมจะเปิดโหมดให้คุณ EDIT ได้

8 -

หลังตรงนี้คือห้ามทำอะไรจนกว่าผมจะอนุมัติ เราจะมาระดมความคิดกัน ว่าทำยังไงให้คราวนี้ไม่เจ๊ง 55555

| เฟส | MODE | Sub Agent | Sub Agent Display | ทำอะไร | ทางออก |
| --- | --- | --- | --- | --- | --- |
| **B1** | BAZER | - | - | อ่านโจทย์ + ไฟล์ที่อนุญาต + ตรวจสภาพจริง (read-only) | ไป B2 |
| **B2** | BAZER | - | - | เขียนแผนสั้นที่ขึ้นต้นด้วย `# BAZER — PLAN` (เป้าหมาย · ไฟล์ที่จะแตะ · ขั้นตอน · วิธีพิสูจน์) | ไป B3 |
| **B3** | BAZER | PLANNOTATOR | In Line | ยื่นแผนด้วย subagent `plannotator` | approved → B4 · feedback → B2 |
| **B4** | BAZER | BUILDER | In Line | เรียก `builder` (inline) พร้อมแผนที่อนุมัติ → ตรวจผล + รันพิสูจน์ | ไป B5 |
| **B5** | BAZER | - | - | bug scan & fix 3 รอบ → รายงาน → commit | จบ |

| เฟส | MODE | Sub Agent | Sub Agent Display | ทำอะไร | เรียกใคร (ชื่อเป๊ะ) | ทางออก |
| --- | --- | --- | --- | --- | --- | --- |
| **P0** | BUDDHA | - | - | อ่านโจทย์ + สำรวจบริบทที่จำเป็น (read-only) | — | ไป P1 |
| **P1** | BUDDHA | POTETO | In Line | เขียน **แผน Arena** ขึ้นต้นด้วย `# GATE 1 — ARENA PLAN` | `poteto` | ไป P2 |
| **P2** | BUDDHA | PLANNOTATOR | In Line | ยื่นแผน GATE 1 ให้คนอนุมัติ | `plannotator` | approved → P3 · feedback → P1 |
| **P3** | BUDDHA | ARENA | `arena-judge` - In Line

arena-runner -  `BACKGROUND` | รัน Arena ในเซสชันนี้ (candidate ลง temp เท่านั้น) | `arena` | ไป P4 |
| **P4** | BUDDHA | POTETO | In Line | เขียน **แผนแก้โค้ดจริง** ขึ้นต้นด้วย `# GATE 2 — BUILD PLAN` | `poteto` | ไป P5 |
| **P5** | BUDDHA | PLANNOTATOR | In Line | ยื่นแผน GATE 2 ให้คนอนุมัติ | `plannotator` | approved → P6 · feedback → P4 |
| **P6** | BUDDHA | BUILDER | In Line | เรียก `builder` (inline) ลงมือแก้ตามแผน → ตรวจผล + พิสูจน์ + bug scan 3 รอบ + สรุป + commit | `builder` (inline) | จบงาน |