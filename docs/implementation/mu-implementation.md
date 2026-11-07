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
