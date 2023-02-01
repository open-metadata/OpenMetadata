package org.openmetadata.service.resources.dqtests;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.ParallelizeTest;

@ParallelizeTest
public class TestDefinitionResourceTest extends EntityResourceTest<TestDefinition, CreateTestDefinition> {
  public TestDefinitionResourceTest() {
    super(
        Entity.TEST_DEFINITION,
        TestDefinition.class,
        TestDefinitionResource.TestDefinitionList.class,
        "testDefinition",
        TestDefinitionResource.FIELDS);
    supportsEmptyDescription = false;
  }

  public void setupTestDefinitions() throws IOException {
    TestDefinitionResourceTest testDefinitionResourceTest = new TestDefinitionResourceTest();
    TEST_DEFINITION1 =
        testDefinitionResourceTest.getEntityByName("columnValueLengthsToBeBetween", "owner", ADMIN_AUTH_HEADERS);
    TEST_DEFINITION2 =
        testDefinitionResourceTest.getEntityByName("columnValuesToBeNotNull", "owner", ADMIN_AUTH_HEADERS);
    TEST_DEFINITION3 =
        testDefinitionResourceTest.getEntityByName("columnValuesMissingCount", "owner", ADMIN_AUTH_HEADERS);
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
        "[name must not be null]");
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
  public void compareEntities(TestDefinition expected, TestDefinition updated, Map<String, String> authHeaders) {
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
    assertListNull(entity.getOwner());
    fields = "owner";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwner());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
