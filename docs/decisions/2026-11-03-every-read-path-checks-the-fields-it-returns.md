# Every read path checks the fields it returns

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `ViewOperationsTest`, `LineageHydrateIT.hydrateChecksTheViewOperationsOfTheRequestedFields`,
  `DomainIsolationIT.test_columnAndLineageHydrateOfAnotherDomainsTable_areDenied`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
A GET of `/{collection}/{id}?fields=…` needs the view operation of each field (ViewTests for
custom metrics, ViewUsage for usage, ViewAll for an unmapped field) and authorizes an entity
loaded with the attributes policy conditions read. `POST /lineage/hydrate` returned the requested
fields after a ViewBasic check, on entities loaded with only those fields, so a condition on
domains saw none. The column read and the ontology endpoints also authorized copies they had
loaded without domains.

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
