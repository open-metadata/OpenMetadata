# A bulk edit authorizes each entity it touches as that entity's own PATCH

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `AssetsTabAuthorizationIT`; `EntityPatchBatchTest`
- **Related:** collate #1526; ADR:2026-10-09-bulk-edits-compose-single-entity-writes

## Context

A bulk edit can be authorized once for the whole request, from the entity type or from the page it
is made on, or once for each entity it changes. Policies are written against single entities: a
rule can depend on the entity's owners, tags, domain or service, and the operation a PATCH needs
depends on the fields it touches. Only a check made per entity, with the patch that entity receives,
evaluates the rules the way the entity's own page does.

## Decision

- Each entity a bulk edit touches is authorized as its PATCH would be: the operations come from that
  entity's patch (`OperationContext(type, patch)`), and the resource is the loaded entity
  (`ResourceContext`), so conditions see its owners, tags and domains. A column picked on an Assets
  tab is authorized as its table's PATCH.
- A page-level check, such as edit permission on the domain or data product whose Assets tab is
  used, may be added on top of the per-entity check, never instead of it.
- An entity the requester may not edit is reported as a failed row with the authorization message,
  and keeps no change; the other entities of the request go on. The request itself is not refused.
- A dry run authorizes too, so its preview reports the rows the real run would refuse.
- One `BulkFieldHydrator` per group of entities. The entities are loaded with every patch field,
  tags included, so policy conditions read them as loaded.

## Consequences

- The result of a bulk edit follows each entity's rules. A row refused by a rule is reported on its
  own, and a row a conditional rule allows, for example to the entity's owner, is saved.
- Authorization runs once per entity: one policy evaluation each, with the group sharing the field
  loads.
- A bulk feature that bypasses `EntityPatchBatch` must make the same per-entity check itself.
