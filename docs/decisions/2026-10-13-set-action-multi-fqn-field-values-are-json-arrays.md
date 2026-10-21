# A Set Action node stores several tag or glossary-term FQNs as a JSON array

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** anuj-kumary
- **Guard:** `EntityFieldUtilsTest.parseFqnListReadsJsonArraysAndLegacyCommaLists`, `WorkflowSerializationUtils.test.ts`
- **Related:** open-metadata/openmetadata-collate#7368, #35365

## Context
A `setEntityAttribute` node's `fieldValue` for `tags` and `glossaryTerms` used to be a comma-joined
string, and both the workflow builder and `EntityFieldUtils` split it on `,`. Commas are legal in
entity names, so an FQN such as `Data Procedures.GDPR, Personal` was split into fragments that did
not resolve and were dropped while the workflow still reported success.

## Decision
- A multi-value FQN `fieldValue` is a JSON array of strings, e.g. `["Data Procedures.GDPR, Personal","PII.Sensitive"]`.
  An empty selection is the empty string.
- Readers (`parseFqnList` in `WorkflowSerializationUtils.ts` and `EntityFieldUtils`) read a value
  that does not parse as a JSON array as a legacy comma-separated list.
- `TaskWorkflowHandler` serializes non-string payload values as JSON before passing them to
  `EntityFieldUtils.setEntityField`, so a list payload reaches it as a JSON array too.

## Consequences
Any client that writes workflow definitions must write the JSON array for these fields; a
comma-joined value still works only for FQNs without commas. A legacy value that already joined a
comma-bearing FQN cannot be repaired, because the original boundaries are lost; reselecting the term
fixes it. Dropping the legacy fallback would need a migration that rewrites stored definitions.
