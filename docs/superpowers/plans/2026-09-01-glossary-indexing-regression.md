# Glossary Indexing Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the 1.13 glossary rename indexing path so the glossary rename integration test passes in CI.

**Architecture:** Revert the `updateAssetIndexes` implementation introduced by the faulty backport to the established 1.13 implementation. The integration test remains unchanged and validates that child and grandchild glossary-term documents reflect the renamed glossary.

**Tech Stack:** Java 21, Maven, OpenMetadata integration tests, Elasticsearch/OpenSearch.

## Global Constraints

- Modify only `GlossaryRepository` production behavior; keep the existing regression test unchanged.
- Do not port post-commit deferral infrastructure from `main` to 1.13.
- Preserve the prior 1.13 imports and existing search reindexing behavior.

---

### Task 1: Restore the proven 1.13 glossary indexing implementation

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/GlossaryRepository.java:29-45,580-600`
- Test: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/GlossaryResourceIT.java:627-690`

**Interfaces:**
- Consumes: `GlossaryRepository.updateAssetIndexes(Glossary original, Glossary updated)` invoked during glossary FQN changes.
- Produces: reindexing of glossary terms and tagged assets without synchronously re-reading child terms before transaction commit.

- [ ] **Step 1: Establish the failing regression evidence**

Run the existing test in an integration-test environment:

```bash
mvn -pl openmetadata-integration-tests -Dit.test=GlossaryResourceIT#test_renameGlossaryPropagatesToChildTermSearchIndex verify
```

Expected before the change: the CI failure reports the child term document has the old glossary FQN/name after the 60-second Awaitility timeout.

- [ ] **Step 2: Restore the 1.13 implementation**

Replace the synchronous `updateEntity(updated.getEntityReference())`, child-term loop, and `updateGlossaryTermByFqnPrefix(...)` block with the exact 1.13 reindex flow:

```java
GlossaryTermRepository repository =
    (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
Set<String> targetFQNHashesFromDb =
    new HashSet<>(
        daoCollection
            .tagUsageDAO()
            .getTargetFQNHashForTagPrefix(updated.getFullyQualifiedName()));
List<GlossaryTerm> childTerms = getAllTerms(updated);

for (GlossaryTerm child : childTerms) {
  targetFQNHashesFromDb.addAll(
      daoCollection.tagUsageDAO().getTargetFQNHashForTag(child.getFullyQualifiedName()));
}

Map<String, EntityReference> targetFQNFromES =
    repository.getGlossaryUsageFromES(
        original.getFullyQualifiedName(), targetFQNHashesFromDb.size(), false);
List<EntityReference> childrenTerms =
    searchRepository.getEntitiesContainingFQNFromES(
        original.getFullyQualifiedName(),
        getTermCount(updated),
        GLOSSARY_TERM_SEARCH_INDEX);
for (EntityReference child : childrenTerms) {
  targetFQNFromES.putAll(
      repository.getGlossaryUsageFromES(
          child.getFullyQualifiedName(), targetFQNHashesFromDb.size(), false));
  searchRepository.updateEntity(child);
  searchRepository.getSearchClient().reindexAcrossIndices("tags.tagFQN", child);
}

searchRepository.updateEntityIndex(original);
searchRepository
    .getSearchClient()
    .reindexAcrossIndices("fullyQualifiedName", original.getEntityReference());
searchRepository
    .getSearchClient()
    .reindexAcrossIndices("glossary.name", original.getEntityReference());
```

Restore the matching `GLOSSARY_TERM_SEARCH_INDEX` and `HashSet` imports, and remove the backport-only `GLOBAL_SEARCH_ALIAS` and `TAGS_FQN` imports.

- [ ] **Step 3: Verify the regression test passes**

Run:

```bash
mvn -pl openmetadata-integration-tests -Dit.test=GlossaryResourceIT#test_renameGlossaryPropagatesToChildTermSearchIndex verify
```

Expected: PASS. If Docker-backed integration services are unavailable locally, compile the module and use the PR CI run as the authoritative integration execution.

- [ ] **Step 4: Run local structural verification**

Run:

```bash
mvn -pl openmetadata-integration-tests -am -DskipTests test-compile
git diff --check
```

Expected: Maven succeeds and `git diff --check` produces no output.

- [ ] **Step 5: Commit the implementation**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/GlossaryRepository.java
git commit -m "fix: restore 1.13 glossary indexing"
```

Expected: one production-file commit that removes the CI regression.
