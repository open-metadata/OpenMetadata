# An inherited data contract carries its approved parent's status

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Governance (OpenMetadata)
- **Guard:** `DataContractResourceIT.testTableInheritsApprovedSchemaContract`, `DataContractResourceIT.testTableKeepsSchemaContractStatusAfterValidationGivesItAnEmptyContract`, `DataContractResourceIT.testTableKeepsRejectedStatusOfItsEmptyContractOverSchemaContract`, `DataContractValidationAppIT.assetsInheritTheApprovedStatusOfTheDataProductContract`, `ContractTab.test.tsx`
- **Related:** #36658, supersedes ADR:2026-10-19-a-table-inherits-its-schemas-approved-data-contract

## Context
ADR:2026-10-19-a-table-inherits-its-schemas-approved-data-contract gave an entity with only an
inherited contract a `Draft` copy, so the contract's rules would not be enforced on it. Only an
approved parent is ever inherited, so every table under an approved schema showed its contract as
Draft: unreviewed and not in force. Stewards and consumers read that as the contract not applying.
Running validation on such a table stores an empty Draft contract to hold its results, and the
table then showed Draft again, without the parent's description.

## Decision
`DataContractRepository.getEffectiveDataContract` resolves the parent contract as before: the
entity's single Data Product's contract when it is **Approved**, otherwise, for a table, its
database schema's contract when it is **Approved**. The two are never merged with each other.

- An entity with only an inherited contract gets a copy with the **parent's status** (Approved).
  When the parent stops being Approved, the entity inherits nothing.
- The entity's own contract is merged over the parent: own fields win, rules are unioned, and
  inherited parts are flagged `inherited`. An own contract with **no rules or terms** of its own
  and status **Draft** or **Unprocessed** (the empty contract validation stores) reads with the
  parent's status. A status someone set on it, such as Rejected or In Review, is kept. Without a
  description of its own it reads with the parent's.
- `GET /v1/dataContracts/entity` is a read-only view. Writes diff against the stored contract
  (`GET /v1/dataContracts/{id}`): the UI's edit form and merge import load it first.

## Consequences
An approved schema or Data Product contract shows as Approved on every asset it governs, before
and after validation. The view and the stored contract can differ in status and description, so
any client that patches a contract must read the stored one. `RuleEngine` applies a contract's
semantics when the effective status is Approved; no write path enables that enforcement today. If
one does, an approved parent contract is enforced on every asset that inherits it, which is the
intent of approving it.
