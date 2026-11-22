# Context Memory can be shared with a persona

- **Status:** Accepted
- **Revisions:** v1 2026-11-22 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ContextMemoryPersonaSharingIT`
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/38419

## Context

Persona members need access to the same Context Memories as their assignments change. Storing
the members on each memory would leave obsolete grants in both the catalog and search index.

## Decision

A memory sharing list can name a live persona by its entity reference. REST and search match the
persona ID against the caller's current direct assignments, team-inherited assignments, and
explicit user default. They read these relationships fresh and exclude deleted personas.

A system default supplies a persona when a user lacks a preference. Including that fallback in
sharing would grant access to users outside the persona's membership.

## Consequences

A membership change takes effect on the next read. The stored memory and its search document
continue to reference the persona, so membership changes require no memory update or reindex.
