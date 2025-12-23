package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for APICollection entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds API collection-specific tests for
 * service relationships and endpoint URLs.
 *
 * <p>Migrated from: org.openmetadata.service.resources.apis.APICollectionResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class APICollectionResourceIT extends BaseEntityIT<APICollection, CreateAPICollection> {

  // APICollection doesn't support followers
  {
    supportsFollowers = false;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateAPICollection createMinimalRequest(TestNamespace ns) {
    ApiService service = APIServiceTestFactory.createRest(ns);

    return new CreateAPICollection()
        .withName(ns.prefix("apicollection"))
        .withDescription("Test API collection created by integration test")
        .withService(service.getFullyQualifiedName())
        .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"));
  }

  @Override
  protected CreateAPICollection createRequest(String name, TestNamespace ns) {
    ApiService service = APIServiceTestFactory.createRest(ns);

    // Use a safe URL - don't embed the name in the URL as it may contain invalid characters
    String safeId = UUID.randomUUID().toString().substring(0, 8);
    return new CreateAPICollection()
        .withName(name)
        .withDescription("Test API collection")
        .withService(service.getFullyQualifiedName())
        .withEndpointURL(URI.create("https://localhost:8585/api/v1/endpoint-" + safeId));
  }

  @Override
  protected APICollection createEntity(CreateAPICollection createRequest) {
    return SdkClients.adminClient().apiCollections().create(createRequest);
  }

  @Override
  protected APICollection getEntity(String id) {
    return SdkClients.adminClient().apiCollections().get(id);
  }

  @Override
  protected APICollection getEntityByName(String fqn) {
    return SdkClients.adminClient().apiCollections().getByName(fqn);
  }

  @Override
  protected APICollection patchEntity(String id, APICollection entity) {
    return SdkClients.adminClient().apiCollections().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().apiCollections().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().apiCollections().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().apiCollections().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "apiCollection";
  }

  @Override
  protected void validateCreatedEntity(APICollection entity, CreateAPICollection createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "APICollection must have a service");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain API collection name");
  }

  @Override
  protected ListResponse<APICollection> listEntities(ListParams params) {
    return SdkClients.adminClient().apiCollections().list(params);
  }

  @Override
  protected APICollection getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().apiCollections().get(id, fields);
  }

  @Override
  protected APICollection getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().apiCollections().getByName(fqn, fields);
  }

  @Override
  protected APICollection getEntityIncludeDeleted(String id) {
    // APICollection supports: owners,apiEndpoints,tags,extension,domains,sourceHash
    return SdkClients.adminClient().apiCollections().get(id, "owners,tags,domains", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().apiCollections().getVersionList(id);
  }

  @Override
  protected APICollection getVersion(UUID id, Double version) {
    return SdkClients.adminClient().apiCollections().getVersion(id.toString(), version);
  }

  // ===================================================================
  // API COLLECTION-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_apiCollectionWithEndpointURL_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ApiService service = APIServiceTestFactory.createRest(ns);

    CreateAPICollection request =
        new CreateAPICollection()
            .withName(ns.prefix("api_with_url"))
            .withDescription("API collection with endpoint URL")
            .withService(service.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://api.example.com/v1/resources"));

    APICollection collection = createEntity(request);
    assertNotNull(collection);
    assertEquals("https://api.example.com/v1/resources", collection.getEndpointURL().toString());
  }

  @Test
  void put_apiCollectionDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ApiService service = APIServiceTestFactory.createRest(ns);

    CreateAPICollection request =
        new CreateAPICollection()
            .withName(ns.prefix("api_update_desc"))
            .withDescription("Initial description")
            .withService(service.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/test"));

    APICollection collection = createEntity(request);
    assertEquals("Initial description", collection.getDescription());

    // Update description
    collection.setDescription("Updated description");
    APICollection updated = patchEntity(collection.getId().toString(), collection);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_apiCollectionServiceRelationship(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ApiService service = APIServiceTestFactory.createRest(ns);

    CreateAPICollection request =
        new CreateAPICollection()
            .withName(ns.prefix("api_service_rel"))
            .withDescription("API collection service relationship test")
            .withService(service.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/entities"));

    APICollection collection = createEntity(request);
    assertNotNull(collection);
    assertNotNull(collection.getService());
    assertEquals(service.getName(), collection.getService().getName());
  }

  @Test
  void test_apiCollectionNameUniquenessWithinService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ApiService service = APIServiceTestFactory.createRest(ns);

    String collectionName = ns.prefix("unique_api");
    CreateAPICollection request1 =
        new CreateAPICollection()
            .withName(collectionName)
            .withDescription("First API collection")
            .withService(service.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/first"));

    APICollection collection1 = createEntity(request1);
    assertNotNull(collection1);

    // Attempt to create duplicate within same service
    CreateAPICollection request2 =
        new CreateAPICollection()
            .withName(collectionName)
            .withDescription("Duplicate API collection")
            .withService(service.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/second"));

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate API collection in same service should fail");
  }
}
