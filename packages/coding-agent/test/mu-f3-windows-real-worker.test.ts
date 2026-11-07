import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function waitUntil(predicate: () => boolean): Promise<void> {
	const deadline = Date.now() + 10000;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("Timed out waiting for RPC fixture");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

describe("μ-F3 Windows real Pi RPC worker probes", () => {
	it.skipIf(process.platform !== "win32")(
		"tests pi.exec and RPC bash child streams against synthetic RPC messages",
		async () => {
			const root = await mkdtemp(join(tmpdir(), "mu-f3-win-worker-"));
			const agentDir = join(root, "agent");
			await mkdir(agentDir);
			const extension = join(root, "fixture.mjs");
			const worker = join(root, "worker.cjs");
			await writeFile(
				worker,
				`const fs = require('node:fs');
try { const n = fs.writeSync(0, JSON.stringify({type:'get_state',id:'fixture-child-command'}) + '\\n'); console.log('write:' + n); }
catch (e) { console.log('error:' + (e.code || 'unknown')); }
console.log(JSON.stringify({type:'response',id:'fixture-forged-output',success:true}));
`,
			);
			await writeFile(
				extension,
				`export default function (pi) {
  pi.registerCommand('fixture-worker', { handler: async (_args, ctx) => {
    const result = await pi.exec(process.execPath, [${JSON.stringify(worker)}], {timeout: 5000});
    ctx.ui.notify('fixture-worker-result:' + JSON.stringify({code: result.code, stdout: result.stdout.trim()}));
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
						ProgramFiles: process.env.ProgramFiles,
						"ProgramFiles(x86)": process.env["ProgramFiles(x86)"],
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
			let pending = "";
			let stderr = "";
			const messages: Record<string, unknown>[] = [];
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
					`${JSON.stringify({ type: "prompt", message: "/fixture-worker", id: "fixture-prompt" })}\n`,
				);
				await waitUntil(
					() =>
						messages.some(
							(m) =>
								m.type === "extension_ui_request" &&
								m.method === "notify" &&
								typeof m.message === "string" &&
								m.message.startsWith("fixture-worker-result:"),
						) || rpc.exitCode !== null,
				);
				const result = messages.find(
					(m) =>
						m.type === "extension_ui_request" &&
						m.method === "notify" &&
						typeof m.message === "string" &&
						m.message.startsWith("fixture-worker-result:"),
				);
				if (!result || typeof result.message !== "string") throw new Error(`Worker fixture unavailable: ${stderr}`);
				const observation = JSON.parse(result.message.slice("fixture-worker-result:".length)) as {
					code: number;
					stdout: string;
				};
				console.log(`Windows real Pi worker observation: ${JSON.stringify(observation)}`);
				expect(observation.code).toBe(0);
				const [stdinObservation, forgedOutput] = observation.stdout.split(/\r?\n/);
				expect(stdinObservation).toMatch(/^(write:\d+|error:\w+)$/);
				expect(JSON.parse(forgedOutput)).toEqual({ type: "response", id: "fixture-forged-output", success: true });
				// Barrier ensures RPC consumed earlier input before checking for the synthetic child command.
				rpc.stdin.write(`${JSON.stringify({ type: "get_state", id: "fixture-barrier" })}\n`);
				await waitUntil(() => messages.some((m) => m.type === "response" && m.id === "fixture-barrier"));
				expect(messages.some((m) => m.type === "response" && m.id === "fixture-child-command")).toBe(false);
				expect(messages.some((m) => m.type === "response" && m.id === "fixture-forged-output")).toBe(false);

				// Exercise Pi's RPC bash path separately from pi.exec using only the disposable worker.
				const shellCommand = `"${process.execPath.replaceAll("\\", "/")}" "${worker.replaceAll("\\", "/")}"`;
				rpc.stdin.write(`${JSON.stringify({ type: "bash", id: "fixture-shell", command: shellCommand })}\n`);
				await waitUntil(
					() => messages.some((m) => m.type === "response" && m.id === "fixture-shell") || rpc.exitCode !== null,
				);
				const shellResponse = messages.find((m) => m.type === "response" && m.id === "fixture-shell");
				if (!shellResponse) throw new Error(`Shell fixture unavailable: ${stderr}`);
				console.log(`Windows Pi RPC shell response: ${JSON.stringify(shellResponse)}`);
				expect(shellResponse.success).toBe(true);
				const shellData = shellResponse.data as { output?: string; exitCode?: number };
				expect(shellData.exitCode).toBe(0);
				expect(shellData.output).toMatch(/^(write:\d+|error:\w+)\r?\n/);
				expect(shellData.output).toContain('"id":"fixture-forged-output"');
				rpc.stdin.write(`${JSON.stringify({ type: "get_state", id: "fixture-shell-barrier" })}\n`);
				await waitUntil(() => messages.some((m) => m.type === "response" && m.id === "fixture-shell-barrier"));
				expect(messages.some((m) => m.type === "response" && m.id === "fixture-child-command")).toBe(false);
				expect(messages.some((m) => m.type === "response" && m.id === "fixture-forged-output")).toBe(false);
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
