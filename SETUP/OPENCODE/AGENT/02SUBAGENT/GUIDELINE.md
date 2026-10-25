# GUIDELINE — 02SUBAGENT

subagent = ตัวที่ **โหมดหลักเรียก** ผ่านเครื่องมือ `subagent` ของ OpenCode
รันเดี่ยว → แสดง inline ในเซสชัน · รันหลายตัวพร้อมกัน → ถูกซ่อนและสรุปกลับ (พฤติกรรมของ OpenCode เอง เราไม่ต้องทำอะไร)

| ไฟล์ | ชื่อที่เรียก | งาน |
|---|---|---|
| `POTETO.md` | `poteto` | เขียนแผนด้วยกระบวนการ poteto/pstack (โหลด skill `poteto-mode`) |
| `PLANNOTATOR.md` | `plannotator` | ยื่นแผนเข้า Plannotator + กลับไปโหมดที่เรียกมา |
| `BUILDER.md` | `builder` | รับแผนที่อนุมัติแล้วไปแก้ไฟล์จริง — ถูกเรียก **inline** จาก BAZER และ BUDDHA |
| `ARENA-RUNNER.md` · `ARENA-JUDGE.md` | `arena-runner` · `arena-judge` | BUDDHA ทำ Arena เอง เรียกสองตัวนี้ |

## กฎ

1. frontmatter ต้องเป็น `mode: subagent` **ทุกไฟล์ในโฟลเดอร์นี้** (รวม `BUILDER.md` — มันถูกเรียก inline จาก BAZER/BUDDHA ไม่ใช่ primary)
2. **ห้าม subagent แก้ไฟล์นอกขอบเขตงานของตัวเอง** — `arena-runner` เขียนได้แค่ในโฟลเดอร์ผลงานของตัวเอง, `arena-judge` อ่านอย่างเดียว
3. **ชื่อ subagent ที่เขียนในไฟล์โหมดหลักต้องตรงกับชื่อไฟล์ตัวพิมพ์เล็ก** — เรียกผิดชื่อ = โมเดลงงแล้วไปทำเอง
4. เลือกโมเดลของแต่ละที่นั่งจาก `pstack-models.md` (ไฟล์ติดตั้งจาก `CONFIGTEMPLATEFORAPPLY/`) — ถ้าไม่ระบุ ให้ใช้ค่า default ของ skill และ **รายงานว่าใช้ตัวไหนจริง**
5. **สัญญารายงานกลับ** (ทุก subagent) — 3 บรรทัดขึ้นไปต้องมี:
   1. ทำอะไร (ผลลัพธ์ ไม่ใช่เล่ากระบวนการ)
   2. ไฟล์/พาธที่แตะหรือสร้าง
   3. หลักฐาน (คำสั่ง + ผลจริง) และสิ่งที่ยังพิสูจน์ไม่ได้
6. subagent **ห้ามอนุมัติตัวเอง** — ห้ามเรียก `submit_plan` แทนโหมดหลัก
7. Arena: BUDDHA ทำเอง เรียก `arena-runner`/`arena-judge` — ไม่มีชั้น `SUBSUBAGENT/` แล้ว
