import { createHash } from "node:crypto";

/** A plan revision is data only; its hash conveys no approval or authority. */
export interface PlanRevision {
	readonly version: 1;
	readonly hash: string;
	readonly content: string;
}

const MAX_PLAN_BYTES = 1024 * 1024;
const MAX_DEPTH = 64;

function canonicalize(value: unknown, ancestors: Set<object>, depth: number): string {
	if (depth > MAX_DEPTH) throw new Error("Plan exceeds maximum nesting depth");
	if (value === null) return "null";
	if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
	if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
	if (typeof value !== "object") throw new Error("Plan contains unsupported data");
	if (ancestors.has(value)) throw new Error("Plan contains a cycle");
	ancestors.add(value);
	try {
		if (Array.isArray(value)) {
			const entries: string[] = [];
			const descriptors = Object.getOwnPropertyDescriptors(value);
			if (Object.getOwnPropertySymbols(value).length || Object.keys(descriptors).length !== value.length + 1) {
				throw new Error("Plan contains unsupported array properties");
			}
			for (let i = 0; i < value.length; i++) {
				const descriptor = descriptors[String(i)];
				if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
					throw new Error("Plan contains a sparse or accessor array");
				}
				entries.push(canonicalize(descriptor.value, ancestors, depth + 1));
			}
			return `[${entries.join(",")}]`;
		}
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) throw new Error("Plan must contain plain objects");
		const descriptors = Object.getOwnPropertyDescriptors(value);
		if (Object.getOwnPropertySymbols(value).length) throw new Error("Plan contains symbol keys");
		const entries = Object.keys(descriptors)
			.sort()
			.map((key) => {
				const descriptor = descriptors[key];
				if (!descriptor.enumerable || !("value" in descriptor))
					throw new Error("Plan contains unsupported properties");
				return `${JSON.stringify(key)}:${canonicalize(descriptor.value, ancestors, depth + 1)}`;
			});
		return `{${entries.join(",")}}`;
	} finally {
		ancestors.delete(value);
	}
}

function digest(content: string): string {
	return createHash("sha256").update("mu-plan-v1\0", "utf8").update(content, "utf8").digest("hex");
}

export function createPlanRevision(plan: unknown): PlanRevision {
	const content = canonicalize(plan, new Set(), 0);
	if (Buffer.byteLength(content, "utf8") > MAX_PLAN_BYTES) throw new Error("Plan exceeds maximum size");
	return Object.freeze({ version: 1, hash: digest(content), content });
}

export function verifyPlanRevision(revision: PlanRevision): boolean {
	if (
		!revision ||
		revision.version !== 1 ||
		typeof revision.content !== "string" ||
		typeof revision.hash !== "string" ||
		!/^[a-f0-9]{64}$/.test(revision.hash)
	)
		return false;
	if (Buffer.byteLength(revision.content, "utf8") > MAX_PLAN_BYTES || digest(revision.content) !== revision.hash)
		return false;
	try {
		return createPlanRevision(JSON.parse(revision.content)).content === revision.content;
	} catch {
		return false;
	}
}
