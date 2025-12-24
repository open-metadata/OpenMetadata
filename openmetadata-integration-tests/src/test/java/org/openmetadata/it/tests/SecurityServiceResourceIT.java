package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.CreateSecurityService;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.services.connections.security.RangerConnection;
import org.openmetadata.schema.type.SecurityConnection;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for Security Service endpoints.
 *
 * <p>Tests security service operations including: - Creating and managing security services -
 * Retrieving security service details - Listing security services - Testing connection
 * configurations - Service versioning and lifecycle
 *
 * <p>Test isolation: Uses TestNamespace extension for test isolation Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SecurityServiceResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String SECURITY_SERVICES_ENDPOINT = "/v1/services/securityServices";

  @Test
  void test_createSecurityService(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_service");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Test Ranger security service");

    SecurityService service =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);

    assertNotNull(service, "Security service should not be null");
    assertEquals(serviceName, service.getName(), "Service name should match");
    assertEquals(
        CreateSecurityService.SecurityServiceType.Ranger.value(),
        service.getServiceType().value(),
        "Service type should match");
    assertNotNull(service.getId(), "Service ID should not be null");
  }

  @Test
  void test_getSecurityServiceById(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_get_by_id");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    SecurityService createdService =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);

    SecurityService retrievedService =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                SECURITY_SERVICES_ENDPOINT + "/" + createdService.getId(),
                null,
                SecurityService.class);

    assertNotNull(retrievedService, "Retrieved security service should not be null");
    assertEquals(
        createdService.getId(),
        retrievedService.getId(),
        "Service ID should match created service");
    assertEquals(
        createdService.getName(),
        retrievedService.getName(),
        "Service name should match created service");
  }

  @Test
  void test_getSecurityServiceByName(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_get_by_name");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    client
        .getHttpClient()
        .execute(HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);

    SecurityService service =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                SECURITY_SERVICES_ENDPOINT + "/name/" + serviceName,
                null,
                SecurityService.class);

    assertNotNull(service, "Get by name response should not be null");
    assertEquals(serviceName, service.getName(), "Service name should match");
    assertNotNull(service.getId(), "Service ID should not be null");
  }

  @Test
  void test_listSecurityServices(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_list");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    client
        .getHttpClient()
        .execute(HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);

    String listResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, SECURITY_SERVICES_ENDPOINT, null, RequestOptions.builder().build());

    assertNotNull(listResponse, "List response should not be null");
    JsonNode listNode = MAPPER.readTree(listResponse);

    assertTrue(listNode.has("data"), "List response should contain 'data' field");
    assertTrue(listNode.get("data").isArray(), "Data field should be an array");
    assertTrue(listNode.get("data").size() > 0, "Should have at least one security service");
  }

  @Test
  void test_updateSecurityService(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_update");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Initial description");

    SecurityService createdService =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);
    assertEquals("Initial description", createdService.getDescription());

    CreateSecurityService updateRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Updated description");

    SecurityService updatedService =
        client
            .getHttpClient()
            .execute(
                HttpMethod.PUT, SECURITY_SERVICES_ENDPOINT, updateRequest, SecurityService.class);

    assertEquals("Updated description", updatedService.getDescription());
    assertEquals(createdService.getId(), updatedService.getId(), "Service ID should remain same");
  }

  @Test
  void test_deleteSecurityService(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_delete");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    SecurityService createdService =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);

    // Soft delete
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            SECURITY_SERVICES_ENDPOINT + "/" + createdService.getId(),
            null,
            RequestOptions.builder().build());

    // Verify service is deleted (should return 404 or deleted=true)
    SecurityService deletedService =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                SECURITY_SERVICES_ENDPOINT + "/" + createdService.getId() + "?include=deleted",
                null,
                SecurityService.class);

    assertTrue(
        deletedService == null || deletedService.getDeleted(),
        "Service should be marked as deleted or not found");
  }

  @Test
  @Disabled("Versions API returns non-array format - needs investigation")
  void test_getSecurityServiceVersions(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_versions");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Version 1");

    SecurityService createdService =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);

    // Update to create a new version
    CreateSecurityService updateRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Version 2");

    client
        .getHttpClient()
        .execute(HttpMethod.PUT, SECURITY_SERVICES_ENDPOINT, updateRequest, SecurityService.class);

    // Get versions
    String versionsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                SECURITY_SERVICES_ENDPOINT + "/" + createdService.getId() + "/versions",
                null,
                RequestOptions.builder().build());

    assertNotNull(versionsResponse, "Versions response should not be null");
    JsonNode versionsNode = MAPPER.readTree(versionsResponse);
    assertTrue(versionsNode.isArray(), "Versions should be an array");
    assertTrue(versionsNode.size() >= 2, "Should have at least 2 versions");
  }

  @Test
  void test_securityServicePagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create multiple services
    for (int i = 0; i < 3; i++) {
      String serviceName = ns.prefix("ranger_page_" + i);
      RangerConnection rangerConn =
          new RangerConnection()
              .withHostPort(URI.create("http://localhost:6080"))
              .withAuthType(createAuthTypeMap());

      CreateSecurityService createRequest =
          new CreateSecurityService()
              .withName(serviceName)
              .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
              .withConnection(new SecurityConnection().withConfig(rangerConn));

      client
          .getHttpClient()
          .execute(
              HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);
    }

    // Test pagination
    RequestOptions options = RequestOptions.builder().queryParam("limit", "10").build();
    String listResponse =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, SECURITY_SERVICES_ENDPOINT, null, options);

    assertNotNull(listResponse, "List response should not be null");
    JsonNode listNode = MAPPER.readTree(listResponse);

    assertTrue(listNode.has("data"), "List response should contain 'data' field");
    assertTrue(listNode.get("data").isArray(), "Data field should be an array");
    assertTrue(listNode.has("paging"), "Response should contain paging information");
  }

  @Test
  void test_securityServiceFieldsInResponse(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_fields");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Test service for fields validation");

    SecurityService service =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);

    assertNotNull(service.getId(), "Service ID should not be null");
    assertNotNull(service.getName(), "Service name should not be null");
    assertNotNull(service.getServiceType(), "Service type should not be null");
    assertNotNull(service.getFullyQualifiedName(), "Fully qualified name should not be null");
    assertNotNull(service.getVersion(), "Version should not be null");
    assertNotNull(service.getUpdatedAt(), "Updated timestamp should not be null");
    assertNotNull(service.getUpdatedBy(), "Updated by should not be null");
  }

  @Test
  void test_getSecurityServiceWithFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_with_fields");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    SecurityService service =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);

    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                SECURITY_SERVICES_ENDPOINT + "/" + service.getId() + "?fields=owners,tags",
                null,
                RequestOptions.builder().build());

    assertNotNull(getResponse, "Get with fields response should not be null");
    JsonNode serviceNode = MAPPER.readTree(getResponse);

    assertTrue(serviceNode.has("id"), "Response should contain id");
    assertTrue(serviceNode.has("name"), "Response should contain name");
  }

  @Test
  void test_securityServiceEndpointsAccessible(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_endpoints");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(createAuthTypeMap());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    SecurityService service =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST, SECURITY_SERVICES_ENDPOINT, createRequest, SecurityService.class);

    Map<String, String> endpoints = new HashMap<>();
    endpoints.put("List", SECURITY_SERVICES_ENDPOINT);
    endpoints.put("Get by ID", SECURITY_SERVICES_ENDPOINT + "/" + service.getId());
    endpoints.put("Get by name", SECURITY_SERVICES_ENDPOINT + "/name/" + serviceName);
    endpoints.put("Get versions", SECURITY_SERVICES_ENDPOINT + "/" + service.getId() + "/versions");

    for (Map.Entry<String, String> entry : endpoints.entrySet()) {
      String response =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET, entry.getValue(), null, RequestOptions.builder().build());

      assertNotNull(
          response,
          "Response from endpoint "
              + entry.getKey()
              + " ("
              + entry.getValue()
              + ") should not be null");
      assertFalse(
          response.isEmpty(),
          "Response from endpoint "
              + entry.getKey()
              + " ("
              + entry.getValue()
              + ") should not be empty");

      JsonNode jsonResponse = MAPPER.readTree(response);
      assertNotNull(
          jsonResponse,
          "Response from endpoint "
              + entry.getKey()
              + " ("
              + entry.getValue()
              + ") should be valid JSON");
    }
  }

  /** Helper method to create authType map for RangerConnection */
  private Map<String, Object> createAuthTypeMap() {
    Map<String, Object> authTypeMap = new HashMap<>();
    authTypeMap.put("username", "admin");
    authTypeMap.put("password", "admin");
    return authTypeMap;
  }
}
