import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function waitUntil(predicate: () => boolean): Promise<void> {
	const deadline = Date.now() + 10000;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("Timed out waiting for cross-session fixture");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

interface Fixture {
	process: ChildProcessWithoutNullStreams;
	closed: Promise<void>;
	messages: Record<string, unknown>[];
	stderr: string;
}

describe("μ-F3 real RPC cross-session correlation", () => {
	it("rejects another session's synthetic dialog ID and consumes valid responses once", async () => {
		const root = await mkdtemp(join(tmpdir(), "mu-f3-cross-session-"));
		const fixtures: Fixture[] = [];
		try {
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
			for (const name of ["first", "second"]) {
				const agentDir = join(root, name);
				await mkdir(agentDir);
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
							HOME: root,
							USERPROFILE: root,
							TEMP: root,
							TMP: root,
							PI_CODING_AGENT_DIR: agentDir,
							PI_OFFLINE: "1",
						},
						stdio: ["pipe", "pipe", "pipe"],
					},
				);
				const fixture: Fixture = {
					process: rpc,
					closed: new Promise((resolve) => rpc.once("close", () => resolve())),
					messages: [],
					stderr: "",
				};
				fixtures.push(fixture);
				let pending = "";
				rpc.stdout.setEncoding("utf8").on("data", (chunk: string) => {
					pending += chunk;
					let newline = pending.indexOf("\n");
					while (newline >= 0) {
						const line = pending.slice(0, newline);
						pending = pending.slice(newline + 1);
						if (line.trim()) fixture.messages.push(JSON.parse(line));
						newline = pending.indexOf("\n");
					}
				});
				rpc.stderr.setEncoding("utf8").on("data", (chunk: string) => {
					fixture.stderr += chunk;
				});
				rpc.stdin.write(`${JSON.stringify({ type: "prompt", message: "/fixture-dialog", id: "prompt" })}\n`);
			}
			await waitUntil(() =>
				fixtures.every(
					(f) =>
						f.messages.some((m) => m.type === "extension_ui_request" && m.method === "confirm") ||
						f.process.exitCode !== null,
				),
			);
			const ids = fixtures.map((f) => {
				const request = f.messages.find((m) => m.type === "extension_ui_request" && m.method === "confirm");
				if (!request || typeof request.id !== "string") throw new Error(`Dialog unavailable: ${f.stderr}`);
				return request.id;
			});
			expect(ids[0]).not.toBe(ids[1]);
			for (let i = 0; i < fixtures.length; i++) {
				fixtures[i].process.stdin.write(
					`${JSON.stringify({ type: "extension_ui_response", id: ids[1 - i], confirmed: true })}\n`,
				);
				fixtures[i].process.stdin.write(`${JSON.stringify({ type: "get_state", id: "cross-barrier" })}\n`);
			}
			await waitUntil(() =>
				fixtures.every((f) => f.messages.some((m) => m.type === "response" && m.id === "cross-barrier")),
			);
			for (const f of fixtures)
				expect(f.messages.some((m) => m.type === "extension_ui_request" && m.method === "notify")).toBe(false);
			for (let i = 0; i < fixtures.length; i++) {
				const response = `${JSON.stringify({ type: "extension_ui_response", id: ids[i], confirmed: true })}\n`;
				fixtures[i].process.stdin.write(response + response);
				fixtures[i].process.stdin.write(`${JSON.stringify({ type: "get_state", id: "replay-barrier" })}\n`);
			}
			await waitUntil(() =>
				fixtures.every(
					(f) =>
						f.messages.some((m) => m.type === "response" && m.id === "replay-barrier") &&
						f.messages.some(
							(m) =>
								m.type === "extension_ui_request" && m.method === "notify" && m.message === "fixture-confirmed",
						),
				),
			);
			for (const f of fixtures)
				expect(
					f.messages.filter(
						(m) =>
							m.type === "extension_ui_request" && m.method === "notify" && m.message === "fixture-confirmed",
					),
				).toHaveLength(1);

			// A response from an earlier prompt must not resolve a newly pending dialog.
			for (const f of fixtures) {
				f.process.stdin.write(
					`${JSON.stringify({ type: "prompt", message: "/fixture-dialog", id: "second-prompt" })}\n`,
				);
			}
			await waitUntil(() =>
				fixtures.every(
					(f) =>
						f.messages.filter((m) => m.type === "extension_ui_request" && m.method === "confirm").length === 2,
				),
			);
			const newIds = fixtures.map((f) => {
				const request = f.messages.filter((m) => m.type === "extension_ui_request" && m.method === "confirm")[1];
				if (typeof request.id !== "string") throw new Error("Second dialog has no request ID");
				return request.id;
			});
			for (let i = 0; i < fixtures.length; i++) {
				expect(newIds[i]).not.toBe(ids[i]);
				fixtures[i].process.stdin.write(
					`${JSON.stringify({ type: "extension_ui_response", id: ids[i], confirmed: true })}\n`,
				);
				fixtures[i].process.stdin.write(`${JSON.stringify({ type: "get_state", id: "stale-barrier" })}\n`);
			}
			await waitUntil(() =>
				fixtures.every((f) => f.messages.some((m) => m.type === "response" && m.id === "stale-barrier")),
			);
			for (const f of fixtures) {
				expect(
					f.messages.filter(
						(m) =>
							m.type === "extension_ui_request" && m.method === "notify" && m.message === "fixture-confirmed",
					),
				).toHaveLength(1);
			}
			for (let i = 0; i < fixtures.length; i++) {
				fixtures[i].process.stdin.write(
					`${JSON.stringify({ type: "extension_ui_response", id: newIds[i], confirmed: true })}\n`,
				);
			}
			await waitUntil(() =>
				fixtures.every(
					(f) =>
						f.messages.filter(
							(m) =>
								m.type === "extension_ui_request" && m.method === "notify" && m.message === "fixture-confirmed",
						).length === 2,
				),
			);
		} finally {
			for (const f of fixtures) {
				f.process.stdin.end();
				if (f.process.exitCode === null) f.process.kill();
			}
			await Promise.all(fixtures.map((f) => f.closed));
			await rm(root, { recursive: true, force: true });
		}
	}, 20000);
});
