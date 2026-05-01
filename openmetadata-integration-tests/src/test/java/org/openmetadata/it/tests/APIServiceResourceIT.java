package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateApiService;
import org.openmetadata.schema.api.services.CreateApiService.ApiServiceType;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.services.connections.api.OpenAPISchemaURL;
import org.openmetadata.schema.services.connections.api.RestConnection;
import org.openmetadata.schema.type.ApiConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for ApiService entity operations.
 *
 * <p>Extends BaseServiceIT to inherit common service tests.
 */
@Execution(ExecutionMode.CONCURRENT)
public class APIServiceResourceIT extends BaseServiceIT<ApiService, CreateApiService> {

  {
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected CreateApiService createMinimalRequest(TestNamespace ns) {
    RestConnection conn =
        new RestConnection()
            .withOpenAPISchemaConnection(
                new OpenAPISchemaURL()
                    .withOpenAPISchemaURL(URI.create("http://localhost:8585/swagger.json")));

    return new CreateApiService()
        .withName(ns.prefix("apiservice"))
        .withServiceType(ApiServiceType.Rest)
        .withConnection(new ApiConnection().withConfig(conn))
        .withDescription("Test API service");
  }

  @Override
  protected CreateApiService createRequest(String name, TestNamespace ns) {
    RestConnection conn =
        new RestConnection()
            .withOpenAPISchemaConnection(
                new OpenAPISchemaURL()
                    .withOpenAPISchemaURL(URI.create("http://localhost:8585/swagger.json")));

    return new CreateApiService()
        .withName(name)
        .withServiceType(ApiServiceType.Rest)
        .withConnection(new ApiConnection().withConfig(conn));
  }

  @Override
  protected ApiService createEntity(CreateApiService createRequest) {
    return SdkClients.adminClient().apiServices().create(createRequest);
  }

  @Override
  protected ApiService getEntity(String id) {
    return SdkClients.adminClient().apiServices().get(id);
  }

  @Override
  protected ApiService getEntityByName(String fqn) {
    return SdkClients.adminClient().apiServices().getByName(fqn);
  }

  @Override
  protected ApiService patchEntity(String id, ApiService entity) {
    return SdkClients.adminClient().apiServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().apiServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().apiServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().apiServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "apiService";
  }

  @Override
  protected void validateCreatedEntity(ApiService entity, CreateApiService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<ApiService> listEntities(ListParams params) {
    return SdkClients.adminClient().apiServices().list(params);
  }

  @Override
  protected ApiService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().apiServices().get(id, fields);
  }

  @Override
  protected ApiService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().apiServices().getByName(fqn, fields);
  }

  @Override
  protected ApiService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().apiServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().apiServices().getVersionList(id);
  }

  @Override
  protected ApiService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().apiServices().getVersion(id.toString(), version);
  }

  // ===================================================================
  // API SERVICE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_apiServiceWithRestConnection_200_OK(TestNamespace ns) {
    RestConnection conn =
        new RestConnection()
            .withOpenAPISchemaConnection(
                new OpenAPISchemaURL()
                    .withOpenAPISchemaURL(URI.create("http://localhost:8585/swagger.json")));

    CreateApiService request =
        new CreateApiService()
            .withName(ns.prefix("rest_service"))
            .withServiceType(ApiServiceType.Rest)
            .withConnection(new ApiConnection().withConfig(conn))
            .withDescription("Test REST API service");

    ApiService service = createEntity(request);
    assertNotNull(service);
    assertEquals(ApiServiceType.Rest, service.getServiceType());
  }

  @Test
  void post_apiServiceWithCustomOpenAPIURL_200_OK(TestNamespace ns) {
    RestConnection conn =
        new RestConnection()
            .withOpenAPISchemaConnection(
                new OpenAPISchemaURL()
                    .withOpenAPISchemaURL(URI.create("https://api.example.com/openapi.json")));

    CreateApiService request =
        new CreateApiService()
            .withName(ns.prefix("custom_rest_service"))
            .withServiceType(ApiServiceType.Rest)
            .withConnection(new ApiConnection().withConfig(conn))
            .withDescription("Test REST API service with custom URL");

    ApiService service = createEntity(request);
    assertNotNull(service);
    assertEquals(ApiServiceType.Rest, service.getServiceType());
  }

  @Test
  void put_apiServiceDescription_200_OK(TestNamespace ns) {
    CreateApiService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    ApiService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    ApiService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_apiServiceVersionHistory(TestNamespace ns) {
    CreateApiService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    ApiService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    ApiService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_apiServiceSoftDeleteRestore(TestNamespace ns) {
    CreateApiService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    ApiService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    ApiService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    ApiService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_apiServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateApiService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    ApiService service1 = createEntity(request1);
    assertNotNull(service1);

    CreateApiService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate API service should fail");
  }

  @Test
  void test_listApiServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateApiService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<ApiService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }
}
