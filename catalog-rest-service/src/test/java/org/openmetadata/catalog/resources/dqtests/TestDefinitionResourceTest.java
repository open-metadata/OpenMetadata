package org.openmetadata.catalog.resources.dqtests;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTestDefinition;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.tests.TestDefinition;
import org.openmetadata.catalog.tests.TestPlatform;

public class TestDefinitionResourceTest extends EntityResourceTest<TestDefinition, CreateTestDefinition> {
  public TestDefinitionResourceTest() {
    super(
        Entity.TEST_DEFINITION,
        TestDefinition.class,
        TestDefinitionResource.TestDefinitionList.class,
        "tests/testDefinition",
        TestDefinitionResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFollowers = false;
    supportsAuthorizedMetadataOperations = false;
    supportsOwner = false;
  }

  @Test
  void post_testDefinitionWithoutRequiredFields_4xx(TestInfo test) {
    // Test Platform is required field
    assertResponse(
        () -> createEntity(createRequest(test).withTestPlatform(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[testPlatform must not be null]");

    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[name must not be null]");
  }

  @Override
  public CreateTestDefinition createRequest(String name) {
    return new CreateTestDefinition().withName(name).withDescription(name).withTestPlatform(TestPlatform.OPEN_METADATA);
  }

  @Override
  public void validateCreatedEntity(
      TestDefinition createdEntity, CreateTestDefinition request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
    assertEquals(request.getTestPlatform(), createdEntity.getTestPlatform());
  }

  @Override
  public void compareEntities(TestDefinition expected, TestDefinition updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getDescription(), updated.getDescription());
    assertEquals(expected.getTestPlatform(), updated.getTestPlatform());
  }

  @Override
  public TestDefinition validateGetWithDifferentFields(TestDefinition entity, boolean byName)
      throws HttpResponseException {
    return null;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
