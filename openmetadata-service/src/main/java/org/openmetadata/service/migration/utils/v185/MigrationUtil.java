package org.openmetadata.service.migration.utils.v185;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Relationship.ADDRESSED_TO;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
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
      int batchSize = 100;
      int relationshipsCreated = 0;
      int processedCount = 0;
      int offset = 0;
      String cursor = RestUtil.encodeCursor("0");
      int total = testCaseDAO.listCount(new ListFilter(Include.ALL));
      LOG.info("Processing TestCases: total={}", total);

      while (offset < total) {
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
              Set<UUID> uniqueResolutionId =
                  resolutionStatuses.stream()
                      .map(TestCaseResolutionStatus::getId)
                      .collect(Collectors.toSet());

              LOG.debug(
                  "Test case {} has {} unique resolution status states",
                  testCase.getFullyQualifiedName(),
                  uniqueResolutionId.size());

              // Create parent-child relationship for each unique state
              for (UUID resolutionId : uniqueResolutionId) {
                try {
                  collectionDAO
                      .relationshipDAO()
                      .insert(
                          testCase.getId(),
                          resolutionId,
                          Entity.TEST_CASE,
                          Entity.TEST_CASE_RESOLUTION_STATUS,
                          Relationship.PARENT_OF.ordinal(),
                          null);
                } catch (Exception e) {
                  LOG.error(
                      "Failed to create relationship for test case {} and state {}: {}",
                      testCase.getFullyQualifiedName(),
                      resolutionId,
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

        offset += testCases.getData().size();
        cursor = RestUtil.encodeCursor(String.valueOf(offset));
      }

      LOG.info(
          "Migration completed. Processed {} test cases, created {} new relationships",
          processedCount,
          relationshipsCreated);

    } catch (Exception e) {
      LOG.error("Failed to complete test case to test case resolution status migration", e);
    }
  }

  private void processThreadsInBatches(
      String operationName, String failureMessage, ThreadListSupplier threadListSupplier) {
    try {
      LOG.info("Recreating {} relation", operationName);
      int batchSize = 100;
      int offset = 0;
      int processedCount = 0;

      while (true) {
        List<String> taskThreads = threadListSupplier.getThreads(batchSize, offset);

        if (taskThreads.isEmpty()) {
          break;
        }

        LOG.info("Processing batch: offset={}, size={}", offset, taskThreads.size());

        for (String threadJson : taskThreads) {
          try {
            Thread thread = JsonUtils.readValue(threadJson, Thread.class);
            recreateThreadRelationships(thread);
            processedCount++;
          } catch (Exception e) {
            LOG.error("Error processing thread: {}", e.getMessage());
          }
        }

        LOG.info("Processed {} task threads so far", processedCount);

        offset += taskThreads.size();

        if (taskThreads.size() < batchSize) {
          break;
        }
      }

      LOG.info("Migration completed. Processed {} task threads", processedCount);

    } catch (Exception e) {
      LOG.error("Failed to complete {}", failureMessage, e);
    }
  }

  @FunctionalInterface
  private interface ThreadListSupplier {
    List<String> getThreads(int batchSize, int offset);
  }

  public void recreateOtherThreadRelation() {
    long cutOffTime = System.currentTimeMillis() - 60L * 24 * 60 * 60 * 1000; // 30 days ago
    processThreadsInBatches(
        "conversation and announcement threads",
        "task threads relation migration",
        (batchSize, offset) ->
            collectionDAO
                .feedDAO()
                .listOtherConversationThreadWithOffset(cutOffTime, batchSize, offset));
  }

  public void recreateTaskThreadsRelation() {
    processThreadsInBatches(
        "task threads",
        "task threads relation migration",
        (batchSize, offset) -> collectionDAO.feedDAO().listTaskThreadWithOffset(batchSize, offset));
  }

  /**
   * Recreate thread relationships for CREATED, ADDRESSED_TO, and REPLIED_TO
   * @param thread The thread to recreate relationships for
   */
  private void recreateThreadRelationships(Thread thread) {
    int relationshipsCreated = 0;

    try {
      // 1. Create CREATED relationship: User -> Thread
      if (thread.getCreatedBy() != null) {
        try {
          String createdByUserId = thread.getCreatedBy();
          EntityReference ref = Entity.getEntityReferenceByName(Entity.USER, createdByUserId, ALL);
          collectionDAO
              .relationshipDAO()
              .insert(
                  ref.getId(),
                  thread.getId(),
                  ref.getType(),
                  Entity.THREAD,
                  Relationship.CREATED.ordinal(),
                  null);
          relationshipsCreated++;
          LOG.debug("Created CREATED relationship for thread {}", thread.getId());
        } catch (Exception e) {
          LOG.error(
              "Failed to create CREATED relationship for thread {}: {}",
              thread.getId(),
              e.getMessage());
        }
      }

      // 2. Create ADDRESSED_TO relationships: Thread -> User/Team (entity owners)
      try {
        MessageParser.EntityLink aboutEntityLink =
            MessageParser.EntityLink.parse(thread.getAbout());
        EntityRepository<? extends EntityInterface> repository =
            Entity.getEntityRepository(aboutEntityLink.getEntityType());
        List<String> fieldList = new ArrayList<>();
        if (repository.isSupportsOwners()) {
          fieldList.add("owners");
        }
        EntityInterface aboutEntity =
            Entity.getEntity(
                aboutEntityLink, String.join(",", fieldList.toArray(new String[0])), ALL);

        List<EntityReference> entityOwners = aboutEntity.getOwners();
        if (!nullOrEmpty(entityOwners)) {
          for (EntityReference entityOwner : entityOwners) {
            collectionDAO
                .relationshipDAO()
                .insert(
                    thread.getId(),
                    entityOwner.getId(),
                    Entity.THREAD,
                    entityOwner.getType(),
                    ADDRESSED_TO.ordinal());
          }
        }
      } catch (Exception ex) {
        LOG.debug(
            "Recreating relationship for thread {} failed: {}",
            thread.getId(),
            ex.getMessage(),
            ex);
      }

      // 3. Create REPLIED_TO relationships: User -> Thread (for users who replied)
      if (thread.getPosts() != null && !thread.getPosts().isEmpty()) {
        Set<UUID> repliedUsers = new HashSet<>();

        for (Post post : thread.getPosts()) {
          if (post.getFrom() != null) {
            try {
              String createdByUserId = thread.getCreatedBy();
              EntityReference ref =
                  Entity.getEntityReferenceByName(Entity.USER, createdByUserId, ALL);

              // Only create relationship if this user hasn't already replied
              if (!repliedUsers.contains(ref.getId())) {
                collectionDAO
                    .relationshipDAO()
                    .insert(
                        ref.getId(),
                        thread.getId(),
                        Entity.USER,
                        Entity.THREAD,
                        Relationship.REPLIED_TO.ordinal(),
                        null);
                repliedUsers.add(ref.getId());
                relationshipsCreated++;
                LOG.debug(
                    "Created REPLIED_TO relationship for thread {} from user {}",
                    thread.getId(),
                    ref.getId());
              }
            } catch (Exception e) {
              LOG.error(
                  "Failed to create REPLIED_TO relationship for thread {} from user {}: {}",
                  thread.getId(),
                  post.getFrom(),
                  e.getMessage());
            }
          }
        }
      }

      if (relationshipsCreated > 0) {
        LOG.debug("Created {} relationships for thread {}", relationshipsCreated, thread.getId());
      }

    } catch (Exception e) {
      LOG.error("Error recreating relationships for thread {}: {}", thread.getId(), e.getMessage());
    }
  }
}
