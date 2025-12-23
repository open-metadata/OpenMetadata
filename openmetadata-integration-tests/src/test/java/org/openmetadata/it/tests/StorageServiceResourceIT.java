package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.api.services.CreateStorageService.StorageServiceType;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.storage.S3Connection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
public class StorageServiceResourceIT extends BaseServiceIT<StorageService, CreateStorageService> {

  @Override
  protected CreateStorageService createMinimalRequest(TestNamespace ns) {
    AWSCredentials awsCreds = new AWSCredentials().withAwsRegion("us-east-1");
    S3Connection s3Conn = new S3Connection().withAwsConfig(awsCreds);

    return new CreateStorageService()
        .withName(ns.prefix("storageservice"))
        .withServiceType(StorageServiceType.S3)
        .withConnection(new StorageConnection().withConfig(s3Conn))
        .withDescription("Test storage service");
  }

  @Override
  protected CreateStorageService createRequest(String name, TestNamespace ns) {
    AWSCredentials awsCreds = new AWSCredentials().withAwsRegion("us-east-1");
    S3Connection s3Conn = new S3Connection().withAwsConfig(awsCreds);

    return new CreateStorageService()
        .withName(name)
        .withServiceType(StorageServiceType.S3)
        .withConnection(new StorageConnection().withConfig(s3Conn));
  }

  @Override
  protected StorageService createEntity(CreateStorageService createRequest) {
    return SdkClients.adminClient().storageServices().create(createRequest);
  }

  @Override
  protected StorageService getEntity(String id) {
    return SdkClients.adminClient().storageServices().get(id);
  }

  @Override
  protected StorageService getEntityByName(String fqn) {
    return SdkClients.adminClient().storageServices().getByName(fqn);
  }

  @Override
  protected StorageService patchEntity(String id, StorageService entity) {
    return SdkClients.adminClient().storageServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().storageServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().storageServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().storageServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "storageService";
  }

  @Override
  protected void validateCreatedEntity(StorageService entity, CreateStorageService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<StorageService> listEntities(ListParams params) {
    return SdkClients.adminClient().storageServices().list(params);
  }

  @Override
  protected StorageService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().storageServices().get(id, fields);
  }

  @Override
  protected StorageService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().storageServices().getByName(fqn, fields);
  }

  @Override
  protected StorageService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().storageServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().storageServices().getVersionList(id);
  }

  @Override
  protected StorageService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().storageServices().getVersion(id.toString(), version);
  }

  @Test
  void post_storageServiceWithS3Connection_200_OK(TestNamespace ns) {
    AWSCredentials awsCreds =
        new AWSCredentials()
            .withAwsAccessKeyId("test_access_key")
            .withAwsSecretAccessKey("test_secret_key")
            .withAwsRegion("us-east-1");

    S3Connection s3Conn = new S3Connection().withAwsConfig(awsCreds);

    CreateStorageService request =
        new CreateStorageService()
            .withName(ns.prefix("s3_service"))
            .withServiceType(StorageServiceType.S3)
            .withConnection(new StorageConnection().withConfig(s3Conn))
            .withDescription("Test S3 service");

    StorageService service = createEntity(request);
    assertNotNull(service);
    assertEquals(StorageServiceType.S3, service.getServiceType());
  }

  @Test
  void put_storageServiceDescription_200_OK(TestNamespace ns) {
    CreateStorageService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    StorageService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    StorageService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_storageServiceVersionHistory(TestNamespace ns) {
    CreateStorageService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    StorageService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    StorageService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_storageServiceSoftDeleteRestore(TestNamespace ns) {
    CreateStorageService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    StorageService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    StorageService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    StorageService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_storageServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateStorageService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    StorageService service1 = createEntity(request1);
    assertNotNull(service1);

    CreateStorageService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate storage service should fail");
  }

  @Test
  void test_listStorageServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateStorageService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<StorageService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }
}
