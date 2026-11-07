# μ — Implementation Plan

**Project:** μ (Greek lowercase mu, U+03BC) — a coding agent built as a maintained fork of Pi  
**Document type:** Execution-ready engineering roadmap and coding-agent handoff  
**Baseline date:** 2026-11-07  
**Status:** PROPOSED / NEW START — no μ implementation has been accepted  
**Starting repository:** `/home/user/projects/mu`  
**Development branch:** `feat/mu`  
**Current starting commit:** `3893edf14f81879e84152b099381b430ae53925a` (user-confirmed; previous observed baseline: `085c84e98e7f4c950f2be606466fff4f75d8fe7c`)
**Git remotes:** `origin = https://github.com/VarunGaikwad/mu.git`, `upstream = https://github.com/earendil-works/pi.git`

> This is a new implementation, **not** a continuation of previously reported M02/M05 or Phase 1–3 work. All earlier claims of completed μ features and test evidence are historical. Confirm the current repository state before each milestone. Nothing in this plan grants execution permission, proves security, or authorizes Git writes.

## A. Product contract

μ is a practical, model-configurable coding agent featuring:

1. **Adaptive planning:** small jobs stay small; complex work becomes a validated, execution-ready task DAG with explicit scopes, dependencies, checks, and rollback requirements.
2. **Plan-to-execution handover:** users can review an immutable plan and choose **Approve & Start Code**, **Approve & Start Orchestrator**, **Request Changes**, or **Save for Later / Cancel**.
3. **Separate controls:** **Agent** (`ask`, `plan`, `code`, `debug`, `orchestrator`), **Permission** (`read-only`, `workspace-write`, `danger-full-access`), **Approval policy** (`on-request`, `never`), **Autonomy** (`supervised`, optionally `let-it-run`), and **View** (including menu layout). View cannot change authority.
4. **Truthful security:** host-owned authorization and tool enforcement; scoped guarded file operations; explicit, accurately labeled **UNSANDBOXED** command consent. No false OS-sandbox promises.
5. **Strict file operations:** fresh-read/stale-content checks; exact-first unique matches; only CRLF/LF and trailing-whitespace fallback; explicit `replace_all`; atomic mutation; minimal diffs, original bytes/encoding/BOM/line endings preserved outside the exact edit range.
6. **Configurable models and UI:** per-role model selection, no silent fallback; vertical/horizontal/auto menus, vertical default; safe terminal and cross-platform handling.
7. **33 requested tool contracts:** distinct name/schema/behavior/availability tests built on a small number of shared host services.
8. **Multi-agent execution:** bounded host-owned agent lifecycle, message bus, approved task scopes, DAG orchestration, sequential writers first; **separate Git worktrees are mandatory before parallel writers**.
9. **Recovery and operations:** task-owned checkpoints/undo, fixed checks, bounded background jobs, safe documentation fetching, and reviewed Pi upstream synchronization.
10. **Stable release:** `main` mirrors Pi; `feat/mu` is the development branch; `deployment` receives only approved, tested releases.

### Naming decision: μ is the brand, `mu` is the portable ASCII technical identifier

- Display name, headings, launch/banner and UX: **μ** (U+03BC; do not confuse with micro sign `µ`, U+00B5).
- Use `mu` for CLI executable, source directories, branch names, environment prefix (`MU_`), and on-disk configuration directory (`.mu`) when rebranding is implemented and migration is tested. Never require Unicode input to launch the CLI.
- Treat rename/package/config migration as its own tested milestone. Do not sweep-replace upstream `pi` identifiers or break plugin compatibility for cosmetic branding. Inspect actual `piConfig` and package conventions first.

## B. Nonnegotiable development rules

1. **Start every milestone with a read-only audit:** `git branch --show-current`, `git rev-parse HEAD`, `git status --short`, inspect relevant existing source/tests and document verified findings. If the checkout differs, update this plan and stop before making assumptions.
2. **Do not commit, push, create/delete branches or worktrees, merge, rebase, deploy, reset, clean, stash, or overwrite unrelated changes without explicit authorization.** Implementation edits inside an approved milestone are separate from Git publishing authority.
3. **Protect upstream:** keep `main` fast-forward-only and free of μ feature commits; use `feat/mu` for implementation; integrate Pi through isolated, reviewed candidates. Never auto-deploy upstream changes.
4. **No security by UI, prompt, tool visibility, extension hook, model text, or project settings.** Protect privileged effects at host/core execution and mutation boundaries. Deny unknown/unverified paths.
5. **No false containment:** a shell running with the user's account, even with an approved cwd or task path, can access files outside the workspace absent real OS containment. Git worktrees are not sandboxes. Never call this `sandboxed` or `workspace-confined`.
6. **No privilege escalation from unavailable user provenance.** F3 approval-origin and child/control-channel isolation are an independent deployment gate. A same-user child, shared TTY or environment spawn marker is not automatically trusted.
7. **No paid provider tests by default.** Use deterministic fixtures and faux-provider tests. Use focused test suites; do not invoke full `npm test` without approval.
8. **Record factual evidence, not aspirations:** tests executed, actual pass/fail, OS tested, limitations, exact files changed, and untested risks. `npm run check` may rewrite files: inspect pre/post diffs and preserve unrelated changes.
9. **Security feature flags default OFF** until the specific positive and negative tests pass on supported host platforms.
10. **Change source sparingly:** prefer μ-owned modules/adapters while putting mandatory enforcement at genuine Pi host/core execution boundaries. Keep a ledger of deliberate upstream-file changes.

## C. Security architecture and release gates

### C1. Permission and consent model

| User mode | Host file tools | Arbitrary shell and project-defined checks | Lifetime |
| --- | --- | --- | --- |
| `read-only` | Authorized read/list/search only | Not inherently read-only; blocked unless a demonstrably nonmutating host tool or separately authorized trusted-local action | Default for new/untrusted workspaces |
| `workspace-write` | Strict, verified scoped edits through host mutation boundary | Not workspace-confined without an OS sandbox; blocked or explicit **UNSANDBOXED trusted-local** per-session consent | Trusted workspace, still subject to approval |
| `danger-full-access` | Broad authority limited by actual OS-account rights | **UNSANDBOXED**, potentially affects arbitrary user-accessible files/network/credentials | **Fresh explicit confirmation every session**, never persistent |

- `approvalPolicy = on-request | never`; `never` means **deny what is not already authorized**, never silent elevation.
- `Allow once`, `Allow for this session`, `Always allow for this workspace`, `Deny`. Persistent grants are only for narrow, actually enforceable operations; do **not** persist broad shell authority or full access. Persistent grant storage requires verified protection against same-user child processes; otherwise disable it.
- Distinguish `guarded-tool`, `unsandboxed-user-approved`, `blocked`, and, only if independently verified, `sandboxed`.
- UI Agent/Permission/Autonomy transitions require user-origin verification. Tool-generated slash commands, plan prose, scripts, RPC injection and extension messages are not a user decision. Bind any privileged prompt to one-time IDs, session, exact action, current plan revision and task scope; reject replay/stale decisions.
- A user explicitly selecting unplanned `code`/`debug` is a separate project-wide fast path **within actual host policy**; it never silently authorizes unsandboxed shell or bypasses protected paths. Builder delegation always requires an approved plan/task scope.
- Headless without verifiable user authorization blocks approval-dependent operations. Do not treat a nested agent's public launch flag as secure provenance.

### C2. Independent security acceptance flags

Track independently in `docs/mu/security-gates.md`:

| Gate | Initial state | Meaning of `VERIFIED` |
| --- | --- | --- |
| `USER_ORIGIN_VERIFIED` | BLOCKED | Same-user child/TTY/RPC negative tests cannot forge decisions on the claimed OS/mode |
| `DIRECT_FILE_READ_VERIFIED` | BLOCKED | Guarded reads enforce actual scope and protected paths |
| `DIRECT_FILE_WRITE_VERIFIED` | BLOCKED | Positive in-scope writes and negative link/race/escape cases pass at host mutation boundary |
| `WORKER_CONTROL_ISOLATION_VERIFIED` | BLOCKED | Children cannot inherit or reach privileged control/approval handles |
| `UNSANDBOXED_COMMAND_CONSENT_VERIFIED` | BLOCKED | Accurate risk disclosure and verified per-session user decision precede execution |
| `CHECK_TRUST_VERIFIED` | BLOCKED | Fixed effective command fingerprints and change/first-use approvals enforce correctly |
| `PARALLEL_WRITERS_VERIFIED` | BLOCKED | Worktree ownership, integration, rollback, and applicable security gates pass |
| `PRODUCTION_READY` | BLOCKED | Release acceptance, cross-platform evidence and explicit promotion complete |

**F3 fallback:** When verifiable user-origin or same-user child-control isolation cannot be provided, ship only safe, nonprivileged guarded functionality and directly selected actions whose authority can truly be established. Keep interactive privileged approval, unsandboxed execution, and full autonomy **disabled** on that mode/platform. A consent dialog is not a substitute for provenance.

## D. Milestone sequence (dependencies are normative)

| ID | Deliverable | Requires | Exit criterion |
| --- | --- | --- | --- |
| **μ-00** | Repository baseline, Git rules, evidence ledger, test map | None | Clean branch/source snapshot; paths and test commands identified; no code changes assumed |
| **μ-01** | Identity and compatibility shell | μ-00 | μ display name with portable `mu` technical naming decision and migration tests; Pi extension compatibility retained |
| **μ-02** | Immutable plan/todo/session/scope foundation (Phase 1a) | μ-00 | Hash-bound immutable revisions, branch-correct replay, bounded todos, exact-file/subtree scopes, focused tests |
| **μ-F3** | Host user-origin and same-user child feasibility spike | μ-00 | Platform-by-platform exploit/negative-test result; supports or blocks each privileged workflow |
| **μ-03** | Per-role model router/settings | μ-00 | Validated catalog, deterministic routing, settings round-trip, TUI selection and missing-model behavior |
| **μ-04** | Adaptive planner and structured DAG | μ-02, μ-03 | Tiny/standard/complex fixtures; no invented paths; DAG/schema validation; immutable revision generation |
| **μ-05** | Debug workflow | μ-00 | Reproduce → failing test (or documented infeasibility) → minimal fix → verified checks |
| **μ-06** | Strict safe-edit and compact output | μ-00 | Fresh-read/match/race/encoding tests, tight output budgets and byte-preserving diffs |
| **μ-07** | TUI vertical/horizontal/auto menus | μ-00 | Full first-party menu inventory; default vertical; focused keyboard/mouse/resize/Unicode tests |
| **μ-08** | 33-tool contract inventory + nonprivileged adapters | μ-00, μ-02 | Exact 33-name ledger; semantic tests; unsupported privileged/provider tools advertise unavailable reasons |
| **μ-09** | Authenticated host controls (Phase 1b) | μ-02, μ-F3 | Fail-closed RPC/TTY command provenance, host-first dispatch, anti-replay and native negative tests |
| **μ-10** | Host execution/mutation enforcement (Phase 1c) | μ-09, μ-06 | All execution edges guarded; verified direct-file writes and protected paths; unknown edges deny |
| **μ-11** | Permission modes, grants and command consent (2a/2c) | μ-09, μ-10, μ-F3 | Once/session/permitted narrow persistent grants; truthfully unsandboxed execution; process/time/output limits |
| **μ-12** | Fixed `run_checks` and check trust (2b) | μ-11 | Fixed names only; effective command approvals, fingerprints, script-change invalidation; no disguised read-only execution |
| **μ-13** | Plan Review → Code handover | μ-04, μ-10, μ-11 | Authenticated approval of exact revision and scope; one-time handover; safe direct Code fast path |
| **μ-14** | Task-owned checkpoint/undo | μ-06, μ-10 | Undo only task-owned changes; preserves dirty/staged/untracked/intervening changes |
| **μ-15** | Sequential authorized builders | μ-12, μ-13, μ-14 | No overlapping writers; approved task scopes and check/test-change tripwires; child-control safety |
| **μ-16** | Agent lifecycle + message bus | μ-09, μ-08 | Managed IDs, bounded messaging/cursors/threads, cancel/cleanup, no inherited approvals; read-only parallel agents first |
| **μ-17** | Worktree manager + safe integration | μ-14, μ-16 | Per-task worktree ownership, base tracking, conflict preservation and integration/rollback tests |
| **μ-18** | DAG orchestrator | μ-04, μ-15, μ-16, μ-17 | Topological scheduling, model assignment, bounded retries and verified sequential writer delegation |
| **μ-19** | Concurrent writing agents | μ-17, μ-18, security gates | Separate worktrees and reviewed integration; no false shell containment; stays disabled until accepted |
| **μ-20** | Deferred autonomy and remaining integrations | μ-12, μ-14, μ-18, security gates | Let-it-run, jobs/docs/provider features tested independently; denied by default where unverifiable |
| **μ-21** | Cross-platform release and deployment | Product milestones and required gates | Verified Linux/native Windows/macOS evidence; isolated Pi integration; explicit `deployment` promotion |

**Parallelism policy:** μ-02 and the μ-F3 investigation can proceed independently. μ-03/05/06/07 and nonprivileged μ-08 are separate feature tracks; sequence implementation work to avoid touching the same upstream-owned files concurrently. The numbering does **not** authorize running dependent security-sensitive features early.

### μ-00 — Baseline, ledger and branch protocol

**Actions:** inspect `AGENTS.md`, `package.json`, Pi configuration, tool registry, extension and session APIs, the source and focused-test harness, `git status`, remotes/branch refs. Establish `docs/mu/architecture.md`, `docs/mu/milestones.md`, `docs/mu/security-gates.md`, `docs/mu/upstream-overrides.md`, and `docs/mu/test-matrix.md` only when code edits are explicitly authorized. Record baseline commit and unknowns. No assumption that earlier Phase 1a/M02/M05 files survive.

**Exit:** one reproducible source snapshot; repository and test conventions recorded; first milestone self-contained; no changes published.

### μ-01 — Brand and packaging

**Actions:** audit `piConfig` metadata and configuration directory behavior; introduce user-facing **μ** identity with ASCII `mu` entry point and migration plan; inventory executable/package/config/state/env references; maintain compatibility aliases only when justified. Preserve existing Pi commands/behavior until an intentional versioned migration. Avoid hardcoding display glyph in machine contracts.

**Exit:** smoke tests for CLI help/version, config resolution, Unicode title rendering, packaging and both supported input modes; no broken Pi extension APIs.

### μ-02 — Plan store, todos and scopes

**Suggested μ-owned modules:** `packages/coding-agent/src/core/mu/{plan-store,session-state,path-scope}.ts`; focused `packages/coding-agent/test/mu-*.test.ts`.

**Actions:** bounded todo entries (`pending`, `in-progress`, `done`); immutable content-addressed revisions stored outside repo; explicit session entries holding plan pointers and todo transitions; replay **active branch** on resume/branch/compaction; parse canonical exact-file vs directory/subtree scopes and reject traversal, siblings, symlinks and unsupported targets. Define collision/race test fixtures; this milestone builds **representations only**, not a production write boundary. Approval records remain memory-only and are not part of session replay.

**Exit:** hash corruption rejected; branch-from-old-point restores its own revision; compaction doesn't invent authority; tests for stale/invalid scopes pass; no privileged transitions exposed.

### μ-F3 — Provenance feasibility and threat model

**Actions:** map interactive host, RPC, TTY/stdin/control handles and child-process inheritance; prototype a host-first dispatcher and denial fixtures; attempt same-user child injection of slash commands, approval responses, stale IDs, sibling session tokens and terminal input. Test Linux, native Windows and macOS **as separate evidence**, with WSL2 where supported. A per-process RPC token alone is not proof against a model-controlled same-user process unless its protected bootstrap/handles withstand the threat model. Do not log secrets or put them in argv/env/session files.

**Exit:** written platform/mode decision matrix and negative-test output; unsupported approval paths permanently fail closed pending an improved design. This is a gate, not a commitment to a particular OS sandbox backend.

### μ-03/04 — Model router and adaptive planner

- Role model keys: `ask`, `plan`, `code`, `debug`, `orchestrator`, `compaction`, `subagent`, `smallTask`; optional child role overrides. Resolve only installed provider/model IDs with required tool/context support; visible error or user-approved fallback, never silent substitution. UI preference lives in normal user `settings.json`, separate from grants.
- Planner classifies `minimal | standard | complex` by dependencies, risk, uncertainty, verification and expected work, not prompt length. Complex plans define stable task IDs, `depends_on`, risk/priority, allowed exact-file/subtree paths, protected file exceptions, outputs, definition of done, checks, agent/model hints, integration and undo needs.
- Missing facts become `needs_discovery`; cycles, missing references, implicit scope expansion and unbounded graphs are invalid. A plan revision is **proposed**, not approved, until authenticated user action occurs.

**Exit:** deterministic three-size fixtures, failed-invalid-DAG fixtures, model/settings round-trips and preview of full approval scope.

### μ-05/06 — Debug, safe editing and output

- Debug mode follows evidence → regression test or documented infeasibility → smallest change → verification. Never report a check as run if not executed.
- Edit tool requires successful user-visible read and current whole-file hash at the **mutation boundary**; a grep preview doesn't authorize edits. Exact-first, unique nonoverlap matches; normalized fallback **only** line endings and trailing whitespace; `replace_all` explicit and overlap-aware. No smart punctuation/NFKC/dash/space transformations, no silent fuzzy similarity.
- `widenReplacementsToLines` must not leak normalization into unmodified parts of an affected line. Replace exact original ranges and preserve bytes elsewhere; keep encoding/BOM/endings, reject unsupported encodings; test concurrent mutation and consecutive edits.
- Proposed starting budgets: `read` 400 lines/16 KiB, `grep` and `bash` 200 lines/8 KiB. `read`/`grep` keep head, command output keeps tail; report shown/omitted counts and cursor/log reference; unknown omitted counts are labeled unknown.

**Exit:** focused regression suite covers `"aaa"` versus `"aa"` overlapping starts, NFKC/punctuation differences, line-ending normalization, stale files, replace-all overlaps, BOM/encoding, partial-line preservation and truncation.

### μ-07 — Menu orientation and View

- User preference `tui.menuLayout = vertical | horizontal | auto`, default vertical. A single shared `MenuLayout` type/selection primitive controls first-party single-choice menus, settings, host `ctx.ui.select`, model selectors and μ control selectors; third-party custom widgets explicitly opt in.
- Horizontal focused Left/Right navigation, Enter confirm, Escape cancel; preserve Up/Down in vertical menus; retain search, ID-based selection, submenu focus, ANSI/CJK/emoji width, mouse x/y hit-testing and resize behavior at 40/60/80/120+ columns.
- Never clip approval details or change permission/model/autonomy merely by changing orientation. RPC `ctx.hasUI` is not proof of an interactive terminal.

**Exit:** audited menu inventory and component/regression tests; UI-only change with no new execution effects.

### μ-08 — Exactly 33 requested tool contracts

Inventory and write one versioned schema and test for **each distinct name**; avoid reimplementing Pi runner/tool logic. Fix the old plan's corrupted row 4: it is **`apply_patch`**.

| Shared service | Requested names |
| --- | --- |
| Command/process session | `shell_command`, `exec_command`, `write_stdin` |
| Scoped files/search/images | `apply_patch`, `view_image`, `glob`, `grep` |
| Plan/task state | `update_plan` |
| Agent lifecycle | `spawn_agent`, `send_input`, `followup_task`, `wait_agent`, `resume_agent`, `close_agent`, `interrupt_agent`, `list_agents` |
| Messages and channels | `send_message`, `create_channel`, `get_channels`, `list_threads`, `search_posts`, `read_thread`, `read_post`, `subscribe`, `unsubscribe`, `post` |
| Host UI/permissions | `request_user_input`, `request_permissions` |
| Host utilities | `get_context_remaining`, `current_time` |
| Provider and notification | `web_search`, `image_generation`, `push_notification` |

**Contract rules:** role-aware capability discovery, exact semantics (IDs, streams, paginated results, cancellation), bounded inputs/outputs, stable error/denied/unavailable reasons. Visibility is never authorization. No claim of “33 working tools” before each tool's own runtime evidence. Shell/agent/network/provider tools are not enabled by the nonprivileged catalog milestone.

### μ-09/10 — Authenticated host/core boundary

- Authenticate privileged dispatch **before** extension slash commands, not only via `input` hooks. Bind every RPC/UI response to session, revision, action, scope and single-use prompt ID. Deny wrong/missing/stale/replayed/cross-session responses.
- Inventory mandatory enforcement points: direct `read`/`edit`/`write`, `apply_patch`, shell/bash/PowerShell, interactive shell, `pi.exec`, fixed checks, codemode/nested calls, MCP, extensions, subagents and background jobs. Unknown mechanisms deny. In-process extensions require their own trust assessment because they may already have host privileges.
- For file operations, enforce canonical scope and protected paths at the **actual write/commit boundary**, using native-safe primitives or honestly weaker guarantees. Race/ancestor swaps, symlinks, hard links, special paths and case behavior are negative tests. Positive allowed writes do not ship until these pass on the claimed platforms.
- Strict scoped arbitrary shell stays blocked without independently verified containment; user-approved trusted-local unsandboxed execution is a different contract.

**Exit:** denial by default and positive authorized cases (when truly supported), across real direct and nested execution edges, with no side effects before approval.

### μ-11/12 — Permissions, command runner and fixed checks

- Expose mode, approval duration/revocation and per-session danger confirmation; no default persistent grants. Use a host-owned grant store only when the same-user threat model is satisfied, otherwise keep durable grants disabled.
- Safe command allowlist only for tightly verified nonmutating argv/executable/config combinations; ordinary tests/builds/`tsc --noEmit` are not inherently read-only. Classify Normal and Dangerous as an additional guardrail, not an OS security boundary. Require exact command/cwd approval for risky actions, with cancellation and audit.
- Command default timeout 120s, hard maximum 600s, including host-config validation. Ensure process-tree termination, bounded output/streaming and detached-descendant tests on each claimed platform.
- `run_checks` accepts only `typecheck | lint | test`, derives the effective executable/args/cwd/script/config fingerprint from trusted sources, rejects agent command injection, seeks first-use/change approval, and reports pass/fail/counts/unknowns honestly. A changed test script requires fresh consent. When no OS sandbox exists, display **UNSANDBOXED** and ask for separately authenticated session consent.

**Exit:** no unauthorized execution; explicit session expiry; cross-platform process cleanup; stale check fingerprints denied; no silent elevation on `never`.

### μ-13 — First shippable product: plan review and handover

Automatically show a review surface after `plan` creates an execution-ready revision:

1. **Approve & Start Code:** authenticates and freezes exact revision/hash, scope, constraints and verification; starts single-agent Code under actual permission policy.
2. **Approve & Start Orchestrator:** same contract, **disabled until μ-18** and its security gates are ready.
3. **Request Changes:** creates a new revision, invalidates prior approval and re-renders the diff and scopes.
4. **Save for Later / Cancel:** saves plan metadata, **not** permission authority.

**Exit:** no agent/self-switch or prompt-text approval; one-time handover; correct resume/branch approval invalidation; clear denial when F3 is unsupported. This is the first usable μ release candidate, not automatically a production release.

### μ-14/15 — Checkpoints, undo, sequential builders

- Track task-owned before/after data. Undo only if current state equals recorded post-state; preserve user dirty/staged/untracked edits and later modifications; do not broad reset/checkout/stash. Remote effects cannot be undone.
- Sequential writer tasks use exact approved structured scopes, guarded file tools, restricted child lifecycle and clear command consent; block nested delegation and installs in v1 builders. Host orchestrator/verification owns fixed `run_checks` after each task; pause next writer until checks finish.
- Compare staged/unstaged/untracked changes with the **task-start baseline**. Flag touched tests; fail unauthorized `.only`, skip or deletion changes; distinguish pre-existing effects. Post-run diff inspection is a tripwire, not an unsandboxed command sandbox.

**Exit:** dirty-state-preserving rollback, no overlapping writer tasks, bounded summaries and honest failures on ambiguity.

### μ-16/17/18/19 — Agent manager, bus, worktrees and DAG

- **Lifecycle:** host-created agent IDs, parent/task/model/scope/status, time/cost/context budgets, cancellation, interruption, close, resume with fresh authorization and process cleanup. Agent messages are **untrusted work data**, never user permission.
- **Message bus:** host-mediated bounded channels, thread/post IDs, sender identity, retention quotas, subscriptions/cursors/pagination and visibility checks. Keep `send_input` distinct from `send_message`.
- **Worktree foundation:** per-task branch/worktree/recorded base and ownership; isolate update worktrees from agent worktrees; preserve dirty original tree. Inspect conflicts/test changes before integration; never delete an unintegrated worktree automatically.
- **Orchestrator:** consume an approved immutable DAG, schedule ready tasks topologically, assign workers/models inside user policy, verify, retry with caps, and request (but never self-approve) revisions. Start with parallel read-only research and **sequential** writing.
- **Parallel writers (separate gate):** require separate per-writer Git worktrees, proved ownership, robust integration, rollback, combined regression tests, appropriate permissions and OS-specific evidence. If unavailable, serialize or block; multiple worktrees alone do not prove isolation or security.

**Exit:** deterministic scheduler fixtures; crash/replay/cancel tests; no stale scope or approval inheritance; conflicts preserve work; no task outside approved plan.

### μ-20 — Deferred capabilities

- **Let-it-run:** disabled by default. May waive specified approval prompts only after authenticated user origin, strict edit and checkpoint gates, execution limits and explicit acknowledgment of unsandboxed risks. Session-only, never restored. A nested agent/public launch flag cannot enable autonomy merely by running a shell command. If anti-forgery cannot be proved, keep disabled.
- **Background jobs:** session-owned IDs, same consent/policy as foreground execution, bounded concurrency/lifetime/logs/cursors and process-tree cleanup on session end; no background bypass.
- **Documentation fetching:** HTTP(S) only, enforce public-address/DNS/redirect checks including rebinding and SSRF controls, content-type/size/time caps, source/version attribution and untrusted-content handling.
- **Remaining integrations:** provider web search, image generation, desktop notifications only when available and permitted, with clear unavailable behavior; no implicit arbitrary `curl` substitution.

**Exit:** independent component/native tests and explicit feature availability flags; never block first usable single-agent release solely for optional integrations.

### μ-21 — Upstream updates, acceptance and deployment

1. Fetch and verify Pi upstream; fast-forward clean `main` only after review.
2. Create isolated `sync/pi-<revision>` candidate from reviewed μ state, merge upstream there and inspect conflict/security impact.
3. Run affected targeted suites, build, full approved release checks, and native Linux/Windows/macOS acceptance (plus WSL2 if supported). **A successful Git merge is not acceptance**.
4. Record included Pi and μ commit hashes, security gates, schema/API compatibility, and release artifact provenance.
5. Create a release candidate and promote to `deployment` only after explicit authorization. Never auto-promote unfinished μ work or overwrite an active worktree.

**Exit:** reproducible release evidence, rollback to known-good tag, `main` still clean upstream mirror, `feat/mu` retains ongoing development, and `deployment` reflects an approved μ release.

## E. Test and evidence discipline for every milestone

For each milestone produce a compact evidence record:

```text
ID / status: NOT STARTED | IMPLEMENTED | VERIFIED-LOCAL | VERIFIED-NATIVE | BLOCKED | ACCEPTED
Base commit / branch / dirty state:
Files added or changed (owned vs inherited):
Feature flags / security gates affected:
Tests run (exact command, OS, result):
Tests not run (and why):
Before/after diff integrity and unrelated-file preservation:
Remaining attack/edge cases and blockers:
Decision requested from the user:
Commit/push/deployment: NONE unless independently authorized
```

Verification minimum: focused unit and faux-provider tests; run each added/changed test; targeted integration/host test if a boundary changed; review modifications before and after any formatter or mutating check; build when package tests require it. Follow the checkout's `AGENTS.md` and test harness. Treat local simulated tests as **local only**; native cross-platform acceptance remains separate. No full suite, paid model call, or system-changing install without authorization.

## F. First coding-agent assignment — μ-00 then μ-02

> **You are implementing μ, a new coding agent fork of Pi. The visible name is the Greek letter `μ`; portable source and CLI identifiers use `mu`. Start at `/home/user/projects/mu`, branch `feat/mu`, current starting baseline `3893edf14f81879e84152b099381b430ae53925a`. All previously reported μ feature work is gone; do not claim any prior implementation completed.**
>
> 
> 1. Perform **read-only μ-00 reconnaissance**: confirm branch, HEAD, complete dirty state, `AGENTS.md`, runtime session/tool/config APIs, test patterns and target path availability. Report any discrepancy before editing. Do not fetch or alter branches.
> 2. Write a concise implementation slice for **μ-02 Phase 1a only**: bounded immutable `plan-store`, branch-correct `session-state` and canonical scope *representation* with tests. Use repository conventions and minimal upstream-core changes.
> 3. Implement that slice **only when source modification is authorized**. Keep all security-sensitive approval, RPC, shell, privilege transition and builder paths inactive. Do not introduce production grants or falsely claim hard filesystem containment.
> 4. Run focused test files, inspect final diffs and report exact observed results, limitations and native-platform gaps. Do not run the full test suite or real-provider calls unless authorized.
> 5. **Do not commit, push, merge, reset, clean, stash, create/delete branches or deploy** without a separate explicit instruction.
>
> **Stop at the μ-02 acceptance gate.** Do not automatically start μ-03 or security-sensitive phases.

## G. Definition of completion

A milestone is **ACCEPTED** only when code and its contracts exist in the current branch, all named focused tests pass, explicitly required native tests pass, security limitations are truthfully reported, and the user accepts the milestone. **Production ready** additionally requires cross-platform and release gates, explicit authorization, and a reviewed deployment promotion. Unavailable security guarantees are blockers—not boxes to check by rewording the UI.
