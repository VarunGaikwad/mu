import { constants } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPlanRevision } from "../src/core/mu/plan-revision.ts";
import { PlanStore } from "../src/core/mu/plan-store.ts";

const roots: string[] = [];
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), "mu-plan-store-"));
	roots.push(root);
	const workspace = join(root, "workspace");
	const directory = join(root, "store");
	await mkdir(workspace);
	await mkdir(directory);
	return { root, workspace, directory, store: await PlanStore.open(directory, workspace) };
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("μ plan store", () => {
	it("stores immutable revisions outside the workspace and reloads them", async () => {
		const { store } = await fixture();
		const revision = createPlanRevision({ tasks: ["test"] });
		await store.save(revision);
		expect(await store.load(revision.hash)).toEqual(revision);
		expect(Object.isFrozen(await store.load(revision.hash))).toBe(true);
	});

	it("snapshots a revision before asynchronous publication", async () => {
		const { store } = await fixture();
		const original = createPlanRevision({ goal: "original" });
		const mutable = { ...original };
		const saving = store.save(mutable);
		mutable.hash = "0".repeat(64);
		mutable.content = "null";
		await saving;
		expect(await store.load(original.hash)).toEqual(original);
	});

	it("publishes concurrent identical revisions without partial files or overwrites", async () => {
		const { store, directory } = await fixture();
		const revision = createPlanRevision({ goal: "same" });
		await Promise.all(Array.from({ length: 12 }, () => store.save(revision)));
		expect(await store.load(revision.hash)).toEqual(revision);
		expect(await readdir(directory)).toEqual([`${revision.hash}.json`]);
	});

	it("never exposes partial revisions to concurrent readers", async () => {
		const { store } = await fixture();
		const revision = createPlanRevision({ data: "x".repeat(100_000) });
		const writer = store.save(revision);
		const readers = Array.from({ length: 30 }, async () => {
			try {
				expect(await store.load(revision.hash)).toEqual(revision);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			}
		});
		await Promise.all([writer, ...readers]);
		expect(await store.load(revision.hash)).toEqual(revision);
	});

	it("rejects a valid different revision under a colliding target name", async () => {
		const { store, directory } = await fixture();
		const expected = createPlanRevision({ goal: "first" });
		const different = createPlanRevision({ goal: "different" });
		const target = join(directory, `${expected.hash}.json`);
		const original = JSON.stringify(different);
		await writeFile(target, original);
		await expect(store.save(expected)).rejects.toThrow("integrity");
		expect(await readFile(target, "utf8")).toBe(original);
	});

	it("rejects corruption and never replaces an existing target", async () => {
		const { store, directory } = await fixture();
		const revision = createPlanRevision({ goal: "original" });
		const target = join(directory, `${revision.hash}.json`);
		await writeFile(target, '{"broken":true}');
		await expect(store.load(revision.hash)).rejects.toThrow("integrity");
		await expect(store.save(revision)).rejects.toThrow("integrity");
		expect(await readFile(target, "utf8")).toBe('{"broken":true}');
		expect(await readdir(directory)).toEqual([`${revision.hash}.json`]);
	});

	it.skipIf(!constants.O_NOFOLLOW)("rejects a symlink at the stored revision filename", async () => {
		const { store, directory, root } = await fixture();
		const revision = createPlanRevision({ goal: "symlink" });
		const external = join(root, "external.json");
		await writeFile(external, JSON.stringify(revision));
		await symlink(external, join(directory, `${revision.hash}.json`));
		await expect(store.load(revision.hash)).rejects.toThrow();
		await expect(store.save(revision)).rejects.toThrow();
		expect(await readFile(external, "utf8")).toBe(JSON.stringify(revision));
	});

	it("rejects oversized files and invalid revisions", async () => {
		const { store, directory } = await fixture();
		const revision = createPlanRevision({ goal: "size" });
		await writeFile(join(directory, `${revision.hash}.json`), Buffer.alloc(3 * 1024 * 1024 + 1));
		await expect(store.load(revision.hash)).rejects.toThrow("Invalid stored plan file");
		await expect(store.save({ ...revision, hash: "0".repeat(64) })).rejects.toThrow("Invalid plan revision");
	});

	it("rejects a store within an enclosing repository when the workspace is nested", async () => {
		const { root, workspace, directory } = await fixture();
		await mkdir(join(root, ".git"));
		await expect(PlanStore.open(directory, workspace)).rejects.toThrow("outside repository");
	});

	it("rejects worktree-style repository markers as well as directories", async () => {
		const { root, workspace, directory } = await fixture();
		await writeFile(join(root, ".git"), "gitdir: elsewhere");
		await expect(PlanStore.open(directory, workspace)).rejects.toThrow("outside repository");
	});

	it("rejects invalid hashes and store directories inside the workspace", async () => {
		const { workspace, store } = await fixture();
		await expect(store.load("../outside")).rejects.toThrow("Invalid plan hash");
		await expect(PlanStore.open(workspace, workspace)).rejects.toThrow("outside workspace");
		const inner = join(workspace, "inner");
		await mkdir(inner);
		await expect(PlanStore.open(inner, workspace)).rejects.toThrow("outside workspace");
		const alias = join(workspace, "alias");
		await symlink(inner, alias, "dir");
		await expect(PlanStore.open(alias, workspace)).rejects.toThrow("outside workspace");
	});
});
