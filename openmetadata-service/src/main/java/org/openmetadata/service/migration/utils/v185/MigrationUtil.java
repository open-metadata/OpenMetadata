package org.openmetadata.service.migration.utils.v185;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class MigrationUtil {

  private final CollectionDAO collectionDAO;

  public MigrationUtil(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
  }

  public void createTestCaseToTestCaseResolutionRelation() {
    LOG.info(
        "Starting migration to recreate test case to test case resolution status relationships");

    try {
      TestCaseRepository testCaseRepository =
          (TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE);
      EntityDAO<TestCase> testCaseDAO = testCaseRepository.getDao();
      // Process test cases in batches
      int batchSize = 1;
      int relationshipsCreated = 0;
      int processedCount = 0;
      boolean hasMore = true;
      int offset = 0;
      String cursor = RestUtil.encodeCursor("0");

      do {
        ResultList<TestCase> testCases =
            testCaseRepository.listWithOffset(
                testCaseDAO::listAfter,
                testCaseDAO::listCount,
                new ListFilter(Include.ALL),
                batchSize,
                cursor,
                true,
                EntityUtil.Fields.EMPTY_FIELDS,
                null);

        LOG.info(
            "Processing batch: offset={}, size={}",
            RestUtil.decodeCursor(cursor),
            testCases.getData().size());

        for (TestCase testCase : testCases.getData()) {
          processedCount++;

          try {
            // Check if this test case has any test case resolution status records
            List<TestCaseResolutionStatus> resolutionStatuses =
                JsonUtils.readObjects(
                    collectionDAO
                        .testCaseResolutionStatusTimeSeriesDao()
                        .listTestCaseResolutionForEntityFQNHash(testCase.getFullyQualifiedName()),
                    TestCaseResolutionStatus.class);

            if (!resolutionStatuses.isEmpty()) {
              // Group by stateId to get unique resolution status records
              Set<UUID> uniqueStateIds =
                  resolutionStatuses.stream()
                      .map(TestCaseResolutionStatus::getId)
                      .collect(Collectors.toSet());

              LOG.debug(
                  "Test case {} has {} unique resolution status states",
                  testCase.getFullyQualifiedName(),
                  uniqueStateIds.size());

              // Create parent-child relationship for each unique state
              for (UUID stateId : uniqueStateIds) {
                try {
                  collectionDAO
                      .relationshipDAO()
                      .insert(
                          testCase.getId(),
                          stateId,
                          Entity.TEST_CASE,
                          Entity.TEST_CASE_RESOLUTION_STATUS,
                          Relationship.PARENT_OF.ordinal(),
                          null);
                } catch (Exception e) {
                  LOG.error(
                      "Failed to create relationship for test case {} and state {}: {}",
                      testCase.getFullyQualifiedName(),
                      stateId,
                      e.getMessage());
                }
              }
            }

          } catch (Exception e) {
            LOG.error(
                "Error processing test case {}: {}",
                testCase.getFullyQualifiedName(),
                e.getMessage());
          }
        }

        LOG.info(
            "Processed {} test cases so far, created {} relationships",
            processedCount,
            relationshipsCreated);

        // Check if we got fewer results than batch size (indicating we're at the end)
        if (testCases.getPaging() != null && testCases.getPaging().getAfter() == null) {
          hasMore = false;
        } else {
          // Prepare for next batch
          offset += testCases.getData().size();
          cursor = RestUtil.encodeCursor(String.valueOf(offset));
        }
      } while (hasMore);

      LOG.info(
          "Migration completed. Processed {} test cases, created {} new relationships",
          processedCount,
          relationshipsCreated);

    } catch (Exception e) {
      LOG.error("Failed to complete test case to test case resolution status migration", e);
      throw new RuntimeException("Migration failed", e);
    }
  }
}
