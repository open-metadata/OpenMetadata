package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_SOFT_DELETED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.Entity.getEntity;
import static org.openmetadata.service.Entity.getEntityTimeSeriesRepository;
import static org.openmetadata.service.search.SearchUtils.getAggregationBuckets;
import static org.openmetadata.service.search.SearchUtils.getAggregationKeyValue;
import static org.openmetadata.service.search.SearchUtils.getAggregationObject;
import static org.openmetadata.service.util.FullyQualifiedName.quoteName;

import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonValue;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.ColumnTestSummaryDefinition;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.dqtests.TestSuiteResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.DeleteEntityResponse;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
public class TestSuiteRepository extends EntityRepository<TestSuite> {
  private static final String UPDATE_FIELDS = "tests";
  private static final String PATCH_FIELDS = "tests";

  private static final String ENTITY_EXECUTION_SUMMARY_FILTER =
      """
  {
      "query": {
          "bool": {
              "must": [
                  {
                      "bool": {
                          "should": [
                              {
                                  "nested": {
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
                  },
                  {
                      "term": {
                          "deleted": false
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
    entity.setTests(fields.contains(UPDATE_FIELDS) ? getTestCases(entity) : entity.getTests());
    entity.setTestCaseResultSummary(
        fields.contains("summary")
            ? getResultSummary(entity.getId())
            : entity.getTestCaseResultSummary());
    entity.setSummary(
        fields.contains("summary")
            ? getTestSummary(entity.getTestCaseResultSummary())
            : entity.getSummary());

    // Ensure tests is never null, default to empty list
    if (entity.getTests() == null) {
      entity.setTests(new ArrayList<>());
    }
  }

  @Override
  public void setInheritedFields(TestSuite testSuite, EntityUtil.Fields fields) {
    if (Boolean.TRUE.equals(testSuite.getBasic()) && testSuite.getBasicEntityReference() != null) {
      Table table =
          Entity.getEntity(
              TABLE, testSuite.getBasicEntityReference().getId(), "owners,domain", ALL);
      inheritOwners(testSuite, fields, table);
      inheritDomain(testSuite, fields, table);
    }
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<TestSuite> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    var testsMap = batchFetchTestCases(entities);
    entities.forEach(
        entity -> entity.setTests(testsMap.getOrDefault(entity.getId(), new ArrayList<>())));
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  private Map<UUID, List<EntityReference>> batchFetchTestCases(List<TestSuite> testSuites) {
    if (testSuites == null || testSuites.isEmpty()) {
      return Map.of();
    }
    var testSuiteIds = testSuites.stream().map(ts -> ts.getId().toString()).toList();
    var records =
        daoCollection.relationshipDAO().findFromBatch(testSuiteIds, Relationship.HAS.ordinal());
    if (records.isEmpty()) {
      return Map.of();
    }
    var testCaseIds =
        records.stream()
            .filter(r -> TEST_CASE.equals(r.getToEntity()))
            .map(r -> UUID.fromString(r.getToId()))
            .distinct()
            .toList();

    var testCaseRefs = Entity.getEntityReferencesByIds(TEST_CASE, testCaseIds, Include.ALL);
    var idToRefMap =
        testCaseRefs.stream().collect(Collectors.toMap(ref -> ref.getId().toString(), ref -> ref));

    return records.stream()
        .filter(r -> TEST_CASE.equals(r.getToEntity()))
        .map(rel -> Map.entry(UUID.fromString(rel.getFromId()), idToRefMap.get(rel.getToId())))
        .filter(entry -> entry.getValue() != null)
        .collect(
            Collectors.groupingBy(
                Map.Entry::getKey, Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
  }

  @Override
  public void clearFields(TestSuite entity, EntityUtil.Fields fields) {
    entity.setPipelines(fields.contains("pipelines") ? entity.getPipelines() : null);
    entity.setSummary(fields.contains("summary") ? entity.getSummary() : null);
    entity.withTests(fields.contains(UPDATE_FIELDS) ? entity.getTests() : null);
  }

  @Override
  public void setFullyQualifiedName(TestSuite testSuite) {
    if (testSuite.getBasicEntityReference() != null) {
      testSuite.setFullyQualifiedName(
          FullyQualifiedName.add(
              testSuite.getBasicEntityReference().getFullyQualifiedName(), "testSuite"));
    } else {
      testSuite.setFullyQualifiedName(quoteName(testSuite.getName()));
    }
  }

  @Override
  public EntityInterface getParentEntity(TestSuite entity, String fields) {
    if (entity.getBasic() && entity.getBasicEntityReference() != null) {
      return Entity.getEntity(entity.getBasicEntityReference(), fields, ALL);
    }
    return null;
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
        Optional.ofNullable(getAggregationObject(aggregation, "sterms#entityLinks"));

    return entityLinkAgg
        .map(
            entityLinkAggJson -> {
              JsonArray entityLinkBuckets = getAggregationBuckets(entityLinkAggJson);
              for (JsonValue entityLinkBucket : entityLinkBuckets) {
                JsonObject statusAgg =
                    getAggregationObject((JsonObject) entityLinkBucket, "sterms#status_counts");
                JsonArray statusBuckets = getAggregationBuckets(statusAgg);
                String entityLinkString = getAggregationKeyValue((JsonObject) entityLinkBucket);

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

  public DataQualityReport getDataQualityReport(String q, String aggQuery, String index)
      throws IOException {
    SearchAggregation searchAggregation = SearchIndexUtils.buildAggregationTree(aggQuery);
    return searchRepository.genericAggregation(q, index, searchAggregation);
  }

  public TestSummary getTestSummary(List<ResultSummary> testCaseResults) {
    record ProcessedTestCaseResults(String entityLink, String status) {}

    List<ProcessedTestCaseResults> processedTestCaseResults =
        testCaseResults.stream()
            .map(
                result -> {
                  TestCase testCase =
                      Entity.getEntityByName(TEST_CASE, result.getTestCaseName(), "", ALL);
                  MessageParser.EntityLink entityLink =
                      MessageParser.EntityLink.parse(testCase.getEntityLink());
                  String linkString =
                      entityLink.getFieldName() == null ? "table" : entityLink.getLinkString();
                  return new ProcessedTestCaseResults(linkString, result.getStatus().toString());
                })
            .toList();

    Map<String, Map<String, Integer>> summaries =
        processedTestCaseResults.stream()
            .collect(
                Collectors.groupingBy(
                    ProcessedTestCaseResults::entityLink,
                    Collectors.groupingBy(
                        ProcessedTestCaseResults::status,
                        Collectors.collectingAndThen(Collectors.counting(), Long::intValue))));

    Map<String, Integer> testSummaryMap =
        processedTestCaseResults.stream()
            .collect(
                Collectors.groupingBy(
                    result -> result.status,
                    Collectors.collectingAndThen(Collectors.counting(), Long::intValue)));

    List<ColumnTestSummaryDefinition> columnTestSummaryDefinitions =
        summaries.entrySet().stream()
            .filter(entry -> !entry.getKey().equals("table"))
            .map(
                entry -> {
                  ColumnTestSummaryDefinition columnTestSummaryDefinition =
                      createColumnSummary(entry.getValue());
                  columnTestSummaryDefinition.setEntityLink(entry.getKey());
                  return columnTestSummaryDefinition;
                })
            .toList();

    TestSummary testSummary = createTestSummary(testSummaryMap);
    testSummary.setTotal(testCaseResults.size());
    testSummary.setColumnTestSummary(columnTestSummaryDefinitions);
    return testSummary;
  }

  private TestSummary createTestSummary(Map<String, Integer> summaryMap) {
    TestSummary summary = new TestSummary();
    summary.setSuccess(summaryMap.getOrDefault("Success", 0));
    summary.setFailed(summaryMap.getOrDefault("Failed", 0));
    summary.setAborted(summaryMap.getOrDefault("Aborted", 0));
    summary.setQueued(summaryMap.getOrDefault("Queued", 0));
    return summary;
  }

  private ColumnTestSummaryDefinition createColumnSummary(Map<String, Integer> summaryMap) {
    ColumnTestSummaryDefinition summary = new ColumnTestSummaryDefinition();
    summary.setSuccess(summaryMap.getOrDefault("Success", 0));
    summary.setFailed(summaryMap.getOrDefault("Failed", 0));
    summary.setAborted(summaryMap.getOrDefault("Aborted", 0));
    summary.setQueued(summaryMap.getOrDefault("Queued", 0));
    summary.setTotal(summaryMap.values().stream().mapToInt(Integer::intValue).sum());
    return summary;
  }

  public TestSummary getTestSummary(UUID testSuiteId) {
    try {
      // TODO: Delete with https://github.com/open-metadata/OpenMetadata/pull/18323
      TestSummary testSummary;
      if (testSuiteId == null) {
        String aggregationStr =
            "bucketName=status_counts:aggType=terms:field=testCaseResult.testCaseStatus";
        SearchAggregation searchAggregation = SearchIndexUtils.buildAggregationTree(aggregationStr);
        JsonObject testCaseResultSummary =
            searchRepository.aggregate(null, TEST_CASE, searchAggregation, new SearchListFilter());
        testSummary = getTestCasesExecutionSummary(testCaseResultSummary);
      } else {
        String aggregationStr =
            "bucketName=entityLinks:aggType=terms:field=entityLink.nonNormalized,"
                + "bucketName=status_counts:aggType=terms:field=testCaseResult.testCaseStatus";
        SearchAggregation searchAggregation = SearchIndexUtils.buildAggregationTree(aggregationStr);
        String query = ENTITY_EXECUTION_SUMMARY_FILTER.formatted(testSuiteId);
        // don't want to get it from the cache as test results summary may be stale
        JsonObject testCaseResultSummary =
            searchRepository.aggregate(query, TEST_CASE, searchAggregation, new SearchListFilter());
        testSummary = getEntityTestCasesExecutionSummary(testCaseResultSummary);
      }
      return testSummary;
    } catch (Exception e) {
      LOG.error("Error reading aggregation query", e);
    }
    return null;
  }

  @Override
  protected void postCreate(TestSuite entity) {
    super.postCreate(entity);
    if (Boolean.TRUE.equals(entity.getBasic()) && entity.getBasicEntityReference() != null) {
      // Update table index with test suite field
      EntityInterface entityInterface =
          getEntity(entity.getBasicEntityReference(), "testSuite", ALL);
      IndexMapping indexMapping =
          searchRepository.getIndexMapping(entity.getBasicEntityReference().getType());
      SearchClient searchClient = searchRepository.getSearchClient();
      SearchIndex index =
          searchRepository
              .getSearchIndexFactory()
              .buildIndex(entity.getBasicEntityReference().getType(), entityInterface);
      Map<String, Object> doc = index.buildSearchIndexDoc();
      searchClient.updateEntity(
          indexMapping.getIndexName(searchRepository.getClusterAlias()),
          entity.getBasicEntityReference().getId().toString(),
          doc,
          "ctx._source.testSuite = params.testSuite;");
    }
  }

  @SneakyThrows
  private List<ResultSummary> getResultSummary(UUID testSuiteId) {
    List<ResultSummary> resultSummaries = new ArrayList<>();
    ResultList<TestCaseResult> latestTestCaseResultResults = null;
    String groupBy = "testCaseFQN.keyword";
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("testSuiteId", testSuiteId.toString());
    TestCaseResultRepository entityTimeSeriesRepository =
        (TestCaseResultRepository) getEntityTimeSeriesRepository(TEST_CASE_RESULT);
    try {
      latestTestCaseResultResults =
          entityTimeSeriesRepository.listLatestFromSearch(
              EntityUtil.Fields.EMPTY_FIELDS, searchListFilter, groupBy, null);
    } catch (Exception e) {
      LOG.debug(
          "Error fetching test case result from search. Fetching from test case results from database",
          e);
    }

    if (latestTestCaseResultResults == null || nullOrEmpty(latestTestCaseResultResults.getData())) {
      latestTestCaseResultResults =
          entityTimeSeriesRepository.listLastTestCaseResultsForTestSuite(testSuiteId);
    }

    latestTestCaseResultResults
        .getData()
        .forEach(
            testCaseResult -> {
              ResultSummary resultSummary =
                  new ResultSummary()
                      .withTestCaseName(testCaseResult.getTestCaseFQN())
                      .withStatus(testCaseResult.getTestCaseStatus())
                      .withTimestamp(testCaseResult.getTimestamp());
              resultSummaries.add(resultSummary);
            });
    return resultSummaries;
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
      TestSuite original, TestSuite updated, Operation operation, ChangeSource changeSource) {
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
    if (Boolean.TRUE.equals(entity.getBasic())) {
      storeExecutableRelationship(entity);
    }
  }

  public void storeExecutableRelationship(TestSuite testSuite) {
    Table table =
        Entity.getEntityByName(
            Entity.TABLE, testSuite.getBasicEntityReference().getFullyQualifiedName(), null, null);
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
    deleteChildIngestionPipelines(original.getId(), hardDelete, updatedBy);

    EventType changeType;
    TestSuite updated = JsonUtils.readValue(JsonUtils.pojoToJson(original), TestSuite.class);
    setFieldsInternal(updated, putFields);

    if (supportsSoftDelete && !hardDelete) {
      updated.setUpdatedBy(updatedBy);
      updated.setUpdatedAt(System.currentTimeMillis());
      updated.setDeleted(true);
      EntityUpdater updater = getUpdater(original, updated, Operation.SOFT_DELETE, null);
      updater.update();
      changeType = ENTITY_SOFT_DELETED;
    } else {
      cleanup(updated);
      changeType = ENTITY_DELETED;
    }
    LOG.info("{} deleted {}", hardDelete ? "Hard" : "Soft", updated.getFullyQualifiedName());
    return new RestUtil.DeleteResponse<>(updated, changeType);
  }

  /**
   * Always delete as if it was marked recursive. Deleting a Logical Suite should
   * just go ahead and clean the Ingestion Pipelines
   */
  private void deleteChildIngestionPipelines(UUID id, boolean hardDelete, String updatedBy) {
    List<CollectionDAO.EntityRelationshipRecord> childrenRecords =
        daoCollection
            .relationshipDAO()
            .findTo(id, entityType, Relationship.CONTAINS.ordinal(), Entity.INGESTION_PIPELINE);

    if (childrenRecords.isEmpty()) {
      LOG.debug("No children to delete");
      return;
    }
    // Delete all the contained entities
    deleteChildren(childrenRecords, hardDelete, updatedBy);
  }

  public Response deleteLogicalTestSuiteAsync(
      SecurityContext securityContext, TestSuite testSuite, boolean hardDelete) {
    String jobId = UUID.randomUUID().toString();

    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            RestUtil.DeleteResponse<TestSuite> deleteResponse =
                deleteLogicalTestSuite(securityContext, testSuite, hardDelete);
            deleteFromSearch(deleteResponse.entity(), hardDelete);

            WebsocketNotificationHandler.sendDeleteOperationCompleteNotification(
                jobId, securityContext, deleteResponse.entity());
          } catch (Exception e) {
            WebsocketNotificationHandler.sendDeleteOperationFailedNotification(
                jobId, securityContext, testSuite, e.getMessage());
          }
        });
    return Response.accepted()
        .entity(
            new DeleteEntityResponse(
                jobId,
                "Delete operation initiated for " + testSuite.getName(),
                testSuite.getName(),
                hardDelete,
                false))
        .build();
  }

  private void updateTestSummaryFromBucket(JsonObject bucket, TestSummary testSummary) {
    String key = bucket.getString("key");
    Integer count = bucket.getJsonNumber("doc_count").intValue();
    switch (key) {
      case "success" -> testSummary.setSuccess(testSummary.getSuccess() + count);
      case "failed" -> testSummary.setFailed(testSummary.getFailed() + count);
      case "aborted" -> testSummary.setAborted(testSummary.getAborted() + count);
      case "queued" -> testSummary.setQueued(testSummary.getQueued() + count);
    }
    testSummary.setTotal(testSummary.getTotal() + count);
  }

  private void updateColumnTestSummaryFromBucket(
      JsonObject bucket, ColumnTestSummaryDefinition columnTestSummary) {
    String key = bucket.getString("key");
    Integer count = bucket.getJsonNumber("doc_count").intValue();
    switch (key) {
      case "success" -> columnTestSummary.setSuccess(columnTestSummary.getSuccess() + count);
      case "failed" -> columnTestSummary.setFailed(columnTestSummary.getFailed() + count);
      case "aborted" -> columnTestSummary.setAborted(columnTestSummary.getAborted() + count);
      case "queued" -> columnTestSummary.setQueued(columnTestSummary.getQueued() + count);
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
        .withBasic(testSuite.getBasic())
        .withBasicEntityReference(testSuite.getBasicEntityReference())
        .withServiceType(testSuite.getServiceType())
        .withOwners(testSuite.getOwners())
        .withUpdatedBy(testSuite.getUpdatedBy())
        .withUpdatedAt(testSuite.getUpdatedAt())
        .withVersion(testSuite.getVersion());
  }

  public class TestSuiteUpdater extends EntityUpdater {
    public TestSuiteUpdater(TestSuite original, TestSuite updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    protected boolean consolidateChanges(
        TestSuite original, TestSuite updated, Operation operation) {
      return false;
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
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
