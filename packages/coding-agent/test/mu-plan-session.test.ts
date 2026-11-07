import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPlanRevision } from "../src/core/mu/plan-revision.ts";
import { loadSessionPlan, savePlanToSession } from "../src/core/mu/plan-session.ts";
import { PlanStore } from "../src/core/mu/plan-store.ts";
import { setMuPlan } from "../src/core/mu/session-state.ts";
import { SessionManager } from "../src/core/session-manager.ts";

const roots: string[] = [];
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), "mu-plan-session-"));
	roots.push(root);
	const workspace = join(root, "workspace");
	const directory = join(root, "store");
	await mkdir(workspace);
	await mkdir(directory);
	return { directory, store: await PlanStore.open(directory, workspace), session: SessionManager.inMemory() };
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("μ plan/session integration", () => {
	it("loads the correct stored revision after branching and reconstruction", async () => {
		const { session, store } = await fixture();
		const first = createPlanRevision({ title: "first" });
		const second = createPlanRevision({ title: "second" });
		const firstEntry = await savePlanToSession(session, store, first);
		await savePlanToSession(session, store, second);
		expect(await loadSessionPlan(session, store)).toEqual(second);
		session.branch(firstEntry);
		session.appendCustomEntry("unrelated", {});
		const resumed = SessionManager.inMemory(process.cwd(), undefined, [
			session.getHeader()!,
			...session.getEntries(),
		]);
		expect(await loadSessionPlan(resumed, store)).toEqual(first);
	});

	it("rejects missing and corrupted selected revisions", async () => {
		const { session, store, directory } = await fixture();
		const revision = createPlanRevision({ title: "test" });
		setMuPlan(session, revision.hash);
		await expect(loadSessionPlan(session, store)).rejects.toThrow();
		await store.save(revision);
		await writeFile(join(directory, `${revision.hash}.json`), "invalid");
		await expect(loadSessionPlan(session, store)).rejects.toThrow();
	});

	it("does not append a pointer when save fails or the branch changes", async () => {
		const { session, store } = await fixture();
		const revision = createPlanRevision({ title: "test" });
		const count = session.getEntryCount();
		await expect(
			savePlanToSession(
				session,
				{
					...store,
					save: async () => {
						throw new Error("failed");
					},
					load: store.load.bind(store),
				},
				revision,
			),
		).rejects.toThrow("failed");
		expect(session.getEntryCount()).toBe(count);
		const deferred = {
			save: async () => {
				session.appendCustomEntry("other", {});
			},
			load: store.load.bind(store),
		};
		await expect(savePlanToSession(session, deferred, revision)).rejects.toThrow("branch changed");
		expect(await loadSessionPlan(session, store)).toBeNull();
	});
});
