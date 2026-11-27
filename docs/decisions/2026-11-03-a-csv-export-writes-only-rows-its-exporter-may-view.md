# A CSV export writes only the rows its exporter may view

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** @sonika-shah
- **Guard:** `DatabaseSchemaResourceIT#test_exportLeavesOutTablesTheExporterMayNotView`, `TeamResourceIT#test_exportLeavesOutTeamsTheExporterMayNotView`
- **Related:** open-metadata/OpenMetadata#36077 (row checks on CSV import)

## Context

An export endpoint authorizes `ViewAll` on the entity named in the request. The rows it writes are
resolved afterwards inside the repository, and each carries owners, domains and tags of its own, so
a decision on the container says nothing about what lies below it.

## Decision

Every row of a CSV export is checked for `ViewAll` as the exporting user, the operation the export
endpoint requires of the container, and rows that fail are left out. `EntityRepository.retainViewableForExport`
does the check through `ViewPermissionFilter`, which loads the rows once per entity type with the
fields authorization reads; admins skip it. It applies to every `listAllForCSV` export, the team and
user hierarchy exports and the export of all metrics, synchronous and asynchronous alike.

A container that is left out takes its children with it in the exports that descend through it
(database → schema → table). The team and user exports walk the hierarchy first and check each row
on its own, so a viewable team below a hidden one is still written.

The test case export keeps its own filter (`DomainAccessFilter.retainAccessible`, searched through
the test case index), since test case reads are authorized through their table.

## Consequences

An export by a restricted user can be shorter than the same export by an admin, and re-importing it
does not touch the rows it left out. The check costs one batch load per entity type and export. A new
export that lists rows must pass them through `retainViewableForExport`.
