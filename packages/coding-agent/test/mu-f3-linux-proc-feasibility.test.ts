import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe.skipIf(process.platform !== "linux")("μ-F3 Linux procfs feasibility", () => {
	it("observes whether a same-user child can reopen a private host stdin pipe", async () => {
		// The host and attacker are disposable test processes; no Pi session or secret is used.
		const attacker = `
const fs = require('node:fs');
try {
  const fd = fs.openSync('/proc/' + process.ppid + '/fd/0', 'w');
  fs.writeSync(fd, 'fixture-injection\\n');
  fs.closeSync(fd);
  console.log('opened');
  process.exit(0);
} catch (error) { console.log(error.code || 'unknown'); process.exit(2); }
`;
		const host = `
const { spawn } = require('node:child_process');
const descriptor = require('node:fs').readlinkSync('/proc/self/fd/0');
const kind = descriptor.startsWith('socket:') ? 'socket' : descriptor.startsWith('pipe:') ? 'pipe' : 'other';
let received = false;
process.stdin.on('data', chunk => { if (chunk.toString().includes('fixture-injection')) received = true; });
process.stdin.resume();
const attacker = spawn(process.execPath, ['-e', ${JSON.stringify(attacker)}], { stdio: ['ignore', 'pipe', 'ignore'] });
let detail = '';
attacker.stdout.on('data', chunk => { detail += chunk.toString(); });
attacker.on('error', () => { console.log('fixture-error'); process.exit(1); });
attacker.on('close', code => setTimeout(() => {
  console.log((code === 0 && received ? 'injected' : code === 2 && !received ? 'blocked:' + detail.trim() : 'inconclusive') + ':' + kind);
  process.exit(0);
}, 100));
setTimeout(() => { console.log('timeout'); process.exit(1); }, 2000);
`;
		const result = await execFileAsync(process.execPath, ["-e", host], { timeout: 5000 });
		const outcome = result.stdout.trim();
		console.log(`isolated procfs stdin injection outcome: ${outcome}`);
		expect(outcome).toMatch(/^(injected|blocked:[A-Z0-9_]+):(socket|pipe|other)$/);
	});
});
