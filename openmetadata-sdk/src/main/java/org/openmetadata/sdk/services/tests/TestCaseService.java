package org.openmetadata.sdk.services.tests;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.flipkart.zjsonpatch.JsonDiff;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.tests.CreateLogicalTestCases;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TestCaseService extends EntityServiceBase<TestCase> {

  private final ObjectMapper objectMapper;

  // TestCase-specific fields that should not be included in PATCH
  private static final Set<String> TEST_CASE_COMPUTED_FIELDS =
      Set.of(
          "testCaseResult",
          "testCaseStatus",
          "testSuites",
          "incidentId",
          "failedRowsSample",
          // Note: inspectionQuery is user-editable and should be patchable
          "testDefinition", // Reference field - don't patch
          "entityLink", // Don't change entity link via patch
          "changeDescription",
          "href",
          "usageSummary",
          "followers",
          "votes");

  public TestCaseService(HttpClient httpClient) {
    super(httpClient, "/v1/dataQuality/testCases");
    this.objectMapper = new ObjectMapper();
    this.objectMapper.setSerializationInclusion(
        com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
  }

  @Override
  protected Class<TestCase> getEntityClass() {
    return TestCase.class;
  }

  // Create using CreateTestCase request
  public TestCase create(CreateTestCase request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, TestCase.class);
  }

  // Create or update using CreateTestCase request
  public TestCase upsert(CreateTestCase request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, request, TestCase.class);
  }

  // ===================================================================
  // BULK OPERATIONS
  // ===================================================================

  /**
   * Create multiple test cases in a single request.
   *
   * @param requests List of test case creation requests
   * @return List of created test cases
   */
  public List<TestCase> createMany(List<CreateTestCase> requests) throws OpenMetadataException {
    try {
      String response =
          httpClient.executeForString(HttpMethod.POST, basePath + "/createMany", requests);
      if (response == null || response.isEmpty()) {
        return new ArrayList<>();
      }
      return objectMapper.readValue(response, new TypeReference<List<TestCase>>() {});
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to create test cases: " + e.getMessage(), e);
    }
  }

  // ===================================================================
  // LOGICAL TEST SUITE OPERATIONS
  // ===================================================================

  /**
   * Add test cases to a logical test suite.
   *
   * @param request The logical test cases request containing test suite ID and test case IDs
   * @return The updated test suite
   */
  public org.openmetadata.schema.tests.TestSuite addToLogicalTestSuite(
      CreateLogicalTestCases request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        basePath + "/logicalTestCases",
        request,
        org.openmetadata.schema.tests.TestSuite.class);
  }

  /**
   * Remove a test case from a logical test suite.
   *
   * @param testSuiteId The logical test suite ID
   * @param testCaseId The test case ID to remove
   */
  public void removeFromLogicalTestSuite(UUID testSuiteId, UUID testCaseId)
      throws OpenMetadataException {
    httpClient.execute(
        HttpMethod.DELETE,
        basePath + "/logicalTestCases/" + testSuiteId + "/" + testCaseId,
        null,
        Void.class);
  }

  // ===================================================================
  // FAILED ROWS SAMPLE OPERATIONS
  // ===================================================================

  /**
   * Get the failed rows sample data for a test case.
   *
   * @param testCaseId The test case ID
   * @return The failed rows sample data
   */
  public TableData getFailedRowsSample(String testCaseId) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET, basePath + "/" + testCaseId + "/failedRowsSample", null, TableData.class);
  }

  /**
   * Add or update failed rows sample data for a test case.
   *
   * @param testCaseId The test case ID
   * @param sampleData The sample data to add
   * @return The updated test case
   */
  public TestCase addFailedRowsSample(String testCaseId, TableData sampleData)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        basePath + "/" + testCaseId + "/failedRowsSample",
        sampleData,
        TestCase.class);
  }

  /**
   * Delete the failed rows sample data for a test case.
   *
   * @param testCaseId The test case ID
   * @return The updated test case
   */
  public TestCase deleteFailedRowsSample(String testCaseId) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.DELETE, basePath + "/" + testCaseId + "/failedRowsSample", null, TestCase.class);
  }

  // ===================================================================
  // INSPECTION QUERY OPERATIONS
  // ===================================================================

  /**
   * Set the inspection query for a test case.
   *
   * @param testCaseId The test case ID
   * @param query The inspection query SQL
   * @return The updated test case
   */
  public TestCase setInspectionQuery(String testCaseId, String query) throws OpenMetadataException {
    // API accepts raw string with application/json content type
    RequestOptions options =
        RequestOptions.builder().header("Content-Type", "application/json").build();
    try {
      String response =
          httpClient.executeForString(
              HttpMethod.PUT, basePath + "/" + testCaseId + "/inspectionQuery", query, options);
      if (response == null || response.isEmpty()) {
        return null;
      }
      return objectMapper.readValue(response, TestCase.class);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to set inspection query: " + e.getMessage(), e);
    }
  }

  /**
   * Override update to handle TestCase-specific fields properly. TestCase has complex nested
   * objects that need special handling during PATCH operations.
   */
  @Override
  public TestCase update(String id, TestCase entity, String etag) throws OpenMetadataException {
    try {
      // Fetch original entity
      TestCase original = get(id);

      // Generate JSON Patch between original and updated
      String originalJson = objectMapper.writeValueAsString(original);
      String updatedJson = objectMapper.writeValueAsString(entity);

      JsonNode originalNode = objectMapper.readTree(originalJson);
      JsonNode updatedNode = objectMapper.readTree(updatedJson);

      // Remove computed/complex fields that cannot be patched
      removeTestCaseComputedFields(originalNode);
      removeTestCaseComputedFields(updatedNode);

      // Reduce EntityReference objects to just id and type
      reduceEntityReferences(originalNode);
      reduceEntityReferences(updatedNode);

      JsonNode patch = JsonDiff.asJson(originalNode, updatedNode);

      // Build request options with ETag if provided
      RequestOptions options = null;
      if (etag != null) {
        options = RequestOptions.builder().header("If-Match", etag).build();
      }

      // Send PATCH request with the JSON Patch document
      return httpClient.execute(
          HttpMethod.PATCH, basePath + "/" + id, patch, TestCase.class, options);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to update entity: " + e.getMessage(), e);
    }
  }

  private void removeTestCaseComputedFields(JsonNode node) {
    if (node instanceof ObjectNode objectNode) {
      for (String field : TEST_CASE_COMPUTED_FIELDS) {
        objectNode.remove(field);
      }
    }
  }

  private void reduceEntityReferences(JsonNode node) {
    if (!(node instanceof ObjectNode objectNode)) {
      return;
    }

    Iterator<Map.Entry<String, JsonNode>> fields = objectNode.fields();
    while (fields.hasNext()) {
      Map.Entry<String, JsonNode> field = fields.next();
      JsonNode value = field.getValue();

      if (value == null || value.isNull()) {
        continue;
      }

      // Check if it's an EntityReference (object with id and type)
      if (value.isObject() && value.has("id") && value.has("type")) {
        reduceEntityReference((ObjectNode) value);
      }
      // Check if it's an array of EntityReferences
      else if (value.isArray()) {
        for (JsonNode element : value) {
          if (element.isObject() && element.has("id") && element.has("type")) {
            reduceEntityReference((ObjectNode) element);
          }
        }
      }
      // Recursively process nested objects (but not EntityReferences themselves)
      else if (value.isObject() && !value.has("id")) {
        reduceEntityReferences(value);
      }
    }
  }

  private void reduceEntityReference(ObjectNode refNode) {
    Set<String> fieldsToKeep = Set.of("id", "type", "inherited");
    List<String> fieldsToRemove = new ArrayList<>();

    Iterator<String> fieldNames = refNode.fieldNames();
    while (fieldNames.hasNext()) {
      String fieldName = fieldNames.next();
      if (!fieldsToKeep.contains(fieldName)) {
        fieldsToRemove.add(fieldName);
      }
    }

    for (String fieldName : fieldsToRemove) {
      refNode.remove(fieldName);
    }
  }
}
