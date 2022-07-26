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
import org.openmetadata.catalog.api.data.CreateTestSuite;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.tests.TestSuite;

public class TestSuiteResourceTest extends EntityResourceTest<TestSuite, CreateTestSuite> {
  public TestSuiteResourceTest() {
    super(
        Entity.TEST_SUITE,
        TestSuite.class,
        TestSuiteResource.TestSuiteList.class,
        "tests/testSuite",
        TestSuiteResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFollowers = false;
    supportsAuthorizedMetadataOperations = false;
    supportsOwner = false;
  }

  @Test
  void post_testDefinitionWithoutRequiredFields_4xx(TestInfo test) {
    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[name must not be null]");
  }

  @Override
  public CreateTestSuite createRequest(String name) {
    return new CreateTestSuite().withName(name).withDescription(name).withScheduleInterval("* * 1 * *");
  }

  @Override
  public void validateCreatedEntity(TestSuite createdEntity, CreateTestSuite request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
    assertEquals(request.getScheduleInterval(), createdEntity.getScheduleInterval());
  }

  @Override
  public void compareEntities(TestSuite expected, TestSuite updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getDescription(), updated.getDescription());
    assertEquals(expected.getScheduleInterval(), updated.getScheduleInterval());
  }

  @Override
  public TestSuite validateGetWithDifferentFields(TestSuite entity, boolean byName) throws HttpResponseException {
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
