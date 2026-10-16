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

import static org.openmetadata.schema.type.Include.ALL;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

/**
 * Finds and hard-deletes test cases whose entityLink targets a non-existent entity. This is the
 * counterpart to {@link EntityRelationshipCleanup}: that utility cleans rows in
 * {@code entity_relationship} whose endpoints are gone, but test cases also carry a string-based
 * {@code entityLink} pointer to a table/column that the relationship cleaner can't reason about.
 * Without this pass, those orphans break search indexing with "Error occurred when retrieving
 * executable test suite for testCase ..." errors.
 */
@Slf4j
public class OrphanTestCaseCleanup {

  private final CollectionDAO collectionDAO;
  private final boolean dryRun;

  public OrphanTestCaseCleanup(CollectionDAO collectionDAO, boolean dryRun) {
    this.collectionDAO = collectionDAO;
    this.dryRun = dryRun;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class OrphanTestCaseResult {
    private int totalScanned;
    private int orphansFound;
    private int orphansDeleted;
    private int failures;
  }

  public OrphanTestCaseResult performCleanup(int batchSize) {
    LOG.info("Starting orphan test case cleanup. Dry run: {}, Batch size: {}", dryRun, batchSize);
    OrphanTestCaseResult result = OrphanTestCaseResult.builder().build();

    int offset = 0;
    while (true) {
      List<String> jsonBatch =
          collectionDAO
              .testCaseDAO()
              .listAfterWithOffset(collectionDAO.testCaseDAO().getTableName(), batchSize, offset);
      if (jsonBatch == null || jsonBatch.isEmpty()) {
        break;
      }
      List<TestCase> testCases = parseTestCases(jsonBatch);
      result.setTotalScanned(result.getTotalScanned() + testCases.size());

      List<UUID> orphans = findOrphans(testCases);
      result.setOrphansFound(result.getOrphansFound() + orphans.size());

      int deletedInBatch = 0;
      if (!dryRun) {
        for (UUID id : orphans) {
          if (deleteOrphan(id)) {
            deletedInBatch++;
            result.setOrphansDeleted(result.getOrphansDeleted() + 1);
          } else {
            result.setFailures(result.getFailures() + 1);
          }
        }
      }

      if (jsonBatch.size() < batchSize) {
        break;
      }
      // Each successful delete shifts every subsequent row backward by one, so advancing the
      // offset by the full batchSize would skip exactly that many rows. Subtract the deletes
      // we just made so the next read picks up where we actually stopped.
      offset += batchSize - deletedInBatch;
    }

    LOG.info(
        "Orphan test case cleanup done. Scanned: {}, Found: {}, Deleted: {}, Failed: {}",
        result.getTotalScanned(),
        result.getOrphansFound(),
        result.getOrphansDeleted(),
        result.getFailures());
    return result;
  }

  private List<TestCase> parseTestCases(List<String> jsonBatch) {
    List<TestCase> testCases = new ArrayList<>(jsonBatch.size());
    for (String json : jsonBatch) {
      try {
        testCases.add(JsonUtils.readValue(json, TestCase.class));
      } catch (Exception ex) {
        LOG.warn("Skipping unparseable test case row: {}", ex.getMessage());
      }
    }
    return testCases;
  }

  private List<UUID> findOrphans(List<TestCase> testCases) {
    List<UUID> orphans = new ArrayList<>();
    for (TestCase testCase : testCases) {
      if (isOrphan(testCase)) {
        orphans.add(testCase.getId());
      }
    }
    return orphans;
  }

  private boolean isOrphan(TestCase testCase) {
    // Skip soft-deleted test cases — the operator kept them around on purpose, and the cascade
    // path would no-op on them anyway.
    if (Boolean.TRUE.equals(testCase.getDeleted())) {
      return false;
    }
    if (testCase.getEntityLink() == null) {
      return false;
    }
    EntityLink link;
    try {
      link = EntityLink.parse(testCase.getEntityLink());
    } catch (IllegalArgumentException ex) {
      // EntityLink.parse throws IllegalArgumentException for genuinely malformed links — those
      // test cases can never be displayed or matched to anything, so treat them as orphans.
      LOG.warn(
          "Treating test case {} as orphan: unparseable entityLink {}",
          testCase.getId(),
          testCase.getEntityLink());
      return true;
    } catch (Exception ex) {
      // Unexpected parse-time errors (NPE, transient runtime issues) — skip rather than delete,
      // so a future bug in the parser can't silently destroy valid test cases.
      LOG.debug(
          "Skipping test case {} due to unexpected entityLink parse error: {}",
          testCase.getId(),
          ex.getMessage());
      return false;
    }
    EntityRepository<?> targetRepo;
    try {
      targetRepo = Entity.getEntityRepository(link.getEntityType());
    } catch (EntityNotFoundException ex) {
      LOG.debug(
          "Unknown entityType '{}' for test case {}; skipping",
          link.getEntityType(),
          testCase.getId());
      return false;
    }
    try {
      targetRepo.getByName(null, link.getEntityFQN(), EntityUtil.Fields.EMPTY_FIELDS, ALL, false);
      return false;
    } catch (EntityNotFoundException ex) {
      return true;
    } catch (Exception ex) {
      LOG.debug(
          "Skipping test case {} due to lookup error on entity {}/{}: {}",
          testCase.getId(),
          link.getEntityType(),
          link.getEntityFQN(),
          ex.getMessage());
      return false;
    }
  }

  private boolean deleteOrphan(UUID id) {
    try {
      Entity.deleteEntity(Entity.ADMIN_USER_NAME, Entity.TEST_CASE, id, true, true);
      return true;
    } catch (Exception ex) {
      LOG.warn("Failed to delete orphan test case {}: {}", id, ex.getMessage());
      return false;
    }
  }
}
