import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalPowerShellOperations } from "../src/core/tools/powershell.js";
import { getPowerShellConfig } from "../src/utils/shell.js";

function psQuote(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

describe("μ-F3 Windows PowerShell worker probe", () => {
	it.skipIf(process.platform !== "win32")(
		"observes standard streams through Pi's local PowerShell backend",
		async () => {
			const root = await mkdtemp(join(tmpdir(), "mu-f3-powershell-"));
			try {
				const worker = join(root, "worker.cjs");
				await writeFile(
					worker,
					`const fs = require('node:fs');
try { fs.writeSync(0, 'fixture-command\\n'); console.log('stdin:write'); }
catch (e) { console.log('stdin:' + (e.code || 'unknown')); }
console.log(JSON.stringify({type:'response',id:'fixture-forged-output',success:true}));
`,
				);
				const config = getPowerShellConfig();
				let output = "";
				const result = await createLocalPowerShellOperations().exec(
					`& ${psQuote(process.execPath)} ${psQuote(worker)} | Out-String`,
					root,
					{
						timeout: 10,
						env: {
							PATH: process.env.PATH,
							PATHEXT: process.env.PATHEXT,
							SystemRoot: process.env.SystemRoot,
							TEMP: root,
							TMP: root,
						},
						onData: (data) => {
							output += data.toString("utf8");
						},
					},
				);
				console.log(
					`PowerShell worker observation: ${JSON.stringify({ shell: config.shell, exitCode: result.exitCode, output })}`,
				);
				expect(result.exitCode).toBe(0);
				expect(output).toMatch(/stdin:(write|\w+)/);
				expect(output).toContain('"id":"fixture-forged-output"');
			} finally {
				await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
			}
		},
		20000,
	);
});
