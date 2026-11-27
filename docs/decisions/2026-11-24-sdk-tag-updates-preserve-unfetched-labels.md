# Java SDK updates preserve unfetched tags

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `FluentAddTagPatchRegressionTest`, `FluentAddTagPatchIT`
- **Related:** [#38018](https://github.com/open-metadata/OpenMetadata/issues/38018), ADR:2026-11-14-a-patch-answers-with-the-tags-a-read-returns

## Context

A default GET or list response can omit tags that exist on the server. In JSON Patch,
adding an array at `/tags` replaces all stored labels. Changing the generated model
default to an empty list also makes a detached description edit look like an explicit clear.

## Decision

The Java SDK treats additions to an unfetched tag list as insertions. When it has no
tag baseline for a detached entity, a supplied nonempty list adds labels and an explicitly
supplied empty list clears them. An untouched tag list on a partially fetched entity
contributes no tag operation. Before editing a previously read label by index, the
patch checks its fully qualified name and source. A stale removal then fails safely
if another label has moved into that position.

## Consequences

Callers that intend to replace the stored set can fetch with `fields=tags` before
editing or send an explicit JSON Patch.
