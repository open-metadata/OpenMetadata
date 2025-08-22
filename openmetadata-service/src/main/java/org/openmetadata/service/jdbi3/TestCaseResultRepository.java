package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.Entity.TEST_DEFINITION;
import static org.openmetadata.service.Entity.TEST_SUITE;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.SneakyThrows;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class TestCaseResultRepository extends EntityTimeSeriesRepository<TestCaseResult> {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases/testCaseResults";
  public static final String TESTCASE_RESULT_EXTENSION = "testCase.testCaseResult";
  private static final String TEST_CASE_RESULT_FIELD = "testCaseResult";
  private final TestCaseRepository testCaseRepository;
  public static String INCLUDE_SEARCH_FIELDS =
      "id,testCaseFQN,timestamp,testCaseStatus,result,sampleData,testResultValue,passedRows,failedRows,passedRowsPercentage,failedRowsPercentage,incidentId,maxBound,minBound";

  public enum OperationType {
    CREATE,
    UPDATE,
    DELETE
  }

  public TestCaseResultRepository() {
    super(
        COLLECTION_PATH,
        Entity.getCollectionDAO().testCaseResultTimeSeriesDao(),
        TestCaseResult.class,
        Entity.TEST_CASE_RESULT);
    this.testCaseRepository = new TestCaseRepository();
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
    return new ResultList<>(
        testCaseResults, String.valueOf(startTs), String.valueOf(endTs), testCaseResults.size());
  }

  public Response addTestCaseResult(
      String updatedBy, UriInfo uriInfo, String fqn, TestCaseResult testCaseResult) {
    TestCase testCase = Entity.getEntityByName(TEST_CASE, fqn, "", Include.ALL);
    if (testCaseResult.getTestCaseStatus() == TestCaseStatus.Success) {
      testCaseRepository.deleteTestCaseFailedRowsSample(testCase.getId());
    }
    setTestCaseResultIncidentId(testCaseResult, testCase, updatedBy);

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
      timeSeriesDao.deleteAtTimestamp(fqn, TESTCASE_RESULT_EXTENSION, timestamp);
      searchRepository.deleteTimeSeriesEntityById(storedTestCaseResult);
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
      return;
    }
    updated.setTestCaseStatus(testCaseResult.getTestCaseStatus());

    EntityRepository.EntityUpdater entityUpdater =
        testCaseRepository.getUpdater(original, updated, EntityRepository.Operation.PATCH, null);
    entityUpdater.update();
    updateTestSuiteSummary(updated);
  }

  private void updateTestSuiteSummary(TestCase testCase) {
    List<String> fqns =
        testCase.getTestSuites() != null
            ? testCase.getTestSuites().stream().map(TestSuite::getFullyQualifiedName).toList()
            : null;
    TestSuiteRepository testSuiteRepository = new TestSuiteRepository();
    DataContractRepository dataContractRepository =
        (DataContractRepository) Entity.getEntityRepository(Entity.DATA_CONTRACT);
    if (fqns != null) {
      for (String fqn : fqns) {
        TestSuite testSuite = Entity.getEntityByName(TEST_SUITE, fqn, "*", Include.ALL);
        if (testSuite != null) {
          TestSuite original = JsonUtils.deepCopy(testSuite, TestSuite.class);
          List<ResultSummary> resultSummaries = testSuite.getTestCaseResultSummary();

          if (resultSummaries != null) {
            resultSummaries.stream()
                .filter(s -> s.getTestCaseName().equals(testCase.getFullyQualifiedName()))
                .findFirst()
                .ifPresentOrElse(
                    s -> {
                      s.setStatus(testCase.getTestCaseStatus());
                      s.setTimestamp(testCase.getTestCaseResult().getTimestamp());
                    },
                    () ->
                        resultSummaries.add(
                            new ResultSummary()
                                .withTestCaseName(testCase.getFullyQualifiedName())
                                .withStatus(testCase.getTestCaseStatus())
                                .withTimestamp(testCase.getTestCaseResult().getTimestamp())));
          } else {
            testSuite.setTestCaseResultSummary(
                List.of(
                    new ResultSummary()
                        .withTestCaseName(testCase.getFullyQualifiedName())
                        .withStatus(testCase.getTestCaseStatus())
                        .withTimestamp(testCase.getTestCaseResult().getTimestamp())));
          }
          EntityRepository.EntityUpdater entityUpdater =
              testSuiteRepository.getUpdater(
                  original, testSuite, EntityRepository.Operation.PATCH, null);
          entityUpdater.update();
          // Propagate test results to the data contract if it exists
          if (testSuite.getDataContract() != null) {
            dataContractRepository.updateContractDQResults(testSuite.getDataContract(), testSuite);
          }
        }
      }
    }
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
    Map<String, Object> params = Map.of("fqn", fqn);
    searchRepository.deleteByScript(
        TEST_CASE_RESULT,
        "if (!(doc['testCaseFQN.keyword'].empty)) { doc['testCaseFQN.keyword'].value == params.fqn}",
        params);
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
