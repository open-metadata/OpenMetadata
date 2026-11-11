# A test-case write is authorized as a create or as an update of the stored test case

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** data quality backend
- **Guard:** `TestCaseCreateOrUpdateAuthorizationIT`
- **Related:** #36581, #36590, ADR:2026-10-24-any-authorization-honours-an-explicit-deny

## Context

`PUT /v1/dataQuality/testCases` checked one request set whether it created or updated: EditTests on
the table, or Create or EditAll on a context that loads the test case by name. Once `ANY` evaluated
every request (ADR:2026-10-24-any-authorization-honours-an-explicit-deny), that lookup ran for a test
case that did not exist yet and a non-admin PUT of a new test case answered 404. The same sets were
also copied into the ODCS contract import, and had drifted from PUT once.

## Decision

- **Creating** a test case (POST, a PUT of an FQN that does not exist, an ODCS import) needs
  CreateTests on the table OR Create on the test case, checked against the request.
- **Updating** an existing test case needs EditTests on the table OR Create or EditAll on the stored
  test case, looked up by its stored FQN.
- PUT decides which by looking the FQN up first. PUT and `ODCSTestCaseWriteGuard` build both sets
  from `TestCaseWriteAuthRequests`, so they cannot differ.

## Consequences

- A role whose only grant is EditTests on tables can no longer create a test case through PUT; it
  needs CreateTests, as it already did for POST.
- A permission change to test-case writes is made once, in `TestCaseWriteAuthRequests`.
