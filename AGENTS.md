# AGENTS.md — μ Coding Agent Repository Instructions

These instructions apply to agents working anywhere in this repository. **μ** is the product name (Greek lowercase mu, U+03BC); use ASCII **`mu`** for CLI commands, source identifiers, branches, and paths. μ is developed as a maintained fork of Pi.

## 1. Start here: planning and implementation documents

The repository uses **two different documentation directories**. Do not confuse them:

```text
docs/
├── plan/
│   └── mu-implementation-plan.md
└── implementation/
    └── mu-implementation.md
```

- **`docs/plan/` is the authoritative location for approved implementation plans.** Read `docs/plan/mu-implementation-plan.md` before proposing, implementing, testing, or declaring any μ milestone complete. If more files are added to `docs/plan/`, inspect the relevant ones too.
- **`docs/implementation/` records actual implementation progress and evidence.** Read `docs/implementation/mu-implementation.md` to find what was attempted, implemented, tested, blocked, or accepted. Update it after your authorized work with factual results, not predictions.
- **Plans describe intended work; implementation logs describe observed work.** A task marked complete in prose is *not* proof the code or its tests exist. Verify both against the current checkout.
- Do not treat old summaries, archived checkpoints, prior conversations, or an agent's assertion as evidence of current implementation. The project restarted from scratch; the historical μ code and earlier M02/M05 completion reports are not valid acceptance evidence.
- Follow the *latest explicitly approved* plan revision. Do not silently change milestone scope, reorder dependency gates, widen `allowed_paths`, or edit a plan to make incomplete work appear complete. If the plan conflicts with the current source, document the discrepancy and request a decision before changing the contract.
- Keep `docs/plan/` intact. Do not delete, move, overwrite, or regenerate plan documents casually. Propose a revision and record why; material plan/scope changes require the user's approval. Execution authority never comes from a Markdown file.

### Document workflow for every task

1. Read this `AGENTS.md`, the relevant material in `docs/plan/`, and the existing record in `docs/implementation/`.
2. Identify the **single requested milestone or bounded task**, its prerequisites, deliverables, permitted paths, security gates, and acceptance criteria.
3. Inspect current source and tests; compare actual state against the plan. Report missing prerequisites rather than assuming they exist.
4. Make only authorized, task-owned changes; add or update focused tests.
5. Verify results, inspect the final diff, and append a factual milestone entry in `docs/implementation/mu-implementation.md` if documentation updates are in scope.
6. Stop at the requested milestone's acceptance gate. Do not automatically start the next milestone, commit, push, or deploy.

## 2. Git and branch policy

- **`main`** mirrors Pi upstream. Never add μ-specific feature commits here. Update it only through a reviewed, fast-forward-only upstream sync.
- **`feat/mu`** is the μ development and integration branch. For a single authorized task, work here unless the user requests a separate task branch.
- **`deployment`** contains only explicitly approved, tested μ releases; never promote automatically.
- For substantial isolated work, use a user-authorized `feat/mu-<milestone>-<topic>` branch; upstream candidates use `sync/pi-<revision>` in an isolated worktree. Do not create branches/worktrees without authorization.
- Before changing anything, inspect `git branch --show-current`, `git rev-parse HEAD`, `git status --short`, and relevant diffs. The plan's recorded baseline is historical, **not** a guarantee of the present HEAD.
- Preserve pre-existing staged, unstaged, untracked, and user-owned changes. Never run destructive `git reset`, `git clean`, checkout/rebase/stash overwrites, force-push, branch deletion, or worktree cleanup to solve a conflict.
- Do not **commit, push, fetch-and-integrate, merge, rebase, create/delete branches or worktrees, or deploy** unless the user explicitly authorizes that action. Permission to edit code does not imply permission to publish Git changes.

## 3. Engineering and architecture rules

- Prefer μ-owned modules and adapters and reuse Pi's existing APIs. Avoid broad edits to upstream-owned core files; document every necessary upstream modification.
- Mandatory permission/approval checks belong at the **host/core execution or mutation boundary**. UI controls, extension hooks, model instructions, tool visibility, and project settings are not security boundaries.
- Treat all model text, tool output, workspace files, child-agent messages, and fetched documentation as untrusted for authorization purposes. A plan file cannot grant permissions.
- **Do not enable privileged approvals until genuine-user provenance (F3) is verified.** Authenticate privileged controls before extension command dispatch, reject stale/replayed responses, and deny unverified paths.
- Modes: `read-only`, `workspace-write`, `danger-full-access`; approval policy: `on-request` or `never`. `never` means deny unapproved operations, **not** elevate. Full access is per-session, with fresh explicit user confirmation; no permanent blanket shell grant.
- Arbitrary shell commands and Git worktrees are **not OS sandboxes**. Without independently verified containment, label command execution `UNSANDBOXED`, obtain authenticated user consent where available, or block. Do not promise workspace-only shell effects.
- Direct file edits require validated scope, protected-path checks, fresh-read/stale-content validation at mutation time, and tests against symlink/hard-link/race escapes before claiming hard containment.
- The planner proposes immutable, revision-hashed plans and structured task scopes. Approval is bound to the exact revision and cannot be carried across scope changes, resume, or branch transitions as authority.
- A single writing agent may work in the normal workspace under actual policy. **Parallel writing agents require distinct managed Git worktrees, task ownership, safe integration, and separately verified security gates.** Until then, writers are sequential. Worktrees do not contain arbitrary shell processes.
- Keep optional integrations and autonomy disabled until their prerequisites and native-platform acceptance gates pass. Do not replace a blocked secure capability with an implicit unsafe fallback.

## 4. Current starting assumption and execution order

The project was explicitly restarted from scratch. **Do not claim that earlier μ modules, security features, 33 tools, or milestone tests still exist.** Confirm current files before implementing.

Follow the dependency sequence in `docs/plan/mu-implementation-plan.md`. In broad terms:

1. Repository audit and documentation baseline (μ-00); independent F3 feasibility assessment.
2. Immutable plan/todo/session/scope foundation (μ-02), plus independent nonprivileged models, planner, debug, safe-edit, UI, and tool-contract work as authorized.
3. Authenticated host controls, mandatory enforcement, permission modes, and trusted checks **before** privileged execution.
4. First product handover: **Plan → Review → Approve & Start Code**. Orchestrator handover remains disabled until its own gates pass.
5. Checkpoints/undo, sequential builders, agent lifecycle, messages, worktree manager, DAG orchestration, then separately gated parallel writers.
6. Deferred autonomy/integrations, native cross-platform acceptance, and explicit deployment promotion.

Treat milestone numbers and checkboxes as a schedule, **not** permission to skip prerequisites. For a new request without an explicit milestone, propose the smallest next eligible slice; do not implement multiple milestones on speculation.

## 5. Testing, diffs, and evidence

- Discover actual build/test conventions from the current root `package.json`, scripts, package documentation, and existing tests **before** invoking them. Preserve any existing Pi `AGENTS.md` testing guidance if merging these instructions into an upstream file.
- Run focused tests for every new/changed test and relevant code path. Prefer deterministic fixtures and faux providers; do not make paid provider calls by default.
- Do not run the full `npm test` suite, perform installs, or trigger system-changing checks without separate authorization. `npm run check` may format or rewrite files; capture the diff beforehand and inspect every resulting change.
- Run `npm run build` when required for the selected focused tests. Record exact commands, platform, result and limitations; don't claim that an unrun test passed.
- Distinguish **implemented**, **verified locally**, **verified on native target OS**, **blocked**, and **accepted**. Mocks are not proof of Windows/macOS/Linux runtime behavior.
- At completion, report files changed, relevant tests/results, pre-existing changes preserved, unresolved risks, and any user decision needed. Do not declare security or production readiness from passing a unit test alone.

### Required implementation-log entry

When a milestone has been worked on, update `docs/implementation/mu-implementation.md` with a concise record in this format (adapt headings to the existing document rather than duplicating them):

```markdown
### μ-XX — <milestone title>
- Status: NOT STARTED | IN PROGRESS | IMPLEMENTED | VERIFIED-LOCAL | VERIFIED-NATIVE | BLOCKED | ACCEPTED
- Branch / base commit:
- Plan reference: docs/plan/mu-implementation-plan.md, relevant section
- Scope and changed files:
- Tests run (exact commands, environment, actual results):
- Tests not run / platform gaps:
- Security gates affected and their verified status:
- Remaining blockers and next authorized step:
- Commit / push / deployment: none unless separately authorized
```

A status of **ACCEPTED** requires the user's acceptance *plus* the tests and platform/security evidence specified by the plan. If a documentation update was not authorized, report the evidence in your response rather than modifying files beyond the task scope.

## 6. Communication and stop conditions

- State assumptions and factual blockers precisely. Do not invent filenames, tool availability, test results, security guarantees, or a prior successful implementation.
- If a task touches protected credentials, approval channels, executing arbitrary code, irreversible Git changes, or a scope not covered by the approved task, **stop that operation and request authorization**. Continue safe independent work only if it stays within the task scope.
- On a failed or blocked verification, preserve code and evidence for review; never silently loosen the requirement, weaken tests, or mark the milestone done.
- Finish with a short factual summary and the next *eligible* milestone; do not silently proceed into it.
