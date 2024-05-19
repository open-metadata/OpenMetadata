package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_SOFT_DELETED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.util.FullyQualifiedName.quoteName;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
import org.openmetadata.schema.tests.type.ColumnTestSummaryDefinition;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.dqtests.TestSuiteResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class TestSuiteRepository extends EntityRepository<TestSuite> {
  private static final String UPDATE_FIELDS = "tests";
  private static final String PATCH_FIELDS = "tests";

  private static final String EXECUTION_SUMMARY_AGGS =
      """
        {
          "aggregations": {
              "status_counts": {
                "terms": {
                  "field": "testCaseResult.testCaseStatus"
                }
              }
            }
        }
        """;

  private static final String ENTITY_EXECUTION_SUMMARY_AGGS =
      """
  {
    "aggregations": {
      "entityLinks": {
        "terms": {
          "field": "entityLink.nonNormalized"
        },
        "aggs": {
          "status_counts": {
            "terms": {
              "field": "testCaseResult.testCaseStatus"
            }
          }
        }
      }
    }
  }""";

  private static final String ENTITY_EXECUTION_SUMMARY_FILTER =
      """
      {
        "query": {
          "bool": {
              "should": [
                  {
                      "nested":{
                          "path": "testSuites",
                          "query": {
                              "term": {
                                  "testSuites.id": "%1$s"
                              }
                          }
                      }
                  },
                  {
                      "term": {
                          "testSuite.id": "%1$s"
                      }
                  }
              ]
            }
        }
      }
  """;

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
        fields.contains("summary") ? getTestSummary(entity.getId()) : entity.getSummary());
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

  private TestSummary getTestCasesExecutionSummary(JsonObject aggregation) {
    // Initialize the test summary with 0 values
    TestSummary testSummary =
        new TestSummary().withAborted(0).withFailed(0).withSuccess(0).withQueued(0).withTotal(0);
    Optional<JsonObject> summary =
        Optional.ofNullable(aggregation.getJsonObject("sterms#status_counts"));
    return summary
        .map(
            s -> {
              JsonArray buckets = s.getJsonArray("buckets");
              for (JsonValue bucket : buckets) {
                updateTestSummaryFromBucket(((JsonObject) bucket), testSummary);
              }
              return testSummary;
            })
        .orElse(testSummary);
  }

  private TestSummary getEntityTestCasesExecutionSummary(JsonObject aggregation) {
    TestSummary testSummary =
        new TestSummary().withAborted(0).withFailed(0).withSuccess(0).withQueued(0).withTotal(0);
    List<ColumnTestSummaryDefinition> columnTestSummaries = new ArrayList<>();
    Optional<JsonObject> entityLinkAgg =
        Optional.ofNullable(SearchClient.getAggregationObject(aggregation, "sterms#entityLinks"));

    return entityLinkAgg
        .map(
            entityLinkAggJson -> {
              JsonArray entityLinkBuckets = SearchClient.getAggregationBuckets(entityLinkAggJson);
              for (JsonValue entityLinkBucket : entityLinkBuckets) {
                JsonObject statusAgg =
                    SearchClient.getAggregationObject(
                        (JsonObject) entityLinkBucket, "sterms#status_counts");
                JsonArray statusBuckets = SearchClient.getAggregationBuckets(statusAgg);
                String entityLinkString =
                    SearchClient.getAggregationKeyValue((JsonObject) entityLinkBucket);

                MessageParser.EntityLink entityLink =
                    entityLinkString != null
                        ? MessageParser.EntityLink.parse(entityLinkString)
                        : null;
                ColumnTestSummaryDefinition columnTestSummary =
                    new ColumnTestSummaryDefinition()
                        .withAborted(0)
                        .withFailed(0)
                        .withSuccess(0)
                        .withQueued(0)
                        .withTotal(0)
                        .withEntityLink(entityLinkString);
                for (JsonValue statusBucket : statusBuckets) {
                  updateColumnTestSummaryFromBucket(((JsonObject) statusBucket), columnTestSummary);
                  updateTestSummaryFromBucket(((JsonObject) statusBucket), testSummary);
                  if (entityLink != null
                      && entityLink.getFieldName() != null
                      && entityLink.getFieldName().equals("columns")) {
                    // Set the column summary if we have entity link column aggregation
                    columnTestSummaries.add(columnTestSummary);
                  }
                }
              }
              testSummary.setColumnTestSummary(columnTestSummaries);
              return testSummary;
            })
        .orElse(testSummary);
  }

  public TestSummary getTestSummary(UUID testSuiteId) {
    JsonObject aggregationJson = JsonUtils.readJson(EXECUTION_SUMMARY_AGGS).asJsonObject();
    try {
      TestSummary testSummary;
      if (testSuiteId == null) {
        JsonObject testCaseResultSummary =
            searchRepository.aggregate(null, TEST_CASE, aggregationJson);
        testSummary = getTestCasesExecutionSummary(testCaseResultSummary);
      } else {
        String query = ENTITY_EXECUTION_SUMMARY_FILTER.formatted(testSuiteId);
        // don't want to get it from the cache as test results summary may be stale
        aggregationJson = JsonUtils.readJson(ENTITY_EXECUTION_SUMMARY_AGGS).asJsonObject();
        JsonObject testCaseResultSummary =
            searchRepository.aggregate(query, TEST_CASE, aggregationJson);
        testSummary = getEntityTestCasesExecutionSummary(testCaseResultSummary);
      }
      return testSummary;
    } catch (Exception e) {
      LOG.error("Error reading aggregation query", e);
    }
    return null;
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
    // we don't want to store the tests in the test suite entity
    List<EntityReference> tests = entity.getTests();
    entity.setTests(null);
    store(entity, update);
    entity.setTests(tests);
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

  private void updateTestSummaryFromBucket(JsonObject bucket, TestSummary testSummary) {
    String key = bucket.getString("key");
    Integer count = bucket.getJsonNumber("doc_count").intValue();
    switch (key) {
      case "success":
        testSummary.setSuccess(testSummary.getSuccess() + count);
        break;
      case "failed":
        testSummary.setFailed(testSummary.getFailed() + count);
        break;
      case "aborted":
        testSummary.setAborted(testSummary.getAborted() + count);
        break;
      case "queued":
        testSummary.setQueued(testSummary.getQueued() + count);
        break;
    }
    testSummary.setTotal(testSummary.getTotal() + count);
  }

  private void updateColumnTestSummaryFromBucket(
      JsonObject bucket, ColumnTestSummaryDefinition columnTestSummary) {
    String key = bucket.getString("key");
    Integer count = bucket.getJsonNumber("doc_count").intValue();
    switch (key) {
      case "success":
        columnTestSummary.setSuccess(columnTestSummary.getSuccess() + count);
        break;
      case "failed":
        columnTestSummary.setFailed(columnTestSummary.getFailed() + count);
        break;
      case "aborted":
        columnTestSummary.setAborted(columnTestSummary.getAborted() + count);
        break;
      case "queued":
        columnTestSummary.setQueued(columnTestSummary.getQueued() + count);
        break;
    }
    columnTestSummary.setTotal(columnTestSummary.getTotal() + count);
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
