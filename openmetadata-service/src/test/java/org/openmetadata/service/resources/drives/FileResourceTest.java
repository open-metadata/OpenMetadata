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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
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
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FileType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DriveServiceResourceTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class FileResourceTest extends EntityResourceTest<File, CreateFile> {
  private static DriveService DRIVE_SERVICE;
  private static EntityReference DRIVE_SERVICE_REFERENCE;

  public FileResourceTest() {
    super(
        Entity.FILE, File.class, FileResource.FileList.class, "drives/files", FileResource.FIELDS);
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
}
