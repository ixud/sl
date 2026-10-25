# GUIDELINE — 03SKILLS

```
03SKILLS/
├─ PSTACK/   ← ยกมาจาก pStack (ยกเว้น Arena — BUDDHA ทำเอง เรียก arena-runner/arena-judge)
└─ BAZER/    ← skill ที่เราเขียนเอง (ตอนนี้ว่าง — จะค่อย ๆ เติม)
```

## กฎ

1. **PSTACK = ของคนอื่น** — ต้นฉบับคือ repo pStack (`C:\BCS\00.00 BCS Launch\00.03 pStack`)
   ทุกไฟล์ที่ดัดแปลงเพื่อ OpenCode ต้องบันทึกไว้ที่ `PSTACK/ADAPT-OPENCODE.md` (ไฟล์ไหน แก้อะไร เพราะอะไร)
   **ห้ามใช้วิธี "ก็อปแล้วแก้เงียบ"** — ครั้งหน้าจะไม่มีใครรู้ว่าต้นฉบับกับของเราไม่เหมือนกันตรงไหน
2. **ARENA ไม่มีใน PSTACK** — BUDDHA ทำ Arena เอง เรียก `arena-runner`/`arena-judge`
   และ skill อื่นที่ยังอ้างถึง arena ให้แก้เป็น "BUDDHA ทำ Arena เอง"
3. **skill ที่ยังไม่ถูก adapt = `status: raw`** — ต้องมองเห็นสถานะนี้ใน BAZERCONSOLE (แท็บ ไฟล์ & สกิล)
4. **การ adapt ทำเป็นชุด** ไม่ใช่แก้ทีละไฟล์ด้วยมือ: เขียนสคริปต์แปลง + ออกรายงาน diff ให้คนตรวจ
   (สคริปต์อยู่ `BAZERCONSOLE/01MAIN/ACTIVE/SERVER/tools/` — ไม่ใช่ในโฟลเดอร์นี้ ตาม R1)
5. **BAZER/** สำหรับ skill ของเราเอง — ต้องบอกได้ว่า "skill นี้แก้ปัญหาอะไร" ในบรรทัดแรกของ README ในโฟลเดอร์
   ถ้าอธิบายไม่ได้ = ยังไม่ควรมี
6. ห้ามใส่ secret/token/path ของเครื่องใครลงใน skill (โฟลเดอร์นี้ขึ้น git)
