# Context Center listings show and count only what the caller may read

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemorySearchVisibilityTest`
- **Related:** ADR:2026-10-15-search-admits-a-subjects-own-pending-memories-on-request

## Context

Release testing found the Context Center Memories page showing a reader another user's Shared
memory still awaiting review, and an admin another user's Draft. The listing asks search for every
stage it shows, and search admitted any requested stage to whoever could see the memory, or to
every admin. The plain list endpoint also kept the database's `paging.total` after dropping the
rows the caller may not read, so the total counted memories the caller cannot see.

## Decision

- A listing that asks for a stage awaiting review (`Unprocessed`, `Draft`) gets it for the
  caller's own memories only, admins included, exactly as a search asking for them already did.
  Reviewers of a conflict reach the memory through its review task; a direct read by id still
  follows the share rules, so that task keeps working.
- When the plain list drops rows the caller may not read, `paging.total` counts the memories the
  caller may read, over at most `MAX_VISIBLE_COUNT_SCAN` (10,000) rows; past that it is a lower
  bound, never a count of hidden rows.

## Consequences

An admin no longer moderates others' pending memories from the listing. A page that hides rows
costs one bounded extra read.
