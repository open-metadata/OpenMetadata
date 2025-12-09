package org.openmetadata.service.resources.dqtests;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flipkart.zjsonpatch.JsonDiff;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.TestUtils;

public class TestDefinitionResourceTest
    extends EntityResourceTest<TestDefinition, CreateTestDefinition> {
  public TestDefinitionResourceTest() {
    super(
        Entity.TEST_DEFINITION,
        TestDefinition.class,
        TestDefinitionResource.TestDefinitionList.class,
        "dataQuality/testDefinitions",
        TestDefinitionResource.FIELDS);
  }

  public void setupTestDefinitions() throws IOException {
    TestDefinitionResourceTest testDefinitionResourceTest = new TestDefinitionResourceTest();
    TEST_DEFINITION1 =
        testDefinitionResourceTest.getEntityByName(
            "columnValueLengthsToBeBetween", "owners", ADMIN_AUTH_HEADERS);
    TEST_DEFINITION2 =
        testDefinitionResourceTest.getEntityByName(
            "columnValuesToBeNotNull", "owners", ADMIN_AUTH_HEADERS);
    TEST_DEFINITION3 =
        testDefinitionResourceTest.getEntityByName(
            "columnValuesMissingCount", "owners", ADMIN_AUTH_HEADERS);
    TEST_DEFINITION4 =
        testDefinitionResourceTest.getEntityByName(
            "tableRowCountToBeBetween", "owners", ADMIN_AUTH_HEADERS);
    TEST_DEFINITION5 =
        testDefinitionResourceTest.getEntityByName(
            "tableRowCountToEqual", "owners", ADMIN_AUTH_HEADERS);
  }

  @Test
  void list_testDefinitionsForBoolType(TestInfo test) throws HttpResponseException {
    Map<String, String> params = Map.of("supportedDataType", "BOOLEAN");
    ResultList<TestDefinition> testDefinitions = listEntities(params, ADMIN_AUTH_HEADERS);
    boolean b =
        testDefinitions.getData().stream()
            .allMatch(t -> t.getSupportedDataTypes().contains(ColumnDataType.BOOLEAN));
    Assertions.assertTrue(b);
  }

  @Test
  void post_testDefinitionWithoutRequiredFields_4xx(TestInfo test) {
    // Test Platform is required field
    assertResponse(
        () -> createEntity(createRequest(test).withTestPlatforms(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "testPlatforms must not be empty");

    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param name must not be null]");
  }

  @Test
  void checkValidationParamIsSet(TestInfo test) throws HttpResponseException {
    ResultList<TestDefinition> testDefinitions = listEntities(null, ADMIN_AUTH_HEADERS);
    // Get all test definitions that have min or max as parameter (infer from `between`)
    List<TestDefinition> testDefinitionsWithMinMax =
        testDefinitions.getData().stream()
            .filter(t -> t.getName().toLowerCase().contains("between"))
            .toList();
    for (TestDefinition testDefinition : testDefinitionsWithMinMax) {
      List<TestCaseParameter> parameters = testDefinition.getParameterDefinition();
      for (TestCaseParameter parameter : parameters) {
        // If a test definition has a parameter with min or max in the name we'll test:
        // 1. That the validation rule is set
        // 2. That the validation rule is set to compare with the max field
        if ((parameter.getName().toLowerCase().contains("min")
            || parameter.getName().toLowerCase().contains("max"))) {
          Assertions.assertNotNull(parameter.getValidationRule());
          Assertions.assertNotNull(
              parameters.stream()
                  .filter(
                      p -> p.getName().equals(parameter.getValidationRule().getParameterField()))
                  .findFirst());
        }
      }
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void post_entityCreateWithInvalidName_400() {
    // Create an entity with mandatory name field null
    final CreateTestDefinition request = createRequest(null, "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param name must not be null]");

    // Create an entity with mandatory name field empty
    final CreateTestDefinition request1 = createRequest("", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));

    // Any entity name that has EntityLink separator must fail
    final CreateTestDefinition request3 =
        createRequest("invalid::Name", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request3, ADMIN_AUTH_HEADERS), BAD_REQUEST, "name must match");
  }

  @Override
  public CreateTestDefinition createRequest(String name) {
    return new CreateTestDefinition()
        .withName(name)
        .withDescription(name)
        .withEntityType(TestDefinitionEntityType.COLUMN)
        .withTestPlatforms(List.of(TestPlatform.OPEN_METADATA));
  }

  @Override
  public void validateCreatedEntity(
      TestDefinition createdEntity, CreateTestDefinition request, Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
    assertEquals(request.getTestPlatforms(), createdEntity.getTestPlatforms());
  }

  @Override
  public void compareEntities(
      TestDefinition expected, TestDefinition updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getDescription(), updated.getDescription());
    assertEquals(expected.getTestPlatforms(), updated.getTestPlatforms());
  }

  @Override
  public TestDefinition validateGetWithDifferentFields(TestDefinition entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners());
    fields = "owners";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Test
  void test_enableDisableTestDefinition(TestInfo test) throws Exception {
    // Create a test definition
    TestDefinition testDef = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    assertEquals(true, testDef.getEnabled(), "Test definition should be enabled by default");

    // Disable it using JSON Patch
    String originalJson = JsonUtils.pojoToJson(testDef);
    testDef.setEnabled(false);
    String updatedJson = JsonUtils.pojoToJson(testDef);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch = JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

    TestDefinition disabled = patchEntity(testDef.getId(), patch, ADMIN_AUTH_HEADERS);
    assertEquals(false, disabled.getEnabled(), "Test definition should be disabled");

    // Verify disabled state persists
    TestDefinition retrieved = getEntity(testDef.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(false, retrieved.getEnabled(), "Test definition should remain disabled");

    // Enable it back using JSON Patch
    originalJson = JsonUtils.pojoToJson(retrieved);
    retrieved.setEnabled(true);
    updatedJson = JsonUtils.pojoToJson(retrieved);

    patch = JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

    TestDefinition enabled = patchEntity(retrieved.getId(), patch, ADMIN_AUTH_HEADERS);
    assertEquals(true, enabled.getEnabled(), "Test definition should be enabled");

    // Verify enabled state persists
    retrieved = getEntity(testDef.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(true, retrieved.getEnabled(), "Test definition should remain enabled");
  }

  @Test
  void test_defaultEnabledTrue(TestInfo test) throws HttpResponseException {
    // Create test definition without specifying enabled field
    TestDefinition testDef = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    assertEquals(true, testDef.getEnabled(), "Test definition should default to enabled=true");

    // Verify via GET as well
    TestDefinition retrieved = getEntity(testDef.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(true, retrieved.getEnabled(), "Retrieved test definition should be enabled");
  }

  @Test
  void test_systemTestDefinitionCanBeDisabled(TestInfo test) throws Exception {
    // Get a system test definition
    TestDefinition systemDef = getEntityByName("columnValuesToBeNotNull", "", ADMIN_AUTH_HEADERS);
    assertEquals(
        true, systemDef.getEnabled(), "System test definition should be enabled by default");

    // Disable system test definition using JSON Patch
    String originalJson = JsonUtils.pojoToJson(systemDef);
    systemDef.setEnabled(false);
    String updatedJson = JsonUtils.pojoToJson(systemDef);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch = JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

    TestDefinition disabled = patchEntity(systemDef.getId(), patch, ADMIN_AUTH_HEADERS);
    assertEquals(false, disabled.getEnabled(), "System test definition should be disableable");

    // Re-enable for cleanup using JSON Patch
    originalJson = JsonUtils.pojoToJson(disabled);
    disabled.setEnabled(true);
    updatedJson = JsonUtils.pojoToJson(disabled);

    patch = JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));
    patchEntity(disabled.getId(), patch, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_listTestDefinitions_filterByEnabled(TestInfo test) throws Exception {
    // Create two test definitions
    TestDefinition enabledDef = createEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
    TestDefinition toDisableDef = createEntity(createRequest(test, 2), ADMIN_AUTH_HEADERS);

    // Disable the second one using JSON Patch
    String originalJson = JsonUtils.pojoToJson(toDisableDef);
    toDisableDef.setEnabled(false);
    String updatedJson = JsonUtils.pojoToJson(toDisableDef);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch = JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

    TestDefinition disabledDef = patchEntity(toDisableDef.getId(), patch, ADMIN_AUTH_HEADERS);
    assertEquals(false, disabledDef.getEnabled(), "Test definition should be disabled");

    // Test 1: enabled=true should return only enabled test definitions
    Map<String, String> enabledTrueParams = Map.of("limit", "1000", "enabled", "true");
    ResultList<TestDefinition> enabledList = listEntities(enabledTrueParams, ADMIN_AUTH_HEADERS);
    boolean hasEnabled =
        enabledList.getData().stream().anyMatch(td -> td.getId().equals(enabledDef.getId()));
    boolean hasDisabled =
        enabledList.getData().stream().anyMatch(td -> td.getId().equals(disabledDef.getId()));
    Assertions.assertTrue(hasEnabled, "enabled=true list should include enabled test definition");
    Assertions.assertFalse(
        hasDisabled, "enabled=true list should NOT include disabled test definition");

    // Verify all enabled definitions in the enabled list are actually enabled
    boolean allEnabled =
        enabledList.getData().stream()
            .allMatch(td -> td.getEnabled() == null || Boolean.TRUE.equals(td.getEnabled()));
    Assertions.assertTrue(
        allEnabled, "All test definitions in enabled=true list should be enabled");

    // Test 2: enabled=false should return only disabled test definitions
    Map<String, String> enabledFalseParams = Map.of("limit", "1000", "enabled", "false");
    ResultList<TestDefinition> disabledList = listEntities(enabledFalseParams, ADMIN_AUTH_HEADERS);
    hasEnabled =
        disabledList.getData().stream().anyMatch(td -> td.getId().equals(enabledDef.getId()));
    hasDisabled =
        disabledList.getData().stream().anyMatch(td -> td.getId().equals(disabledDef.getId()));
    Assertions.assertFalse(
        hasEnabled, "enabled=false list should NOT include enabled test definition");
    Assertions.assertTrue(
        hasDisabled, "enabled=false list should include disabled test definition");

    // Verify all disabled definitions in the disabled list are actually disabled
    boolean allDisabled =
        disabledList.getData().stream().allMatch(td -> Boolean.FALSE.equals(td.getEnabled()));
    Assertions.assertTrue(
        allDisabled, "All test definitions in enabled=false list should be disabled");

    // Test 3: Default behavior (no enabled param) should return all test definitions
    Map<String, String> defaultParams = Map.of("limit", "1000");
    ResultList<TestDefinition> defaultList = listEntities(defaultParams, ADMIN_AUTH_HEADERS);
    hasEnabled =
        defaultList.getData().stream().anyMatch(td -> td.getId().equals(enabledDef.getId()));
    hasDisabled =
        defaultList.getData().stream().anyMatch(td -> td.getId().equals(disabledDef.getId()));
    Assertions.assertTrue(hasEnabled, "Default list should include enabled test definition");
    Assertions.assertTrue(hasDisabled, "Default list should include disabled test definition");

    // Re-enable for cleanup using JSON Patch
    originalJson = JsonUtils.pojoToJson(disabledDef);
    disabledDef.setEnabled(true);
    updatedJson = JsonUtils.pojoToJson(disabledDef);

    patch = JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));
    patchEntity(disabledDef.getId(), patch, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_createTestDefinition_asNonAdmin_403() {
    // Non-admin user without CREATE permission should not be able to create test definition
    CreateTestDefinition create = createRequest("unauthorizedTestDef");
    assertResponse(
        () -> createEntity(create, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.CREATE)));
  }

  @Test
  void test_patchTestDefinition_asNonAdmin_403(TestInfo test) throws Exception {
    // Create a test definition as admin
    TestDefinition testDef = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Try to patch (enable/disable) as non-admin user
    String originalJson = JsonUtils.pojoToJson(testDef);
    testDef.setEnabled(false);
    String updatedJson = JsonUtils.pojoToJson(testDef);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch = JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

    // Non-admin user without EDIT_ALL permission should not be able to patch
    assertResponse(
        () -> patchEntity(testDef.getId(), patch, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_ALL)));
  }

  @Test
  void test_deleteTestDefinition_asNonAdmin_403(TestInfo test) throws HttpResponseException {
    // Create a test definition as admin
    TestDefinition testDef = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Non-admin user without DELETE permission should not be able to delete
    assertResponse(
        () -> deleteEntity(testDef.getId(), TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.DELETE)));
  }
}
