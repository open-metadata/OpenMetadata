package org.openmetadata.sdk.services.tests;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseIncidentGroup;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Service for managing test case resolution status (incident management).
 *
 * <p>Resolution status tracks the lifecycle of test case failures, from initial detection through
 * assignment, investigation, and resolution.
 */
public class TestCaseResolutionStatusService {

  private static final String BASE_PATH = "/v1/dataQuality/testCases/testCaseIncidentStatus";
  private static final TypeReference<ResultList<TestCaseResolutionStatus>>
      RESOLUTION_STATUS_LIST_TYPE = new TypeReference<>() {};
  private static final TypeReference<ResultList<TestCaseIncidentGroup>> INCIDENT_GROUP_LIST_TYPE =
      new TypeReference<>() {};
  private final HttpClient httpClient;

  public TestCaseResolutionStatusService(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  // ===================================================================
  // READ OPERATIONS
  // ===================================================================

  /**
   * List all test case resolution statuses.
   *
   * @return List of resolution statuses
   */
  public ListResponse<TestCaseResolutionStatus> list() throws OpenMetadataException {
    return list(null);
  }

  /**
   * List test case resolution statuses with parameters.
   *
   * @param params Query parameters
   * @return List of resolution statuses
   */
  public ListResponse<TestCaseResolutionStatus> list(ListParams params)
      throws OpenMetadataException {
    ResultList<TestCaseResolutionStatus> result =
        httpClient.executeForType(
            HttpMethod.GET, BASE_PATH, null, RESOLUTION_STATUS_LIST_TYPE, toRequestOptions(params));
    return new ListResponse<>(result);
  }

  /**
   * Bulk create resolution statuses — e.g. assign or resolve a selection of incidents at once.
   *
   * @param createRequests One create request per incident, up to 100 per call
   * @return Per-entry success/failure results
   */
  public BulkOperationResult bulkCreate(List<CreateTestCaseResolutionStatus> createRequests)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, BASE_PATH + "/bulk", createRequests, BulkOperationResult.class);
  }

  /**
   * Get a resolution status by state ID.
   *
   * @param stateId The state ID
   * @return The resolution status
   */
  public TestCaseResolutionStatus getByStateId(UUID stateId) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET, BASE_PATH + "/stateId/" + stateId, null, TestCaseResolutionStatus.class);
  }

  /**
   * Get a resolution status by ID.
   *
   * @param id The resolution status ID
   * @return The resolution status
   */
  public TestCaseResolutionStatus get(UUID id) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET, BASE_PATH + "/" + id, null, TestCaseResolutionStatus.class);
  }

  /**
   * Search resolution statuses.
   *
   * @param params Search parameters
   * @return List of matching resolution statuses
   */
  public ListResponse<TestCaseResolutionStatus> searchList(ListParams params)
      throws OpenMetadataException {
    ResultList<TestCaseResolutionStatus> result =
        httpClient.executeForType(
            HttpMethod.GET,
            BASE_PATH + "/search/list",
            null,
            RESOLUTION_STATUS_LIST_TYPE,
            toRequestOptions(params));
    return new ListResponse<>(result);
  }

  /**
   * List open incident counts grouped by a dimension (table, testDefinition, or owner).
   *
   * @param queryParams Query parameters; `groupBy` is required
   * @return List of incident groups with counts
   */
  public ListResponse<TestCaseIncidentGroup> listIncidentGroups(Map<String, String> queryParams)
      throws OpenMetadataException {
    ResultList<TestCaseIncidentGroup> result =
        httpClient.executeForType(
            HttpMethod.GET,
            BASE_PATH + "/incidentGroups",
            null,
            INCIDENT_GROUP_LIST_TYPE,
            toRequestOptions(queryParams));
    return new ListResponse<>(result);
  }

  // ===================================================================
  // CREATE OPERATIONS
  // ===================================================================

  /**
   * Create a new resolution status.
   *
   * @param request The creation request
   * @return The created resolution status
   */
  public TestCaseResolutionStatus create(CreateTestCaseResolutionStatus request)
      throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, BASE_PATH, request, TestCaseResolutionStatus.class);
  }

  // ===================================================================
  // UPDATE OPERATIONS
  // ===================================================================

  /**
   * Patch a resolution status.
   *
   * @param id The resolution status ID
   * @param patch The JSON patch to apply
   * @return The updated resolution status
   */
  public TestCaseResolutionStatus patch(UUID id, JsonNode patch) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PATCH, BASE_PATH + "/" + id, patch, TestCaseResolutionStatus.class);
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private static RequestOptions toRequestOptions(ListParams params) {
    return params == null ? null : toRequestOptions(params.toQueryParams());
  }

  private static RequestOptions toRequestOptions(Map<String, String> queryParams) {
    if (queryParams == null || queryParams.isEmpty()) {
      return null;
    }
    RequestOptions.Builder builder = RequestOptions.builder();
    boolean hasParams = false;
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      if (entry.getKey() != null && entry.getValue() != null) {
        builder.queryParam(entry.getKey(), entry.getValue());
        hasParams = true;
      }
    }
    return hasParams ? builder.build() : null;
  }

  // ===================================================================
  // FLUENT API BUILDER
  // ===================================================================

  /** Builder for creating resolution status with a fluent API. */
  public static class StatusBuilder {
    private final TestCaseResolutionStatusService service;
    private TestCaseResolutionStatusTypes statusType;
    private String testCaseReferenceFqn;
    private Object resolutionDetails;
    private Severity severity;

    public StatusBuilder(TestCaseResolutionStatusService service) {
      this.service = service;
    }

    public StatusBuilder statusType(TestCaseResolutionStatusTypes type) {
      this.statusType = type;
      return this;
    }

    public StatusBuilder newIncident() {
      this.statusType = TestCaseResolutionStatusTypes.New;
      return this;
    }

    public StatusBuilder ack() {
      this.statusType = TestCaseResolutionStatusTypes.Ack;
      return this;
    }

    public StatusBuilder assigned() {
      this.statusType = TestCaseResolutionStatusTypes.Assigned;
      return this;
    }

    public StatusBuilder resolved() {
      this.statusType = TestCaseResolutionStatusTypes.Resolved;
      return this;
    }

    public StatusBuilder testCaseReference(String fqn) {
      this.testCaseReferenceFqn = fqn;
      return this;
    }

    public StatusBuilder resolvedDetails(Resolved details) {
      this.resolutionDetails = details;
      return this;
    }

    public StatusBuilder assignedDetails(Assigned details) {
      this.resolutionDetails = details;
      return this;
    }

    public StatusBuilder severity(Severity severity) {
      this.severity = severity;
      return this;
    }

    public CreateTestCaseResolutionStatus build() {
      CreateTestCaseResolutionStatus request = new CreateTestCaseResolutionStatus();
      request.setTestCaseResolutionStatusType(statusType);
      request.setTestCaseReference(testCaseReferenceFqn);
      if (resolutionDetails != null) {
        request.setTestCaseResolutionStatusDetails(resolutionDetails);
      }
      if (severity != null) {
        request.setSeverity(severity);
      }
      return request;
    }

    public TestCaseResolutionStatus create() throws OpenMetadataException {
      return service.create(build());
    }
  }

  /**
   * Create a fluent builder for creating a resolution status.
   *
   * @return A status builder
   */
  public StatusBuilder builder() {
    return new StatusBuilder(this);
  }
}
