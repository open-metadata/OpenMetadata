# Database schema CSV exports select top-level entity types

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** OpenMetadata contributors
- **Guard:** `DatabaseSchemaResourceIT`, `CsvExportMultiNodeIT`, `CsvImportExportJobHandlerTest`, and the browser download case in `BulkImport.spec.ts`
- **Related:** [#28662](https://github.com/open-metadata/OpenMetadata/issues/28662)

## Context

A database schema CSV export lists both tables and stored procedures. Its existing `recursive` option controls whether the CSV contains column rows and uses the typed format. Users need to export one type without loading rows of the other type.

## Decision

The synchronous and asynchronous database schema exports accept an optional `entityTypes` query parameter. Clients can repeat the parameter or supply a comma-separated list of `table` and `storedProcedure`. The server trims whitespace and deduplicates values. Omitting the parameter or selecting both returns both asset types in the existing order. Blank segments and unsupported values are invalid. Columns are selected through `recursive` as children of tables.

`recursive=false` retains the legacy header, which carries table and stored-procedure metadata without asset types, FQNs or procedure code. Importing the legacy format treats each row as a table. `recursive=true` includes columns for selected tables and carries typed rows with FQNs and stored-procedure code for recursive import. A valid selection with no visible assets returns the header.

The schema export dialog offers **All**, **Tables and columns**, **Tables only**, and **Stored procedures**. **All** uses the existing recursive export. **Tables only** uses the legacy format. **Stored procedures** uses the recursive format. The job still exposes its result in the background jobs tray.

For example, `GET /api/v1/databaseSchemas/name/warehouse.analytics.%22daily%20reports%22/export?entityTypes=storedProcedure&recursive=true` exports the procedures in the named schema.

## Consequences

The job stores a normalized selector only for an explicit single type. Older unfiltered jobs remain readable and new unfiltered jobs use the compatible payload. Update API nodes and workers before enabling scoped requests. An older API node may ignore the parameter. The previous worker rejects the explicit selector as an unknown job property. Finish or cancel scoped jobs before rolling back.

The worker rechecks schema access and applies per-row authorization as the saved requester. Result ownership and download authorization follow the existing CSV job policy. See ADR:2026-11-03-a-csv-export-writes-only-rows-its-exporter-may-view.
