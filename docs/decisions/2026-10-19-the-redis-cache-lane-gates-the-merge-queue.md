# The Redis cache lane gates the merge queue

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** the `merge-rules` ruleset lists `integration-tests-postgres-elasticsearch-redis` as a
  required check; reviewer for the workflow's skip-everything `pull_request` trigger
- **Related:** #35672; #35722 (the rollback cache eviction that made this lane green)

## Context

`Integration Tests - PostgreSQL + Elasticsearch + Redis` runs every integration test with the Redis
entity cache on (`-Pcache-tests`). It already ran in every merge group, but its check was not
required, so a failure neither ejected the entry nor blocked the merge. Bugs that only show with
Redis therefore reached `main`, the configuration production servers with a Redis cache run. #35672
merged with `OntologyConceptResourceIT` and `OntologyPropertyResourceIT` failing on this lane only,
and the lane stayed red on `main` until #35722.

## Decision

`integration-tests-postgres-elasticsearch-redis` is a required check on `main`, like the MySQL and
OpenSearch integration checks. Like those workflows, this one triggers on `pull_request` and skips
every job there. The check then reports as skipped, which GitHub counts as passing, instead of
hanging at "Expected". It runs in the merge queue, where change detection still skips its lanes
when no backend path changed.

## Consequences

A merge group that breaks a cache path is ejected instead of merged. CI cost is unchanged: the
lanes already ran in every merge group, and a PR run starts no runner.

The lane's own flakes now eject entries too. Between 2026-10-16 and the #35672 merge, 9 of 156
completed merge-group runs failed. The 156 include runs whose change detection skipped the lanes.
The failures were:

- `LLMModelResourceIT.test_tagUpdateOptimization_*`, three times;
- `WorkflowDefinitionResourceIT.test_approvalOnlyWorkflowApprovesTheEntity`, twice;
- `DriveFileUploadIT.testUploadedSpreadsheetIsSearchableByExtractedText`, once.

Fix or quarantine these when the ruleset starts requiring the check.

Require the check only after three things hold:

1. this trigger change has merged, or every PR waits on a check that never reports;
2. `main` passes this lane, or every merge group fails;
3. the check is added to the ruleset's required checks with integration id 15368 (GitHub Actions).
