# Every read path checks the fields it returns

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-04 (hydrate serves lineage data assets only)
- **Deciders:** Mohit Yadav
- **Guard:** `ViewOperationsTest`, `LineageHydrateIT.hydrateChecksTheViewOperationsOfTheRequestedFields`,
  `LineageHydrateIT.hydrateRefusesTypesWhoseOwnReadsRedact`,
  `DomainIsolationIT.test_columnAndLineageHydrateOfAnotherDomainsTable_areDenied`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
A GET of `/{collection}/{id}?fields=…` needs the view operation of each field (ViewTests for
custom metrics, ViewUsage for usage, ViewAll for an unmapped field) and authorizes an entity
loaded with the attributes policy conditions read. `POST /lineage/hydrate`, the column read and
the ontology endpoints return the same fields by other paths, so each applies the checks of the
GET it mirrors, on an entity loaded the same way.

## Decision
- `ViewOperations.forFields(type, fields)` is the one mapping from requested fields to view
  operations. `EntityResource.getViewOperations` and the lineage hydrator both use it.
- A caller that loads an entity itself and authorizes on that copy loads it with
  `ResourceContext.authorizationFields(repository[, requested])` (owners, domains, reviewers,
  certification, plus what the request needs), or authorizes by id.
- Hydrate loads each entity that way, keeps it only if the caller holds every operation its fields
  need (`ViewPermissionFilter.retainPermitted`), and trims it back to the requested fields, so the
  response matches the entity's own GET. Denied entities are dropped and counted.

## Consequences
A field restricted on GET is restricted on hydrate. The pre-resolved `ResourceContext`
constructor still trusts the entity it is given; a new call site must load the authorization
fields or pass an id.

## Amendment (v2, 2026-11-04)
Several GETs also redact what they return, beyond their field checks. A service's GET drops its
connection for callers without EditAll, a user's drops a basic-auth password hash and masks
emails, an MCP server's masks its environment, arguments and URL, and ingestion pipelines and
workflows redact their secrets. Rather than repeat each type's redaction, hydrate is limited to
the types lineage needs.

Hydrate serves only the data assets lineage draws as nodes (`LineageHydrator.HYDRATABLE_TYPES`:
table, topic, dashboard, data model, chart, pipeline, ML model, container, search index, stored
procedure, API endpoint, metric, and the drive directory, file, spreadsheet and worksheet), whose
GETs redact nothing beyond the field checks above. A request naming any other type is refused with
400 and the caller reads that entity from its own endpoint. A type joins the list only while its
own GET adds no redaction; otherwise hydrate would have to apply it too.
