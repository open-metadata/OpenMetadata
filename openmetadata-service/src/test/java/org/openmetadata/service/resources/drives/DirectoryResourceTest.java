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
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DriveServiceResourceTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class DirectoryResourceTest extends EntityResourceTest<Directory, CreateDirectory> {
  public DirectoryResourceTest() {
    super(
        Entity.DIRECTORY,
        Directory.class,
        DirectoryResource.DirectoryList.class,
        "drives/directories",
        DirectoryResource.FIELDS);
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
}
