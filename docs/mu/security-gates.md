# μ security gate ledger

All gates start BLOCKED. No entry here authorizes an action or demonstrates a security boundary.

| Gate | Status | Evidence required |
| --- | --- | --- |
| USER_ORIGIN_VERIFIED | BLOCKED | Native mode/platform provenance and forgery-negative tests. |
| DIRECT_FILE_READ_VERIFIED | BLOCKED | Host-boundary scope and protected-path enforcement tests. |
| DIRECT_FILE_WRITE_VERIFIED | BLOCKED | Host-boundary positive and link/race/escape negative tests. |
| WORKER_CONTROL_ISOLATION_VERIFIED | BLOCKED | Evidence children cannot access privileged handles or approvals. |
| UNSANDBOXED_COMMAND_CONSENT_VERIFIED | BLOCKED | Authenticated session consent and truthful disclosure evidence. |
| CHECK_TRUST_VERIFIED | BLOCKED | Fixed effective command fingerprints and approval invalidation tests. |
| PARALLEL_WRITERS_VERIFIED | BLOCKED | Worktree ownership, integration, rollback and applicable security evidence. |
| PRODUCTION_READY | BLOCKED | Release acceptance and required native platform evidence. |

No OS sandbox or user-origin guarantee is claimed. Linux, Windows and macOS must be assessed separately.
