# μ-F3 — user-origin and child-control feasibility

Status: IN PROGRESS. This document is a threat map and a record of observed evidence, not authorization to enable privileged approval. Baseline `794befcc5bfc6479c6518af2cb76d502b8c6db9f` on `feat/mu`.

## Observed control paths

- Interactive: `packages/tui/src/terminal.ts` uses `process.stdin`, puts it in raw mode where available, and registers a data handler. `packages/coding-agent/src/core/agent-session.ts` processes extension slash commands in `prompt()` before input hooks. Thus a hook after that point is not host-first authorization.
- RPC: `packages/coding-agent/src/modes/rpc/rpc-mode.ts` receives JSON lines from `process.stdin`. RPC prompts call `session.prompt(..., { source: "rpc" })`; the existing focused test `rpc-prompt-response-semantics.test.ts` confirms a mocked RPC input can dispatch a registered extension command without starting a model run. Its I/O is mocked and does not test child access to the real transport; `extension_ui_response` messages are correlated with `pendingExtensionRequests` by ID and consumed once when pending. Correlation and one-time map deletion alone do not establish genuine-user provenance or protect against a party able to observe and write the channel. This is Pi extension UI behavior, not a μ approval mechanism.
- Child spawning: `core/tools/bash.ts` starts its shell with stdin ignored or a command pipe and stdout/stderr pipes; `core/exec.ts` similarly uses ignored stdin and output pipes. These stdio choices do not prove same-user process isolation, prevent opening a terminal or `/proc` handle, or prevent other inherited access. Shell environment construction and session metadata are not provenance proofs.
- In-process extensions have host APIs, including process execution; treat extension code and extension-generated messages as untrusted for μ approvals. RPC clients, terminal bytes, model text and child messages cannot self-assert user origin.

## Platform / mode decision matrix

| Platform and mode | Evidence | Decision for μ privileged approval |
| --- | --- | --- |
| Linux interactive / TTY | Source inspection and isolated prototype only; real same-user child and terminal injection tests not yet run | BLOCKED |
| Linux RPC / headless | Source inspection, isolated prototype and mocked RPC extension-dispatch test; real channel forgery and handle-isolation tests not yet run | BLOCKED |
| Native Windows interactive / RPC | Not tested | BLOCKED |
| Native macOS interactive / RPC | Not tested | BLOCKED |
| WSL2 interactive / RPC | Not tested | BLOCKED |

## Isolated prototype

`packages/coding-agent/src/core/mu/f3-dispatch-prototype.ts` is deliberately not connected to the actual host, RPC, UI, or tool pipeline. It reserves illustrative command names and blocks them before an extension callback regardless of supplied source or token claims. Its tests use synthetic inputs, not actual TTY, RPC clients or child processes. They cannot establish user provenance, anti-replay on the real transport, or worker-control isolation. No true privileged action can be approved through this prototype.

## Local shared-channel counterexample

`packages/coding-agent/test/mu-f3-rpc-feasibility.test.ts` starts a same-user Node child with an intentionally delegated private test pipe. The child emits two identical responses bearing a public fixture ID; a toy ID-only receiver accepts the first and rejects the replay. This demonstrates that replay protection alone cannot authenticate the writer when the writer handle is shared. It does **not** establish that a Pi child actually inherits or can reach the real RPC channel; the test never touches a real approval, terminal or RPC session. The ID is synthetic and not a secret.

## Required next evidence

Construct isolated, bounded child/host fixtures that attempt real same-user command and approval-response injection, terminal input, stale/replayed IDs, cross-session IDs and inherited-handle access. Capture only non-secret outcomes. Repeat natively per claimed OS/mode. If isolation cannot be established, keep that path blocked. No OS sandbox, TTY isolation, approval-origin guarantee or production readiness is currently asserted.
