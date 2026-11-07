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

	it("publishes concurrent identical revisions without partial files or overwrites", async () => {
		const { store, directory } = await fixture();
		const revision = createPlanRevision({ goal: "same" });
		await Promise.all(Array.from({ length: 12 }, () => store.save(revision)));
		expect(await store.load(revision.hash)).toEqual(revision);
		expect(await readdir(directory)).toEqual([`${revision.hash}.json`]);
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

	it("rejects oversized files and invalid revisions", async () => {
		const { store, directory } = await fixture();
		const revision = createPlanRevision({ goal: "size" });
		await writeFile(join(directory, `${revision.hash}.json`), Buffer.alloc(3 * 1024 * 1024 + 1));
		await expect(store.load(revision.hash)).rejects.toThrow("Invalid stored plan file");
		await expect(store.save({ ...revision, hash: "0".repeat(64) })).rejects.toThrow("Invalid plan revision");
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
