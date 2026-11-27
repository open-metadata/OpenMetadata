# A data contract is in the domains of the entity it governs

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** Vamsi-klu
- **Guard:** `DataContractDomainAccessIT`
- **Related:** #38982, ADR:2026-11-03-a-create-is-authorized-against-its-stored-container,
  ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read

## Context
A data contract has no `domains` field. `hasDomain()` passes for a resource without domains, so
`DomainAccessDenyRule` never applied to contracts: a member of one domain could read, list, search
and edit the contract of another domain's table, while the table itself was refused to them. Two
ways out were weighed. Giving the schema an inherited `domains` field would add a field to the
entity, its search mapping, its UI and its clients, and would let a PATCH or PUT set a contract's
domains apart from its entity's. Deciding the contract on its entity's domains needs no stored
field and cannot drift from the entity.

## Decision
- Every policy condition that reads domains (`hasDomain()`, `noDomain()`, `matchAnyDomain()`)
  reads a contract's domains as the current domains of the entity it governs, inherited ones
  included. `ResourceContext.getDomains()` resolves them through
  `DataContractRepository.getGovernedEntityDomains`, so item reads, versions, results, PATCH,
  PUT, DELETE and the rows of the list and `/search` endpoints are decided alike.
- On create, the governed entity is the contract's container: `CreateResourceContext` counts its
  domains as container domains, so a domain-confined caller creates contracts only for entities
  in their domains.
- A PATCH keeps the entity a contract governs, so a contract cannot be moved onto another entity
  past the create check. A contract for another entity is a new contract.
- A contract of an entity in no domain is in no domain, and is decided as before.

## Consequences
A domain change on an entity applies to its contract on the next request, with no reindex or
migration. A domain condition on a contract costs one read of the governed entity's domains per
request, cached for the request; a listing reads one per row only when the caller's policies
contain a domain condition that can refuse a row. The contract document in the search index still
carries no domains, so search RBAC over the `dataContract` index does not apply domain conditions;
closing that needs the governed entity's domains in the document and a reindex when they change.
