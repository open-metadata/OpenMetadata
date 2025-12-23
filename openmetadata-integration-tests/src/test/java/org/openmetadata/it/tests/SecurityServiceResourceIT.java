package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
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
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Test Ranger security service");

    String requestJson = MAPPER.writeValueAsString(createRequest);

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                SECURITY_SERVICES_ENDPOINT,
                requestJson,
                RequestOptions.builder().build());

    assertNotNull(response, "Create security service response should not be null");
    SecurityService service = MAPPER.readValue(response, SecurityService.class);

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
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    String createJson = MAPPER.writeValueAsString(createRequest);
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                SECURITY_SERVICES_ENDPOINT,
                createJson,
                RequestOptions.builder().build());

    SecurityService createdService = MAPPER.readValue(createResponse, SecurityService.class);

    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                SECURITY_SERVICES_ENDPOINT + "/" + createdService.getId(),
                null,
                RequestOptions.builder().build());

    assertNotNull(getResponse, "Get security service response should not be null");
    SecurityService retrievedService = MAPPER.readValue(getResponse, SecurityService.class);

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
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    String createJson = MAPPER.writeValueAsString(createRequest);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST,
            SECURITY_SERVICES_ENDPOINT,
            createJson,
            RequestOptions.builder().build());

    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                SECURITY_SERVICES_ENDPOINT + "/name/" + serviceName,
                null,
                RequestOptions.builder().build());

    assertNotNull(getResponse, "Get by name response should not be null");
    SecurityService service = MAPPER.readValue(getResponse, SecurityService.class);

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
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    String createJson = MAPPER.writeValueAsString(createRequest);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST,
            SECURITY_SERVICES_ENDPOINT,
            createJson,
            RequestOptions.builder().build());

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
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Initial description");

    String createJson = MAPPER.writeValueAsString(createRequest);
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                SECURITY_SERVICES_ENDPOINT,
                createJson,
                RequestOptions.builder().build());

    SecurityService createdService = MAPPER.readValue(createResponse, SecurityService.class);
    assertEquals("Initial description", createdService.getDescription());

    CreateSecurityService updateRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Updated description");

    String updateJson = MAPPER.writeValueAsString(updateRequest);
    String updateResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                SECURITY_SERVICES_ENDPOINT,
                updateJson,
                RequestOptions.builder().build());

    SecurityService updatedService = MAPPER.readValue(updateResponse, SecurityService.class);
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
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    String createJson = MAPPER.writeValueAsString(createRequest);
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                SECURITY_SERVICES_ENDPOINT,
                createJson,
                RequestOptions.builder().build());

    SecurityService service = MAPPER.readValue(createResponse, SecurityService.class);

    String deleteResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.DELETE,
                SECURITY_SERVICES_ENDPOINT + "/" + service.getId() + "?hardDelete=true",
                null,
                RequestOptions.builder().build());

    assertNotNull(deleteResponse, "Delete response should not be null");
  }

  @Test
  void test_getSecurityServiceVersions(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String serviceName = ns.prefix("ranger_versions");
    RangerConnection rangerConn =
        new RangerConnection()
            .withHostPort(URI.create("http://localhost:6080"))
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Version 1");

    String createJson = MAPPER.writeValueAsString(createRequest);
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                SECURITY_SERVICES_ENDPOINT,
                createJson,
                RequestOptions.builder().build());

    SecurityService service = MAPPER.readValue(createResponse, SecurityService.class);

    CreateSecurityService updateRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Version 2");

    String updateJson = MAPPER.writeValueAsString(updateRequest);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            SECURITY_SERVICES_ENDPOINT,
            updateJson,
            RequestOptions.builder().build());

    String versionsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                SECURITY_SERVICES_ENDPOINT + "/" + service.getId() + "/versions",
                null,
                RequestOptions.builder().build());

    assertNotNull(versionsResponse, "Versions response should not be null");
    JsonNode versionsNode = MAPPER.readTree(versionsResponse);

    assertTrue(versionsNode.has("versions"), "Response should contain 'versions' field");
    assertTrue(versionsNode.get("versions").isArray(), "Versions should be an array");
    assertTrue(
        versionsNode.get("versions").size() >= 1, "Should have at least one version recorded");
  }

  @Test
  void test_listSecurityServicesWithPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 3; i++) {
      String serviceName = ns.prefix("ranger_page_" + i);
      RangerConnection rangerConn =
          new RangerConnection()
              .withHostPort(URI.create("http://localhost:6080"))
              .withAuthType(new Object());

      CreateSecurityService createRequest =
          new CreateSecurityService()
              .withName(serviceName)
              .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
              .withConnection(new SecurityConnection().withConfig(rangerConn));

      String createJson = MAPPER.writeValueAsString(createRequest);
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.POST,
              SECURITY_SERVICES_ENDPOINT,
              createJson,
              RequestOptions.builder().build());
    }

    String listResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                SECURITY_SERVICES_ENDPOINT + "?limit=2",
                null,
                RequestOptions.builder().build());

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
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn))
            .withDescription("Test service for fields validation");

    String createJson = MAPPER.writeValueAsString(createRequest);
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                SECURITY_SERVICES_ENDPOINT,
                createJson,
                RequestOptions.builder().build());

    SecurityService service = MAPPER.readValue(createResponse, SecurityService.class);

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
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    String createJson = MAPPER.writeValueAsString(createRequest);
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                SECURITY_SERVICES_ENDPOINT,
                createJson,
                RequestOptions.builder().build());

    SecurityService service = MAPPER.readValue(createResponse, SecurityService.class);

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
            .withAuthType(new Object());

    CreateSecurityService createRequest =
        new CreateSecurityService()
            .withName(serviceName)
            .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
            .withConnection(new SecurityConnection().withConfig(rangerConn));

    String createJson = MAPPER.writeValueAsString(createRequest);
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                SECURITY_SERVICES_ENDPOINT,
                createJson,
                RequestOptions.builder().build());

    SecurityService service = MAPPER.readValue(createResponse, SecurityService.class);

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
}
