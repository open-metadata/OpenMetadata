package org.openmetadata.service.resources.services.connections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.WebTarget;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

/*
 This Entity only supports GET, LIST, so we'll validate these endpoints.
*/
public class TestConnectionDefinitionResourceTest extends OpenMetadataApplicationTest {

  private static final String TEST_CONNECTION_NAME = "Mysql.testConnectionDefinition";
  private static final String COLLECTION = "services/testConnectionDefinitions";

  @Test
  public void test_get_test_connection_definition() throws HttpResponseException {
    WebTarget target = getResourceByName(TEST_CONNECTION_NAME);
    TestConnectionDefinition mysqlTest =
        TestUtils.get(target, TestConnectionDefinition.class, ADMIN_AUTH_HEADERS);
    assertEquals("Mysql", mysqlTest.getName());
    assertEquals(5, mysqlTest.getSteps().size());

    WebTarget idTarget = getResourceById(mysqlTest.getId());
    TestConnectionDefinition mysqlTestById =
        TestUtils.get(idTarget, TestConnectionDefinition.class, ADMIN_AUTH_HEADERS);
    assertEquals("Mysql", mysqlTestById.getName());
    assertEquals(5, mysqlTestById.getSteps().size());
  }

  @Test
  public void test_list_test_connection_definition() throws HttpResponseException {
    WebTarget target = listResource();
    ResultList testConnectionDefinitions =
        TestUtils.get(target, ResultList.class, ADMIN_AUTH_HEADERS);
    // we get 10 as it's the default paging size
    assertEquals(10, testConnectionDefinitions.getData().size());
  }

  protected final WebTarget getResourceByName(String name) {
    return getResource(COLLECTION).path("/name/" + name);
  }

  protected final WebTarget getResourceById(UUID id) {
    return getResource(COLLECTION).path("/" + id.toString());
  }

  protected final WebTarget listResource() {
    return getResource(COLLECTION).path("/");
  }
}
