import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

export interface PathScope {
	readonly kind: "file" | "subtree";
	/** Canonical workspace-relative path, using forward slashes. */
	readonly path: string;
}

function segments(path: string): string[] {
	if (
		typeof path !== "string" ||
		path.length === 0 ||
		path.length > 4096 ||
		path.includes("\\") ||
		path.includes("\0")
	) {
		throw new Error("Invalid scope path");
	}
	const parts = path.split("/");
	if (
		parts.some(
			(part) =>
				!part ||
				part === "." ||
				part === ".." ||
				/[<>:"|?*\x00-\x1f]/.test(part) ||
				/[. ]$/.test(part) ||
				/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
		)
	) {
		throw new Error("Invalid scope path");
	}
	return parts;
}

/** Validate an existing exact file or subtree representation. Not a filesystem security boundary. */
export async function createPathScope(workspace: string, kind: PathScope["kind"], path: string): Promise<PathScope> {
	if (!isAbsolute(workspace) || (kind !== "file" && kind !== "subtree")) throw new Error("Invalid scope root or kind");
	const parts = segments(path);
	const root = await realpath(workspace);
	if (!(await lstat(root)).isDirectory()) throw new Error("Workspace must be a directory");
	let current = root;
	for (let i = 0; i < parts.length; i++) {
		current = join(current, parts[i]);
		const info = await lstat(current);
		if (info.isSymbolicLink()) throw new Error("Symlinks are not supported in scopes");
		if (i < parts.length - 1 && !info.isDirectory()) throw new Error("Scope ancestor is not a directory");
		if (i === parts.length - 1 && !(kind === "file" ? info.isFile() : info.isDirectory())) {
			throw new Error("Scope target type does not match");
		}
	}
	return Object.freeze({ kind, path: parts.join("/") });
}

/** Lexical membership only; callers must not use this as authorization or a mutation guard. */
export function pathInScope(scope: PathScope, candidate: string): boolean {
	try {
		const scopePath = segments(scope.path).join("/");
		const candidatePath = segments(candidate).join("/");
		if (scope.kind === "file") return candidatePath === scopePath;
		if (scope.kind === "subtree") return candidatePath === scopePath || candidatePath.startsWith(`${scopePath}/`);
		return false;
	} catch {
		return false;
	}
}
