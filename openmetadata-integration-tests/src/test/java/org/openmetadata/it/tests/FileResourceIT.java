package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateFile;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.FileType;
import org.openmetadata.sdk.fluent.Files;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.drives.FileService;

/**
 * Integration tests for File entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds File-specific tests for columns
 * (optional, since not all file types are tabular), file metadata, and drive-service linkage.
 */
@Execution(ExecutionMode.CONCURRENT)
public class FileResourceIT extends BaseEntityIT<File, CreateFile> {

  {
    supportsFollowers = false;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsCustomExtension = false;
    supportsBulkAPI = false;
    supportsDataContract = false;
  }

  private static volatile DriveService sharedDriveService;

  @BeforeAll
  public static void setup() {
    Files.setDefaultClient(SdkClients.adminClient());
  }

  private DriveService sharedDriveService(TestNamespace ns) {
    DriveService cached = sharedDriveService;
    if (cached != null) {
      return cached;
    }
    synchronized (FileResourceIT.class) {
      if (sharedDriveService == null) {
        sharedDriveService = DriveServiceTestFactory.createGoogleDrive(ns);
      }
      return sharedDriveService;
    }
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateFile createMinimalRequest(TestNamespace ns) {
    return new CreateFile()
        .withName(ns.prefix("file"))
        .withService(sharedDriveService(ns).getFullyQualifiedName())
        .withDescription("Test file created by integration test");
  }

  @Override
  protected CreateFile createRequest(String name, TestNamespace ns) {
    return new CreateFile()
        .withName(name)
        .withService(sharedDriveService(ns).getFullyQualifiedName());
  }

  @Override
  protected File createEntity(CreateFile createRequest) {
    return getFileService().create(createRequest);
  }

  @Override
  protected File getEntity(String id) {
    return getFileService().get(id);
  }

  @Override
  protected File getEntityByName(String fqn) {
    return getFileService().getByName(fqn);
  }

  @Override
  protected File patchEntity(String id, File entity) {
    return getFileService().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    getFileService().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    getFileService().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    getFileService().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "file";
  }

  @Override
  protected void validateCreatedEntity(File entity, CreateFile createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "File must have a service");
    assertEquals(
        createRequest.getService(),
        entity.getService().getFullyQualifiedName(),
        "Service FQN should match");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    if (createRequest.getColumns() != null && !createRequest.getColumns().isEmpty()) {
      assertNotNull(entity.getColumns());
      assertEquals(createRequest.getColumns().size(), entity.getColumns().size());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()), "FQN should contain file name");
  }

  @Override
  protected ListResponse<File> listEntities(ListParams params) {
    return getFileService().list(params);
  }

  @Override
  protected File getEntityWithFields(String id, String fields) {
    return getFileService().get(id, fields);
  }

  @Override
  protected File getEntityByNameWithFields(String fqn, String fields) {
    return getFileService().getByName(fqn, fields);
  }

  @Override
  protected File getEntityIncludeDeleted(String id) {
    return getFileService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return getFileService().getVersionList(id);
  }

  @Override
  protected File getVersion(UUID id, Double version) {
    return getFileService().getVersion(id.toString(), version);
  }

  private FileService getFileService() {
    return new FileService(SdkClients.adminClient().getHttpClient());
  }

  // ===================================================================
  // FILE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createAndGetFile(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file");
    File createdFile =
        Files.create()
            .name(fileName)
            .withService(driveService.getFullyQualifiedName())
            .withDescription("Test file for integration testing")
            .execute();

    assertNotNull(createdFile);
    assertNotNull(createdFile.getId());
    assertEquals(fileName, createdFile.getName());
    assertNotNull(createdFile.getService());
    assertEquals(
        driveService.getFullyQualifiedName(), createdFile.getService().getFullyQualifiedName());

    File retrievedFile = Files.get(createdFile.getId().toString());
    assertNotNull(retrievedFile);
    assertEquals(createdFile.getId(), retrievedFile.getId());
    assertEquals(fileName, retrievedFile.getName());
  }

  @Test
  void test_getFileByName(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_by_name");
    File createdFile =
        Files.create()
            .name(fileName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Test File Display Name")
            .execute();

    assertNotNull(createdFile);
    assertNotNull(createdFile.getFullyQualifiedName());

    File retrievedFile = Files.getByName(createdFile.getFullyQualifiedName());
    assertNotNull(retrievedFile);
    assertEquals(createdFile.getId(), retrievedFile.getId());
    assertEquals(fileName, retrievedFile.getName());
    assertEquals("Test File Display Name", retrievedFile.getDisplayName());
  }

  @Test
  void test_createFileWithoutService_shouldFail(TestNamespace ns) {
    String fileName = ns.prefix("test_file_no_service");

    assertThrows(
        Exception.class,
        () -> Files.create().name(fileName).execute(),
        "Creating file without service should fail");
  }

  @Test
  void test_multipleFilesInSameService(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    File file1 =
        Files.create()
            .name(ns.prefix("file_1"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    File file2 =
        Files.create()
            .name(ns.prefix("file_2"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    File file3 =
        Files.create()
            .name(ns.prefix("file_3"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(file1);
    assertNotNull(file2);
    assertNotNull(file3);

    assertNotEquals(file1.getId(), file2.getId());
    assertNotEquals(file2.getId(), file3.getId());
    assertNotEquals(file1.getId(), file3.getId());

    assertEquals(driveService.getFullyQualifiedName(), file1.getService().getFullyQualifiedName());
    assertEquals(driveService.getFullyQualifiedName(), file2.getService().getFullyQualifiedName());
    assertEquals(driveService.getFullyQualifiedName(), file3.getService().getFullyQualifiedName());
  }

  @Test
  void test_createFileWithoutColumns(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_no_columns");
    File createdFile =
        Files.create()
            .name(fileName)
            .withService(driveService.getFullyQualifiedName())
            .withFileType(FileType.Text)
            .withMimeType("text/plain")
            .execute();

    assertNotNull(createdFile);
    assertEquals(FileType.Text, createdFile.getFileType());
    assertNull(createdFile.getColumns(), "Columns should be null for a file without columns");
  }

  @Test
  void test_createCsvFileWithColumns(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_csv_with_columns");
    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column().withName("name").withDataType(ColumnDataType.STRING),
            new Column().withName("price").withDataType(ColumnDataType.DOUBLE));

    File createdFile =
        Files.create()
            .name(fileName)
            .withService(driveService.getFullyQualifiedName())
            .withFileType(FileType.CSV)
            .withMimeType("text/csv")
            .withColumns(columns)
            .execute();

    assertNotNull(createdFile.getColumns());
    assertEquals(3, createdFile.getColumns().size());
  }

  @Test
  void test_getFileWithColumnsField(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_csv_get_columns");
    List<Column> columns =
        Arrays.asList(
            new Column().withName("col1").withDataType(ColumnDataType.STRING),
            new Column().withName("col2").withDataType(ColumnDataType.INT));

    File createdFile =
        Files.create()
            .name(fileName)
            .withService(driveService.getFullyQualifiedName())
            .withFileType(FileType.CSV)
            .withColumns(columns)
            .execute();

    File retrievedFile = Files.getByName(createdFile.getFullyQualifiedName(), "columns");
    assertNotNull(retrievedFile.getColumns());
    assertEquals(2, retrievedFile.getColumns().size());
    assertEquals("col1", retrievedFile.getColumns().get(0).getName());
    assertEquals("col2", retrievedFile.getColumns().get(1).getName());
  }

  @Test
  void test_patchFileWithoutColumns_doesNotNpe(TestNamespace ns) {
    // Regression: PATCH on a file without columns must not NPE in
    // ColumnEntityUpdater.updateColumns. Reproduces the failure seen when
    // editing tags/description on PDF/image files (no columns defined).
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("patch_no_columns");
    File createdFile =
        Files.create()
            .name(fileName)
            .withService(driveService.getFullyQualifiedName())
            .withFileType(FileType.PDF)
            .withMimeType("application/pdf")
            .withDescription("Initial description")
            .execute();

    assertNull(createdFile.getColumns());

    createdFile.setDescription("Updated description");
    File patched = getFileService().update(createdFile.getId().toString(), createdFile);

    assertEquals("Updated description", patched.getDescription());
    assertNull(patched.getColumns());
  }

  @Test
  void test_createFileWithDisplayName(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_display");
    String displayName = "My Test File";

    File createdFile =
        Files.create()
            .name(fileName)
            .withDisplayName(displayName)
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(createdFile);
    assertEquals(fileName, createdFile.getName());
    assertEquals(displayName, createdFile.getDisplayName());
  }

  @Test
  void test_fileWithAllOptionalFields(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_full");
    String displayName = "Complete Test File";
    String description = "A file with all optional fields populated";

    File createdFile =
        Files.create()
            .name(fileName)
            .withDisplayName(displayName)
            .withDescription(description)
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(createdFile);
    assertEquals(fileName, createdFile.getName());
    assertEquals(displayName, createdFile.getDisplayName());
    assertEquals(description, createdFile.getDescription());
    assertNotNull(createdFile.getService());
    assertEquals(
        driveService.getFullyQualifiedName(), createdFile.getService().getFullyQualifiedName());
  }

  @Test
  void test_createFileMinimal(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_minimal");

    File createdFile =
        Files.create().name(fileName).withService(driveService.getFullyQualifiedName()).execute();

    assertNotNull(createdFile);
    assertEquals(fileName, createdFile.getName());
    assertNotNull(createdFile.getId());
    assertNotNull(createdFile.getService());
  }

  @Test
  void test_createFileWithDescription(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_desc");
    String description = "This is a detailed description of the test file";

    File createdFile =
        Files.create()
            .name(fileName)
            .withDescription(description)
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(createdFile);
    assertEquals(fileName, createdFile.getName());
    assertEquals(description, createdFile.getDescription());
  }

  @Test
  void test_deleteFile(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_delete");
    File createdFile =
        Files.create().name(fileName).withService(driveService.getFullyQualifiedName()).execute();

    assertNotNull(createdFile);
    String fileId = createdFile.getId().toString();

    File beforeDelete = Files.get(fileId);
    assertNotNull(beforeDelete);

    Files.delete(fileId);

    assertThrows(
        Exception.class, () -> Files.get(fileId), "Getting deleted file should throw exception");
  }

  @Test
  void test_findFileById(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_find");
    File createdFile =
        Files.create().name(fileName).withService(driveService.getFullyQualifiedName()).execute();

    assertNotNull(createdFile);

    File foundFile = Files.find(createdFile.getId().toString()).fetch();
    assertNotNull(foundFile);
    assertEquals(createdFile.getId(), foundFile.getId());
    assertEquals(fileName, foundFile.getName());
  }

  @Test
  void test_findFileByNameWithFields(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_find_by_name");
    File createdFile =
        Files.create()
            .name(fileName)
            .withService(driveService.getFullyQualifiedName())
            .withDescription("Find by name with fields")
            .execute();

    assertNotNull(createdFile);

    File foundFile =
        Files.findByName(createdFile.getFullyQualifiedName())
            .withFields("owners", "tags", "domains")
            .fetch();
    assertNotNull(foundFile);
    assertEquals(createdFile.getId(), foundFile.getId());
  }

  @Test
  void test_getFileByNameWithFields(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);

    String fileName = ns.prefix("test_file_with_fields");
    File createdFile =
        Files.create()
            .name(fileName)
            .withService(driveService.getFullyQualifiedName())
            .withDescription("File with specific fields")
            .execute();

    assertNotNull(createdFile);

    File retrievedFile = Files.getByName(createdFile.getFullyQualifiedName(), "owners,tags");
    assertNotNull(retrievedFile);
    assertEquals(createdFile.getId(), retrievedFile.getId());
  }

  @Test
  void test_getFileWithNonExistentId_shouldFail(TestNamespace ns) {
    String nonExistentId = "00000000-0000-0000-0000-000000000000";

    assertThrows(
        Exception.class,
        () -> Files.get(nonExistentId),
        "Getting file with non-existent ID should fail");
  }

  @Test
  void test_getFileByNameWithNonExistentFQN_shouldFail(TestNamespace ns) {
    String nonExistentFQN = "nonexistent.service.nonexistent.file";

    assertThrows(
        Exception.class,
        () -> Files.getByName(nonExistentFQN),
        "Getting file with non-existent FQN should fail");
  }
}
