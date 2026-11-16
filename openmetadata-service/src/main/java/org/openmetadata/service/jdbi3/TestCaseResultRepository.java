package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.Entity.TEST_DEFINITION;

import com.google.common.annotations.VisibleForTesting;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseDimensionResult;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.governance.workflows.WorkflowEventConsumer;
import org.openmetadata.service.resources.dqtests.TestCaseResultResource;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.tasks.TaskWorkflowHandler;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class TestCaseResultRepository extends EntityTimeSeriesRepository<TestCaseResult> {
  public static final String TESTCASE_RESULT_EXTENSION = "testCase.testCaseResult";
  private static final String TEST_CASE_RESULT_FIELD = "testCaseResult";
  private static final String CLEAR_INDEXED_STATUS_SCRIPT =
      """
      def indexed = ctx._source.testCaseResult;
      if (indexed == null || indexed.timestamp == null || indexed.timestamp <= params.deletedTimestamp) {
        ctx._source.remove('testCaseResult');
        ctx._source.remove('testCaseStatus');
      } else {
        ctx.op = 'noop';
      }
      """;

  /** Group-by field of the latest-result-per-test-case listings. */
  public static final String LATEST_PER_TEST_CASE = "testCaseFQN.keyword";

  // A result's test case, its table and its type never change between its results.
  private static final Set<String> TEST_CASE_INVARIANT_PARAMS =
      Set.of("entityFQN", "testCaseFQN", "testCaseType");
  public static final String TEST_CASE_INDEX_FIELDS =
      "testDefinition,testSuite,testSuites,owners,tags,followers";
  private static final int STATUS_UPDATE_ATTEMPTS = 3;
  private final TestCaseRepository testCaseRepository;
  private final TestCaseDimensionResultRepository dimensionResultRepository;
  public static String INCLUDE_SEARCH_FIELDS =
      "id,testCaseFQN,timestamp,testCaseStatus,result,sampleData,testResultValue,passedRows,failedRows,passedRowsPercentage,failedRowsPercentage,incidentId,maxBound,minBound,duration,errorDetails,evaluationScope";

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
    TestCase testCase = Entity.getEntityByName(TEST_CASE, fqn, "incidentId", Include.ALL);
    // A result older than the stored newest one is history: it must not resolve or open incidents,
    // nor drop the failed rows sample, which all describe the test case's current state.
    if (isCurrentResult(testCaseResult, getLatestRecord(testCase.getFullyQualifiedName()))) {
      if (testCaseResult.getTestCaseStatus() == TestCaseStatus.Success) {
        testCaseRepository.deleteTestCaseFailedRowsSample(testCase.getId());
        autoResolveIncidentOnSuccess(testCase);
      }
      setTestCaseResultIncidentId(testCaseResult, testCase, updatedBy);
    } else {
      testCaseResult.setIncidentId(null);
    }

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

  private void autoResolveIncidentOnSuccess(TestCase testCase) {
    if (!isAutoCloseIncidentEnabled(testCase) || testCase.getIncidentId() == null) {
      return;
    }

    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task incidentTask =
        taskRepository.findTaskByEntityTypeAndStatuses(
            testCase.getFullyQualifiedName(),
            TaskEntityType.TestCaseResolution,
            TaskRepository.OPEN_TASK_STATUSES);

    if (incidentTask == null) {
      LOG.debug(
          "Skipping auto-close for test case '{}' because no open incident task was found",
          testCase.getFullyQualifiedName());
      return;
    }

    // Rehydrate the full task before resolving it so workflow transitions are available.
    // The lightweight lookup path is enough to find the row, but not enough to advance the
    // workflow stage to `resolved`, which is what drives legacy TCRS mirroring.
    incidentTask = taskRepository.get(null, incidentTask.getId(), taskRepository.getFields("*"));

    TaskWorkflowHandler.getInstance()
        .resolveTask(
            incidentTask,
            "resolve",
            TaskResolutionType.Completed,
            null,
            null,
            "AutoResolved",
            WorkflowEventConsumer.GOVERNANCE_BOT);
  }

  private boolean isAutoCloseIncidentEnabled(TestCase testCase) {
    return testCase != null
        && JsonUtils.valueToTree(testCase).path("autoCloseIncident").asBoolean(false);
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
          TestCaseResolutionStatusRepository.getOrCreateIncident(
              testCase, updatedBy, testCaseResult.getResult());
      testCaseResult.setIncidentId(incidentStateId);
    } else {
      testCaseResult.setIncidentId(null);
    }
  }

  private TestCase getTestCaseReference(String testCaseFQN) {
    return Entity.getEntityByName(TEST_CASE, testCaseFQN, TEST_DEFINITION, Include.ALL);
  }

  private EntityReference getTestDefinitionReference(TestCase testCase, String testCaseFQN) {
    if (testCase != null) {
      return testCase.getTestDefinition();
    }
    testCase = Entity.getEntityByName(TEST_CASE, testCaseFQN, TEST_DEFINITION, Include.ALL);
    return testCase.getTestDefinition();
  }

  /**
   * Keeps the test case's denormalized status (entity row and search document) on its newest
   * result. The test case row never stores {@code testCaseResult}, so the newest result is read
   * back from the results table, which already reflects the write or delete that triggered this.
   */
  private void updateTestCaseStatus(TestCaseResult changed, OperationType operationType) {
    for (int attempt = 1; attempt <= STATUS_UPDATE_ATTEMPTS; attempt++) {
      try {
        syncTestCaseStatus(changed, operationType, true);
        return;
      } catch (PreconditionFailedException e) {
        LOG.debug(
            "Test case {} changed while refreshing its status (attempt {})",
            changed.getTestCaseFQN(),
            attempt);
      }
    }
    // A stale cached copy would make every optimistic attempt conflict; never end up worse than a
    // plain last-writer-wins update.
    syncTestCaseStatus(changed, operationType, false);
  }

  @VisibleForTesting
  void syncTestCaseStatus(TestCaseResult changed, OperationType operationType, boolean optimistic) {
    // Snapshot the test case before reading its newest result. A newer result stored after that
    // read bumps the test case version when it syncs, so this optimistic update then conflicts and
    // retries instead of writing back an older status.
    TestCase original =
        Entity.getEntityByName(
            TEST_CASE, changed.getTestCaseFQN(), TEST_CASE_INDEX_FIELDS, Include.ALL);
    TestCaseResult latest = getLatestRecord(changed.getTestCaseFQN());
    if (!isCurrentResult(changed, latest)) {
      LOG.warn(
          "[RACE-CONDITION-MONITOR] Skipping older test result | testCaseFQN={} | operation={} | "
              + "changedTimestamp={} | newestTimestamp={}",
          changed.getTestCaseFQN(),
          operationType,
          changed.getTimestamp(),
          latest.getTimestamp());
      return;
    }
    // The row never stores testCaseResult, so it is null on original and the newest result always
    // registers as a change to reindex.
    TestCase updated = JsonUtils.deepCopy(original, TestCase.class);
    updated.setTestCaseResult(latest);
    updated.setTestCaseStatus(latest == null ? null : latest.getTestCaseStatus());

    EntityRepository.EntityUpdater entityUpdater =
        testCaseRepository.getUpdater(
            original, updated, EntityRepository.Operation.PATCH, null, optimistic);
    if (optimistic) {
      entityUpdater.updateWithOptimisticLocking();
    } else {
      entityUpdater.update();
    }
    // Re-read: a result posted right after this delete has synced its own status, which must stay.
    if (latest == null && getLatestRecord(changed.getTestCaseFQN()) == null) {
      clearIndexedStatus(original, changed);
    }
  }

  /** Whether {@code result} is (or was, for a delete) the newest result of its test case. */
  static boolean isCurrentResult(TestCaseResult result, TestCaseResult newest) {
    return newest == null || result.getTimestamp() >= newest.getTimestamp();
  }

  /**
   * A reindex only sends the fields a test case has, so the status of a test case whose last result
   * was deleted would otherwise stay in search. Removed here, where the missing result is known,
   * rather than whenever a test case is indexed without its result loaded. The script keeps a
   * result newer than the deleted one, in case a new result was indexed first.
   */
  private void clearIndexedStatus(TestCase testCase, TestCaseResult deleted) {
    searchRepository
        .getSearchClient()
        .updateEntity(
            searchRepository.getWriteIndexName(searchRepository.getIndexMapping(TEST_CASE)),
            testCase.getId().toString(),
            Map.of("deletedTimestamp", deleted.getTimestamp()),
            CLEAR_INDEXED_STATUS_SCRIPT);
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

  @Override
  protected Set<String> getGroupInvariantParams(String groupBy) {
    return LATEST_PER_TEST_CASE.equals(groupBy) ? TEST_CASE_INVARIANT_PARAMS : Set.of();
  }

  protected void deleteAllTestCaseResults(String fqn) {
    deleteAllTestCaseResults(List.of(fqn));
  }

  protected void deleteAllTestCaseResults(List<String> testCaseFQNs) {
    if (testCaseFQNs.isEmpty()) {
      return;
    }
    // Delete all the test case results
    daoCollection.dataQualityDataTimeSeriesDao().deleteAllBatch(testCaseFQNs);

    // Delete all dimensional results
    dimensionResultRepository.deleteAllByTestCases(testCaseFQNs);

    Map<String, Object> params = Map.of("fqns", testCaseFQNs);
    searchRepository.deleteByScript(
        TEST_CASE_RESULT,
        "!doc['testCaseFQN.keyword'].empty && "
            + "params.fqns.contains(doc['testCaseFQN.keyword'].value)",
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
      // A dimension is a group of the rows the run read, so it was measured on the same scope.
      dimResult.setEvaluationScope(testCaseResult.getEvaluationScope());

      // Store each dimensional result
      dimensionResultRepository.storeDimensionResult(testCaseFQN, dimResult);
    }
  }
}
