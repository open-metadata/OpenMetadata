# A PATCH answers with the tags a read returns

- **Status:** Accepted
- **Revisions:** v1 2026-11-14 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `ServiceAttributePolicyIT.patchingTags_answersWithTheTagsTheAssetInherits`
- **Related:** ADR:2026-10-13-inherited-field-terms-are-derived-and-propagated-stays-lineage

## Context

The tag editor renders the entity returned by PATCH. Inherited tags are computed on read and
are not stored on the asset. Returning only the stored tags made inherited labels disappear
after an edit until the client fetched the entity again.

## Decision

A successful REST PATCH by id or name returns the entity's own tags, the tags they imply,
and the Derived tags inherited from its parents, as a GET with `fields=tags` does. This applies
to entities supporting tags, including edits that try to remove an inherited label.

A held change returns the entity as read, which already carries inherited tags. The internal
bulk-edit `patch(T, JsonPatch, ChangeActor)` overload is outside this response contract.

## Consequences

Clients can render the PATCH response without a corrective GET. Inherited tags remain
computed values; returning them does not persist them or record them as newly added labels.
