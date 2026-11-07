import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function waitUntil(predicate: () => boolean, timeoutMs = 10000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("Timed out waiting for isolated RPC fixture");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

describe("μ-F3 real RPC shared-writer counterexample", () => {
	it("shows that a child deliberately given the RPC writer can answer a synthetic extension dialog", async () => {
		const root = await mkdtemp(join(tmpdir(), "mu-f3-rpc-"));
		const agentDir = join(root, "agent");
		await mkdir(agentDir);
		const extension = join(root, "fixture.mjs");
		await writeFile(
			extension,
			`export default function (pi) {
  pi.registerCommand('fixture-dialog', { handler: async (_args, ctx) => {
    const value = await ctx.ui.confirm('Fixture', 'Synthetic test dialog');
    ctx.ui.notify(value ? 'fixture-confirmed' : 'fixture-denied');
  }});
}\n`,
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
				env: { PATH: process.env.PATH, HOME: root, PI_CODING_AGENT_DIR: agentDir, PI_OFFLINE: "1" },
				stdio: ["pipe", "pipe", "pipe"],
			},
		);
		const rpcClosed = new Promise<void>((resolve) => rpc.once("close", () => resolve()));
		let pending = "";
		let stderr = "";
		const messages: Record<string, unknown>[] = [];
		rpc.stdout.setEncoding("utf8");
		rpc.stdout.on("data", (chunk: string) => {
			pending += chunk;
			let newline = pending.indexOf("\n");
			while (newline >= 0) {
				const line = pending.slice(0, newline);
				pending = pending.slice(newline + 1);
				if (line.trim()) messages.push(JSON.parse(line));
				newline = pending.indexOf("\n");
			}
		});
		rpc.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});
		try {
			rpc.stdin.write(`${JSON.stringify({ type: "prompt", message: "/fixture-dialog", id: "fixture-prompt" })}\n`);
			await waitUntil(
				() =>
					messages.some((m) => m.type === "extension_ui_request" && m.method === "confirm") ||
					rpc.exitCode !== null,
			);
			const request = messages.find((m) => m.type === "extension_ui_request" && m.method === "confirm");
			if (!request || typeof request.id !== "string") throw new Error(`Fixture dialog unavailable: ${stderr}`);
			// The test deliberately delegates the real RPC writer; the ID is passed through a private pipe, not argv/env.
			const attacker = spawn(
				process.execPath,
				[
					"-e",
					'const fs = require("node:fs"); const payload = fs.readFileSync(0); fs.writeSync(3, payload); fs.writeSync(3, payload);',
				],
				{
					stdio: ["pipe", "ignore", "pipe", rpc.stdin],
				},
			);
			const attackerClosed = new Promise<number | null>((resolve) => attacker.once("close", resolve));
			const wrong = JSON.stringify({ type: "extension_ui_response", id: "fixture-wrong-id", confirmed: true });
			const response = JSON.stringify({ type: "extension_ui_response", id: request.id, confirmed: true });
			attacker.stdin.end(`${wrong}\n${response}\n`);
			await waitUntil(
				() =>
					messages.some(
						(m) =>
							m.type === "extension_ui_request" && m.method === "notify" && m.message === "fixture-confirmed",
					) ||
					(attacker.exitCode !== null && attacker.exitCode !== 0),
			);
			expect(await attackerClosed).toBe(0);
			rpc.stdin.write(`${JSON.stringify({ type: "get_state", id: "fixture-after-replay" })}\n`);
			await waitUntil(() => messages.some((m) => m.type === "response" && m.id === "fixture-after-replay"));
			expect(
				messages.filter(
					(m) => m.type === "extension_ui_request" && m.method === "notify" && m.message === "fixture-confirmed",
				),
			).toHaveLength(1);
		} finally {
			rpc.stdin.end();
			if (rpc.exitCode === null) rpc.kill();
			await rpcClosed;
			await rm(root, { recursive: true, force: true });
		}
	}, 20000);
});
