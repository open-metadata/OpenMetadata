# A patch is authorized at every location it touches

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `JsonPatchUtilsTest`, `JsonUtilsTest.testTagLabelAppliedAtObjectOrArrayIsRefused`,
  `PatchAuthorizationIT`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`JsonPatchUtils.getMetadataOperations` picks the operations a PATCH needs. It read each
operation's `path` only, although `move` removes its `from` location and `copy` reads it. It took
the first segment with a mapped name anywhere in the path, so a map key such as a webhook header
named `description` selected EditDescription. It compared tag labels as one flat set, so moving a
label, or touching `tags` without a net change, needed no operation at all, and an empty patch
needed none either.

## Decision
- Every location an operation touches is authorized: `path`, and `from` for `move` and `copy`.
  A location that is missing or not a string counts as the document root (EditAll).
- A location that needs EditAll stands in for the other field operations, but the operations of
  the label changes are always added beside it, so a deny rule on EditTags, EditTier,
  EditGlossaryTerms or EditCertification still applies. Other narrower operations are not added:
  the seeded bot policies deny EditDisplayName outright, and an ingestion patch that rewrites an
  entity also fills in its display name, so naming EditDisplayName beside EditAll would refuse the
  whole patch. A deny on a narrower non-label operation therefore does not refuse a patch that also
  needs EditAll.
- A field name selects a narrower operation only where the entity's type declares that field
  (Jackson introspection of the entity class, cached per class). Below a map or an untyped
  object, a write needs EditAll. Without an entity class the first mapped name decides, as before.
- Tag labels are compared together with the JSON pointer of the object that carries them, on the
  entity built by the same `JsonUtils.applyPatch` call the repository stores. A label's operation
  follows its source first: a glossary term is EditGlossaryTerms whatever its glossary is called.
- A patch that touches tags without changing a label needs EditTags; an empty patch needs ViewBasic.
- The guards that inspect patch paths (`UserResource.patch`, notification templates) look at every
  touched location too.
- A date field refuses an object or array value instead of reading it as null.

## Consequences
Clients that send `move` or `copy` keep working when the caller may write both locations. The
server's own diffs (`JsonDiff`) emit only add, remove and replace. A configuration object that
needs a narrower operation than EditAll below a map has to declare that field in its schema.
