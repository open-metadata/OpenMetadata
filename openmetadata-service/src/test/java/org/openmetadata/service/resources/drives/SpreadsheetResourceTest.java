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
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DriveServiceResourceTest;
import org.openmetadata.service.services.drives.SpreadsheetService;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class SpreadsheetResourceTest extends EntityResourceTest<Spreadsheet, CreateSpreadsheet> {
  private static DriveService DRIVE_SERVICE;
  private static EntityReference DRIVE_SERVICE_REFERENCE;

  public SpreadsheetResourceTest() {
    super(
        Entity.SPREADSHEET,
        Spreadsheet.class,
        SpreadsheetService.SpreadsheetList.class,
        "drives/spreadsheets",
        SpreadsheetService.FIELDS);
    supportsSearchIndex = true;
  }

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    super.setup(test);
    setupDriveService(test);
  }

  public void setupDriveService(TestInfo test) throws HttpResponseException {
    // Use the global GOOGLE_DRIVE_SERVICE_REFERENCE if available
    if (GOOGLE_DRIVE_SERVICE_REFERENCE != null) {
      DRIVE_SERVICE_REFERENCE = GOOGLE_DRIVE_SERVICE_REFERENCE;
      return;
    }

    // Otherwise create local service (for standalone tests)
    if (DRIVE_SERVICE == null) {
      DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
      CreateDriveService createService =
          driveServiceResourceTest
              .createRequest(test)
              .withName("testDriveServiceSpreadsheet")
              .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive)
              .withConnection(getTestDriveConnection());
      DriveService service;
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
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param service must not be null]");
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
    CreateDirectory createDirectory =
        new CreateDirectory()
            .withName("financials")
            .withService(service.getFullyQualifiedName())
            .withPath("/path/to/financials");
    Directory directory =
        TestUtils.post(
            getResource("drives/directories"),
            createDirectory,
            Directory.class,
            ADMIN_AUTH_HEADERS);

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
    create.setDescription("updated description");
    spreadsheet = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals("updated description", spreadsheet.getDescription());

    // Update path
    create.setPath("/new/path/to/spreadsheet");
    spreadsheet = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals("/new/path/to/spreadsheet", spreadsheet.getPath());

    // Add file size
    create.setSize(1024000);
    spreadsheet = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals(Integer.valueOf(1024000), spreadsheet.getSize());
  }

  @Test
  void patch_spreadsheetAttributes_200() throws IOException {
    Spreadsheet spreadsheet = createEntity(createRequest("patchSpreadsheet"), ADMIN_AUTH_HEADERS);

    // Add description
    String originalJson = JsonUtils.pojoToJson(spreadsheet);
    String description = "patched description";
    spreadsheet.setDescription(description);
    spreadsheet = patchEntity(spreadsheet.getId(), originalJson, spreadsheet, ADMIN_AUTH_HEADERS);
    assertEquals(description, spreadsheet.getDescription());

    // Add tags
    originalJson = JsonUtils.pojoToJson(spreadsheet);
    spreadsheet.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    spreadsheet = patchEntity(spreadsheet.getId(), originalJson, spreadsheet, ADMIN_AUTH_HEADERS);
    assertNotNull(spreadsheet.getTags());
    assertEquals(1, spreadsheet.getTags().size());
    assertEquals(PERSONAL_DATA_TAG_LABEL.getTagFQN(), spreadsheet.getTags().getFirst().getTagFQN());

    // Add owner
    originalJson = JsonUtils.pojoToJson(spreadsheet);
    spreadsheet.setOwners(List.of(USER1_REF));
    spreadsheet = patchEntity(spreadsheet.getId(), originalJson, spreadsheet, ADMIN_AUTH_HEADERS);
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
    for (int i = 1; i <= 3; i++) {
      CreateWorksheet createWorksheet =
          new CreateWorksheet()
              .withName("sheet" + i)
              .withSpreadsheet(spreadsheet.getFullyQualifiedName())
              .withService(service.getFullyQualifiedName());
      Worksheet worksheet =
          TestUtils.post(
              getResource("drives/worksheets"),
              createWorksheet,
              Worksheet.class,
              ADMIN_AUTH_HEADERS);
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
    CreateDirectory createDir1 =
        new CreateDirectory()
            .withName("finance")
            .withService(service.getFullyQualifiedName())
            .withPath("/finance");
    Directory dir1 =
        TestUtils.post(
            getResource("drives/directories"), createDir1, Directory.class, ADMIN_AUTH_HEADERS);

    CreateDirectory createDir2 =
        new CreateDirectory()
            .withName("2024")
            .withService(service.getFullyQualifiedName())
            .withParent(dir1.getFullyQualifiedName())
            .withPath("/finance/2024");
    Directory dir2 =
        TestUtils.post(
            getResource("drives/directories"), createDir2, Directory.class, ADMIN_AUTH_HEADERS);

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
    CreateDirectory createDir =
        new CreateDirectory()
            .withName("reports")
            .withService(service.getFullyQualifiedName())
            .withPath("/reports");
    Directory directory =
        TestUtils.post(
            getResource("drives/directories"), createDir, Directory.class, ADMIN_AUTH_HEADERS);

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
    CreateDirectory createDir1 =
        new CreateDirectory()
            .withName("reports")
            .withService(service.getFullyQualifiedName())
            .withPath("/reports");
    Directory dir1 =
        TestUtils.post(
            getResource("drives/directories"), createDir1, Directory.class, ADMIN_AUTH_HEADERS);

    CreateDirectory createDir2 =
        new CreateDirectory()
            .withName("analytics")
            .withService(service.getFullyQualifiedName())
            .withPath("/analytics");
    Directory dir2 =
        TestUtils.post(
            getResource("drives/directories"), createDir2, Directory.class, ADMIN_AUTH_HEADERS);

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
    // When a spreadsheet is created directly under a service, the service should match
    // When it's created inside a directory, the service may be the directory's service
    if (request.getParent() == null) {
      // Direct under service - service should match exactly
      assertTrue(
          request.getService().equals(createdEntity.getService().getName())
              || request.getService().equals(createdEntity.getService().getFullyQualifiedName()),
          String.format(
              "Service mismatch: expected %s, got name=%s, fqn=%s",
              request.getService(),
              createdEntity.getService().getName(),
              createdEntity.getService().getFullyQualifiedName()));
    }
    // For spreadsheets in directories, the service validation is more complex
    // as the service might be inherited from the directory
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

    fields = "owners,tags,worksheets,followers";
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
    // Use the global GOOGLE_DRIVE_SERVICE_REFERENCE if available
    if (GOOGLE_DRIVE_SERVICE_REFERENCE != null) {
      return GOOGLE_DRIVE_SERVICE_REFERENCE;
    }
    // Fall back to local DRIVE_SERVICE_REFERENCE
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

  @Test
  void test_listSpreadsheetsWithRootParameter(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForSpreadsheetRootTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a directory at root level (no parent)
    CreateDirectory createDir =
        new CreateDirectory()
            .withName("sheetsDir")
            .withService(service.getFullyQualifiedName())
            .withPath("/sheets");
    Directory sheetsDir =
        TestUtils.post(
            getResource("drives/directories"), createDir, Directory.class, ADMIN_AUTH_HEADERS);

    // Create spreadsheets at root level (no parent directory)
    CreateSpreadsheet createRootSpreadsheet1 =
        createRequest("rootSpreadsheet1").withService(service.getFullyQualifiedName());
    Spreadsheet rootSpreadsheet1 = createAndCheckEntity(createRootSpreadsheet1, ADMIN_AUTH_HEADERS);

    CreateSpreadsheet createRootSpreadsheet2 =
        createRequest("rootSpreadsheet2").withService(service.getFullyQualifiedName());
    Spreadsheet rootSpreadsheet2 = createAndCheckEntity(createRootSpreadsheet2, ADMIN_AUTH_HEADERS);

    // Create spreadsheets in directory (have parent - NOT root)
    CreateSpreadsheet createChildSpreadsheet1 =
        createRequest("childSpreadsheet1")
            .withService(service.getFullyQualifiedName())
            .withParent(
                new EntityReference()
                    .withId(sheetsDir.getId())
                    .withType("directory")
                    .withFullyQualifiedName(sheetsDir.getFullyQualifiedName()));
    Spreadsheet childSpreadsheet1 =
        createAndCheckEntity(createChildSpreadsheet1, ADMIN_AUTH_HEADERS);

    CreateSpreadsheet createChildSpreadsheet2 =
        createRequest("childSpreadsheet2")
            .withService(service.getFullyQualifiedName())
            .withParent(
                new EntityReference()
                    .withId(sheetsDir.getId())
                    .withType("directory")
                    .withFullyQualifiedName(sheetsDir.getFullyQualifiedName()));
    Spreadsheet childSpreadsheet2 =
        createAndCheckEntity(createChildSpreadsheet2, ADMIN_AUTH_HEADERS);

    // Test 1: List all spreadsheets without root parameter
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    ResultList<Spreadsheet> allSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, allSpreadsheets.getData().size());

    // Test 2: List only root spreadsheets with root=true (spreadsheets with no parent)
    queryParams.put("root", "true");
    ResultList<Spreadsheet> rootSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, rootSpreadsheets.getData().size());

    // Verify only root spreadsheets are returned (those with no parent)
    for (Spreadsheet spreadsheet : rootSpreadsheets.getData()) {
      assertNull(spreadsheet.getDirectory());
      assertTrue(
          spreadsheet.getName().equals("rootSpreadsheet1")
              || spreadsheet.getName().equals("rootSpreadsheet2"));
    }

    // Test 3: List with root=false should return all spreadsheets
    queryParams.put("root", "false");
    ResultList<Spreadsheet> nonRootSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, nonRootSpreadsheets.getData().size());
  }

  @Test
  void test_listSpreadsheetsWithRootParameterAndPagination(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForSpreadsheetPaginationTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a directory for child spreadsheets
    CreateDirectory createDir =
        new CreateDirectory()
            .withName("spreadsheetsFolder")
            .withService(service.getFullyQualifiedName())
            .withPath("/spreadsheets");
    Directory folder =
        TestUtils.post(
            getResource("drives/directories"), createDir, Directory.class, ADMIN_AUTH_HEADERS);

    // Create multiple root spreadsheets for pagination testing
    List<Spreadsheet> rootSpreadsheets = new ArrayList<>();
    for (int i = 1; i <= 7; i++) {
      CreateSpreadsheet createRoot =
          createRequest("rootSpreadsheet" + i).withService(service.getFullyQualifiedName());
      rootSpreadsheets.add(createAndCheckEntity(createRoot, ADMIN_AUTH_HEADERS));
    }

    // Create spreadsheets in directory (not root) - these should not appear in root results
    for (int i = 1; i <= 3; i++) {
      CreateSpreadsheet createChild =
          createRequest("childSpreadsheet" + i)
              .withService(service.getFullyQualifiedName())
              .withParent(
                  new EntityReference()
                      .withId(folder.getId())
                      .withType("directory")
                      .withFullyQualifiedName(folder.getFullyQualifiedName()));
      createAndCheckEntity(createChild, ADMIN_AUTH_HEADERS);
    }

    // Test 1: Paginate through root spreadsheets with limit
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    queryParams.put("root", "true");
    queryParams.put("limit", "3");

    ResultList<Spreadsheet> firstPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, firstPage.getData().size());
    assertNotNull(firstPage.getPaging().getAfter());

    // Verify all returned spreadsheets are root level (no directory)
    for (Spreadsheet spreadsheet : firstPage.getData()) {
      assertNull(spreadsheet.getDirectory());
    }

    // Test 2: Get next page using after parameter
    queryParams.put("after", firstPage.getPaging().getAfter());
    ResultList<Spreadsheet> secondPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, secondPage.getData().size());

    // Verify second page spreadsheets are also root level
    for (Spreadsheet spreadsheet : secondPage.getData()) {
      assertNull(spreadsheet.getDirectory());
    }

    // Test 3: Get last page
    queryParams.put("after", secondPage.getPaging().getAfter());
    ResultList<Spreadsheet> lastPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(1, lastPage.getData().size());
    assertNull(lastPage.getData().get(0).getDirectory());

    // Test 4: Verify total count of root spreadsheets
    queryParams.remove("after");
    queryParams.remove("limit");
    ResultList<Spreadsheet> allRootSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(7, allRootSpreadsheets.getData().size());

    // Test 5: Verify pagination with different limit
    queryParams.put("limit", "5");
    ResultList<Spreadsheet> largePage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, largePage.getData().size());
    assertNotNull(largePage.getPaging().getAfter());

    queryParams.put("after", largePage.getPaging().getAfter());
    ResultList<Spreadsheet> remainingPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, remainingPage.getData().size());
  }

  @Test
  void test_listSpreadsheetsWithRootParameterEmptyResult(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForSpreadsheetEmptyTest")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create multiple directories
    List<Directory> directories = new ArrayList<>();
    for (int i = 1; i <= 2; i++) {
      CreateDirectory createDir =
          new CreateDirectory()
              .withName("folder" + i)
              .withService(service.getFullyQualifiedName())
              .withPath("/folder" + i);
      directories.add(
          TestUtils.post(
              getResource("drives/directories"), createDir, Directory.class, ADMIN_AUTH_HEADERS));
    }

    // Create only spreadsheets in directories (no root spreadsheets)
    for (Directory dir : directories) {
      for (int i = 1; i <= 2; i++) {
        CreateSpreadsheet createChild =
            createRequest(dir.getName() + "_spreadsheet" + i)
                .withService(service.getFullyQualifiedName())
                .withParent(
                    new EntityReference()
                        .withId(dir.getId())
                        .withType("directory")
                        .withFullyQualifiedName(dir.getFullyQualifiedName()));
        createAndCheckEntity(createChild, ADMIN_AUTH_HEADERS);
      }
    }

    // Test: List root spreadsheets should return empty result
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service.getFullyQualifiedName());
    queryParams.put("root", "true");

    ResultList<Spreadsheet> rootSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(0, rootSpreadsheets.getData().size());

    // Verify all spreadsheets are in directories
    queryParams.put("root", "false");
    ResultList<Spreadsheet> allSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, allSpreadsheets.getData().size());
    for (Spreadsheet spreadsheet : allSpreadsheets.getData()) {
      assertNotNull(spreadsheet.getDirectory());
      assertEquals("directory", spreadsheet.getDirectory().getType());
    }
  }

  @Test
  void test_listSpreadsheetsWithRootParameterAcrossMultipleServices(TestInfo test)
      throws IOException {
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();

    // Create first drive service (Google Sheets)
    CreateDriveService createService1 =
        driveServiceResourceTest
            .createRequest(test)
            .withName("googleSheetsService")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service1 =
        driveServiceResourceTest.createEntity(createService1, ADMIN_AUTH_HEADERS);

    // Create second drive service (Excel Online)
    CreateDriveService createService2 =
        driveServiceResourceTest
            .createRequest(test)
            .withName("excelOnlineService")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service2 =
        driveServiceResourceTest.createEntity(createService2, ADMIN_AUTH_HEADERS);

    // Create directory in first service
    CreateDirectory createGoogleDir =
        new CreateDirectory()
            .withName("googleSheetsFolder")
            .withService(service1.getFullyQualifiedName())
            .withPath("/sheets");
    Directory googleDir =
        TestUtils.post(
            getResource("drives/directories"),
            createGoogleDir,
            Directory.class,
            ADMIN_AUTH_HEADERS);

    // Create root spreadsheets in first service
    for (int i = 1; i <= 2; i++) {
      CreateSpreadsheet createGoogleRoot =
          createRequest("googleSheet" + i).withService(service1.getFullyQualifiedName());
      createAndCheckEntity(createGoogleRoot, ADMIN_AUTH_HEADERS);
    }

    // Create child spreadsheets in first service
    for (int i = 1; i <= 2; i++) {
      CreateSpreadsheet createGoogleChild =
          createRequest("googleChildSheet" + i)
              .withService(service1.getFullyQualifiedName())
              .withParent(
                  new EntityReference()
                      .withId(googleDir.getId())
                      .withType("directory")
                      .withFullyQualifiedName(googleDir.getFullyQualifiedName()));
      createAndCheckEntity(createGoogleChild, ADMIN_AUTH_HEADERS);
    }

    // Create directory in second service
    CreateDirectory createExcelDir =
        new CreateDirectory()
            .withName("excelFolder")
            .withService(service2.getFullyQualifiedName())
            .withPath("/excel");
    Directory excelDir =
        TestUtils.post(
            getResource("drives/directories"), createExcelDir, Directory.class, ADMIN_AUTH_HEADERS);

    // Create root spreadsheets in second service
    for (int i = 1; i <= 4; i++) {
      CreateSpreadsheet createExcelRoot =
          createRequest("excelWorkbook" + i).withService(service2.getFullyQualifiedName());
      createAndCheckEntity(createExcelRoot, ADMIN_AUTH_HEADERS);
    }

    // Create child spreadsheets in second service
    CreateSpreadsheet createExcelChild =
        createRequest("excelChildWorkbook")
            .withService(service2.getFullyQualifiedName())
            .withParent(
                new EntityReference()
                    .withId(excelDir.getId())
                    .withType("directory")
                    .withFullyQualifiedName(excelDir.getFullyQualifiedName()));
    createAndCheckEntity(createExcelChild, ADMIN_AUTH_HEADERS);

    // Test 1: List root spreadsheets for first service
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service1.getFullyQualifiedName());
    queryParams.put("root", "true");

    ResultList<Spreadsheet> googleRootSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, googleRootSpreadsheets.getData().size());
    for (Spreadsheet spreadsheet : googleRootSpreadsheets.getData()) {
      assertNull(spreadsheet.getDirectory());
      assertTrue(spreadsheet.getName().startsWith("googleSheet"));
    }

    // Test 2: List root spreadsheets for second service
    queryParams.put("service", service2.getFullyQualifiedName());
    ResultList<Spreadsheet> excelRootSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, excelRootSpreadsheets.getData().size());
    for (Spreadsheet spreadsheet : excelRootSpreadsheets.getData()) {
      assertNull(spreadsheet.getDirectory());
      assertTrue(spreadsheet.getName().startsWith("excelWorkbook"));
    }

    // Test 3: Verify total spreadsheets in first service
    queryParams.put("service", service1.getFullyQualifiedName());
    queryParams.put("root", "false");
    ResultList<Spreadsheet> allGoogleSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(4, allGoogleSpreadsheets.getData().size()); // 2 root + 2 child

    // Test 4: Verify total spreadsheets in second service
    queryParams.put("service", service2.getFullyQualifiedName());
    ResultList<Spreadsheet> allExcelSpreadsheets = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, allExcelSpreadsheets.getData().size()); // 4 root + 1 child

    // Test 5: Verify pagination with root parameter across services
    queryParams.put("service", service2.getFullyQualifiedName());
    queryParams.put("root", "true");
    queryParams.put("limit", "2");

    ResultList<Spreadsheet> firstServicePage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, firstServicePage.getData().size());
    assertNotNull(firstServicePage.getPaging().getAfter());

    queryParams.put("after", firstServicePage.getPaging().getAfter());
    ResultList<Spreadsheet> secondServicePage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, secondServicePage.getData().size());

    // Verify all are from the same service and are root level
    for (Spreadsheet spreadsheet : secondServicePage.getData()) {
      assertNull(spreadsheet.getDirectory());
      assertTrue(
          spreadsheet
              .getService()
              .getFullyQualifiedName()
              .equals(service2.getFullyQualifiedName()));
    }
  }

  @Test
  void testBulk_PreservesUserEditsOnUpdate(TestInfo test) throws IOException {
    CreateSpreadsheet botCreate =
        createRequest(test.getDisplayName())
            .withDescription("Bot initial description")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL));

    Spreadsheet entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);
    assertEquals("Bot initial description", entity.getDescription());
    assertEquals(1, entity.getTags().size());

    String originalJson = JsonUtils.pojoToJson(entity);
    String userDescription = "User-edited description - should be preserved";
    entity.setDescription(userDescription);
    entity.setTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    Spreadsheet userEditedEntity =
        patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals(userDescription, userEditedEntity.getDescription());
    assertEquals(2, userEditedEntity.getTags().size());

    CreateSpreadsheet botUpdate =
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

    Spreadsheet verifyEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

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
    CreateSpreadsheet botCreate =
        createRequest(test.getDisplayName()).withDescription("Bot initial description");

    Spreadsheet entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(entity);
    entity.setDescription("User description");
    Spreadsheet userEditedEntity =
        patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals("User description", userEditedEntity.getDescription());

    CreateSpreadsheet adminUpdate =
        createRequest(test.getDisplayName()).withDescription("Admin override description");

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult updateResult =
        TestUtils.put(
            bulkTarget, List.of(adminUpdate), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, updateResult.getStatus());

    Spreadsheet verifyEntity = getEntity(entity.getId(), ADMIN_AUTH_HEADERS);
    assertEquals("Admin override description", verifyEntity.getDescription());
  }
}
