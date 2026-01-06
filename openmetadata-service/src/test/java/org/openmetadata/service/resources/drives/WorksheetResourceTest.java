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
import static org.openmetadata.service.resources.EntityResourceTest.GOOGLE_DRIVE_SERVICE_REFERENCE;
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
import java.util.stream.Collectors;
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
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DriveServiceResourceTest;
import org.openmetadata.service.services.drives.WorksheetService;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class WorksheetResourceTest extends EntityResourceTest<Worksheet, CreateWorksheet> {
  private static Spreadsheet DEFAULT_SPREADSHEET;
  private static EntityReference DEFAULT_SPREADSHEET_REFERENCE;

  @Override
  public EntityReference getContainer() {
    return DEFAULT_SPREADSHEET_REFERENCE;
  }

  public WorksheetResourceTest() {
    super(
        Entity.WORKSHEET,
        Worksheet.class,
        WorksheetService.WorksheetList.class,
        "drives/worksheets",
        WorksheetService.FIELDS);
    supportsSearchIndex = true;
  }

  @Override
  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    setupSpreadsheet(test);
  }

  public void setupSpreadsheet(TestInfo test) throws HttpResponseException {
    if (DEFAULT_SPREADSHEET == null) {
      LOG.info("Setting up DEFAULT_SPREADSHEET for WorksheetResourceTest");

      // Use the global GOOGLE_DRIVE_SERVICE_REFERENCE
      if (GOOGLE_DRIVE_SERVICE_REFERENCE == null) {
        throw new IllegalStateException("GOOGLE_DRIVE_SERVICE_REFERENCE not initialized");
      }

      // Create default spreadsheet under the global drive service
      SpreadsheetResourceTest spreadsheetResourceTest = new SpreadsheetResourceTest();
      CreateSpreadsheet createSpreadsheet =
          spreadsheetResourceTest
              .createRequest(test)
              .withName("defaultTestSpreadsheet")
              .withService(GOOGLE_DRIVE_SERVICE_REFERENCE.getFullyQualifiedName());
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
      LOG.info(
          "DEFAULT_SPREADSHEET created: {} (id: {})",
          DEFAULT_SPREADSHEET.getFullyQualifiedName(),
          DEFAULT_SPREADSHEET.getId());
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
        "[query param spreadsheet must not be null]");
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
    create.setDescription("updated description");
    worksheet = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals("updated description", worksheet.getDescription());

    // Add columns
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("col1")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Column 1"));
    columns.add(
        new Column().withName("col2").withDataType(ColumnDataType.INT).withDescription("Column 2"));

    create.setColumns(columns);
    worksheet = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals(2, worksheet.getColumns().size());

    // Update columns - add a new column
    columns.add(
        new Column()
            .withName("col3")
            .withDataType(ColumnDataType.DECIMAL)
            .withDescription("Column 3"));

    create.setColumns(columns);
    worksheet = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals(3, worksheet.getColumns().size());

    // Update isHidden flag
    create.setIsHidden(true);
    worksheet = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    assertEquals(true, worksheet.getIsHidden());
  }

  @Test
  void patch_worksheetAttributes_200() throws IOException {
    Worksheet worksheet = createEntity(createRequest("patchWorksheet"), ADMIN_AUTH_HEADERS);

    // Add description
    String originalJson = JsonUtils.pojoToJson(worksheet);
    String description = "patched description";
    worksheet.setDescription(description);
    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
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
    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
    assertNotNull(worksheet.getColumns());
    assertEquals(1, worksheet.getColumns().size());
    assertEquals("newCol", worksheet.getColumns().getFirst().getName());
    assertEquals(ColumnDataType.STRING, worksheet.getColumns().getFirst().getDataType());
    assertEquals("New column", worksheet.getColumns().getFirst().getDescription());

    // Add tags
    originalJson = JsonUtils.pojoToJson(worksheet);
    worksheet.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
    assertNotNull(worksheet.getTags());
    assertEquals(1, worksheet.getTags().size());
    assertEquals(PERSONAL_DATA_TAG_LABEL.getTagFQN(), worksheet.getTags().getFirst().getTagFQN());

    // Add owner
    originalJson = JsonUtils.pojoToJson(worksheet);
    worksheet.setOwners(List.of(USER1_REF));
    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
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
    // Create directory directly with the correct service
    DirectoryResourceTest directoryResourceTest = new DirectoryResourceTest();
    CreateDirectory createDir =
        new CreateDirectory()
            .withName("analytics")
            .withService(service.getFullyQualifiedName())
            .withPath("/analytics");
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

  @Test
  void patch_worksheetColumnTagsAndDescription_200() throws IOException {
    // Create worksheet with columns
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("customer_id")
            .withDataType(ColumnDataType.INT)
            .withDescription("Customer identifier"));
    columns.add(
        new Column()
            .withName("customer_name")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Customer full name"));
    columns.add(
        new Column()
            .withName("email")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Customer email address"));
    columns.add(
        new Column()
            .withName("phone")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Contact phone number"));

    CreateWorksheet create = createRequest("customerData").withColumns(columns);
    Worksheet worksheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Test 1: Add tags to specific columns
    String originalJson = JsonUtils.pojoToJson(worksheet);
    worksheet.getColumns().get(0).setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    worksheet
        .getColumns()
        .get(1)
        .setTags(List.of(PERSONAL_DATA_TAG_LABEL, PII_SENSITIVE_TAG_LABEL));
    worksheet.getColumns().get(2).setTags(List.of(PII_SENSITIVE_TAG_LABEL));

    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);

    // Fetch the worksheet with columns,tags fields to get full column details including
    // column-level tags
    worksheet = getEntity(worksheet.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

    // Verify tags were added - column 0 should have 1 tag
    assertEquals(1, worksheet.getColumns().get(0).getTags().size());
    assertEquals(
        PERSONAL_DATA_TAG_LABEL.getTagFQN(),
        worksheet.getColumns().get(0).getTags().get(0).getTagFQN());

    // Column 1 should have 2 tags - check both are present regardless of order
    assertEquals(2, worksheet.getColumns().get(1).getTags().size());
    List<String> column1TagFQNs =
        worksheet.getColumns().get(1).getTags().stream()
            .map(TagLabel::getTagFQN)
            .collect(Collectors.toList());
    assertTrue(column1TagFQNs.contains(PERSONAL_DATA_TAG_LABEL.getTagFQN()));
    assertTrue(column1TagFQNs.contains(PII_SENSITIVE_TAG_LABEL.getTagFQN()));

    assertEquals(1, worksheet.getColumns().get(2).getTags().size());
    assertEquals(
        PII_SENSITIVE_TAG_LABEL.getTagFQN(),
        worksheet.getColumns().get(2).getTags().get(0).getTagFQN());

    // Test 2: Update column descriptions
    originalJson = JsonUtils.pojoToJson(worksheet);
    worksheet.getColumns().get(0).setDescription("Updated: Unique customer identifier");
    worksheet.getColumns().get(2).setDescription("Updated: Primary email for communication");

    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
    worksheet = getEntity(worksheet.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

    // Verify descriptions were updated
    assertEquals(
        "Updated: Unique customer identifier", worksheet.getColumns().get(0).getDescription());
    assertEquals("Customer full name", worksheet.getColumns().get(1).getDescription()); // Unchanged
    assertEquals(
        "Updated: Primary email for communication", worksheet.getColumns().get(2).getDescription());
    assertEquals(
        "Contact phone number", worksheet.getColumns().get(3).getDescription()); // Unchanged

    // Test 3: Remove tags from a column
    originalJson = JsonUtils.pojoToJson(worksheet);
    worksheet.getColumns().get(1).setTags(List.of(PERSONAL_DATA_TAG_LABEL)); // Remove PII_SENSITIVE
    worksheet.getColumns().get(2).setTags(new ArrayList<>()); // Remove all tags

    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
    worksheet = getEntity(worksheet.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

    // Verify tags were removed
    assertEquals(1, worksheet.getColumns().get(1).getTags().size());
    assertEquals(
        PERSONAL_DATA_TAG_LABEL.getTagFQN(),
        worksheet.getColumns().get(1).getTags().get(0).getTagFQN());
    assertTrue(
        worksheet.getColumns().get(2).getTags() == null
            || worksheet.getColumns().get(2).getTags().isEmpty());

    // Test 4: Simultaneous update of tags and description
    originalJson = JsonUtils.pojoToJson(worksheet);
    worksheet.getColumns().get(3).setDescription("Updated: Customer contact phone");
    worksheet
        .getColumns()
        .get(3)
        .setTags(List.of(PERSONAL_DATA_TAG_LABEL, PII_SENSITIVE_TAG_LABEL));

    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
    worksheet = getEntity(worksheet.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

    // Verify both updates
    assertEquals("Updated: Customer contact phone", worksheet.getColumns().get(3).getDescription());
    assertEquals(2, worksheet.getColumns().get(3).getTags().size());
    // Check both tags are present regardless of order
    List<String> column3TagFQNs =
        worksheet.getColumns().get(3).getTags().stream()
            .map(TagLabel::getTagFQN)
            .collect(Collectors.toList());
    assertTrue(column3TagFQNs.contains(PERSONAL_DATA_TAG_LABEL.getTagFQN()));
    assertTrue(column3TagFQNs.contains(PII_SENSITIVE_TAG_LABEL.getTagFQN()));
  }

  @Test
  void patch_worksheetAddRemoveColumns_200() throws IOException {
    // Create worksheet with initial columns
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("id")
            .withDataType(ColumnDataType.INT)
            .withDescription("Record ID")
            .withTags(List.of(PERSONAL_DATA_TAG_LABEL)));
    columns.add(
        new Column()
            .withName("name")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Full name")
            .withTags(List.of(PII_SENSITIVE_TAG_LABEL)));

    CreateWorksheet create = createRequest("columnPatchTest").withColumns(columns);
    Worksheet worksheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Verify initial setup has 2 columns
    assertEquals(2, worksheet.getColumns().size());
    assertEquals("id", worksheet.getColumns().get(0).getName());
    assertEquals("name", worksheet.getColumns().get(1).getName());

    // Test 1: Modify columns by patching with a new column added
    String originalJson = JsonUtils.pojoToJson(worksheet);
    List<Column> updatedColumns = new ArrayList<>();
    // Keep existing columns
    updatedColumns.add(worksheet.getColumns().get(0));
    updatedColumns.add(worksheet.getColumns().get(1));
    // Add new column
    updatedColumns.add(
        new Column()
            .withName("created_at")
            .withDataType(ColumnDataType.TIMESTAMP)
            .withDescription("Record creation timestamp")
            .withTags(List.of(TIER1_TAG_LABEL)));
    worksheet.setColumns(updatedColumns);

    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
    worksheet = getEntity(worksheet.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

    // Debug: Check what columns are actually present
    assertNotNull(worksheet.getColumns(), "Columns should not be null after patch");
    for (int i = 0; i < worksheet.getColumns().size(); i++) {
      Column col = worksheet.getColumns().get(i);
      System.out.println("Column " + i + ": " + col.getName() + " - " + col.getDataType());
    }

    // Verify new column was added
    assertEquals(3, worksheet.getColumns().size(), "Expected 3 columns after adding 'created_at'");
    Column addedColumn = worksheet.getColumns().get(2);
    assertEquals("created_at", addedColumn.getName());
    assertEquals(ColumnDataType.TIMESTAMP, addedColumn.getDataType());
    assertEquals("Record creation timestamp", addedColumn.getDescription());
    assertEquals(1, addedColumn.getTags().size());
    assertEquals(TIER1_TAG_LABEL.getTagFQN(), addedColumn.getTags().get(0).getTagFQN());

    // Test 2: Remove a column
    originalJson = JsonUtils.pojoToJson(worksheet);
    // Create a new list without the middle column
    List<Column> remainingColumns = new ArrayList<>();
    remainingColumns.add(worksheet.getColumns().get(0)); // Keep "id"
    remainingColumns.add(worksheet.getColumns().get(2)); // Keep "created_at"
    worksheet.setColumns(remainingColumns);

    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
    worksheet = getEntity(worksheet.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

    // Verify column was removed
    assertEquals(2, worksheet.getColumns().size());
    assertEquals("id", worksheet.getColumns().get(0).getName());
    assertEquals("created_at", worksheet.getColumns().get(1).getName());

    // Test 3: Replace all columns
    originalJson = JsonUtils.pojoToJson(worksheet);
    List<Column> newColumns = new ArrayList<>();
    newColumns.add(
        new Column()
            .withName("user_id")
            .withDataType(ColumnDataType.STRING)
            .withDescription("User identifier")
            .withTags(List.of(PERSONAL_DATA_TAG_LABEL)));
    newColumns.add(
        new Column()
            .withName("status")
            .withDataType(ColumnDataType.STRING)
            .withDescription("User status"));
    worksheet.setColumns(newColumns);

    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
    worksheet = getEntity(worksheet.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

    // Verify columns were replaced
    assertEquals(2, worksheet.getColumns().size());
    assertEquals("user_id", worksheet.getColumns().get(0).getName());
    assertEquals("status", worksheet.getColumns().get(1).getName());
    assertEquals(1, worksheet.getColumns().get(0).getTags().size());
    assertTrue(
        worksheet.getColumns().get(1).getTags() == null
            || worksheet.getColumns().get(1).getTags().isEmpty());
  }

  @Test
  void patch_worksheetComplexColumnOperations_200() throws IOException {
    // Create worksheet with complex column structure
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("order_id")
            .withDataType(ColumnDataType.INT)
            .withDescription("Order identifier"));
    columns.add(
        new Column()
            .withName("customer_email")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Customer email"));
    columns.add(
        new Column()
            .withName("order_date")
            .withDataType(ColumnDataType.DATE)
            .withDescription("Order date"));
    columns.add(
        new Column()
            .withName("total_amount")
            .withDataType(ColumnDataType.DECIMAL)
            .withDescription("Total order amount"));

    CreateWorksheet create = createRequest("ordersWorksheet").withColumns(columns);
    Worksheet worksheet = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Test: Complex patch with multiple operations
    String originalJson = JsonUtils.pojoToJson(worksheet);

    // 1. Add tags to multiple columns
    worksheet.getColumns().get(0).setTags(List.of(TIER1_TAG_LABEL));
    worksheet
        .getColumns()
        .get(1)
        .setTags(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    // 2. Update descriptions
    worksheet.getColumns().get(2).setDescription("Date when order was placed");
    worksheet.getColumns().get(3).setDescription("Total amount including taxes and shipping");

    // 3. Add new columns with tags and descriptions
    worksheet
        .getColumns()
        .add(
            new Column()
                .withName("shipping_address")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Customer shipping address")
                .withTags(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL)));
    worksheet
        .getColumns()
        .add(
            new Column()
                .withName("payment_method")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Payment method used")
                .withTags(List.of(PII_SENSITIVE_TAG_LABEL)));

    worksheet = patchEntity(worksheet.getId(), originalJson, worksheet, ADMIN_AUTH_HEADERS);
    worksheet = getEntity(worksheet.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

    // Verify all changes
    assertEquals(6, worksheet.getColumns().size());

    // Verify tags
    assertEquals(1, worksheet.getColumns().get(0).getTags().size());
    assertEquals(
        TIER1_TAG_LABEL.getTagFQN(), worksheet.getColumns().get(0).getTags().get(0).getTagFQN());

    assertEquals(2, worksheet.getColumns().get(1).getTags().size());

    // Verify updated descriptions
    assertEquals("Date when order was placed", worksheet.getColumns().get(2).getDescription());
    assertEquals(
        "Total amount including taxes and shipping",
        worksheet.getColumns().get(3).getDescription());

    // Verify new columns
    Column shippingColumn = worksheet.getColumns().get(4);
    assertEquals("shipping_address", shippingColumn.getName());
    assertEquals(2, shippingColumn.getTags().size());
    assertEquals("Customer shipping address", shippingColumn.getDescription());

    Column paymentColumn = worksheet.getColumns().get(5);
    assertEquals("payment_method", paymentColumn.getName());
    assertEquals(1, paymentColumn.getTags().size());
    assertEquals("Payment method used", paymentColumn.getDescription());
  }

  @Test
  void test_worksheetColumnFQN(TestInfo test) throws IOException {
    // Create drive service
    DriveServiceResourceTest driveServiceResourceTest = new DriveServiceResourceTest();
    CreateDriveService createService =
        driveServiceResourceTest
            .createRequest(test)
            .withName("driveForColumnFQN")
            .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);
    DriveService service = driveServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create spreadsheet
    SpreadsheetResourceTest spreadsheetResourceTest = new SpreadsheetResourceTest();
    CreateSpreadsheet createSpreadsheet =
        spreadsheetResourceTest
            .createRequest("testSpreadsheet")
            .withService(service.getFullyQualifiedName());
    Spreadsheet spreadsheet =
        spreadsheetResourceTest.createEntity(createSpreadsheet, ADMIN_AUTH_HEADERS);

    // Create worksheet with columns
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("employee_id")
            .withDataType(ColumnDataType.INT)
            .withDescription("Employee identifier"));
    columns.add(
        new Column()
            .withName("employee_name")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Employee name"));
    columns.add(
        new Column()
            .withName("department")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Department"));
    columns.add(
        new Column()
            .withName("base_salary")
            .withDataType(ColumnDataType.DECIMAL)
            .withDescription("Base salary"));

    CreateWorksheet create =
        createRequest("salaries")
            .withSpreadsheet(spreadsheet.getFullyQualifiedName())
            .withColumns(columns);

    // Create and retrieve the worksheet with columns field
    Worksheet worksheet = createEntity(create, ADMIN_AUTH_HEADERS);
    worksheet = getEntity(worksheet.getId(), "columns", ADMIN_AUTH_HEADERS);

    // Validate worksheet FQN
    String expectedWorksheetFQN = spreadsheet.getFullyQualifiedName() + ".salaries";
    assertEquals(expectedWorksheetFQN, worksheet.getFullyQualifiedName());

    // Validate column FQNs
    assertNotNull(worksheet.getColumns());
    assertEquals(4, worksheet.getColumns().size());

    // Check that each column has the correct FQN
    for (Column column : worksheet.getColumns()) {
      assertNotNull(
          column.getFullyQualifiedName(),
          "Column " + column.getName() + " should have a fullyQualifiedName");
      String expectedColumnFQN = worksheet.getFullyQualifiedName() + "." + column.getName();
      assertEquals(
          expectedColumnFQN,
          column.getFullyQualifiedName(),
          "Column FQN should be worksheet.FQN + column.name");
    }

    // Verify specific column FQNs
    assertEquals(
        expectedWorksheetFQN + ".employee_id",
        worksheet.getColumns().get(0).getFullyQualifiedName());
    assertEquals(
        expectedWorksheetFQN + ".employee_name",
        worksheet.getColumns().get(1).getFullyQualifiedName());
    assertEquals(
        expectedWorksheetFQN + ".department",
        worksheet.getColumns().get(2).getFullyQualifiedName());
    assertEquals(
        expectedWorksheetFQN + ".base_salary",
        worksheet.getColumns().get(3).getFullyQualifiedName());
  }

  @Override
  public CreateWorksheet createRequest(String name) {
    if (DEFAULT_SPREADSHEET == null) {
      // This should not happen as setup() is called before tests
      throw new IllegalStateException(
          "DEFAULT_SPREADSHEET not initialized. Call setupDefaultSpreadsheet() first.");
    }
    return new CreateWorksheet()
        .withName(name)
        .withSpreadsheet(DEFAULT_SPREADSHEET.getFullyQualifiedName());
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

    fields = "owners,tags,columns,followers";
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
  public EntityReference getContainer(Worksheet entity) {
    return entity.getSpreadsheet();
  }

  @Test
  void testBulk_PreservesUserEditsOnUpdate(TestInfo test) throws IOException {
    CreateWorksheet botCreate =
        createRequest(test.getDisplayName())
            .withDescription("Bot initial description")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL));

    Worksheet entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);
    assertEquals("Bot initial description", entity.getDescription());
    assertEquals(1, entity.getTags().size());

    String originalJson = JsonUtils.pojoToJson(entity);
    String userDescription = "User-edited description - should be preserved";
    entity.setDescription(userDescription);
    entity.setTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    Worksheet userEditedEntity =
        patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals(userDescription, userEditedEntity.getDescription());
    assertEquals(2, userEditedEntity.getTags().size());

    CreateWorksheet botUpdate =
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

    Worksheet verifyEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

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
    CreateWorksheet botCreate =
        createRequest(test.getDisplayName()).withDescription("Bot initial description");

    Worksheet entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);

    String originalJson = JsonUtils.pojoToJson(entity);
    entity.setDescription("User description");
    Worksheet userEditedEntity =
        patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals("User description", userEditedEntity.getDescription());

    CreateWorksheet adminUpdate =
        createRequest(test.getDisplayName()).withDescription("Admin override description");

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult updateResult =
        TestUtils.put(
            bulkTarget, List.of(adminUpdate), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, updateResult.getStatus());

    Worksheet verifyEntity = getEntity(entity.getId(), ADMIN_AUTH_HEADERS);
    assertEquals("Admin override description", verifyEntity.getDescription());
  }
}
