# A test suite's basic flag and table association are immutable after creation

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** @TeddyCr
- **Guard:** `TestSuiteRepositoryTest#updaterPreservesSuiteAssociation`, `TestSuiteResourceIT#suitePatchKeepsTableAssociation`, `TestSuiteResourceIT#suitePutKeepsTableAssociation`
- **Related:** PR #38523; ADR:2026-11-24-a-test-suite-pipeline-matches-its-suites-table

## Context

A `TestSuite` is created either as a basic (table-scoped) suite with `basic = true` and a
`basicEntityReference` pointing to its table, or as a logical (bundle) suite with `basic = false`
and no `basicEntityReference`. Because test-suite pipelines and table relationships depend on that
association, allowing PATCH or PUT requests that edit other suite attributes (such as `description`)
to also alter or clear `basic` or `basicEntityReference` would detach a suite from its table or
invalidate its pipelines.

## Decision

- `TestSuite`'s `basic` and `basicEntityReference` fields are fixed at creation.
- On PATCH (`TestSuiteRepository.validatePatch`) and PUT
  (`TestSuiteRepository.TestSuiteUpdater.entitySpecificUpdate`), the server silently preserves the
  stored `basic` and `basicEntityReference` values and applies the rest of the update rather than
  rejecting the request.

## Consequences

- Callers editing descriptions, owners, domains, or other mutable attributes on a `TestSuite` cannot
  convert a basic suite into a logical suite, convert a logical suite into a basic suite, or
  retarget a basic suite to another table.
- Clients that send stale or cleared `basic` / `basicEntityReference` values alongside legitimate
  attribute edits continue to succeed without breaking existing update flows.
- Revisit if OpenMetadata introduces an explicit API operation to rebind a basic test suite to a
  different table.
