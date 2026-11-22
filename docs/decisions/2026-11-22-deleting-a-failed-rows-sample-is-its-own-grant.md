# Deleting a failed rows sample is its own grant, advertised on testCase and gated per test case

- **Status:** Accepted
- **Revisions:** v1 2026-11-22 (initial)
- **Deciders:** Data Quality maintainers
- **Guard:** `CompiledRuleTest#editAllDoesNotSubsumeDeleteTestCaseFailedRowsSample`,
  `TestCaseResourceIT#failedRowsSampleDelete_isAdvertisedOnTestCaseAndEvaluatedPerEntity`,
  `TestCaseResourceIT#failedRowsSampleDelete_teamOwnerAllowed_explicitDenyWins`,
  `FailedTestCaseSampleData.test.tsx`, `FailedRowsSampleDeletePermissions.spec.ts`
- **Related:** #38366, #15878, #32074

## Context
`DELETE /v1/dataQuality/testCases/{id}/failedRowsSample` authorizes
`DeleteTestCaseFailedRowsSample`. That operation was chosen in review (#15878) over the Edit-prefixed
`EditSampleData`, so `EditAll` does not subsume it: rule matching lets `EditAll` cover only operations
whose name starts with `Edit`. The UI still gated the Manage → Delete menu on resource-level
`EditAll`. Editors saw a Delete that always returned 403, and owners, whom `OrganizationPolicy`
allows, never saw it because a resource-level `ConditionalAllow` reads as denied. The `testCase`
resource descriptor did not list the operation either, so no permissions response carried it and
the policy editor could not grant it on `testCase`.

## Decision
- The DELETE keeps authorizing `DeleteTestCaseFailedRowsSample`. `EditAll` intentionally does not
  imply it; only `All`, a rule naming it, or the owner rule (`All` + `isOwner()`) grants it.
- `TestCaseResource.getEntitySpecificOperations()` advertises it, as it does `EditStatus`, so
  policies can grant it on `testCase` and `/permissions/testCase/{id|name}` evaluates it.
- The UI shows the Delete action only when the test case's entity-level permission
  (`useTestCaseStore().testCasePermission`, already fetched by the test case page) allows the
  operation, read through `getDerivedPermissionFlags(...).can(...)`. It stays hidden while that
  permission loads.

## Consequences
A destructive right stays separate from edit rights, and existing allow or deny rules that name the
operation keep applying; switching the DELETE to an Edit-prefixed operation would silently void them.
The permissions payload for `testCase` gains one entry. A surface that mounts
`FailedTestCaseSampleData` without populating `useTestCaseStore` hides the action. Revisit if
deleting a sample should follow edit rights, which means a new Edit-prefixed operation plus a
migration of the rules that name this one.
