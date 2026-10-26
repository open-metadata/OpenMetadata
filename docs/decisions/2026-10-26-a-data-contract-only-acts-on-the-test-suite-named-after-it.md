# A data contract only acts on the test suite named after its own id

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `DataContractTestSuiteOwnershipTest`, `DataContractResourceIT`
  (`testUpdateReleasesAnotherContractsTestSuite`, `testHardDeleteLeavesAnotherContractsTestSuite`,
  `testPutRestoringASoftDeletedContractKeepsItsOwnSuite`,
  `testNoOpPatchStoresTheReleasedContractsOwnSuite`),
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

- Creating a contract clears `latestResult`, `contractUpdates` and `inherited`: a new contract has
  no result or history yet, and is never a virtual inherited contract. It drops a `testSuite`
  reference only to a suite it does not own: a PUT that creates runs `prepare` twice, and the first
  pass has already created the contract's own suite.
- `DataContractRepository` follows a stored `testSuite` reference only when the suite it points to
  is named after the contract's id (`isOwnSuite`). Any other suite is never deleted, edited or run.
- Updating a contract that stores another contract's suite drops that reference and the suite's
  `CONTAINS` link back to the contract, so the suite's runs stop writing this contract's results.
  A contract with expectations then gets its own suite. The link is removed in `postUpdate`, after
  the update is authorized and stored, because a PUT runs `prepare` before it authorizes.
- A PUT that restores a soft-deleted contract finds it with `Include.ALL`, as the upsert does, so
  it keeps that contract's id and suite instead of making a suite named after a fresh id.
- Only `prepare` creates a contract's suite, since it also stores the reference. `postCreate` and
  `postUpdate` only find it: a result update reaches them without `prepare`, and a suite created
  there would not be stored on the contract. The updater compares `testSuite` on every update,
  whichever fields a PATCH names, so a suite `prepare` swapped in is always stored.
- MCP `create_entity` and `describe_entity_type` do not offer those four fields for a data contract.

## Consequences

- Contract suites must keep being named after the contract id. Changing that needs a new record and
  a migration of the stored references.
- A contract that already stored another suite's reference keeps it, and the suite's link back,
  until its next update (follow, vote and result updates leave both alone) or hard delete, which
  removes all of the contract's links. Until then, validating it aborts with "does not have a test
  suite defined" instead of running that suite's pipeline.
