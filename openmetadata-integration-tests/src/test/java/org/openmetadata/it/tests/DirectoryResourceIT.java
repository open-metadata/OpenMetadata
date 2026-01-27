package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.sdk.fluent.Directories;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DirectoryResourceIT {

  @BeforeAll
  static void setup() {
    Directories.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void test_createAndGetDirectory(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Test Directory")
            .withDescription("A test directory created by integration test")
            .execute();

    assertNotNull(created);
    assertNotNull(created.getId());
    assertEquals(directoryName, created.getName());
    assertEquals("Test Directory", created.getDisplayName());
    assertEquals("A test directory created by integration test", created.getDescription());
    assertNotNull(created.getService());
    assertEquals(
        driveService.getFullyQualifiedName(), created.getService().getFullyQualifiedName());

    Directory fetched = Directories.get(created.getId().toString());
    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(created.getDisplayName(), fetched.getDisplayName());
  }

  @Test
  void test_getByName(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory_by_name");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Test Directory By Name")
            .execute();

    assertNotNull(created);
    assertNotNull(created.getFullyQualifiedName());

    Directory fetched = Directories.getByName(created.getFullyQualifiedName());
    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_getByNameWithFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory_with_fields");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Test Directory With Fields")
            .execute();

    assertNotNull(created);
    assertNotNull(created.getFullyQualifiedName());

    Directory fetched = Directories.getByName(created.getFullyQualifiedName(), "service,owners");
    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertNotNull(fetched.getService());
  }

  @Test
  void test_deleteDirectory(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory_delete");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Test Directory To Delete")
            .execute();

    assertNotNull(created);
    String directoryId = created.getId().toString();

    Directories.delete(directoryId);

    assertThrows(
        Exception.class,
        () -> Directories.get(directoryId),
        "Getting deleted directory should fail");
  }

  @Test
  void test_createDirectoryMinimalRequest(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory_minimal");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(created);
    assertNotNull(created.getId());
    assertEquals(directoryName, created.getName());
    assertNotNull(created.getService());
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
  void test_findDirectoryById(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory_find");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Test Directory Find")
            .execute();

    assertNotNull(created);

    Directory fetched = Directories.find(created.getId().toString()).fetch();
    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void test_findDirectoryByName(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory_find_by_name");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Test Directory Find By Name")
            .execute();

    assertNotNull(created);
    assertNotNull(created.getFullyQualifiedName());

    Directory fetched = Directories.findByName(created.getFullyQualifiedName()).fetch();
    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void test_findDirectoryWithFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory_find_fields");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Test Directory Find Fields")
            .execute();

    assertNotNull(created);

    Directory fetched =
        Directories.findByName(created.getFullyQualifiedName())
            .withFields("service", "owners", "tags")
            .fetch();
    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertNotNull(fetched.getService());
  }

  @Test
  void test_createMultipleDirectories(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    for (int i = 1; i <= 3; i++) {
      String directoryName = ns.prefix("test_directory_multi_" + i);
      Directory created =
          Directories.create()
              .name(directoryName)
              .withService(driveService.getFullyQualifiedName())
              .withDisplayName("Test Directory " + i)
              .withDescription("Directory number " + i)
              .execute();

      assertNotNull(created);
      assertNotNull(created.getId());
      assertEquals(directoryName, created.getName());
      assertEquals("Test Directory " + i, created.getDisplayName());

      Directory fetched = Directories.get(created.getId().toString());
      assertEquals(created.getId(), fetched.getId());
    }
  }

  @Test
  void test_createDirectoryWithAllFields(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory_full");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .withDisplayName("Complete Test Directory")
            .withDescription("A directory with all fields populated for testing")
            .execute();

    assertNotNull(created);
    assertNotNull(created.getId());
    assertEquals(directoryName, created.getName());
    assertEquals("Complete Test Directory", created.getDisplayName());
    assertEquals("A directory with all fields populated for testing", created.getDescription());
    assertNotNull(created.getService());
    assertNotNull(created.getFullyQualifiedName());
    assertTrue(
        created.getFullyQualifiedName().contains(directoryName),
        "FQN should contain directory name");
  }

  @Test
  void test_getNonExistentDirectory_fails(TestNamespace ns) {
    String nonExistentId = "non-existent-directory-id-12345";

    assertThrows(
        Exception.class,
        () -> Directories.get(nonExistentId),
        "Getting non-existent directory should fail");
  }

  @Test
  void test_getByNameNonExistent_fails(TestNamespace ns) {
    String nonExistentFqn = "nonExistentService.nonExistentDirectory";

    assertThrows(
        Exception.class,
        () -> Directories.getByName(nonExistentFqn),
        "Getting directory by non-existent FQN should fail");
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
    assertNotNull(driveService);

    String directoryName = ns.prefix("test_directory_fqn");
    Directory created =
        Directories.create()
            .name(directoryName)
            .withService(driveService.getFullyQualifiedName())
            .execute();

    assertNotNull(created);
    assertNotNull(created.getFullyQualifiedName());
    assertTrue(created.getFullyQualifiedName().contains(driveService.getName()));
    assertTrue(created.getFullyQualifiedName().contains(directoryName));
  }
}
