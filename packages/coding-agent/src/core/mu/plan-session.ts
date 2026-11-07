import type { SessionManager } from "../session-manager.ts";
import { type PlanRevision, verifyPlanRevision } from "./plan-revision.ts";
import type { PlanStore } from "./plan-store.ts";
import { readMuSessionState, setMuPlan } from "./session-state.ts";

type Session = Pick<SessionManager, "getBranch" | "appendCustomEntry" | "getLeafId">;
type Store = Pick<PlanStore, "save" | "load">;

/** Save a revision before appending its pointer; the pointer is not approval. */
export async function savePlanToSession(session: Session, store: Store, revision: PlanRevision): Promise<string> {
	const leaf = session.getLeafId();
	const snapshot = { version: revision.version, hash: revision.hash, content: revision.content } as const;
	await store.save(snapshot);
	if (session.getLeafId() !== leaf) throw new Error("Session branch changed while saving plan");
	return setMuPlan(session, snapshot.hash);
}

/** Load the selected active-branch revision, rejecting missing or corrupt objects. */
export async function loadSessionPlan(session: Session, store: Store): Promise<PlanRevision | null> {
	const leaf = session.getLeafId();
	const { planHash } = readMuSessionState(session);
	if (!planHash) return null;
	const revision = await store.load(planHash);
	if (session.getLeafId() !== leaf) throw new Error("Session branch changed while loading plan");
	if (!verifyPlanRevision(revision) || revision.hash !== planHash) throw new Error("Stored plan integrity failure");
	return revision;
}
