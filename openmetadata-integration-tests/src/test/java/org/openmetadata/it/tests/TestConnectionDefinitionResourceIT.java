package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for TestConnectionDefinition resource operations.
 *
 * <p>Tests test connection definition retrieval including:
 * - Listing all test connection definitions
 * - Getting test connection definition by ID
 * - Getting test connection definition by name
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming
 * Parallelization: Safe for concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 *
 * <p>Migrated from: org.openmetadata.service.resources.services.connections.TestConnectionDefinitionResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TestConnectionDefinitionResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String BASE_PATH = "/v1/services/testConnectionDefinitions";
  // The name format is "ServiceType.testConnectionDefinition"
  private static final String TEST_CONNECTION_NAME = "Mysql.testConnectionDefinition";

  @Test
  void testListTestConnectionDefinitions(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String response = httpClient.executeForString(HttpMethod.GET, BASE_PATH, null);
    ResultList<TestConnectionDefinition> resultList =
        OBJECT_MAPPER.readValue(
            response, new TypeReference<ResultList<TestConnectionDefinition>>() {});

    assertNotNull(resultList, "Result list should not be null");
    assertNotNull(resultList.getData(), "Data should not be null");
    assertEquals(10, resultList.getData().size(), "Default page size should be 10");

    for (Object obj : resultList.getData()) {
      assertInstanceOf(
          TestConnectionDefinition.class, obj, "Each item should be a TestConnectionDefinition");
      TestConnectionDefinition def = (TestConnectionDefinition) obj;
      assertNotNull(def.getName(), "Test connection definition name should not be null");
      assertNotNull(def.getId(), "Test connection definition ID should not be null");
    }
  }

  @Test
  void testListTestConnectionDefinitionsWithLimit(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String response = httpClient.executeForString(HttpMethod.GET, BASE_PATH + "?limit=5", null);
    ResultList<TestConnectionDefinition> resultList =
        OBJECT_MAPPER.readValue(
            response, new TypeReference<ResultList<TestConnectionDefinition>>() {});

    assertNotNull(resultList, "Result list should not be null");
    assertNotNull(resultList.getData(), "Data should not be null");
    assertTrue(resultList.getData().size() <= 5, "Result size should respect limit parameter");
  }

  @Test
  void testGetTestConnectionDefinitionByName(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String path = BASE_PATH + "/name/" + TEST_CONNECTION_NAME;
    String response = httpClient.executeForString(HttpMethod.GET, path, null);
    TestConnectionDefinition testConnectionDef =
        OBJECT_MAPPER.readValue(response, TestConnectionDefinition.class);

    assertNotNull(testConnectionDef, "Test connection definition should not be null");
    assertEquals("Mysql", testConnectionDef.getName(), "Name should match");
    assertNotNull(testConnectionDef.getId(), "ID should not be null");
    assertNotNull(testConnectionDef.getSteps(), "Steps should not be null");
    assertEquals(5, testConnectionDef.getSteps().size(), "Mysql should have 5 steps");
  }

  @Test
  void testGetTestConnectionDefinitionById(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String listPath = BASE_PATH + "/name/" + TEST_CONNECTION_NAME;
    String listResponse = httpClient.executeForString(HttpMethod.GET, listPath, null);
    TestConnectionDefinition testConnectionDef =
        OBJECT_MAPPER.readValue(listResponse, TestConnectionDefinition.class);

    assertNotNull(testConnectionDef.getId(), "ID should not be null from name lookup");

    String getPath = BASE_PATH + "/" + testConnectionDef.getId().toString();
    String getResponse = httpClient.executeForString(HttpMethod.GET, getPath, null);
    TestConnectionDefinition testConnectionDefById =
        OBJECT_MAPPER.readValue(getResponse, TestConnectionDefinition.class);

    assertNotNull(testConnectionDefById, "Test connection definition by ID should not be null");
    assertEquals(testConnectionDef.getId(), testConnectionDefById.getId(), "IDs should match");
    assertEquals(
        testConnectionDef.getName(), testConnectionDefById.getName(), "Names should match");
    assertEquals(
        testConnectionDef.getSteps().size(),
        testConnectionDefById.getSteps().size(),
        "Steps count should match");
  }

  @Test
  void testTestConnectionDefinitionSteps(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String path = BASE_PATH + "/name/" + TEST_CONNECTION_NAME;
    String response = httpClient.executeForString(HttpMethod.GET, path, null);
    TestConnectionDefinition testConnectionDef =
        OBJECT_MAPPER.readValue(response, TestConnectionDefinition.class);

    assertNotNull(testConnectionDef.getSteps(), "Steps should not be null");
    assertFalse(testConnectionDef.getSteps().isEmpty(), "Steps should not be empty");

    for (Object stepObj : testConnectionDef.getSteps()) {
      assertNotNull(stepObj, "Each step should not be null");
    }
  }

  @Test
  void testTestConnectionDefinitionFields(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String response = httpClient.executeForString(HttpMethod.GET, BASE_PATH, null);
    ResultList<TestConnectionDefinition> resultList =
        OBJECT_MAPPER.readValue(
            response, new TypeReference<ResultList<TestConnectionDefinition>>() {});

    assertNotNull(resultList.getData(), "Data should not be null");
    assertFalse(
        resultList.getData().isEmpty(), "Should have at least one test connection definition");

    TestConnectionDefinition firstDef = (TestConnectionDefinition) resultList.getData().get(0);
    assertNotNull(firstDef.getName(), "Name should not be null");
    assertNotNull(firstDef.getId(), "ID should not be null");
    assertNotNull(firstDef.getSteps(), "Steps should not be null");
  }

  @Test
  void testGetNonExistentTestConnectionDefinition(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String path = BASE_PATH + "/name/NonExistentTestConnection";
    assertThrows(
        Exception.class,
        () -> httpClient.executeForString(HttpMethod.GET, path, null),
        "Getting non-existent test connection definition should throw exception");
  }

  @Test
  void testListAllTestConnectionDefinitions(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String response = httpClient.executeForString(HttpMethod.GET, BASE_PATH + "?limit=1000", null);
    ResultList<TestConnectionDefinition> resultList =
        OBJECT_MAPPER.readValue(
            response, new TypeReference<ResultList<TestConnectionDefinition>>() {});

    assertNotNull(resultList, "Result list should not be null");
    assertNotNull(resultList.getData(), "Data should not be null");
    assertTrue(
        resultList.getData().size() > 0, "Should have at least one test connection definition");

    List<String> names =
        resultList.getData().stream()
            .map(obj -> ((TestConnectionDefinition) obj).getName())
            .toList();

    // Verify that we have at least some test connection definitions
    assertFalse(names.isEmpty(), "Should have test connection definitions");
  }
}
