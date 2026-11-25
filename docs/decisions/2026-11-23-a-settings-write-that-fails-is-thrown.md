# A settings write that fails is thrown, never answered with a response the caller can ignore

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `OpenMetadataOperationsSecurityConfigTest` (an authorizer that cannot be stored makes `update-security-config` exit 1)
- **Related:** PR #38315

## Context
`SystemRepository.createOrUpdate` answered a write it could not store with a 500 `Response`.
`updateSetting` wraps the failure in `CustomExceptionMessage`, which extends the SDK's
`WebServiceException`, a `RuntimeException` and not a `WebApplicationException`, so the clauses that
rethrow a refusal miss it and the catch-all answered 500.
Most callers are not REST endpoints: the `update-security-config` and other administration
commands, startup code, and Collate's administration jobs and Slack and Teams installs. They ignored
the response and reported the setting as stored. An authorizer without
`enableSecureSocketConnection` was never stored, yet `update-security-config` exited 0.

## Decision
- `createOrUpdate` throws a write that fails: a 400 when the value is refused, a 500 otherwise. A
  response it returns always means the setting was stored (200 or 201).
- A caller that must carry on after a failed write catches the exception and says so. The startup
  merge of default search settings does: it logs the failure and keeps the stored settings.

## Consequences
A failed write can no longer be reported as a success by a caller that forgets to check a status
code. REST endpoints answer the same status as before, through the exception mapper. A new caller
that wants to tolerate a failure has to catch it explicitly.
