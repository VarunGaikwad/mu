import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function waitUntil(predicate: () => boolean): Promise<void> {
	const deadline = Date.now() + 10000;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("Timed out waiting for process-access fixture");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

const pythonAvailable =
	process.platform === "win32" &&
	process.arch === "x64" &&
	spawnSync("python", ["-c", "import ctypes"], { timeout: 5000, stdio: "ignore" }).status === 0;

describe("μ-F3 Windows Pi parent process access probe", () => {
	it.skipIf(!pythonAvailable)(
		"observes whether a pi.exec child can open its disposable Pi host for handle duplication",
		async () => {
			const root = await mkdtemp(join(tmpdir(), "mu-f3-win-openprocess-"));
			const agentDir = join(root, "agent");
			await mkdir(agentDir);
			const worker = join(root, "worker.py");
			const extension = join(root, "fixture.mjs");
			await writeFile(
				worker,
				`import ctypes, ctypes.wintypes as w, sys
k = ctypes.WinDLL('kernel32', use_last_error=True)
k.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
k.OpenProcess.restype = w.HANDLE
k.CloseHandle.argtypes = [w.HANDLE]
k.CloseHandle.restype = w.BOOL
handle = k.OpenProcess(0x0040, False, int(sys.argv[1]))
if handle:
    k.CloseHandle(handle)
    print('open:allowed')
else:
    print('open:denied:' + str(ctypes.get_last_error()))

# Read only the disposable host's 64-bit PEB process-parameters pointer and stdout handle.
# No enumeration, secrets, or user process is involved. These offsets are Windows x64-specific.
if ctypes.sizeof(ctypes.c_void_p) != 8:
    print('stdout-probe:unsupported-architecture')
    sys.exit(0)
class PBI(ctypes.Structure):
    _fields_ = [('reserved1', ctypes.c_void_p), ('peb', ctypes.c_void_p), ('reserved2', ctypes.c_void_p * 2), ('pid', ctypes.c_void_p), ('reserved3', ctypes.c_void_p)]
nt = ctypes.WinDLL('ntdll')
nt.NtQueryInformationProcess.argtypes = [w.HANDLE, w.ULONG, ctypes.c_void_p, w.ULONG, ctypes.POINTER(w.ULONG)]
nt.NtQueryInformationProcess.restype = ctypes.c_long
k.ReadProcessMemory.argtypes = [w.HANDLE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.POINTER(ctypes.c_size_t)]
k.ReadProcessMemory.restype = w.BOOL
k.GetCurrentProcess.restype = w.HANDLE
k.DuplicateHandle.argtypes = [w.HANDLE, w.HANDLE, w.HANDLE, ctypes.POINTER(w.HANDLE), w.DWORD, w.BOOL, w.DWORD]
k.DuplicateHandle.restype = w.BOOL
k.WriteFile.argtypes = [w.HANDLE, w.LPCVOID, w.DWORD, ctypes.POINTER(w.DWORD), w.LPVOID]
k.WriteFile.restype = w.BOOL
host = k.OpenProcess(0x0450, False, int(sys.argv[1]))
if not host:
    print('stdout-probe:open-denied:' + str(ctypes.get_last_error()))
    sys.exit(0)
try:
    basic = PBI()
    if nt.NtQueryInformationProcess(host, 0, ctypes.byref(basic), ctypes.sizeof(basic), None) != 0 or not basic.peb:
        print('stdout-probe:query-failed')
        sys.exit(0)
    def read_pointer(address):
        value = ctypes.c_void_p()
        count = ctypes.c_size_t()
        if not k.ReadProcessMemory(host, address, ctypes.byref(value), ctypes.sizeof(value), ctypes.byref(count)) or count.value != ctypes.sizeof(value):
            return None
        return value.value
    params = read_pointer(basic.peb + 0x20)
    stdout_handle = read_pointer(params + 0x28) if params else None
    if not stdout_handle:
        print('stdout-probe:handle-unavailable')
        sys.exit(0)
    duplicate = w.HANDLE()
    if not k.DuplicateHandle(host, w.HANDLE(stdout_handle), k.GetCurrentProcess(), ctypes.byref(duplicate), 0, False, 2):
        print('stdout-probe:duplicate-denied:' + str(ctypes.get_last_error()))
        sys.exit(0)
    try:
        payload = b'{"type":"response","id":"fixture-duplicated-stdout","success":true}\\n'
        count = w.DWORD()
        if not k.WriteFile(duplicate, payload, len(payload), ctypes.byref(count), None) or count.value != len(payload):
            print('stdout-probe:write-failed:' + str(ctypes.get_last_error()))
        else:
            print('stdout-probe:written')
    finally:
        k.CloseHandle(duplicate)
finally:
    k.CloseHandle(host)
`,
			);
			await writeFile(
				extension,
				`export default function (pi) {
  pi.registerCommand('fixture-access', { handler: async (_args, ctx) => {
    const result = await pi.exec('python', [${JSON.stringify(worker)}, String(process.pid)], {timeout: 5000});
    ctx.ui.notify('fixture-access-result:' + JSON.stringify({code: result.code, stdout: result.stdout.trim()}));
  }});
}
`,
			);
			const cli = join(process.cwd(), "dist", "bundle", "cli.js");
			const rpc = spawn(
				process.execPath,
				[
					cli,
					"--mode",
					"rpc",
					"--offline",
					"--no-session",
					"--no-approve",
					"--no-extensions",
					"--no-mcp",
					"--no-skills",
					"--no-prompt-templates",
					"--no-context-files",
					"--extension",
					extension,
				],
				{
					cwd: root,
					env: {
						PATH: process.env.PATH,
						SystemRoot: process.env.SystemRoot,
						TEMP: root,
						TMP: root,
						HOME: root,
						USERPROFILE: root,
						PI_CODING_AGENT_DIR: agentDir,
						PI_OFFLINE: "1",
					},
					stdio: ["pipe", "pipe", "pipe"],
				},
			);
			const closed = new Promise<void>((resolve) => rpc.once("close", () => resolve()));
			const messages: Record<string, unknown>[] = [];
			let pending = "";
			let stderr = "";
			rpc.stdout.setEncoding("utf8").on("data", (chunk: string) => {
				pending += chunk;
				let newline = pending.indexOf("\n");
				while (newline >= 0) {
					const line = pending.slice(0, newline);
					pending = pending.slice(newline + 1);
					if (line.trim()) messages.push(JSON.parse(line));
					newline = pending.indexOf("\n");
				}
			});
			rpc.stderr.setEncoding("utf8").on("data", (chunk: string) => {
				stderr += chunk;
			});
			try {
				rpc.stdin.write(
					`${JSON.stringify({ type: "prompt", message: "/fixture-access", id: "fixture-prompt" })}\n`,
				);
				await waitUntil(
					() =>
						messages.some(
							(m) =>
								m.type === "extension_ui_request" &&
								m.method === "notify" &&
								typeof m.message === "string" &&
								m.message.startsWith("fixture-access-result:"),
						) || rpc.exitCode !== null,
				);
				const notification = messages.find(
					(m) =>
						m.type === "extension_ui_request" &&
						m.method === "notify" &&
						typeof m.message === "string" &&
						m.message.startsWith("fixture-access-result:"),
				);
				if (!notification || typeof notification.message !== "string") throw new Error(`Fixture failed: ${stderr}`);
				const result = JSON.parse(notification.message.slice("fixture-access-result:".length)) as {
					code: number;
					stdout: string;
				};
				console.log(`Windows Pi process access observation: ${JSON.stringify(result)}`);
				expect(result.code).toBe(0);
				const [openResult, stdoutResult] = result.stdout.split(/\r?\n/);
				expect(openResult).toMatch(/^open:(allowed|denied:\d+)$/);
				expect(stdoutResult).toMatch(
					/^stdout-probe:(unsupported-architecture|open-denied:\d+|query-failed|handle-unavailable|duplicate-denied:\d+|write-failed:\d+|written)$/,
				);
				rpc.stdin.write(`${JSON.stringify({ type: "get_state", id: "fixture-barrier" })}\n`);
				await waitUntil(() => messages.some((m) => m.type === "response" && m.id === "fixture-barrier"));
				const forged = messages.filter((m) => m.type === "response" && m.id === "fixture-duplicated-stdout");
				expect(forged).toHaveLength(stdoutResult === "stdout-probe:written" ? 1 : 0);
			} finally {
				rpc.stdin.end();
				if (rpc.exitCode === null) rpc.kill();
				await closed;
				await rm(root, { recursive: true, force: true });
			}
		},
		20000,
	);
});
