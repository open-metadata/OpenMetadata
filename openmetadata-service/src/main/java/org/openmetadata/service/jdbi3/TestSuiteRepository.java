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
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.escapeDoubleQuotes;

import com.google.gson.Gson;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.json.JsonReader;
import jakarta.json.JsonValue;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.ColumnTestSummaryDefinition;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.resources.dqtests.TestSuiteResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.DeleteEntityResponse;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
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
    EntityLifecycleEventDispatcher.getInstance()
        .registerHandler(new TestSuitePipelineStatusHandler());
    fieldFetchers.put("summary", this::fetchAndSetTestCaseResultSummary);
    fieldFetchers.put("pipelines", this::fetchAndSetIngestionPipelines);
  }

  @Override
  public ResultList<TestSuite> listFromSearchWithOffset(
      UriInfo uriInfo,
      EntityUtil.Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString,
      SecurityContext securityContext)
      throws IOException {
    ResultList<TestSuite> resultList =
        super.listFromSearchWithOffset(
            uriInfo,
            fields,
            searchListFilter,
            limit,
            offset,
            searchSortFilter,
            q,
            queryString,
            securityContext);
    if (!resultList.getData().isEmpty()) {
      fetchAndSetFields(resultList.getData(), fields);
      setInheritedFields(resultList.getData(), fields);
      resultList.getData().forEach(entity -> clearFieldsInternal(entity, fields));
    }
    return resultList;
  }

  @Override
  public void setFields(
      TestSuite entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    entity.setPipelines(
        fields.contains("pipelines") ? getIngestionPipelines(entity) : entity.getPipelines());
    entity.setTests(fields.contains("tests") ? getTestCases(entity) : entity.getTests());
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
              TABLE, testSuite.getBasicEntityReference().getId(), "owners,domains", ALL);
      inheritOwners(testSuite, fields, table);
      inheritDomains(testSuite, fields, table);
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
        daoCollection
            .relationshipDAO()
            .findToBatch(testSuiteIds, Relationship.CONTAINS.ordinal(), TEST_SUITE, TEST_CASE);
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
      String filteredFields = EntityUtil.getFilteredFields(TABLE, fields);
      return Entity.getEntity(entity.getBasicEntityReference(), filteredFields, ALL);
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

  public DataQualityReport getDataQualityReport(
      String q, String aggQuery, String index, SubjectContext subjectContext) throws IOException {
    SearchAggregation searchAggregation = SearchIndexUtils.buildAggregationTree(aggQuery);
    return searchRepository.genericAggregation(q, index, searchAggregation, subjectContext);
  }

  public DataQualityReport getDataQualityReport(
      String q, String aggQuery, String index, String domain, SubjectContext subjectContext)
      throws IOException {
    String queryWithDomain = addDomainFilter(q, domain, index);
    SearchAggregation searchAggregation = SearchIndexUtils.buildAggregationTree(aggQuery);
    return searchRepository.genericAggregation(
        queryWithDomain, index, searchAggregation, subjectContext);
  }

  private String addDomainFilter(String query, String domain, String index) {
    if (nullOrEmpty(domain)) {
      return query;
    }

    String domainField =
        Entity.TEST_CASE_RESOLUTION_STATUS.equals(index)
            ? "testCase.domains.fullyQualifiedName"
            : "domains.fullyQualifiedName";

    String domainFilterStr =
        String.format("{\"term\": {\"%s\": \"%s\"}}", domainField, escapeDoubleQuotes(domain));

    if (nullOrEmpty(query)) {
      return String.format("{\"query\": {\"bool\": {\"filter\": [%s]}}}", domainFilterStr);
    }

    try (JsonReader queryReader = Json.createReader(new java.io.StringReader(query));
        JsonReader domainReader = Json.createReader(new java.io.StringReader(domainFilterStr))) {

      JsonObject queryJson = queryReader.readObject();
      JsonObject queryObj = queryJson.getJsonObject("query");

      if (queryObj == null) {
        return query;
      }

      JsonObject domainFilterObj = domainReader.readObject();
      JsonObject boolObj = queryObj.getJsonObject("bool");

      JsonObjectBuilder newBoolBuilder = Json.createObjectBuilder();
      JsonArrayBuilder filterBuilder = Json.createArrayBuilder();
      filterBuilder.add(domainFilterObj);

      if (boolObj != null) {
        for (String key : boolObj.keySet()) {
          if ("filter".equals(key)) {
            JsonArray existingFilters = boolObj.getJsonArray("filter");
            if (existingFilters != null) {
              for (JsonValue value : existingFilters) {
                filterBuilder.add(value);
              }
            }
          } else {
            newBoolBuilder.add(key, boolObj.get(key));
          }
        }
      } else {
        JsonArrayBuilder mustBuilder = Json.createArrayBuilder();
        mustBuilder.add(queryObj);
        newBoolBuilder.add("must", mustBuilder);
      }

      newBoolBuilder.add("filter", filterBuilder);

      JsonObjectBuilder resultBuilder = Json.createObjectBuilder();
      resultBuilder.add("query", Json.createObjectBuilder().add("bool", newBoolBuilder));

      return resultBuilder.build().toString();
    } catch (Exception e) {
      LOG.error("Error adding domain filter to query: {}", e.getMessage());
    }

    return query;
  }

  public TestSummary getTestSummary(List<ResultSummary> testCaseResults) {
    Map<String, String> entityLinkMap = new HashMap<>();
    for (ResultSummary result : testCaseResults) {
      TestCase testCase = Entity.getEntityByName(TEST_CASE, result.getTestCaseName(), "", ALL);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(testCase.getEntityLink());
      String linkString = entityLink.getFieldName() == null ? "table" : entityLink.getLinkString();
      entityLinkMap.put(result.getTestCaseName(), linkString);
    }
    return getTestSummary(testCaseResults, entityLinkMap);
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

  private void fetchAndSetTestCaseResultSummary(
      List<TestSuite> testSuites, EntityUtil.Fields fields) {
    if (!fields.contains("summary") || testSuites == null || testSuites.isEmpty()) {
      return;
    }

    List<UUID> suiteIds = testSuites.stream().map(TestSuite::getId).toList();
    Map<UUID, List<ResultSummary>> testCaseResultSummaryMap = batchGetResultSummary(suiteIds);

    Set<String> allTestCaseFQNs =
        testCaseResultSummaryMap.values().stream()
            .flatMap(List::stream)
            .map(ResultSummary::getTestCaseName)
            .collect(Collectors.toSet());
    Map<String, String> entityLinkMap = batchResolveEntityLinks(allTestCaseFQNs);

    Map<UUID, TestSummary> testSummaryMap =
        testCaseResultSummaryMap.entrySet().stream()
            .collect(
                Collectors.toMap(
                    Map.Entry::getKey, entry -> getTestSummary(entry.getValue(), entityLinkMap)));

    setFieldFromMap(
        true, testSuites, testCaseResultSummaryMap, TestSuite::setTestCaseResultSummary);

    setFieldFromMap(true, testSuites, testSummaryMap, TestSuite::setSummary);
  }

  protected void fetchAndSetIngestionPipelines(List<TestSuite> entities, EntityUtil.Fields fields) {
    if (!fields.contains("pipelines") || entities == null || entities.isEmpty()) {
      return;
    }

    Map<UUID, List<EntityReference>> ingestionPipelineMap =
        entities.stream()
            .collect(Collectors.toMap(EntityInterface::getId, this::getIngestionPipelines));
    setFieldFromMap(true, entities, ingestionPipelineMap, TestSuite::setPipelines);
  }

  private List<ResultSummary> getResultSummary(UUID testSuiteId) {
    TestCaseResultRepository repository =
        (TestCaseResultRepository) getEntityTimeSeriesRepository(TEST_CASE_RESULT);
    return repository.listLastTestCaseResultsForTestSuite(testSuiteId).getData().stream()
        .map(
            result ->
                new ResultSummary()
                    .withTestCaseName(result.getTestCaseFQN())
                    .withStatus(result.getTestCaseStatus())
                    .withTimestamp(result.getTimestamp()))
        .toList();
  }

  private Map<UUID, List<ResultSummary>> batchGetResultSummary(List<UUID> testSuiteIds) {
    TestCaseResultRepository repository =
        (TestCaseResultRepository) getEntityTimeSeriesRepository(TEST_CASE_RESULT);
    return repository.listResultSummariesForTestSuites(testSuiteIds);
  }

  private Map<String, String> batchResolveEntityLinks(Set<String> testCaseFQNs) {
    if (testCaseFQNs.isEmpty()) {
      return Map.of();
    }
    List<TestCase> testCases =
        Entity.getEntityByNames(TEST_CASE, new ArrayList<>(testCaseFQNs), "", ALL);
    Map<String, String> entityLinkMap = new HashMap<>();
    for (TestCase tc : testCases) {
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(tc.getEntityLink());
      String linkString = entityLink.getFieldName() == null ? "table" : entityLink.getLinkString();
      entityLinkMap.put(tc.getFullyQualifiedName(), linkString);
    }
    return entityLinkMap;
  }

  private TestSummary getTestSummary(
      List<ResultSummary> testCaseResults, Map<String, String> entityLinkMap) {
    record ProcessedTestCaseResults(String entityLink, String status) {}

    List<ProcessedTestCaseResults> processedTestCaseResults =
        testCaseResults.stream()
            .map(
                result -> {
                  String linkString = entityLinkMap.getOrDefault(result.getTestCaseName(), "table");
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
  public void storeEntities(List<TestSuite> entities) {
    List<TestSuite> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();
    for (TestSuite entity : entities) {
      List<EntityReference> tests = entity.getTests();
      entity.setTests(null);
      String jsonCopy = gson.toJson(entity);
      entitiesToStore.add(gson.fromJson(jsonCopy, TestSuite.class));
      entity.setTests(tests);
    }
    storeMany(entitiesToStore);
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
      String updatedBy, TestSuite original, boolean hardDelete) {
    // deleting a logical will delete the test suite and only remove the relationship to
    // test cases if hardDelete is true. Test Cases will not be deleted.
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
                deleteLogicalTestSuite(
                    securityContext.getUserPrincipal().getName(), testSuite, hardDelete);
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

  public void onTestSuiteExecutionComplete(IngestionPipeline pipeline) {
    try {
      TestSuite testSuite =
          Entity.getEntity(
              pipeline.getService().getType(),
              pipeline.getService().getId(),
              "*",
              Include.NON_DELETED);

      PipelineStatusType state = pipeline.getPipelineStatuses().getPipelineState();

      Double previousVersion = testSuite.getVersion();
      testSuite.setVersion(EntityUtil.nextVersion(previousVersion));
      testSuite.setUpdatedBy(pipeline.getUpdatedBy());
      testSuite.setUpdatedAt(System.currentTimeMillis());
      storeEntity(testSuite, true);
      searchRepository.updateEntityIndex(testSuite);
      updateRelatedSuitesLastResultTimestamp(testSuite);

      createTestSuiteCompletionChangeEvent(testSuite, previousVersion, state);

      if (testSuite.getDataContract() != null) {
        LOG.info(
            "Pipeline {} completed with status {}. Updating data contract {}.",
            pipeline.getFullyQualifiedName(),
            state,
            testSuite.getDataContract().getFullyQualifiedName());

        DataContractRepository dataContractRepository =
            (DataContractRepository) Entity.getEntityRepository(Entity.DATA_CONTRACT);
        dataContractRepository.updateContractDQResults(testSuite.getDataContract(), testSuite);
      }

    } catch (Exception e) {
      LOG.error(
          "Failed to process test suite completion for pipeline {}: {}",
          pipeline.getFullyQualifiedName(),
          e.getMessage(),
          e);
    }
  }

  private void updateRelatedSuitesLastResultTimestamp(TestSuite completedSuite) {
    List<EntityReference> testCases = getTestCases(completedSuite);
    if (testCases == null || testCases.isEmpty()) return;

    List<String> testCaseIds = testCases.stream().map(ref -> ref.getId().toString()).toList();
    List<CollectionDAO.EntityRelationshipObject> relationships =
        daoCollection
            .relationshipDAO()
            .findFromBatch(testCaseIds, Relationship.CONTAINS.ordinal(), TEST_SUITE, TEST_CASE);
    Set<UUID> relatedSuiteIds =
        relationships.stream()
            .map(rel -> UUID.fromString(rel.getFromId()))
            .filter(id -> !id.equals(completedSuite.getId()))
            .collect(Collectors.toSet());

    if (relatedSuiteIds.isEmpty()) return;

    LOG.info(
        "Updating lastResultTimestamp for {} related suites {} after completion of suite {}",
        relatedSuiteIds.size(),
        relatedSuiteIds,
        completedSuite.getId());

    List<String> suiteIdStrings = relatedSuiteIds.stream().map(UUID::toString).toList();
    List<CollectionDAO.TestCaseResultTimeSeriesDAO.SuiteMaxTimestamp> timestamps =
        daoCollection.testCaseResultTimeSeriesDao().getMaxTimestampForTestSuites(suiteIdStrings);

    IndexMapping indexMapping = searchRepository.getIndexMapping(TEST_SUITE);
    String indexName = indexMapping.getIndexName(searchRepository.getClusterAlias());
    SearchClient searchClient = searchRepository.getSearchClient();

    for (CollectionDAO.TestCaseResultTimeSeriesDAO.SuiteMaxTimestamp entry : timestamps) {
      try {
        Map<String, Object> doc = Map.of("lastResultTimestamp", entry.maxTimestamp());
        searchClient.updateEntity(
            indexName,
            entry.testSuiteId(),
            doc,
            "if (ctx._source.lastResultTimestamp == null || "
                + "params.lastResultTimestamp > ctx._source.lastResultTimestamp) {"
                + " ctx._source.lastResultTimestamp = params.lastResultTimestamp; }");
      } catch (Exception e) {
        LOG.warn(
            "Failed to update lastResultTimestamp for related suite {}: {}",
            entry.testSuiteId(),
            e.getMessage());
      }
    }
  }

  private void createTestSuiteCompletionChangeEvent(
      TestSuite testSuite, Double previousVersion, PipelineStatusType pipelineState) {
    List<ResultSummary> resultSummary = testSuite.getTestCaseResultSummary();
    TestSummary summary = testSuite.getSummary();

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityId(testSuite.getId())
            .withEntityType(Entity.TEST_SUITE)
            .withEntityFullyQualifiedName(testSuite.getFullyQualifiedName())
            .withUserName(testSuite.getUpdatedBy())
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(testSuite.getVersion())
            .withPreviousVersion(previousVersion)
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName("testCaseResultSummary")
                                .withNewValue(resultSummary))))
            .withEntity(testSuite);

    if (testSuite.getDomains() != null) {
      changeEvent.withDomains(testSuite.getDomains().stream().map(EntityReference::getId).toList());
    }

    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));

    LOG.info(
        "Created consolidated ChangeEvent for TestSuite {} with status: {} (passed: {}/{})",
        testSuite.getFullyQualifiedName(),
        pipelineState,
        summary != null ? summary.getSuccess() : 0,
        summary != null ? summary.getTotal() : 0);
  }

  private class TestSuitePipelineStatusHandler implements EntityLifecycleEventHandler {
    @Override
    public void onEntityUpdated(
        EntityInterface entity,
        ChangeDescription changeDescription,
        SubjectContext subjectContext) {
      if (!(entity instanceof IngestionPipeline pipeline)) {
        return;
      }

      Optional.of(pipeline)
          .filter(p -> p.getPipelineType() == PipelineType.TEST_SUITE)
          .filter(p -> p.getPipelineStatuses() != null)
          .filter(
              p -> {
                PipelineStatusType state = p.getPipelineStatuses().getPipelineState();
                return state == PipelineStatusType.SUCCESS
                    || state == PipelineStatusType.FAILED
                    || state == PipelineStatusType.PARTIAL_SUCCESS;
              })
          .ifPresent(TestSuiteRepository.this::onTestSuiteExecutionComplete);
    }

    @Override
    public String getHandlerName() {
      return "TestSuitePipelineStatusHandler";
    }

    @Override
    public Set<String> getSupportedEntityTypes() {
      return Set.of(Entity.INGESTION_PIPELINE);
    }
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
      recordChange("dataContract", original.getDataContract(), updated.getDataContract());
    }
  }
}
