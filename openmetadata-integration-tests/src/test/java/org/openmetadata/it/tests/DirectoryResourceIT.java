package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDirectory;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.fluent.Directories;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.drives.DirectoryService;

/**
 * Integration tests for Directory entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds Directory-specific tests for
 * drive-service linkage and naming.
 */
@Execution(ExecutionMode.CONCURRENT)
public class DirectoryResourceIT extends BaseEntityIT<Directory, CreateDirectory> {

  {
    supportsFollowers = false;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsCustomExtension = false;
    supportsBulkAPI = false;
    supportsDataContract = false;
  }

  @BeforeAll
  static void setup() {
    Directories.setDefaultClient(SdkClients.adminClient());
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateDirectory createMinimalRequest(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    return new CreateDirectory()
        .withName(ns.prefix("directory"))
        .withService(driveService.getFullyQualifiedName())
        .withDescription("Test directory created by integration test");
  }

  @Override
  protected CreateDirectory createRequest(String name, TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    return new CreateDirectory().withName(name).withService(driveService.getFullyQualifiedName());
  }

  @Override
  protected Directory createEntity(CreateDirectory createRequest) {
    return getDirectoryService().create(createRequest);
  }

  @Override
  protected Directory getEntity(String id) {
    return getDirectoryService().get(id);
  }

  @Override
  protected Directory getEntityByName(String fqn) {
    return getDirectoryService().getByName(fqn);
  }

  @Override
  protected Directory patchEntity(String id, Directory entity) {
    return getDirectoryService().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    getDirectoryService().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    getDirectoryService().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    getDirectoryService().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "directory";
  }

  @Override
  protected void validateCreatedEntity(Directory entity, CreateDirectory createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "Directory must have a service");
    assertEquals(
        createRequest.getService(),
        entity.getService().getFullyQualifiedName(),
        "Service FQN should match");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain directory name");
  }

  @Override
  protected ListResponse<Directory> listEntities(ListParams params) {
    return getDirectoryService().list(params);
  }

  @Override
  protected Directory getEntityWithFields(String id, String fields) {
    return getDirectoryService().get(id, fields);
  }

  @Override
  protected Directory getEntityByNameWithFields(String fqn, String fields) {
    return getDirectoryService().getByName(fqn, fields);
  }

  @Override
  protected Directory getEntityIncludeDeleted(String id) {
    return getDirectoryService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return getDirectoryService().getVersionList(id);
  }

  @Override
  protected Directory getVersion(UUID id, Double version) {
    return getDirectoryService().getVersion(id.toString(), version);
  }

  private DirectoryService getDirectoryService() {
    return new DirectoryService(SdkClients.adminClient().getHttpClient());
  }

  // ===================================================================
  // DIRECTORY-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createAndGetDirectory(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    String directoryName = ns.prefix("test_directory");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Test Directory")
            .withDescription("A test directory created by integration test")
            .execute();

    assertNotNull(created.getId());
    assertEquals(directoryName, created.getName());
    assertEquals("Test Directory", created.getDisplayName());
    assertEquals(
        driveService.getFullyQualifiedName(), created.getService().getFullyQualifiedName());

    Directory fetched = Directories.get(created.getId().toString());
    assertEquals(created.getId(), fetched.getId());
  }

  @Test
  void test_createDirectoryWithoutService_fails(TestNamespace ns) {
    String directoryName = ns.prefix("test_directory_no_service");

    assertThrows(
        Exception.class,
        () -> Directories.create().name(directoryName).execute(),
        "Creating directory without service should fail");
  }

  @Test
  void test_createDirectoryWithInvalidService_fails(TestNamespace ns) {
    String directoryName = ns.prefix("test_directory_invalid_service");
    String invalidServiceFqn = "invalidDriveService_" + ns.prefix("nonexistent");

    assertThrows(
        Exception.class,
        () -> Directories.create().name(directoryName).withService(invalidServiceFqn).execute(),
        "Creating directory with invalid service should fail");
  }

  @Test
  void test_directoryFullyQualifiedName(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    String directoryName = ns.prefix("test_directory_fqn");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertTrue(created.getFullyQualifiedName().contains(driveService.getName()));
    assertTrue(created.getFullyQualifiedName().contains(directoryName));
  }

  @Test
  void test_createDirectoryWithAllFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    String directoryName = ns.prefix("test_directory_full");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Complete Test Directory")
            .withDescription("A directory with all fields populated for testing")
            .execute();

    assertEquals(directoryName, created.getName());
    assertEquals("Complete Test Directory", created.getDisplayName());
    assertEquals("A directory with all fields populated for testing", created.getDescription());
    assertNotNull(created.getService());
    assertTrue(
        created.getFullyQualifiedName().contains(directoryName),
        "FQN should contain directory name");
  }
}
