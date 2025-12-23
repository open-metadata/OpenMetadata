package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.api.services.CreateDriveService.DriveServiceType;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.services.connections.drive.GoogleDriveConnection;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
public class DriveServiceResourceIT extends BaseServiceIT<DriveService, CreateDriveService> {

  @Override
  protected CreateDriveService createMinimalRequest(TestNamespace ns) {
    GCPCredentials gcpCredentials =
        new GCPCredentials()
            .withGcpConfig(
                new GCPValues()
                    .withType("service_account")
                    .withProjectId("test-project-id")
                    .withPrivateKeyId("test-private-key-id")
                    .withPrivateKey("test-private-key")
                    .withClientEmail("test@test-project.iam.gserviceaccount.com")
                    .withClientId("123456789"));

    GoogleDriveConnection googleDriveConnection =
        new GoogleDriveConnection().withDriveId("test-drive-id").withCredentials(gcpCredentials);

    return new CreateDriveService()
        .withName(ns.prefix("driveservice"))
        .withServiceType(DriveServiceType.GoogleDrive)
        .withConnection(new DriveConnection().withConfig(googleDriveConnection))
        .withDescription("Test drive service");
  }

  @Override
  protected CreateDriveService createRequest(String name, TestNamespace ns) {
    GCPCredentials gcpCredentials =
        new GCPCredentials()
            .withGcpConfig(
                new GCPValues()
                    .withType("service_account")
                    .withProjectId("test-project-id")
                    .withPrivateKeyId("test-private-key-id")
                    .withPrivateKey("test-private-key")
                    .withClientEmail("test@test-project.iam.gserviceaccount.com")
                    .withClientId("123456789"));

    GoogleDriveConnection googleDriveConnection =
        new GoogleDriveConnection().withDriveId("test-drive-id").withCredentials(gcpCredentials);

    return new CreateDriveService()
        .withName(name)
        .withServiceType(DriveServiceType.GoogleDrive)
        .withConnection(new DriveConnection().withConfig(googleDriveConnection));
  }

  @Override
  protected DriveService createEntity(CreateDriveService createRequest) {
    return SdkClients.adminClient().driveServices().create(createRequest);
  }

  @Override
  protected DriveService getEntity(String id) {
    return SdkClients.adminClient().driveServices().get(id);
  }

  @Override
  protected DriveService getEntityByName(String fqn) {
    return SdkClients.adminClient().driveServices().getByName(fqn);
  }

  @Override
  protected DriveService patchEntity(String id, DriveService entity) {
    return SdkClients.adminClient().driveServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().driveServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().driveServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().driveServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "driveService";
  }

  @Override
  protected void validateCreatedEntity(DriveService entity, CreateDriveService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<DriveService> listEntities(ListParams params) {
    return SdkClients.adminClient().driveServices().list(params);
  }

  @Override
  protected DriveService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().driveServices().get(id, fields);
  }

  @Override
  protected DriveService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().driveServices().getByName(fqn, fields);
  }

  @Override
  protected DriveService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().driveServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().driveServices().getVersionList(id);
  }

  @Override
  protected DriveService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().driveServices().getVersion(id.toString(), version);
  }

  @Test
  void post_driveServiceWithGoogleDriveConnection_200_OK(TestNamespace ns) {
    GCPCredentials gcpCredentials =
        new GCPCredentials()
            .withGcpConfig(
                new GCPValues()
                    .withType("service_account")
                    .withProjectId("test-project-id-detailed")
                    .withPrivateKeyId("test-private-key-id")
                    .withPrivateKey("test-private-key")
                    .withClientEmail("test@test-project.iam.gserviceaccount.com")
                    .withClientId("123456789"));

    GoogleDriveConnection googleDriveConnection =
        new GoogleDriveConnection()
            .withDriveId("test-drive-id")
            .withCredentials(gcpCredentials)
            .withIncludeGoogleSheets(true);

    CreateDriveService request =
        new CreateDriveService()
            .withName(ns.prefix("google_drive_service"))
            .withServiceType(DriveServiceType.GoogleDrive)
            .withConnection(new DriveConnection().withConfig(googleDriveConnection))
            .withDescription("Test Google Drive service");

    DriveService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DriveServiceType.GoogleDrive, service.getServiceType());
    assertNotNull(service.getConnection());
  }

  @Test
  void post_driveServiceWithoutConnection_200_OK(TestNamespace ns) {
    CreateDriveService request =
        new CreateDriveService()
            .withName(ns.prefix("service_no_connection"))
            .withServiceType(DriveServiceType.GoogleDrive)
            .withConnection(null)
            .withDescription("Test service without connection");

    DriveService service = createEntity(request);
    assertNotNull(service);
    assertNull(service.getConnection());
  }

  @Test
  void put_driveServiceDescription_200_OK(TestNamespace ns) {
    CreateDriveService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    DriveService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    DriveService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void put_updateDriveServiceConnection_200_OK(TestNamespace ns) {
    CreateDriveService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_connection"));

    DriveService service = createEntity(request);
    assertNotNull(service.getConnection());

    GCPCredentials updatedCredentials =
        new GCPCredentials()
            .withGcpConfig(
                new GCPValues()
                    .withType("service_account")
                    .withProjectId("updated-project-id")
                    .withPrivateKeyId("updated-private-key-id")
                    .withPrivateKey("updated-private-key")
                    .withClientEmail("updated@updated-project.iam.gserviceaccount.com")
                    .withClientId("987654321"));

    GoogleDriveConnection updatedConnection =
        new GoogleDriveConnection()
            .withDriveId("updated-drive-id")
            .withCredentials(updatedCredentials);

    service.setConnection(new DriveConnection().withConfig(updatedConnection));
    DriveService updated = patchEntity(service.getId().toString(), service);
    assertNotNull(updated.getConnection());
  }

  @Test
  void put_testConnectionResult_200_OK(TestNamespace ns) {
    CreateDriveService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_test_connection"));

    DriveService service = createEntity(request);
    assertNull(service.getTestConnectionResult());

    TestConnectionResult testConnectionResult =
        new TestConnectionResult()
            .withStatus(TestConnectionResultStatus.SUCCESSFUL)
            .withLastUpdatedAt(System.currentTimeMillis());

    service.setTestConnectionResult(testConnectionResult);
    DriveService updated = patchEntity(service.getId().toString(), service);

    assertNotNull(updated.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, updated.getTestConnectionResult().getStatus());
  }

  @Test
  void test_driveServiceVersionHistory(TestNamespace ns) {
    CreateDriveService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    DriveService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    DriveService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_driveServiceSoftDeleteRestore(TestNamespace ns) {
    CreateDriveService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    DriveService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    DriveService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    DriveService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_driveServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateDriveService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    DriveService service1 = createEntity(request1);
    assertNotNull(service1);

    CreateDriveService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate drive service should fail");
  }

  @Test
  void test_listDriveServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateDriveService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<DriveService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_getDriveServiceByName(TestNamespace ns) {
    CreateDriveService request = createMinimalRequest(ns);
    String serviceName = ns.prefix("get_by_name");
    request.setName(serviceName);

    DriveService created = createEntity(request);
    DriveService retrieved = getEntityByName(created.getFullyQualifiedName());

    assertNotNull(retrieved);
    assertEquals(created.getId(), retrieved.getId());
    assertEquals(serviceName, retrieved.getName());
  }

  @Test
  void test_getDriveServiceWithFields(TestNamespace ns) {
    CreateDriveService request = createMinimalRequest(ns);
    request.setName(ns.prefix("get_with_fields"));

    DriveService service = createEntity(request);

    DriveService withFields = getEntityWithFields(service.getId().toString(), "owners,tags");
    assertNotNull(withFields);
    assertEquals(service.getId(), withFields.getId());
  }
}
