# A data contract only acts on the test suite named after its own id

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `DataContractTestSuiteOwnershipTest`, `DataContractResourceIT`
  (`testUpdateReleasesAnotherContractsTestSuite`, `testHardDeleteLeavesAnotherContractsTestSuite`),
  `CreateEntityToolTest` (`aDataContractCannotBeGivenFieldsItsRepositoryOwns`)

## Context

A data contract with quality expectations owns one logical test suite, created by
`DataContractRepository.getOrCreateTestSuite` and named after the contract's id
(`getTestSuiteName`), the same from 1.9 (when contracts got suites) to today. Test suites cannot be
renamed. The repository found that suite through the contract's `testSuite` reference, then deleted
it when the expectations were removed or the contract was hard-deleted, and added or removed its
tests on every update. REST never takes that reference from a caller (`CreateDataContract` has no
`testSuite`), but MCP `create_entity` binds the `DataContract` entity class, which does, along with
`latestResult`, `contractUpdates` and `inherited`.

## Decision

- Creating a contract clears `testSuite`, `latestResult`, `contractUpdates` and `inherited`: a new
  contract owns no suite, result or history yet, and is never a virtual inherited contract.
- `DataContractRepository` follows a stored `testSuite` reference only when the suite it points to
  is named after the contract's id (`isOwnSuite`). Any other suite is never deleted or edited.
- Updating a contract that stores another contract's suite drops that reference and the suite's
  `CONTAINS` link back to the contract, so the suite's runs stop writing this contract's results.
  A contract with expectations then gets its own suite.
- MCP `create_entity` and `describe_entity_type` do not offer those four fields for a data contract.

## Consequences

- Contract suites must keep being named after the contract id. Changing that needs a new record and
  a migration of the stored references.
- A contract that already stored another suite's reference keeps it, and the suite's link back,
  until its next update or hard delete (which removes all of the contract's links). Until then
  `deployAndTriggerDQValidation` still follows the raw reference: it runs that suite's pipeline.
