package org.openmetadata.catalog.resources.dqtests;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.tests.CreateTest;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.tests.Test;

@Slf4j
public class TestResourceTest extends EntityResourceTest<Test, CreateTest> {
  public TestResourceTest() {
    super(
        Entity.TEST,
        org.openmetadata.catalog.tests.Test.class,
        TestResource.TestList.class,
        "test",
        TestResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFollowers = false;
    supportsAuthorizedMetadataOperations = false;
    supportsOwner = false;
  }

  @org.junit.jupiter.api.Test
  void post_testDefinitionWithoutRequiredFields_4xx(TestInfo test) {
    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[name must not be null]");
  }

  @Override
  public CreateTest createRequest(String name) {
    return new CreateTest()
        .withName(name)
        .withDescription(name)
        .withEntity(TEST_TABLE1.getEntityReference())
        .withTestSuite(TEST_SUITE1_REFERENCE)
        .withTestDefinition(TEST_DEFINITION1_REFERENCE);
  }

  @Override
  public void validateCreatedEntity(Test createdEntity, CreateTest request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(Test expected, Test updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public Test validateGetWithDifferentFields(Test entity, boolean byName) throws HttpResponseException {
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
