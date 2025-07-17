package org.openmetadata.service.resources.dqtests;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

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
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.ResultList;
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
}
