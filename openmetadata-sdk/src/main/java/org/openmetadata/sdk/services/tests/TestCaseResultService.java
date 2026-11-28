package org.openmetadata.sdk.services.tests;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.AllModels;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Service for managing test case results.
 *
 * <p>Test case results track the execution history and status of test cases over time.
 */
public class TestCaseResultService {

  private static final String BASE_PATH = "/v1/dataQuality/testCases/testCaseResults";
  private static final TypeReference<ResultList<TestCaseResult>> TEST_CASE_RESULT_LIST_TYPE =
      new TypeReference<>() {};
  private final HttpClient httpClient;

  public TestCaseResultService(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  // ===================================================================
  // CREATE OPERATIONS
  // ===================================================================

  /**
   * Add a test case result for a test case.
   *
   * @param testCaseFqn The fully qualified name of the test case
   * @param result The test case result to add
   * @return The created test case result
   */
  public TestCaseResult create(String testCaseFqn, CreateTestCaseResult result)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, BASE_PATH + "/" + testCaseFqn, result, TestCaseResult.class);
  }

  // ===================================================================
  // READ OPERATIONS
  // ===================================================================

  /**
   * Get test case results for a test case.
   *
   * @param testCaseFqn The fully qualified name of the test case
   * @return List of test case results
   */
  public ListResponse<TestCaseResult> get(String testCaseFqn) throws OpenMetadataException {
    return get(testCaseFqn, null);
  }

  /**
   * Get test case results for a test case with parameters.
   *
   * @param testCaseFqn The fully qualified name of the test case
   * @param params Query parameters (startTs, endTs, etc.)
   * @return List of test case results
   */
  public ListResponse<TestCaseResult> get(String testCaseFqn, ListParams params)
      throws OpenMetadataException {
    String path = BASE_PATH + "/" + testCaseFqn;
    ResultList<TestCaseResult> result =
        httpClient.executeForType(
            HttpMethod.GET, path, null, TEST_CASE_RESULT_LIST_TYPE, toRequestOptions(params));
    return new ListResponse<>(result);
  }

  /**
   * Search test case results with pagination.
   *
   * @param params Search parameters
   * @return List of test case results matching the search
   */
  public ListResponse<TestCaseResult> searchList(ListParams params) throws OpenMetadataException {
    ResultList<TestCaseResult> result =
        httpClient.executeForType(
            HttpMethod.GET,
            BASE_PATH + "/search/list",
            null,
            TEST_CASE_RESULT_LIST_TYPE,
            toRequestOptions(params));
    return new ListResponse<>(result);
  }

  /**
   * Get the latest test case result from search.
   *
   * @param params Search parameters
   * @return The latest matching test case result as a single-element list, or an empty list when
   *     nothing matches
   */
  public ListResponse<TestCaseResult> searchLatest(ListParams params) throws OpenMetadataException {
    TestCaseResult latest =
        httpClient.execute(
            HttpMethod.GET,
            BASE_PATH + "/search/latest",
            null,
            TestCaseResult.class,
            toRequestOptions(params));
    return latest == null
        ? new ListResponse<>(Collections.emptyList())
        : new ListResponse<>(List.of(latest), new AllModels.Paging().withTotal(1));
  }

  // ===================================================================
  // UPDATE OPERATIONS
  // ===================================================================

  /**
   * Patch a test case result.
   *
   * @param testCaseFqn The fully qualified name of the test case
   * @param timestamp The timestamp of the result to patch
   * @param patch The JSON patch to apply
   * @return The updated test case result
   */
  public TestCaseResult patch(String testCaseFqn, Long timestamp, JsonNode patch)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PATCH,
        BASE_PATH + "/" + testCaseFqn + "/" + timestamp,
        patch,
        TestCaseResult.class);
  }

  // ===================================================================
  // DELETE OPERATIONS
  // ===================================================================

  /**
   * Delete a test case result.
   *
   * @param testCaseFqn The fully qualified name of the test case
   * @param timestamp The timestamp of the result to delete
   */
  public void delete(String testCaseFqn, Long timestamp) throws OpenMetadataException {
    httpClient.execute(
        HttpMethod.DELETE, BASE_PATH + "/" + testCaseFqn + "/" + timestamp, null, Void.class);
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private static RequestOptions toRequestOptions(ListParams params) {
    if (params == null) {
      return null;
    }
    Map<String, String> queryParams = params.toQueryParams();
    if (queryParams.isEmpty()) {
      return null;
    }
    return RequestOptions.builder().queryParams(queryParams).build();
  }

  // ===================================================================
  // FLUENT API BUILDER
  // ===================================================================

  /** Builder for creating test case results with a fluent API. */
  public static class ResultBuilder {
    private final TestCaseResultService service;
    private final String testCaseFqn;
    private Long timestamp;
    private org.openmetadata.schema.tests.type.TestCaseStatus testCaseStatus;
    private String result;
    private String testResultValue;
    private Long passedRows;
    private Long failedRows;
    private Long passedRowsPercentage;
    private Long failedRowsPercentage;

    public ResultBuilder(TestCaseResultService service, String testCaseFqn) {
      this.service = service;
      this.testCaseFqn = testCaseFqn;
      this.timestamp = System.currentTimeMillis();
    }

    public ResultBuilder timestamp(Long timestamp) {
      this.timestamp = timestamp;
      return this;
    }

    public ResultBuilder status(org.openmetadata.schema.tests.type.TestCaseStatus status) {
      this.testCaseStatus = status;
      return this;
    }

    public ResultBuilder passed() {
      this.testCaseStatus = org.openmetadata.schema.tests.type.TestCaseStatus.Success;
      return this;
    }

    public ResultBuilder failed() {
      this.testCaseStatus = org.openmetadata.schema.tests.type.TestCaseStatus.Failed;
      return this;
    }

    public ResultBuilder aborted() {
      this.testCaseStatus = org.openmetadata.schema.tests.type.TestCaseStatus.Aborted;
      return this;
    }

    public ResultBuilder result(String result) {
      this.result = result;
      return this;
    }

    public ResultBuilder testResultValue(String value) {
      this.testResultValue = value;
      return this;
    }

    public ResultBuilder passedRows(Long passedRows) {
      this.passedRows = passedRows;
      return this;
    }

    public ResultBuilder failedRows(Long failedRows) {
      this.failedRows = failedRows;
      return this;
    }

    public CreateTestCaseResult build() {
      CreateTestCaseResult request = new CreateTestCaseResult();
      request.setTimestamp(timestamp);
      request.setTestCaseStatus(testCaseStatus);
      request.setResult(result);
      if (passedRows != null) {
        request.setPassedRows(passedRows);
      }
      if (failedRows != null) {
        request.setFailedRows(failedRows);
      }
      if (passedRowsPercentage != null) {
        request.setPassedRowsPercentage(passedRowsPercentage.doubleValue());
      }
      if (failedRowsPercentage != null) {
        request.setFailedRowsPercentage(failedRowsPercentage.doubleValue());
      }
      return request;
    }

    public TestCaseResult create() throws OpenMetadataException {
      return service.create(testCaseFqn, build());
    }
  }

  /**
   * Create a fluent builder for adding a test case result.
   *
   * @param testCaseFqn The fully qualified name of the test case
   * @return A result builder
   */
  public ResultBuilder forTestCase(String testCaseFqn) {
    return new ResultBuilder(this, testCaseFqn);
  }
}
