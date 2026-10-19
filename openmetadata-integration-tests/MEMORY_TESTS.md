# Memory regression tests

The cross-repo scenario matrix and manual sign-off stories live in
[ai-platform's memory release validation](https://github.com/open-metadata/ai-platform/blob/main/docs/memory-release-validation.md).

This repository owns:

- **03 visibility:** `ContextMemorySearchMatrixIT` executes the production lexical and vector
  visibility queries against a private native engine index. It covers owner, colleague, stranger,
  admin and unidentified caller; every status and scope; Private/Entity/Public/Shared visibility;
  direct-user/team/domain shares; and a legacy document without an indexed status. Existing
  `ContextMemoryAnchorIT` and `ContextMemoryIT` retain REST authorization and anchor-policy coverage.
- **06 evidence and 08 lifecycle:** `ContextMemoryQueryEvidenceIT`, lifecycle, permission and
  review-task ITs retain Query retirement, cascades, late links, grants and atomic review behavior.
- **13 durable extraction:** `ContextMemoryExtractionIT` uses real REST sources, persisted content,
  real queue rows and the actual extraction handler. Only the document provider is scripted. It
  covers autosave coalescing, unchanged hashes after rebuilding the worker, partial chunk failure,
  preserved published pills, successful retry, duplicate-file source reuse and last-source removal.
  It starts at canonical extracted text; actual blob upload/text extraction remains a live story.
- **13 ontology handoff:** `ContextMemoryDerivationIT` publishes memory, claims its lifecycle-queued
  job, scripts completion, reads the persisted proposal, redelivers the job and applies it through
  the Studio API. It checks the applied proposal's source IDs; glossary terms retain evidence on
  the proposal, while native ontology derivation relationships are covered by `NativeOntologyMemoryIT`.
- **16 upgrade:** `ContextMemoryStatusMigrationIT` executes shipped status/history migration SQL
  twice. Keep its legacy fixtures; new search tests do not replace a migration rehearsal.

The provider-mutating tests run in the global-state lane and pause/restart the managed worker
while driving persisted jobs deterministically. The native-index matrix requires the embedded
stack; an external-mode skip does not establish engine coverage.

```bash
make java_affected
make java_affected_run

# Focused native-engine matrix; run once for each profile.
mvn -B verify -pl :openmetadata-integration-tests -am -Dspring-boot.repackage.skip=true \
  -Ppostgres-opensearch -DintegrationTests.lane=parallel -Dit.test=ContextMemorySearchMatrixIT \
  -Dfailsafe.failIfNoSpecifiedTests=false -Dtest=NoUnitTestsInThisRun -Dsurefire.failIfNoSpecifiedTests=false

mvn -B verify -pl :openmetadata-integration-tests -am -Dspring-boot.repackage.skip=true \
  -Pmysql-elasticsearch -DintegrationTests.lane=global-state \
  -Dit.test=ContextMemoryExtractionIT,ContextMemoryDerivationIT \
  -Dfailsafe.failIfNoSpecifiedTests=false -Dtest=NoUnitTestsInThisRun -Dsurefire.failIfNoSpecifiedTests=false
```

Use `-Pmysql-elasticsearch` as well for the matrix and `-Ppostgres-opensearch` as well for the
workers. Check nonzero Failsafe reports for every selected class. A successful compile or an
engine-less `mvn test` is not integration evidence. Use a private Maven repository if another
agent is building on the same machine.
