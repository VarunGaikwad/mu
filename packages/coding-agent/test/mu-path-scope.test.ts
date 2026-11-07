import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPathScope, isPathScopeValid, pathInScope } from "../src/core/mu/path-scope.ts";

const roots: string[] = [];
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), "mu-scope-"));
	roots.push(root);
	await mkdir(join(root, "src"));
	await writeFile(join(root, "src", "file.ts"), "content");
	return root;
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("μ path scope representation", () => {
	it("distinguishes exact files, subtree descendants and siblings", async () => {
		const root = await fixture();
		const file = await createPathScope(root, "file", "src/file.ts");
		const subtree = await createPathScope(root, "subtree", "src");
		expect(Object.isFrozen(file)).toBe(true);
		expect(pathInScope(file, "src/file.ts")).toBe(true);
		expect(pathInScope(file, "src/file.ts/child")).toBe(false);
		expect(pathInScope(subtree, "src/file.ts")).toBe(true);
		expect(pathInScope(subtree, "src2/file.ts")).toBe(false);
		expect(pathInScope(subtree, "src/../secret")).toBe(false);
	});

	it("rejects traversal, ambiguous and platform-specific names", async () => {
		const root = await fixture();
		for (const value of [
			"../secret",
			"/src",
			"src//file.ts",
			"src/./file.ts",
			"src\\file.ts",
			"C:/x",
			"src/file.ts ",
			"NUL.txt",
		]) {
			await expect(createPathScope(root, "file", value)).rejects.toThrow();
		}
	});

	it("detects replacement with a different file of the same kind", async () => {
		const root = await fixture();
		const scope = await createPathScope(root, "file", "src/file.ts");
		await rename(join(root, "src", "file.ts"), join(root, "src", "original.ts"));
		await writeFile(join(root, "src", "file.ts"), "replacement");
		expect(await isPathScopeValid(root, scope)).toBe(false);
	});

	it("reports a previously valid scope as invalid after deletion or symlink substitution", async () => {
		const root = await fixture();
		const scope = await createPathScope(root, "file", "src/file.ts");
		expect(await isPathScopeValid(root, scope)).toBe(true);
		expect(await isPathScopeValid(root, JSON.parse(JSON.stringify(scope)))).toBe(true);
		expect(await isPathScopeValid(root, { ...scope, inode: "" })).toBe(false);
		await rm(join(root, "src", "file.ts"));
		expect(await isPathScopeValid(root, scope)).toBe(false);
		await symlink(join(root, "src"), join(root, "src", "file.ts"), "dir");
		expect(await isPathScopeValid(root, scope)).toBe(false);
	});

	it("rejects missing paths, wrong types and symlink targets and ancestors", async () => {
		const root = await fixture();
		await expect(createPathScope(root, "file", "missing")).rejects.toThrow();
		await expect(createPathScope(root, "subtree", "src/file.ts")).rejects.toThrow();
		await expect(createPathScope(root, "file", "src")).rejects.toThrow();
		await symlink(join(root, "src"), join(root, "link"), "dir");
		await expect(createPathScope(root, "subtree", "link")).rejects.toThrow("Symlinks");
		await expect(createPathScope(root, "file", "link/file.ts")).rejects.toThrow("Symlinks");
	});
});
