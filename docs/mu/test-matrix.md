# μ test map

| Area | Existing location / command | Observed result / limitation |
| --- | --- | --- |
| Session context and branches | `packages/coding-agent/test/session-manager/`, `packages/coding-agent/test/agent-session-branching.test.ts` | `npm --workspace @earendil-works/pi-coding-agent test -- test/session-manager/build-context.test.ts`: 16 passed on Linux x86_64, Node v24.21.0 after schema build. |
| Session tree and persistence | `npm --workspace @earendil-works/pi-coding-agent test -- test/session-manager/tree-traversal.test.ts test/session-manager/save-entry.test.ts test/session-manager/load-entries.test.ts` | Initially 2 files / 14 tests passed and tree-traversal failed to load due to missing model data. After `npm run hydrate:model-data` and `npm --workspace @earendil-works/pi-ai run check:model-data`, rerun passed 3 files / 45 tests. Hydration fetched live public catalogs and generated ignored local data; it is not a pinned snapshot. |
| Schema build prerequisite | `npm --workspace @earendil-works/pi-schema run build` | Passed locally; test import initially failed without built schema. |
| Focused coding-agent tests | `npm --workspace @earendil-works/pi-coding-agent test -- <test-path>` | Vitest config sets `PI_OFFLINE=1`; choose tests individually and check their prerequisites. |
| Whole repository | Root `npm test` | Not run; separate authorization required. |
| Root checks | Root `npm run check` | Not run; includes Biome `--write` and can change files. |
| Native Windows/macOS | No result | Not run; Linux evidence is not native cross-platform acceptance. |

No provider calls or security-gate tests were performed in this audit.
