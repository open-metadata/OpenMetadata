package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_SOFT_DELETED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.util.FullyQualifiedName.quoteName;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.json.JsonArray;
import javax.json.JsonObject;
import javax.json.JsonValue;
import javax.ws.rs.core.SecurityContext;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.dqtests.TestSuiteResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class TestSuiteRepository extends EntityRepository<TestSuite> {
  private static final String UPDATE_FIELDS = "tests";
  private static final String PATCH_FIELDS = "tests";

  public TestSuiteRepository() {
    super(
        TestSuiteResource.COLLECTION_PATH,
        TEST_SUITE,
        TestSuite.class,
        Entity.getCollectionDAO().testSuiteDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    quoteFqn = false;
    supportsSearch = true;
  }

  @Override
  public void setFields(TestSuite entity, EntityUtil.Fields fields) {
    entity.setPipelines(
        fields.contains("pipelines") ? getIngestionPipelines(entity) : entity.getPipelines());
    entity.setSummary(
        fields.contains("summary") ? getTestCasesExecutionSummary(entity) : entity.getSummary());
    entity.withTests(fields.contains(UPDATE_FIELDS) ? getTestCases(entity) : entity.getTests());
  }

  @Override
  public void setInheritedFields(TestSuite testSuite, EntityUtil.Fields fields) {
    if (Boolean.TRUE.equals(testSuite.getExecutable())) {
      Table table =
          Entity.getEntity(TABLE, testSuite.getExecutableEntityReference().getId(), "owner", ALL);
      inheritOwner(testSuite, fields, table);
    }
  }

  @Override
  public void clearFields(TestSuite entity, EntityUtil.Fields fields) {
    entity.setPipelines(fields.contains("pipelines") ? entity.getPipelines() : null);
    entity.setSummary(fields.contains("summary") ? entity.getSummary() : null);
    entity.withTests(fields.contains(UPDATE_FIELDS) ? entity.getTests() : null);
  }

  private TestSummary buildTestSummary(Map<String, Integer> testCaseSummary) {
    return new TestSummary()
        .withAborted(testCaseSummary.getOrDefault(TestCaseStatus.Aborted.toString(), 0))
        .withFailed(testCaseSummary.getOrDefault(TestCaseStatus.Failed.toString(), 0))
        .withSuccess(testCaseSummary.getOrDefault(TestCaseStatus.Success.toString(), 0))
        .withQueued(testCaseSummary.getOrDefault(TestCaseStatus.Queued.toString(), 0))
        .withTotal(testCaseSummary.values().stream().mapToInt(Integer::valueOf).sum());
  }

  @Override
  public void setFullyQualifiedName(TestSuite testSuite) {
    if (testSuite.getExecutableEntityReference() != null) {
      testSuite.setFullyQualifiedName(
          FullyQualifiedName.add(
              testSuite.getExecutableEntityReference().getFullyQualifiedName(), "testSuite"));
    } else {
      testSuite.setFullyQualifiedName(quoteName(testSuite.getName()));
    }
  }

  private Map<String, Integer> getResultSummary(TestSuite testSuite) {
    Map<String, Integer> testCaseSummary = new HashMap<>();
    List<EntityReference> testCases = getTestCases(testSuite);
    for (ResultSummary resultSummary : testSuite.getTestCaseResultSummary()) {
      String status = resultSummary.getStatus().toString();
      testCaseSummary.put(status, testCaseSummary.getOrDefault(status, 0) + 1);
    }
    List<EntityReference> testCasesWithNoResults =
        testCases.stream()
            .filter(
                tc ->
                    testSuite.getTestCaseResultSummary().stream()
                        .noneMatch(tcr -> tc.getFullyQualifiedName().equals(tcr.getTestCaseName())))
            .toList();
    testCaseSummary.put(TestCaseStatus.Queued.toString(), testCasesWithNoResults.size());
    return testCaseSummary;
  }

  private TestSummary getTestCasesExecutionSummary(TestSuite entity) {
    Map<String, Integer> testCaseSummary = getResultSummary(entity);
    return buildTestSummary(testCaseSummary);
  }

  private TestSummary getTestCasesExecutionSummary(JsonObject aggregation) {
    // Initialize the test summary with 0 values
    TestSummary testSummary =
        new TestSummary().withAborted(0).withFailed(0).withSuccess(0).withQueued(0).withTotal(0);
    JsonObject summary = aggregation.getJsonObject("nested#testCaseResultSummary");
    testSummary.setTotal(summary.getJsonNumber("doc_count").intValue());

    JsonObject statusCount = summary.getJsonObject("sterms#status_counts");
    JsonArray buckets = statusCount.getJsonArray("buckets");

    for (JsonValue bucket : buckets) {
      String key = ((JsonObject) bucket).getString("key");
      Integer count = ((JsonObject) bucket).getJsonNumber("doc_count").intValue();
      switch (key) {
        case "Success":
          testSummary.setSuccess(count);
          break;
        case "Failed":
          testSummary.setFailed(count);
          break;
        case "Aborted":
          testSummary.setAborted(count);
          break;
        case "Queued":
          testSummary.setQueued(count);
          break;
      }
    }
    return testSummary;
  }

  public TestSummary getTestSummary(UUID testSuiteId) throws IOException {
    String aggregationQuery =
        """
            {
              "aggregations": {
                "test_case_results": {
                  "nested": {
                    "path": "testCaseResultSummary"
                  },
                  "aggs": {
                    "status_counts": {
                      "terms": {
                        "field": "testCaseResultSummary.status"
                      }
                    }
                  }
                }
              }
            }
            """;
    JsonObject aggregationJson = JsonUtils.readJson(aggregationQuery).asJsonObject();
    TestSummary testSummary;
    if (testSuiteId == null) {
      JsonObject testCaseResultSummary =
          searchRepository.aggregate(null, TEST_SUITE, aggregationJson);
      testSummary = getTestCasesExecutionSummary(testCaseResultSummary);
    } else {
      String query =
          """
            {
              "query": {
                "bool": {
                    "must": {
                        "term": {"id": "%s"}
                    }
                }
              }
            }
        """
              .formatted(testSuiteId);
      // don't want to get it from the cache as test results summary may be stale
      JsonObject testCaseResultSummary =
          searchRepository.aggregate(query, TEST_SUITE, aggregationJson);
      testSummary = getTestCasesExecutionSummary(testCaseResultSummary);
    }
    return testSummary;
  }

  @Override
  public void prepare(TestSuite entity, boolean update) {
    /* Nothing to do */
  }

  private List<EntityReference> getTestCases(TestSuite entity) {
    return findTo(entity.getId(), TEST_SUITE, Relationship.CONTAINS, TEST_CASE);
  }

  @Override
  public EntityRepository<TestSuite>.EntityUpdater getUpdater(
      TestSuite original, TestSuite updated, Operation operation) {
    return new TestSuiteUpdater(original, updated, operation);
  }

  @Override
  public void storeEntity(TestSuite entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(TestSuite entity) {
    if (Boolean.TRUE.equals(entity.getExecutable())) {
      storeExecutableRelationship(entity);
    }
  }

  public void storeExecutableRelationship(TestSuite testSuite) {
    Table table =
        Entity.getEntityByName(
            Entity.TABLE,
            testSuite.getExecutableEntityReference().getFullyQualifiedName(),
            null,
            null);
    addRelationship(
        table.getId(), testSuite.getId(), Entity.TABLE, TEST_SUITE, Relationship.CONTAINS);
  }

  public RestUtil.DeleteResponse<TestSuite> deleteLogicalTestSuite(
      SecurityContext securityContext, TestSuite original, boolean hardDelete) {
    // deleting a logical will delete the test suite and only remove the relationship to
    // test cases if hardDelete is true. Test Cases will not be deleted.
    String updatedBy = securityContext.getUserPrincipal().getName();
    preDelete(original, updatedBy);
    setFieldsInternal(original, putFields);

    EventType changeType;
    TestSuite updated = JsonUtils.readValue(JsonUtils.pojoToJson(original), TestSuite.class);
    setFieldsInternal(updated, putFields);

    if (supportsSoftDelete && !hardDelete) {
      updated.setUpdatedBy(updatedBy);
      updated.setUpdatedAt(System.currentTimeMillis());
      updated.setDeleted(true);
      EntityUpdater updater = getUpdater(original, updated, Operation.SOFT_DELETE);
      updater.update();
      changeType = ENTITY_SOFT_DELETED;
    } else {
      cleanup(updated);
      changeType = ENTITY_DELETED;
    }
    LOG.info("{} deleted {}", hardDelete ? "Hard" : "Soft", updated.getFullyQualifiedName());
    return new RestUtil.DeleteResponse<>(updated, changeType);
  }

  public static TestSuite copyTestSuite(TestSuite testSuite) {
    return new TestSuite()
        .withConnection(testSuite.getConnection())
        .withDescription(testSuite.getDescription())
        .withChangeDescription(testSuite.getChangeDescription())
        .withDeleted(testSuite.getDeleted())
        .withDisplayName(testSuite.getDisplayName())
        .withFullyQualifiedName(testSuite.getFullyQualifiedName())
        .withHref(testSuite.getHref())
        .withId(testSuite.getId())
        .withName(testSuite.getName())
        .withExecutable(testSuite.getExecutable())
        .withExecutableEntityReference(testSuite.getExecutableEntityReference())
        .withServiceType(testSuite.getServiceType())
        .withOwner(testSuite.getOwner())
        .withUpdatedBy(testSuite.getUpdatedBy())
        .withUpdatedAt(testSuite.getUpdatedAt())
        .withVersion(testSuite.getVersion());
  }

  public class TestSuiteUpdater extends EntityUpdater {
    public TestSuiteUpdater(TestSuite original, TestSuite updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
      List<EntityReference> origTests = listOrEmpty(original.getTests());
      List<EntityReference> updatedTests = listOrEmpty(updated.getTests());
      List<ResultSummary> origTestCaseResultSummary =
          listOrEmpty(original.getTestCaseResultSummary());
      List<ResultSummary> updatedTestCaseResultSummary =
          listOrEmpty(updated.getTestCaseResultSummary());
      recordChange(UPDATE_FIELDS, origTests, updatedTests);
      recordChange(
          "testCaseResultSummary", origTestCaseResultSummary, updatedTestCaseResultSummary);
    }
  }
}
