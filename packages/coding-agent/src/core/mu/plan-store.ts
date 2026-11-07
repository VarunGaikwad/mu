import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, realpath, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { type PlanRevision, verifyPlanRevision } from "./plan-revision.ts";

const MAX_STORED_BYTES = 3 * 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function inside(parent: string, child: string): boolean {
	const path = relative(parent, child);
	return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}

async function rejectRepositoryStorage(directory: string, workspace: string): Promise<void> {
	let current = workspace;
	while (true) {
		let markerExists = false;
		try {
			await lstat(join(current, ".git"));
			markerExists = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		if (markerExists && inside(current, directory)) throw new Error("Plan store must be outside repository");
		const parent = dirname(current);
		if (parent === current) return;
		current = parent;
	}
}

/** Content storage only: not a filesystem containment or authorization boundary. */
export class PlanStore {
	private readonly directory: string;

	private constructor(directory: string) {
		this.directory = directory;
	}

	/** Both directories must already exist; the store must be outside the workspace. */
	static async open(directory: string, workspace: string): Promise<PlanStore> {
		if (!isAbsolute(directory) || !isAbsolute(workspace)) throw new Error("Store and workspace must be absolute");
		const [storePath, workspacePath] = await Promise.all([realpath(directory), realpath(workspace)]);
		if (!(await stat(storePath)).isDirectory() || !(await stat(workspacePath)).isDirectory()) {
			throw new Error("Store and workspace must be directories");
		}
		if (inside(workspacePath, storePath)) throw new Error("Plan store must be outside workspace");
		await rejectRepositoryStorage(storePath, workspacePath);
		return new PlanStore(storePath);
	}

	async load(hash: string): Promise<PlanRevision> {
		if (!HASH_PATTERN.test(hash)) throw new Error("Invalid plan hash");
		// Avoid blocking on special files and following the final symlink where supported.
		const flags = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0);
		const file = await open(join(this.directory, `${hash}.json`), flags);
		try {
			const metadata = await file.stat();
			if (!metadata.isFile() || metadata.size > MAX_STORED_BYTES) throw new Error("Invalid stored plan file");
			const bytes = Buffer.alloc(MAX_STORED_BYTES + 1);
			let length = 0;
			while (length < bytes.length) {
				const { bytesRead } = await file.read(bytes, length, bytes.length - length, length);
				if (bytesRead === 0) break;
				length += bytesRead;
			}
			if (length > MAX_STORED_BYTES) throw new Error("Invalid stored plan file");
			let revision: PlanRevision;
			try {
				revision = JSON.parse(bytes.toString("utf8", 0, length));
			} catch {
				throw new Error("Invalid stored plan JSON");
			}
			if (!verifyPlanRevision(revision) || revision.hash !== hash) throw new Error("Stored plan integrity failure");
			return Object.freeze({ version: 1, hash: revision.hash, content: revision.content });
		} finally {
			await file.close();
		}
	}

	async save(revision: PlanRevision): Promise<void> {
		const snapshot = { version: revision.version, hash: revision.hash, content: revision.content } as const;
		if (!verifyPlanRevision(snapshot)) throw new Error("Invalid plan revision");
		const target = join(this.directory, `${snapshot.hash}.json`);
		const temporary = join(this.directory, `.mu-plan-${randomUUID()}.tmp`);
		const file = await open(temporary, "wx", 0o600);
		try {
			await file.writeFile(JSON.stringify(snapshot), "utf8");
			await file.sync();
			await file.close();
			try {
				// Hard-link publication is atomic and never replaces an existing object.
				await link(temporary, target);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				const existing = await this.load(snapshot.hash);
				if (existing.content !== snapshot.content) throw new Error("Plan hash collision");
			}
		} finally {
			await file.close().catch(() => {});
			await unlink(temporary);
		}
	}
}
