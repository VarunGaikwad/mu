# μ architecture audit

Baseline: `3893edf14f81879e84152b099381b430ae53925a` on `feat/mu`. This is an inventory, not a security assessment.

- Coding-agent implementation: `packages/coding-agent/src/`; reusable SDK in `core/sdk.ts`, interactive and RPC modes under `modes/`.
- Session tree: `core/session-manager.ts` supports append-only custom entries, `getBranch()` and branching by leaf; compaction-aware context is distinct from the complete active branch. μ state replay must explicitly select the appropriate branch and must not restore approvals.
- Tools: `core/tools/index.ts` assembles read, bash, PowerShell, edit, write, grep, find and ls; extensions can register tools via `core/extensions/`. Tool visibility is not authorization.
- Configuration and identity: `src/config.ts` derives defaults from package `piConfig`; `packages/coding-agent/package.json` currently uses `.pi` and executable `pi`.
- Extension API: `core/extensions/types.ts` exposes tool registration, messages and `exec`; in-process extensions therefore require separate trust and execution-boundary assessment. Interactive, RPC, JSON-event and print entry points are in `src/modes/`.
- Storage defaults: `src/config.ts` resolves the agent directory and sessions under the user configuration directory, with an environment override. Existing session custom entries are not sent to model context; `getBranch()` returns the complete active ancestry, unlike compaction-aware projections.
- Intended μ-02 modules under `core/mu/` did not exist at audit time. No privileged enforcement is established by this inventory.

## Proposed μ-02 implementation slice

1. A μ-owned, versioned canonical plan representation and content-addressed store outside the repository; reject corrupted revisions and avoid overwriting conflicting objects.
2. Session custom-entry helpers for plan pointers and bounded todo transitions, replaying only `SessionManager.getBranch()`. Compaction and session replay must not create approvals.
3. Exact-file and subtree scope representations with explicit validation and rejection tests for traversal, siblings, symlinks and unsupported targets. These are representations, not a filesystem mutation boundary or a sandbox.
4. Focused tests for hash integrity, collision/concurrency behavior, branch replay and compaction, bounded todos and scope edge cases. Keep UI, shell, approvals and privileged transitions untouched.

The exact storage and filesystem race guarantees must be established in implementation and tests; this sketch does not grant authority or claim containment.
- Source snapshot differs from the prior observed baseline in root instructions, security documentation and the new plan/implementation docs; root README and CONTRIBUTING are absent. Do not restore or alter them without authorization.
