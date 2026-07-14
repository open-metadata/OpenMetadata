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
import org.openmetadata.schema.api.data.CreateFile;
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.fluent.Directories;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.drives.DirectoryService;
import org.openmetadata.sdk.services.drives.FileService;
import org.openmetadata.sdk.services.drives.SpreadsheetService;

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

  private static volatile DriveService sharedDriveService;

  @BeforeAll
  static void setup() {
    Directories.setDefaultClient(SdkClients.adminClient());
  }

  private DriveService sharedDriveService(TestNamespace ns) {
    DriveService cached = sharedDriveService;
    if (cached != null) {
      return cached;
    }
    synchronized (DirectoryResourceIT.class) {
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
  protected CreateDirectory createMinimalRequest(TestNamespace ns) {
    return new CreateDirectory()
        .withName(ns.prefix("directory"))
        .withService(sharedDriveService(ns).getFullyQualifiedName())
        .withDescription("Test directory created by integration test");
  }

  @Override
  protected CreateDirectory createRequest(String name, TestNamespace ns) {
    return new CreateDirectory()
        .withName(name)
        .withService(sharedDriveService(ns).getFullyQualifiedName());
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
    DriveService driveService = sharedDriveService(ns);
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
    DriveService driveService = sharedDriveService(ns);
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

  @Test
  void test_createDirectoryWithAllFields(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);
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
  void test_createDirectoryMinimalRequest(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);
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
  void test_getByName(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);
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
    DriveService driveService = sharedDriveService(ns);
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
    DriveService driveService = sharedDriveService(ns);
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
  void test_findDirectoryById(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);
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
    DriveService driveService = sharedDriveService(ns);
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
    DriveService driveService = sharedDriveService(ns);
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
    DriveService driveService = sharedDriveService(ns);
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
  void test_listReturnsServiceParentAndStats_excludesDeletedFromTotalSize(TestNamespace ns) {
    DriveService driveService = sharedDriveService(ns);
    assertNotNull(driveService);

    Directory parentDir =
        Directories.create()
            .name(ns.prefix("stats_parent"))
            .withService(driveService.getFullyQualifiedName())
            .execute();

    Directory subDir =
        Directories.create()
            .name(ns.prefix("stats_sub"))
            .withService(driveService.getFullyQualifiedName())
            .withParent(parentDir.getFullyQualifiedName())
            .execute();
    assertNotNull(subDir);

    File liveFile =
        getFileService()
            .create(
                new CreateFile()
                    .withName(ns.prefix("stats_live_file"))
                    .withService(driveService.getFullyQualifiedName())
                    .withDirectory(parentDir.getFullyQualifiedName())
                    .withSize(100));
    assertNotNull(liveFile);

    Spreadsheet spreadsheet =
        getSpreadsheetService()
            .create(
                new CreateSpreadsheet()
                    .withName(ns.prefix("stats_sheet"))
                    .withService(driveService.getFullyQualifiedName())
                    .withParent(parentDir.getEntityReference())
                    .withSize(50));
    assertNotNull(spreadsheet);

    File deletedFile =
        getFileService()
            .create(
                new CreateFile()
                    .withName(ns.prefix("stats_deleted_file"))
                    .withService(driveService.getFullyQualifiedName())
                    .withDirectory(parentDir.getFullyQualifiedName())
                    .withSize(999));
    getFileService().delete(deletedFile.getId().toString());

    ListParams params =
        new ListParams()
            .setService(driveService.getFullyQualifiedName())
            .setFields("service,parent,numberOfFiles,numberOfSubDirectories,totalSize")
            .setLimit(1000);
    Directory listedParent = findInList(params, parentDir.getId());
    assertNotNull(listedParent, "Parent directory must be present in the list response");

    assertNotNull(listedParent.getService(), "Service must be set on the list path");
    assertEquals(
        driveService.getFullyQualifiedName(),
        listedParent.getService().getFullyQualifiedName(),
        "Service FQN must match on the list path");

    assertEquals(
        2,
        listedParent.getNumberOfFiles(),
        "numberOfFiles must count the live file and spreadsheet, not the deleted file");
    assertEquals(
        1,
        listedParent.getNumberOfSubDirectories(),
        "numberOfSubDirectories must count the subdirectory on the list path");
    assertEquals(
        150,
        listedParent.getTotalSize(),
        "totalSize must sum live children only and exclude the soft-deleted file");

    Directory listedSub = findInList(params, subDir.getId());
    assertNotNull(listedSub, "Subdirectory must be present in the list response");
    assertNotNull(listedSub.getParent(), "Parent must be set on the list path");
    assertEquals(
        parentDir.getId(),
        listedSub.getParent().getId(),
        "Parent reference must match on the list path");
  }

  /**
   * A nested directory must inherit its domain from its parent directory (not the drive service)
   * on the bulk list path, even when the parent field is not requested: the parent reference is
   * needed internally for inheritance and must not leak into the response.
   */
  @Test
  void test_listInheritsDomainFromParentDirectoryWithoutParentField(TestNamespace ns) {
    DriveService driveService = DriveServiceTestFactory.createGoogleDrive(ns);

    org.openmetadata.schema.entity.domains.Domain parentDomain =
        SdkClients.adminClient()
            .domains()
            .create(
                new org.openmetadata.schema.api.domains.CreateDomain()
                    .withName(ns.prefix("dir_parent_domain"))
                    .withDomainType(
                        org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Domain assigned to the parent directory"));

    Directory parentDir =
        getDirectoryService()
            .create(
                new CreateDirectory()
                    .withName(ns.prefix("domain_parent"))
                    .withService(driveService.getFullyQualifiedName())
                    .withDomains(java.util.List.of(parentDomain.getFullyQualifiedName())));

    Directory nestedDir =
        getDirectoryService()
            .create(
                new CreateDirectory()
                    .withName(ns.prefix("domain_nested"))
                    .withService(driveService.getFullyQualifiedName())
                    .withParent(parentDir.getFullyQualifiedName()));

    ListParams params =
        new ListParams()
            .setService(driveService.getFullyQualifiedName())
            .setFields("domains")
            .setLimit(1000);
    Directory listedNested = findInList(params, nestedDir.getId());
    assertNotNull(listedNested, "Nested directory must be present in the list response");
    assertTrue(
        listedNested.getParent() == null,
        "Parent was not requested and must not be returned on the list path");
    assertNotNull(
        listedNested.getDomains(),
        "Nested directory must inherit a domain on the list path even without the parent field");
    assertEquals(1, listedNested.getDomains().size());
    assertEquals(
        parentDomain.getFullyQualifiedName(),
        listedNested.getDomains().getFirst().getFullyQualifiedName(),
        "Nested directory must inherit its domain from the parent directory, not the drive service");
    assertTrue(
        Boolean.TRUE.equals(listedNested.getDomains().getFirst().getInherited()),
        "The domain must be marked inherited");
  }

  private Directory findInList(ListParams params, UUID id) {
    ListResponse<Directory> response = listEntities(params);
    Directory match = null;
    for (Directory directory : response.getData()) {
      if (id.equals(directory.getId())) {
        match = directory;
      }
    }
    return match;
  }

  private FileService getFileService() {
    return new FileService(SdkClients.adminClient().getHttpClient());
  }

  private SpreadsheetService getSpreadsheetService() {
    return new SpreadsheetService(SdkClients.adminClient().getHttpClient());
  }
}
