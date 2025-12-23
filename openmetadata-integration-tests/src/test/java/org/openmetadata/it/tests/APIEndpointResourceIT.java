package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for APIEndpoint entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds API endpoint-specific tests for
 * request/response schemas and HTTP methods.
 *
 * <p>Migrated from: org.openmetadata.service.resources.apis.APIEndpointResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class APIEndpointResourceIT extends BaseEntityIT<APIEndpoint, CreateAPIEndpoint> {

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateAPIEndpoint createMinimalRequest(TestNamespace ns) {
    APICollection collection = getOrCreateAPICollection(ns);

    return new CreateAPIEndpoint()
        .withName(ns.prefix("apiendpoint"))
        .withDescription("Test API endpoint created by integration test")
        .withApiCollection(collection.getFullyQualifiedName())
        .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
        .withRequestMethod(APIRequestMethod.GET);
  }

  @Override
  protected CreateAPIEndpoint createRequest(String name, TestNamespace ns) {
    APICollection collection = getOrCreateAPICollection(ns);

    // Use a safe URL - don't embed the name in the URL as it may contain invalid characters
    String safeId = java.util.UUID.randomUUID().toString().substring(0, 8);
    return new CreateAPIEndpoint()
        .withName(name)
        .withDescription("Test API endpoint")
        .withApiCollection(collection.getFullyQualifiedName())
        .withEndpointURL(URI.create("https://localhost:8585/api/v1/endpoint-" + safeId))
        .withRequestMethod(APIRequestMethod.GET);
  }

  private APICollection getOrCreateAPICollection(TestNamespace ns) {
    String shortId = ns.shortPrefix();
    String collectionName = "apicol_" + shortId;

    // Always create a new API service and collection for isolation
    ApiService service = APIServiceTestFactory.createRest(ns);

    CreateAPICollection collectionRequest =
        new CreateAPICollection()
            .withName(collectionName)
            .withDescription("Test API collection for endpoints")
            .withService(service.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1"));

    return SdkClients.adminClient().apiCollections().create(collectionRequest);
  }

  @Override
  protected APIEndpoint createEntity(CreateAPIEndpoint createRequest) {
    return SdkClients.adminClient().apiEndpoints().create(createRequest);
  }

  @Override
  protected APIEndpoint getEntity(String id) {
    return SdkClients.adminClient().apiEndpoints().get(id);
  }

  @Override
  protected APIEndpoint getEntityByName(String fqn) {
    return SdkClients.adminClient().apiEndpoints().getByName(fqn);
  }

  @Override
  protected APIEndpoint patchEntity(String id, APIEndpoint entity) {
    return SdkClients.adminClient().apiEndpoints().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().apiEndpoints().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().apiEndpoints().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().apiEndpoints().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "apiEndpoint";
  }

  @Override
  protected void validateCreatedEntity(APIEndpoint entity, CreateAPIEndpoint createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getApiCollection(), "APIEndpoint must have an API collection");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain API endpoint name");
  }

  @Override
  protected ListResponse<APIEndpoint> listEntities(ListParams params) {
    return SdkClients.adminClient().apiEndpoints().list(params);
  }

  @Override
  protected APIEndpoint getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().apiEndpoints().get(id, fields);
  }

  @Override
  protected APIEndpoint getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().apiEndpoints().getByName(fqn, fields);
  }

  @Override
  protected APIEndpoint getEntityIncludeDeleted(String id) {
    // APIEndpoint supports: owners,followers,tags,extension,domains,dataProducts,sourceHash
    return SdkClients.adminClient()
        .apiEndpoints()
        .get(id, "owners,followers,tags,domains", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().apiEndpoints().getVersionList(id);
  }

  @Override
  protected APIEndpoint getVersion(UUID id, Double version) {
    return SdkClients.adminClient().apiEndpoints().getVersion(id.toString(), version);
  }

  // ===================================================================
  // API ENDPOINT-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_apiEndpointWithRequestMethod_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_get"))
            .withDescription("GET endpoint")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
            .withRequestMethod(APIRequestMethod.GET);

    APIEndpoint endpoint = createEntity(request);
    assertNotNull(endpoint);
    assertEquals(APIRequestMethod.GET, endpoint.getRequestMethod());
  }

  @Test
  void post_apiEndpointWithResponseSchema_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    List<Field> responseFields =
        Arrays.asList(
            new Field().withName("id").withDataType(FieldDataType.STRING),
            new Field().withName("name").withDataType(FieldDataType.STRING),
            new Field().withName("email").withDataType(FieldDataType.STRING));

    APISchema responseSchema = new APISchema().withSchemaFields(responseFields);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_schema"))
            .withDescription("Endpoint with response schema")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
            .withRequestMethod(APIRequestMethod.GET)
            .withResponseSchema(responseSchema);

    APIEndpoint endpoint = createEntity(request);
    assertNotNull(endpoint);
    assertNotNull(endpoint.getResponseSchema());
    assertEquals(3, endpoint.getResponseSchema().getSchemaFields().size());
  }

  @Test
  void put_apiEndpointDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_update_desc"))
            .withDescription("Initial description")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/test"))
            .withRequestMethod(APIRequestMethod.POST);

    APIEndpoint endpoint = createEntity(request);
    assertEquals("Initial description", endpoint.getDescription());

    // Update description
    endpoint.setDescription("Updated description");
    APIEndpoint updated = patchEntity(endpoint.getId().toString(), endpoint);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void patch_apiEndpointRequestMethod_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_patch_method"))
            .withDescription("Endpoint for method patching")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/resources"))
            .withRequestMethod(APIRequestMethod.GET);

    APIEndpoint endpoint = createEntity(request);
    assertEquals(APIRequestMethod.GET, endpoint.getRequestMethod());

    // Update request method
    endpoint.setRequestMethod(APIRequestMethod.POST);
    APIEndpoint updated = patchEntity(endpoint.getId().toString(), endpoint);
    assertEquals(APIRequestMethod.POST, updated.getRequestMethod());
  }

  @Test
  void test_apiEndpointNameUniquenessWithinCollection(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    String endpointName = ns.prefix("unique_endpoint");
    CreateAPIEndpoint request1 =
        new CreateAPIEndpoint()
            .withName(endpointName)
            .withDescription("First endpoint")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/first"))
            .withRequestMethod(APIRequestMethod.GET);

    APIEndpoint endpoint1 = createEntity(request1);
    assertNotNull(endpoint1);

    // Attempt to create duplicate within same collection
    CreateAPIEndpoint request2 =
        new CreateAPIEndpoint()
            .withName(endpointName)
            .withDescription("Duplicate endpoint")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/second"))
            .withRequestMethod(APIRequestMethod.POST);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate API endpoint in same collection should fail");
  }
}
