import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPlanRevision, verifyPlanRevision } from "../src/core/mu/plan-revision.ts";

describe("μ plan revisions", () => {
	it("canonicalizes object keys and freezes revision data", () => {
		const a = createPlanRevision({ z: [1, { b: true, a: null }], a: "task" });
		const b = createPlanRevision({ a: "task", z: [1, { a: null, b: true }] });
		expect(a).toEqual(b);
		expect(Object.isFrozen(a)).toBe(true);
		expect(verifyPlanRevision(a)).toBe(true);
	});

	it("rejects changed content, hashes, versions and noncanonical content", () => {
		const revision = createPlanRevision({ a: 1 });
		expect(verifyPlanRevision({ ...revision, content: '{"a":2}' })).toBe(false);
		expect(verifyPlanRevision({ ...revision, hash: "0".repeat(64) })).toBe(false);
		expect(verifyPlanRevision({ ...revision, version: 2 as 1 })).toBe(false);
		const content = ' {"a":1}';
		const hash = createHash("sha256").update("mu-plan-v1\0").update(content).digest("hex");
		expect(verifyPlanRevision({ ...revision, content, hash })).toBe(false);
	});

	it("rejects cycles, sparse arrays, accessors and unsupported values", () => {
		const cyclic: { self?: unknown } = {};
		cyclic.self = cyclic;
		expect(() => createPlanRevision(cyclic)).toThrow();
		expect(() => createPlanRevision(Array(1))).toThrow();
		expect(() =>
			createPlanRevision({
				get x() {
					throw new Error("getter executed");
				},
			}),
		).toThrow("unsupported properties");
		expect(() => createPlanRevision({ x: undefined })).toThrow();
		expect(() => createPlanRevision({ x: Number.NaN })).toThrow();
		expect(() => createPlanRevision(new Date())).toThrow();
	});

	it("bounds size and nesting", () => {
		expect(() => createPlanRevision("x".repeat(1024 * 1024))).toThrow("maximum size");
		let nested: unknown = null;
		for (let i = 0; i < 66; i++) nested = [nested];
		expect(() => createPlanRevision(nested)).toThrow("maximum nesting depth");
	});
});
