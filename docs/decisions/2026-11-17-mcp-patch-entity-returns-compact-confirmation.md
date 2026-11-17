# MCP patch_entity returns a compact confirmation by default

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** @open-metadata/maintainers
- **Guard:** `PatchEntityToolTest`, `McpResponseUtilsTest`, `McpToolsValidationIT#testPatchEntityTool`
- **Related:** #37912; ADR:2026-10-20-mcp-responses-mask-stored-credentials; ADR:2026-10-31-metric-and-metric-group-responses-hide-relations-the-viewer-cannot-see; ADR:2026-11-13-an-mcp-write-an-approval-workflow-holds-answers-pending-approval

## Context

`patch_entity` previously serialized the entire patched entity through `McpResponseUtils.compactPatch`, stripping only eight audit/noise keys (`version`, `updatedAt`, `updatedBy`, `changeDescription`, `incrementalChangeDescription`, `followers`, `votes`, `sourceHash`). On a wide `Table`, a single tag or description edit echoed hundreds of `columns`, `tableConstraints`, `joins`, and `schemaDefinition` entries (5,000–9,000+ tokens per call), exhausting an agent's context window after roughly a dozen bulk governance updates while also omitting `entityType` and `updatedAt`.

## Decision

- `patch_entity` accepts an optional `response` parameter (`"compact"` or `"full"`, defaulting to `"compact"`). Invalid values fail with `IllegalArgumentException` (HTTP 400, `"Nothing was changed."`) before authorization or repository mutation.
- In `"compact"` mode, the reply carries:
  - the identity envelope (`id`, `name`, `displayName` when present, `fullyQualifiedName`, `entityStatus` when present, `entityType`, and `deleted: true` only when `true`);
  - confirmation metadata (`version`, `updatedAt` when present, `_operation`, and `changed` when non-empty and `changeType != ENTITY_NO_CHANGE`);
  - non-null values of top-level fields targeted by non-`test` JSON Patch `path`/`from` pointers (RFC 6901 unescaped) or recorded as non-dotted top-level changes, **excluding** heavy structural collections (`columns`, `tableConstraints`, `joins`, `schemaDefinition`, `viewDefinition`, `dataModel`, `tasks`, `features`, `mlFeatures`, `children`, `charts`, `dataModels`, `sampleData`, `tableProfilerConfig`, `customMetrics`, `fields`, `messageSchema`, `requestSchema`, `responseSchema`) and `NOISE_FIELDS`. When `/extension/<subkey>` is patched, only the touched custom property key(s) are echoed inside `extension`.
- In `"full"` mode, the reply carries the full secret-masked, visibility-redacted entity minus `NOISE_FIELDS`, plus `entityType`, `version`, `updatedAt`, `_operation`, and `changed` (when non-empty and `changeType != ENTITY_NO_CHANGE`).
- Both modes run `CommonUtils.enforceEntityVisibility`, `CommonUtils.withVisibleEvidence`, `McpResponseUtils.maskSecrets`, and `McpResponseUtils.markHeld` without mutating `response.entity()`.

## Consequences

- Routine tag, owner, domain, and description patches on wide tables drop from thousands of tokens to ~100 tokens by default while still confirming server-normalized metadata values (derived tags, redacted relation references, masked secrets, and approval-held published values).
- Callers that genuinely require the complete entity in one round-trip pass `response="full"` explicitly; `get_entity_details` remains the primary windowed read surface.
