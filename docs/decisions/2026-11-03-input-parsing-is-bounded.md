# User-supplied input is parsed within fixed bounds

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `BoundedJsonPatchTest`, `JsonUtilsTest` (`applyPatch_*`), `DescriptionSanitizerTest`,
  `MessageParserTest`, `EmailPatternTest`, `PatchEntityToolTest`,
  `TableResourceIT.patch_documentRoot_isRefused`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Some inputs are parsed before any authorization decision: values matched by the `email` and
`MessageParser` entity-link patterns, JSON Patch bodies, and descriptions passed through the
sanitizer. The work each one makes the server do stays proportional to its size and within fixed
caps. Per-field patch authorization also needs every operation to name a location below the
document root.

## Decision
- The `email` pattern and the entity-link pattern match in linear time, accepting the same inputs as
  before (`EmailPatternTest`, `MessageParserTest` prove the equivalence).
- `BoundedJsonPatch` reads a patch within 32 MiB, 256 nesting levels and 100 000 operations, for both
  the REST reader (413 past the size bounds, 400 otherwise) and the MCP tool. `JsonUtils.applyPatch`
  refuses a patch whose `copy` operations duplicate more than 10 MiB between them, measuring each
  copied value rather than the whole document. Every other operation adds only values the patch
  body carries, which the body bound already caps.
- A JSON Patch operation on the document root (`"path": ""`) is refused.
- `DescriptionSanitizer` restores entity-link tokens in a single pass, only where the placeholder is
  element text, keyed by a per-call nonce.

## Consequences
A deployment with a document, patch or description larger than these bounds must split it. The bounds
are judgment calls sized well above any legitimate request; lowering them risks refusing real edits,
raising them loosens the limit on server work they exist for. Column-description sanitizing on
create/CSV import is a separate follow-up.
