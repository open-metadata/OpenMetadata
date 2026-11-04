# Fields inherit their entity's glossary terms as Derived labels; Propagated stays a stored lineage label

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `TagLabelUtilTest`, `EntityInheritedTermsTest`, `SearchRepositoryBehaviorTest`,
  `TablePureUtils.test.ts`, and `GlossaryTagChildPersistenceIT`
- **Related:** [#31756](https://github.com/open-metadata/OpenMetadata/issues/31756),
  [#31834](https://github.com/open-metadata/OpenMetadata/pull/31834),
  ADR:2026-10-09-glossary-tag-propagation-is-a-catalog-preference,
  `openmetadata-spec/src/main/resources/json/schema/type/tagLabel.json`

## Context

A glossary term on a table, topic or data model applies to every field beneath it, but fields read
back without it (#31756). Returning it on fields needs a label type with three properties:

- it is never stored, so a client that reads an asset and writes it back unchanged does not pin
  the term on every field;
- the mutual-exclusion check skips it;
- the search cascade can strip it from child documents without touching labels the fields hold in
  their own right.

An earlier revision of #31834 used `Propagated`. `tagLabel.json` defines `Propagated` as a label
propagated from upstream along lineage. The Collate Automator writes such labels through PATCH and
expects them to be stored. Treating `Propagated` as never stored dropped those writes, and made the
labels already stored impossible to remove.

## Decision

- An inherited term is a `Derived` copy computed on read. That is the type
  `EntityRepository#inheritTags` already gives the tags an entity inherits from its parent.
- The field's own label for the same term wins. An inherited term that conflicts with the field's
  own term under a mutually exclusive parent is skipped.
- `Derived` labels are never written to `tag_usage`, never exported to CSV, and exempt from the
  mutual-exclusion check. Only a field's own labels imply further tags.
- `Propagated` means propagated along lineage. It is the field's own label: stored, checked,
  exported and removable like `Manual`.
- The search tag cascade stamps inherited terms `Derived` on child documents, and removes only
  `Derived` labels.

## Consequences

Clients must not save a `Derived` label as the field's own. The UI keeps the type when it saves
field tags, and offers no remove action on a derived chip. A term's Assets tab lists every column
that inherits it.

The `labelType` description in `tagLabel.json` still names only tag-relationship derivation; this
record says what `Derived` covers.

Telling an inherited term apart from a term-implied tag would need a new `labelType` value, which
is a contract change for every client. Reusing `Propagated` for it is not an option.
