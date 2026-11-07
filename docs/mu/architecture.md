# μ architecture audit

Baseline: `3893edf14f81879e84152b099381b430ae53925a` on `feat/mu`. This is an inventory, not a security assessment.

- Coding-agent implementation: `packages/coding-agent/src/`; reusable SDK in `core/sdk.ts`, interactive and RPC modes under `modes/`.
- Session tree: `core/session-manager.ts` supports append-only custom entries, `getBranch()` and branching by leaf; compaction-aware context is distinct from the complete active branch. μ state replay must explicitly select the appropriate branch and must not restore approvals.
- Tools: `core/tools/index.ts` assembles read, bash, PowerShell, edit, write, grep, find and ls; extensions can register tools via `core/extensions/`. Tool visibility is not authorization.
- Configuration and identity: `src/config.ts` derives defaults from package `piConfig`; `packages/coding-agent/package.json` currently uses `.pi` and executable `pi`.
- Intended μ-02 modules under `core/mu/` did not exist at audit time. No privileged enforcement is established by this inventory.
- Source snapshot differs from the prior observed baseline in root instructions, security documentation and the new plan/implementation docs; root README and CONTRIBUTING are absent. Do not restore or alter them without authorization.
