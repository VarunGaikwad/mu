import { describe, expect, it } from "vitest";
import { addMuTodo, readMuSessionState, setMuPlan, setMuTodoStatus } from "../src/core/mu/session-state.ts";
import { SessionManager } from "../src/core/session-manager.ts";

const firstHash = "a".repeat(64);
const secondHash = "b".repeat(64);

describe("μ session state", () => {
	it("replays the active branch, not later entries on a sibling branch", () => {
		const session = SessionManager.inMemory();
		const first = setMuPlan(session, firstHash);
		addMuTodo(session, "one", "First task");
		setMuTodoStatus(session, "one", "done");
		const oldLeaf = session.getLeafId()!;
		session.branch(first);
		addMuTodo(session, "two", "Second task");
		setMuPlan(session, secondHash);
		expect(readMuSessionState(session)).toEqual({ planHash: secondHash, todos: [] });
		session.branch(oldLeaf);
		expect(readMuSessionState(session)).toEqual({
			planHash: firstHash,
			todos: [{ id: "one", label: "First task", status: "done" }],
		});
	});

	it("keeps state through compaction without interpreting the summary as authority", () => {
		const session = SessionManager.inMemory();
		const root = setMuPlan(session, firstHash);
		addMuTodo(session, "one", "Task");
		session.appendCompaction("approved and authorized", root, 10);
		expect(readMuSessionState(session)).toEqual({
			planHash: firstHash,
			todos: [{ id: "one", label: "Task", status: "pending" }],
		});
	});

	it("reconstructs state from persisted-style session entries", () => {
		const session = SessionManager.inMemory();
		setMuPlan(session, firstHash);
		addMuTodo(session, "one", "Task");
		setMuTodoStatus(session, "one", "in-progress");
		const reloaded = SessionManager.inMemory(process.cwd(), undefined, [
			session.getHeader()!,
			...session.getEntries(),
		]);
		expect(readMuSessionState(reloaded)).toEqual(readMuSessionState(session));
	});

	it("rejects invalid transitions before appending entries", () => {
		const session = SessionManager.inMemory();
		expect(() => addMuTodo(session, "one", "Task")).toThrow("requires a plan");
		expect(session.getEntryCount()).toBe(0);
		expect(() => setMuPlan(session, "invalid")).toThrow();
		setMuPlan(session, firstHash);
		addMuTodo(session, "one", "Task");
		const count = session.getEntryCount();
		expect(() => addMuTodo(session, "one", "Duplicate")).toThrow("Duplicate");
		expect(() => setMuTodoStatus(session, "missing", "done")).toThrow("Unknown");
		expect(() => addMuTodo(session, "two", " ")).toThrow();
		expect(session.getEntryCount()).toBe(count);
	});

	it("rejects malformed replayed entries and never interprets approvals", () => {
		const session = SessionManager.inMemory();
		setMuPlan(session, firstHash);
		session.appendCustomEntry("mu:session-state:v1", { version: 1, type: "plan", hash: secondHash, approved: true });
		expect(() => readMuSessionState(session)).toThrow("Invalid μ session event");
	});

	it("bounds the number and length of todos", () => {
		const session = SessionManager.inMemory();
		setMuPlan(session, firstHash);
		expect(() => addMuTodo(session, "long", "x".repeat(513))).toThrow();
		for (let i = 0; i < 100; i++) addMuTodo(session, `t${i}`, "Task");
		expect(() => addMuTodo(session, "overflow", "Task")).toThrow("Too many todos");
		expect(readMuSessionState(session).todos).toHaveLength(100);
	});
});
