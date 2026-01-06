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
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateDirectory;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DriveServiceResourceTest;
import org.openmetadata.service.services.drives.DirectoryService;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class DirectoryResourceTest extends EntityResourceTest<Directory, CreateDirectory> {
  public DirectoryResourceTest() {
    super(
        Entity.DIRECTORY,
        Directory.class,
        DirectoryService.DirectoryList.class,
        "drives/directories",
        DirectoryService.FIELDS);
    supportsSearchIndex = true;
  }

  @Test
  void post_entityCreateWithInvalidService_400() {
    // Create directory with non-existent service
    CreateDirectory create = createRequest("directory1");
    create.withService("non-existent-service");
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "driveService instance for non-existent-service not found");
  }

  @Test
  void post_entityCreateWithoutRequiredFields_400() {
    // Create directory without required service field
    CreateDirectory create = createRequest("directory1").withService(null);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param service must not be null]");
  }

  @Test
  void post_validDirectories_200_OK(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("googleDrive")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create directory
    CreateDirectory create =
        createRequest("directory1").withService(service.getFullyQualifiedName());
    Directory directory = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Create nested directory
    create =
        createRequest("subDirectory1")
            .withService(service.getFullyQualifiedName())
            .withParent(directory.getFullyQualifiedName());
    Directory subDirectory = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Validate parent-child relationship
    assertEquals(directory.getId(), subDirectory.getParent().getId());
    assertEquals(
        directory.getFullyQualifiedName(), subDirectory.getParent().getFullyQualifiedName());
  }

  @Test
  void put_directoryUpdate_200() throws IOException {
    CreateDirectory create = createRequest("updateDirectory", "description", "owner", null);
    Directory directory = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Update description
    create.setDescription("updated description");
    directory = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals("updated description", directory.getDescription());

    // Update path
    create.setPath("/new/path/to/directory");
    directory = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals("/new/path/to/directory", directory.getPath());

    // Add isShared flag
    create.setIsShared(true);
    directory = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals(true, directory.getIsShared());
  }

  @Test
  void patch_directoryAttributes_200() throws IOException {
    Directory directory = createEntity(createRequest("patchDirectory"), ADMIN_AUTH_HEADERS);

    // Add description
    String originalJson = JsonUtils.pojoToJson(directory);
    String description = "patched description";
    directory.setDescription(description);
    directory = patchEntity(directory.getId(), originalJson, directory, ADMIN_AUTH_HEADERS);
    assertEquals(description, directory.getDescription());

    // Update description
    originalJson = JsonUtils.pojoToJson(directory);
    String newDescription = "updated patched description";
    directory.setDescription(newDescription);
    directory = patchEntity(directory.getId(), originalJson, directory, ADMIN_AUTH_HEADERS);
    assertEquals(newDescription, directory.getDescription());

    // Add tags
    originalJson = JsonUtils.pojoToJson(directory);
    directory.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    directory = patchEntity(directory.getId(), originalJson, directory, ADMIN_AUTH_HEADERS);
    assertNotNull(directory.getTags());
    assertEquals(1, directory.getTags().size());
    assertEquals(PERSONAL_DATA_TAG_LABEL.getTagFQN(), directory.getTags().getFirst().getTagFQN());

    // Add owner
    originalJson = JsonUtils.pojoToJson(directory);
    directory.setOwners(List.of(USER1_REF));
    directory = patchEntity(directory.getId(), originalJson, directory, ADMIN_AUTH_HEADERS);
    assertNotNull(directory.getOwners());
    assertEquals(1, directory.getOwners().size());
    assertEquals(USER1_REF.getId(), directory.getOwners().getFirst().getId());
  }

  @Test
  void test_directoryNestedStructure(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForNestedStructure")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create root directory
    CreateDirectory createRoot = createRequest("root").withService(service.getFullyQualifiedName());
    Directory rootDir = createAndCheckEntity(createRoot, ADMIN_AUTH_HEADERS);
    assertEquals(service.getFullyQualifiedName() + ".root", rootDir.getFullyQualifiedName());
    assertNull(rootDir.getParent());

    // Create nested directories
    CreateDirectory createLevel1 =
        createRequest("level1")
            .withService(service.getFullyQualifiedName())
            .withParent(rootDir.getFullyQualifiedName());
    Directory level1Dir = createAndCheckEntity(createLevel1, ADMIN_AUTH_HEADERS);
    assertEquals(rootDir.getFullyQualifiedName() + ".level1", level1Dir.getFullyQualifiedName());
    assertNotNull(level1Dir.getParent());
    assertEquals(rootDir.getId(), level1Dir.getParent().getId());

    CreateDirectory createLevel2 =
        createRequest("level2")
            .withService(service.getFullyQualifiedName())
            .withParent(level1Dir.getFullyQualifiedName());
    Directory level2Dir = createAndCheckEntity(createLevel2, ADMIN_AUTH_HEADERS);
    assertEquals(level1Dir.getFullyQualifiedName() + ".level2", level2Dir.getFullyQualifiedName());
    assertNotNull(level2Dir.getParent());
    assertEquals(level1Dir.getId(), level2Dir.getParent().getId());

    // Verify full hierarchy path
    assertEquals(
        service.getFullyQualifiedName() + ".root.level1.level2", level2Dir.getFullyQualifiedName());
  }

  @Test
  void test_directoryHierarchy(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForHierarchy")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create root directory
    CreateDirectory createRoot =
        createRequest("rootDir").withService(service.getFullyQualifiedName());
    Directory rootDir = createAndCheckEntity(createRoot, ADMIN_AUTH_HEADERS);

    // Create sub-directory
    CreateDirectory createSub =
        createRequest("subDir")
            .withService(service.getFullyQualifiedName())
            .withParent(rootDir.getFullyQualifiedName());
    Directory subDir = createAndCheckEntity(createSub, ADMIN_AUTH_HEADERS);

    // Create sub-sub-directory
    CreateDirectory createSubSub =
        createRequest("subSubDir")
            .withService(service.getFullyQualifiedName())
            .withParent(subDir.getFullyQualifiedName());
    Directory subSubDir = createAndCheckEntity(createSubSub, ADMIN_AUTH_HEADERS);

    // Validate hierarchy
    assertEquals(service.getFullyQualifiedName() + ".rootDir", rootDir.getFullyQualifiedName());
    assertEquals(
        service.getFullyQualifiedName() + ".rootDir.subDir", subDir.getFullyQualifiedName());
    assertEquals(
        service.getFullyQualifiedName() + ".rootDir.subDir.subSubDir",
        subSubDir.getFullyQualifiedName());

    // List directories with children
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    queryParams.put("fields", "children");
    ResultList<Directory> directoryList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertNotNull(directoryList.getData());

    // Find root directory in list and verify it has children
    Directory rootFromList =
        directoryList.getData().stream()
            .filter(d -> d.getId().equals(rootDir.getId()))
            .findFirst()
            .orElse(null);
    assertNotNull(rootFromList);
    assertNotNull(rootFromList.getChildren());
    assertFalse(rootFromList.getChildren().isEmpty());
  }

  @Test
  void test_listDirectoriesByService(TestInfo test) throws IOException {
    // Create two drive services
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService1 =
        driveServiceResourceTest
            .createRequest(test)
            .withName("service1")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service1 =
        driveServiceResourceTest.createEntity(createService1, ADMIN_AUTH_HEADERS);

    CreateDriveService createService2 =
        driveServiceResourceTest
            .createRequest(test)
            .withName("service2")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service2 =
        driveServiceResourceTest.createEntity(createService2, ADMIN_AUTH_HEADERS);

    // Create directories for each service
    for (int i = 0; i < 3; i++) {
      createEntity(
          createRequest("dir_service1_" + i).withService(service1.getFullyQualifiedName()),
          ADMIN_AUTH_HEADERS);
      createEntity(
          createRequest("dir_service2_" + i).withService(service2.getFullyQualifiedName()),
          ADMIN_AUTH_HEADERS);
    }

    // List directories for service1
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service1.getFullyQualifiedName());
    ResultList<Directory> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, list.getData().size());
    assertTrue(
        list.getData().stream().allMatch(d -> d.getService().getId().equals(service1.getId())));

    // List directories for service2
    queryParams.put("service", service2.getFullyQualifiedName());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, list.getData().size());
    assertTrue(
        list.getData().stream().allMatch(d -> d.getService().getId().equals(service2.getId())));
  }

  @Override
  public CreateDirectory createRequest(String name) {
    return new CreateDirectory()
        .withName(name)
        .withService(GOOGLE_DRIVE_SERVICE_REFERENCE.getFullyQualifiedName())
        .withPath("/path/to/" + name);
  }

  @Override
  public void validateCreatedEntity(
      Directory createdEntity, CreateDirectory request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getPath(), createdEntity.getPath());
    assertEquals(request.getService(), createdEntity.getService().getFullyQualifiedName());
    if (request.getParent() != null) {
      assertEquals(request.getParent(), createdEntity.getParent().getFullyQualifiedName());
    }
    TestUtils.validateTags(request.getTags(), createdEntity.getTags());
  }

  @Override
  public void compareEntities(
      Directory expected, Directory updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getService().getId(), updated.getService().getId());
    assertEquals(expected.getPath(), updated.getPath());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
  }

  @Override
  public Directory validateGetWithDifferentFields(Directory entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners(), entity.getTags());

    fields = "owners,tags,children,followers";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners(), entity.getTags());
    // children field is tested separately in hierarchy tests

    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Override
  public EntityReference getContainer() {
    return GOOGLE_DRIVE_SERVICE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Directory entity) {
    return entity.getService();
  }

  @Test
  void test_listDirectoriesWithRootParameter(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForRootTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create root directories (no parent)
    CreateDirectory createRoot1 =
        createRequest("rootDir1").withService(service.getFullyQualifiedName());
    Directory rootDir1 = createAndCheckEntity(createRoot1, ADMIN_AUTH_HEADERS);

    CreateDirectory createRoot2 =
        createRequest("rootDir2").withService(service.getFullyQualifiedName());
    Directory rootDir2 = createAndCheckEntity(createRoot2, ADMIN_AUTH_HEADERS);

    // Create child directories (with parent)
    CreateDirectory createChild1 =
        createRequest("childDir1")
            .withService(service.getFullyQualifiedName())
            .withParent(rootDir1.getFullyQualifiedName());
    Directory childDir1 = createAndCheckEntity(createChild1, ADMIN_AUTH_HEADERS);

    CreateDirectory createChild2 =
        createRequest("childDir2")
            .withService(service.getFullyQualifiedName())
            .withParent(rootDir2.getFullyQualifiedName());
    Directory childDir2 = createAndCheckEntity(createChild2, ADMIN_AUTH_HEADERS);

    // Test 1: List all directories without root parameter
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    ResultList<Directory> allDirectories = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, allDirectories.getData().size());

    // Test 2: List only root directories with root=true
    queryParams.put("root", "true");
    ResultList<Directory> rootDirectories = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, rootDirectories.getData().size());

    // Verify only root directories are returned
    for (Directory dir : rootDirectories.getData()) {
      assertNull(dir.getParent());
      assertTrue(dir.getName().equals("rootDir1") || dir.getName().equals("rootDir2"));
    }

    // Test 3: List with root=false should return all directories
    queryParams.put("root", "false");
    ResultList<Directory> nonRootDirectories = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, nonRootDirectories.getData().size());
  }

  @Test
  void test_listDirectoriesWithRootParameterAndPagination(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForRootPaginationTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create multiple root directories for pagination testing
    List<Directory> rootDirs = new ArrayList<>();
    for (int i = 1; i <= 5; i++) {
      CreateDirectory createRoot =
          createRequest("rootDir" + i).withService(service.getFullyQualifiedName());
      rootDirs.add(createAndCheckEntity(createRoot, ADMIN_AUTH_HEADERS));
    }

    // Create child directories (with parent) - these should not appear in root results
    for (int i = 1; i <= 3; i++) {
      CreateDirectory createChild =
          createRequest("childDir" + i)
              .withService(service.getFullyQualifiedName())
              .withParent(rootDirs.get(0).getFullyQualifiedName());
      createAndCheckEntity(createChild, ADMIN_AUTH_HEADERS);
    }

    // Test 1: Paginate through root directories with limit
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    queryParams.put("root", "true");
    queryParams.put("limit", "2");

    ResultList<Directory> firstPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, firstPage.getData().size());
    assertNotNull(firstPage.getPaging().getAfter());

    // Verify all returned directories are root level
    for (Directory dir : firstPage.getData()) {
      assertNull(dir.getParent());
    }

    // Test 2: Get next page using after parameter
    queryParams.put("after", firstPage.getPaging().getAfter());
    ResultList<Directory> secondPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, secondPage.getData().size());

    // Verify second page directories are also root level
    for (Directory dir : secondPage.getData()) {
      assertNull(dir.getParent());
    }

    // Test 3: Get last page
    queryParams.put("after", secondPage.getPaging().getAfter());
    ResultList<Directory> lastPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(1, lastPage.getData().size());
    assertNull(lastPage.getData().get(0).getParent());

    // Test 4: Verify total count of root directories
    queryParams.remove("after");
    queryParams.remove("limit");
    ResultList<Directory> allRootDirs = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, allRootDirs.getData().size());
  }

  @Test
  void test_listDirectoriesWithRootParameterEmptyResult(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForEmptyRootTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a root directory
    CreateDirectory createRoot =
        createRequest("parentDir").withService(service.getFullyQualifiedName());
    Directory parentDir = createAndCheckEntity(createRoot, ADMIN_AUTH_HEADERS);

    // Create only child directories (no other root directories)
    for (int i = 1; i <= 3; i++) {
      CreateDirectory createChild =
          createRequest("childOnlyDir" + i)
              .withService(service.getFullyQualifiedName())
              .withParent(parentDir.getFullyQualifiedName());
      createAndCheckEntity(createChild, ADMIN_AUTH_HEADERS);
    }

    // Test: List root directories should return only the parent directory
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    queryParams.put("root", "true");

    ResultList<Directory> rootDirs = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(1, rootDirs.getData().size());
    assertEquals("parentDir", rootDirs.getData().get(0).getName());
    assertNull(rootDirs.getData().get(0).getParent());
  }

  @Test
  void test_listDirectoriesWithRootParameterAcrossMultipleServices(TestInfo test)
      throws IOException {
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();

    // Create first drive service
    CreateDriveService createService1 =
        driveServiceResourceTest
            .createRequest(test)
            .withName("googleDriveService")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service1 =
        driveServiceResourceTest.createEntity(createService1, ADMIN_AUTH_HEADERS);

    // Create second drive service
    CreateDriveService createService2 =
        driveServiceResourceTest
            .createRequest(test)
            .withName("dropboxService")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service2 =
        driveServiceResourceTest.createEntity(createService2, ADMIN_AUTH_HEADERS);

    // Create root directories in first service
    CreateDirectory createRoot1 =
        createRequest("googleRootDir1").withService(service1.getFullyQualifiedName());
    Directory googleRoot1 = createAndCheckEntity(createRoot1, ADMIN_AUTH_HEADERS);

    CreateDirectory createRoot2 =
        createRequest("googleRootDir2").withService(service1.getFullyQualifiedName());
    createAndCheckEntity(createRoot2, ADMIN_AUTH_HEADERS);

    // Create child directories in first service
    CreateDirectory createChild1 =
        createRequest("googleChildDir")
            .withService(service1.getFullyQualifiedName())
            .withParent(googleRoot1.getFullyQualifiedName());
    createAndCheckEntity(createChild1, ADMIN_AUTH_HEADERS);

    // Create root directories in second service
    CreateDirectory createDropboxRoot1 =
        createRequest("dropboxRootDir1").withService(service2.getFullyQualifiedName());
    createAndCheckEntity(createDropboxRoot1, ADMIN_AUTH_HEADERS);

    CreateDirectory createDropboxRoot2 =
        createRequest("dropboxRootDir2").withService(service2.getFullyQualifiedName());
    createAndCheckEntity(createDropboxRoot2, ADMIN_AUTH_HEADERS);

    CreateDirectory createDropboxRoot3 =
        createRequest("dropboxRootDir3").withService(service2.getFullyQualifiedName());
    Directory dropboxRoot3 = createAndCheckEntity(createDropboxRoot3, ADMIN_AUTH_HEADERS);

    // Create child directories in second service
    CreateDirectory createDropboxChild =
        createRequest("dropboxChildDir")
            .withService(service2.getFullyQualifiedName())
            .withParent(dropboxRoot3.getFullyQualifiedName());
    createAndCheckEntity(createDropboxChild, ADMIN_AUTH_HEADERS);

    // Test 1: List root directories for first service
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service1.getFullyQualifiedName());
    queryParams.put("root", "true");

    ResultList<Directory> googleRootDirs = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, googleRootDirs.getData().size());
    for (Directory dir : googleRootDirs.getData()) {
      assertNull(dir.getParent());
      assertTrue(dir.getName().startsWith("googleRootDir"));
    }

    // Test 2: List root directories for second service
    queryParams.put("service", service2.getFullyQualifiedName());
    ResultList<Directory> dropboxRootDirs = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, dropboxRootDirs.getData().size());
    for (Directory dir : dropboxRootDirs.getData()) {
      assertNull(dir.getParent());
      assertTrue(dir.getName().startsWith("dropboxRootDir"));
    }

    // Test 3: Verify services are isolated - list all from first service
    queryParams.put("service", service1.getFullyQualifiedName());
    queryParams.put("root", "false");
    ResultList<Directory> allGoogleDirs = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, allGoogleDirs.getData().size()); // 2 root + 1 child

    // Test 4: Verify services are isolated - list all from second service
    queryParams.put("service", service2.getFullyQualifiedName());
    ResultList<Directory> allDropboxDirs = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, allDropboxDirs.getData().size()); // 3 root + 1 child
  }

  @Test
  void testBulk_PreservesUserEditsOnUpdate(TestInfo test) throws IOException {
    CreateDirectory botCreate =
        createRequest(test.getDisplayName())
            .withDescription("Bot initial description")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL));

    Directory entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);
    assertEquals("Bot initial description", entity.getDescription());
    assertEquals(1, entity.getTags().size());

    String originalJson = JsonUtils.pojoToJson(entity);
    String userDescription = "User-edited description - should be preserved";
    entity.setDescription(userDescription);
    entity.setTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    Directory userEditedEntity =
        patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals(userDescription, userEditedEntity.getDescription());
    assertEquals(2, userEditedEntity.getTags().size());

    CreateDirectory botUpdate =
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

    Directory verifyEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

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
    CreateDirectory botCreate =
        createRequest(test.getDisplayName()).withDescription("Bot initial description");

    Directory entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(entity);
    entity.setDescription("User description");
    Directory userEditedEntity =
        patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals("User description", userEditedEntity.getDescription());

    CreateDirectory adminUpdate =
        createRequest(test.getDisplayName()).withDescription("Admin override description");

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult updateResult =
        TestUtils.put(
            bulkTarget, List.of(adminUpdate), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, updateResult.getStatus());

    Directory verifyEntity = getEntity(entity.getId(), ADMIN_AUTH_HEADERS);
    assertEquals("Admin override description", verifyEntity.getDescription());
  }
}
