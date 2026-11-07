import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const pythonAvailable =
	process.platform === "linux" && spawnSync("python3", ["--version"], { stdio: "ignore" }).status === 0;

describe.skipIf(!pythonAvailable)("μ-F3 Linux shared TTY feasibility", () => {
	it("observes same-user TIOCSTI injection into a disposable controlling terminal", async () => {
		// This Python process creates and owns its own pty. It never touches the agent's terminal.
		const script = `
import errno, fcntl, os, pty, select, signal, termios, tty
master, slave = pty.openpty()
os.setsid()
signal.signal(signal.SIGHUP, signal.SIG_IGN)
fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
tty.setraw(slave)
read_fd, write_fd = os.pipe()
pid = os.fork()
if pid == 0:
    os.close(read_fd)
    try:
        fcntl.ioctl(slave, termios.TIOCSTI, b'X')
        os.write(write_fd, b'ok')
    except OSError as error:
        os.write(write_fd, ('blocked:' + errno.errorcode.get(error.errno, 'UNKNOWN')).encode())
    os._exit(0)
os.close(write_fd)
result = os.read(read_fd, 100).decode()
os.waitpid(pid, 0)
if result == 'ok':
    ready, _, _ = select.select([slave], [], [], 1)
    result = 'injected' if ready and os.read(slave, 1) == b'X' else 'inconclusive'
print(result)
os.close(read_fd)
os.close(master)
os.close(slave)
`;
		const result = await execFileAsync("python3", ["-c", script], { timeout: 5000 });
		const outcome = result.stdout.trim();
		console.log(`isolated shared TTY TIOCSTI outcome: ${outcome}`);
		expect(outcome).toMatch(/^(injected|blocked:[A-Z0-9_]+)$/);
	});
});
