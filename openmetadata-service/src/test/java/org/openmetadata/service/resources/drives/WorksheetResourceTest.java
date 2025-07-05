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
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

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
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DriveServiceResourceTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class WorksheetResourceTest extends EntityResourceTest<Worksheet, CreateWorksheet> {
  private static Spreadsheet DEFAULT_SPREADSHEET;
  private static EntityReference DEFAULT_SPREADSHEET_REFERENCE;

  public WorksheetResourceTest() {
    super(
        Entity.WORKSHEET,
        Worksheet.class,
        WorksheetResource.WorksheetList.class,
        "drives/worksheets",
        WorksheetResource.FIELDS);
    supportsSearchIndex = true;
  }

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    super.setup(test);
    setupDefaultSpreadsheet(test);
  }

  public void setupDefaultSpreadsheet(TestInfo test) throws HttpResponseException {
    if (DEFAULT_SPREADSHEET == null) {
      // Create drive service
      DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
      CreateDriveService createService =
          driveServiceResourceTest
              .createRequest(test)
              .withName("testDriveServiceWorksheet")
              .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive)
              .withConnection(getTestDriveConnection());
      DriveService service;
      try {
        service =
            driveServiceResourceTest.getEntityByName(createService.getName(), ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Service doesn't exist, create it
        service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);
      }

      // Create default spreadsheet
      SpreadsheetResourceTest spreadsheetResourceTest = new SpreadsheetResourceTest();
      spreadsheetResourceTest.setupDriveService(test); // Make sure its drive service is set up
      CreateSpreadsheet createSpreadsheet =
          spreadsheetResourceTest
              .createRequest(test)
              .withName("defaultTestSpreadsheet")
              .withService(service.getFullyQualifiedName());
      try {
        DEFAULT_SPREADSHEET =
            spreadsheetResourceTest.getEntityByName(
                createSpreadsheet.getName(), ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Spreadsheet doesn't exist, create it
        DEFAULT_SPREADSHEET =
            spreadsheetResourceTest.createEntity(createSpreadsheet, ADMIN_AUTH_HEADERS);
      }
      DEFAULT_SPREADSHEET_REFERENCE = DEFAULT_SPREADSHEET.getEntityReference();
    }
  }

  @Test
  void post_worksheetCreateWithInvalidSpreadsheet_400() {
    // Create worksheet with non-existent spreadsheet
    CreateWorksheet create = createRequest("worksheet1");
    create.withSpreadsheet("non-existent-spreadsheet");
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "spreadsheet instance for non-existent-spreadsheet not found");
  }

  @Test
  void post_worksheetCreateWithoutRequiredFields_400() {
    // Create worksheet without required spreadsheet field
    CreateWorksheet create = createRequest("worksheet1").withSpreadsheet(null);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[spreadsheet must not be null]");
  }

  @Test
  void post_validWorksheets_200_OK(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("googleDrive")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create spreadsheet
    SpreadsheetResourceTest spreadsheetResourceTest = new SpreadsheetResourceTest();
    CreateSpreadsheet createSpreadsheet =
        spreadsheetResourceTest
            .createRequest("salesReport")
            .withService(service.getFullyQualifiedName());
    Spreadsheet spreadsheet =
        spreadsheetResourceTest.createEntity(createSpreadsheet, ADMIN_AUTH_HEADERS);

    // Create worksheet with columns
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("id")
            .withDataType(ColumnDataType.INT)
            .withDescription("Unique identifier"));
    columns.add(
        new Column()
            .withName("name")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Product name"));
    columns.add(
        new Column()
            .withName("price")
            .withDataType(ColumnDataType.DECIMAL)
            .withDescription("Product price"));

    CreateWorksheet create =
        createRequest("products")
            .withSpreadsheet(spreadsheet.getFullyQualifiedName())
            .withColumns(columns);
    Worksheet worksheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Validate spreadsheet relationship
    assertEquals(spreadsheet.getId(), worksheet.getSpreadsheet().getId());
    assertEquals(
        spreadsheet.getFullyQualifiedName(), worksheet.getSpreadsheet().getFullyQualifiedName());

    // Validate columns
    assertNotNull(worksheet.getColumns());
    assertEquals(3, worksheet.getColumns().size());
    assertEquals("id", worksheet.getColumns().getFirst().getName());
    assertEquals(ColumnDataType.INT, worksheet.getColumns().getFirst().getDataType());
  }

  @Test
  void put_worksheetUpdate_200() throws IOException {
    CreateWorksheet create = createRequest("updateWorksheet", "description", "owner", null);
    Worksheet worksheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Update description
    String oldDescription = worksheet.getDescription();
    String newDescription = "updated description";
    ChangeDescription change = getChangeDescription(worksheet, MINOR_UPDATE);
    fieldUpdated(change, "description", oldDescription, newDescription);

    worksheet.setDescription(newDescription);
    worksheet =
        updateAndCheckEntity(
            create.withDescription(newDescription), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(newDescription, worksheet.getDescription());

    // Add columns
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("col1")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Column 1"));
    columns.add(
        new Column().withName("col2").withDataType(ColumnDataType.INT).withDescription("Column 2"));

    change = getChangeDescription(worksheet, MINOR_UPDATE);
    fieldAdded(change, "columns", columns);

    worksheet.setColumns(columns);
    worksheet =
        updateAndCheckEntity(
            create.withColumns(columns), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(2, worksheet.getColumns().size());

    // Update columns - add a new column
    columns.add(
        new Column()
            .withName("col3")
            .withDataType(ColumnDataType.DECIMAL)
            .withDescription("Column 3"));

    change = getChangeDescription(worksheet, MINOR_UPDATE);
    fieldUpdated(change, "columns", worksheet.getColumns(), columns);

    worksheet.setColumns(columns);
    worksheet =
        updateAndCheckEntity(
            create.withColumns(columns), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(3, worksheet.getColumns().size());

    // Update isHidden flag
    Boolean isHidden = true;
    change = getChangeDescription(worksheet, MINOR_UPDATE);
    fieldAdded(change, "isHidden", isHidden);

    worksheet.setIsHidden(isHidden);
    worksheet =
        updateAndCheckEntity(
            create.withIsHidden(isHidden), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(isHidden, worksheet.getIsHidden());
  }

  @Test
  void patch_worksheetAttributes_200() throws IOException {
    Worksheet worksheet = createEntity(createRequest("patchWorksheet"), ADMIN_AUTH_HEADERS);

    // Add description
    String originalJson = JsonUtils.pojoToJson(worksheet);
    String description = "patched description";
    worksheet.setDescription(description);
    ChangeDescription change = getChangeDescription(worksheet, MINOR_UPDATE);
    fieldAdded(change, "description", description);
    worksheet =
        patchEntityAndCheck(worksheet, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(description, worksheet.getDescription());

    // Add columns
    originalJson = JsonUtils.pojoToJson(worksheet);
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("newCol")
            .withDataType(ColumnDataType.STRING)
            .withDescription("New column"));
    worksheet.setColumns(columns);
    change = getChangeDescription(worksheet, MINOR_UPDATE);
    fieldAdded(change, "columns", columns);
    worksheet =
        patchEntityAndCheck(worksheet, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertNotNull(worksheet.getColumns());
    assertEquals(1, worksheet.getColumns().size());
    assertEquals("newCol", worksheet.getColumns().getFirst().getName());
    assertEquals(ColumnDataType.STRING, worksheet.getColumns().getFirst().getDataType());
    assertEquals("New column", worksheet.getColumns().getFirst().getDescription());

    // Add tags
    originalJson = JsonUtils.pojoToJson(worksheet);
    worksheet.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    change = getChangeDescription(worksheet, MINOR_UPDATE);
    fieldAdded(change, "tags", List.of(PERSONAL_DATA_TAG_LABEL));
    worksheet =
        patchEntityAndCheck(worksheet, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertNotNull(worksheet.getTags());
    assertEquals(1, worksheet.getTags().size());
    assertEquals(PERSONAL_DATA_TAG_LABEL.getTagFQN(), worksheet.getTags().getFirst().getTagFQN());

    // Add owner
    originalJson = JsonUtils.pojoToJson(worksheet);
    worksheet.setOwners(List.of(USER1_REF));
    change = getChangeDescription(worksheet, MINOR_UPDATE);
    fieldAdded(change, "owners", List.of(USER1_REF));
    worksheet =
        patchEntityAndCheck(worksheet, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertNotNull(worksheet.getOwners());
    assertEquals(1, worksheet.getOwners().size());
    assertEquals(USER1_REF.getId(), worksheet.getOwners().getFirst().getId());
  }

  @Test
  void test_worksheetWithComplexColumns(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForComplexColumns")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create spreadsheet
    SpreadsheetResourceTest spreadsheetResourceTest = new SpreadsheetResourceTest();
    CreateSpreadsheet createSpreadsheet =
        spreadsheetResourceTest
            .createRequest("complexData")
            .withService(service.getFullyQualifiedName());
    Spreadsheet spreadsheet =
        spreadsheetResourceTest.createEntity(createSpreadsheet, ADMIN_AUTH_HEADERS);

    // Create worksheet with various column types
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("intColumn")
            .withDataType(ColumnDataType.INT)
            .withDescription("Integer column"));
    columns.add(
        new Column()
            .withName("stringColumn")
            .withDataType(ColumnDataType.STRING)
            .withDescription("String column"));
    columns.add(
        new Column()
            .withName("decimalColumn")
            .withDataType(ColumnDataType.DECIMAL)
            .withDescription("Decimal column"));
    columns.add(
        new Column()
            .withName("booleanColumn")
            .withDataType(ColumnDataType.BOOLEAN)
            .withDescription("Boolean column"));
    columns.add(
        new Column()
            .withName("dateColumn")
            .withDataType(ColumnDataType.DATE)
            .withDescription("Date column"));
    columns.add(
        new Column()
            .withName("timestampColumn")
            .withDataType(ColumnDataType.TIMESTAMP)
            .withDescription("Timestamp column"));

    CreateWorksheet create =
        createRequest("complexSheet")
            .withSpreadsheet(spreadsheet.getFullyQualifiedName())
            .withColumns(columns);
    Worksheet worksheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Validate all columns
    assertNotNull(worksheet.getColumns());
    assertEquals(6, worksheet.getColumns().size());
    assertEquals(ColumnDataType.INT, worksheet.getColumns().get(0).getDataType());
    assertEquals(ColumnDataType.STRING, worksheet.getColumns().get(1).getDataType());
    assertEquals(ColumnDataType.DECIMAL, worksheet.getColumns().get(2).getDataType());
    assertEquals(ColumnDataType.BOOLEAN, worksheet.getColumns().get(3).getDataType());
    assertEquals(ColumnDataType.DATE, worksheet.getColumns().get(4).getDataType());
    assertEquals(ColumnDataType.TIMESTAMP, worksheet.getColumns().get(5).getDataType());
  }

  @Test
  void test_listWorksheetsBySpreadsheet(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForList")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create two spreadsheets
    SpreadsheetResourceTest spreadsheetResourceTest = new SpreadsheetResourceTest();
    CreateSpreadsheet createSpreadsheet1 =
        spreadsheetResourceTest
            .createRequest("spreadsheet1")
            .withService(service.getFullyQualifiedName());
    Spreadsheet spreadsheet1 =
        spreadsheetResourceTest.createEntity(createSpreadsheet1, ADMIN_AUTH_HEADERS);

    CreateSpreadsheet createSpreadsheet2 =
        spreadsheetResourceTest
            .createRequest("spreadsheet2")
            .withService(service.getFullyQualifiedName());
    Spreadsheet spreadsheet2 =
        spreadsheetResourceTest.createEntity(createSpreadsheet2, ADMIN_AUTH_HEADERS);

    // Create worksheets in each spreadsheet
    for (int i = 0; i < 3; i++) {
      createEntity(
          createRequest("sheet1_" + i).withSpreadsheet(spreadsheet1.getFullyQualifiedName()),
          ADMIN_AUTH_HEADERS);
      createEntity(
          createRequest("sheet2_" + i).withSpreadsheet(spreadsheet2.getFullyQualifiedName()),
          ADMIN_AUTH_HEADERS);
    }

    // List worksheets for spreadsheet1
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("spreadsheet", spreadsheet1.getFullyQualifiedName());
    ResultList<Worksheet> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, list.getData().size());
    assertTrue(
        list.getData().stream()
            .allMatch(w -> w.getSpreadsheet().getId().equals(spreadsheet1.getId())));

    // List worksheets for spreadsheet2
    queryParams.put("spreadsheet", spreadsheet2.getFullyQualifiedName());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, list.getData().size());
    assertTrue(
        list.getData().stream()
            .allMatch(w -> w.getSpreadsheet().getId().equals(spreadsheet2.getId())));
  }

  @Test
  void test_worksheetFQNPatterns(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForWorksheetFQN")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Test 1: Worksheet in spreadsheet directly under service
    SpreadsheetResourceTest spreadsheetResourceTest = new SpreadsheetResourceTest();
    CreateSpreadsheet createDirectSpreadsheet =
        spreadsheetResourceTest
            .createRequest("directWorkbook")
            .withService(service.getFullyQualifiedName());
    Spreadsheet directSpreadsheet =
        spreadsheetResourceTest.createEntity(createDirectSpreadsheet, ADMIN_AUTH_HEADERS);

    CreateWorksheet create1 =
        createRequest("Sheet1").withSpreadsheet(directSpreadsheet.getFullyQualifiedName());
    Worksheet worksheet1 = createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);
    assertEquals(
        directSpreadsheet.getFullyQualifiedName() + ".Sheet1", worksheet1.getFullyQualifiedName());
    assertEquals(
        service.getFullyQualifiedName() + ".directWorkbook.Sheet1",
        worksheet1.getFullyQualifiedName());

    // Test 2: Worksheet in spreadsheet within nested directory
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createDir =
        directoryResourceTest
            .createRequest("analytics")
            .withService(service.getFullyQualifiedName());
    Directory directory = directoryResourceTest.createEntity(createDir, ADMIN_AUTH_HEADERS);

    CreateSpreadsheet createDirSpreadsheet =
        spreadsheetResourceTest
            .createRequest("metrics")
            .withService(service.getFullyQualifiedName())
            .withParent(directory.getEntityReference());
    Spreadsheet dirSpreadsheet =
        spreadsheetResourceTest.createEntity(createDirSpreadsheet, ADMIN_AUTH_HEADERS);

    CreateWorksheet create2 =
        createRequest("KPIs").withSpreadsheet(dirSpreadsheet.getFullyQualifiedName());
    Worksheet worksheet2 = createAndCheckEntity(create2, ADMIN_AUTH_HEADERS);
    assertEquals(
        dirSpreadsheet.getFullyQualifiedName() + ".KPIs", worksheet2.getFullyQualifiedName());
    assertEquals(
        service.getFullyQualifiedName() + ".analytics.metrics.KPIs",
        worksheet2.getFullyQualifiedName());
  }

  @Test
  void test_columnOperations() throws IOException {
    CreateWorksheet create = createRequest("columnOpsWorksheet");
    Worksheet worksheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("col1")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Column 1"));
    columns.add(
        new Column().withName("col2").withDataType(ColumnDataType.INT).withDescription("Column 2"));

    worksheet = updateEntity(create.withColumns(columns), OK, ADMIN_AUTH_HEADERS);
    assertEquals(2, worksheet.getColumns().size());

    // Add tags to a column
    Column col1WithTag =
        new Column()
            .withName("col1")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Column 1")
            .withTags(List.of(PERSONAL_DATA_TAG_LABEL));
    columns.set(0, col1WithTag);

    worksheet = updateEntity(create.withColumns(columns), OK, ADMIN_AUTH_HEADERS);
    assertEquals(1, worksheet.getColumns().getFirst().getTags().size());
    assertEquals(
        PERSONAL_DATA_TAG_LABEL.getTagFQN(),
        worksheet.getColumns().getFirst().getTags().getFirst().getTagFQN());

    // Remove a column
    columns.remove(1);
    worksheet = updateEntity(create.withColumns(columns), OK, ADMIN_AUTH_HEADERS);
    assertEquals(1, worksheet.getColumns().size());
    assertEquals("col1", worksheet.getColumns().getFirst().getName());
  }

  @Override
  public CreateWorksheet createRequest(String name) {
    return new CreateWorksheet()
        .withName(name)
        .withSpreadsheet(getContainer().getFullyQualifiedName());
  }

  @Override
  public void validateCreatedEntity(
      Worksheet createdEntity, CreateWorksheet request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getSpreadsheet(), createdEntity.getSpreadsheet().getFullyQualifiedName());
    if (request.getColumns() != null) {
      assertEquals(request.getColumns().size(), createdEntity.getColumns().size());
      for (int i = 0; i < request.getColumns().size(); i++) {
        assertEquals(
            request.getColumns().get(i).getName(), createdEntity.getColumns().get(i).getName());
        assertEquals(
            request.getColumns().get(i).getDataType(),
            createdEntity.getColumns().get(i).getDataType());
      }
    }
    TestUtils.validateTags(request.getTags(), createdEntity.getTags());
  }

  @Override
  public void compareEntities(
      Worksheet expected, Worksheet updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getSpreadsheet().getId(), updated.getSpreadsheet().getId());
    if (expected.getColumns() != null && updated.getColumns() != null) {
      assertEquals(expected.getColumns().size(), updated.getColumns().size());
    }
    TestUtils.validateTags(expected.getTags(), updated.getTags());
  }

  @Override
  public Worksheet validateGetWithDifferentFields(Worksheet entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners(), entity.getTags());

    fields = "owners,tags,columns";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners(), entity.getTags());
    // columns are always included

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
    return DEFAULT_SPREADSHEET_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Worksheet entity) {
    return entity.getSpreadsheet();
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
