# A test suite pipeline belongs to a test suite and matches its table

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** @TeddyCr
- **Guard:** `IngestionPipelineRepositoryTest`, `DataContractPipelineTokenRefreshTest`, `TestSuiteResourceIT`, `LogicalTestSuitePipelineMigrationIT`
- **Related:** PR #38523; ADR:2026-11-24-a-test-suites-table-association-is-immutable

## Context

`TestSuite` ingestion pipelines carry an optional `sourceConfig.config.entityFullyQualifiedName`
field that tells the data quality runner which table to execute against. Previously, the server did
not check that a `TestSuite` pipeline belonged to a `TestSuite` parent, carried `TestSuite` source
configuration, or matched its owning suite's table. Callers could create or update a pipeline that
targeted a different table than its suite, or send the suite's own FQN on a logical test suite
pipeline, and deploy, run, toggle, or data-contract validation paths did not re-check stored rows
before talking to the ingestion runner.

## Decision

1. **Scope:** Validation applies whenever `pipelineType` is `TestSuite`
   (`IngestionPipelineRepository.validateTestSuiteConfig`).
2. **Parent and config contract:** A `TestSuite` pipeline must belong to a `TestSuite` parent and
   carry `sourceConfig.config.type = "TestSuite"`.
3. **Table association contract:**
   - For a basic test suite (`basic == true`), `basicEntityReference.fullyQualifiedName` must be
     present, and `sourceConfig.config.entityFullyQualifiedName` must either be omitted (`null`) or
     equal `basicEntityReference.fullyQualifiedName` exactly.
   - For a logical test suite (`basic != true`), `sourceConfig.config.entityFullyQualifiedName` must
     be omitted (`null`).
4. **Enforcement points:** The same check runs on repository preparation (create, PUT, PATCH with
   the pipeline's original `service` restored before preparation) and before every runner action:
   deploy, run, toggle, and data-contract DQ validation. Violations return HTTP 400 before calling
   the runner.
5. **Upgrade normalization:** `LogicalTestSuitePipelineMigration` (run once in `2.1.2` on both
   MySQL and PostgreSQL) creates `idx_test_suite_id` on `test_suite(id)`, strips
   `sourceConfig.config.entityFullyQualifiedName` from stored logical-suite pipelines, and aligns
   any mismatched non-null `sourceConfig.config.entityFullyQualifiedName` on stored basic-suite
   pipelines to `suite.basicEntityReference.fullyQualifiedName` (preserving omitted/`null` values
   and leaving basic suites without a `basicEntityReference.fullyQualifiedName` untouched).

## Consequences

- UI forms, Playwright fixtures, SDK callers, and ingestion clients must omit
  `entityFullyQualifiedName` when creating or updating logical test suite pipelines, and either omit
  it or pass the exact table FQN for basic test suites.
- Toggling a stored invalid pipeline fails with 400 before calling Airflow/Kubernetes, keeping the
  runner and stored `enabled` flag aligned.
- Revisit if a logical test suite pipeline ever needs to carry an explicit table target in
  `sourceConfig.config`.
