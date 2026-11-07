import type { SessionManager } from "../session-manager.ts";

const ENTRY_TYPE = "mu:session-state:v1";
const MAX_TODOS = 100;
const MAX_LABEL_LENGTH = 512;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

export type TodoStatus = "pending" | "in-progress" | "done";
export interface Todo {
	readonly id: string;
	readonly label: string;
	readonly status: TodoStatus;
}
export interface MuSessionState {
	readonly planHash: string | null;
	readonly todos: readonly Todo[];
}

type StateEvent =
	| { version: 1; type: "plan"; hash: string }
	| { version: 1; type: "add-todo"; id: string; label: string }
	| { version: 1; type: "set-todo-status"; id: string; status: TodoStatus };

type Session = Pick<SessionManager, "getBranch" | "appendCustomEntry">;

function validateEvent(data: unknown): StateEvent {
	if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid μ session event");
	const item = data as Record<string, unknown>;
	const keys = Object.keys(item).sort().join(",");
	if (item.version !== 1) throw new Error("Invalid μ session event version");
	if (
		item.type === "plan" &&
		keys === "hash,type,version" &&
		typeof item.hash === "string" &&
		HASH_PATTERN.test(item.hash)
	) {
		return { version: 1, type: "plan", hash: item.hash };
	}
	if (
		item.type === "add-todo" &&
		keys === "id,label,type,version" &&
		typeof item.id === "string" &&
		ID_PATTERN.test(item.id) &&
		typeof item.label === "string" &&
		item.label.trim().length > 0 &&
		item.label.length <= MAX_LABEL_LENGTH
	) {
		return { version: 1, type: "add-todo", id: item.id, label: item.label };
	}
	if (
		item.type === "set-todo-status" &&
		keys === "id,status,type,version" &&
		typeof item.id === "string" &&
		ID_PATTERN.test(item.id) &&
		(item.status === "pending" || item.status === "in-progress" || item.status === "done")
	) {
		return { version: 1, type: "set-todo-status", id: item.id, status: item.status };
	}
	throw new Error("Invalid μ session event");
}

function applyEvent(state: MuSessionState, event: StateEvent): MuSessionState {
	if (event.type === "plan") return { planHash: event.hash, todos: [] };
	if (!state.planHash) throw new Error("Todo requires a plan revision");
	if (event.type === "add-todo") {
		if (state.todos.length >= MAX_TODOS) throw new Error("Too many todos");
		if (state.todos.some((todo) => todo.id === event.id)) throw new Error("Duplicate todo ID");
		return { ...state, todos: [...state.todos, { id: event.id, label: event.label, status: "pending" }] };
	}
	if (!state.todos.some((todo) => todo.id === event.id)) throw new Error("Unknown todo ID");
	return {
		...state,
		todos: state.todos.map((todo) => (todo.id === event.id ? { ...todo, status: event.status } : todo)),
	};
}

/** Replay the complete active ancestry, not the compaction-aware model context. */
export function readMuSessionState(session: Session): MuSessionState {
	let state: MuSessionState = { planHash: null, todos: [] };
	for (const entry of session.getBranch()) {
		if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
			state = applyEvent(state, validateEvent(entry.data));
		}
	}
	return state;
}

function appendEvent(session: Session, event: StateEvent): string {
	const validated = validateEvent(event);
	applyEvent(readMuSessionState(session), validated);
	return session.appendCustomEntry(ENTRY_TYPE, validated);
}

export function setMuPlan(session: Session, hash: string): string {
	return appendEvent(session, { version: 1, type: "plan", hash });
}

export function addMuTodo(session: Session, id: string, label: string): string {
	return appendEvent(session, { version: 1, type: "add-todo", id, label });
}

export function setMuTodoStatus(session: Session, id: string, status: TodoStatus): string {
	return appendEvent(session, { version: 1, type: "set-todo-status", id, status });
}
