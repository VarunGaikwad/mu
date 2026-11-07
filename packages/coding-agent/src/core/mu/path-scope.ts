import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

export interface PathScope {
	readonly kind: "file" | "subtree";
	/** Canonical workspace-relative path, using forward slashes. */
	readonly path: string;
	/** Observed identity is a stale-target hint, never a security boundary. */
	readonly device: string;
	readonly inode: string;
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
	let device = "";
	let inode = "";
	for (let i = 0; i < parts.length; i++) {
		current = join(current, parts[i]);
		const info = await lstat(current, { bigint: true });
		if (info.isSymbolicLink()) throw new Error("Symlinks are not supported in scopes");
		if (i < parts.length - 1 && !info.isDirectory()) throw new Error("Scope ancestor is not a directory");
		if (i === parts.length - 1) {
			if (!(kind === "file" ? info.isFile() : info.isDirectory()))
				throw new Error("Scope target type does not match");
			if (info.ino === 0n) throw new Error("Scope target identity is unavailable");
			device = info.dev.toString();
			inode = info.ino.toString();
		}
	}
	return Object.freeze({ kind, path: parts.join("/"), device, inode });
}

/** Recheck observed target identity. Inode reuse and races make this unsuitable for authorization. */
export async function isPathScopeValid(workspace: string, scope: PathScope): Promise<boolean> {
	try {
		const checked = await createPathScope(workspace, scope.kind, scope.path);
		return (
			checked.kind === scope.kind &&
			checked.path === scope.path &&
			checked.device === scope.device &&
			checked.inode === scope.inode
		);
	} catch {
		return false;
	}
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
