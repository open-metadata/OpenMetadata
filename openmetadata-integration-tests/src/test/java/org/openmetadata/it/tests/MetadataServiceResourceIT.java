package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateMetadataService;
import org.openmetadata.schema.api.services.CreateMetadataService.MetadataServiceType;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.services.connections.metadata.AmundsenConnection;
import org.openmetadata.schema.services.connections.metadata.AtlasConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
public class MetadataServiceResourceIT
    extends BaseServiceIT<MetadataService, CreateMetadataService> {

  {
    supportsListAllVersionsByTimestamp = true;
  }

  @Override
  protected CreateMetadataService createMinimalRequest(TestNamespace ns) {
    try {
      AmundsenConnection conn =
          new AmundsenConnection()
              .withHostPort(new URI("bolt://localhost:7687"))
              .withUsername("test")
              .withPassword("test");

      return new CreateMetadataService()
          .withName(ns.prefix("metadataservice"))
          .withServiceType(MetadataServiceType.Amundsen)
          .withConnection(new MetadataConnection().withConfig(conn))
          .withDescription("Test metadata service");
    } catch (URISyntaxException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  protected CreateMetadataService createRequest(String name, TestNamespace ns) {
    try {
      AmundsenConnection conn =
          new AmundsenConnection()
              .withHostPort(new URI("bolt://localhost:7687"))
              .withUsername("test")
              .withPassword("test");

      return new CreateMetadataService()
          .withName(name)
          .withServiceType(MetadataServiceType.Amundsen)
          .withConnection(new MetadataConnection().withConfig(conn));
    } catch (URISyntaxException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  protected MetadataService createEntity(CreateMetadataService createRequest) {
    return SdkClients.adminClient().metadataServices().create(createRequest);
  }

  @Override
  protected MetadataService getEntity(String id) {
    return SdkClients.adminClient().metadataServices().get(id);
  }

  @Override
  protected MetadataService getEntityByName(String fqn) {
    return SdkClients.adminClient().metadataServices().getByName(fqn);
  }

  @Override
  protected MetadataService patchEntity(String id, MetadataService entity) {
    return SdkClients.adminClient().metadataServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().metadataServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().metadataServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().metadataServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "metadataService";
  }

  @Override
  protected void validateCreatedEntity(
      MetadataService entity, CreateMetadataService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<MetadataService> listEntities(ListParams params) {
    return SdkClients.adminClient().metadataServices().list(params);
  }

  @Override
  protected MetadataService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().metadataServices().get(id, fields);
  }

  @Override
  protected MetadataService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().metadataServices().getByName(fqn, fields);
  }

  @Override
  protected MetadataService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().metadataServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().metadataServices().getVersionList(id);
  }

  @Override
  protected MetadataService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().metadataServices().getVersion(id.toString(), version);
  }

  @Test
  void post_metadataServiceWithAmundsenConnection_200_OK(TestNamespace ns)
      throws URISyntaxException {
    AmundsenConnection conn =
        new AmundsenConnection()
            .withHostPort(new URI("bolt://localhost:7687"))
            .withUsername("test_user")
            .withPassword("test_password")
            .withMaxConnectionLifeTime(100);

    CreateMetadataService request =
        new CreateMetadataService()
            .withName(ns.prefix("amundsen_service"))
            .withServiceType(MetadataServiceType.Amundsen)
            .withConnection(new MetadataConnection().withConfig(conn))
            .withDescription("Test Amundsen service");

    MetadataService service = createEntity(request);
    assertNotNull(service);
    assertEquals(MetadataServiceType.Amundsen, service.getServiceType());
  }

  @Test
  void post_metadataServiceWithAtlasConnection_200_OK(TestNamespace ns) throws URISyntaxException {
    AtlasConnection conn =
        new AtlasConnection()
            .withHostPort(new URI("http://localhost:21000"))
            .withUsername("admin")
            .withPassword("admin");

    CreateMetadataService request =
        new CreateMetadataService()
            .withName(ns.prefix("atlas_service"))
            .withServiceType(MetadataServiceType.Atlas)
            .withConnection(new MetadataConnection().withConfig(conn))
            .withDescription("Test Atlas service");

    MetadataService service = createEntity(request);
    assertNotNull(service);
    assertEquals(MetadataServiceType.Atlas, service.getServiceType());
  }

  @Test
  void post_metadataServiceWithoutConnection_200_OK(TestNamespace ns) {
    CreateMetadataService request =
        new CreateMetadataService()
            .withName(ns.prefix("service_no_connection"))
            .withServiceType(MetadataServiceType.Amundsen)
            .withConnection(null)
            .withDescription("Test service without connection");

    MetadataService service = createEntity(request);
    assertNotNull(service);
    assertNull(service.getConnection());
  }

  @Test
  void put_metadataServiceDescription_200_OK(TestNamespace ns) {
    CreateMetadataService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    MetadataService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    MetadataService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void put_updateMetadataServiceConnection_200_OK(TestNamespace ns) throws URISyntaxException {
    CreateMetadataService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_connection"));

    MetadataService service = createEntity(request);
    assertNotNull(service.getConnection());

    AmundsenConnection updatedConn =
        new AmundsenConnection()
            .withHostPort(new URI("bolt://localhost:7688"))
            .withUsername("updated_user")
            .withPassword("updated_password");

    service.setConnection(new MetadataConnection().withConfig(updatedConn));
    MetadataService updated = patchEntity(service.getId().toString(), service);
    assertNotNull(updated.getConnection());
  }

  @Test
  void test_metadataServiceVersionHistory(TestNamespace ns) {
    CreateMetadataService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    MetadataService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    MetadataService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_metadataServiceSoftDeleteRestore(TestNamespace ns) {
    CreateMetadataService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    MetadataService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    MetadataService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    MetadataService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_metadataServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateMetadataService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    MetadataService service1 = createEntity(request1);
    assertNotNull(service1);

    CreateMetadataService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate metadata service should fail");
  }

  @Test
  void test_listMetadataServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateMetadataService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<MetadataService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_getMetadataServiceByName(TestNamespace ns) {
    CreateMetadataService request = createMinimalRequest(ns);
    String serviceName = ns.prefix("get_by_name");
    request.setName(serviceName);

    MetadataService created = createEntity(request);
    MetadataService retrieved = getEntityByName(created.getFullyQualifiedName());

    assertNotNull(retrieved);
    assertEquals(created.getId(), retrieved.getId());
    assertEquals(serviceName, retrieved.getName());
  }

  @Test
  void test_getMetadataServiceWithFields(TestNamespace ns) {
    CreateMetadataService request = createMinimalRequest(ns);
    request.setName(ns.prefix("get_with_fields"));

    MetadataService service = createEntity(request);

    MetadataService withFields = getEntityWithFields(service.getId().toString(), "owners,tags");
    assertNotNull(withFields);
    assertEquals(service.getId(), withFields.getId());
  }
}
