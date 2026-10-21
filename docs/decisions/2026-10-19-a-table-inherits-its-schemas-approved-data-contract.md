# A table inherits its schema's approved data contract, after its Data Product's

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Governance (OpenMetadata)
- **Guard:** `DataContractResourceIT.testTableInheritsApprovedSchemaContract`, `DataContractSchemaContract.spec.ts`
- **Related:** #35662

## Context
Customers with many tables want to set one contract on a database schema instead of one per
table. Inheritance existed only from a Data Product's contract, so a schema contract governed
nothing below it.

## Decision
`DataContractRepository.getEffectiveDataContract` resolves one parent contract for an entity:

1. its single Data Product's contract, when that contract is **Approved**; otherwise
2. for a **table**, its database schema's contract, when that contract is **Approved**.

The two are never merged with each other. The entity's own contract is merged over the parent the
same way it is for a Data Product parent (own fields win, rules are unioned, inherited parts are
flagged `inherited`). An entity with only an inherited contract gets it as a `Draft` copy, so its
rules are not enforced on the entity until the entity has its own approved contract. Only tables
inherit from a schema.

## Consequences
One approved schema contract now shows on, and is validated against, every table under it without
creating per-table contracts. A Data Product contract still takes precedence for its assets.
Extending schema inheritance to other children (stored procedures), or merging Data Product and
schema contracts together, is a new decision.
