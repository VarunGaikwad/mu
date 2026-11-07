import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pythonAvailable =
	process.platform === "win32" &&
	spawnSync("python", ["-c", "import ctypes"], { timeout: 5000, stdio: "ignore" }).status === 0;

describe("μ-F3 Windows synthetic handle duplication probe", () => {
	it.skipIf(!pythonAvailable)(
		"observes duplication of a deliberately disclosed disposable pipe handle",
		async () => {
			const root = await mkdtemp(join(tmpdir(), "mu-f3-win-duplicate-"));
			try {
				const fixture = join(root, "fixture.py");
				await writeFile(
					fixture,
					`import ctypes, ctypes.wintypes as w, msvcrt, os, subprocess, sys
if len(sys.argv) == 1:
    read_fd, write_fd = os.pipe()
    try:
        source_handle = msvcrt.get_osfhandle(write_fd)
        # Only this synthetic handle value is deliberately disclosed. No OS handle is inherited.
        child = subprocess.run([sys.executable, __file__, str(os.getpid()), str(source_handle)], stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=5, close_fds=True)
        os.close(write_fd)
        write_fd = -1
        payload = os.read(read_fd, 64).decode('ascii')
        print('child=' + child.stdout.strip() + ';payload=' + payload + ';code=' + str(child.returncode))
        if child.returncode != 0:
            print(child.stderr, file=sys.stderr)
            sys.exit(1)
    finally:
        os.close(read_fd)
        if write_fd != -1: os.close(write_fd)
else:
    k = ctypes.WinDLL('kernel32', use_last_error=True)
    k.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
    k.OpenProcess.restype = w.HANDLE
    k.GetCurrentProcess.restype = w.HANDLE
    k.DuplicateHandle.argtypes = [w.HANDLE, w.HANDLE, w.HANDLE, ctypes.POINTER(w.HANDLE), w.DWORD, w.BOOL, w.DWORD]
    k.DuplicateHandle.restype = w.BOOL
    k.WriteFile.argtypes = [w.HANDLE, w.LPCVOID, w.DWORD, ctypes.POINTER(w.DWORD), w.LPVOID]
    k.WriteFile.restype = w.BOOL
    k.CloseHandle.argtypes = [w.HANDLE]
    k.CloseHandle.restype = w.BOOL
    parent = k.OpenProcess(0x0040, False, int(sys.argv[1]))
    if not parent:
        print('open-denied:' + str(ctypes.get_last_error()))
        sys.exit(0)
    try:
        duplicate = w.HANDLE()
        if not k.DuplicateHandle(parent, w.HANDLE(int(sys.argv[2])), k.GetCurrentProcess(), ctypes.byref(duplicate), 0, False, 2):
            print('duplicate-denied:' + str(ctypes.get_last_error()))
            sys.exit(0)
        try:
            data = b'fixture-marker'
            count = w.DWORD()
            if not k.WriteFile(duplicate, data, len(data), ctypes.byref(count), None) or count.value != len(data):
                print('write-failed:' + str(ctypes.get_last_error()))
                sys.exit(1)
            print('duplicate-written')
        finally:
            k.CloseHandle(duplicate)
    finally:
        k.CloseHandle(parent)
`,
				);
				const result = spawnSync("python", [fixture], {
					cwd: root,
					encoding: "utf8",
					timeout: 10000,
					env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: root, TMP: root },
				});
				console.log(`Windows synthetic handle duplication observation: ${result.stdout.trim()}`);
				expect(result.status, result.stderr).toBe(0);
				expect(result.stdout.trim()).toMatch(
					/^child=(duplicate-written;payload=fixture-marker|(?:open|duplicate)-denied:\d+;payload=);code=0$/,
				);
			} finally {
				await rm(root, { recursive: true, force: true });
			}
		},
		20000,
	);
});
