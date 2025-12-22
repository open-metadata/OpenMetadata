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
  protected CreateAPIEndpoint createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    APICollection collection = getOrCreateAPICollection(ns, client);

    return new CreateAPIEndpoint()
        .withName(ns.prefix("apiendpoint"))
        .withDescription("Test API endpoint created by integration test")
        .withApiCollection(collection.getFullyQualifiedName())
        .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
        .withRequestMethod(APIRequestMethod.GET);
  }

  @Override
  protected CreateAPIEndpoint createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
    APICollection collection = getOrCreateAPICollection(ns, client);

    return new CreateAPIEndpoint()
        .withName(name)
        .withDescription("Test API endpoint")
        .withApiCollection(collection.getFullyQualifiedName())
        .withEndpointURL(URI.create("https://localhost:8585/api/v1/" + name))
        .withRequestMethod(APIRequestMethod.GET);
  }

  private APICollection getOrCreateAPICollection(TestNamespace ns, OpenMetadataClient client) {
    String shortId = ns.shortPrefix();
    String collectionName = "apicol_" + shortId;

    // Always create a new API service and collection for isolation
    ApiService service = APIServiceTestFactory.createRest(client, ns);

    CreateAPICollection collectionRequest =
        new CreateAPICollection()
            .withName(collectionName)
            .withDescription("Test API collection for endpoints")
            .withService(service.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1"));

    return client.apiCollections().create(collectionRequest);
  }

  @Override
  protected APIEndpoint createEntity(CreateAPIEndpoint createRequest, OpenMetadataClient client) {
    return client.apiEndpoints().create(createRequest);
  }

  @Override
  protected APIEndpoint getEntity(String id, OpenMetadataClient client) {
    return client.apiEndpoints().get(id);
  }

  @Override
  protected APIEndpoint getEntityByName(String fqn, OpenMetadataClient client) {
    return client.apiEndpoints().getByName(fqn);
  }

  @Override
  protected APIEndpoint patchEntity(String id, APIEndpoint entity, OpenMetadataClient client) {
    return client.apiEndpoints().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.apiEndpoints().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.apiEndpoints().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.apiEndpoints().delete(id, params);
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
  protected ListResponse<APIEndpoint> listEntities(ListParams params, OpenMetadataClient client) {
    return client.apiEndpoints().list(params);
  }

  @Override
  protected APIEndpoint getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.apiEndpoints().get(id, fields);
  }

  @Override
  protected APIEndpoint getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.apiEndpoints().getByName(fqn, fields);
  }

  @Override
  protected APIEndpoint getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.apiEndpoints().get(id, "owners,followers,tags,domain", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.apiEndpoints().getVersionList(id);
  }

  @Override
  protected APIEndpoint getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.apiEndpoints().getVersion(id.toString(), version);
  }

  // ===================================================================
  // API ENDPOINT-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_apiEndpointWithRequestMethod_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns, client);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_get"))
            .withDescription("GET endpoint")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
            .withRequestMethod(APIRequestMethod.GET);

    APIEndpoint endpoint = createEntity(request, client);
    assertNotNull(endpoint);
    assertEquals(APIRequestMethod.GET, endpoint.getRequestMethod());
  }

  @Test
  void post_apiEndpointWithResponseSchema_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns, client);

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

    APIEndpoint endpoint = createEntity(request, client);
    assertNotNull(endpoint);
    assertNotNull(endpoint.getResponseSchema());
    assertEquals(3, endpoint.getResponseSchema().getSchemaFields().size());
  }

  @Test
  void put_apiEndpointDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns, client);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_update_desc"))
            .withDescription("Initial description")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/test"))
            .withRequestMethod(APIRequestMethod.POST);

    APIEndpoint endpoint = createEntity(request, client);
    assertEquals("Initial description", endpoint.getDescription());

    // Update description
    endpoint.setDescription("Updated description");
    APIEndpoint updated = patchEntity(endpoint.getId().toString(), endpoint, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void patch_apiEndpointRequestMethod_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns, client);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_patch_method"))
            .withDescription("Endpoint for method patching")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/resources"))
            .withRequestMethod(APIRequestMethod.GET);

    APIEndpoint endpoint = createEntity(request, client);
    assertEquals(APIRequestMethod.GET, endpoint.getRequestMethod());

    // Update request method
    endpoint.setRequestMethod(APIRequestMethod.POST);
    APIEndpoint updated = patchEntity(endpoint.getId().toString(), endpoint, client);
    assertEquals(APIRequestMethod.POST, updated.getRequestMethod());
  }

  @Test
  void test_apiEndpointNameUniquenessWithinCollection(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns, client);

    String endpointName = ns.prefix("unique_endpoint");
    CreateAPIEndpoint request1 =
        new CreateAPIEndpoint()
            .withName(endpointName)
            .withDescription("First endpoint")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/first"))
            .withRequestMethod(APIRequestMethod.GET);

    APIEndpoint endpoint1 = createEntity(request1, client);
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
        () -> createEntity(request2, client),
        "Creating duplicate API endpoint in same collection should fail");
  }
}
