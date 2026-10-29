# A column's search entry carries only what ColumnSearchIndex builds

- **Status:** Accepted
- **Revisions:** v1 2026-10-08 (initial)
- **Deciders:** Mohit Yadav, Teddy Crépineau, Adrià Manero
- **Guard:** `SearchRepositoryBehaviorTest` (`propagateInheritedFieldsToChildrenKeepsTableClassificationTagsOffColumnEntries`,
  `propagateInheritedFieldsToChildrenSendsColumnEntriesOnlyTheTermsTheyInherit`);
  `AssetsTabSearchEntriesIT` (`tableClassificationTags_reachTestCasesNotColumnEntries`,
  `tableTerms_reachTestCases_andColumnEntriesOnlyAsInherited`)
- **Related:** collate #1526;
  ADR:2026-10-13-inherited-field-terms-are-derived-and-propagated-stays-lineage

## Context

A column's entry in `column_search_index` had two writers. `ColumnSearchIndex` builds it from the
column and its table: the column's own tags, plus the table's owners, domains, tier and
certification. Separately, a change to a table's tags or data products was copied by query onto
every child index of the table, column entries included. The two raced: a table's tags showed up
on its column entries about one time in eight, so columns appeared on the Assets tab of a tag or
glossary term they do not carry.

## Decision

- A column entry carries only what `ColumnSearchIndex` builds: the column's own tags, the glossary
  terms it inherits from its table (as `Derived` labels), and the table's owners, domains, tier and
  certification.
- A table's data products stop at the table, and of its tags only the glossary terms reach column
  entries: the data products propagation skips `tableColumn` (`PropagationDescriptor.skipping`),
  and the tags propagation carries it only the inherited terms
  (`PropagationDescriptor.inheritedTermsOnlyFor`). Child indexes that take a change differently are
  updated by requests of their own.
- Test cases keep inheriting the table's tags. Their entries are built from the test case itself,
  never from column entries, so this record does not change them.

## Consequences

- Searching a classification tag returns the columns that carry it, not every column of a table
  that does. A glossary term also returns the columns that inherit it from their table.
- Entries written before this change keep the leaked tags until they are rebuilt; every upgrade
  reindexes, which rebuilds them.
- A new field that a table hands down must say which child indexes it skips or narrows, if any.
