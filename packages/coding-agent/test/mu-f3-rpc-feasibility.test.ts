import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";

describe("μ-F3 isolated shared-channel counterexample", () => {
	it("shows a child with a delegated writer can forge a response to an ID-only receiver", async () => {
		// Synthetic IDs and a private test pipe only: no production RPC or approval channel is used.
		const child = spawn(
			process.execPath,
			[
				"-e",
				'require("node:fs").writeSync(3, "{\\"id\\":\\"fixture-id\\",\\"approved\\":true}\\n{\\"id\\":\\"fixture-id\\",\\"approved\\":true}\\n")',
			],
			{
				stdio: ["ignore", "ignore", "pipe", "pipe"],
			},
		);
		const writerOutput = child.stdio[3];
		if (!writerOutput || !("on" in writerOutput)) throw new Error("Expected test pipe");
		let output = "";
		writerOutput.on("data", (chunk: Buffer) => {
			output += chunk.toString("utf8");
		});
		const [code] = await once(child, "close");
		expect(code).toBe(0);
		const pending = new Set(["fixture-id"]);
		const decisions = output
			.trim()
			.split("\n")
			.map((line) => {
				const message = JSON.parse(line) as { id: string; approved: boolean };
				if (!pending.delete(message.id)) return "rejected";
				return message.approved ? "accepted" : "denied";
			});
		// Replay is rejected, but the first child-generated decision is accepted.
		expect(decisions).toEqual(["accepted", "rejected"]);
	});
});
