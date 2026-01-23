package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for App Marketplace API endpoints.
 *
 * <p>Tests marketplace app listing, retrieval, and marketplace-specific operations. Uses HttpClient
 * directly to test the REST API endpoints without SDK fluent API abstraction.
 *
 * <p>Migrated from: org.openmetadata.service.resources.apps.AppMarketPlaceResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AppMarketPlaceResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String BASE_PATH = "/v1/apps/marketplace";

  @Test
  void test_listMarketplaceApps(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    assertNotNull(responseJson, "Marketplace apps list response should not be null");
    assertFalse(responseJson.isEmpty(), "Marketplace apps list response should not be empty");

    JsonNode responseNode = MAPPER.readTree(responseJson);

    assertTrue(responseNode.has("data"), "Response should contain 'data' field");
    assertTrue(responseNode.get("data").isArray(), "Data field should be an array");

    JsonNode dataArray = responseNode.get("data");
    assertTrue(dataArray.size() > 0, "Marketplace should contain at least one app");

    JsonNode firstApp = dataArray.get(0);
    assertTrue(firstApp.has("id"), "App should have 'id' field");
    assertTrue(firstApp.has("name"), "App should have 'name' field");
    assertTrue(firstApp.has("fullyQualifiedName"), "App should have 'fullyQualifiedName' field");
    assertTrue(firstApp.has("appType"), "App should have 'appType' field");
  }

  @Test
  void test_listMarketplaceAppsWithPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, BASE_PATH + "?limit=5", null, RequestOptions.builder().build());

    assertNotNull(responseJson, "Paginated response should not be null");

    JsonNode responseNode = MAPPER.readTree(responseJson);
    assertTrue(responseNode.has("data"), "Response should contain 'data' field");

    JsonNode dataArray = responseNode.get("data");
    assertTrue(
        dataArray.size() <= 5, "Response should respect limit parameter and return at most 5 apps");
  }

  @Test
  void test_listMarketplaceAppsWithFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "?fields=owners,tags",
                null,
                RequestOptions.builder().build());

    assertNotNull(responseJson, "Response with fields should not be null");

    JsonNode responseNode = MAPPER.readTree(responseJson);
    assertTrue(responseNode.has("data"), "Response should contain 'data' field");
  }

  @Test
  void test_getSpecificMarketplaceApp(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String listResponseJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    JsonNode listResponseNode = MAPPER.readTree(listResponseJson);
    JsonNode dataArray = listResponseNode.get("data");

    assertTrue(dataArray.size() > 0, "Should have at least one app to test with");

    JsonNode firstApp = dataArray.get(0);
    String appId = firstApp.get("id").asText();
    String appName = firstApp.get("name").asText();

    String appByIdJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, BASE_PATH + "/" + appId, null, RequestOptions.builder().build());

    assertNotNull(appByIdJson, "Get app by ID response should not be null");

    AppMarketPlaceDefinition appById =
        MAPPER.readValue(appByIdJson, AppMarketPlaceDefinition.class);
    assertNotNull(appById, "App should be deserializable");
    assertEquals(appId, appById.getId().toString(), "Retrieved app ID should match requested ID");
    assertEquals(appName, appById.getName(), "App name should match");

    assertNotNull(appById.getFullyQualifiedName(), "App should have FQN");
    assertNotNull(appById.getAppType(), "App should have type");
  }

  @Test
  void test_getMarketplaceAppByName(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String listResponseJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    JsonNode listResponseNode = MAPPER.readTree(listResponseJson);
    JsonNode dataArray = listResponseNode.get("data");

    assertTrue(dataArray.size() > 0, "Should have at least one app to test with");

    JsonNode firstApp = dataArray.get(0);
    String appName = firstApp.get("name").asText();

    String appByNameJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/name/" + appName,
                null,
                RequestOptions.builder().build());

    assertNotNull(appByNameJson, "Get app by name response should not be null");

    AppMarketPlaceDefinition appByName =
        MAPPER.readValue(appByNameJson, AppMarketPlaceDefinition.class);
    assertNotNull(appByName, "App should be deserializable");
    assertEquals(appName, appByName.getName(), "Retrieved app name should match requested name");
  }

  @Test
  void test_getMarketplaceAppVersions(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String listResponseJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    JsonNode listResponseNode = MAPPER.readTree(listResponseJson);
    JsonNode dataArray = listResponseNode.get("data");

    assertTrue(dataArray.size() > 0, "Should have at least one app to test with");

    JsonNode firstApp = dataArray.get(0);
    String appId = firstApp.get("id").asText();

    String versionsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/" + appId + "/versions",
                null,
                RequestOptions.builder().build());

    assertNotNull(versionsJson, "Versions response should not be null");

    JsonNode versionsNode = MAPPER.readTree(versionsJson);
    assertTrue(versionsNode.has("versions"), "Response should contain 'versions' field");
  }

  @Test
  void test_marketplaceAppsContainRequiredFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    JsonNode responseNode = MAPPER.readTree(responseJson);
    JsonNode dataArray = responseNode.get("data");

    assertTrue(dataArray.size() > 0, "Marketplace should contain apps");

    for (JsonNode app : dataArray) {
      assertTrue(app.has("id"), "Each app should have an ID");
      assertTrue(app.has("name"), "Each app should have a name");
      assertTrue(app.has("fullyQualifiedName"), "Each app should have an FQN");
      assertTrue(app.has("appType"), "Each app should have a type");
      assertTrue(app.has("className"), "Each app should have a className");

      assertNotNull(app.get("id").asText(), "App ID should not be null");
      assertNotNull(app.get("name").asText(), "App name should not be null");
      assertFalse(app.get("name").asText().isEmpty(), "App name should not be empty");
    }
  }

  @Test
  void test_deserializeMarketplaceAppsToObjects(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    JsonNode responseNode = MAPPER.readTree(responseJson);
    JsonNode dataArray = responseNode.get("data");

    List<AppMarketPlaceDefinition> apps =
        MAPPER.convertValue(dataArray, new TypeReference<List<AppMarketPlaceDefinition>>() {});

    assertNotNull(apps, "Apps list should be deserializable");
    assertTrue(apps.size() > 0, "Should have deserialized at least one app");

    AppMarketPlaceDefinition firstApp = apps.get(0);
    assertNotNull(firstApp.getId(), "Deserialized app should have ID");
    assertNotNull(firstApp.getName(), "Deserialized app should have name");
    assertNotNull(firstApp.getFullyQualifiedName(), "Deserialized app should have FQN");
    assertNotNull(firstApp.getAppType(), "Deserialized app should have type");
  }

  @Test
  void test_marketplaceAppHasExpectedMetadata(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String listResponseJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    JsonNode listResponseNode = MAPPER.readTree(listResponseJson);
    JsonNode dataArray = listResponseNode.get("data");

    assertTrue(dataArray.size() > 0, "Should have at least one app");

    JsonNode firstApp = dataArray.get(0);
    String appId = firstApp.get("id").asText();

    String appJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, BASE_PATH + "/" + appId, null, RequestOptions.builder().build());

    AppMarketPlaceDefinition app = MAPPER.readValue(appJson, AppMarketPlaceDefinition.class);

    assertNotNull(app.getId(), "App should have ID");
    assertNotNull(app.getName(), "App should have name");
    assertNotNull(app.getFullyQualifiedName(), "App should have FQN");
    assertNotNull(app.getAppType(), "App should have type");
    assertNotNull(app.getClassName(), "App should have className");
    assertNotNull(app.getUpdatedAt(), "App should have updatedAt timestamp");
    assertNotNull(app.getUpdatedBy(), "App should have updatedBy user");
  }

  @Test
  void test_listMarketplaceAppsWithIncludeParameter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "?include=non-deleted",
                null,
                RequestOptions.builder().build());

    assertNotNull(responseJson, "Response with include parameter should not be null");

    JsonNode responseNode = MAPPER.readTree(responseJson);
    assertTrue(responseNode.has("data"), "Response should contain data");
  }

  @Test
  void test_marketplaceResponseStructure(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    JsonNode responseNode = MAPPER.readTree(responseJson);

    assertTrue(responseNode.has("data"), "Response should have 'data' field");
    assertTrue(responseNode.has("paging"), "Response should have 'paging' field");

    JsonNode pagingNode = responseNode.get("paging");
    assertNotNull(pagingNode, "Paging information should not be null");
  }

  @Test
  void test_multipleConcurrentMarketplaceRequests(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response1 =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    String response2 =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, BASE_PATH + "?limit=10", null, RequestOptions.builder().build());

    assertNotNull(response1, "First concurrent request should succeed");
    assertNotNull(response2, "Second concurrent request should succeed");

    JsonNode node1 = MAPPER.readTree(response1);
    JsonNode node2 = MAPPER.readTree(response2);

    assertTrue(node1.has("data"), "First response should have data");
    assertTrue(node2.has("data"), "Second response should have data");
  }
}
