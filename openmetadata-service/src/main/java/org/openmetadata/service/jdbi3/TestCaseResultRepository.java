package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.Entity.TEST_DEFINITION;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseDimensionResult;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.dqtests.TestCaseResultResource;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class TestCaseResultRepository extends EntityTimeSeriesRepository<TestCaseResult> {
  public static final String TESTCASE_RESULT_EXTENSION = "testCase.testCaseResult";
  private static final String TEST_CASE_RESULT_FIELD = "testCaseResult";
  private final TestCaseRepository testCaseRepository;
  private final TestCaseDimensionResultRepository dimensionResultRepository;
  public static String INCLUDE_SEARCH_FIELDS =
      "id,testCaseFQN,timestamp,testCaseStatus,result,sampleData,testResultValue,passedRows,failedRows,passedRowsPercentage,failedRowsPercentage,incidentId,maxBound,minBound";

  public enum OperationType {
    CREATE,
    UPDATE,
    DELETE
  }

  public TestCaseResultRepository() {
    super(
        TestCaseResultResource.COLLECTION_PATH,
        Entity.getCollectionDAO().testCaseResultTimeSeriesDao(),
        TestCaseResult.class,
        Entity.TEST_CASE_RESULT);
    this.testCaseRepository = new TestCaseRepository();
    this.dimensionResultRepository = new TestCaseDimensionResultRepository();
  }

  public ResultList<TestCaseResult> getTestCaseResults(String fqn, Long startTs, Long endTs) {
    List<TestCaseResult> testCaseResults;
    startTs =
        Optional.ofNullable(startTs)
            .orElse(Long.MIN_VALUE); // default to Long.MIN_VALUE if not provided
    endTs =
        Optional.ofNullable(endTs)
            .orElse(Long.MAX_VALUE); // default to Long.MAX_VALUE if not provided
    testCaseResults =
        JsonUtils.readObjects(
            daoCollection
                .dataQualityDataTimeSeriesDao()
                .listBetweenTimestampsByOrder(
                    fqn,
                    TESTCASE_RESULT_EXTENSION,
                    startTs,
                    endTs,
                    EntityTimeSeriesDAO.OrderBy.DESC),
            TestCaseResult.class);
    return new ResultList<>(testCaseResults, null, null, testCaseResults.size());
  }

  public Response addTestCaseResult(
      String updatedBy, UriInfo uriInfo, String fqn, TestCaseResult testCaseResult) {
    TestCase testCase = Entity.getEntityByName(TEST_CASE, fqn, "", Include.ALL);
    if (testCaseResult.getTestCaseStatus() == TestCaseStatus.Success) {
      testCaseRepository.deleteTestCaseFailedRowsSample(testCase.getId());
    }
    setTestCaseResultIncidentId(testCaseResult, testCase, updatedBy);

    // Store dimensional results if present
    if (testCaseResult.getDimensionResults() != null
        && !testCaseResult.getDimensionResults().isEmpty()) {
      storeDimensionalResults(testCase, testCaseResult);
      // Clear dimensional results from main result to avoid duplication
      testCaseResult.setDimensionResults(null);
    }

    ((CollectionDAO.TestCaseResultTimeSeriesDAO) timeSeriesDao)
        .insert(
            testCase.getFullyQualifiedName(),
            TESTCASE_RESULT_EXTENSION,
            TEST_CASE_RESULT_FIELD,
            JsonUtils.pojoToJson(testCaseResult),
            testCaseResult.getIncidentId());

    // Post create actions
    postCreate(testCaseResult);
    return Response.created(uriInfo.getRequestUri()).entity(testCaseResult).build();
  }

  public ResultList<TestCaseResult> listLastTestCaseResultsForTestSuite(UUID testSuiteId) {
    List<String> json =
        ((CollectionDAO.TestCaseResultTimeSeriesDAO) timeSeriesDao)
            .listLastTestCaseResultsForTestSuite(testSuiteId);
    List<TestCaseResult> testCaseResults = JsonUtils.readObjects(json, TestCaseResult.class);
    return new ResultList<>(testCaseResults, null, null, testCaseResults.size());
  }

  public Map<UUID, List<ResultSummary>> listResultSummariesForTestSuites(List<UUID> testSuiteIds) {
    if (testSuiteIds == null || testSuiteIds.isEmpty()) {
      return Map.of();
    }
    List<String> idStrings = testSuiteIds.stream().map(UUID::toString).toList();
    List<CollectionDAO.TestCaseResultTimeSeriesDAO.ResultSummaryRow> rows =
        ((CollectionDAO.TestCaseResultTimeSeriesDAO) timeSeriesDao)
            .listResultSummariesForTestSuites(idStrings);

    return rows.stream()
        .map(
            row ->
                Map.entry(
                    UUID.fromString(row.testSuiteId()),
                    new ResultSummary()
                        .withTestCaseName(row.testCaseFQN())
                        .withStatus(TestCaseStatus.fromValue(row.testCaseStatus()))
                        .withTimestamp(row.timestamp())))
        .collect(
            Collectors.groupingBy(
                Map.Entry::getKey, Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
  }

  public TestCaseResult listLastTestCaseResult(String testCaseFQN) {
    String json =
        ((CollectionDAO.TestCaseResultTimeSeriesDAO) timeSeriesDao)
            .listLastTestCaseResult(testCaseFQN);
    return JsonUtils.readValue(json, TestCaseResult.class);
  }

  @Override
  protected void postCreate(TestCaseResult entity) {
    super.postCreate(entity);
    updateTestCaseStatus(entity, OperationType.CREATE);
  }

  @Override
  protected void postUpdate(TestCaseResult entity) {
    super.postUpdate(entity);
    updateTestCaseStatus(entity, OperationType.UPDATE);
  }

  @Override
  protected void postDelete(TestCaseResult entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    updateTestCaseStatus(entity, OperationType.DELETE);
  }

  @SneakyThrows
  public RestUtil.PatchResponse<TestCaseResult> patchTestCaseResults(
      String fqn, Long timestamp, JsonPatch patch, String updatedBy) {
    TestCaseResult original =
        JsonUtils.readValue(
            timeSeriesDao.getExtensionAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp),
            TestCaseResult.class);

    return patch(original.getId(), patch, updatedBy);
  }

  public RestUtil.DeleteResponse<TestCaseResult> deleteTestCaseResult(String fqn, Long timestamp) {
    // Validate the request content
    TestCase testCase =
        Entity.getEntityByName(TEST_CASE, fqn, "testDefinition,testSuites", Include.NON_DELETED);
    TestCaseResult storedTestCaseResult =
        JsonUtils.readValue(
            timeSeriesDao.getExtensionAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp),
            TestCaseResult.class);

    if (storedTestCaseResult != null) {
      // Delete main result
      timeSeriesDao.deleteAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp);
      searchRepository.deleteTimeSeriesEntityById(storedTestCaseResult);

      // Delete associated dimensional results
      dimensionResultRepository.deleteByTestCaseAndTimestamp(fqn, timestamp);

      postDelete(storedTestCaseResult, true); // Hard delete for specific timestamp
      return new RestUtil.DeleteResponse<>(storedTestCaseResult, ENTITY_DELETED);
    }
    throw new EntityNotFoundException(
        String.format(
            "Failed to find testCase result for %s at %s", testCase.getName(), timestamp));
  }

  @Override
  protected void setFields(TestCaseResult entity, EntityUtil.Fields fields) {
    TestCase testCase = null;
    if (fields.contains(TEST_CASE)) {
      testCase = getTestCaseReference(entity.getTestCaseFQN());
      entity.setTestCase(testCase.getEntityReference());
    }
    entity.setTestDefinition(
        fields.contains(TEST_DEFINITION)
            ? getTestDefinitionReference(testCase, entity.getTestCaseFQN())
            : null);
  }

  private void setTestCaseResultIncidentId(
      TestCaseResult testCaseResult, TestCase testCase, String updatedBy) {
    if (TestCaseStatus.Failed.equals(testCaseResult.getTestCaseStatus())) {
      UUID incidentStateId =
          TestCaseResolutionStatusRepository.getOrCreateIncident(testCase, updatedBy);
      testCaseResult.setIncidentId(incidentStateId);
    } else {
      testCaseResult.setIncidentId(null);
    }
  }

  private TestCase getTestCaseReference(String testCaseFQN) {
    TestCase testCase =
        Entity.getEntityByName(TEST_CASE, testCaseFQN, TEST_DEFINITION, Include.ALL);
    return testCase;
  }

  private EntityReference getTestDefinitionReference(TestCase testCase, String testCaseFQN) {
    if (testCase != null) {
      return testCase.getTestDefinition();
    }
    testCase = Entity.getEntityByName(TEST_CASE, testCaseFQN, TEST_DEFINITION, Include.ALL);
    return testCase.getTestDefinition();
  }

  private void updateTestCaseStatus(TestCaseResult testCaseResult, OperationType operationType) {
    TestCase original =
        Entity.getEntityByName(TEST_CASE, testCaseResult.getTestCaseFQN(), "*", Include.ALL);
    TestCase updated = JsonUtils.deepCopy(original, TestCase.class);

    if (original.getTestCaseResult() == null) {
      if (!operationType.equals(OperationType.DELETE)) {
        updated.setTestCaseResult(testCaseResult);
      }
    } else if (testCaseResult.getTimestamp() >= original.getTestCaseResult().getTimestamp()) {
      if (operationType.equals(OperationType.DELETE)) {
        testCaseResult = getLatestRecord(original.getFullyQualifiedName());
      }
      updated.setTestCaseResult(testCaseResult);
    } else {
      LOG.warn(
          "[RACE-CONDITION-MONITOR] Skipping older test result | testCaseFQN={} | "
              + "incomingTimestamp={} | storedTimestamp={} | threadId={}",
          testCaseResult.getTestCaseFQN(),
          testCaseResult.getTimestamp(),
          original.getTestCaseResult().getTimestamp(),
          Thread.currentThread().getId());
      return;
    }
    updated.setTestCaseStatus(testCaseResult.getTestCaseStatus());

    EntityRepository.EntityUpdater entityUpdater =
        testCaseRepository.getUpdater(original, updated, EntityRepository.Operation.PATCH, null);
    entityUpdater.update();
  }

  @Override
  protected void setIncludeSearchFields(SearchListFilter searchListFilter) {
    String includeFields = searchListFilter.getQueryParam("includeFields");
    if (CommonUtil.nullOrEmpty(includeFields))
      searchListFilter.addQueryParam("includeFields", INCLUDE_SEARCH_FIELDS);
  }

  @Override
  protected List<String> getIncludeSearchFields() {
    return Arrays.asList(INCLUDE_SEARCH_FIELDS.split(","));
  }

  protected void deleteAllTestCaseResults(String fqn) {
    // Delete all the test case results
    daoCollection.dataQualityDataTimeSeriesDao().deleteAll(fqn);

    // Delete all dimensional results
    dimensionResultRepository.deleteAllByTestCase(fqn);

    Map<String, Object> params = Map.of("fqn", fqn);
    searchRepository.deleteByScript(
        TEST_CASE_RESULT,
        "if (!(doc['testCaseFQN.keyword'].empty)) { doc['testCaseFQN.keyword'].value == params.fqn}",
        params);
  }

  private void storeDimensionalResults(TestCase testCase, TestCaseResult testCaseResult) {
    List<TestCaseDimensionResult> dimensionResults = testCaseResult.getDimensionResults();
    if (dimensionResults == null || dimensionResults.isEmpty()) {
      return;
    }

    String testCaseFQN = testCase.getFullyQualifiedName();

    // Set common fields for each dimensional result
    for (TestCaseDimensionResult dimResult : dimensionResults) {
      // Set the test case reference
      dimResult.setTestCase(testCase.getEntityReference());
      // Set the parent test case result ID
      dimResult.setTestCaseResultId(testCaseResult.getId());
      // Ensure timestamp matches the parent result
      dimResult.setTimestamp(testCaseResult.getTimestamp());

      // Store each dimensional result
      dimensionResultRepository.storeDimensionResult(testCaseFQN, dimResult);
    }
  }

  public boolean hasTestCaseFailure(String fqn) throws IOException {
    ResultList<TestCaseResult> testCaseResultResults =
        listLatestFromSearch(
            EntityUtil.Fields.EMPTY_FIELDS,
            new SearchListFilter().addQueryParam("entityFQN", fqn),
            "testCaseFQN.keyword",
            null);
    return testCaseResultResults.getData().stream()
        .anyMatch(
            testCaseResult -> testCaseResult.getTestCaseStatus().equals(TestCaseStatus.Failed));
  }
}
