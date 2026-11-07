# μ — Coding Agent Development Roadmap

**Project:** μ  
**CLI identifier:** `mu`  
**Foundation:** Pi Coding Agent  
**Development branch:** `feat/mu`  
**Starting commit:** `085c84e98e7f4c950f2be606466fff4f75d8fe7c`

**Starting status:** All μ features are NOT STARTED. Previous implementation and milestone evidence are considered obsolete.

## Development sequence

| Stage | Milestones | Objective |
|---|---|---|
| 0 — Foundation | μ-00–μ-02 | Git architecture, μ identity, immutable plans, todo state and file-scope representation |
| 1 — Security investigation | μ-F3 | Verify genuine-user authorization and prevent child-process approval forgery |
| 2 — Core intelligence | μ-03–μ-05 | Per-agent models, adaptive planning and structured debugging |
| 3 — Tools and interface | μ-06–μ-08 | Strict safe editing, compact output, configurable TUI menus and 33 tool contracts |
| 4 — Permissions | μ-09–μ-12 | Authenticated host control, mandatory enforcement, permission modes and trusted checks |
| 5 — First usable product | μ-13 | Planner → Plan Review → Approve & Start Code |
| 6 — Recovery | μ-14–μ-15 | Checkpoints, safe undo and sequential coding agents |
| 7 — Multi-agent system | μ-16–μ-19 | Agent manager, message bus, Git worktrees, DAG orchestration and parallel writers |
| 8 — Advanced features | μ-20 | Let-it-run, background execution, documentation fetching and provider integrations |
| 9 — Release | μ-21 | Cross-platform acceptance, upstream synchronization and deployment |

## Architectural requirements

**Agent roles:** Ask, Plan, Code, Debug and Orchestrator, with separately configurable models for additional worker and compaction roles.

**Permission modes:** Read Only, Workspace Write and Danger Full Access. Permissions, approvals, autonomy and visual preferences must remain independent.

**Adaptive planning:** Minimal tasks receive small plans. Complex tasks receive validated DAGs with dependencies, file scopes, verification criteria, worker assignments and recovery requirements.

**Multi-agent execution:** Read-only agents may operate concurrently. Writing agents must execute sequentially until individually managed Git worktrees, protected execution boundaries and safe integration are verified.

**Security:** Authorization belongs to host/core. Arbitrary shell execution must never be described as workspace-sandboxed without genuine containment. Privileged actions remain disabled when user-origin verification cannot be established.

**Interface:** Vertical, Horizontal and Auto menu modes, while preserving current Pi functionality and terminal compatibility.

**Git:** Keep `main` as the upstream mirror, `feat/mu` as μ development and `deployment` for approved stable releases.

## First implementation assignment

Start with **μ-00: Repository Audit and Foundations**, followed by **μ-02: Plan Storage, Session State and Path Scope**.

Before implementing anything:

1. Inspect the actual repository, Git status and existing Pi architecture.
2. Identify reusable session, tool, extension and testing infrastructure.
3. Establish the milestone checklist and security acceptance ledger.
4. Implement one small, independently testable milestone at a time.
5. Run focused tests and report real results.
6. Preserve unrelated changes and do not commit or push without authorization.

**First product milestone:** A working μ interface where a user creates an execution-ready plan, reviews its exact scope, approves it and starts Code Mode securely.

**Completion rule:** No feature is considered complete merely because its code exists. Its relevant tests, security boundaries and acceptance criteria must pass.

### μ-00 — Baseline audit
- Status: VERIFIED-LOCAL; no milestone acceptance claimed.
- Branch / base commit: `feat/mu` / `3893edf14f81879e84152b099381b430ae53925a`, user-confirmed starting point. Working tree was clean before the plan baseline edit. The prior baseline differs in repository documentation and instructions; root README and CONTRIBUTING are absent at this commit.
- Plan reference: `docs/plan/mu-implementation-plan.md`, μ-00 and section F.
- Scope and changed files: baseline updated in the plan; this audit record and initial `docs/mu/` architecture, milestones, security gates, upstream overrides and test matrix ledgers. Session branching is available via `packages/coding-agent/src/core/session-manager.ts` (`getBranch`, `appendCustomEntry`, `branch`); tools are assembled in `packages/coding-agent/src/core/tools/index.ts`, extensions register tools through the extension API, and identity/config defaults are in `packages/coding-agent/src/config.ts`. Package configuration uses `.pi` and the `pi` executable. No μ-owned core directory was found during the audit.
- Tests run on Linux x86_64, Node v24.21.0: `npm --workspace @earendil-works/pi-coding-agent test -- test/session-manager/build-context.test.ts` initially failed during import because `@earendil-works/pi-schema` had not been built; `npm --workspace @earendil-works/pi-schema run build` succeeded, and the same focused test command then passed 16 tests. Schema build generated local build artifacts.
- Additional focused test: `npm --workspace @earendil-works/pi-coding-agent test -- test/session-manager/tree-traversal.test.ts test/session-manager/save-entry.test.ts test/session-manager/load-entries.test.ts` on the same host: two files and 14 tests passed; tree-traversal failed at import because generated `packages/ai/src/providers/data/amazon-bedrock.json` is missing. No tree-traversal tests ran on that attempt. A copied installed 1.5.0 model-data set failed `npm --workspace @earendil-works/pi-ai run check:model-data` because a provider file was missing; that temporary copy was removed. `npm run hydrate:model-data` then fetched public model catalogs and generated local ignored data; the model-data check passed and the same three-file test command passed all 45 tests on rerun. Catalog data is generated from live sources, not a reproducible pinned snapshot.
- Further focused test on the same host: `npm --workspace @earendil-works/pi-coding-agent test -- test/session-manager/file-operations.test.ts test/session-manager/migration.test.ts test/session-manager/build-context.test.ts` passed 3 files / 53 tests. These test Pi session behavior, not μ implementation.
- Tests not run / platform gaps: full suite and native Windows/macOS tests not run; the architecture and test inventory is not a complete security audit.
- Security gates: unchanged and unverified; session APIs and tool visibility do not establish authorization or containment.
- Remaining blockers and next authorized step: user approved updating μ-00's no-publication criterion to permit authorized checkpoint pushes. μ-02 slice is outlined in `docs/mu/architecture.md`; its guarantees and tests do not yet exist. No privileged feature is enabled.
- Commit / push / deployment: baseline audit checkpoint authorized for commit and push; no deployment.

### μ-02 — Plan revision foundation
- Status: IN PROGRESS; not accepted.
- Branch / base commit: `feat/mu` / `d7b961cad`.
- Plan reference: `docs/plan/mu-implementation-plan.md`, μ-02.
- Scope and changed files: `packages/coding-agent/src/core/mu/plan-revision.ts` and `packages/coding-agent/test/mu-plan-revision.test.ts` add bounded canonical JSON revision content, domain-separated SHA-256 hashes and corruption/canonical-form verification. The revision is data only and is not connected to runtime controls.
- Tests run on Linux x86_64, Node v24.21.0: `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-plan-revision.test.ts` passed 4 tests; `./node_modules/.bin/biome check packages/coding-agent/src/core/mu/plan-revision.ts packages/coding-agent/test/mu-plan-revision.test.ts` passed after formatting the two task-owned files. Initial Biome check reported formatting differences, then passed.
- Tests not run / platform gaps: full suite, standalone TypeScript build, native Windows/macOS tests and future integration tests not run.
- Security gates affected: none verified; a hash is not approval, authorization, filesystem containment or proof of user origin.
- Subsequent work: `packages/coding-agent/src/core/mu/session-state.ts` and `packages/coding-agent/test/mu-session-state.test.ts` add active-branch plan-pointer and bounded todo replay, with compaction, in-memory reconstruction, invalid-entry and bounds fixtures. No approval state is represented. `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-plan-revision.test.ts test/mu-session-state.test.ts` passed 2 files / 10 tests; targeted Biome check passed after formatting. A first Biome check after a test edit reported formatting and was fixed.
- Typecheck attempts: `./node_modules/.bin/tsc --noEmit -p packages/coding-agent/tsconfig.json` failed because that configuration does not exist. `./node_modules/.bin/tsc --noEmit -p packages/coding-agent/tsconfig.build.json` failed with many unresolved workspace declaration imports (including pi-agent-core, pi-ai, pi-tui) and downstream diagnostics; the package's build config points at sibling `dist` declarations. Subsequently `npm run build` succeeded (including live public model-catalog generation and local build artifacts), and rerunning `./node_modules/.bin/tsc --noEmit -p packages/coding-agent/tsconfig.build.json` passed. The two focused test files then passed again (10 tests).
- Plan-store work: `packages/coding-agent/src/core/mu/plan-store.ts` and `packages/coding-agent/test/mu-plan-store.test.ts` add outside-workspace store selection, exclusive temporary files and non-overwriting hard-link publication, hash validation, bounded reads, corruption rejection and concurrent identical-save fixtures. The store is not an authorization or containment boundary; concurrent adversarial filesystem swaps and crash durability (including directory fsync) are not verified. `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-plan-revision.test.ts test/mu-session-state.test.ts test/mu-plan-store.test.ts` passed 3 files / 15 tests on Linux; targeted Biome check and `./node_modules/.bin/tsc --noEmit -p packages/coding-agent/tsconfig.build.json` passed. An earlier targeted Biome check found import ordering and an earlier typecheck found an unsupported TypeScript parameter property; both were corrected and rerun.
- Scope representation work: `packages/coding-agent/src/core/mu/path-scope.ts` and `packages/coding-agent/test/mu-path-scope.test.ts` add existing-file/subtree representations, lexical membership and rejection of traversal, ambiguous names, type mismatches and symlink components. Scope validation and lexical matching are not a filesystem security boundary; later symlink changes, hard links, case aliases and race escapes are not contained or verified. Targeted Biome check and `./node_modules/.bin/tsc --noEmit -p packages/coding-agent/tsconfig.build.json` passed; `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-plan-revision.test.ts test/mu-session-state.test.ts test/mu-plan-store.test.ts test/mu-path-scope.test.ts` passed 4 files / 18 tests on Linux.
- Storage/session integration: `packages/coding-agent/src/core/mu/plan-session.ts` and `packages/coding-agent/test/mu-plan-session.test.ts` save a plan before appending its pointer, load the selected active-branch revision, reject missing/corrupt data and reject a leaf change during asynchronous operations. Reconstructed-entry tests cover branch selection. The leaf check is not an anti-forgery or concurrency security boundary. `isPathScopeValid` additionally detects deleted or symlink-substituted targets on recheck; it is not an inode identity check or race-safe guard.
- Latest focused verification on Linux: `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-plan-revision.test.ts test/mu-session-state.test.ts test/mu-plan-store.test.ts test/mu-path-scope.test.ts test/mu-plan-session.test.ts` passed 5 files / 22 tests; targeted Biome and `./node_modules/.bin/tsc --noEmit -p packages/coding-agent/tsconfig.build.json` passed.
- Persisted resume: added a real on-disk `SessionManager.create`/`open` fixture that branches to an older revision and restores its plan pointer and todo; `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-plan-session.test.ts` passed 4 tests on Linux; targeted Biome check passed.
- Additional integration fixtures reject a load whose branch changes while storage is awaited and a stored revision that does not match the selected pointer. Latest `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-plan-revision.test.ts test/mu-session-state.test.ts test/mu-plan-store.test.ts test/mu-path-scope.test.ts test/mu-plan-session.test.ts` passed 5 files / 25 tests; `./node_modules/.bin/tsc --noEmit -p packages/coding-agent/tsconfig.build.json` and targeted Biome checks passed on Linux.
- Further store fixtures: `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-plan-store.test.ts` passed 8 tests on Linux, including concurrent readers during publication, rejection of a different valid revision at the expected hash filename, and snapshotting a caller-mutated object. Targeted Biome and package typecheck passed. These are deterministic local fixtures, not a SHA-256 collision or hostile filesystem race proof.
- Stale-scope follow-up: `PathScope` now records the observed target device/inode as decimal strings, rejects unavailable inode identity and rechecks it. A Linux test detects same-kind replacement while preserving the old inode; JSON round-trip and missing/tampered identity are covered. This supersedes the earlier note that no identity check existed. Inode reuse, hard links, ancestor swaps, content changes and check/use races remain unprotected; identity is a hint, not a mutation boundary. Targeted Biome and package typecheck passed; the five μ focused test files passed 29 tests on Linux using the command above.
- Store-location follow-up: `PlanStore.open` now checks `.git` file/directory markers on workspace ancestors and rejects a store inside an enclosing repository, including when the workspace is a nested directory. Targeted fixtures cover normal and worktree-style markers. This discovery is not a security boundary and does not prove detection of all repository layouts or resist marker races. Targeted Biome and package typecheck passed; the five μ test files passed 31 tests on Linux.
- Remaining blockers and next authorized step: strengthen crash and hostile filesystem-race evidence and native-platform behavior, especially device/inode availability. No production authorization or containment is claimed.
- Commit / push / deployment: incremental checkpoint authorized; no deployment.
