package org.openmetadata.service.resources.services.connections;

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
import org.openmetadata.schema.entity.services.connections.CreateTestConnectionDefinition;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.entity.services.connections.TestConnectionStep;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;

public class TestConnectionDefinitionResourceTest
    extends EntityResourceTest<TestConnectionDefinition, CreateTestConnectionDefinition> {
  public TestConnectionDefinitionResourceTest() {
    super(
        Entity.TEST_CONNECTION_DEFINITION,
        TestConnectionDefinition.class,
        TestConnectionDefinitionResource.TestConnectionDefinitionList.class,
        "services/testConnectionDefinition",
        TestConnectionDefinitionResource.FIELDS);
    supportsEmptyDescription = true;
  }

  @Test
  void post_testConnectionDefinitionWithoutRequiredFields_4xx(TestInfo test) {
    // Test Platform is required field
    assertResponse(
        () -> createEntity(createRequest(test).withSteps(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Steps must not be empty");

    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[name must not be null]");
  }

  @Override
  public CreateTestConnectionDefinition createRequest(String name) {
    return new CreateTestConnectionDefinition()
        .withName(name)
        .withDescription(name)
        .withSteps(List.of(new TestConnectionStep().withName("StepName").withMandatory(true)));
  }

  @Override
  public void validateCreatedEntity(
      TestConnectionDefinition createdEntity, CreateTestConnectionDefinition request, Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
    assertEquals(request.getSteps(), createdEntity.getSteps());
  }

  @Override
  public void compareEntities(
      TestConnectionDefinition expected, TestConnectionDefinition updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getDescription(), updated.getDescription());
    assertEquals(expected.getSteps(), updated.getSteps());
  }

  @Override
  public TestConnectionDefinition validateGetWithDifferentFields(TestConnectionDefinition entity, boolean byName)
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
