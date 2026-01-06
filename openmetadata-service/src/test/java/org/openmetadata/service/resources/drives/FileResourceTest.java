/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.drives;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.resources.EntityResourceTest.PERSONAL_DATA_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.PII_SENSITIVE_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.USER_ADDRESS_TAG_LABEL;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateDirectory;
import org.openmetadata.schema.api.data.CreateFile;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.services.connections.drive.GoogleDriveConnection;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FileType;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DriveServiceResourceTest;
import org.openmetadata.service.services.drives.FileService;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class FileResourceTest extends EntityResourceTest<File, CreateFile> {
  private static DriveService DRIVE_SERVICE;
  private static EntityReference DRIVE_SERVICE_REFERENCE;

  public FileResourceTest() {
    super(Entity.FILE, File.class, FileService.FileList.class, "drives/files", FileService.FIELDS);
    supportsSearchIndex = true;
  }

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    super.setup(test);
    setupDriveService(test);
  }

  public void setupDriveService(TestInfo test) throws HttpResponseException {
    if (DRIVE_SERVICE == null) {
      DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
      CreateDriveService createService =
          driveServiceResourceTest
              .createRequest(test)
              .withName("testDriveServiceFile")
              .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive)
              .withConnection(getTestDriveConnection());
      try {
        DRIVE_SERVICE =
            driveServiceResourceTest.getEntityByName(createService.getName(), ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Service doesn't exist, create it
        DRIVE_SERVICE = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);
      }
      DRIVE_SERVICE_REFERENCE = DRIVE_SERVICE.getEntityReference();
    }
  }

  @Test
  void post_fileCreateWithInvalidService_400() {
    // Create file with non-existent service
    CreateFile create = createRequest("file1");
    create.withService("non-existent-service");
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "driveService instance for non-existent-service not found");
  }

  @Test
  void post_fileCreateWithoutRequiredFields_400() throws HttpResponseException {

    CreateFile create = createRequest("file1").withService(null);
    CreateFile finalCreate = create;
    assertResponse(
        () -> createEntity(finalCreate, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param service must not be null]");

    // Create file without optional directory field - should succeed
    create = createRequest("file1").withDirectory(null);
    File file = createEntity(create, ADMIN_AUTH_HEADERS);
    assertEquals(getContainer().getFullyQualifiedName() + ".file1", file.getFullyQualifiedName());
  }

  @Test
  void post_validFiles_200_OK(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("googleDrive")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create directory
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createDirectory =
        new CreateDirectory()
            .withName("documents")
            .withService(service.getFullyQualifiedName())
            .withPath("/path/to/documents");
    Directory directory = directoryResourceTest.createEntity(createDirectory, ADMIN_AUTH_HEADERS);

    // Create file in directory
    CreateFile create =
        createRequest("report.pdf")
            .withService(service.getFullyQualifiedName())
            .withDirectory(directory.getFullyQualifiedName())
            .withFileType(FileType.PDF)
            .withSize(1024);
    File file = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Validate parent-child relationship
    assertEquals(directory.getId(), file.getDirectory().getId());
    assertEquals(directory.getFullyQualifiedName(), file.getDirectory().getFullyQualifiedName());
    assertEquals(FileType.PDF, file.getFileType());
    assertEquals(Integer.valueOf(1024), file.getSize());
  }

  @Test
  void put_fileUpdate_200() throws IOException {
    CreateFile create =
        createRequest("updateFile.doc", "description", "owner", null)
            .withFileType(FileType.Document)
            .withSize(2048);
    File file = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Update description
    create.setDescription("updated description");
    file = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals("updated description", file.getDescription());

    // Update file size
    create.setSize(4096);
    file = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals(Integer.valueOf(4096), file.getSize());

    // Update file format - change to PDF
    create.setFileType(FileType.PDF);
    file = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals(FileType.PDF, file.getFileType());

    // Add checksum
    create.setChecksum("abc123def456");
    file = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals("abc123def456", file.getChecksum());
  }

  @Test
  void patch_fileAttributes_200() throws IOException {
    File file =
        createEntity(
            createRequest("patchFile.txt").withFileType(FileType.Text), ADMIN_AUTH_HEADERS);

    // Add description
    String originalJson = JsonUtils.pojoToJson(file);
    String description = "patched description";
    file.setDescription(description);
    file = patchEntity(file.getId(), originalJson, file, ADMIN_AUTH_HEADERS);
    assertEquals(description, file.getDescription());

    // Update file size
    originalJson = JsonUtils.pojoToJson(file);
    Integer newSize = 8192;
    file.setSize(newSize);
    file = patchEntity(file.getId(), originalJson, file, ADMIN_AUTH_HEADERS);
    assertEquals(newSize, file.getSize());

    // Add tags
    originalJson = JsonUtils.pojoToJson(file);
    file.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    file = patchEntity(file.getId(), originalJson, file, ADMIN_AUTH_HEADERS);
    assertNotNull(file.getTags());
    assertEquals(1, file.getTags().size());
    assertEquals(PERSONAL_DATA_TAG_LABEL.getTagFQN(), file.getTags().getFirst().getTagFQN());

    // Add owner
    originalJson = JsonUtils.pojoToJson(file);
    file.setOwners(List.of(USER1_REF));
    file = patchEntity(file.getId(), originalJson, file, ADMIN_AUTH_HEADERS);
    assertNotNull(file.getOwners());
    assertEquals(1, file.getOwners().size());
    assertEquals(USER1_REF.getId(), file.getOwners().getFirst().getId());
  }

  @Test
  void test_fileFormats(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForFormats")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Test various file formats
    String[] formats = {
      "CSV",
      "PDF",
      "Document",
      "Spreadsheet",
      "Text",
      "Archive",
      "Image",
      "Video",
      "Audio",
      "Code",
      "Data"
    };

    for (String format : formats) {
      CreateFile create =
          createRequest("testFile_" + format.toLowerCase() + "." + format.toLowerCase())
              .withService(service.getFullyQualifiedName())
              .withFileType(FileType.valueOf(format));
      File file = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
      assertEquals(FileType.valueOf(format), file.getFileType());
    }
  }

  @Test
  void test_fileFQNWithNestedDirectories(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForFileFQN")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create nested directory structure
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createRoot =
        new CreateDirectory()
            .withName("docs")
            .withService(service.getFullyQualifiedName())
            .withPath("/path/to/docs");
    Directory rootDir = directoryResourceTest.createEntity(createRoot, ADMIN_AUTH_HEADERS);

    CreateDirectory createSubDir =
        new CreateDirectory()
            .withName("reports")
            .withService(service.getFullyQualifiedName())
            .withParent(rootDir.getFullyQualifiedName())
            .withPath("/path/to/docs/reports");
    Directory subDir = directoryResourceTest.createEntity(createSubDir, ADMIN_AUTH_HEADERS);

    // Create file in nested directory
    CreateFile create =
        createRequest("quarterly.pdf")
            .withService(service.getFullyQualifiedName())
            .withDirectory(subDir.getFullyQualifiedName())
            .withFileType(FileType.PDF);
    File file = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Verify FQN follows the full path
    // Note: File names with dots are quoted in FQN to avoid parsing ambiguity
    assertEquals(
        service.getFullyQualifiedName() + ".docs.reports.\"quarterly.pdf\"",
        file.getFullyQualifiedName());
    assertEquals(subDir.getId(), file.getDirectory().getId());
  }

  @Test
  void test_listFilesByDirectory(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForList")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create two directories
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createDir1 =
        new CreateDirectory()
            .withName("dir1")
            .withService(service.getFullyQualifiedName())
            .withPath("/path/to/dir1");
    Directory dir1 = directoryResourceTest.createEntity(createDir1, ADMIN_AUTH_HEADERS);

    CreateDirectory createDir2 =
        new CreateDirectory()
            .withName("dir2")
            .withService(service.getFullyQualifiedName())
            .withPath("/path/to/dir2");
    Directory dir2 = directoryResourceTest.createEntity(createDir2, ADMIN_AUTH_HEADERS);

    // Create files in each directory
    for (int i = 0; i < 3; i++) {
      createEntity(
          createRequest("file_dir1_" + i + ".txt")
              .withService(service.getFullyQualifiedName())
              .withDirectory(dir1.getFullyQualifiedName())
              .withFileType(FileType.Text),
          ADMIN_AUTH_HEADERS);
      createEntity(
          createRequest("file_dir2_" + i + ".pdf")
              .withService(service.getFullyQualifiedName())
              .withDirectory(dir2.getFullyQualifiedName())
              .withFileType(FileType.PDF),
          ADMIN_AUTH_HEADERS);
    }

    // List files by directory
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("directory", dir1.getFullyQualifiedName());
    ResultList<File> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, list.getData().size());
    assertTrue(
        list.getData().stream().allMatch(f -> f.getDirectory().getId().equals(dir1.getId())));
    assertTrue(list.getData().stream().allMatch(f -> f.getFileType().equals(FileType.Text)));

    // List files for dir2
    queryParams.put("directory", dir2.getFullyQualifiedName());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, list.getData().size());
    assertTrue(
        list.getData().stream().allMatch(f -> f.getDirectory().getId().equals(dir2.getId())));
    assertTrue(list.getData().stream().allMatch(f -> f.getFileType().equals(FileType.PDF)));
  }

  @Override
  public CreateFile createRequest(String name) {
    return new CreateFile()
        .withName(name)
        .withService(getContainer().getFullyQualifiedName())
        .withPath("/path/to/" + name)
        .withFileType(FileType.CSV)
        .withSize(1024);
  }

  @Override
  public void validateCreatedEntity(
      File createdEntity, CreateFile request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getPath(), createdEntity.getPath());
    assertEquals(request.getService(), createdEntity.getService().getFullyQualifiedName());
    assertEquals(request.getFileType(), createdEntity.getFileType());
    assertEquals(request.getSize(), createdEntity.getSize());
    if (request.getDirectory() != null) {
      assertEquals(request.getDirectory(), createdEntity.getDirectory().getFullyQualifiedName());
    }
    TestUtils.validateTags(request.getTags(), createdEntity.getTags());
  }

  @Override
  public void compareEntities(File expected, File updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getService().getId(), updated.getService().getId());
    assertEquals(expected.getPath(), updated.getPath());
    assertEquals(expected.getFileType(), updated.getFileType());
    assertEquals(expected.getSize(), updated.getSize());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
  }

  @Override
  public File validateGetWithDifferentFields(File entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners(), entity.getTags());

    fields = "owners,tags,followers";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners(), entity.getTags());

    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }

  public EntityReference getContainer() {
    return DRIVE_SERVICE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(File entity) {
    return entity.getService();
  }

  private DriveConnection getTestDriveConnection() {
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
    return new DriveConnection().withConfig(googleDriveConnection);
  }

  @Test
  void test_listFilesWithRootParameter(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForFileRootTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a directory at root level (no parent)
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createRootDir =
        directoryResourceTest
            .createRequest("documentsDir")
            .withService(service.getFullyQualifiedName());
    Directory documentsDir = directoryResourceTest.createEntity(createRootDir, ADMIN_AUTH_HEADERS);

    // Create files at root level (no directory parent - these are root files)
    CreateFile createRootFile1 =
        createRequest("rootFile1.txt")
            .withService(service.getFullyQualifiedName())
            .withFileType(FileType.Text);
    File rootFile1 = createAndCheckEntity(createRootFile1, ADMIN_AUTH_HEADERS);

    CreateFile createRootFile2 =
        createRequest("rootFile2.pdf")
            .withService(service.getFullyQualifiedName())
            .withFileType(FileType.PDF);
    File rootFile2 = createAndCheckEntity(createRootFile2, ADMIN_AUTH_HEADERS);

    // Create files in directory (have directory parent - NOT root files)
    CreateFile createChildFile1 =
        createRequest("childFile1.csv")
            .withService(service.getFullyQualifiedName())
            .withDirectory(documentsDir.getFullyQualifiedName())
            .withFileType(FileType.CSV);
    File childFile1 = createAndCheckEntity(createChildFile1, ADMIN_AUTH_HEADERS);

    CreateFile createChildFile2 =
        createRequest("childFile2.json")
            .withService(service.getFullyQualifiedName())
            .withDirectory(documentsDir.getFullyQualifiedName())
            .withFileType(FileType.CSV);
    File childFile2 = createAndCheckEntity(createChildFile2, ADMIN_AUTH_HEADERS);

    // Test 1: List all files without root parameter
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    ResultList<File> allFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, allFiles.getData().size());

    // Test 2: List only root files with root=true (files with no directory parent)
    queryParams.put("root", "true");
    ResultList<File> rootFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, rootFiles.getData().size());

    // Verify only root files are returned (those with no directory)
    for (File file : rootFiles.getData()) {
      assertNull(file.getDirectory());
      assertTrue(file.getName().equals("rootFile1.txt") || file.getName().equals("rootFile2.pdf"));
    }

    // Test 3: List with root=false should return all files
    queryParams.put("root", "false");
    ResultList<File> nonRootFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, nonRootFiles.getData().size());
  }

  @Test
  void test_listFilesWithRootParameterAndPagination(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForFileRootPaginationTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a directory for child files
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createDir =
        directoryResourceTest
            .createRequest("filesContainer")
            .withService(service.getFullyQualifiedName());
    Directory container = directoryResourceTest.createEntity(createDir, ADMIN_AUTH_HEADERS);

    // Create multiple root files for pagination testing
    List<File> rootFiles = new ArrayList<>();
    for (int i = 1; i <= 6; i++) {
      CreateFile createRoot =
          createRequest("rootFile" + i + ".txt")
              .withService(service.getFullyQualifiedName())
              .withFileType(FileType.Text);
      rootFiles.add(createAndCheckEntity(createRoot, ADMIN_AUTH_HEADERS));
    }

    // Create files in directory (not root) - these should not appear in root results
    for (int i = 1; i <= 4; i++) {
      CreateFile createChild =
          createRequest("childFile" + i + ".pdf")
              .withService(service.getFullyQualifiedName())
              .withDirectory(container.getFullyQualifiedName())
              .withFileType(FileType.PDF);
      createAndCheckEntity(createChild, ADMIN_AUTH_HEADERS);
    }

    // Test 1: Paginate through root files with limit
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    queryParams.put("root", "true");
    queryParams.put("limit", "2");

    ResultList<File> firstPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, firstPage.getData().size());
    assertNotNull(firstPage.getPaging().getAfter());

    // Verify all returned files are root level (no directory parent)
    for (File file : firstPage.getData()) {
      assertNull(file.getDirectory());
    }

    // Test 2: Get next page using after parameter
    queryParams.put("after", firstPage.getPaging().getAfter());
    ResultList<File> secondPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, secondPage.getData().size());

    // Verify second page files are also root level
    for (File file : secondPage.getData()) {
      assertNull(file.getDirectory());
    }

    // Test 3: Get third page
    queryParams.put("after", secondPage.getPaging().getAfter());
    ResultList<File> thirdPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, thirdPage.getData().size());
    for (File file : thirdPage.getData()) {
      assertNull(file.getDirectory());
    }

    // Test 4: Verify total count of root files
    queryParams.remove("after");
    queryParams.remove("limit");
    ResultList<File> allRootFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(6, allRootFiles.getData().size());

    // Test 5: Verify pagination with limit larger than result set
    queryParams.put("limit", "10");
    ResultList<File> largeLimitPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(6, largeLimitPage.getData().size());
  }

  @Test
  void test_listFilesWithRootParameterEmptyResult(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForFileEmptyRootTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create directories
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createDir1 =
        directoryResourceTest
            .createRequest("documents")
            .withService(service.getFullyQualifiedName());
    Directory documentsDir = directoryResourceTest.createEntity(createDir1, ADMIN_AUTH_HEADERS);

    CreateDirectory createDir2 =
        directoryResourceTest.createRequest("images").withService(service.getFullyQualifiedName());
    Directory imagesDir = directoryResourceTest.createEntity(createDir2, ADMIN_AUTH_HEADERS);

    // Create only files in directories (no root files)
    for (int i = 1; i <= 3; i++) {
      CreateFile createDocFile =
          createRequest("document" + i + ".docx")
              .withService(service.getFullyQualifiedName())
              .withDirectory(documentsDir.getFullyQualifiedName())
              .withFileType(FileType.Text);
      createAndCheckEntity(createDocFile, ADMIN_AUTH_HEADERS);
    }

    for (int i = 1; i <= 2; i++) {
      CreateFile createImageFile =
          createRequest("image" + i + ".png")
              .withService(service.getFullyQualifiedName())
              .withDirectory(imagesDir.getFullyQualifiedName())
              .withFileType(FileType.Image);
      createAndCheckEntity(createImageFile, ADMIN_AUTH_HEADERS);
    }

    // Test: List root files should return empty result
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    queryParams.put("root", "true");

    ResultList<File> rootFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(0, rootFiles.getData().size());

    // Verify all files are in directories
    queryParams.put("root", "false");
    ResultList<File> allFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, allFiles.getData().size());
    for (File file : allFiles.getData()) {
      assertNotNull(file.getDirectory());
    }
  }

  @Test
  void test_listFilesWithRootParameterAcrossMultipleServices(TestInfo test) throws IOException {
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();

    // Create first drive service (OneDrive)
    CreateDriveService createService1 =
        driveServiceResourceTest
            .createRequest(test)
            .withName("oneDriveService")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service1 =
        driveServiceResourceTest.createEntity(createService1, ADMIN_AUTH_HEADERS);

    // Create second drive service (Box)
    CreateDriveService createService2 =
        driveServiceResourceTest
            .createRequest(test)
            .withName("boxService")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service2 =
        driveServiceResourceTest.createEntity(createService2, ADMIN_AUTH_HEADERS);

    // Create directory in first service
    CreateDirectory createOnedriveDir =
        directoryResourceTest
            .createRequest("oneDriveFolder")
            .withService(service1.getFullyQualifiedName());
    Directory oneDriveDir =
        directoryResourceTest.createEntity(createOnedriveDir, ADMIN_AUTH_HEADERS);

    // Create root files in first service
    CreateFile createOnedriveRoot1 =
        createRequest("oneDriveRootFile1.xlsx")
            .withService(service1.getFullyQualifiedName())
            .withFileType(FileType.CSV);
    createAndCheckEntity(createOnedriveRoot1, ADMIN_AUTH_HEADERS);

    CreateFile createOnedriveRoot2 =
        createRequest("oneDriveRootFile2.pptx")
            .withService(service1.getFullyQualifiedName())
            .withFileType(FileType.PDF);
    createAndCheckEntity(createOnedriveRoot2, ADMIN_AUTH_HEADERS);

    // Create child files in first service
    CreateFile createOnedriveChild =
        createRequest("oneDriveChildFile.doc")
            .withService(service1.getFullyQualifiedName())
            .withDirectory(oneDriveDir.getFullyQualifiedName())
            .withFileType(FileType.Text);
    createAndCheckEntity(createOnedriveChild, ADMIN_AUTH_HEADERS);

    // Create directory in second service
    CreateDirectory createBoxDir =
        directoryResourceTest
            .createRequest("boxFolder")
            .withService(service2.getFullyQualifiedName());
    Directory boxDir = directoryResourceTest.createEntity(createBoxDir, ADMIN_AUTH_HEADERS);

    // Create root files in second service
    for (int i = 1; i <= 3; i++) {
      CreateFile createBoxRoot =
          createRequest("boxRootFile" + i + ".txt")
              .withService(service2.getFullyQualifiedName())
              .withFileType(FileType.Text);
      createAndCheckEntity(createBoxRoot, ADMIN_AUTH_HEADERS);
    }

    // Create child files in second service
    for (int i = 1; i <= 2; i++) {
      CreateFile createBoxChild =
          createRequest("boxChildFile" + i + ".csv")
              .withService(service2.getFullyQualifiedName())
              .withDirectory(boxDir.getFullyQualifiedName())
              .withFileType(FileType.CSV);
      createAndCheckEntity(createBoxChild, ADMIN_AUTH_HEADERS);
    }

    // Test 1: List root files for first service
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service1.getFullyQualifiedName());
    queryParams.put("root", "true");

    ResultList<File> oneDriveRootFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, oneDriveRootFiles.getData().size());
    for (File file : oneDriveRootFiles.getData()) {
      assertNull(file.getDirectory());
      assertTrue(file.getName().startsWith("oneDriveRootFile"));
    }

    // Test 2: List root files for second service
    queryParams.put("service", service2.getFullyQualifiedName());
    ResultList<File> boxRootFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, boxRootFiles.getData().size());
    for (File file : boxRootFiles.getData()) {
      assertNull(file.getDirectory());
      assertTrue(file.getName().startsWith("boxRootFile"));
    }

    // Test 3: Verify total files in first service
    queryParams.put("service", service1.getFullyQualifiedName());
    queryParams.put("root", "false");
    ResultList<File> allOneDriveFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, allOneDriveFiles.getData().size()); // 2 root + 1 child

    // Test 4: Verify total files in second service
    queryParams.put("service", service2.getFullyQualifiedName());
    ResultList<File> allBoxFiles = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, allBoxFiles.getData().size()); // 3 root + 2 child

    // Test 5: Verify services are properly isolated
    int rootFileCount1 = 0;
    int childFileCount1 = 0;
    for (File file : allOneDriveFiles.getData()) {
      if (file.getDirectory() == null) {
        rootFileCount1++;
      } else {
        childFileCount1++;
      }
    }
    assertEquals(2, rootFileCount1);
    assertEquals(1, childFileCount1);
  }

  @Test
  void testBulk_PreservesUserEditsOnUpdate(TestInfo test) throws IOException {
    CreateFile botCreate =
        createRequest(test.getDisplayName())
            .withDescription("Bot initial description")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL));

    File entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);
    assertEquals("Bot initial description", entity.getDescription());
    assertEquals(1, entity.getTags().size());

    String originalJson = JsonUtils.pojoToJson(entity);
    String userDescription = "User-edited description - should be preserved";
    entity.setDescription(userDescription);
    entity.setTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    File userEditedEntity = patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals(userDescription, userEditedEntity.getDescription());
    assertEquals(2, userEditedEntity.getTags().size());

    CreateFile botUpdate =
        createRequest(test.getDisplayName())
            .withDescription("Bot trying to overwrite - should be ignored")
            .withTags(List.of(PII_SENSITIVE_TAG_LABEL));

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult updateResult =
        TestUtils.put(
            bulkTarget,
            List.of(botUpdate),
            BulkOperationResult.class,
            OK,
            INGESTION_BOT_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, updateResult.getStatus());
    assertEquals(1, updateResult.getNumberOfRowsPassed());

    File verifyEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

    assertEquals(
        userDescription,
        verifyEntity.getDescription(),
        "Bot should not overwrite user's description");

    assertEquals(
        3, verifyEntity.getTags().size(), "Tags should be merged (2 user tags + 1 new bot tag)");
    assertTrue(
        verifyEntity.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(USER_ADDRESS_TAG_LABEL.getTagFQN())));
    assertTrue(
        verifyEntity.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(PERSONAL_DATA_TAG_LABEL.getTagFQN())));
    assertTrue(
        verifyEntity.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(PII_SENSITIVE_TAG_LABEL.getTagFQN())));
  }

  @Test
  void testBulk_AdminCanOverrideDescription(TestInfo test) throws IOException {
    CreateFile botCreate =
        createRequest(test.getDisplayName()).withDescription("Bot initial description");

    File entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(entity);
    entity.setDescription("User description");
    File userEditedEntity = patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals("User description", userEditedEntity.getDescription());

    CreateFile adminUpdate =
        createRequest(test.getDisplayName()).withDescription("Admin override description");

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult updateResult =
        TestUtils.put(
            bulkTarget, List.of(adminUpdate), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, updateResult.getStatus());

    File verifyEntity = getEntity(entity.getId(), ADMIN_AUTH_HEADERS);
    assertEquals("Admin override description", verifyEntity.getDescription());
  }
}
