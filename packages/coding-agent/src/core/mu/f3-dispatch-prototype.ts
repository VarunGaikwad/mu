/**
 * Isolated feasibility fixture, not connected to interactive or RPC dispatch.
 * No input source is authenticated here, so privileged controls always fail closed.
 */
export type F3PrototypeResult = "blocked-unverified" | "extension-dispatched" | "not-handled";

const RESERVED = new Set(["mu-approve", "mu-permission", "mu-autonomy"]);

export function dispatchF3Prototype(
	command: string,
	_extensionInput: unknown,
	dispatchExtension: (command: string) => boolean,
): F3PrototypeResult {
	const name = command.trimStart().split(/\s/, 1)[0].replace(/^\//, "");
	// Host-owned reserved names are handled before any extension callback.
	if (RESERVED.has(name)) return "blocked-unverified";
	return dispatchExtension(command) ? "extension-dispatched" : "not-handled";
}
