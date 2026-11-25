# MCP patch_entity returns a compact confirmation

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** @open-metadata/maintainers
- **Guard:** `McpResponseUtilsTest`, `PatchEntityToolTest`, `McpToolsValidationIT#testPatchEntityWideTableStaysCompactUnderBudget`
- **Related:** #37912; ADR:2026-10-20-mcp-responses-mask-stored-credentials; ADR:2026-11-13-an-mcp-write-an-approval-workflow-holds-answers-pending-approval (amended by this record)

## Context

`patch_entity` answered with the whole patched entity minus a few audit keys. On a wide table, a
one-tag patch echoed every column, so a bulk tagging job filled the agent's context after about a
dozen calls. The reply also left out `entityType` and `updatedAt`.

## Decision

- The reply is a confirmation: `id`, `name`, `fullyQualifiedName`, `entityType`, `version`,
  `updatedAt`, `_operation`, `deleted` only when true, and `changed` (the field names in this
  patch's change description).
- For each top-level name in `changed`, the reply also carries that field's new value. Values are
  read from the masked, visibility-filtered entity, never from the change description's old/new
  values, which skip both.
- A nested change (`columns.x.tags`, `extension.key`) and the wide fields in `BULK_FIELDS` are named
  in `changed` only. Adding one column records `columns` and adding one custom property records
  `extension`, so both are in `BULK_FIELDS`. A changed name without a value was removed or is wide.
- `ENTITY_NO_CHANGE` reports no changed fields. A held write returns the stored entity, whose
  change description belongs to the previous version, so reading it would report fields the patch
  never touched. A held patch therefore answers with identity and version only, not the published
  field values.
- There is no opt-in full reply: `get_entity_details` reads the full entity.
- `McpResponseUtils.compactPatch(entity, changeType)` is replaced by
  `compactPatch(entity, entityType, changeType)` rather than kept. Its only caller was
  `PatchEntityTool`; nothing in Collate or ai-platform calls it.

## Consequences

- A tag or description patch on a wide table stays a few hundred bytes.
- A caller that relied on the echoed entity reads it with `get_entity_details`.
- A new entity type with a wide top-level field needs an entry in `BULK_FIELDS`.
