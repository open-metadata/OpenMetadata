# Legacy inverse reference updates preserve existing edge meaning

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial) · v2 2026-11-18 (prevent named references becoming legacy)
- **Deciders:** Contribution author, subject to maintainer review
- **Guard:** `RelationshipTypeLegacyInverseIT`, `RelationshipTypeRepositoryTest`, `RelationshipTypeRepositoryUpdaterTest`
- **Related:** open-metadata/OpenMetadata#38113

## Context

REST-created relationship types can contain an inverse ID/FQN without its name. Inverse resolution
uses the name; canonical glossary edge storage orders the UUID endpoints but cannot flip the type
while that name is missing. Adding names fixes newly authored pairs. Resaving an old pair, however,
can enable inversion without rewriting its stored edges and change an old source-side type from A
to B. Current metadata cannot safely classify every historical edge: healthy and incorrectly
canonicalized edges can have similar shapes, and later edits or migrations can change source data.

## Decision

- New pairs carry resolved inverse names.
- A missing name on an ID-stamped reference resolves by authoritative ID, including self IDs. Do
  not fall back to a supplied FQN when that ID is unknown. Already named and unresolved pre-stamped
  references keep their batch-registration behavior. A non-null inverse on a previously named
  definition must not lose its name, even when a caller bypasses prepare.
- For an existing nameless inverse, an unchanged or omitted inverse on PUT preserves the entire
  stored reference. Unrelated PATCH edits preserve it too, including FQN-only references hydrated
  during prepare.
- Explicit non-self activation, retargeting or removal of that legacy inverse is rejected with 400
  and an instruction to review and repair historical relations. Requests must not erase the legacy
  marker or silently change the meaning of stored edges.
- A genuinely self inverse may acquire its own name: A remains A under inversion. Both effective
  name and identity must designate the owning type; a self ID with another name is insufficient.
- There is no no-rows exception. A usage query can race an edge writer that already read the old
  definition. Supporting that exception would require coordinated fresh locking reads and a fence
  shared by definition updates and edge writers, held through persistence.
- Apply the guard once against the actual request baseline per updater transaction attempt, and
  reset it on retry. Consolidation replays older versions without redefining the request's intent.
- Do not add a read fallback, automatic migration, edge rewrite or authorization exception.

## Consequences

Ordinary form saves and unrelated edits remain usable while existing term perspectives and stored
rows are preserved. Named definitions retain intentional inverse removal and retargeting; partial
reference edits cannot turn them into nameless legacy definitions. The conservative policy
also restricts empty legacy definitions; it does not claim to repair historical data. A future
repair workflow must establish original intent and coordinate activation with edge reconciliation.
The rejection points to a separate reviewed repair mechanism. Reviewing or deleting rows alone is
not an override that makes the same PATCH succeed.
