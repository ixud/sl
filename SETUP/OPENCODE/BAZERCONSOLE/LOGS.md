> หน่วยตัวเลขประจำการอัพเดตที่ใหม่ที่สุด (ล่าสุด) จะอยู่ระหว่างข้อความนี้ (อันที่คุณกำลังเห็นนี้เลย) กับ H1 อันแรก (อันที่ติดกับข้อความนี้ ฝั่งด้านล่าง)


# 00.00.32 - Friday 30th October 2026 - 2ad: perm log + danger/protected hardening

> permhook keeps every `ask` row (allow/deny still cap 5); ladder events carry `unk` (<=5 redacted segment texts); protected paths add share/cache/desktop, project .opencode + opencode.json(c), .git/hooks, .husky, console var/token-N; credential reads denied while var/state.json stays readable.
> Danger adds Clear/Remove/Initialize-Disk, git push -fu/+branch/--delete, Defender exclusions, Start-Process RunAs, local 431x /api; inner cmd /c and powershell/pwsh -Command text is checked. Tests 178/178.

# 00.00.31 - Thursday 29th October 2026 - 2ac: full permission object + danger regex fix

> Root cause: index.ts:97 peek wrapper dropped effect/action/resources/agent, so ladder.mjs:116 saw effect undefined and returned silently; ladder allow never ran. 2ac moves the permission body to permhook.mjs and forwards the full host object; no-effect now logs ladder-skip once per sid+reason.
> Danger: ladder.mjs format regex matched `Format-Table` (two false ladder-danger denies); now only format/format.com/Format-Volume/diskpart as command, while Format-Table/List/Wide/Custom, Out-String, git --format, format.txt and `cd format` are safe.
> Tests: 171/171 (baseline 165; pre-fix permhook suite failed to load, L15 Format-Table failed, L16 cap failed). Build 2ac.

# 00.00.30 - Wednesday 28th October 2026 - 2ab: validated shared slot + hookSeen guard

> Real 2aa failure: ladder.mjs wrote `{}` into bazer.flow.shared at module eval; index adopted it and hookSeen threw `G.hooks.has`; 7 instances in one pid shared it, host saw "Failed to drain Session".
> 2ab: shared.mjs sharedState() fills/repairs hooks(Set)/evt(Map)/flow({}) in place on every call; sharedBox and recordHook use it; hookSeen is try/catch including emit; guard paths stay fail-closed.
> Tests: 165/165 (shared 6/6: empty slot, missing fields, wrong types, throw, two writers, index static). Build 2ab.

# 00.00.29 - Tuesday 27th October 2026 - K5: single-instance launcher, no attached terminal

> launch.mjs probes 127.0.0.1:4310–4311 via GET /api/state (app.root + app.port identity), reuses the running console or spawns index.mjs detached (windowsHide, stdio ignored, unref), polls 20 s, opens the default browser once, exits 1 with one Thai line on timeout.
> Wrappers: BAZER CONSOLE.vbs now runs launch.mjs hidden (window style 0, no index.mjs); new launch.cmd prints one Thai line and ends `exit /b`; nothing kills a process or closes a parent terminal.
> Tests: 6/6 with fake HTTP server, fake spawn and fake opener (found/no-spawn, spawn+poll, timeout, foreign listener, wrapper text, /api/ping). Launcher not tested end-to-end: owner runs it once.

# 00.00.28 - Tuesday 27th October 2026 - 2aa: ladder diagnostics + request-agent fallback

> First real ladder run (installed 2x, new window, SNACK) did not grant and logged no ladder row: likely the fresh instance had no session meta (root agent empty) or level 0; hot reload 2w->2x was observed in one pid.
> 2aa: every early return logs ladder-skip (first 3 per sid/reason, no command text) + one ladder-src per process; primary session with no known agent and no parent may use request.agent when it is a spec ladder agent; flows/subagents never fallback.
> Tests: 159/159 (ladder 14/14). Real ladder.json untouched. Build 2aa.

# 00.00.27 - Tuesday 27th October 2026 - 2z: hermetic ladder tests + external_directory globs

> 2y verified: all-resource shell judging holds; real ladder.json hash/mtime unchanged (c4a30b…, 2026-10-27T11:14:05Z).
> 2z: runtime reads no ladder file unless a path/loader is injected; only index.ts wires LADDER_FILE(%USERPROFILE%). External_directory accepts exactly `<absolute dir><sep>*` and judges `<dir>` against temp roots; `**`/mid-`*`/`?`/`[`/relative/`..` leave, project dirs never granted.
> Tests: 158/158 (ladder 13/13); real ladder.json untouched. Build 2z.

# 00.00.26 - Tuesday 27th October 2026 - 2y: all-resource ladder judging + build 2y

> 2y: shell permission now classifies EVERY resource, not resources[0]; all must be READ/TEMP at L1 or additionally PROJ/BUILD at L2; empty/non-string leaves; adapter keeps the full resources array.
> edit/external: glob or relative resources are unresolvable -> leave; absolute temp paths allowed; effect allow/deny untouched. Full-command shellWrite scope fixes variable temp deletes (baseline U52 failure on the real level-1 ladder).
> Tests: 156/156 (baseline 154/155, U52 failed before any edit; ladder 11/11). Build 2y.

# 00.00.25 - Tuesday 27th October 2026 - ladder L0-L2 + build 2x

> Ladder: file %USERPROFILE%\.local\state\opencode\bazer-flow\ladder.json {v:1,level,expires,setBy}; L0 = host decides, L1 = read/temp, L2 = project/build when the flow phase has writeProject; missing/invalid -> L0, expired L2 -> L1; the plugin never writes it.
> permission.evaluate mutates effect only when the host said `ask`; DANGER/UNKNOWN never granted; DANGER denied in tool.execute.before with reasonCode ladder-danger; spec ladder agents [snack,advisor] / flows [buddha,bazer]; first 10 ladder rows per session, never command text.
> 2x: F1 real read-only script passes at L1; child inherits the root; staged rollout starts with SNACK; 155/155 tests (baseline 145). Build 2x.

# 00.00.24 - Tuesday 27th October 2026 - K4b: ladder 0/1/2 (ladder.json) + advisor fix

> `ladder-set` {level 0|1|2, hours 1–24 default 8}: L0/L1 no confirm; L2 requires typed `เหมาเข่ง` and spells out what L2 opens (project writes after GATE 2, build/test/commit, web) vs always blocked/asked (protected paths, force-push, reset --hard, clean -f, delete outside temp, unclassifiable commands). Atomic write + history row; state API exposes `ladder {level,expires,valid,mtime,path}`.
> Migration on first run: old stored 1→L0, 2..5→L1 (never L2), notice `ตั้งบันไดเป็น L1 อัตโนมัติ`; old policy keys untouched, idempotent.
> Advisor overrides now glob/grep/list allow, shell ask, edit deny; SNACK unchanged. Probe adds warn-only ladder-state (valid/unexpired + flow.spec.json lists `ladder`). Modes tab shows L0/L1/L2 radios + expiry/time left + typed L2 confirm.
> K4b: 9/9 ladder tests; not installed yet.

# 00.00.23 - Tuesday 27th October 2026 - K4a: single permission owner (config only)

> Decision: buddha/bazer/snack/advisor/arena-runner/arena-judge take permission only from opencode.jsonc agent.<id>.permission; md carries no permission block. Config writes replace the whole object, install strips legacy md blocks with backup, undo/rollback tested. Install not done yet.
> Recon: host is last-match-wins and appends frontmatter after config, so file wins per key; policies.json:2 fixed, probe permission-level now reports md-block + config-vs-computed drift. Sticky downgrade 3->1 fixed (replace + stored-level install = no stale webfetch/websearch/external_directory).
> Tests: permissions 9/9, console tools 19/19. 2w follow-through: flow-less roots are spec-driven (advisor readOnly, snack open) and gate-cli pending rows carry head/exit; build 2w.

# 00.00.22 - Tuesday 27th October 2026 - recon P1-P8 + build 2w

> Recon: permission resolution is last-match-wins (2.0.32 off 145127996; 2.1.3 off 173213661); md frontmatter is appended after config agent rules (2.0.32 off 145493944; 2.1.3 off 173663968), so file wins per key - policies.json:2 is wrong, probe.mjs:245 is right; a config/file deny short-circuits before permission.evaluate.
> Recon: L3 = blanket shell allow (resource "*") plus web/external; downgrades are sticky because apply.mjs:184 merge:true never deletes keys dropped at lower levels. Hook contract: one shared object, `effect` mutated, return ignored; shell resources are parsed segments, no metadata/cwd.
> 2w: flow-less roots are spec-driven via top-level `agents` (advisor readOnly, snack open; absent = open). agentmode.mjs denies project writes and classified shell writes outside temp, children inherit the root mode, flow agents unchanged; permission.evaluate logs {sid6,agent,action,n,lens,hasMeta,metaKeys,effect,source} once per session/action (max 5, never resource text); gate-cli pending rows carry head<=200 + exit once per callId.
> Tests: 145/145 (baseline 139/139; pre-fix U98 failed on missing head/exit, agentmode suite failed on missing module, U99 passed). Caps: runtime 518, agentmode 40, index 214, spec +5; build 2w.

# 00.00.21 - Sunday 25th October 2026 - K3: dev-file refs + selftest baseline
> K2 verified: real state.json sha256 EE3E8824…FBD9 and history.tsv BD072E27…CDA9 unchanged; backups 1,402 / quarantine 67 / tokens 8.
> K3: apitest plugin check now requires index.ts and neither logic.mjs nor guard.test.mjs; GUIDELINE/USECASES point gate logic at engine/runtime; min OpenCode stays 2.0.30 everywhere.
> Selftest baseline: 73 passed, 0 failed (one run under k3 backup; no child process, no network, writes only temp homes).
> logic.mjs/guard.test.mjs remain deleted; the next plugin install prunes them from the installed copy.

# 00.00.20 - Sunday 25th October 2026 - K2: named messages, token sweep, backup retention
> K1: state store derives from --home (real var only for the real home), apitest is sandboxed, and a temp snapshotHome is ignored; the SNACK mode-lock run line was removed.
> K2: blocker/pending summaries name 3 items +K (reason <=30, total <=160); strategy patch is a blocker; token file uses the bound port with stale token sweep; backups keep 100 rounds + lastApply.
> README tree/mode count fixed; plugin logic.mjs/guard.test.mjs deleted (24 assertions); selftest stale SUBSUBAGENT/logic refs removed.
> Console relaunch needed to load K1+K2; user must recreate model snapshot; first apply after install prunes ~1,300 old backup rounds.

# 00.00.19 - Sunday 25th October 2026 - K1: isolate Console state store (H1)
> H1: every writer reached the real var/ under --home; apitest wrote state/history/token/bintest there, so the real state.json held fixtures (modelsSnapshot p/one..p/four, snapshotHome=%TEMP%\bazer\api test home, locks.models).
> K1: storeFor(home) = real var for the real home, <home>/.bazerconsole/var otherwise; index builds one STORE (token included), actions/probe pass it, cleanup quarantine follows it; apitest is fully sandboxed.
> B4: a snapshotHome that is not the current home (real store: not the real home / under temp) hides modelsSnapshot; lock-restore refuses with "snapshot มาจากโฟลเดอร์ทดสอบ - สร้าง snapshot ใหม่"; drift is hidden.
> Old test fixture pollution of real state.json; guard added; user must recreate model snapshot.
> Tests: node --test tools/isolation.test.mjs 2/2; node --check apply/actions/index/probe/apitest.

# 00.00.18 - Saturday 24th October 2026 - hello13 result + build 2v
> hello13 (2t): buddha flow P0->P7 with no `>>` commands; GATE1/GATE2 advanced via the gate hook. The first arena-runner task call failed instantly (after-hook status error, head empty, error text not captured, cause unknown); the retry ran, but it was the only runner, so the judge saw candidate C1 only.
> A live BAZER flow in another window sat at B4 when 2t booted; version-only migration reset it to B12 and its builder call was then denied phase-order. Design flaw, fixed in 2v: keep phase/round/counters when the phase id exists and stored `expect` matches; reset only on unknown phase or changed expect; migration logs `kind` (keep|reset).
> 2v: failed task head = error text (adapter keeps `${error.message}`); first error per process logs `task-err-shape` (shape only, string leaves = lengths). Log ring 400 -> 1500 (1500-line rewrite 1 ms); same-state `gate-cli` rows once per callId per process. Tests 140/140.

# 00.00.17 - Friday 23rd October 2026 - pre-flight for 2t install + build 2u (manifest/selftest/docs only)
> Pre-flight after the Arena rewrite: Console `apply` refused with 3 blockers — manifest.json:170 pointed at AGENT/02SUBAGENT/ARENA.md, :192/:205 at AGENT/02SUBAGENT/SUBSUBAGENT/...; all three missing. Fixed: runner/judge sources → AGENT/02SUBAGENT/..., `sub.arena` entry removed; static missing count 3 → 0.
> Install rewrites each agent file's whole `permission:` block from the saved ladder level (state.json level 3; apply.mjs:135-140) — the repo body survives. Runtime precedence config-vs-file is unresolved: policies.json:2 says config wins, probe.mjs:245 assumes file keys win.
> apply never deletes retired installed agents (arena.md stays) → backlog: manifest `retire` list.
> Owner UI backlog: blocker and self-check ("needs action N") messages must name each item, cause and fix — the data is already in plan.blockers / plan.entries.
> 2u: BUDDHA.md skip/feedback/no-git/timeout prose fixed (net -45 chars); BAZER.md + 3 GUIDELINE files de-referenced agent `arena` (prose; BAZER net -10); selftest 554/557 paths fixed (364 still stale, report-only); 133/133 tests. Plugin build stays `2t`.

# 00.00.16 - Friday 23rd October 2026 - arena agent removed, P3 option Y, build 2t
> Agent `arena` removed: OpenCode has no sub-sub-agent, so buddha→arena→runner failed "agent not found". BUDDHA now runs Arena itself in P3; spec P3 expect = `buddha`, also = `arena-runner`, `arena-judge`, `poteto`.
> P3 exit = option Y: `poteto.start` → P4 only when ≥1 runner `started` and ≥1 judge `done` (non-error, non-running) since phase entry; otherwise the call is denied with a ≤160-char hint naming the missing requirement + "or user types >>skip". Re-runs stay in P3. `>>skip`/`>>abort` unchanged.
> 2t: spec v2 `requires[]` replaces `requireChild`; running/error results never count as done (error undoes a provisional start + `child failed` log); `tempOnly` = arena-runner/judge may write only under temp at any phase; `task-after` log {sid6,caller,subagent,status,head} once per callId; state migration (version/unknown phase → flow start + notice); badge = `<phase> <NAME> [rN]`; agent name `arena` removed from spec/runtime tests and dead logic/guard tests; 133 tests.

# 00.00.15 - Thursday 22nd October 2026 - hello11 (gate tool) + build 2s
> hello11 finding (inference, unverified): the root flow agent called Plannotator's own plan tool; its `{content:[{type:'text',text:'Plan approved! …'}]}` result classified as pending (anchored rules never saw the text) → phase stayed P2/P5 and the next task was denied phase-order.
> Fallback that worked: the user typed `>>approve` at P2 → P3.
> 2s: spec `gateTools:["submit_plan"]` + gate-tool route (caller = expect OR root flow key, dedupe `g:<callId>`), envelope unwrap + anchored approved / not-approved prefixes, `plan` log {tool,sid6,agent,head}, `gate-cli-after` only for remembered or gate-tool calls (once per callId per process), in-command `$v="…"` resolution (depth ≤3, conflicting = unresolved), synthetic `head` ≤80 chars; 124 tests.

# 00.00.14 - Thursday 22nd October 2026 - build 2q real run + 2r (temp roots, quoting, multi-line)
> (a) 2q real run "hello10": BUDDHA P0→P7 completed without `>>skip`; arena-runner ×3 + arena-judge ×1 counted (child guard works); GATE1/GATE2 approved via hook+event routes; the `shell.ended` route is still unexercised (no timeout occurred).
> (b) 2r: temp roots = `%TEMP%\bazer` + `%TEMP%\opencode` (models keep using the latter); backtick/backslash-escaped quotes stripped around redirect targets; multi-line / `;` PowerShell checked per statement — every target must be inside a temp root.
> (c) BACKLOG (owner observation): "บันไดเหมาเข่ง" does not work in practice — most shell commands still prompt, e.g. a long read-only inline PowerShell (`ReadAllText`/`Split`/regex comparing a project doc against a copy under `%TEMP%\opencode`). Idea, undecided: drive the ladder by plugin classification (read-only / temp-only) via `permission.evaluate` instead of command patterns. Handle in queue item 4 / at the end.

# 00.00.13 - Thursday 22nd October 2026 - DEMAND vs build 2q (intent vs current behavior)
> DEMAND.md = owner's original intent; NOT edited. Current build deviates:
> 1. Gate feedback: DEMAND sends it back to the plan phase (B3→B2 line 221, P2→P1 229, P5→P4 234); current spec = stay (revise in place, badge `GATE rN`) — deliberate, tested on a real run.
> 2. `>>approve`/`>>skip`/`>>abort` and "only a human may skip Arena" are later additions; DEMAND is silent.
> 3. Not implemented vs DEMAND: Arena background-loop watchdog (line 78), Plannotator auto-return to caller mode (170-172), SNACK/ADVISOR edit/no-edit split beyond `.md` (174-179), ladder risk-confirmation surface (48).
> 2q: `requireChild` on P3 blocks `arena.done` with zero started children; task/write deny hints name allowed agents and the temp dir; null sinks (`2>/dev/null`) stop counting as writes; 116 tests.

# 00.00.12 - Thursday 22nd October 2026 - build 2o/2p: background gate CLI (shellID → session.shell.ended)
> 2o: log-only synthetic inbox (shape/hasDecisionKey/hasShellId, dedupe per inboxID) + `gate-cli-after` outcome running/timeout; PLANNOTATOR timeout 900000 ms, no rerun.
> 2p: running shellID → callId mapped in store (`shid:`); `session.shell.ended` re-runs the same gate checks and applies once; running/timeout never touch counters; deny hint "gate review still running"; 109 plugin tests.

# 00.00.11 - Wednesday 21st October 2026 - bazer-flow v2: flow engine + runtime + gate CLI (build 2n)

> คำขอของแชทนี้: อ่าน/วิเคราะห์ระบบเดิม (read-only) → ออกแบบ "flow engine" ที่สถานะเฟสเป็นข้อมูลจริง ไม่เดาจากข้อความแผน → ทำ runtime/hook จริง → ไล่ปิดช่องรั่วจาก log จริงของผู้ใช้ (gate-cli, shell classification, 4 instances, inbox, WSL ฯลฯ)
> **ขอบเขตที่แตะ:** `AGENT/04PLUGIN/bazer-flow/**` ทั้งโฟลเดอร์ + เอกสาร 2 ไฟล์ (`AGENT/02SUBAGENT/PLANNOTATOR.md`, `AGENT/02SUBAGENT/SUBSUBAGENT/ARENA-RUNNER.md`) — **ไม่แตะ** Console (`BAZERCONSOLE/**`), `policies.json`, โหมด `.md` อื่น
> **ไม่รัน:** `selftest.mjs` / `apitest.mjs` (บั๊กเดิม: เขียนทับ `var/state.json` จริง) · ไม่รัน `opencode.exe` / `plannotator.exe`

## 1) สถาปัตยกรรมใหม่ของปลั๊กอิน (แยกชั้นชัด)

| ไฟล์ | บรรทัด | หน้าที่ |
|---|---|---|
| `flow.spec.json` | 28 | ข้อมูลล้วน: defaults + 2 flows (BUDDHA/BAZER) + เฟส/transition/gate/skippable/also |
| `paths.mjs` | 217 | จำแนกคำสั่ง shell (write/read/scope), ตัวแปร env, `/mnt/<d>/`, inner `-c`, protected paths, gate-cli verdict |
| `engine.mjs` | 246 | pure state machine: `check/apply/remind/badge/serialize/deserialize` — **ไม่มี id/ชื่อ agent hardcode** |
| `runtime.mjs` | 482 | stateful layer: store only (ไม่มี cache), identity, dedupe, gate CLI, inbox, logs |
| `adapter.mjs` | 165 | แปลง payload ของ host → runtime input (tool req/res, chat.message, tool events, inbox, agent.selected) |
| `store.mjs` | 58 | fs store sync + atomic write + `ringLog` + `loadSpecFile` (fileURLToPath) + prune 7 วัน |
| `diag.mjs` | 161 | `shapeOf/shapeDeep/stringLeaves`, `introspect/ctxNames`, `createFlowLog`, `codeOf`, `bootEntry` |
| `index.ts` | 202 | wiring บาง ๆ: hooks + boot log + event routing (ไม่มี business logic) |
| `tui.tsx` | 60 | badge อ่านไฟล์ `v2/badge-<sid>.txt` (poll 800ms) |
| `logic.mjs` | 282 | ของเดิม (decide/phaseFor/approvalOf) — **เก็บไว้** เพราะ `guard.test.mjs` + `SERVER/tools/selftest.mjs:773` ยัง import |
| `guard.test.mjs` | 176 | เทสต์เดิมของ logic (ไม่แก้) |

เทสต์: `engine.test.mjs` 296 · `runtime.test.mjs` 1045 · `adapter.test.mjs` 124 · `store.test.mjs` 96 → **100 passed / 0 failed** (engine 23 · runtime 59 · adapter 10 · store 8)

## 2) สเปกเฟส (แหล่งความจริงเดียว = `flow.spec.json`)

BUDDHA: `P0 SURVEY → P1 PLAN1 → P2 GATE1 → P3 ARENA → P4 PLAN2 → P5 GATE2 → P6 BUILD → P7 DONE`

| เฟส | expect | gate | writeProject | also | transition |
|---|---|---|---|---|---|
| P0 | poteto | – | – | – | poteto.start→P1 |
| P1 | poteto | – | – | – | poteto.done→P2 |
| P2 | plannotator | ✓ | – | poteto | approved→P3 · feedback→**stay** |
| P3 | arena | – | – | arena-runner, arena-judge, arena-loop1 | arena.done→P4 · skip→P4 |
| P4 | poteto | – | – | – | poteto.done→P5 |
| P5 | plannotator | ✓ | – | poteto | approved→P6 · feedback→**stay** |
| P6 | builder | – | ✓ | – | builder.done→P7 · builder.error→stay |
| P7 | – | – | – | – | terminal |

BAZER: `B12 PLAN → B3 GATE → B4 BUILD → B5 FIX` (B3 feedback→stay · B4/B5 writeProject ✓ · B5 terminal)

กติกา engine:
- `check(state, req)`: subagent เริ่มได้เมื่อ `name == expect` หรือ helpers (`explore`) หรือ `also[]`; `submit_plan` เฉพาะ gate; project write เฉพาะ `writeProject`; read/temp ผ่านเสมอ
- `apply(state, ev, now)`: transition ตามตารางเท่านั้น · event ที่ไม่ตรงถูกทิ้ง (state เท่าเดิม) · **ไม่อ่านข้อความแผน**
- counters: `feedback{}` (ต่อเฟส) · `pending` · `planErrors` (plan error แยกจาก pending) · `errors` (subagent error) · `skipped[]` · `approvals{}`
- `remind` ≤160 ตัว: hint อย่างเดียวตามลำดับ feedback≥3 → planErrors → pending@gate → subagent errors → stall
- `badge`: ที่ gate = `GATE r<feedback+1>` (≤12) นอกนั้น `<phase> <name>`
- `serialize/deserialize` versioned; ttl 12 ชม.; ผิดรูป/flow ไม่รู้จัก → เริ่มใหม่ (write ปิด)

## 3) Runtime: identity, trust, dedupe (อ่าน store ทุกครั้ง ไม่มี cache)

- state key `<root>.<flow>` · meta key `meta` (agents/links) · notice key `notice.<root>.<flow>` · seen key `seen` (cap 200) · gate list key `gcli` (cap 50)
- `rootOf` ไล่ parent ≤5 ชั้น (cycle-safe) · `info()` คืน root/hops/flow/phase/agent
- **trust rule (userChat)**: รับเฉพาะ session ที่เป็น root + agent ของ session ต้องเป็น key ของ flow (buddha/bazer) · dedupe ด้วย `m:<messageId>`
- subagent start/after ใช้ `b:<callId>` / `a:<callId>` · gate CLI ใช้ `g:<callId>` (ตั้งเฉพาะเมื่อ approved/feedback จริง — pending ไม่กิน key)
- memory-only: `calls` (callId→subagent, cap 50) · `gates` ย้ายเข้า store แล้ว (ข้อ 5)
- fail-closed: ไม่มี flow + subagent ที่รู้จัก + เขียน project = deny `orphan`; protected path deny ทุกกรณี (รวม peek/permission veto)

## 4) Gate CLI (ทางที่ใช้จริงเพราะ child ไม่มี `submit_plan`)

- ตรวจคำสั่ง: token `plannotator` (+`.exe`) + `--gate` + `--json`; echo/Write-Host/Write-Output/bare string รับได้เฉพาะ `EXIT=$LASTEXITCODE` / `$LASTEXITCODE` / `$?`; ปฏิเสธ `decision|approved|{` (ใน echo/bare/`--result-file`), `Set-Content/Out-File/printf`, redirect ไปไฟล์ (neutral `2>&1`, `2>$null` ไม่นับ)
- ผลลัพธ์: เก็บ string leaves ทุกชั้น (depth≤5) + JSON-parse ซ้ำ≤3 ชั้น + unescape `\n \r \"` → เอา **บรรทัดสุดท้ายที่เป็น JSON object มี `decision`**
- map: `approved`→approved · `annotated`→feedback · `dismissed`/อื่นๆ/ไม่มีบรรทัด→pending · error→error
- ใช้ได้เฉพาะ: root มี flow + เฟสเป็น gate + agent ของผู้เรียก == `phase.expect`
- 2 ทาง: hook `tool.execute.after` (output เป็น object/string) และ event `session.tool.called/success` (content[]); dedupe ข้ามทางด้วย `g:` ใน store
- log: `gate-cli-check` (ทุก shell ที่มี token, dedupe per callId), `gate-cli-after` (via/callId6/shape/tail/outcome|why), `after-seen` (เฉพาะ call ที่จำได้), `after-miss` (task ไม่มี subagent)

## 5) Shell classification (`paths.shellWrite`)

- read: `Write-Output/Write-Host/echo/bare string` (ไม่มี redirect), `[IO.File]::Read*`, `Get-Content`, `Test-Path`, `Select-String`, `ConvertFrom-Json`, `Join-Path`, `Get-ChildItem` ฯลฯ
- write: `Set-Content/Add-Content/Out-File/Remove-Item/Move-Item/Copy-Item/New-Item/rm/del/mv/cp/mkdir/...`, `[IO.File]::Write*/Append*`, redirect `>`/`>>` (neutral ยกเว้น)
- ตัวแปร: `$name="literal"`, `$env:NAME="..."` ในคำสั่งเดียวกัน + `$env:TEMP/TMP/LOCALAPPDATA/USERPROFILE/APPDATA` และ `%VAR%` (env ฉีดได้ผ่าน `createRuntime({env})`); `Join-Path <literal> <literal>` ถอดเป็นพาธ
- **builtin ไม่นับเป็น user var**: `$LASTEXITCODE $? $null $true $false $_ $PSScriptRoot $PWD $HOME $args $input $Error $ErrorActionPreference`
- WSL: `/mnt/<drive>/...` → `<DRIVE>:\...` (ใช้ทั้ง write target และ protected check)
- inner script: `bash -c`, `sh -c`, `cmd /c`, `powershell -Command` → วิเคราะห์ข้อความในเครื่องหมายคำพูดด้วยกฎเดียวกัน + ใช้ `cd`/`cd /d`/`Set-Location` ในคำสั่งเป็น cwd; ถ้าไม่มีใช้ `input.workdir`
- interpreter (`python -c`/`node -e`/`perl -e`/`ruby -e` + open w/a/wb/writeFile/File.write/>) → deny `interpreter-write` (ไม่วิเคราะห์เนื้อหาข้างใน)
- detail enum: `write-verb|redirect|io-write|unresolved-var|interpreter-write|protected|phase-order` (deny log ใช้ค่า `detail` ก่อน แล้ว fallback `codeOf`)
- hint ตาม detail: unresolved-var = "STOP. Each shell call is a separate process…" · redirect/io-write/interpreter-write = "Use the write/edit tool with a full literal path under %TEMP%\bazer\<task>\…" · phase/protected คงข้อความเดิม (เริ่มด้วย STOP/Stop, ≤200)

## 6) Log/diag (ไฟล์ `~/.local/state/opencode/bazer-flow/v2/`)

- `log.tsv` ring 400 บรรทัด · ทุกบรรทัดมี `seq/at/inst(4 hex)/pid`
- events: `boot` (build/spec hash 8/hooks/ctxMethods) · `hook-seen` · `evt-shape` (cap 40, skip catalog + `*.updated`) · `root`/`agent` (sid6/root6, dedupe ข้าม instance ด้วย `Symbol.for('bazer.flow.shared')`) · `deny` (hook/sid6/root6/flow/phase/tool/detail) · `after` · `after-seen` · `after-miss` · `user` (cmd|plain|ignored + itemType/delivery) · `user-miss` · `gate-cli-check` · `gate-cli-after` · `notice` · `error`
- deep shape สำหรับ `session.inbox.enqueued`, `session.tool.success`, `session.tool.called`, `session.agent.selected`: depth 4, ค่าเฉพาะ key `type`/`delivery`, string อื่นเป็น `s<len>`
- `ctx.txt` เขียนทับทุก boot (ชื่อ property depth 3, cap 800, ข้าม length/name)

## 7) Hooks ที่ผูกจริง (build 2n)

`ctx.agent.transform` (builder: submit_plan/subagent deny) · `ctx.tool.hook('execute.before')` (deny throw + gate-cli check) · `ctx.tool.hook('execute.after')` · `ctx.permission.hook('evaluate')` (peek เท่านั้น — ไม่ mutate) · `ctx.session.hook('context')` (push remind) · `ctx.event.subscribe` (links/agent/user/gate events/inbox)
→ key `"chat.message"` ยังอยู่ใน export แต่ **หลักฐานจริง: ไม่เคยยิง** → ถอดออกจาก `HOOKS` แล้ว (โค้ดเก็บไว้เฉย ๆ ไม่ทำอันตราย)

## 8) เอกสารที่แก้

- `PLANNOTATOR.md`: เพิ่มหัวข้อ **Canonical gate command** (template เดียว + 3 กติกา) · ลบคำสั่ง `--result-file` เดิม + ตารางอ่านไฟล์ผล 4 แถว (9 บรรทัด) · เปลี่ยนเป็นอ่านบรรทัด `decision` จาก stdout · คงสัญญา "child รายงานสถานะเท่านั้น ห้ามแก้แผนเอง"
- `ARENA-RUNNER.md`: เพิ่ม 4 บรรทัด — เขียน candidate ด้วย write/edit พาธเต็มใต้ `%TEMP%\bazer\<task>\candidate-N\` · ห้าม shell redirect/bash -c/cmd /c/python -c · ตัวแปรไม่คงข้ามคำสั่ง · ถ้าถูกปฏิเสธให้หยุดรายงาน

## 9) หลักฐานจากของจริง (read-only)

| เรื่อง | หลักฐาน |
|---|---|
| Plannotator 0.28.23 (`$CACHE/npm/@plannotator/opencode@latest/.../dist/index.js`) | `invokingAgent: context.agent` (16942) → child ถูก reject ที่ 15188-15191 เพราะ `planningAgents=[buddha]` |
| decision vocabulary | `approved`/`annotated`/`dismissed` (14822,14856,14860) · `approved:true` boolean |
| workflow matrix | manual/user-managed = ไม่แตะ config/prompt · plan-agent = reject non-planning + rewrite perms + inject prompt · all-agents = ไม่ reject |
| approve side effect | `session.prompt({agent, noReply:true, parts:[text]})` (16967-16975) เมื่อมี `agentSwitch` จาก UI |
| child ไม่มี `submit_plan` | ใช้ CLI `annotate --gate --json --require-approval --result-file`; stdout มี `{"decision":"approved"}\nEXIT=0` |
| host hooks | binary: `session.hook("context"/"compaction"/"generate")`, `permission.hook("evaluate")`, `tool.hook("execute.before"/"after")`; **ไม่มี** `chat.message` |
| 4 instances/1 pid | hook tool.*/permission/session ยิง instance เดียว · `event.subscribe` ยิงทุก instance · sid8 ซ้ำ (ใช้ 6 ตัวท้ายแทน) |
| event envelope | `{id,created,type,data}` · `session.inbox.enqueued data.item.type=user|synthetic|compaction` · `session.tool.called input.workdir` |

## 10) ยังพิสูจน์ไม่ได้ / ค้าง

- ปลั๊กอินยังไม่ถูกโหลดจริงหลัง build 2n (ต้องติดตั้งผ่าน Console → เปิด OpenCode ใหม่)
- `chat.message` legacy ไม่ยิง → path นั้นเป็น dead code ที่รอวันถอด
- `submit_plan` ใน child: ถูก Plannotator reject เพราะ `planningAgents` มีแต่ buddha — ทาง CLI ถูกใช้แทนแล้ว แต่ยังไม่ได้ทดสอบรอบใหม่จริง
- `gate-cli-after` ยังไม่เคยเห็น `outcome:approved` จาก hook route ใน log จริง (เห็นแต่ทาง event)
- `ctx.txt`/`evt-shape` ยังไม่ถูกอ่านจาก log จริงหลัง build 2n
- `notices` เก็บใน store แล้ว แต่ dedupe ของ `dup`/`plain` อยู่ใน memory ของ process (หายเมื่อรีสตาร์ท)

## 11) บั๊กฝั่ง Console ที่เจอตอน recon (ยังไม่แก้ — ต้องขออนุญาต)

| # | อาการ | หลักฐาน |
|---|---|---|
| C1 | `apitest` เขียน `var/state.json` จริง (snapshotHome ชี้ temp) → drift/lock ของเครื่องจริงพัง | `apply.mjs` default store + `state.json` มี `"p/one"` |
| C2 | `detectPolicyLevel` อ่าน config เท่านั้น (ไฟล์ agent ชนะ) → UI โชว์ขั้นผิดได้ | `plan.mjs` detectPolicyLevel |
| C3 | `BAZER.md` ตั้ง `glob/grep/list: ask` ขัดกับ `policies.json` (allow) | ไฟล์โหมด vs policies |
| C4 | เอกสารนับ actions/entries/probes ไม่ตรง (22/23/11 vs 28/22/13) | `DOCS/USECASE-STATUS.md:253` |
| C5 | `SNACK.md`/`AGENTS.md.template` อ้าง `…\OPENCODE\CONSOLE\mode-lock.mjs` ที่ไม่มีอยู่ | ตรวจแล้วไม่มีไฟล์ |
| C6 | `apply` มี 28 actions / 22 entries / 13 probes — ตัวเลขใน LOGS รุ่นก่อนล้าสมัย | ไฟล์จริง |

## 12) วิธีทำงานต่อ

```powershell
cd "C:\BCS\00.02 LLM Slavery\SETUP\OPENCODE\AGENT\04PLUGIN\bazer-flow"
node --check paths.mjs; node --check engine.mjs; node --check runtime.mjs; node --check adapter.mjs; node --check store.mjs; node --check diag.mjs
node --test engine.test.mjs runtime.test.mjs adapter.test.mjs store.test.mjs
```
- build ปัจจุบัน: **2n** (`BUILD` ใน `index.ts`) · boot log อยู่ที่ `~/.local/state/opencode/bazer-flow/v2/log.tsv`
- ก่อนเชื่อ log ให้ดู `boot` ล่าสุด (spec hash + hooks) และ `inst` ว่าเป็น instance ไหน
- ถ้าจะเปลี่ยนพฤติกรรมเฟส → แก้ `flow.spec.json` ก่อน แล้วค่อยแก้เทสต์ (engine ไม่มี id hardcode)

## ไฟล์ที่แตะ (ทั้งแชท)

**ใหม่:** `flow.spec.json` · `paths.mjs` · `engine.mjs` · `runtime.mjs` · `adapter.mjs` · `store.mjs` · `diag.mjs` · `engine.test.mjs` · `runtime.test.mjs` · `adapter.test.mjs` · `store.test.mjs`
**แก้:** `index.ts` (เขียนใหม่ทั้งไฟล์) · `tui.tsx` · `logic.mjs` (ย้าย helper ออก) · `AGENT/02SUBAGENT/PLANNOTATOR.md` · `AGENT/02SUBAGENT/SUBSUBAGENT/ARENA-RUNNER.md` · `BAZERCONSOLE/LOGS.md`
**ไม่แตะ:** `guard.test.mjs` · `package.json` · Console ทุกไฟล์ · `policies.json` · โหมด `.md` อื่น

---

# 00.00.10 - Tuesday 20th October 2026 - บันได BAZER แยกจาก BUDDHA + ตรวจขั้นจาก config จริง

> คำขอ: "บันไดเหมาเข่ง ฝากทำให้ BAZER MODE ด้วย กดแยกกับ BUDDHA · เช็คว่าระบบตรวจว่าอยู่ขั้นไหนใช้ได้จริงไหม"
> และ: "ปุ่มเหมาเข่ง นอกจาก apply ที่ไฟล์ opencode ฝากทำให้มัน apply ที่ buddha.md กับ bazer.md ด้วย"

## 1) บันได BAZER (แยกอิสระจาก BUDDHA)

| ชิ้น | รายละเอียด |
|---|---|
| `policies.json` | เพิ่ม `bazer-ladder` (`mode: bazer`) ใช้ระดับชุดเดียวกับ BUDDHA ผ่าน `inherit` — `manifest.mjs` ขยาย levels ให้อัตโนมัติ (ไม่ก๊อปข้อมูลซ้ำ 5 ระดับ) |
| `manifest.json` | เพิ่ม entry `cfg.bazer-default` (`agent.bazer.permission`, `onlyIfMissing`) + `agent.bazer` มี `ladderPolicy: bazer-ladder` / `ladderAgent: bazer` |
| `apply.mjs` | `setPolicy(home, policyId, level)` · `undoPolicy(home, policyId)` · เก็บสถานะแยกใน `state.policies[id]` (และ mirror `state.policy` เฉพาะ buddha-ladder เพื่อความเข้ากันได้) |
| `actions.mjs` | `policy-set` / `policy-undo` รับ `params.policy` (`buddha-ladder` / `bazer-ladder`) |
| UI | แท็บ โหมด & สิทธิ์ แสดง **2 บันได** (BUDDHA / BAZER) คนละการ์ด คนละปุ่มย้อน · ขั้นที่ active มาจากค่าที่ตรวจได้ |

## 2) "อยู่ขั้นไหน" — เดิมเชื่อ state, ตอนนี้เชื่อ config จริง

**ปัญหา:** `curOf()` อ่านจาก `state.policies` (ค่าที่ Console เคยเขียน) — ถ้าผู้ใช้แก้ `opencode.jsonc` เอง (เช่นตั้งเหมาเข่งด้วยมือ) Console จะโชว์ผิด

**แก้:** `detectPolicyLevel(home, policyId)` เทียบ `agent.<buddha|bazer>.permission` ใน config กับ permission ของแต่ละขั้น (subset match)
- เจอตรงขั้นไหน → คืนขั้นนั้น + `source: 'config'`
- ไม่ตรงขั้นไหนเลย → `custom` (UI บอก "กำหนดเอง")
- ยังไม่มีค่าใน config → `null` (UI บอก "ยังไม่มีค่า — ใช้ขั้นเริ่มต้น" ไม่เดาว่าเป็น 1)
- `/api/state` ส่ง `policyDetected` ให้ UI ใช้ · probe `permission-level` อ่าน `state.policies[policy]` (ไม่ใช่ `state.policy` ก้อนเดียว)

## 3) apply ต้องเขียน `buddha.md` / `bazer.md` ตามขั้นที่ตั้งอยู่

**บั๊กที่เจอระหว่างทำ:** `writeEntry` ฉีด permission ด้วย `defaultLevel` (ขั้น 1) เสมอ → กด "ติดตั้ง/อัปเดตทั้งหมด" ทีเดียว **ขั้นเหมาเข่งที่ตั้งไว้จะหาย**
แก้: อ่าน `state.policies[policy].level` (fallback `state.policy` → defaultLevel) แล้วฉีดค่านั้น · `diffFor` ใช้ `detectPolicyLevel` เพื่อโชว์หลังเขียนให้ตรงความจริง

## 4) หลักฐาน

```
selftest → 74 passed  (+2: apply ใช้ขั้นที่ตั้งอยู่ · detectPolicyLevel อ่านจาก config)
apitest  → 80 passed  (+2: บันได BAZER เขียน agent.bazer · policyStateAll ตรง)
uc.mjs   → 100 passed · 0 failed
ghost audit → 28 actions / 28 handlers / ไม่มีปุ่มที่กดไม่ได้
```

## 5) ยังค้าง / ยังพิสูจน์ไม่ได้

- **เปลี่ยนชื่อโฟลเดอร์** (`OPENCODE`→`OUTDATED`, `MAJOR`→`OPENCODE`) — ถูกปฏิเสธ `Access denied` เพราะมีโปรเซสถือโฟลเดอร์ (console เก่า PID 11092 รันอยู่) → รอปิดโปรเซสก่อน
- **commit / push** — เครื่องนี้ไม่มี git repo และไม่มี remote
- probe `permission-level` ต้องรันบน OpenCode จริง (sandbox เห็นค่าของเครื่องจริง)

## ไฟล์ที่แตะ

`PASSIVE/01MANIFEST/{policies,manifest}.json` · `SERVER/{manifest,plan,apply,probe,actions,index}.mjs` · `UI/app.js` · `SERVER/tools/{selftest,apitest}.mjs` · `LOGS.md`

---

# 00.00.09 - Tuesday 20th October 2026 - "ต้องอัปเดต 4 แต่ apply เขียน 0" (แก้ความเข้าใจผิดของตัวเลข)

> อาการ: `plan` → ต้องติดตั้ง 0 · ต้องอัปเดต 4 · ปกติ 16 แล้ว `apply` → เขียน 0 · ข้าม 22

## ต้นเหตุ (ตรวจจาก plan ของ home จริง)

| entry | ทำไมไม่ถูกเขียน |
|---|---|
| `plugin.bazer-flow` | stale + writable **แต่ auto=false** → "ติดตั้งทั้งหมด" ข้าม (เจตนา: เปิด gate ต้องสั่งเอง) |
| `cfg.retire-old-flow` | entry นี้ตั้งใจ **ถอด** bazer-flow แต่ผู้ใช้ลงทะเบียนกลับ → stale ตลอด (เจตนาตรงข้ามกัน) |
| `tpl.agents-md` · `tpl.pstack-models` | stale แต่ **LOCKED** (owner=user) — ระบบไม่ทับไฟล์ผู้ใช้ (ถูกแล้ว) แต่ถูกนับรวมในคำว่า "ต้องอัปเดต" |

`ข้าม 22` = ok 16 + design 2 + auto=false 2 + owner=user 2

## แก้

1. **ถอด manifest entry `cfg.retire-old-flow`** — `retireOldFlow(home, name)` สร้างค่าเอง (`./plugins/<name>` + `${CONFIG}/opencode.jsonc`) → ไม่มี entry ที่ "อยากถอด" ไปปนกับ entry ที่ "อยากติดตั้ง" อีก
2. **`computePlan` แยก 3 ตัวเลข**: `actionable` (กดติดตั้งได้) · `manualOnly` (auto=false ต้องสั่งรายตัว) · `locked` (ของผู้ใช้) — summary ของ `plan` เปลี่ยนข้อความเป็น "ติดตั้งได้เลย N · ต้องสั่งเอง N · รอคุณตัดสินใจ N"
3. **UI ภาพรวม**: pill "ติดตั้งได้ N" + "ต้องสั่งเอง N" · การ์ดใหม่ **"ต้องสั่งเอง N รายการ"** พร้อมปุ่ม `ติดตั้งรายตัว` ต่อ entry · hint ว่าไฟล์ locked กด "รีเซ็ต" เองได้

## ผลหลังแก้ (home จริง)

```
summary: ok 16 · stale 3 · design 2 · actionable 0 · manualOnly 1 · locked 2
[stale] tpl.agents-md      LOCKED (ของคุณเอง)
[stale] tpl.pstack-models  LOCKED (ของคุณเอง)
[stale] plugin.bazer-flow  manualOnly → มีปุ่มติดตั้งรายตัว
```

## หลักฐาน

```
selftest → 71 passed   apitest → 75 passed   uc.mjs → 100 passed · 0 failed
```

## หมายเหตุถึงผู้ใช้

- ปลั๊กอิน **ยังไม่ถูกติดตั้ง** (ตั้งใจ) — `plugin.bazer-flow` เป็น auto=false เพราะการเปิด gate เปลี่ยนพฤติกรรมทั้งระบบ
- ลำดับที่แนะนำ: ทำงานที่ค้างให้จบก่อน → ค่อยติดตั้งปลั๊กอิน → ปิด-เปิด OpenCode (หลังเปิด gate แล้ว SNACK ยังแก้ไฟล์ได้ · BAZER ต้อง 1 approval · BUDDHA 2)

## ไฟล์ที่แตะ

`PASSIVE/01MANIFEST/manifest.json` · `SERVER/plan.mjs` · `SERVER/apply.mjs` · `SERVER/actions.mjs` · `UI/app.js` · `LOGS.md`

---

# 00.00.08 - Tuesday 20th October 2026 - ถอดปุ่มผีของ Plannotator (ตัดของ ไม่ใช่เพิ่ม)

> หลักการ: ปุ่มที่กดแล้วไม่มีผลจริง = ลบ ไม่ใช่ disable ค้างไว้

## ตัดออก

| ของที่ถอด | เหตุผล |
|---|---|
| action `plannotator-patch` (ทั้ง handler + `data-patch` ใน UI) | ไม่มีไฟล์ให้แพตช์ (UI ฝังใน exe) และตัวเลือกกลับโหมดเป็นค่าของหน้า review UI — เก็บไว้ = ปุ่มผีถาวร |
| `SERVER/plannotator.mjs` (ทั้งไฟล์) | dead code หลังถอด action (ไม่มีใคร import แล้ว — มีเทสต์กันกลับไว้) |
| manifest entry `patch.plannotator` | `design` ค้าง ถูกแทนที่ด้วย `plannotator-config` |
| ปุ่ม `แพตช์ปุ่ม → BUDDHA/BAZER` (2 ปุ่ม) | ตามข้างบน |

## เปลี่ยนชื่อให้ตรงความจริง

- `"ตั้ง Plannotator ให้ส่งกลับโหมดที่เลือก"` → **"ตั้งค่า options ของปลั๊กอิน Plannotator"** (`cta: บันทึก options`)
  เพราะมันเขียน `workflow`/`runtime`/`planningAgents` ไม่ได้สั่ง "กลับโหมด"

## เพิ่มเฉพาะที่ทำงานได้จริง

| ของใหม่ | ทำอะไร |
|---|---|
| probe `plannotator-version` (kind `exe-version`) | เรียก `${LOCALAPP}/plannotator/plannotator.exe --version` → รู้ว่ามี CLI + เวอร์ชัน (เดิมเดาไม่ได้) |
| `open-target which=plannotator` + ปุ่ม `เปิดโฟลเดอร์ข้อมูล (plans/config)` | เปิด `${PLANNOTATOR}` ดู plans/drafts/feedback/config.json ได้จริง |

## หลังตัด: Console แตะ Plannotator เหลือ 4 อย่าง

`ตรวจ` (locate) · `ตั้ง options` (config) · `เปิดโฟลเดอร์ข้อมูล` · `ติดตั้ง/อัพเดตปลั๊กอิน` (+ `ดูรายการ`) — ทุกตัวมีผลจริง ไม่มีตัวไหน disabled ค้าง

## หลักฐาน

```
selftest → 71 passed   (มีเคส: action patch ต้องไม่อยู่ + โมดูลต้องไม่อยู่ + UI ต้องไม่มี data-patch)
apitest  → 75 passed   (เคสใหม่: plannotator-patch → "ไม่รู้จัก action")
uc.mjs   → 100 passed · 0 failed
```

## ไฟล์ที่แตะ

`PASSIVE/01MANIFEST/{actions,manifest,probes}.json` · `SERVER/actions.mjs` · `SERVER/probe.mjs` · `SERVER/plannotator.mjs` (ลบ) · `SERVER/tools/{selftest,apitest}.mjs` · `UI/app.js` · `LOGS.md`

---

# 00.00.07 - Tuesday 20th October 2026 - แก้ข้อสรุปผิดเรื่อง "กลับโหมด" ของ Plannotator

> ผู้ใช้แย้งว่า "เคยตั้ง approve → buddha ได้ทั้งแบบมีตัวเลือกและแบบบังคับ" → ตรวจ README ปลั๊กอิน `@plannotator/opencode` แล้ว **ผู้ใช้ถูก ผมสรุปผิด**

## ความจริง (จาก README ปลั๊กอิน 0.27.x)

| เรื่อง | ข้อเท็จจริง |
|---|---|
| "อนุมัติแล้วกลับโหมดไหน" | เป็น **ค่าที่เลือกในหน้า review UI** → ปลั๊กอินเรียก `ctx.session.switchAgent` ให้ · host ที่ไม่รองรับ = แผนยังอนุมัติ แต่มี warning ใน log |
| ตั้งจาก config | ได้แค่ `options.workflow` (`plan-agent` / `user-managed` / `all-agents` / `manual`) · `options.planningAgents[]` · `options.runtime` (`cli`) |
| `~/.plannotator/config.json` | มีแค่ `reviewAnalysis` — **ไม่มีเรื่อง approve target** |
| ไฟล์ให้แพตช์ | ไม่มี: UI ฝังใน `plannotator.exe` (สแกนแล้ว `switchTo` ที่เจอเป็นของ parse5) |

→ ข้อสรุปเดิม "CLI-only จึงแพตช์ไม่ได้" ถูกแค่ครึ่งเดียว: **ไม่มีไฟล์ให้แพตช์จริง** แต่ **ไม่ได้แปลว่าตั้งไม่ได้** — ตั้งใน UI

## แก้อะไร

1. **`plannotator-config`** รับ `workflow` 4 ค่า + `runtime` (`cli`) + `planningAgents` และรองรับ package ที่มี `@version` ต่อท้าย (`startsWith`)
2. **ข้อความ CLI-only** ทั้งใน action และ module: เปลี่ยนจาก "ใช้ CLI gate แทน" → "เลือกโหมดในหน้า review UI; Console ตั้งได้แค่ options; CLI gate ใช้ `--result-file`"
3. **UI (แท็บ ระบบ)**: การ์ด Plannotator มี select `workflow` / `runtime` / `planningAgents` + ปุ่มเดียว `บันทึก options` · ปุ่มแพตช์ disabled พร้อมเหตุผลที่ถูกต้อง · เพิ่มคำอธิบายว่า `user-managed` เหมาะกับเรา (gate เป็นหน้าที่ `bazer-flow`)
4. **`PLANNOTATOR.md`**: ระบุว่า switch เกิดที่ UI และ `bazer-flow` ล็อกเซสชันไว้แล้ว จึงไม่พังถ้า host ไม่รองรับ · ห้ามแพตช์ exe
5. **เทสต์**: เพิ่มเคสสัญญา `plannotator-config` (4 workflow + runtime + `startsWith('@plannotator/opencode')`)

## หลักฐาน

```
selftest → 71 passed
apitest  → 76 passed
uc.mjs   → 100 passed · 0 failed
```

## ยังพิสูจน์ไม่ได้

- host ของ OpenCode 2 บนเครื่องนี้ expose `ctx.session.switchAgent` หรือไม่ (ต้องกดอนุมัติจริง 1 ครั้งแล้วดู Session เปลี่ยนโหมดหรือไม่ / ดู log warning)

## ไฟล์ที่แตะ

`SERVER/actions.mjs` · `SERVER/plannotator.mjs` · `UI/app.js` · `AGENT/02SUBAGENT/PLANNOTATOR.md` · `SERVER/tools/selftest.mjs` · `LOGS.md`

---

# 00.00.06 - Tuesday 20th October 2026 - Plannotator CLI-only: ปิดช่อง "ปุ่มกลับโหมด"

> คำถามผู้ใช้: "ปุ่มแพตช์ใช้ไม่ได้ — เราใส่ format ผิดป่าว?" → ตรวจของจริงแล้วพบว่า **ไม่ใช่เรื่อง format**

## ข้อเท็จจริงที่พิสูจน์

| ตรวจ | ผล |
|---|---|
| สแกนไบนารี `plannotator.exe` (180,794,880 bytes) | `switchTo` 5 จุด — **ทั้งหมดเป็น parse5** (`_switchToTextParsing`, `switchToPlaintextParsing`) ไม่ใช่ปุ่มอนุมัติ |
| `plannotator.html` / `approve-target` ในไบนารี | ไม่พบ |
| `plannotator --help` | ไม่มี flag ให้ตั้ง "กลับโหมดไหน" · มี `--browser` · `annotate … [--gate] [--json] [--require-approval] [--result-file]` |
| ไฟล์ใน `%LOCALAPPDATA%\plannotator` | มีไฟล์เดียว = exe → **ไม่มีไฟล์เว็บให้แพตช์** |

**สรุป:** message "CLI-only" ที่ Console แสดงคือข้อเท็จจริง ไม่ใช่บั๊ก · การแพตช์ exe ไม่ควรทำ (ไม่มี token, 180 MB, อัปเดตทับ)

## ทางแก้ที่ใช้ (ทำแล้ว)

1. **`PLANNOTATOR.md`**: ยกระดับ `--result-file` เป็นสัญญาหลัก — ตารางสถานะ 4 ค่า (`approved` / `feedback` / `pending` / `error`) อ่านจากไฟล์ผล **ไม่ใช่จากปุ่ม** · ระบุ "ผู้เรียกเป็นเจ้าของการตัดสินใจว่ากลับโหมดไหน" · ห้ามแพตช์ exe
2. **ข้อความใน Console**: `plannotator-patch` (CLI-only) และ `plannotatorPatch` note ชี้ `--require-approval --result-file <ไฟล์>` แทนข้อความลอย ๆ
3. **UI (แท็บ ระบบ)**: เพิ่มบรรทัดอธิบายว่า "ไม่ต้องพึ่งปุ่ม — ผลกลับมาที่ผู้เรียก"
4. **เทสต์กันถอย**: selftest 2 เคส — `PLANNOTATOR.md` ต้องมี `--require-approval` `--result-file` `--json` `pending` + บอกตรง ๆ ว่า CLI-only แพตช์ไม่ได้ · ข้อความ CLI-only ใน server ต้องชี้ `--result-file`

## หลักฐาน

```
selftest → 70 passed   (68 → 70)
apitest  → 76 passed
uc.mjs   → 100 passed · 0 failed
```

## ยังพิสูจน์ไม่ได้

- ผลจริงของ `--result-file` กับ Plannotator เวอร์ชันบนเครื่องนี้ (ต้องยื่นแผนจริง 1 ครั้ง — ต้องมีคนกดอนุมัติ)
- `options.planningAgents` มีผลกับปลั๊กอิน OpenCode จริงหรือไม่ (ต้องเปิด OpenCode ใหม่แล้วอนุมัติ 1 ครั้ง)

## ไฟล์ที่แตะ

`AGENT/02SUBAGENT/PLANNOTATOR.md` · `SERVER/actions.mjs` · `SERVER/plannotator.mjs` · `UI/app.js` · `SERVER/tools/selftest.mjs` · `LOGS.md`

---

# 00.00.05 - Tuesday 20th October 2026 - Wave A/B · ปลั๊กอินติดตั้งได้ · Arena ยืดหยุ่น · บันไดลง agent file

> คำขอของผู้ใช้ 6 ข้อ (ปลั๊กอินผ่าน Console · Arena multi-select+effort · รวม DEMAND→LOGS · ขุด Console เก่า · ซ่อมปุ่มแพตช์ · บันไดลง `agents/`)
> **บริบทสำคัญ:** ผู้ใช้กด `retire old flow` → ปลั๊กอิน gate ถูกถอดจาก config และ `submit_plan` หายจาก toolset → งานนี้จึงยึดแผนที่เขียนในแชตเป็นสัญญา + สำรองไฟล์ก่อนแก้ที่ `%TEMP%\bazer\ultra\snapshot2\`

## 1) ปลั๊กอิน gate: Console ติดตั้ง/อัปเดตได้เอง (ข้อ 1)

| ชิ้น | รายละเอียด |
|---|---|
| ต้นทางใหม่ | `AGENT/04PLUGIN/bazer-flow/` (index.ts · logic.mjs · tui.tsx · package.json v2.1.0) |
| `law.json` R1 | เพิ่ม except `AGENT/04PLUGIN/**` — เดิมกฎห้ามโค้ดใน `AGENT/**` ขัดกับ GUIDELINE ของโฟลเดอร์นั้นเอง |
| `manifest: plugin.bazer-flow` | `status: ready` · `copy-tree` · `prune: true` · `auto: false` · `proof: plugin-registered` |
| `apply.mjs` copy-tree | **prune**: ไฟล์ในปลายทางที่ไม่มีในต้นทาง → ย้ายเข้า `var/backups/<stamp>/pruned/` (ไม่ลบทิ้ง) + ลง history |
| `jsonc.mjs` | `appendArrayItem()` คู่กับ `removeArrayItem()` (คงคอมเมนต์/BOM) |
| probe ใหม่ | `plugin-registered` (kind `jsonc-array-contains`) — ตรวจ `plugins[]` ใน `opencode.jsonc` |
| action ใหม่ | `plugin-register` (risk 3) |
| `plan.mjs` copy-tree | นับไฟล์ "เกิน" ด้วย → entry ที่มีซากจะเป็น `stale` ไม่ใช่ `ok` |

**detect 2 ชั้นตามที่ขอ:** (ก) config → `plugin-registered` (ข) ไฟล์จริง → `stateOf copy-tree` (missing/stale/ok + จำนวนไฟล์ตรง/ต่าง/เกิน)

## 2) Arena: runner/judge กี่ตัวก็ได้ + ซ้ำได้ + effort รายตัว (ข้อ 2)

- `settings.json` เพิ่ม/แก้ control `arena.runners` · `arena.judge` — เก็บ **`model#effort` ต่อที่นั่ง** (แหล่งความจริงเดียว)
- รูปแบบไฟล์ `pstack-models.md`:
  ```
  arena runners: opencode-go/beam-free#low, opencode-go/deepseek-v4.1-flash#max
  arena cross-judge pool: opencode-go/glm-5#high
  ```
  ลำดับ = ที่นั่ง · ซ้ำได้ · `ARENA.md` ส่งค่าลง `model` ของ subagent ตรง ๆ (`…#low`) → variant ติดตั้งแต่ตอนเรียก ไม่ต้องเดา
- **migration:** ไฟล์ที่ยังมี `arena runner efforts:` / `arena judge efforts:` แยก → อ่านเป็น fallback และ **ถูกลบทิ้งเมื่อบันทึกครั้งถัดไป** (กันข้อมูลขัดกัน)
- UI ใหม่: ชิป + panel ค้นหา (ไม่ใช้ `<select multiple>`) · `＋` เพิ่มตัวซ้ำ · กล่อง effort 7 กล่อง (default…max) เลือกที่นั่งเข้าแต่ละกล่อง
- **2.1** `models.mjs` กรองเหลือ `opencode` + `opencode-go` และคืน `excluded` (Console บอกว่าซ่อนกี่ตัว)
- **2.2** ช่องโมเดลอื่นเป็น dropdown เดี่ยว + ทางออก “กำหนดเอง…”

## 3) บันไดเหมาเข่งเขียนลง `agents/*.md` ด้วย (ข้อ 6)

- `SERVER/frontmatter.mjs` (ใหม่): `setFrontmatterPermission` · `getFrontmatterPermission` · `stripFrontmatterPermission` (YAML-lite · คง key อื่น/BOM/CRLF)
- `setPolicy`/`undoPolicy` เขียน **2 ที่**: config `agent.<id>.permission` + frontmatter ของ `${CONFIG}/agents/<id>.md`
- กัน churn: `stateOf` ของ 3 agent นี้เทียบเนื้อหา **โดยไม่นับบล็อก permission** · `apply` ฉีด permission ปัจจุบันตอนเขียน · `diff` แสดง after ที่ฉีดแล้ว
- manifest เพิ่ม `ladderPolicy` + `ladderAgent` ใน `agent.buddha` · `subsub.arena-runner` · `subsub.arena-judge`
- **ทำไมต้องทำ:** probe พิสูจน์แล้วว่า "ไฟล์ agent ชนะ config" → บันไดที่เขียนแต่ config ถูกไฟล์ทับในคีย์ที่ไฟล์ประกาศ

## 4) แพตช์ปุ่ม Plannotator (ข้อ 5) — ต้นเหตุจริง

**ตรวจแล้ว:** `%LOCALAPPDATA%\plannotator` มีไฟล์เดียว = `plannotator.exe` (180 MB) → **เครื่องนี้เป็น CLI-only ไม่มีไฟล์เว็บให้แพตช์**
และ format ที่เราใช้เดิมแพตช์แค่ `switchTo` — ตัวเก่าแพตช์ **3 token**:

| token | จาก | ไป |
|---|---|---|
| switchTo | `{switchTo:"build"\|"builder"}` | `switchTo:"<buddha\|bazer>"` |
| label | `)?.name??e.switchTo}` | `)?.name??e.switchTo)}` |
| localStorage key | `"plannotator-agent-switch"` ฯลฯ | `"plannotator-approve-target-v2"` |

- ค้นเพิ่ม: `${CACHE}/npm/@plannotator` · `${CACHE}/packages/@plannotator` · `${LOCALAPP}/plannotator` (เพิ่ม env var `LOCALAPP` kind `env`)
- `plannotatorLocate` คืน `kind: files | cli-only | none` และรายงานจำนวนไฟล์ที่สแกน
- UI: ปุ่มแพตช์ **disabled + เหตุผลบนจอ** เมื่อไม่มีไฟล์ (ไม่ใช่กดแล้วเด้ง warn)
- action ใหม่ `plannotator-config` (risk 2): เขียน `options.planningAgents=[target]` + `workflow` — **กลไกเดียวที่เหลือสำหรับ CLI-only**

## 5) ฟีเจอร์จาก Console เก่า (ข้อ 4) — คัดแบบ "ไม่ผี"

| ของเก่า | ของใหม่ | action | risk |
|---|---|---|---|
| `npx-list` / `update-check` | ดูปลั๊กอินที่ OpenCode เห็น | `plugin-list` | 1 |
| `update-run` | อัพเดตแพ็กเกจผ่าน `opencode plugin add` | `plugin-update` | 3 |
| `bk-restore` | คืน **ไฟล์เดียว** จาก backup (เดิมย้อนได้แต่ทั้งรอบ) | `backup-list` · `backup-restore` | 1 · 3 |
| `pl-version` / `pl-toggle` | version + ตั้ง planningAgents | probe + `plannotator-config` | 2 |
| `srv-health` | พอร์ต/PID/uptime/path | แสดงจาก `state` (ไม่มีปุ่มผี) | — |

**ทิ้ง:** `mirror-run` (ห้าม mirror) · `bl-*` (ไม่มีของให้จัดการ) · `role-add/del` (PSTACK มาจาก settings.json) · `agent-save/del/install-agent` (manifest เป็นเจ้าของ) · `autostart/service` (ยังไม่มี probe พิสูจน์)

**IA ใหม่ (ข้อ 4 + ปรัชญา progressive disclosure):** เพิ่มแท็บ **ระบบ** สำหรับของดูแลระบบ → ภาพรวมกลับมาโล่ง (งานประจำวัน 4-5 ปุ่ม) · ของขั้นสูงอยู่ใน `<details>` · multi-select ใช้ชิป + panel ค้นหา (NN/g: dropdown เหมาะ单选, listbox+checkbox เหมาะ multi)

## 6) ปลั๊กอินรุ่นใหม่ (ซ่อม 6 จุด)

| # | เดิม | ใหม่ |
|---|---|---|
| 1 | `snack` อยู่ใน PLANNING_AGENTS → SNACK เขียนไฟล์ไม่ได้เลย | ถอดออก — SNACK ไม่ถูก gate |
| 2 | BUDDHA เขียนได้หลังอนุมัติ 1 ครั้ง | ต้อง 2 ครั้ง (GATE 1 = ARENA · GATE 2 = BUILD) |
| 3 | BAZER ไม่ถูก gate | gate 1 ครั้ง |
| 4 | ข้อความ `# Plan Feedback` รีเซ็ต approval | `isHandoffText` รู้จัก feedback → approval ไม่หาย |
| 5 | Plan แก้ `*.md` ได้ก่อนอนุมัติ | ไม่มีข้อยกเว้น |
| 6 | reminder อ้าง `BAZERs-EXTENSION-Poteto` (mirror ที่ถูกลบ) | อ้าง subagent `poteto` |
| + | `event.agent` ว่าง = ผ่านหมด (fail-open) | fallback ไปอ่าน phase file · ARENA/POTETO เขียนได้แต่ `%TEMP%` |

## 7) เอกสาร

- `DOCS/REQUIREMENTS.md` (ใหม่): DEMAND ⊕ LOGS — ข้อขัดแย้ง 8 ข้อ (LOGS ชนะ) · DEMAND-only 13 ข้อ (สถานะ) · ข้อกำหนดใหม่ 6 ข้อ (N1–N6) · ยังไม่ทำ 4 ข้อ
- `DOCS/DEMAND.md`: ชี้มาที่ REQUIREMENTS (ไม่ลบประวัติ)
- `DOCS/GUIDE.md`: แท็บ ระบบ + Arena แบบยืดหยุ่น
- `AGENT/04PLUGIN/GUIDELINE.md`: เขียนใหม่ (กติกาที่ห้ามถอยกลับ +วิธีติดตั้งผ่าน Console)
- `schema.json`: เพิ่ม `ladderPolicy` · `ladderAgent` · `policyOverrides` · `prune`

## 8) หลักฐาน

```
node SERVER\tools\selftest.mjs → 68 passed
node SERVER\tools\apitest.mjs  → 73 passed
node %TEMP%\bazer\ultra\uc.mjs → 100 passed · 0 failed
```
เทสต์ใหม่: appendArrayItem · frontmatter (แทน/คง key/BOM/CRLF) · strip permission · stateOf ไม่ขึ้น stale จากบันได · **gate logic 9 ข้อ** (SNACK/BAZER/BUDDHA 2 ใบ/ARENA temp-only/plan ห้าม md/feedback ไม่รีเซ็ต) · law R1 ผ่าน · apitest: plugin-register(ซ้ำ) · ติดตั้งปลั๊กอิน · prune · backup-list/restore · plannotator-config · บันไดลง frontmatter

## 9) ยังพิสูจน์ไม่ได้

| เรื่อง | เหตุผล |
|---|---|
| ปลั๊กอินรุ่นใหม่ทำงานจริงใน OpenCode | ต้องติดตั้ง + เปิด OpenCode ใหม่ (ผมไม่แตะ `~/.config` ของคุณ) |
| `planningAgents` มีผลจริง | ขึ้นกับเวอร์ชันปลั๊กอิน Plannotator — UI บอกให้กดอนุมัติ 1 ครั้งเพื่อยืนยัน |
| UI ในเบราว์เซอร์จริง | ตรวจด้วย syntax + API + โครง DOM เท่านั้น |
| `plugin-update` | ไม่รัน `opencode plugin add` บนเครื่องคุณ (ต้องมีเน็ต/สิทธิ์) |
| Arena effort มีผลกับผลรันจริง | เก็บและอ่านครบแล้ว (`ARENA.md` เฟส B/C อ่าน 4 บรรทัดจาก `pstack-models.md` + จำนวนที่นั่ง) — แต่ยังไม่ได้รัน Arena จริงหนึ่งรอบเพื่อยืนยันว่า runner ได้ variant ตามที่ตั้ง |

## 10) ไฟล์ที่แตะ

**ใหม่:** `SERVER/frontmatter.mjs` · `AGENT/04PLUGIN/bazer-flow/{index.ts,logic.mjs,tui.tsx,package.json}` · `DOCS/REQUIREMENTS.md`
**แก้:** `SERVER/{jsonc,models,env,apply,plan,probe,plannotator,actions,index}.mjs` · `UI/{app.js,index.html,style.css}` · `MANIFEST/{manifest,actions,settings,probes,law,env,schema}.json` · `SERVER/tools/{selftest,apitest}.mjs` · `DOCS/{GUIDE,DEMAND}.md` · `AGENT/04PLUGIN/GUIDELINE.md` · `CHANGELOG.md` · `LOGS.md`

---

# 00.00.04 - Tuesday 20th October 2026 - ULTRA 3 LOOPS · UC Registry · 14 บั๊กจริง

> คำสั่งของผู้ใช้: "WHOLE ULTRA BUDDHA — LOOP 1 ลิสต์ UC ให้มากที่สุด · LOOP 2 เช็คว่าอันไหนพัง · LOOP 3 ซ่อมจริง" ทำยาวจบในทีเดียว
> **หมายเหตุกระบวนการ (ซื่อตรง):** LOOP 1 กับ LOOP 2 ใช้ phase P0–P3 ร่วมกัน (ไม่มีการเขียนไฟล์ในสองรอบนั้น) — LOOP 3 เดิน P4→P6 เต็มรอบ การยื่นแผนใหม่ทุกครั้งถูกจำกัดโดยปลั๊กอิน `bazer-flow` ที่นับ approval "หลังข้อความผู้ใช้ล่าสุด" (ถ้าใส่ note มาด้วย ตัวนับรีเซ็ต)

## ผลรวม

| LOOP | ได้อะไร | หลักฐาน |
|---|---|---|
| 1 | ทะเบียน **120 UC** (12 กลุ่ม) จาก Arena 3 candidate — base = contract-first + graft journey/failure → `DOCS/USECASES.md` | Arena จริง (subagent `arena`) · ไม่มี cross-judge เพราะ subagent depth limit 1 (บันทึกไว้) |
| 2 | ตรวจทุกข้อด้วย harness ภายนอก → **75 ผ่าน · 22 ตก** → คัด noise = **14 บั๊กจริง** → `DOCS/USECASE-STATUS.md` | `%TEMP%\bazer\ultra\uc.mjs` (97 ข้อ ยิงเซิร์ฟเวอร์จริง + sandbox home) |
| 3 | ซ่อม 14 บั๊ก + เพิ่มเทสต์กันกลับ → **uc 100/100 · selftest 62 · apitest 62** | คำสั่งด้านล่าง |

## ตัวเลขจริงของสัญญา (แก้ตัวเลขรุ่นก่อน)

| ของ | ค่า |
|---|---|
| actions | **22** |
| manifest entries | **23** |
| probes | **11** |
| settings controls | **16** (+15 PSTACK role + budget) |
| law rules | 4 |

> `00.00.03` เขียนว่า entries 24 / probes 13 — ของจริงคือ 23 / 11 (LOGS §22 เขียน 21 entries / 19 actions / 8 probes ตั้งแต่ `00.00.01`)

## 14 บั๊กที่เจอและซ่อมแล้ว

| # | อาการ (สิ่งที่ผู้ใช้เจอ) | ต้นเหตุ | ไฟล์ |
|---|---|---|---|
| B1 | กด **"คืน Plan & Build"** แล้วไม่มีอะไรเกิดขึ้น แต่รายงานว่าสำเร็จ | `mergeInto()` เรียกตัวเองแล้วทิ้งค่าที่คืน → merge ลึกชั้น 2 หายเงียบ | `SERVER/jsonc.mjs` |
| B2 | เปิด Console ตัวที่สองตอนพอร์ตชน → พิมพ์ URL 2 บรรทัด + เบราว์เซอร์ไปที่ **instance อีกตัว (token/home ผิด)** | ผูก `listening` ใหม่ทุก retry + `link` ใช้พอร์ตที่ขอ | `SERVER/index.mjs` |
| B3 | เปิด lock โมเดลแล้วมีคนเปลี่ยนค่า → **ไม่มีแบนเนอร์ drift** · `lock-restore` ตอบ "ตรงอยู่แล้ว" | `saveSettings()` ถ่าย snapshot ทุกครั้งที่บันทึก → snapshot = ค่าใหม่ | `SERVER/apply.mjs` |
| B4 | config ที่มี **BOM** ถูกเขียนกลับแบบไม่มี BOM | `readText()` ตัด BOM ก่อนเขียน | `SERVER/apply.mjs` |
| B5 | `ตรวจทุกอย่าง` เรียก probe ทั้งชุดซ้ำ 2 รอบ | `verifyProofs()` เรียก `runProbes()` ใหม่ทุก entry | `SERVER/probe.mjs`, `actions.mjs` |
| B6 | ติดตั้งเครื่องมือ: **Node 14 ก็ผ่าน** (ไม่ตรวจ `min`) และ optional ถูกนับเป็น "ยังขาด" | ใช้แค่ exit code · ไม่แยก required/optional | `SERVER/actions.mjs`, `install.json` |
| B7 | `เปิดโฟลเดอร์ปลายทาง` รายงานสำเร็จทั้งที่โฟลเดอร์ไม่มี | ไม่เช็ค existence | `SERVER/actions.mjs` |
| B8 | ปุ่มที่ประกาศไว้ **กดไม่ได้บนจอ**: `history-list` · `open-target` · `plannotator-patch` | ไม่มี element ที่เรียก | `UI/app.js` |
| B9 | แถว `auto:false` มีปุ่ม **"ติดตั้ง"** → กดแล้วถอดปลั๊กอินเก่าออกจาก config โดยไม่มีการเตือนระดับ 3 | `entryRow` ไม่ดู `auto` | `UI/app.js` |
| B10 | พิมพ์ค่าค้างในช่อง แล้วมี action อื่นทำงาน → **ค่าที่พิมพ์หายทั้งหน้า** | `load()` ล้าง `DRAFTS = {}` | `UI/app.js` |
| B11 | **ADVISOR บอกให้สลับไป BUDDHA**, บอก "สลับไป Advisor" (ตัวเอง), และสั่ง "ไม่ต้องแนะนำให้สลับ" | เนื้อหาไฟล์โหมด | `AGENT/01PRIMARY/ADVISOR.md` |
| B12 | Console รายงาน **manifest มีปัญหา** (validate แดง) | `plugin.bazer-fire` status=design ไม่มี `why` | `MANIFEST/manifest.json` |
| B13 | `lock-restore` รับ snapshot ของ home/instance อื่น | state ไม่ผูกกับ home | `SERVER/apply.mjs` |
| B14 | ตัวเลขสัญญาในเอกสารไม่ตรงของจริง | ประวัติรุ่นก่อน | LOGS/CHANGELOG (รอบนี้) |

## สิ่งที่เปลี่ยนใน UI (ผู้ใช้เห็นได้)

- **แถบปุ่มหลัก** เพิ่ม `ติดตั้งเครื่องมือที่ขาด` (ข้อกำหนด 4.3 — เดิมเข้าถึงได้ทาง Ctrl+K เท่านั้น)
- **แท็บไฟล์ & สกิล** เพิ่ม 4 ปุ่ม `เปิดโฟลเดอร์` (ตั้งค่า OpenCode / สกิล / MAJOR / backups)
- **แท็บประวัติ** เพิ่ม `อ่านประวัติล่าสุด (200)`
- **การ์ด Plannotator** เพิ่มปุ่มแพตช์ → BUDDHA / BAZER (risk 3 · ถ้าไม่พบไฟล์จะเตือนและไม่เขียนอะไร)
- **หัวข้อกฎ 4 ข้อ** เพิ่มปุ่ม `ตรวจกฎ 4 ข้ออีกครั้ง`
- แถว entry ที่ `auto:false` แสดง "สั่งเอง" แทนปุ่มติดตั้ง
- ค่าที่พิมพ์ค้างไม่หายเมื่อมี action อื่นทำงาน (รวม textarea ของ "การตั้งค่าฉบับเต็ม")

## หลักฐาน

```
node BAZERCONSOLE\01MAIN\ACTIVE\SERVER\tools\selftest.mjs  → 62 passed
node BAZERCONSOLE\01MAIN\ACTIVE\SERVER\tools\apitest.mjs   → 62 passed
node %TEMP%\bazer\ultra\uc.mjs                             → 100 passed · 0 failed
```
รายละเอียดเคสใหม่:
- selftest +11: merge ลึก 2 ชั้น (2) · BOM คงอยู่/ไม่เติมเอง (2) · verifyProofs ใช้ผลที่ส่งมา (1) · install min ผ่าน probe (1) · validate สะอาด (1) · ADVISOR ชี้ SNACK (1) · UI ปุ่มครบ/auto guard (1) · drafts (1) · listening ครั้งเดียว (1)
- apitest +10: builtin-toggle off/on (2) · lock→drift→restore (2) · snapshot ข้าม home (1) · need/advisory (1) · install min (1) · open-target ok/warn (2) · พอร์ตชน (1)

## ยังพิสูจน์ไม่ได้ (บันทึกตรง)

| เรื่อง | เหตุผล |
|---|---|
| `probe` 4 ตัว (`agents-present` `agents-hidden` `permission-level` ×2) | อ่านสถานะจาก OpenCode จริง ไม่ผูก `--home` → sandbox เห็นค่าของเครื่องจริง (Console ตั้งใจเป็นตัวเดียวต่อเครื่อง) |
| `install-tools` โหมดติดตั้งจริง | ไม่รัน (กลัวแตะเครื่องผู้ใช้) — ตรวจได้แค่ dry-run + โครง `need`/`advisory` |
| UI ในเบราว์เซอร์จริง | ตรวจด้วยการอ่าน DOM/สตริง + API เท่านั้น ยังไม่ได้กดด้วยตา |
| cross-judge ของ Arena | `experimental.subagent_depth` = 1 → `arena-judge` spawn จากใน Arena ไม่ได้ (ผู้ให้คะแนน = ผู้เขียน; บันทึก bias ไว้) |
| `var/` ไม่แยกตาม home | token/backups/history/quarantine ยังเป็นของ Console ตัวเดียว (ข้อจำกัดที่ยอมรับ) |

## ไฟล์ที่แก้ในรอบนี้

`SERVER/jsonc.mjs` · `SERVER/index.mjs` · `SERVER/apply.mjs` · `SERVER/probe.mjs` · `SERVER/actions.mjs` · `SERVER/tools/selftest.mjs` · `SERVER/tools/apitest.mjs` · `UI/app.js` · `PASSIVE/02INSTALLER/install.json` · `PASSIVE/01MANIFEST/manifest.json` · `PASSIVE/01MANIFEST/CHANGELOG.md` · `AGENT/01PRIMARY/ADVISOR.md` · `DOCS/USECASES.md` (ใหม่) · `DOCS/USECASE-STATUS.md` (ใหม่) · `BAZERCONSOLE/LOGS.md`

> สำเนาก่อนแก้: `%TEMP%\bazer\ultra\snapshot\` (ชื่อไฟล์ใช้ `__` แทน `\`)

---

# 00.00.03 - Tuesday 20th October 2026 - Missing Features · 5-Round Bug Scan

> ต่อจาก `00.00.02` — ทบทวนแชทว่ามีอะไร "ตัดสินใจแล้วแต่ยังไม่มี" → เติมให้ครบ แล้วสแกน 5 รอบ
> **ข้อจำกัดของรอบนี้:** environment ไม่มีเครื่องมือรันคำสั่ง (shell) → เป็น static scan + เพิ่มเทสต์ไว้รอ; การยืนยันจริงทำผ่านปุ่มใน Console

## 1) ฟีเจอร์ที่ตัดสินใจไว้แล้วแต่ยังไม่มี → เติมแล้ว

| # | สิ่งที่เคยตัดสินใจ | สถานะก่อนหน้า | ที่ทำในรอบนี้ |
|---|---|---|---|
| M1 | **Plannotator: อนุมัติแล้วกลับโหมดต้นทาง (BUDDHA/BAZER)** — "ให้ BAZERCONSOLE ไปแก้ Plannotator ในไฟล์ระบบ" | `design` ไม่มีโค้ด | เพิ่ม `SERVER/plannotator.mjs`: หาไฟล์ → แพตช์ token `switchTo:"build|builder|buddha|bazer"` → backup/history → ตรวจซ้ำ; action `plannotator-patch` + การ์ดในหน้าโหมด |
| M2 | **"override and lock"** — ล็อกค่า model/effort ไม่ให้ session ใหม่หลุด | มี snapshot + banner แต่กดคืนไม่ได้ | `restoreLockedModels()` + action `lock-restore` + ปุ่มในแบนเนอร์ drift |
| M3 | **เอกสารสองภาษา** | ไทยล้วน | เพิ่ม EN summary ใน README / FLOW / GUIDE (เนื้อหาหลักยังไทย) |
| M4 | **ปุ่มติดตั้งหาไม่เจอ (ปุ่มทุกใบเขียนว่า "ทำ")** | ปุ่ม generic | `cta` ทุก action + แถบปุ่มหลัก 3 ปุ่มบนหน้าแรก + `selftest` บังคับ `cta` |

**ข้อจำกัดที่ยังเหลือ (บอกตรง):** ปุ่มอนุมัติของ Plannotator เป็นปุ่มเดียว (global) → แพตช์ได้ว่า "กลับโหมดไหน" แต่สลับตามผู้เรียกอัตโนมัติไม่ได้จนกว่าปลั๊กอินจะรองรับ per-agent; `PLANNOTATOR` ต้องรายงานถ้าปุ่มชี้ผิดโหมด

## 2) Bug scan 5 รอบ (static)

### รอบ 1 — contract: actions ↔ handlers ↔ UI ↔ probes
- 22 action / 22 handler ตรงกัน
- UI อ้างเฉพาะ id ที่ประกาศ (`data-act` + `act('…')`)
- เพิ่มเทสต์: ทุก action ต้องมี `cta`; ไฟล์ `02SUBAGENT/*` ต้อง `mode: subagent`

### รอบ 2 — apply / plan / settings
- **แก้:** `${VAR}` ไม่ถูกประกาศใน `env.mjs` → `open-target` (backups) โยน error
- **แก้:** `install-tools` ตอบ "ยังขาด" ทั้งที่ `apply=true` เมื่อเครื่องมือที่ขาดไม่มี `why`
- **แก้:** `allControls()` ถูกเขียนซ้ำ 2 ที่ (index/apply) → รวมเป็นตัวเดียว (export จาก apply)
- **แก้:** `stamp()` ละเอียดถึงวินาที → งานสองรอบในวินาทีเดียวแชร์ backup dir; เพิ่ม milliseconds
- **แก้:** `quarantine/<stamp>` ชนกันได้ → เติม `-2`, `-3` ถ้ามีอยู่แล้ว

### รอบ 3 — UI
- ตรวจ template/ตัวแปรใน `renderOverview` / `renderModes` / `renderSettings` / `renderQuick` ว่าวงเล็บ/backtick ครบ
- ปุ่ม Plannotator ใช้ `data-patch` + confirm risk 3
- ปุ่ม `lock-restore` แสดงเฉพาะเมื่อมี drift
- ลดปุ่มซ้ำ: `wired` set รวม action ที่มีปุ่มเฉพาะที่แล้ว (settings-full, cleanup, reset, patch, lock, probe)

### รอบ 4 — docs / law / contract
- `law.json` R1–R4 ไม่ขัดกับไฟล์ใหม่ (plannotator.mjs อยู่ใน ACTIVE)
- เพิ่ม EN summary 3 ไฟล์
- อัพเดต `04PLANNOTATOR/targets.json` + GUIDELINE (mechanism/limitation)
- อัพเดต manifest entry `patch.plannotator` ให้ชี้ว่าการ์ดคือทางทำจริง

### รอบ 5 — use case walkthrough
| UC | สถานะ (static) | หมายเหตุ |
|---|---|---|
| fresh install → apply → probe | ผ่านตามตรรกะ | ต้องกดจริง |
| แก้ไฟล์ต้นทาง → stale → apply | ผ่าน | hash เทียบ |
| บันได 1→5→undo | ผ่าน | permission ชุดเต็มแทนที่ |
| Quick Access (partial) | ผ่าน | jsonc-set เฉพาะ key |
| Full settings (overwrite/invalid) | ผ่าน | parse ก่อนเขียน + read-back |
| full JSON พัง | ผ่าน | reject ไม่แตะไฟล์ |
| cleanup dry-run/apply | ผ่าน | quarantine + manifest |
| reset template | ผ่าน | backup + history |
| rollback | ผ่าน | คืนทั้งรอบ |
| apply ล้มกลางทาง | ผ่าน | rollback อัตโนมัติ |
| builtin toggle / retire flow | ผ่าน | config only |
| install-tools dry-run | ผ่าน | ไม่รันคำสั่ง |
| open-target | ผ่าน | **แก้ `${VAR}`** |
| icon route | ผ่าน | เลือก `BAZERCONSOLE.ico` ก่อน |
| plannotator patch (fixture) | ผ่านตามเทสต์ที่เพิ่ม | ไม่มีไฟล์จริงบนเครื่อง |
| lock restore | ผ่านตามตรรกะ | ต้องมี snapshot |
| probe ก่อนติดตั้ง | ผ่าน | warn ไม่ใช่ fail |
| token / traversal / 404 | ผ่าน | apitest เดิม |
| BUDDHA/BAZER เรียก builder inline | ผ่านเชิงเอกสาร | ต้องทดสอบใน OpenCode จริง |

## 3) หลักฐาน

- เทสต์ที่เพิ่ม: plannotator patch (selftest 1 ยูนิต + apitest 3 ข้อ)
- **ยังไม่ได้รัน** `selftest`/`apitest` ในรอบนี้เพราะไม่มี shell → รันด้วยคำสั่งเดิมเมื่อมี terminal:
  ```powershell
  node BAZERCONSOLE\01MAIN\ACTIVE\SERVER\tools\selftest.mjs
  node BAZERCONSOLE\01MAIN\ACTIVE\SERVER\tools\apitest.mjs
  ```
- หลังรีสตาร์ท Console: ภาพรวม → `ตรวจทุกอย่าง`

## 4) ไฟล์ที่แก้ในรอบนี้

`SERVER/env.mjs` · `actions.mjs` · `apply.mjs` · `index.mjs` · `plannotator.mjs` (ใหม่) · `probe.mjs` · `UI/app.js` · `MANIFEST/actions.json` · `manifest.json` · `04PLANNOTATOR/targets.json` + `GUIDELINE.md` · `tools/selftest.mjs` · `tools/apitest.mjs` · `README.md` · `DOCS/FLOW.md` · `DOCS/GUIDE.md`

---

# 00.00.02 - Tuesday 20th October 2026 - Quick Access Tab · Full Settings · Icon · Probe UX

> ต่อจาก `00.00.01` — บันทึกเฉพาะสิ่งที่เปลี่ยนในรอบนี้ (คำขอ 4 ข้อ + bug ที่ผู้ใช้เจอจาก log)

## สรุปการเปลี่ยนแปลง

| # | สิ่งที่ขอ/เจอ | ทำอะไร | ผล |
|---|---|---|---|
| 1 | Quick Access ควรเป็นแท็บของตัวเอง | ย้ายออกจากหน้า ตั้งค่า → แท็บใหม่ลำดับที่ 2 (ถัดจาก ภาพรวม) | แท็บ: ภาพรวม · **Quick Access** · โหมด & สิทธิ์ · ไฟล์ & สกิล · ตั้งค่า · ประวัติ |
| 2 | "การตั้งค่าฉบับเต็ม" แยกหมวด + apply แล้ว overwrite | เพิ่ม sub-tab `การตั้งค่าฉบับเต็ม` ในหน้า ตั้งค่า พร้อม editor ของ `tui.json` / `cli.json` → บันทึก = เขียนทับทั้งไฟล์ | Quick Access ยังแก้เฉพาะคีย์; ฉบับเต็มเขียนทับทั้งไฟล์ |
| 3 | เอา `.ico` เป็นโลโก้เว็บ + favicon | route `/icon.ico` + `<link rel="icon">` + โลโก้ `<img>` | โลโก้และแท็บเบราว์เซอร์ใช้ไอคอนเดียวกัน |
| 4 | `probe` ขึ้น "ไม่สำเร็จ" ทั้งที่ยังไม่ได้ติดตั้ง | แยก `warn` (ยังไม่ติดตั้ง/ไม่มี Plannotator) ออกจาก `fail` จริง | ขึ้น "ยังไม่พร้อม/เตือน" สีเหลือง พร้อมบอกว่าต้องติดตั้งก่อน |

---

## 1) Quick Access แยกเป็นแท็บของตัวเอง

**เดิม:** อยู่ในหน้า `ตั้งค่า` เป็น sub-tab แรก
**ใหม่:** เป็นแท็บหลักลำดับที่ 2 (ถัดจาก ภาพรวม) — `index.html` เพิ่ม `data-tab="quick"` + `#view-quick`, `app.js` เพิ่ม `renderQuick()`

เนื้อหายังเหมือนเดิม (มาจาก `settings.json` กลุ่ม `quick`):
- โมเดล + effort ของ 4 โหมด (BUDDHA/BAZER/SNACK/ADVISOR)
- คีย์ `messages_copy`
- toggle lock (models / keybinds)

**พฤติกรรมการเขียน:** `settings-save` → แก้ **เฉพาะคีย์ที่เปลี่ยน** (`jsonc-set` per key) ไม่แตะค่าอื่นในไฟล์

---

## 2) การตั้งค่าฉบับเต็ม (overwrite ทั้งไฟล์)

### 2.1 โครง UI

หน้า `ตั้งค่า` มี 3 sub-tab:
1. **การตั้งค่าฉบับเต็ม** (ใหม่)
2. **PSTACK roles**
3. **ตั้งค่าอื่น ๆ**

ใน "ฉบับเต็ม" มี editor แยกไฟล์เป็นหมวด:

| ไฟล์ | หมายเหตุ |
|---|---|
| `tui.json` | ไฟล์ที่ OpenCode 2 ใช้จริง (ธีม/คีย์ลัด/หน้าตา) |
| `cli.json` | ไฟล์รุ่นเก่า — เก็บไว้เพื่อความเข้ากันได้ |

แต่ละไฟล์มี textarea + ปุ่ม `ตรวจ JSON` + `เขียนทับทั้งไฟล์`

### 2.2 กลไกการเขียน (action `settings-full`)

```
อ่าน state.rawSettings → แก้ใน textarea → ตรวจ JSON ฝั่ง client
→ confirm (risk 3) → server: JSON.parse + ต้องเป็น object
→ backup → writeFile atomic → อ่านกลับ + parse อีกครั้ง
→ ถ้า parse ไม่ได้ = คืนไฟล์เดิมทันที (rollback ในฟังก์ชัน)
→ history: full.<file>
```

**ต่างจาก Quick Access ตรงไหน**

| | Quick Access | ฉบับเต็ม |
|---|---|---|
| วิธีเขียน | `jsonc-set` เฉพาะ key ที่แก้ | เขียนทับ **ทั้งไฟล์** |
| ค่าที่ไม่ได้แก้ | อยู่ครบ | **หาย** ถ้าไม่ได้อยู่ในเนื้อหาที่แก้ |
| ระดับความเสี่ยง | 2 | 3 (confirm + backup) |
| ใช้กับ | ปรับเร็ว ๆ ทุกวัน | ตั้งค่าลึก/คัดลอก config ทั้งก้อน |

> `settings.json` เพิ่มบล็อก `full.files` (id/label/target/note) — UI และ server อ่านจากที่เดียว ไม่ hardcode ชื่อไฟล์

---

## 3) ไอคอน: โลโก้เว็บ + favicon

- เพิ่ม route `GET /icon.ico` (และ `/favicon.ico`) → หาไฟล์ `.ico` ตัวแรกใน `BAZERCONSOLE/02SHORTCUT/` แล้วเสิร์ฟเป็น `image/x-icon`
  - เลือกตัวแรกแบบเรียงชื่อ → ถ้าผู้ใช้ rename ไอคอนอีกก็ยังใช้ได้
  - cache 5 นาที
- `index.html`:
  - `<link rel="icon" href="/icon.ico">` + `shortcut icon` + `apple-touch-icon`
  - โลโก้ header เปลี่ยนจากตัวอักษร `B` เป็น `<img src="/icon.ico">` (มี `B` เป็น fallback ถ้าโหลดรูปไม่ได้)
- CSS: รูปครอบ `.logo` แบบ `object-fit: cover` + `border-radius` เดิม

---

## 4) Probe UX — แยก "ยังไม่ได้ติดตั้ง" ออกจาก "พังจริง"

### อาการที่ผู้ใช้เห็นใน log

```
10:24:11 · ไม่สำเร็จ: probe — ตก 2 ข้อ
10:23:46 · ไม่สำเร็จ: plannotator-locate — ไม่เจอใน ...
10:23:40 · ไม่สำเร็จ: self-check — กฎ ผ่าน · ความครบ 16 รายการต้องทำ · probe 2 ตก
```

ความจริงคือ **ยังไม่ได้ติดตั้ง MAJOR ลงเครื่อง** (`state.json` ไม่มี, config ยังไม่มี `agent.plan/build` ที่ซ่อน) — ไม่ใช่ระบบพัง

### แก้

1. **`PREINSTALL_PROBES`** = `builtin-hidden` · `permission-level` · `modes-present`
   ถ้า probe ที่ตกอยู่ในชุดนี้ **ทั้งหมด** และยังมีรายการต้องติดตั้ง → คืน `warn` (ok:true + warn:true) แทน `bad`
   ข้อความ: `ยังไม่ได้ติดตั้ง N รายการ — probe X ข้อจะผ่านหลังติดตั้ง`
2. **`self-check`** ใช้ตรรกะเดียวกัน → ขึ้น "ยังไม่พร้อม" สีเหลือง ไม่ใช่ "ไม่สำเร็จ"
3. **`plannotator-locate`** ไม่เจอไฟล์ = `warn` (ปกติถ้ายังไม่เคยเปิด/ติดตั้ง Plannotator)
4. **`agents-present`** เพิ่มการตรวจ marker `<!-- BAZER-MODE:` ใน system prompt → จับเคส "ชื่อไฟล์เดียวกันแต่เป็นไฟล์รุ่นเก่า"
5. **UI/log**: เพิ่มระดับ `warn`
   - toast สีเหลือง หัวข้อ "ยังไม่พร้อม"
   - logbar บรรทัด `warn` สีเหลือง, ป้าย "เตือน"
   - SSE ส่ง `type: warn`

> หลังกด `ติดตั้ง / อัพเดตทั้งหมด` แล้ว probe 2 ข้อนั้นจะผ่านจริง (builtin-hidden ตรวจจาก `opencode debug agents`; permission-level ตรวจว่ามีคีย์ใน config จริง)

---

## 5) ปรับเพิ่มในวันเดียวกัน

### 5.1 Builder เป็น subagent (inline) — ไม่ใช่ primary

- `BUILDER.md`: `mode: all` → **`mode: subagent`** (ไม่โผล่ใน Shift+Tab)
- **BUDDHA P6** และ **BAZER B4** เรียก `builder` แบบ inline หลังแผนอนุมัติ
- builder รับ **เนื้อหาแผน** (ไม่ใช่พาธ) → แก้เฉพาะไฟล์ในแผน → ห้ามเรียก subagent ต่อ / ห้าม `submit_plan`
- การตรวจ/พิสูจน์/สรุป/commit ยังเป็นของโหมดหลัก (ผู้เรียก)
- `selftest` เพิ่มกฎ: ไฟล์ทุกตัวใน `02SUBAGENT/` ต้องเป็น `mode: subagent` (กันหลุดกลับไปเป็น `all`)

### 5.2 ปุ่มมีชื่อของตัวเอง (`cta`)

- เพิ่ม `cta` ให้ทุก action ใน `actions.json` — เช่น `apply` → "ติดตั้ง / อัพเดตทั้งหมด"
- หน้า **ภาพรวม** มีแถบปุ่มหลัก 3 ปุ่ม (ตรวจทุกอย่าง · ตรวจว่ามีอะไรใหม่ · ติดตั้ง) แยกจากการ์ด "เครื่องมืออื่น"
- `selftest` บังคับว่าทุก action ต้องมี `cta`

## ไฟล์ที่แก้ในรอบนี้

| ไฟล์ | เปลี่ยน |
|---|---|
| `UI/index.html` | favicon 3 แบบ · โลโก้ `<img>` · แท็บ Quick Access · `#view-quick` |
| `UI/style.css` | `.logo img/span` · `textarea.code` · `.toast.warn` · `.logbar-body .warn` |
| `UI/app.js` | `renderQuick()` · `renderSettings()` ใหม่ (full/pstack/other) · handler `data-validate` / `data-fullsave` · toast warn · palette เพิ่ม Quick Access |
| `SERVER/index.mjs` | `rawSettings` ใน state · route `/icon.ico` · SSE label/kind ของ warn |
| `SERVER/apply.mjs` | `writeFullSettings()` (validate → backup → atomic → read-back → rollback) |
| `SERVER/actions.mjs` | handler `settings-full` · `probe`/`self-check` คืน warn · `plannotator-locate` คืน warn · `PREINSTALL_PROBES` |
| `SERVER/probe.mjs` | `agents-present` ตรวจ marker |
| `MANIFEST/settings.json` | บล็อก `full.files` (tui/cli) |
| `MANIFEST/actions.json` | action `settings-full` (risk 3) |
| `MANIFEST/probes.json` | `agents-present` เพิ่ม `marker` |
| `tools/selftest.mjs` | +3 เทสต์ (favicon/โลโก้/แท็บ · full.files · CSS guard เดิม) |
| `tools/apitest.mjs` | +6 เทสต์ (probe warn · locate warn · self-check warn · full overwrite · JSON พังไม่เขียน · icon) |
| `AGENT/02SUBAGENT/BUILDER.md` | `mode: all` → `subagent` + คำอธิบายใหม่ |
| `AGENT/01PRIMARY/BUDDHA.md` · `BAZER.md` | P6/B4 เรียก `builder` inline |
| `AGENT/02SUBAGENT/GUIDELINE.md` | กฎ: subagent ทุกตัวต้อง `mode: subagent` |
| `DOCS/FLOW.md` | เพิ่ม §5 builder + §6 cta |
| `MANIFEST/actions.json` | `cta` ทุกปุ่ม |

---

## หลักฐาน

```
selftest.mjs → 35 passed
apitest.mjs  → 49 passed   (รวม probe warn / settings-full / icon)
state: rawSettings = cli,tui · settings.full.files = tui,cli · actions = 20
GET /icon.ico → 200 · image/x-icon · 4,286 bytes
probe → ok=true warn=true : "ยังไม่ได้ติดตั้ง 16 รายการ — probe 2 ข้อจะผ่านหลังติดตั้ง"
```

---

## ข้อจำกัด / หมายเหตุ

- `cli.json` เป็นไฟล์รุ่นเก่า — OpenCode 2 อ่าน `tui.json` เป็นหลัก; ที่เก็บไว้เพื่อความเข้ากันได้
- การเขียนทับทั้งไฟล์จะลบคีย์ที่ไม่ได้อยู่ในเนื้อหา (ตั้งใจ) — จึงเป็น risk 3 + confirm + backup ทุกครั้ง
- probe ที่ต้องรอติดตั้งยังรายงาน "ตก" ในตารางรายละเอียด (เพื่อความโปร่งใส) แต่ภาพรวมเป็น `warn`
- ยังไม่ได้ทดสอบ UI ในเบราว์เซอร์จริง (ตรวจได้แค่ parse + API + HTML ที่เสิร์ฟ)

---

# 00.00.01 - Monday 19th October 2026 - Redesign All From Scratch

> **LOGS — บันทึกการออกแบบและพัฒนา MAJOR**
> **ขอบเขต:** สรุปทุกอย่างที่คุย/ตัดสินใจ/ลงมือทำในแชทนี้ (2026-10-19 → 2026-10-20)
> **ผู้อ่าน:** คนที่กลับมาดูภายหลัง, LLM รุ่นถัดไปที่ต้องแก้ระบบนี้, และตัวเราเองในอีก 3 เดือน
> **หลักการเขียน:** บอกทั้ง "ทำอะไร" และ "ทำไม" — ถ้าไม่รู้เหตุผล ให้ถือว่ายังไม่จบ

---

## สารบัญ

1. [บริบท: ของเก่าทำงานยังไง และพังเพราะอะไร](#1-บริบท-ของเก่าทำงานยังไง-และพังเพราะอะไร)
2. [โจทย์ของรอบนี้ (ข้อกำหนดจากผู้ใช้)](#2-โจทย์ของรอบนี้-ข้อกำหนดจากผู้ใช้)
3. [หลักการที่ใช้ตัดสินใจ](#3-หลักการที่ใช้ตัดสินใจ)
4. [โครงสร้างโฟลเดอร์จริง](#4-โครงสร้างโฟลเดอร์จริง)
5. [กฎ R1–R4 และสถานที่เก็บ](#5-กฎ-r1r4-และสถานที่เก็บ)
6. [สถาปัตยกรรม BAZERCONSOLE](#6-สถาปัตยกรรม-bazerconsole)
7. [MANIFEST — สัญญากลาง](#7-manifest--สัญญากลาง)
8. [โหมดหลัก 4 ตัว](#8-โหมดหลัก-4-ตัว)
9. [Subagents](#9-subagents)
10. [บันไดเหมาเข่ง](#10-บันไดเหมาเข่ง)
11. [Plannotator](#11-plannotator)
12. [Settings — model & effort](#12-settings--model--effort)
13. [UX/UI ของ Console](#13-uxui-ของ-console)
14. [ข้อเท็จจริงที่พิสูจน์กับ OpenCode v2.0.32](#14-ข้อเท็จจริงที่พิสูจน์กับ-opencode-v2032)
15. [Bug scan 5 รอบ](#15-bug-scan-5-รอบ)
16. [บั๊กหลังเปิดใช้: modal ว่าง + ปุ่มกดไม่ได้](#16-บั๊กหลังเปิดใช้-modal-ว่าง--ปุ่มกดไม่ได้)
17. [เคลียร์ของเก่าให้เหลือแต่ของใหม่](#17-เคลียร์ของเก่าให้เหลือแต่ของใหม่)
18. [หลักฐานการทดสอบ](#18-หลักฐานการทดสอบ)
19. [สิ่งที่ยังไม่ทำ / ความเสี่ยงที่รู้ตัว](#19-สิ่งที่ยังไม่ทำ--ความเสี่ยงที่รู้ตัว)
20. [บทเรียนที่ฝังไว้ในระบบ](#20-บทเรียนที่ฝังไว้ในระบบ)
21. [คู่มือใช้งานเร็ว](#21-คู่มือใช้งานเร็ว)
22. [ลำดับเหตุการณ์ (chronology)](#22-ลำดับเหตุการณ์-chronology)
23. [ดัชนีไฟล์สำคัญ](#23-ดัชนีไฟล์สำคัญ)

---

## 1. บริบท: ของเก่าทำงานยังไง และพังเพราะอะไร

### 1.1 ของเก่า (`SETUP/OPENCODE`)

- เป็น repo เดียวที่รวมแอป + ข้อมูล: `CONSOLE/` (แอป), `CONSOLE/bundle/` (ต้นทาง agents/skills/commands/plugins/config), `FLOW.md`, `GUIDE.md`, `AUDIT/`, `CHECKS.md`
- **แอป** = HTTP server local (`127.0.0.1:4310` + token) เสิร์ฟ `console.html` หน้าเดียว → กดปุ่ม → `/api/action` → เขียนไฟล์จริงของ OpenCode (`~/.config/opencode`, `~/.agents/skills`, `~/.local/state/opencode`, `~/.plannotator`) พร้อม backup + `/api/verify` ตรวจ 20+ ข้อ
- มีสคริปต์ข้างเคียง: `mode-lock.mjs`, `flow-check.mjs`, `patch-plannotator.mjs`, `tui-settings/**` (13 ไฟล์), platform adapter 3 ชุด (Windows/macOS/Linux), launcher 4 แบบ
- มีกลไก **mirror** (`BAZERs-EXTENSION-*`): สร้าง skill สำเนาจาก primary agent เพื่อให้โหมดหนึ่ง "เรียกโหมดอื่น" ได้
- มีปลั๊กอิน `bazer-flow` บังคับ gate ว่า "ยังไม่อนุมัติแผน = ห้ามเขียนไฟล์"

### 1.2 ทำไมพัง (ตามที่ผู้ใช้สรุป + ที่ตรวจพบ)

| อาการ | ต้นเหตุเชิงโครงสร้าง |
|---|---|
| สคริปต์กระจัดกระจาย | ตรรกะกองใน `console.mjs` ไฟล์เดียว + สคริปต์แยกอีก 4 ชุด ต่างคนต่างรู้ path เอง |
| Console ควบคุมไม่ได้จริง | ไม่มีความจริงกลางว่า "ไฟล์อะไรควรอยู่ที่ไหน" — `planningAgents` ถูก hardcode ซ้ำ 3 ที่ |
| แก้แล้วพังเงียบ | ไม่มีสัญญา/สคีมา ไม่มี probe กับของจริง → "เขียวทั้งกระดานแต่ใช้ไม่ได้" |
| repo เกลื่อน | `.bak-*` วางข้างไฟล์จริงทุกโฟลเดอร์ |
| ติดตั้ง/อัปเดตไม่นิ่ง | "ติดตั้ง" ผูกกับโค้ด ไม่ได้มาจากรายการข้อมูล |
| mirror ทำให้ซับซ้อน | ต้อง generate สำเนาโหมดและ sync ตลอด — เกิดจากข้อจำกัดที่ตอนนี้ไม่มีแล้ว (subagent จริงมีให้ใช้) |

**บทสรุป:** ของเก่าไม่ได้พังเพราะเขียนโค้ดผิด — มันพังเพราะ **ไม่มีการแยก "ข้อมูล" ออกจาก "โปรแกรม"** และไม่มีสัญญากลาง

---

## 2. โจทย์ของรอบนี้ (ข้อกำหนดจากผู้ใช้)

### 2.1 ข้อกำหนดแข็ง

1. **ห้ามก๊อปโค้ดเก่ามาทั้งดุ้น** — เริ่มใหม่ที่ `SETUP/MAJOR` ไม่อยากให้โค้ดเก่าชี้นำดีไซน์
2. แยกที่เก็บ **primary mode · subagent · skills · plugin** ออกจากกัน และแยกโฟลเดอร์ให้ชัด
3. Console ต้องทำ 2 หน้าที่: **(ก) เช็คว่าไฟล์ระบบตั้งอะไรไว้ / มีหรือไม่มี (ข) apply สิ่งที่อยู่ใน MAJOR ลงไฟล์ระบบ** + มีปุ่มติดตั้งทุกอย่างที่จำเป็นตั้งแต่ต้น (OpenCode, Plannotator) เพื่อให้ non-code user ใช้ได้
4. **เขย่า primary mode ใหม่หมด** — เอา Plan/Build ที่มากับ OpenCode ออก เหลือ **BUDDHA · BAZER · SNACK · ADVISOR**
5. **BUDDHA** มี toggle ระหว่าง "DEFAULT ALLOW LIST" กับ "เหมาเข่ง ALLOW LIST" โดยเหมาเข่งต้องมีการยืนยันความเสี่ยง
6. **Plannotator**: เรียกจาก BUDDHA → กลับ BUDDHA · เรียกจาก BAZER → กลับ BAZER
7. **SNACK / ADVISOR** สลับกันได้: SNACK แก้ไฟล์ได้, ADVISOR แก้ไม่ได้ → `ADVISOR.md` ต้องบอกผู้ใช้ให้สลับไป SNACK
8. **BUDDHA/BAZER สมบูรณ์ในตัวเอง** — ไม่สลับ mode กลางแชท
9. **Git commit format:** `[Very Brief Phrase] [Rare emoji ที่ตรงกับงาน]: [Less Brief Phrase]`
10. **MAJOR เป็น repo เดิม** — ถ้าทดสอบแล้วดี sẽ overwrite `/OPENCODE`
11. **Console ต้องล้ำโดยไม่ต้องติดตั้งอะไรเพิ่ม**
12. **เอกสาร .md สองภาษา** แต่ **ไฟล์ที่ Agent ใช้งานจริงใช้ภาษาไทยเป็นหลัก**
13. **Windows ก่อน** — macOS/Linux ทำเมื่อมีเครื่องจริง
14. **ทิ้ง guideline ไว้ในแต่ละโฟลเดอร์** เพื่อกัน LLM รุ่นถัดไปทำโค้ดพันกัน

### 2.2 ของที่ผู้ใช้ให้读/ให้ยึด

- สเปก POTETO / ARENA / PSTACK จาก `C:\BCS\00.00 BCS Launch\00.03 pStack`
- ชุดไฟล์ agent ที่ Claude ปรับความแม่นยำไว้ (ใช้เป็น **วิธีคิด** ไม่ใช่คัดลอก)
- ตารางสิทธิ์:

| | Max Efficiency on Max Effort | No Loops Think | EXTREMELY OBVIOUS FILE/FOLDER PATH | Read that PATH | Edit that PATH |
|---|---|---|---|---|---|
| SNACK | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADVISOR | ✅ | ✅ | ✅ | ✅ | ❌ |

> หมายเหตุ: ตารางนี้ **ต่างจากของเก่า** (ของเก่า ADVISOR ห้ามอ่านไฟล์) — ผู้ใช้ยืนยันให้ใช้ตารางใหม่

### 2.3 Workflow ที่ผู้ใช้ร่าง

**BUDDHA**
```
Plain BUDDHA
→ POTETO (In Line): WRITE AN ARENA MODE's PLAN
→ PLANNOTATOR (In Line): SUBMIT A PLAN
→ (USER) feedback → วนกลับ POTETO | approve → NEXT
→ Plain BUDDHA
→ ARENA (In Line): Main ARENA Workflow
→ ARENA (BACKGROUND): loop ภายใน subagent ของ Arena
→ ARENA (In Line): DONE
→ Plain BUDDHA
→ POTETO (In Line): WRITE AN `ACTUAL CODEBASE EDIT` PLAN
→ PLANNOTATOR (In Line): SUBMIT A PLAN
→ (USER) feedback → วนกลับ POTETO | approve → NEXT
→ BUDDHA: EDIT AN ACTUAL CODEBASE
→ BUDDHA: WRITE A CONCLUSION AND GIT COMMIT
```

**BAZER**
```
Plain BAZER (no loop think, no unnecessary think, even in max effort)
→ Write a plan
→ PLANNOTATOR (In Line): SUBMIT A PLAN
→ (USER) feedback → วนกลับ | approve → NEXT
→ BAZER: EDIT ACTUAL CODEBASE
→ BAZER: WRITE A CONCLUSION AND GIT COMMIT
```

**Subagents:** POTETO (เรียก skills ใน PSTACK ยกเว้น ARENA) · PLANNOTATOR (เรียก plugin Plannotator) · ARENA (มี sub-subagent ตามสเปก)

---

## 3. หลักการที่ใช้ตัดสินใจ

1. **ข้อมูล ≠ โปรแกรม** — `AGENT/**` และ `PASSIVE/**` เป็นข้อมูลล้วน; โค้ดอยู่ `ACTIVE/**` ที่เดียว
2. **เจ้าของความจริงคนเดียว** — ไฟล์อะไรอยู่ที่ไหน = `manifest.json`; ชื่อโหมด/สิทธิ์ = `policies.json`; ปุ่ม = `actions.json`
3. **สัญญาแทนความจำ** — ทุกอย่างที่ Console ทำได้ต้องประกาศใน MANIFEST ก่อน
4. **พิสูจน์กับของจริง** — ไม่เชื่อว่าตั้งค่าแล้วได้ผล ต้องรัน `opencode debug agents` แล้วอ่านผล
5. **ของเก่าไม่ถูกลบ** — backup ก่อนเขียนทุกครั้ง; ของที่ไม่ต้องการย้ายไป `quarantine`
6. **ซื่อตรงเรื่องสถานะ** — ยังไม่ทำ = `design` ไม่ใช่เขียวหลอก
7. **ลดของ ไม่เพิ่มของ** — ตัด mirror, gang model, slash command ที่ไม่จำเป็น

---

## 4. โครงสร้างโฟลเดอร์จริง

### 4.1 บนดิสก์ (ยึดตามที่ผู้ใช้สร้างจริง)

```
SETUP/MAJOR/
├─ GUIDELINE.md                    กฎแม่ R1–R4 + ตัวอย่าง "ทำแบบนี้พังแน่"
├─ README.md                       ทางเข้า + แผนที่ + สถานะ v0.1
├─ .gitignore                      var/ · desktop.ini · *.lnk · *.bazer-tmp-*
├─ AGENT/
│  ├─ GUIDELINE.md
│  ├─ 01PRIMARY/                   BUDDHA.md · BAZER.md · SNACK.md · ADVISOR.md (+GUIDELINE)
│  ├─ 02SUBAGENT/                  POTETO.md · PLANNOTATOR.md · ARENA.md · BUILDER.md (+GUIDELINE)
│  │  └─ SUBSUBAGENT/              ARENA-RUNNER.md · ARENA-JUDGE.md
│  ├─ 03SKILLS/
│  │  ├─ GUIDELINE.md
│  │  ├─ PSTACK/                   53 skill (ยกเว้น arena) + ADAPT-OPENCODE.md
│  │  └─ BAZER/                    ว่างโดยเจตนา
│  └─ 04PLUGIN/GUIDELINE.md        ที่เดียวที่เป็นโค้ดได้ (ยังไม่เขียนใหม่)
├─ BAZERCONSOLE/
│  ├─ GUIDELINE.md
│  ├─ LOGS.md                      ไฟล์นี้
│  ├─ desktop.ini                  ไอคอนโฟลเดอร์ (machine-specific, gitignore)
│  ├─ 01MAIN/
│  │  ├─ GUIDELINE.md
│  │  ├─ PASSIVE/
│  │  │  ├─ GUIDELINE.md
│  │  │  ├─ 01MANIFEST/            README · CHANGELOG · schema · manifest · policies
│  │  │  │                         settings · actions · probes · law · env
│  │  │  ├─ 02INSTALLER/           install.json + GUIDELINE
│  │  │  ├─ 03SLASHCOMMAND/        ว่างโดยเจตนา + GUIDELINE
│  │  │  └─ 04PLANNOTATOR/         targets.json + GUIDELINE
│  │  ├─ ACTIVE/
│  │  │  ├─ GUIDELINE.md
│  │  │  ├─ SERVER/                9 โมดูล + tools/{selftest,apitest}
│  │  │  ├─ UI/                    index.html · app.js · style.css · motion.css
│  │  │  └─ var/                   runtime (state/backups/history/token/quarantine)
│  │  └─ CONFIGTEMPLATEFORAPPLY/   AGENTS.md · pstack-models.md (+GUIDELINE)
│  ├─ 02SHORTCUT/                  create-desktop-shortcut.ps1 + BAZERCONSOLE.ico
│  ├─ 03WINDOWS/                   BAZER CONSOLE.vbs (portable)
│  ├─ 04MACOS/ · 05LINUX/          ว่าง + GUIDELINE
└─ DOCS/                           FLOW.md · GUIDE.md
```

### 4.2 เทียบกับที่ผู้ใช้ร่างในแชท

| ที่ผู้ใช้ร่าง | ที่ทำจริง | เหตุผล |
|---|---|---|
| `AGENT/04MISCELLANEOUS/{PLUGIN,DOCS}` | `AGENT/04PLUGIN` + `MAJOR/DOCS` | ผู้ใช้สร้าง `04PLUGIN` ไว้บนดิสก์แล้ว; DOCS แยกออกมาไม่ให้ปนกับ agent |
| `BAZERCONSOLE/PASSIVE` + `ACTIVE` | ซ้อนไว้ใต้ `01MAIN/` (ตามที่ผู้ใช้สร้าง `01MAIN`) | ยึดของจริงบนดิสก์เป็นหลัก แต่คงชื่อ PASSIVE/ACTIVE ตามที่ร่าง |
| `02SUBAGENT/ARENA (folder)` | `02SUBAGENT/SUBSUBAGENT/` | ผู้ใช้สร้าง `SUBSUBAGENT` ไว้บนดิสก์แล้ว (มีไฟล์ตัวอย่าง `ARENA-LOOP1`) |
| `CONFIGTEMPLATEFORAPPLY` | คงชื่อเดิม | เป็นชื่อที่ผู้ใช้ตั้งเอง |

> ไฟล์ตัวอย่าง `SUBSUBAGENT/ARENA-LOOP1 (Example Name).md` (0 byte) **ไม่ถูกลบ** — เป็นของผู้ใช้

### 4.3 ไอคอนและทางลัด (Windows)

| ของ | รายละเอียด |
|---|---|
| ไอคอน | `02SHORTCUT/BAZERCONSOLE.ico` (เดิมชื่อ `Firefly_RemoveBackground.ico` — ผู้ใช้เปลี่ยนชื่อภายหลัง) |
| โฟลเดอร์ | `BAZERCONSOLE/desktop.ini` → `IconResource=<abs path>,0` + ตั้ง `+r +s` ให้ไฟล์ และ `+r` ให้โฟลเดอร์ (Explorer จึงใช้ไอคอน) |
| ทางลัด Desktop | `create-desktop-shortcut.ps1` → `.lnk` ชี้ `wscript.exe "03WINDOWS\BAZER CONSOLE.vbs"` + `IconLocation=<ico>,0` |
| ตัวเปิด | `03WINDOWS/BAZER CONSOLE.vbs` — หา `MAJOR` จากตำแหน่งตัวเอง (ย้าย repo ได้) แล้วรัน `SERVER/index.mjs --port=4310` |

**บทเรียนที่เจอจริง:** ไฟล์ `.ps1` ที่ไม่มี BOM ถูก Windows PowerShell 5.1 อ่านเป็น ANSI → ข้อความไทยเพี้ยนก่อนรัน จึงบังคับให้ script ใน `02SHORTCUT` เป็น **ASCII ล้วน** และเขียนกฎนี้ใน `02SHORTCUT/GUIDELINE.md`
`desktop.ini` ถูก gitignore (ผูกพาธ absolute) — ย้าย repo แล้วรัน script ใหม่

---

## 5. กฎ R1–R4 และสถานที่เก็บ

### 5.1 กฎ

| # | กฎ | ผิดเมื่อไหร่ | ตัวบังคับ |
|---|---|---|---|
| **R1** | ต้นทางเป็นข้อมูล — `AGENT/**`, `CONFIGTEMPLATEFORAPPLY/**`, `PASSIVE/**` ห้ามมีโค้ด | เจอ `.mjs/.js/.ps1/.cmd/.vbs` (ยกเว้น `02INSTALLER`) | `law.mjs` |
| **R2** | Console ห้าม hardcode ที่อยู่ปลายทาง | เจอ path ผู้ใช้ใน `ACTIVE/**` | `law.mjs` |
| **R3** | ปุ่มทุกปุ่มมาจาก `actions.json` + ต้องมี handler ตรงกัน | id ไม่ตรงกัน | `law.mjs` (เทียบกับ registry จริง) |
| **R4** | ห้าม `.bak` ข้างไฟล์จริง | เจอ `*.bak*` นอก `var/` | `law.mjs` |

**R5 (บทลงโทษ):** งานที่ทำจะไม่ถูกติดตั้ง — `ตรวจกฎ` เป็นขั้นแรกของ `ติดตั้งทั้งหมด`; แดง = หยุด

### 5.2 เก็บที่ไหน (คำถามของผู้ใช้: "กฎ 4 ข้อใส่ที่ไหน")

1. **`MAJOR/GUIDELINE.md`** — กฎแม่ + ตัวอย่าง "ถ้าเพิ่มแบบนี้ อีก 3 เดือนพังแน่"
2. **`GUIDELINE.md` ในทุกโฟลเดอร์** — กฎเดียวกันแต่แคบลงตามบริบท (17 ไฟล์)
3. **`MANIFEST/law.json` + `SERVER/law.mjs`** — บังคับด้วยเครื่องจริง (กฎที่ไม่มีตัวบังคับ = ไม่มีกฎ)

---

## 6. สถาปัตยกรรม BAZERCONSOLE

### 6.1 ชั้นข้อมูล (`PASSIVE/01MANIFEST`)

| ไฟล์ | เป็นเจ้าของเรื่อง |
|---|---|
| `manifest.json` | ของทุกชิ้น + ที่อยู่ปลายทาง + วิธีติดตั้ง + สถานะ (21 entry) |
| `policies.json` | บันไดเหมาเข่ง 5 ระดับ |
| `settings.json` | คอนโทรลหน้า ตั้งค่า (Quick Access / ARENA / อื่น ๆ / PSTACK) |
| `actions.json` | ปุ่มทุกปุ่ม + ระดับความเสี่ยง (19 ปุ่ม) |
| `probes.json` | ข้อพิสูจน์กับของจริง 8 ข้อ |
| `law.json` | กฎ R1–R4 ในรูปข้อมูล |
| `env.json` | ตัวแปร `${HOME} ${CONFIG} ${SKILLS} ${STATE} ${PLANNOTATOR} ${LAUNCH} ${TEMP}` |
| `schema.json` | รูปร่างของทุกไฟล์ข้างบน |
| `README.md` | สัญญาเต็ม + กับดักที่พิสูจน์แล้ว + วิธีเพิ่มของ 6 ขั้น |
| `CHANGELOG.md` | ประวัติการแก้ (บังคับอัพเดตทุกครั้งที่แก้โฟลเดอร์นี้) |

### 6.2 ชั้นโปรแกรม (`ACTIVE`)

```
SERVER/
├─ index.mjs     HTTP 127.0.0.1 + token + SSE + static (กัน path traversal)
├─ env.mjs       resolve ${VAR}
├─ jsonc.mjs     JSONC editor ที่คงคอมเมนต์ + BOM + CRLF + array removal
├─ manifest.mjs  load/validate/hash/tree
├─ plan.mjs      5(+2) สถานะ + diff
├─ apply.mjs     backup → atomic write → hash → history → rollback/quarantine
├─ probe.mjs     พิสูจน์กับ OpenCode จริง (spawn ผ่าน shell บน Windows)
├─ law.mjs       R1–R4
├─ actions.mjs   registry 19 handlers (ต้องตรง actions.json)
└─ tools/
   ├─ selftest.mjs  33 checks (jsonc/plan/law/contract)
   └─ apitest.mjs   43 checks (integration: สตาร์ทเซิร์ฟเวอร์เอง ยิง HTTP)
UI/
├─ index.html    shell + token meta + modal/palette/logbar
├─ app.js        render จาก state (ไม่ผูกปุ่มตายตัว)
├─ style.css     dark theme + `[hidden] { display:none !important }`
└─ motion.css    animation ทั้งหมด + prefers-reduced-motion
```

### 6.3 หลักการของเซิร์ฟเวอร์

- **ไม่มี dependency** — Node built-ins เท่านั้น → clone แล้วเปิดได้
- **token ต่อการเปิดหนึ่งครั้ง** เก็บที่ `var/token`; POST ทุกตัวต้องมี header `x-bazer-token` (กัน CSRF)
- **read vs write ชัดเจน** — `kind: read` ไม่แตะไฟล์; `kind: write` ต้องยืนยัน (ยกเว้นปุ่มที่ dry-run ได้)
- **ผลลัพธ์รูปเดียว** `{ ok, summary, ...payload }` → UI แสดงแบบเดียวกันทุกปุ่ม

---

## 7. MANIFEST — สัญญากลาง

### 7.1 entry (ตัวอย่าง)

```jsonc
{
  "id": "agent.buddha",
  "kind": "agent|subagent|subsubagent|skill|plugin|command|config|template|launcher|patch",
  "title": "โหมด BUDDHA",
  "source": "AGENT/01PRIMARY/BUDDHA.md",
  "target": "${CONFIG}/agents/buddha.md",
  "strategy": "overwrite",
  "owner": "ours|user|pstack",
  "status": "ready|raw|design",
  "auto": true,
  "proof": "modes-present",
  "why": "บังคับเมื่อ status=design"
}
```

### 7.2 strategy (8 แบบ — มีเท่านี้)

| strategy | ทำอะไร | ใช้กับ |
|---|---|---|
| `overwrite` | เขียนทับถ้า hash ต่าง | ไฟล์ของเรา |
| `create-only` | สร้างถ้ายังไม่มี | launcher, ไฟล์ที่ผู้ใช้อาจแก้ |
| `template-once` | สร้างครั้งเดียว ไม่ทับ | `AGENTS.md`, `pstack-models.md` |
| `jsonc-merge` | ใส่/รวมค่าที่ `valuePath` คงคอมเมนต์ | `opencode.jsonc`, `tui.json` |
| `jsonc-remove-array-item` | ลบสมาชิก array (คงคอมเมนต์) | ถอดปลั๊กอินเก่า |
| `copy-tree` | คัดลอกทั้งโฟลเดอร์ (มี exclude + binary-safe) | skills, plugins |
| `patch` | แพตช์ไฟล์เครื่องมืออื่น (ยัง design) | Plannotator |
| `line` | แทนทั้งบรรทัดที่ขึ้นต้นด้วย prefix | `pstack-models.md` |

### 7.3 สถานะ (5 + 2)

| สถานะ | ความหมาย | UI |
|---|---|---|
| `ok` | ตรงกับต้นทาง | เขียว |
| `stale` | มีแต่เนื้อหาต่าง | เหลือง + ปุ่มอัปเดต |
| `missing` | ยังไม่มี | แดง + ปุ่มติดตั้ง |
| `foreign` | มีในระบบแต่ไม่อยู่ใน manifest | เทา ("ของเก่า" tab) |
| `broken` | ของครบแต่ probe ไม่ผ่าน | แดงกระพริบ |
| `design` | ประกาศไว้แต่ยังไม่พร้อม | ฟ้า (ไม่ใช่ error) |
| `raw` | ติดตั้งได้แต่ยังไม่ adapt | เหลืองอ่อน |

### 7.4 plan → apply

**`plan` (dry-run)** — ไม่เขียนอะไรเลย:
1. ตรวจกฎ R1–R4
2. ต่อ entry: เทียบ hash / ค่า → `state` + `willWrite` + `diff`
3. สแกน `foreign` ในโฟลเดอร์ปลายทาง
4. คืน `{entries[], summary, foreign, blockers[]}`

**`apply`** — ลำดับตายตัว:
```
config → agents → subagents → skills → templates → launcher → patch → probe
```
ต่อ entry: **backup → atomic write → อ่านกลับเทียบ hash → history**
ล้มกลางทาง = **หยุด + rollback อัตโนมัติ** (คืนไฟล์ที่เขียนไปแล้ว + ลบไฟล์ที่เพิ่งสร้าง)
รันซ้ำ = `applied 0` (idempotent)

### 7.5 backup / history / rollback / quarantine

| ของ | ที่อยู่ | หมายเหตุ |
|---|---|---|
| backup | `ACTIVE/var/backups/<stamp>/files/<hash>_<name>` | ใช้ hash ของพาธเต็มกันชนกัน |
| history | `ACTIVE/var/history.tsv` | เวลา · stamp · entry · target · hash ก่อน/หลัง |
| rollback | คืนทั้งรอบจาก `backups/<stamp>/manifest.json` | ปุ่ม risk 3 |
| quarantine | `ACTIVE/var/quarantine/<stamp>/<group>/` | ของเก่า (ไม่ลบถาวร) + `quarantine.json` |
| state | `ACTIVE/var/state.json` | สถานะติดตั้ง/ระดับเหมาเข่ง/lock/snapshot |

---

## 8. โหมดหลัก 4 ตัว

### 8.1 ตารางสรุป

| ไฟล์ | mode | color | หน้าที่ | permission หลัก |
|---|---|---|---|---|
| `BUDDHA.md` | primary | `#EB895B` | Poteto plan → Gate 1 → Arena → Poteto plan → Gate 2 → ลงมือแก้เอง → commit | read/edit/glob/grep/list allow · shell **ask** · subagent allow |
| `BAZER.md` | primary | `#D9480F` | แผนเดียว → Gate → แก้เฉพาะไฟล์ที่ระบุพาธ → commit | read/edit allow · glob/grep/list **ask** · shell ask · subagent allow (เฉพาะ plannotator) |
| `SNACK.md` | primary | `#40E0D0` | ถามเร็วตอบเร็ว อ่าน/แก้ได้เฉพาะพาธที่ระบุ | read/edit allow · glob/grep/list/shell/subagent **deny** |
| `ADVISOR.md` | primary | `#B26BFF` | ที่ปรึกษา อ่านได้เฉพาะพาธที่ระบุ **แก้ไม่ได้** | read allow · edit/glob/grep/list/shell/subagent **deny** |

> **สี:** BAZER คงของเดิม (`#D9480F`) · BUDDHA/SNACK คงของเดิม · ADVISOR ปรับม่วงให้อ่านชัดบน dark theme (`#9B30FF` → `#B26BFF`) แต่ยังสด
> **visual effect ใน TUI** ทำได้แค่ `color` (ไม่มี API ให้ทำ animation) — effect อื่นต้องเป็นปลั๊กอิน (ยังไม่ทำ)

### 8.2 BUDDHA — ลำดับตายตัว

| เฟส | ทำอะไร | เรียกใคร | ทางออก |
|---|---|---|---|
| P0 | อ่านโจทย์ + สำรวจบริบท (read-only) | — | P1 |
| P1 | แผน Arena ขึ้นต้น `# GATE 1 — ARENA PLAN` | `poteto` | P2 |
| P2 | ยื่นแผน | `plannotator` | approve → P3 · feedback → P1 |
| P3 | Arena ในเซสชัน (candidate ลง temp) | `arena` | P4 |
| P4 | แผนแก้โค้ด ขึ้นต้น `# GATE 2 — BUILD PLAN` | `poteto` | P5 |
| P5 | ยื่นแผน | `plannotator` | approve → P6 · feedback → P4 |
| P6 | แก้โค้ดเอง + พิสูจน์ + bug scan 3 รอบ + สรุป + commit | `builder` เฉพาะเมื่อสั่ง | จบ |
> **อัพเดต 00.00.02 §5.1:** P6 เปลี่ยนเป็นเรียก `builder` inline แล้ว (builder เป็น subagent ไม่ใช่ primary)

**กฎเหล็ก 5 ข้อ:** ห้ามสลับ agent · ก่อนอนุมัติแผนสร้างห้ามแตะโปรเจกต์ (เขียนได้แค่ `%TEMP%\bazer\`) · ห้ามข้าม gate · ห้ามแต่งผล Arena · ทุกข้อสรุปต้องมีหลักฐาน

### 8.3 BAZER — แผนเดียว

| เฟส | ทำอะไร |
|---|---|
| B1 | อ่านโจทย์ + ไฟล์ที่อนุญาต + ตรวจสภาพจริง |
| B2 | แผนขึ้นต้น `# BAZER — PLAN` |
| B3 | ยื่นด้วย `plannotator` |
| B4 | แก้ + พิสูจน์ |
| B5 | bug scan 3 รอบ → รายงาน → commit |

**ขอบเขตไฟล์:** "ไฟล์ที่ได้รับอนุญาต = พาธที่ผู้ใช้เขียนในข้อความของตัวเอง" — ห้ามอ่านไฟล์อื่นแม้เพื่อดูบริบท, ห้ามอ่านทางอ้อม (subagent/glob/shell), ถูกปฏิเสธ = คำตอบสุดท้าย

### 8.4 SNACK

- ประโยคแรกคือคำตอบ, 1–3 ประโยค, ไม่มีหัวข้อ/ตารางประดับ
- อ่าน/แก้ได้เฉพาะพาธที่ผู้ใช้ระบุ — ไม่มี glob/grep/list/shell/subagent
- ถ้างานเกินขอบเขต → บอก 1 บรรทัดให้ไป BAZER/BUDDHA

### 8.5 ADVISOR

- อ่านได้เฉพาะพาธที่ผู้ใช้ระบุ, **แก้ไม่ได้** (permission edit: deny)
- ถ้าคำตอบที่ดีที่สุดคือ "ต้องแก้ไฟล์" → ต้องบอกว่า **"ผมแก้ในโหมดนี้ไม่ได้ — สลับเป็น SNACK MODE"** พร้อมคำสั่งแก้ที่พร้อมใช้
- เกินความสามารถ → บอก "ไม่รู้" ห้ามเดา

### 8.6 วิธีเขียนให้ "แม่น" (ยืมวิธีจากชุดที่ Claude ปรับ — ใช้ครบ 10 ข้อ)

1. นิยามขอบเขตให้เป็นสมการ
2. แยกจังหวะเวลา (ก่อน/หลังอนุมัติ)
3. ปิดช่องทางอ้อม
4. ข้อยกเว้นต้องมีชื่อและมีจำนวน
5. self-check ก่อนเรียกเครื่องมือ
6. ถูกปฏิเสธ = คำตอบสุดท้าย
7. ห้าม improvise (โหลด skill ไม่ได้ → หยุด)
8. สัญญารายงานตายตัว
9. ข้อความที่เครื่องอ่านได้ (`# GATE 1 — ARENA PLAN`, marker)
10. ภาษา: เนื้อหาหลักไทย · ค่า/คีย์/ชื่อเครื่องมืออังกฤษ

---

## 9. Subagents

| ไฟล์ | id ที่เรียก | งาน | permission |
|---|---|---|---|
| `POTETO.md` | `poteto` | เขียนแผนด้วยกระบวนการ poteto (โหลด skill `poteto-mode`) คืนแผนเป็นข้อความ | read/edit (temp เท่านั้น) |
| `PLANNOTATOR.md` | `plannotator` | ยื่นแผน + คืนผล approved/feedback | read/edit (temp) · shell allow (เฉพาะ plannotator CLI) |
| `ARENA.md` | `arena` | เดิน Arena 6 เฟส | read/edit (temp) · shell · subagent allow |
| `BUILDER.md` | `builder` | รับแผนอนุมัติแล้วลงมือ (สำหรับ Plan Mode เดิม) | `mode: all` · edit allow · subagent/submit_plan deny |
| `SUBSUBAGENT/ARENA-RUNNER.md` | `arena-runner` | ผู้แข่ง 1 ที่นั่ง | edit เฉพาะโฟลเดอร์ตัวเอง |
| `SUBSUBAGENT/ARENA-JUDGE.md` | `arena-judge` | กรรมการให้คะแนน | read-only |

**In-line vs background:** OpenCode แสดง subagent เดี่ยวแบบ inline; ถ้ารันหลายตัวพร้อมกันจะถูกซ่อนและสรุปกลับ — ARENA จึง spawn `arena-runner` 2–3 ตัวพร้อมกันแบบ `background: true` แล้วรวมผล

**สัญญารายงานกลับ (ทุก subagent):** ทำอะไร · ไฟล์/พาธที่แตะ · หลักฐาน (คำสั่ง + ผลจริง) · สิ่งที่ยังพิสูจน์ไม่ได้

---

## 10. บันไดเหมาเข่ง

### 10.1 ห้าระดับ

| ขั้น | ชื่อ | tagline | เปิดอะไรเพิ่ม | risk |
|---|---|---|---|---|
| 1 | **สุภาพ** | เท่าที่ BUDDHA รุ่นเก่าทำได้ | read/edit/glob/grep/list allow · shell **ask** · subagent allow | 1 |
| 2 | **ปลดกำ** | shell ไม่ถามก่อนรัน | shell allow | 2 |
| 3 | **ออกนอกบ้าน** | ออกนอกโปรเจกต์ + เรียกเว็บได้ | webfetch/websearch/external_directory allow | 2 |
| 4 | **ไม่ถามใคร** | ไม่หยุดถาม + วนซ่อมตัวเอง | question/doom_loop allow | 3 |
| 5 | **เหมาเข่ง** | ทุกอย่างจริง ๆ | ทุก action รวม browser | 3 |

### 10.2 กลไก

- เขียนที่ **`agent.buddha.permission`** ใน `opencode.jsonc` — **ไม่แตะ `BUDDHA.md`**
- พิสูจน์แล้วว่า permission จาก config **ต่อท้าย** กฎในไฟล์และมีผลจริง (ทดสอบ: `read: deny` จาก config ชนะ `read: allow` ในไฟล์)
- แต่ละระดับส่ง permission **ครบชุด** (ไม่ใช่ส่วนต่าง) → สลับระดับแล้วไม่ค้างกฎเก่า
- กดขั้น → popup ยืนยัน **1 จังหวะ** (ไม่ต้องพิมพ์คำ) → **เขียนทันที ไม่ต้องกดอัปเดตอีกที** (ข้อยกเว้นเดียวของระบบ)
- มีปุ่ม **ย้อนระดับก่อนหน้า** (`policy-undo`)
- มีผลกับ **session ใหม่** (ต้องเปิด OpenCode ใหม่)

---

## 11. Plannotator

### 11.1 พฤติกรรมที่ต้องการ

- เรียกจาก **BUDDHA** → ปุ่มอนุมัติกลับ **BUDDHA**
- เรียกจาก **BAZER** → ปุ่มอนุมัติกลับ **BAZER**
- `PLANNOTATOR.md` ต้องรายงานว่า "ปุ่มชี้ผิดโหมด" ถ้าผลลัพธ์ไม่ตรงกับโหมดต้นทาง

### 11.2 สถานะจริงของงานนี้

- `PASSIVE/04PLANNOTATOR/targets.json` เก็บค่าที่ต้องการ + กติกาการตรวจ
- **ยังไม่แพตช์** (`manifest: patch.plannotator = design`) เพราะต้องรัน probe `plannotator-locate` ให้เจอไฟล์จริงก่อน — ห้ามเดาไฟล์
- ถ้าแพตช์ไม่ได้ → ถอยไปใช้ `submit_plan` ตามปกติและรายงานตรง ๆ
- เมื่อแพตช์: เก็บ hash ต้นฉบับ → ปลั๊กอินอัปเดตแล้ว hash เปลี่ยน = `broken` ให้แพตช์ใหม่

---

## 12. Settings — model & effort

### 12.1 สามที่ (ตามที่ผู้ใช้ขอ)

| ที่ | อยู่หน้าไหน | เขียนลง |
|---|---|---|
| **Quick Access** | แท็บ ตั้งค่า | `agent.<mode>.model` / `.variant`, `tui.json` (คีย์), lock |
| **ARENA** | แถบในหน้า **โหมด & สิทธิ์** (BUDDHA) | `~/.agents/pstack-models.md` (`arena runners`, `cross-judge pool`) |
| **PSTACK roles** | แท็บซ่อนในหน้า ตั้งค่า | `pstack-models.md` 15 role + budget |

### 12.2 ไม่มี "gang model" — เหตุผล

ของเก่าจัด model เป็น "gang" แล้วผูก gang เข้ากับ role ของ PSTACK เราไม่ทำ เพราะ:
1. เพิ่มชั้นนามธรรมที่ต้องจำ (gang ไหนคุม role อะไร) โดยไม่ได้ลดงาน
2. เวลาผิด จะไม่รู้ว่าผิดที่ gang หรือที่ role
3. 15 role น้อยพอที่จะเห็นทั้งหมดในหน้าเดียว

แทนที่ด้วย **preset 3 แบบ**: `ใช้ตัวเดียวทั้งชุด` · `แยกงานเขียน/งานตัดสิน` · `กำหนดเอง`

### 12.3 Lock / drift

- เปิด toggle `lock.models` → เก็บ snapshot ของ model/effort 4 โหมด
- ตอนเปิด Console: ถ้าค่าปัจจุบันต่างจาก snapshot → ขึ้นแบนเนอร์ **"ค่าถูกเปลี่ยนหลังล็อก"** (เตือน ไม่บล็อก)
- `lock.keybinds` เก็บ flag ไว้ (การเตือนคีย์ยังไม่ทำ)

---

## 13. UX/UI ของ Console

### 13.1 ห้าแท็บ

1. **ภาพรวม** — การ์ดสรุป (missing/stale/broken/foreign) · ปุ่มหลัก · กฎ 4 ข้อ · probe
2. **โหมด & สิทธิ์** — การ์ด 4 โหมด · **บันไดเหมาเข่ง** · แถบ ARENA · ซ่อน/คืน Plan & Build · ถอด bazer-flow เก่า
3. **ไฟล์ & สกิล** — ทุก entry + diff + ติดตั้งรายตัว + **ของเก่า (cleanup)** + รีเซ็ต template
4. **ตั้งค่า** — Quick Access / ตั้งค่าอื่น ๆ / PSTACK roles
5. **ประวัติ** — history + ย้อนรอบ

### 13.2 ระดับความเสี่ยง 3 ขั้น

| ระดับ | ข้อความ | ใช้กับ |
|---|---|---|
| 1 | **ปลอดภัยมาก กดได้เลย** | อ่านอย่างเดียว |
| 2 | **ดูเหมือนปลอดภัย แต่ตั้งสติดี ๆ** | เขียนไฟล์ของเรา / เปลี่ยนค่าที่มีผล |
| 3 | **ไม่ปลอดภัย (กดได้ แต่เตือนแล้ว)** | ทับของเดิม/ถอดของ/ติดตั้งโปรแกรม |

ทุกปุ่ม/ทุกช่องมี **ประโยคอธิบายว่าเสี่ยงยังไง** (ไม่ใช่แค่สี) และทุกปุ่มเขียนไฟล์มี **diff ก่อน-หลัง**

### 13.3 สัญญาของปุ่ม

1. ปุ่มมาจาก `actions.json` (UI กับ backend อ่านไฟล์เดียวกัน)
2. ผลลัพธ์รูปเดียว `{ ok, summary, changed[], skipped[], errors[] }`
3. ปุ่มเขียนทุกตัวมี dry-run/diff
4. ทำไม่ได้ = **disabled + เหตุผลบนจอ**
5. กดเสร็จ state รีเฟรชเอง + ลง history + rollback ได้
6. stale detection: แอปเก่ากว่า manifest → เตือนให้ปิด-เปิดใหม่

### 13.4 Motion (ไม่มี dependency / ไม่มี build step)

- orbs เคลื่อนไหวฉากหลัง · การ์ด stagger ตอนเปลี่ยนแท็บ · ปุ่มมี sheen + แสงตามเมาส์
- modal/toast slide · logbar มี flash เมื่อมี event · แถบขั้นที่เลือกมี glow
- command palette `Ctrl+K` · เคารพ `prefers-reduced-motion`
- ไฟล์แยก `style.css` / `motion.css` (ไม่ inline ไม่ generate → ไม่มีปัญหาไฟล์สองชุดตีกัน)

### 13.5 ทำไมไม่มี slash command

`PASSIVE/03SLASHCOMMAND` ว่างโดยเจตนา — สลับโหมดใช้ `Shift+Tab`
เกณฑ์ก่อนจะเพิ่ม command ในอนาคต (ต้องตอบได้ทั้ง 3 ข้อ):
1. command ทำอะไรที่ **ปุ่มใน Console ทำไม่ได้**
2. ไม่สร้าง "สองทางที่ต้อง sync กัน" (command บอก A · ปุ่มบอก B)
3. ถ้าลบ command ทิ้ง ผู้ใช้ยังทำงานได้ครบ

---

## 14. ข้อเท็จจริงที่พิสูจน์กับ OpenCode v2.0.32

> ทุกข้อในตารางนี้ **รันจริงบนเครื่อง** ไม่ใช่การอ่าน docs

| เรื่อง | ผลจริง |
|---|---|
| permission action ที่มีจริง | `read` `edit` `glob` `grep` `list` `shell` `subagent` `webfetch` `websearch` `external_directory` `question` `doom_loop` `browser` (+ `submit_plan` จาก Plannotator) |
| alias | `bash` → `shell` · `task` → `subagent` **ใช้ได้จริง** (ไฟล์เขียน `bash: ask` → runtime เป็น `shell: ask`) |
| **คีย์ตาย** | `skill`, `lsp` **ไม่มีในสคีมา** → ใส่แล้วเงียบ ไม่ error (ต้นเหตุ "บรรทัดตาย") |
| `browser` | OpenCode ใส่ `deny` ให้เองทุก agent |
| ฟอร์มของ permission | `permission:` แผนที่ (canonical) · `permissions:` แบบลิสต์ยังอ่านได้ (deprecated) |
| `color` | ต้องเป็น hex 6 หลัก หรือชื่อ theme — ผิดแล้ว agent ถูกทิ้งทั้งไฟล์ |
| `mode` | `primary` · `subagent` · `all` |
| `hidden` | ใช้กับ primary ได้ (แม้ doc บอกว่าเฉพาะ subagent) |
| ซ่อน Plan/Build | `agent.plan/build = { mode:"subagent", hidden:true }` ใน config → ออกจาก primary จริง **ไม่ต้องลบไฟล์** |
| permission จาก config | **ต่อท้าย** กฎในไฟล์ (ไม่แทน) → ต้องส่งชุดเต็มทุกครั้ง; กฎท้ายสุดชนะ |
| `tui.json` | คีย์ลัดอยู่ที่ `keybinds.*` (ยืนยันจากไฟล์จริง) |
| `opencode debug agents` | คืน JSON array ของ agent พร้อม `mode`/`hidden`/`permissions` (ใช้เป็นแหล่งพิสูจน์) |
| Windows shim | `opencode` เป็น `.cmd/.ps1` → spawn ตรง ๆ ได้ ENOENT ต้องผ่าน shell |

---

## 15. Bug scan 5 รอบ

> รวม **13 จุด** (รายงานรอบแรกนับรวมบางจุดเป็น 12)

### รอบ 1 — static / contract (2)

| บั๊ก | อาการ | แก้ |
|---|---|---|
| `probe.mjs` spawn `opencode` ตรง ๆ | ENOENT บน Windows → probe ทั้งชุดใช้ไม่ได้ | รันผ่าน shell + retry 1 ครั้งถ้าลิสต์ว่าง + throw แทนรายงานผิด |
| `permission-level` ผ่านหลอก | ขึ้น PASS ทั้งที่ยังไม่เขียนค่าลง config | เช็คว่า key มีจริงใน `opencode.jsonc` ด้วย |

เพิ่มเทสต์สัญญา 6 ข้อ: probe kind มี impl · target resolve ได้ · policy ใช้เฉพาะ action จริง · settings resolve ได้ · frontmatter agent ผ่านสคีมา · โหมดหลักมี 4 ไฟล์

### รอบ 2 — jsonc adversarial (2)

| บั๊ก | อาการ | แก้ |
|---|---|---|
| `removeArrayItem` เขียน array ใหม่ทั้งก้อน | คอมเมนต์ใน array หาย | ตัดเฉพาะช่วงของสมาชิก คงคอมเมนต์ |
| ไฟล์มี BOM | `setAtPath` โยน error | รองรับ BOM และคงไว้ตอนเขียนกลับ |

เพิ่มเทสต์ 12 เคส: trailing comma · CRLF · BOM · key ซ้ำคนละชั้น · `{}` บรรทัดเดียว · สตริงที่มี `}{` · ชั้นกลางเป็นสตริง · ไทย/emoji · number/bool/null · array ซ้อน · ไฟล์พังต้อง throw

### รอบ 3 — API / security (2)

- path traversal เช็คด้วย `startsWith` → เปลี่ยนเป็น `path.relative`
- ปุ่ม dry-run ถูกบังคับยืนยัน → เพิ่ม `confirmUnlessParam` ใน `actions.json`
- เพิ่ม `tools/apitest.mjs` (integration test)

### รอบ 4 — UI (4)

- คีย์ลัดถูกเขียนเป็น **สตริง** → `tui.json` เสียรูป → แปลงเป็น array
- ปุ่ม `open-target` / `plannotator-locate` ไม่มีที่ให้กด → หน้าแรกแสดงปุ่มที่ยังไม่มีเจ้าภาพครบ
- ตัวกรอง "BAZER" จับผิด + `policies[0]` เปราะ → แก้ให้กรองจาก source / หา policy ตาม `mode`
- โค้ดตายใน palette + ป้าย `⌘ K` บน Windows → `Ctrl K`

### รอบ 5 — real-world (3)

- **README สัญญาว่า rollback แต่โค้ดแค่หยุด** → implement rollback จริง (ทดสอบด้วยการวางโฟลเดอร์ทับไฟล์ปลายทาง)
- `copy-tree` อ่านไฟล์เป็นข้อความ → **ไบนารีพัง** → ตรวจ NUL แล้ว copy แบบ byte
- ชื่อ backup ชนกัน → ใช้ hash ของพาธเต็มนำหน้า
- เพิ่มเทสต์: state.json พัง · history.tsv พัง · บันทึกก่อนติดตั้งต้องล้มอย่างสุภาพ

---

## 16. บั๊กหลังเปิดใช้: modal ว่าง + ปุ่มกดไม่ได้

### อาการที่ผู้ใช้เจอ
1. เข้า Console แล้วมี popup ว่าง ปิดไม่ได้
2. ปุ่มด้านในเหมือนใช้ไม่ได้

### ต้นเหตุ (บั๊กเดียว)
```css
/* ของเดิม */
.modal-root { display: grid; z-index: 60; ... }
```
`display: grid` ของ author CSS **ชนะ `[hidden]` ของเบราว์เซอร์** → modal ที่ยังไม่เปิดแสดงเป็นกล่องเปล่าเต็มจอ ทับทุกอย่าง → คลิกไปโดนแผ่นใส ไม่โดนปุ่ม; กดปิดก็ไม่หายเพราะ `hidden` ไม่มีผล

### แก้
```css
[hidden] { display: none !important; }
```
+ เทสต์กันกลับมา (selftest ตรวจว่ามี rule นี้)
+ `load()` ตรวจว่ามี `plan` จริง, `render()` ครอบ try/catch → แจ้ง toast แทนปล่อยหน้าจอค้าง
+ **ต้อง hard refresh (Ctrl+Shift+R) หนึ่งครั้ง** หลังอัปเดต

---

## 17. เคลียร์ของเก่าให้เหลือแต่ของใหม่

### 17.1 กลไก

| กลไก | ทำอะไร |
|---|---|
| `cleanup-plan` (read) | ดูว่าจะย้ายอะไร (dry-run) |
| `cleanup-old` (write, risk 3) | ย้ายของเก่าไป `var/quarantine/<stamp>/` + เขียน `quarantine.json`; ถอดปลั๊กอินเก่าออกจาก `opencode.jsonc` |
| `reset-template` (write, risk 3) | เขียนทับ `AGENTS.md` / `pstack-models.md` ด้วยแม่แบบใหม่ (backup ก่อน) |

### 17.2 ห้ากลุ่ม

| กลุ่ม | ค่าเริ่มต้น | หมายเหตุ |
|---|---|---|
| `agents` | ติ๊ก | agent ที่ไม่ใช่ของ MAJOR |
| `mirrors` | ติ๊ก | `BAZERs-EXTENSION-*` (ดีไซน์ใหม่ไม่ใช้ mirror) |
| `skills-other` | **ไม่ติ๊ก** | อาจเป็น skill ที่ผู้ใช้เขียนเอง — ต้องดูรายการก่อน |
| `plugins` | ติ๊ก | ปลั๊กอินใน config ที่ไม่ใช่ของ MAJOR |
| `plugin-dirs` | ติ๊ก | โฟลเดอร์ใน `.config/opencode/plugins` |

### 17.3 ลำดับที่แนะนำ

```
1. ติดตั้ง / อัพเดตทั้งหมด
2. ไฟล์ & สกิล → ของเก่า → ย้ายของเก่าไป quarantine
3. แถว AGENTS.md → รีเซ็ต (ถ้ายังมีกฎ BAZER-FLOW เก่า)
4. ตรวจของจริง → เปิด OpenCode ใหม่
```

### 17.4 สถานะเครื่องจริงตอนตรวจ (2026-10-20, ยังไม่ติดตั้ง)

```
agents 3   : comment-sicko.md · poteto-agent.md · poteto-mode.md
mirrors 6  : BAZERs-EXTENSION-{Advisor,Arena,Bazer,Buddha,Poteto,Snack}
skills-other 2
plugins 1  : ./plugins/bazer-flow
plugin-dirs 2
plan       : ok 1 · stale 11 · missing 5 · design 4 · foreign 11 · blockers 0
```

---

## 18. หลักฐานการทดสอบ

| ตรวจ | ผล |
|---|---|
| `node tools/selftest.mjs` | **33 passed** (jsonc 19 · plan/law 4 · idempotency 1 · contract 9) |
| `node tools/apitest.mjs` | **43 passed** (integration: token · error path · rollback · traversal · cleanup · reset) |
| ติดตั้งลง sandbox | **applied 16 · errors 0** · รันซ้ำ **applied 0** · `ok 17 · design 4 · blockers 0` |
| ล้มกลางทาง | apply fail → rollback อัตโนมัติ → ไฟล์ที่เพิ่งสร้างถูกลบจริง |
| binary | copy-tree รักษา byte เดิม |
| cleanup | 4 กลุ่มถูกย้าย · config ถอดปลั๊กอิน · quarantine มี manifest |
| reset template | เขียนทับ `AGENTS.md` จนกฎเก่าหาย · ปฏิเสธ entry ที่ไม่ใช่ template |
| law | R1–R4 ผ่านบน repo จริง |
| probe บนเครื่องจริง | `builtin-hidden` + `permission-level` ยังไม่ผ่าน (เพราะยังไม่ติดตั้ง) — **รายงานตรง** |

---

## 19. สิ่งที่ยังไม่ทำ / ความเสี่ยงที่รู้ตัว

| เรื่อง | สถานะ | หมายเหตุ |
|---|---|---|
| แพตช์ปุ่มอนุมัติ Plannotator | `design` | ต้องรัน `plannotator-locate` เจอไฟล์จริงก่อน |
| ปลั๊กอิน `bazer-flow` (gate) / `bazer-fire` (badge) | `design` | ดีไซน์ใหม่ใช้ permission + Plannotator ก่อน; เขียนเมื่อ probe พิสูจน์ว่ามีช่องรั่ว |
| PSTACK skills adapt เป็น OpenCode | `raw` | 53 ไฟล์ยังเป็นต้นฉบับ Cursor; มี `ADAPT-OPENCODE.md` ระบุ 5 จุด |
| macOS / Linux | ว่าง | ผู้ใช้กำหนดให้ทำเมื่อมีเครื่องจริง |
| lock.keybinds | เก็บ flag เท่านั้น | การเตือนคีย์ยังไม่ทำ |
| ด่าน "ห้ามเขียนก่อนอนุมัติ" | ระดับ prompt | ยังไม่มีตัวบังคับฮาร์ดแวร์ (เดิมเป็นปลั๊กอิน) |
| ทดสอบ UI ในเบราว์เซอร์จริง | ยังไม่ได้เห็นภาพ | ตรวจได้แค่ parse + action id + API ทุกเส้น |
| `install-tools` โหมดติดตั้งจริง | ไม่ได้รัน | กลัวไปติดตั้งของในเครื่องผู้ใช้ |
| slash command | ไม่มีโดยเจตนา | ใช้ `Shift+Tab`; เกณฑ์ก่อนเพิ่มอยู่ใน §13.5 |

---

## 20. บทเรียนที่ฝังไว้ในระบบ

| บทเรียน | ฝังที่ |
|---|---|
| กฎที่ไม่มีตัวบังคับ = ไม่มีกฎ | `law.json` + `law.mjs` + ปุ่มตรวจกฎ |
| คีย์ที่ไม่มีจริงจะเงียบ ไม่ error | `selftest` ตรวจ policy/agent กับ whitelist action |
| "มีไฟล์" ≠ "ทำงาน" | สถานะ `broken` + probes |
| เอกสารโกหกโมเดลได้ | GUIDELINE: ทุก path/ปุ่มที่อ้างต้องมีจริง + เทสต์ UI↔actions |
| `.bak` เกลื่อน = ไม่มีใครกล้าลบ | R4 + backup ไป `var/backups` |
| mirror ทำให้ต้อง sync ตลอด | ตัดทิ้ง ใช้ subagent จริง |
| `display` ทับ `[hidden]` | `[hidden]{display:none!important}` + เทสต์ CSS |
| PowerShell 5.1 อ่าน .ps1 ไม่มี BOM เป็น ANSI | script ใน `02SHORTCUT` เป็น ASCII ล้วน |
| ไฟล์ระบบของผู้ใช้ไม่ควรถูกจัดการแบบคาดเดา | ทุกอย่าง backup + quarantine + rollback |

---

## 21. คู่มือใช้งานเร็ว

### เปิด Console
```
ดับเบิลคลิก SETUP\MAJOR\BAZERCONSOLE\03WINDOWS\BAZER CONSOLE.vbs
```
หรือสร้างทางลัด:
```powershell
powershell -ExecutionPolicy Bypass -File ".\02SHORTCUT\create-desktop-shortcut.ps1"
```

### ตรวจเครื่อง
```powershell
node "BAZERCONSOLE\01MAIN\ACTIVE\SERVER\tools\selftest.mjs"
node "BAZERCONSOLE\01MAIN\ACTIVE\SERVER\tools\apitest.mjs"
```

### เปลี่ยนระดับเหมาเข่ง
`โหมด & สิทธิ์` → กดขั้น → ยืนยัน → เปิด OpenCode ใหม่

### เปลี่ยน model/effort
`ตั้งค่า → Quick Access` (4 โหมด) · `โหมด & สิทธิ์` (ARENA) · `ตั้งค่า → PSTACK roles` (15 role + preset)

### ย้อน
`ประวัติ` → ย้อนรอบนี้ · หรือ `ย้อนระดับก่อนหน้า` ที่บันได

### Commit format
```
<วลีสั้นมาก> <emoji>: <วลีอธิบายยาวขึ้น>
```

---

## 22. ลำดับเหตุการณ์ (chronology)

| ลำดับ | สิ่งที่เกิดขึ้น | ผลลัพธ์ |
|---|---|---|
| 1 | อ่านบริบทของเก่า (`SETUP/OPENCODE`) + สเปก pStack | สรุปว่าของเก่าพังเพราะไม่แยกข้อมูล/โปรแกรม |
| 2 | ตอบคำถาม 3 ข้อ (ไฟล์/โฟลเดอร์, กลไก Console, UX/UI) | ดีไซน์ตั้งต้น + คำถามค้าง |
| 3 | ตรวจของจริง (permission schema, hidden, config merge) | 5 ข้อเท็จจริงที่เปลี่ยนดีไซน์ |
| 4 | ผู้ใช้อนุมัติ + กำหนดโครงจากดิสก์ | เริ่มสร้างจริง |
| 5 | สร้าง GUIDELINE ทุกโฟลเดอร์ + MANIFEST + SERVER + UI | ระบบรันได้ใน sandbox |
| 6 | เขียนไฟล์โหมด 4 + subagent 4 + subsubagent 2 | ครบ 10 ไฟล์ agent |
| 7 | คัดลอก PSTACK 53 skill + บันทึก ADAPT | `status: raw` |
| 8 | ตั้งไอคอน (`BAZERCONSOLE.ico`) ทั้งโฟลเดอร์และทางลัด | ทางลัด Desktop + `desktop.ini` |
| 9 | bug scan 5 รอบ | แก้ 13 จุด + เทสต์ 76 ข้อ |
| 10 | ผู้ใช้เจอ modal ว่าง + ปุ่มไม่ทำงาน | แก้ CSS `[hidden]` (บั๊กเดียวกับปุ่ม) |
| 11 | เพิ่ม cleanup / reset template | เคลียร์ของเก่าได้โดยไม่ลบถาวร |
| 12 | เขียน LOGS.md (ไฟล์นี้) | บันทึกครบทั้งแชท |

---

## 23. ดัชนีไฟล์สำคัญ

| อยากรู้เรื่อง | ไปที่ |
|---|---|
| กฎแม่ + "ทำแบบนี้พังแน่" | `MAJOR/GUIDELINE.md` |
| สัญญาของ MANIFEST (ลึก) | `BAZERCONSOLE/01MAIN/PASSIVE/01MANIFEST/README.md` |
| ประวัติการแก้ | `.../01MANIFEST/CHANGELOG.md` |
| ที่อยู่ไฟล์ทั้งหมด | `.../01MANIFEST/manifest.json` |
| บันไดเหมาเข่ง | `.../01MANIFEST/policies.json` |
| ปุ่ม + ความเสี่ยง | `.../01MANIFEST/actions.json` |
| ข้อพิสูจน์ | `.../01MANIFEST/probes.json` |
| กฎ R1–R4 | `.../01MANIFEST/law.json` |
| บทบาท/โฟลว์ | `AGENT/01PRIMARY/*.md` |
| dependency + flow | `DOCS/FLOW.md` |
| ใช้แบบ non-code | `DOCS/GUIDE.md` |
| โค้ด Console | `BAZERCONSOLE/01MAIN/ACTIVE/SERVER/*.mjs` |
| หน้าจอ | `BAZERCONSOLE/01MAIN/ACTIVE/UI/*` |

---

## ภาคผนวก A — สรุปคำตอบของ "OUR SPEC FOR APPLYING REAL SYSTEM FILE"

1. **เรียกยังไง:** `manifest.json` = รายการเดียวของทุกอย่าง; Console อ่าน → คำนวณ `plan` → `apply`
2. **เช็คของครบ/ไม่ครบยังไง:** 5 สถานะ (`ok` `stale` `missing` `foreign` `broken`) + `design`/`raw`; ตรวจ hash จริง + probe กับ OpenCode จริง
3. **APPLY จริงยังไง:** backup → atomic write → อ่านกลับเทียบ hash → history; พัง = rollback ทั้งรอบ; รันซ้ำ = ไม่เขียนอะไร
4. **ของเก่าทำไมต้องมีที่ไป:** `quarantine` (ย้าย ไม่ลบ) + `quarantine.json` + `reset-template`

## ภาคผนวก B — ตัวเลขสรุป

| ตัวเลข | ค่า |
|---|---|
| ไฟล์ใน MAJOR | ~200 ไฟล์ / ~960 KB |
| primary modes | 4 |
| subagents (+sub-sub) | 4 + 2 |
| skills (PSTACK) | 53 |
| manifest entries | 21 |
| actions | 19 |
| probes | 8 |
| law rules | 4 |
| ladder levels | 5 |
| tests (selftest + apitest) | 33 + 43 = 76 |
| bugs found in 5 loops | 13 |
| ไฟล์ agent ที่เขียนใหม่ | 10 + 18 GUIDELINE |
