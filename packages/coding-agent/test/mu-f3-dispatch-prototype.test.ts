import { describe, expect, it, vi } from "vitest";
import { dispatchF3Prototype } from "../src/core/mu/f3-dispatch-prototype.ts";

describe("isolated μ-F3 fail-closed dispatch prototype", () => {
	it.each([
		{ source: "interactive", authenticated: true },
		{ source: "rpc", token: "pretend-token" },
		{ source: "child", userConfirmed: true },
		{ source: "tool", promptId: "stale" },
		{ source: "sibling-session", sessionId: "other" },
	])("blocks reserved controls before extension dispatch for unverified $source input", (input) => {
		const extension = vi.fn(() => true);
		for (const command of ["/mu-approve", "/mu-permission full", "  /mu-autonomy on"]) {
			expect(dispatchF3Prototype(command, input, extension)).toBe("blocked-unverified");
			expect(dispatchF3Prototype(command, input, extension)).toBe("blocked-unverified");
		}
		expect(extension).not.toHaveBeenCalled();
	});

	it("still dispatches unrelated extension commands", () => {
		const extension = vi.fn(() => true);
		expect(dispatchF3Prototype("/hello", {}, extension)).toBe("extension-dispatched");
		expect(extension).toHaveBeenCalledWith("/hello");
	});

	it("reports unhandled nonprivileged commands", () => {
		expect(dispatchF3Prototype("/other", null, () => false)).toBe("not-handled");
	});
});
