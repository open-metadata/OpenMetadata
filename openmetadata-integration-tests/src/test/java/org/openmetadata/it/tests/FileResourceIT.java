package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.sdk.fluent.Files;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class FileResourceIT {

  @BeforeAll
  public static void setup() {
    Files.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void test_createAndGetFile(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
    assertEquals(driveService.getFullyQualifiedName(), createdFile.getService().getName());

    File retrievedFile = Files.get(createdFile.getId().toString());
    assertNotNull(retrievedFile);
    assertEquals(createdFile.getId(), retrievedFile.getId());
    assertEquals(fileName, retrievedFile.getName());
  }

  @Test
  void test_getFileByName(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
  void test_getFileByNameWithFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
  void test_findFileById(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
            .withFields("owners", "tags", "domain")
            .fetch();
    assertNotNull(foundFile);
    assertEquals(createdFile.getId(), foundFile.getId());
  }

  @Test
  void test_deleteFile(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
  void test_createFileWithDisplayName(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
  void test_createFileWithDescription(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
  void test_createFileMinimal(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    String fileName = ns.prefix("test_file_minimal");

    File createdFile =
        Files.create().name(fileName).withService(driveService.getFullyQualifiedName()).execute();

    assertNotNull(createdFile);
    assertEquals(fileName, createdFile.getName());
    assertNotNull(createdFile.getId());
    assertNotNull(createdFile.getService());
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
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
  void test_fileWithAllOptionalFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

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
    assertEquals(driveService.getFullyQualifiedName(), createdFile.getService().getName());
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
