package org.openmetadata.sdk.services.tests;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.flipkart.zjsonpatch.JsonDiff;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.tests.TestCase;
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
