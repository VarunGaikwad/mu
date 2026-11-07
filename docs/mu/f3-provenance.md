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
| Linux interactive / TTY | Isolated shared-controlling-pty `TIOCSTI` probe returned `EIO`; actual Pi TTY and alternative injection paths not verified | BLOCKED |
| Linux RPC / headless | Isolated real Pi RPC synthetic-dialog test shows forgery when the writer and request ID are deliberately delegated; actual worker reachability and handle isolation remain untested | BLOCKED |
| Native Windows interactive / RPC | `pi.exec` child duplicated the disposable Pi RPC host's stdout and injected a synthetic top-level response; stdin/approval reachability and interactive mode remain untested | BLOCKED |
| Native macOS interactive / RPC | Not tested | BLOCKED |
| WSL2 interactive / RPC | Not tested | BLOCKED |

## Isolated prototype

`packages/coding-agent/src/core/mu/f3-dispatch-prototype.ts` is deliberately not connected to the actual host, RPC, UI, or tool pipeline. It reserves illustrative command names and blocks them before an extension callback regardless of supplied source or token claims. Its tests use synthetic inputs, not actual TTY, RPC clients or child processes. They cannot establish user provenance, anti-replay on the real transport, or worker-control isolation. No true privileged action can be approved through this prototype.

## Local shared-channel counterexample

`packages/coding-agent/test/mu-f3-rpc-feasibility.test.ts` starts a same-user Node child with an intentionally delegated private test pipe. The child emits two identical responses bearing a public fixture ID; a toy ID-only receiver accepts the first and rejects the replay. This demonstrates that replay protection alone cannot authenticate the writer when the writer handle is shared. It does **not** establish that a Pi child actually inherits or can reach the real RPC channel; the test never touches a real approval, terminal or RPC session. The ID is synthetic and not a secret.

## Isolated real Pi RPC counterexample

`packages/coding-agent/test/mu-f3-real-rpc.test.ts` starts the locally built Pi RPC CLI with an empty temporary home/config, offline mode, no session, no project context and a synthetic test extension. The test deliberately delegates the RPC stdin writer and gives a same-user child the synthetic dialog request ID over a private pipe. The child sends an unknown ID, the valid response, and their replay; the real Pi extension dialog reports one confirmation. The test does not authorize or perform a privileged operation, and does not demonstrate that a normal worker can reach the writer or learn the ID. It demonstrates that real extension-dialog correlation alone cannot authenticate a writer that already has both. The request ID is not logged, put in argv/environment, or persisted by the fixture.

## Linux procfs probe

On Linux `6.12.95-cloud-amd64` x86_64, Node `v24.21.0`, `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-linux-proc-feasibility.test.ts --silent=false` passed one isolated probe and reported `blocked:ENXIO:socket`. A disposable same-user child tried to reopen its disposable Node host's stdin via `/proc/<parent>/fd/0`; that particular descriptor was a socket and opening it for writing failed with `ENXIO`. Only fixture text was used. This does not establish protection for actual Pi RPC, anonymous pipes, terminal devices, other descriptors, platforms, `/proc` policies or alternative injection techniques. The test accepts either a recorded injection or a recorded block as an observation, not a security acceptance criterion.

## Linux shared TTY probe

`npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-linux-tty-feasibility.test.ts --silent=false` created a disposable controlling pseudo-terminal in a separate Python process and forked a same-user child inheriting that pty. On this Linux host, `TIOCSTI` returned `EIO` (`blocked:EIO`). The first fixture version exited unsuccessfully; after explicitly ignoring hangup during pty cleanup, the test ran and produced the recorded result. The test accepts injection or blockage as an observation, not as an approval gate. It does not test Pi's actual interactive terminal, detached shell processes, terminal-emulator responses, other ioctls, other OS settings, or child control isolation. Python is optional; the fixture skips when unavailable.

## Native Windows ignored-stdin probe

On Windows x64 `10.0.26300`, Node `v22.23.0`, `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-windows-stdio-feasibility.test.ts --silent=false` passed one isolated test and reported `{"count":0,"marker":false}`. A disposable Node host consumed a synthetic input marker and spawned a child with `stdin: ignore`; the child read EOF. This checks only that fixture's standard input behavior, not a real Pi worker, other inherited handles, named pipes, process access, terminal input, or RPC writer reachability. It does not establish isolation or user provenance. The test skips on non-Windows platforms.

## Native Windows Pi RPC worker probe

On Windows x64 `10.0.26300`, Node `v22.23.0`, `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-windows-real-worker.test.ts test/mu-f3-windows-stdio-feasibility.test.ts --silent=false` passed two tests. In an offline temporary Pi RPC session, a synthetic extension invoked the real `pi.exec` path to start a Node worker. The worker attempted to write a synthetic `get_state` command to its own fd 0; it reported `EBADF`, and no response bearing the synthetic child-command ID was observed before a parent RPC barrier response. No privileged action, real approval, or request ID was used. The fixture uses the locally built CLI, isolated configuration and a restricted environment. This is a test of one descriptor and spawn path only: it does not test handle duplication, named pipes, other descriptors, shell workers, TTY, request-ID discovery, or same-user process access; it cannot establish control isolation or user origin. It skips on non-Windows platforms.

### Child stdout spoofing follow-up

On the same Windows host, `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-windows-real-worker.test.ts test/mu-f3-rpc-cross-session.test.ts test/mu-f3-real-rpc.test.ts --silent=false` passed three tests. The `pi.exec` child additionally printed a synthetic RPC response as a standalone stdout line. The fixture observed that line within the extension's captured output, but not as a top-level RPC response before a barrier. This covers only captured `pi.exec` output in this extension fixture; it does not test direct writes to the host's output handle, other execution paths, client interpretation of untrusted text, or user-origin authentication.

### Windows RPC bash follow-up

On the same Windows host, the real-worker fixture also invoked Pi's RPC `bash` command using the disposable Node worker. Shell resolution observed `C:\Program Files\Git\bin\bash.exe` with `-c` (argv transport). The worker's write to fd 0 returned `EBADF`; its synthetic response text was captured in the bash result rather than appearing as a top-level RPC response before a barrier. `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-windows-real-worker.test.ts test/mu-f3-rpc-cross-session.test.ts test/mu-f3-real-rpc.test.ts --silent=false` passed three tests, and targeted Biome passed. This requires a working Windows bash and covers only this configured shell and worker, not WSL stdin transport, PowerShell, other handles, handle duplication or isolation against same-user processes.

### Windows PowerShell backend follow-up

On Windows x64 `10.0.26300`, Node `v22.23.0`, `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-windows-powershell.test.ts --silent=false` passed one test using Pi's `createLocalPowerShellOperations` directly, not an RPC session. Windows PowerShell `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` ran a disposable Node worker; the worker reported `stdin:EBADF`, and its synthetic response line appeared in the backend's captured output. Targeted Biome passed. The first fixture attempt returned no output and failed cleanup with `EBUSY`; a second attempt using a pipeline failed because the restricted environment omitted `PATHEXT`. Supplying `PATHEXT` and waiting through the pipeline produced the recorded result. This tests one local backend and does not show RPC transport behavior, actual approval, direct handle access or same-user isolation.

### Windows Pi host process access

On Windows x64 `10.0.26300`, Node `v22.23.0` and Python `3.11.9`, `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-windows-process-access.test.ts --silent=false` passed one observational test. An offline disposable Pi RPC process launched a Python child through `pi.exec`; that child used `OpenProcess(PROCESS_DUP_HANDLE)` on the disposable Pi host PID and reported `open:allowed`, then closed the obtained process handle. It did not enumerate, duplicate, read or write any host handle. The fixture passes whether this access is allowed or denied and skips when Windows or Python is unavailable. This shows that the ignored child stdin alone does not prevent a same-user child obtaining that process access on this host; it does **not** show that a usable RPC writer handle exists in the Pi process or that it can be discovered or duplicated. No approval or privileged workflow was enabled.

### Windows actual Pi RPC stdout duplication

On Windows x64 `10.0.26300`, Node `v22.23.0` and Python `3.11.9`, the extended `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-windows-process-access.test.ts --silent=false` passed one observational test; targeted Biome passed. In an offline disposable Pi RPC process, a child spawned by `pi.exec` opened its Pi host with process-query, memory-read and handle-duplication rights. Using Windows x64-specific PEB offsets, it read only the host's process-parameters pointer and stdout handle value, duplicated that handle, and wrote a synthetic JSON response. The test client observed that synthetic response as a top-level line before a barrier (`stdout-probe:written`). No real approval or user session was involved. The fixture accepts recorded denial/failure and skips outside Windows x64 or without Python. This is an actual RPC **output-channel forgery counterexample** on this host, not proof of RPC stdin access, request-ID discovery, acceptance by a real client, or interactive-terminal injection. Both user-origin and worker-control isolation remain BLOCKED.

### Windows synthetic handle duplication

On Windows x64 `10.0.26300`, Node `v22.23.0` and Python `3.11.9`, `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-windows-duplicate-handle.test.ts --silent=false` passed one observational test; targeted Biome passed. A disposable Python host created a pipe and deliberately disclosed its synthetic write-handle value and PID to a same-user child without inheriting the handle. The child opened that host with `PROCESS_DUP_HANDLE`, duplicated the disclosed pipe handle, and wrote the synthetic marker, which the host received. The fixture also permits a recorded access denial and skips without native Windows/Python. This demonstrates a same-user handle-duplication risk under deliberate handle-value disclosure, not discovery or access to an actual Pi RPC writer; no Pi process or approval was involved.

## Native Windows real RPC correlation probes

On Windows x64 `10.0.26300`, Node `v22.23.0`, `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-rpc-cross-session.test.ts test/mu-f3-real-rpc.test.ts --silent=false` passed two tests using the offline local CLI. The existing shared-writer fixture also reproduced its deliberate handle-and-ID delegation counterexample on Windows. The new cross-session fixture started two separate RPC processes with synthetic extension dialogs, sent each process the other dialog's request ID, and observed no confirmation before a barrier; each correct ID then produced one confirmation despite replay. The test does not expose request IDs in logs or persist them. This demonstrates correlation behavior in this fixture, not authenticated user origin, inaccessible handles, resistance to ID disclosure, or a μ approval mechanism.

### Stale ID with a new pending dialog

The cross-session fixture was extended to open a second synthetic dialog in each RPC process after the first completed. On Windows x64 `10.0.26300`, Node `v22.23.0`, `npm --workspace @earendil-works/pi-coding-agent test -- test/mu-f3-rpc-cross-session.test.ts test/mu-f3-real-rpc.test.ts --silent=false` passed two tests. An earlier dialog ID did not cause another confirmation before a barrier; each second dialog then confirmed using its new ID. Targeted Biome passed. This tests Pi extension-dialog ID correlation only; it does not establish provenance, isolation, or authorization across plan revisions or resumed μ sessions.

## Required next evidence

Construct isolated, bounded child/host fixtures that attempt real same-user command and approval-response injection, terminal input, stale/replayed IDs, cross-session IDs and inherited-handle access. Capture only non-secret outcomes. Repeat natively per claimed OS/mode. If isolation cannot be established, keep that path blocked. No OS sandbox, TTY isolation, approval-origin guarantee or production readiness is currently asserted.
