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
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
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
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.api.data.CreateWorksheet;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.services.connections.drive.GoogleDriveConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DriveServiceResourceTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class SpreadsheetResourceTest extends EntityResourceTest<Spreadsheet, CreateSpreadsheet> {
  private static DriveService DRIVE_SERVICE;
  private static EntityReference DRIVE_SERVICE_REFERENCE;

  public SpreadsheetResourceTest() {
    super(
        Entity.SPREADSHEET,
        Spreadsheet.class,
        SpreadsheetResource.SpreadsheetList.class,
        "drives/spreadsheets",
        SpreadsheetResource.FIELDS);
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
              .withName("testDriveServiceSpreadsheet")
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
  void post_spreadsheetCreateWithInvalidService_400() {
    // Create spreadsheet with non-existent service
    CreateSpreadsheet create = createRequest("spreadsheet1");
    create.withService("non-existent-service");
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "driveService instance for non-existent-service not found");
  }

  @Test
  void post_spreadsheetCreateWithoutRequiredFields_400() {
    // Create spreadsheet without required service field
    CreateSpreadsheet create = createRequest("spreadsheet1").withService(null);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[service must not be null]");
  }

  @Test
  void post_spreadsheetDirectlyUnderService_200_OK(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("googleDriveForDirect")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create spreadsheet directly under service (no directory)
    CreateSpreadsheet create =
        createRequest("directSpreadsheet").withService(service.getFullyQualifiedName());
    Spreadsheet spreadsheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Validate no directory relationship
    assertNull(spreadsheet.getDirectory());
    assertEquals(
        service.getFullyQualifiedName() + ".directSpreadsheet",
        spreadsheet.getFullyQualifiedName());
  }

  @Test
  void post_spreadsheetInDirectory_200_OK(TestInfo test) throws IOException {
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
        directoryResourceTest
            .createRequest("financials")
            .withService(service.getFullyQualifiedName());
    Directory directory = directoryResourceTest.createEntity(createDirectory, ADMIN_AUTH_HEADERS);

    // Create spreadsheet in directory
    CreateSpreadsheet create =
        createRequest("budget2024")
            .withService(service.getFullyQualifiedName())
            .withParent(directory.getEntityReference());
    Spreadsheet spreadsheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Validate directory relationship
    assertNotNull(spreadsheet.getDirectory());
    assertEquals(directory.getId(), spreadsheet.getDirectory().getId());
    assertEquals(
        directory.getFullyQualifiedName(), spreadsheet.getDirectory().getFullyQualifiedName());
  }

  @Test
  void put_spreadsheetUpdate_200() throws IOException {
    CreateSpreadsheet create = createRequest("updateSpreadsheet", "description", "owner", null);
    Spreadsheet spreadsheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Update description
    String oldDescription = spreadsheet.getDescription();
    String newDescription = "updated description";
    ChangeDescription change = getChangeDescription(spreadsheet, MINOR_UPDATE);
    fieldUpdated(change, "description", oldDescription, newDescription);

    spreadsheet.setDescription(newDescription);
    spreadsheet =
        updateAndCheckEntity(
            create.withDescription(newDescription), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(newDescription, spreadsheet.getDescription());

    // Update path
    String oldPath = spreadsheet.getPath();
    String newPath = "/new/path/to/spreadsheet";
    change = getChangeDescription(spreadsheet, MINOR_UPDATE);
    fieldUpdated(change, "path", oldPath, newPath);

    spreadsheet.setPath(newPath);
    spreadsheet =
        updateAndCheckEntity(
            create.withPath(newPath), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(newPath, spreadsheet.getPath());

    // Add file size
    Integer size = 1024000;
    change = getChangeDescription(spreadsheet, MINOR_UPDATE);
    fieldAdded(change, "size", size);

    spreadsheet.setSize(size);
    spreadsheet =
        updateAndCheckEntity(create.withSize(size), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(size, spreadsheet.getSize());
  }

  @Test
  void patch_spreadsheetAttributes_200() throws IOException {
    Spreadsheet spreadsheet = createEntity(createRequest("patchSpreadsheet"), ADMIN_AUTH_HEADERS);

    // Add description
    String originalJson = JsonUtils.pojoToJson(spreadsheet);
    String description = "patched description";
    spreadsheet.setDescription(description);
    ChangeDescription change = getChangeDescription(spreadsheet, MINOR_UPDATE);
    fieldAdded(change, "description", description);
    spreadsheet =
        patchEntityAndCheck(spreadsheet, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(description, spreadsheet.getDescription());

    // Add tags
    originalJson = JsonUtils.pojoToJson(spreadsheet);
    spreadsheet.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    change = getChangeDescription(spreadsheet, MINOR_UPDATE);
    fieldAdded(change, "tags", List.of(PERSONAL_DATA_TAG_LABEL));
    spreadsheet =
        patchEntityAndCheck(spreadsheet, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertNotNull(spreadsheet.getTags());
    assertEquals(1, spreadsheet.getTags().size());
    assertEquals(PERSONAL_DATA_TAG_LABEL.getTagFQN(), spreadsheet.getTags().getFirst().getTagFQN());

    // Add owner
    originalJson = JsonUtils.pojoToJson(spreadsheet);
    spreadsheet.setOwners(List.of(USER1_REF));
    change = getChangeDescription(spreadsheet, MINOR_UPDATE);
    fieldAdded(change, "owners", List.of(USER1_REF));
    spreadsheet =
        patchEntityAndCheck(spreadsheet, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertNotNull(spreadsheet.getOwners());
    assertEquals(1, spreadsheet.getOwners().size());
    assertEquals(USER1_REF.getId(), spreadsheet.getOwners().getFirst().getId());
  }

  @Test
  void test_spreadsheetWithWorksheets(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForWorksheets")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create spreadsheet
    CreateSpreadsheet createSpreadsheet =
        createRequest("salesData").withService(service.getFullyQualifiedName());
    Spreadsheet spreadsheet = createAndCheckEntity(createSpreadsheet, ADMIN_AUTH_HEADERS);

    // Create worksheets in the spreadsheet
    WorksheetResourceTest worksheetResourceTest = new WorksheetResourceTest();
    for (int i = 1; i <= 3; i++) {
      CreateWorksheet createWorksheet =
          worksheetResourceTest
              .createRequest("sheet" + i)
              .withSpreadsheet(spreadsheet.getFullyQualifiedName());
      Worksheet worksheet = worksheetResourceTest.createEntity(createWorksheet, ADMIN_AUTH_HEADERS);
      assertEquals(spreadsheet.getId(), worksheet.getSpreadsheet().getId());
    }

    // Get spreadsheet with worksheets field
    Spreadsheet spreadsheetWithWorksheets =
        getEntity(spreadsheet.getId(), "worksheets", ADMIN_AUTH_HEADERS);
    assertNotNull(spreadsheetWithWorksheets.getWorksheets());
    assertEquals(3, spreadsheetWithWorksheets.getWorksheets().size());

    // Verify worksheet references
    for (EntityReference worksheetRef : spreadsheetWithWorksheets.getWorksheets()) {
      assertNotNull(worksheetRef.getId());
      assertNotNull(worksheetRef.getName());
      assertTrue(worksheetRef.getName().startsWith("sheet"));
    }
  }

  @Test
  void test_listSpreadsheetsByService(TestInfo test) throws IOException {
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

    // Create spreadsheets for each service
    for (int i = 0; i < 3; i++) {
      createEntity(
          createRequest("spreadsheet_service1_" + i).withService(service1.getFullyQualifiedName()),
          ADMIN_AUTH_HEADERS);
      createEntity(
          createRequest("spreadsheet_service2_" + i).withService(service2.getFullyQualifiedName()),
          ADMIN_AUTH_HEADERS);
    }

    // List spreadsheets for service1
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service1.getFullyQualifiedName());
    ResultList<Spreadsheet> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, list.getData().size());
    assertTrue(
        list.getData().stream().allMatch(s -> s.getService().getId().equals(service1.getId())));

    // List spreadsheets for service2
    queryParams.put("service", service2.getFullyQualifiedName());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, list.getData().size());
    assertTrue(
        list.getData().stream().allMatch(s -> s.getService().getId().equals(service2.getId())));
  }

  @Test
  void test_spreadsheetFQNPatterns(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForSpreadsheetFQN")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Test 1: Spreadsheet directly under service
    CreateSpreadsheet createDirect =
        createRequest("directSheet").withService(service.getFullyQualifiedName());
    Spreadsheet directSpreadsheet = createAndCheckEntity(createDirect, ADMIN_AUTH_HEADERS);
    assertEquals(
        service.getFullyQualifiedName() + ".directSheet",
        directSpreadsheet.getFullyQualifiedName());
    assertNull(directSpreadsheet.getDirectory());

    // Test 2: Spreadsheet in nested directory
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createDir1 =
        directoryResourceTest.createRequest("finance").withService(service.getFullyQualifiedName());
    Directory dir1 = directoryResourceTest.createEntity(createDir1, ADMIN_AUTH_HEADERS);

    CreateDirectory createDir2 =
        directoryResourceTest
            .createRequest("2024")
            .withService(service.getFullyQualifiedName())
            .withParent(dir1.getFullyQualifiedName());
    Directory dir2 = directoryResourceTest.createEntity(createDir2, ADMIN_AUTH_HEADERS);

    CreateSpreadsheet createInDir =
        createRequest("budget")
            .withService(service.getFullyQualifiedName())
            .withParent(dir2.getEntityReference());
    Spreadsheet dirSpreadsheet = createAndCheckEntity(createInDir, ADMIN_AUTH_HEADERS);
    assertEquals(
        service.getFullyQualifiedName() + ".finance.2024.budget",
        dirSpreadsheet.getFullyQualifiedName());
    assertNotNull(dirSpreadsheet.getDirectory());
    assertEquals(dir2.getId(), dirSpreadsheet.getDirectory().getId());
  }

  @Test
  void test_spreadsheetsWithAndWithoutDirectory(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForMixedSpreadsheets")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create directory
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createDir =
        directoryResourceTest.createRequest("reports").withService(service.getFullyQualifiedName());
    Directory directory = directoryResourceTest.createEntity(createDir, ADMIN_AUTH_HEADERS);

    // Create spreadsheets directly under service
    for (int i = 0; i < 2; i++) {
      createEntity(
          createRequest("direct_spreadsheet_" + i).withService(service.getFullyQualifiedName()),
          ADMIN_AUTH_HEADERS);
    }

    // Create spreadsheets in directory
    for (int i = 0; i < 2; i++) {
      createEntity(
          createRequest("dir_spreadsheet_" + i)
              .withService(service.getFullyQualifiedName())
              .withParent(directory.getEntityReference()),
          ADMIN_AUTH_HEADERS);
    }

    // List all spreadsheets for the service
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    ResultList<Spreadsheet> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, list.getData().size());

    // Verify some have directory and some don't
    long withDirectory = list.getData().stream().filter(s -> s.getDirectory() != null).count();
    long withoutDirectory = list.getData().stream().filter(s -> s.getDirectory() == null).count();
    assertEquals(2, withDirectory);
    assertEquals(2, withoutDirectory);

    // List only spreadsheets in directory
    queryParams.clear();
    queryParams.put("directory", directory.getFullyQualifiedName());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, list.getData().size());
    assertTrue(list.getData().stream().allMatch(s -> s.getDirectory() != null));
  }

  @Test
  void test_listSpreadsheetsByDirectory(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForDirList")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create two directories
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createDir1 =
        directoryResourceTest.createRequest("reports").withService(service.getFullyQualifiedName());
    Directory dir1 = directoryResourceTest.createEntity(createDir1, ADMIN_AUTH_HEADERS);

    CreateDirectory createDir2 =
        directoryResourceTest
            .createRequest("analytics")
            .withService(service.getFullyQualifiedName());
    Directory dir2 = directoryResourceTest.createEntity(createDir2, ADMIN_AUTH_HEADERS);

    // Create spreadsheets in each directory
    for (int i = 0; i < 2; i++) {
      createEntity(
          createRequest("report_" + i)
              .withService(service.getFullyQualifiedName())
              .withParent(dir1.getEntityReference()),
          ADMIN_AUTH_HEADERS);
      createEntity(
          createRequest("analytics_" + i)
              .withService(service.getFullyQualifiedName())
              .withParent(dir2.getEntityReference()),
          ADMIN_AUTH_HEADERS);
    }

    // List spreadsheets by directory
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("directory", dir1.getFullyQualifiedName());
    ResultList<Spreadsheet> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, list.getData().size());
    assertTrue(
        list.getData().stream()
            .allMatch(
                s -> s.getDirectory() != null && s.getDirectory().getId().equals(dir1.getId())));

    // List spreadsheets for dir2
    queryParams.put("directory", dir2.getFullyQualifiedName());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, list.getData().size());
    assertTrue(
        list.getData().stream()
            .allMatch(
                s -> s.getDirectory() != null && s.getDirectory().getId().equals(dir2.getId())));
  }

  @Override
  public CreateSpreadsheet createRequest(String name) {
    return new CreateSpreadsheet()
        .withName(name)
        .withService(getContainer().getFullyQualifiedName())
        .withPath("/path/to/" + name);
  }

  @Override
  public void validateCreatedEntity(
      Spreadsheet createdEntity, CreateSpreadsheet request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getPath(), createdEntity.getPath());
    assertEquals(request.getService(), createdEntity.getService().getFullyQualifiedName());
    if (request.getParent() != null) {
      assertNotNull(createdEntity.getDirectory());
      assertEquals(request.getParent().getId(), createdEntity.getDirectory().getId());
    }
    TestUtils.validateTags(request.getTags(), createdEntity.getTags());
  }

  @Override
  public void compareEntities(
      Spreadsheet expected, Spreadsheet updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getService().getId(), updated.getService().getId());
    assertEquals(expected.getPath(), updated.getPath());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
  }

  @Override
  public Spreadsheet validateGetWithDifferentFields(Spreadsheet entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners(), entity.getTags());

    fields = "owners,tags,worksheets";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners(), entity.getTags());
    // worksheets field is tested separately in specific tests

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
    return DRIVE_SERVICE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Spreadsheet entity) {
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
