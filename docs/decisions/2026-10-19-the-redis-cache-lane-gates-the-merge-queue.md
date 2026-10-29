# The Redis cache lane gates the merge queue

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** the `merge-rules` ruleset lists `integration-tests-postgres-elasticsearch-redis` as a
  required check; reviewer for the workflow's skip-everything `pull_request` trigger
- **Related:** #35761 (the rollout, steps 1-4 below); #35769 (the PR trigger); #35672; #35722 (the
  rollback cache eviction that made this lane green)

## Context

`Integration Tests - PostgreSQL + Elasticsearch + Redis` runs every integration test with the Redis
entity cache on (`-Pcache-tests`). That is the configuration production servers with a Redis cache
run. The workflow already ran in every merge group, but its check was not required, so a failure
neither ejected the entry nor blocked the merge.

From 2026-10-16 to 2026-10-18, nine merge-group runs failed this lane. Four of those groups still
merged with it red: #35582, #35320, #35622 and #35679. The other five failed a required lane too,
or a later group replaced them. Seven of the nine runs failed only on this lane:

- `LLMModelResourceIT.test_tagUpdateOptimization_PATCH` (twice) and `_LargeScale`
- `WorkflowDefinitionResourceIT.test_approvalOnlyWorkflowApprovesTheEntity` (twice)
- `TableResourceIT.test_ownerPropagationToSearchIndex` and `test_ownerRemovalPropagationToSearchIndex`
- `DriveFileUploadIT.testUploadedSpreadsheetIsSearchableByExtractedText`

The other two also failed the required MySQL and OpenSearch lanes. #35672 broke the lane without
entering the queue, through a ruleset bypass, and the lane stayed red on `main` until #35722.

## Decision

`integration-tests-postgres-elasticsearch-redis` is a required check on `main`, like the MySQL and
OpenSearch integration checks. Like those workflows, this one triggers on `pull_request` and skips
every job there. The check then reports as skipped, which GitHub counts as passing, instead of
hanging at "Expected". It runs in the merge queue, where change detection still skips its lanes
when no backend path changed.

## Consequences

A merge group that breaks a cache path is ejected instead of merged.

- **Cost.** A passing run costs nothing new: the lanes already ran in every merge group, and a PR
  run starts no runner. A failure does cost: with `ALLGREEN` grouping and up to five entries built,
  each ejection rebuilds the entries behind it.
- **Bypass merges.** These skip required checks too, so for them the run on pushes to `main` stays
  the only Redis signal.

Require the check in this order:

1. Merge the trigger change, and make sure every open PR's head carries the check.
   - A PR whose last push predates the merge has no run; GitHub would hold it at "Expected".
   - Find such a PR with `gh api repos/open-metadata/OpenMetadata/commits/<head>/check-runs?check_name=integration-tests-postgres-elasticsearch-redis --jq .total_count`, which returns `0`.
   - Unblock it with a push, `gh pr update-branch <n>`, or a close and reopen.
2. Confirm that `main` passes this lane.
3. Fix or quarantine the failures listed above.
4. Add the check to the `merge-rules` required status checks, with integration id 15368 (GitHub
   Actions).
