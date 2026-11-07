import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";

describe("μ-F3 native Windows ignored-stdin probe", () => {
	it.skipIf(process.platform !== "win32")(
		"observes whether an ignored child stdin receives its host's input",
		async () => {
			// Disposable Node host and child, not Pi or an approval channel. Never pass secrets.
			const childScript = `
const fs = require('node:fs');
try {
  const buffer = Buffer.alloc(128);
  const count = fs.readSync(0, buffer, 0, buffer.length, null);
  process.stdout.write(JSON.stringify({ count, marker: buffer.subarray(0, count).toString().includes('fixture-marker') }));
} catch (error) {
  process.stdout.write(JSON.stringify({ error: error.code || 'unknown' }));
}`;
			const hostScript = `
const { spawn } = require('node:child_process');
process.stdin.once('data', () => {
  const child = spawn(process.execPath, ['-e', ${JSON.stringify(childScript)}], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('close', code => { if (code !== 0) process.exitCode = 1; });
});`;
			const host = spawn(process.execPath, ["-e", hostScript], { stdio: ["pipe", "pipe", "pipe"] });
			let output = "";
			let stderr = "";
			host.stdout.setEncoding("utf8").on("data", (chunk: string) => {
				output += chunk;
			});
			host.stderr.setEncoding("utf8").on("data", (chunk: string) => {
				stderr += chunk;
			});
			const closed = once(host, "close");
			const timeout = setTimeout(() => host.kill(), 5000);
			try {
				host.stdin.end("fixture-marker\n");
				const [code] = await closed;
				expect(code, stderr).toBe(0);
				const result = JSON.parse(output) as { count?: number; marker?: boolean; error?: string };
				console.log(`Windows ignored-stdin observation: ${JSON.stringify(result)}`);
				// Both a read error and EOF are observations; receipt would be an important counterexample.
				expect(result.error || typeof result.count === "number").toBeTruthy();
				expect(result.marker).not.toBe(true);
			} finally {
				clearTimeout(timeout);
				if (host.exitCode === null) host.kill();
			}
		},
		10000,
	);
});
