/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_DEFINITION;
import static org.openmetadata.service.Entity.TEST_SUITE;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;

/**
 * Finds and hard-deletes test cases whose core {@code entity_relationship} rows are missing:
 *
 * <ul>
 *   <li>no {@code testDefinition -> testCase} CONTAINS relationship — the test case can no longer
 *       resolve its definition, which breaks search indexing (the doc build throws
 *       "does not have expected relationship" / NPEs on a null testDefinition);
 *   <li>no live, executable (basic) {@code testSuite -> testCase} CONTAINS relationship — surfaces
 *       as "No executable test suite was found for testCase ...".
 * </ul>
 *
 * <p>This complements {@link OrphanTestCaseCleanup} (which keys off the string {@code entityLink})
 * and {@link EntityRelationshipCleanup} (which removes rows whose endpoints are gone). Here the test
 * case row still exists but is unusable because a relationship row it depends on is absent.
 *
 * <p>Deletion first tries {@link Entity#deleteEntity} with {@code recursive=true, hardDelete=true},
 * which cascades the test case's {@code testCaseResult} time-series rows. A test case with a missing
 * {@code testDefinition} relationship can't be deleted that way — the delete path resolves the
 * relationship and throws the same "does not have expected relationship" error — so it falls back to
 * a direct delete of the test case's footprint (results, relationship rows, search doc, row).
 * Soft-deleted test cases are skipped (the operator kept them on purpose).
 */
@Slf4j
public class OrphanTestCaseRelationshipCleanup {

  private final CollectionDAO collectionDAO;
  private final boolean dryRun;

  public OrphanTestCaseRelationshipCleanup(CollectionDAO collectionDAO, boolean dryRun) {
    this.collectionDAO = collectionDAO;
    this.dryRun = dryRun;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Result {
    private int totalScanned;
    private int missingTestDefinitionDeleted;
    private int missingTestDefinitionFailures;
    private int missingExecutableSuiteDeleted;
    private int missingExecutableSuiteFailures;
  }

  public Result performCleanup(int batchSize) {
    LOG.info(
        "Starting test case relationship cleanup. Dry run: {}, Batch size: {}", dryRun, batchSize);
    Result result = Result.builder().build();
    Map<UUID, Boolean> executableSuiteCache = new HashMap<>();

    int offset = 0;
    while (true) {
      List<String> jsonBatch =
          collectionDAO
              .testCaseDAO()
              .listAfterWithOffset(collectionDAO.testCaseDAO().getTableName(), batchSize, offset);
      if (nullOrEmpty(jsonBatch)) {
        break;
      }
      List<TestCase> testCases = parseTestCases(jsonBatch);
      result.setTotalScanned(result.getTotalScanned() + testCases.size());

      int deletedInBatch = cleanupBatch(testCases, executableSuiteCache, result);

      if (jsonBatch.size() < batchSize) {
        break;
      }
      // Hard deletes shift subsequent rows backward, so only advance past the rows we kept.
      offset += batchSize - deletedInBatch;
    }

    LOG.info(
        "Test case relationship cleanup done. Scanned: {}, Missing-definition deleted: {}, "
            + "failed: {}, Missing-executable-suite deleted: {}, failed: {}",
        result.getTotalScanned(),
        result.getMissingTestDefinitionDeleted(),
        result.getMissingTestDefinitionFailures(),
        result.getMissingExecutableSuiteDeleted(),
        result.getMissingExecutableSuiteFailures());
    return result;
  }

  private int cleanupBatch(
      List<TestCase> testCases, Map<UUID, Boolean> executableSuiteCache, Result result) {
    List<String> ids = testCases.stream().map(tc -> tc.getId().toString()).toList();
    Set<String> withDefinition = toIdsWithRelationship(ids, TEST_DEFINITION);
    Map<String, List<UUID>> suiteIdsByTestCase = suiteIdsByTestCase(ids);

    int deletedInBatch = 0;
    for (TestCase testCase : testCases) {
      String id = testCase.getId().toString();
      if (!withDefinition.contains(id)) {
        deletedInBatch += handleOrphan(testCase, result, true);
      } else if (!hasLiveExecutableSuite(suiteIdsByTestCase.get(id), executableSuiteCache)) {
        deletedInBatch += handleOrphan(testCase, result, false);
      }
    }
    return deletedInBatch;
  }

  /**
   * Records and (unless dry run) deletes one orphan. Returns 1 if a row was actually removed (so the
   * caller can adjust its paging offset), 0 otherwise.
   */
  private int handleOrphan(TestCase testCase, Result result, boolean missingDefinition) {
    boolean removed = !dryRun && deleteOrphan(testCase);
    int rowsRemoved = 0;
    if (dryRun || removed) {
      if (missingDefinition) {
        result.setMissingTestDefinitionDeleted(result.getMissingTestDefinitionDeleted() + 1);
      } else {
        result.setMissingExecutableSuiteDeleted(result.getMissingExecutableSuiteDeleted() + 1);
      }
      if (removed) {
        rowsRemoved = 1;
      }
    } else {
      if (missingDefinition) {
        result.setMissingTestDefinitionFailures(result.getMissingTestDefinitionFailures() + 1);
      } else {
        result.setMissingExecutableSuiteFailures(result.getMissingExecutableSuiteFailures() + 1);
      }
    }
    return rowsRemoved;
  }

  private Set<String> toIdsWithRelationship(List<String> testCaseIds, String fromEntityType) {
    List<EntityRelationshipObject> records =
        collectionDAO
            .relationshipDAO()
            .findFromBatch(testCaseIds, Relationship.CONTAINS.ordinal(), fromEntityType, TEST_CASE);
    Set<String> withRelationship = new HashSet<>();
    for (EntityRelationshipObject record : records) {
      withRelationship.add(record.getToId());
    }
    return withRelationship;
  }

  private Map<String, List<UUID>> suiteIdsByTestCase(List<String> testCaseIds) {
    List<EntityRelationshipObject> records =
        collectionDAO
            .relationshipDAO()
            .findFromBatch(testCaseIds, Relationship.CONTAINS.ordinal(), TEST_SUITE, TEST_CASE);
    Map<String, List<UUID>> suiteIdsByTestCase = new HashMap<>();
    for (EntityRelationshipObject record : records) {
      suiteIdsByTestCase
          .computeIfAbsent(record.getToId(), k -> new ArrayList<>())
          .add(UUID.fromString(record.getFromId()));
    }
    return suiteIdsByTestCase;
  }

  /**
   * A test case has a usable executable suite when at least one of its linked test suites still
   * exists and is {@code basic} (the executable suite). Mirrors {@code
   * TestCaseRepository.findExecutableTestSuiteForTestCase}, but without the read-time self-heal so
   * a dry run has no side effects.
   */
  private boolean hasLiveExecutableSuite(List<UUID> suiteIds, Map<UUID, Boolean> cache) {
    boolean hasExecutableSuite = false;
    if (suiteIds != null) {
      for (UUID suiteId : suiteIds) {
        if (cache.computeIfAbsent(suiteId, this::isLiveExecutableSuite)) {
          hasExecutableSuite = true;
          break;
        }
      }
    }
    return hasExecutableSuite;
  }

  private boolean isLiveExecutableSuite(UUID suiteId) {
    boolean executable;
    try {
      TestSuite testSuite = Entity.getEntity(TEST_SUITE, suiteId, "", ALL);
      executable = Boolean.TRUE.equals(testSuite.getBasic());
    } catch (EntityNotFoundException ex) {
      // Relationship points at a hard-deleted suite — not a usable executable suite.
      executable = false;
    } catch (Exception ex) {
      // Unexpected lookup error: be conservative and treat the suite as present so a transient
      // failure can't cause us to delete a valid test case.
      LOG.debug("Skipping executable-suite check for suite {}: {}", suiteId, ex.getMessage());
      executable = true;
    }
    return executable;
  }

  private List<TestCase> parseTestCases(List<String> jsonBatch) {
    List<TestCase> testCases = new ArrayList<>(jsonBatch.size());
    for (String json : jsonBatch) {
      try {
        TestCase testCase = JsonUtils.readValue(json, TestCase.class);
        // Skip soft-deleted test cases — kept on purpose, and the cascade would no-op anyway.
        if (!Boolean.TRUE.equals(testCase.getDeleted())) {
          testCases.add(testCase);
        }
      } catch (Exception ex) {
        LOG.warn("Skipping unparseable test case row: {}", ex.getMessage());
      }
    }
    return testCases;
  }

  private boolean deleteOrphan(TestCase testCase) {
    UUID id = testCase.getId();
    boolean deleted;
    try {
      Entity.deleteEntity(Entity.ADMIN_USER_NAME, TEST_CASE, id, true, true);
      deleted = true;
    } catch (Exception ex) {
      // The standard delete resolves the test case's relationships; for a missing
      // testCase->testDefinition relationship that resolution itself throws "does not have expected
      // relationship", so a broken test case cannot be removed the normal way. Fall back to a
      // direct
      // delete of its DB footprint (the whole reason this cleanup exists).
      LOG.warn(
          "Standard delete failed for test case {} ({}); falling back to direct cleanup",
          id,
          ex.getMessage());
      deleted = forceDelete(testCase);
    }
    return deleted;
  }

  private boolean forceDelete(TestCase testCase) {
    UUID id = testCase.getId();
    boolean deleted;
    try {
      // Drop the search doc by id (no-op when the broken test case was never indexed; this does not
      // rebuild the doc, so it won't re-trigger the relationship resolution).
      try {
        Entity.getSearchRepository().deleteEntityIndex(testCase);
      } catch (Exception ex) {
        LOG.debug("Search-index cleanup skipped for test case {}: {}", id, ex.getMessage());
      }
      // Remove its test results (and any rows by FQN), all relationship rows, then the row itself.
      collectionDAO
          .testCaseResultTimeSeriesDao()
          .delete(
              testCase.getFullyQualifiedName(), TestCaseResultRepository.TESTCASE_RESULT_EXTENSION);
      collectionDAO.relationshipDAO().deleteAll(id, TEST_CASE);
      collectionDAO.testCaseDAO().delete(collectionDAO.testCaseDAO().getTableName(), id);
      deleted = true;
    } catch (Exception ex) {
      LOG.warn("Force delete failed for test case {}: {}", id, ex.getMessage());
      deleted = false;
    }
    return deleted;
  }
}
