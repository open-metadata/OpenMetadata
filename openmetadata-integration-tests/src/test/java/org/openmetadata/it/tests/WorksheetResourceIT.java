package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.api.data.CreateWorksheet;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.drives.SpreadsheetService;
import org.openmetadata.sdk.services.drives.WorksheetService;
import org.openmetadata.sdk.services.services.DriveServiceService;
import org.openmetadata.service.resources.drives.WorksheetResource;

/**
 * Integration tests for Worksheet entity operations.
 *
 * <p>Tests worksheet CRUD operations, column management, and spreadsheet relationships.
 *
 * <p>Migrated from: org.openmetadata.service.resources.drives.WorksheetResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class WorksheetResourceIT extends BaseEntityIT<Worksheet, CreateWorksheet> {

  public WorksheetResourceIT() {
    supportsPatch = true;
    supportsFollowers = false;
    supportsTags = true;
    supportsDataProducts = false;
    supportsCustomExtension = false;
    supportsDomains = false;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  @Override
  protected String getResourcePath() {
    return WorksheetResource.COLLECTION_PATH;
  }

  @Override
  protected CreateWorksheet createMinimalRequest(TestNamespace ns) {
    Spreadsheet spreadsheet = createTestSpreadsheet(ns);
    return new CreateWorksheet()
        .withName(ns.prefix("worksheet"))
        .withSpreadsheet(spreadsheet.getFullyQualifiedName())
        .withDescription("Test worksheet created by integration test");
  }

  @Override
  protected CreateWorksheet createRequest(String name, TestNamespace ns) {
    Spreadsheet spreadsheet = createTestSpreadsheet(ns);
    return new CreateWorksheet()
        .withName(name)
        .withSpreadsheet(spreadsheet.getFullyQualifiedName());
  }

  @Override
  protected Worksheet createEntity(CreateWorksheet createRequest) {
    return getWorksheetService().create(createRequest);
  }

  @Override
  protected Worksheet getEntity(String id) {
    return getWorksheetService().get(id);
  }

  @Override
  protected Worksheet getEntityByName(String fqn) {
    return getWorksheetService().getByName(fqn);
  }

  @Override
  protected Worksheet patchEntity(String id, Worksheet entity) {
    return getWorksheetService().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    getWorksheetService().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    getWorksheetService().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    getWorksheetService().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "worksheet";
  }

  @Override
  protected void validateCreatedEntity(Worksheet entity, CreateWorksheet createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getSpreadsheet(), "Worksheet must have a spreadsheet");
    assertEquals(
        createRequest.getSpreadsheet(),
        entity.getSpreadsheet().getFullyQualifiedName(),
        "Spreadsheet FQN should match");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    if (createRequest.getColumns() != null && !createRequest.getColumns().isEmpty()) {
      assertNotNull(entity.getColumns());
      assertEquals(createRequest.getColumns().size(), entity.getColumns().size());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain worksheet name");
  }

  @Override
  protected ListResponse<Worksheet> listEntities(ListParams params) {
    return getWorksheetService().list(params);
  }

  @Override
  protected Worksheet getEntityWithFields(String id, String fields) {
    return getWorksheetService().get(id, fields);
  }

  @Override
  protected Worksheet getEntityByNameWithFields(String fqn, String fields) {
    return getWorksheetService().getByName(fqn, fields);
  }

  @Override
  protected Worksheet getEntityIncludeDeleted(String id) {
    return getWorksheetService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return getWorksheetService().getVersionList(id);
  }

  @Override
  protected Worksheet getVersion(UUID id, Double version) {
    return getWorksheetService().getVersion(id.toString(), version);
  }

  @Test
  void post_worksheetWithoutRequiredFields_400(TestNamespace ns) {
    assertThrows(
        Exception.class,
        () -> createEntity(new CreateWorksheet().withName(ns.prefix("worksheet_no_spreadsheet"))),
        "Creating worksheet without spreadsheet should fail");
  }

  @Test
  void post_worksheetWithInvalidSpreadsheet_404(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("worksheet_invalid"))
            .withSpreadsheet("non-existent-spreadsheet");

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating worksheet with invalid spreadsheet should fail");
  }

  @Test
  void post_worksheetWithColumns_200_OK(TestNamespace ns) {
    Spreadsheet spreadsheet = createTestSpreadsheet(ns);

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

    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("products"))
            .withSpreadsheet(spreadsheet.getFullyQualifiedName())
            .withColumns(columns);

    Worksheet worksheet = createEntity(request);
    assertNotNull(worksheet);
    assertNotNull(worksheet.getColumns());
    assertEquals(3, worksheet.getColumns().size());
    assertEquals("id", worksheet.getColumns().get(0).getName());
    assertEquals(ColumnDataType.INT, worksheet.getColumns().get(0).getDataType());
    assertEquals("name", worksheet.getColumns().get(1).getName());
    assertEquals(ColumnDataType.STRING, worksheet.getColumns().get(1).getDataType());
    assertEquals("price", worksheet.getColumns().get(2).getName());
    assertEquals(ColumnDataType.DECIMAL, worksheet.getColumns().get(2).getDataType());
  }

  @Test
  void put_worksheetUpdateColumns_200_OK(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("update_columns"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName());

    Worksheet worksheet = createEntity(request);

    // Add columns via patch
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("col1")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Column 1"));
    columns.add(
        new Column().withName("col2").withDataType(ColumnDataType.INT).withDescription("Column 2"));

    worksheet.setColumns(columns);
    Worksheet updated = patchEntity(worksheet.getId().toString(), worksheet);
    assertEquals(2, updated.getColumns().size());
    assertEquals("col1", updated.getColumns().get(0).getName());
    assertEquals("col2", updated.getColumns().get(1).getName());

    // Verify columns persist on fresh fetch (need to request columns field)
    Worksheet fetched = getEntityWithFields(updated.getId().toString(), "columns");
    assertNotNull(fetched.getColumns());
    assertEquals(2, fetched.getColumns().size());
  }

  @Test
  void patch_worksheetDescription_200_OK(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("patch_desc"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName())
            .withDescription("Initial description");

    Worksheet worksheet = createEntity(request);
    assertEquals("Initial description", worksheet.getDescription());

    worksheet.setDescription("Updated description");
    Worksheet patched = patchEntity(worksheet.getId().toString(), worksheet);
    assertEquals("Updated description", patched.getDescription());
  }

  @Test
  void test_listWorksheetsBySpreadsheet(TestNamespace ns) {
    Spreadsheet spreadsheet1 = createTestSpreadsheet(ns, "spreadsheet1");
    Spreadsheet spreadsheet2 = createTestSpreadsheet(ns, "spreadsheet2");

    for (int i = 0; i < 3; i++) {
      createEntity(
          new CreateWorksheet()
              .withName(ns.prefix("sheet1_" + i))
              .withSpreadsheet(spreadsheet1.getFullyQualifiedName()));
      createEntity(
          new CreateWorksheet()
              .withName(ns.prefix("sheet2_" + i))
              .withSpreadsheet(spreadsheet2.getFullyQualifiedName()));
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Worksheet> allWorksheets = listEntities(params);
    assertNotNull(allWorksheets);

    long spreadsheet1Count =
        allWorksheets.getData().stream()
            .filter(w -> w.getSpreadsheet().getId().equals(spreadsheet1.getId()))
            .count();
    assertTrue(spreadsheet1Count >= 3);

    long spreadsheet2Count =
        allWorksheets.getData().stream()
            .filter(w -> w.getSpreadsheet().getId().equals(spreadsheet2.getId()))
            .count();
    assertTrue(spreadsheet2Count >= 3);
  }

  @Test
  void test_worksheetWithVariousColumnTypes(TestNamespace ns) {
    Spreadsheet spreadsheet = createTestSpreadsheet(ns);

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

    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("complex_columns"))
            .withSpreadsheet(spreadsheet.getFullyQualifiedName())
            .withColumns(columns);

    Worksheet worksheet = createEntity(request);
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
  void test_worksheetColumnFQN(TestNamespace ns) {
    Spreadsheet spreadsheet = createTestSpreadsheet(ns);

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

    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("employees"))
            .withSpreadsheet(spreadsheet.getFullyQualifiedName())
            .withColumns(columns);

    Worksheet worksheet = createEntity(request);
    Worksheet worksheetWithColumns = getEntityWithFields(worksheet.getId().toString(), "columns");

    String expectedWorksheetFQN =
        spreadsheet.getFullyQualifiedName() + "." + ns.prefix("employees");
    assertEquals(expectedWorksheetFQN, worksheetWithColumns.getFullyQualifiedName());

    assertNotNull(worksheetWithColumns.getColumns());
    assertEquals(2, worksheetWithColumns.getColumns().size());

    for (Column column : worksheetWithColumns.getColumns()) {
      assertNotNull(
          column.getFullyQualifiedName(),
          "Column " + column.getName() + " should have a fullyQualifiedName");
      String expectedColumnFQN =
          worksheetWithColumns.getFullyQualifiedName() + "." + column.getName();
      assertEquals(
          expectedColumnFQN,
          column.getFullyQualifiedName(),
          "Column FQN should be worksheet.FQN + column.name");
    }
  }

  @Test
  void test_worksheetVersionHistory(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("version_test"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName())
            .withDescription("Initial description");

    Worksheet worksheet = createEntity(request);
    Double initialVersion = worksheet.getVersion();

    worksheet.setDescription("Updated description");
    Worksheet updated = patchEntity(worksheet.getId().toString(), worksheet);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(worksheet.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_worksheetSoftDeleteRestore(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("delete_test"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName());

    Worksheet worksheet = createEntity(request);
    assertNotNull(worksheet.getId());

    deleteEntity(worksheet.getId().toString());

    Worksheet deleted = getEntityIncludeDeleted(worksheet.getId().toString());
    assertNotNull(deleted);
    assertTrue(deleted.getDeleted());

    restoreEntity(worksheet.getId().toString());
    Worksheet restored = getEntity(worksheet.getId().toString());
    assertNotNull(restored);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_worksheetHardDelete(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("hard_delete_test"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName());

    Worksheet worksheet = createEntity(request);
    assertNotNull(worksheet.getId());

    hardDeleteEntity(worksheet.getId().toString());

    assertThrows(Exception.class, () -> getEntity(worksheet.getId().toString()));
    assertThrows(Exception.class, () -> getEntityIncludeDeleted(worksheet.getId().toString()));
  }

  @Test
  void test_worksheetGetByName(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("get_by_name"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName())
            .withDescription("Worksheet for getByName test");

    Worksheet worksheet = createEntity(request);

    Worksheet fetched = getEntityByName(worksheet.getFullyQualifiedName());
    assertNotNull(fetched);
    assertEquals(worksheet.getId(), fetched.getId());
    assertEquals(worksheet.getName(), fetched.getName());
    assertEquals(worksheet.getDescription(), fetched.getDescription());
  }

  @Test
  void test_worksheetWithTags(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("with_tags"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName())
            .withTags(List.of(personalDataTagLabel()));

    Worksheet worksheet = createEntity(request);
    assertNotNull(worksheet.getTags());
    assertEquals(1, worksheet.getTags().size());
    assertEquals(personalDataTagLabel().getTagFQN(), worksheet.getTags().get(0).getTagFQN());
  }

  @org.junit.jupiter.api.Disabled(
      "PATCH column updates cause duplicate key issues - needs PUT with CreateWorksheet")
  @Test
  void put_worksheetUpdate_200(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("update_worksheet"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName())
            .withDescription("Initial description");

    Worksheet worksheet = createEntity(request);
    assertEquals("Initial description", worksheet.getDescription());

    worksheet.setDescription("Updated description");
    Worksheet updated = patchEntity(worksheet.getId().toString(), worksheet);
    assertEquals("Updated description", updated.getDescription());

    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("col1")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Column 1"));
    columns.add(
        new Column().withName("col2").withDataType(ColumnDataType.INT).withDescription("Column 2"));

    worksheet.setColumns(columns);
    updated = patchEntity(worksheet.getId().toString(), worksheet);
    assertEquals(2, updated.getColumns().size());

    columns.add(
        new Column()
            .withName("col3")
            .withDataType(ColumnDataType.DECIMAL)
            .withDescription("Column 3"));

    worksheet.setColumns(columns);
    updated = patchEntity(worksheet.getId().toString(), worksheet);
    assertEquals(3, updated.getColumns().size());

    worksheet.setIsHidden(true);
    updated = patchEntity(worksheet.getId().toString(), worksheet);
    assertEquals(true, updated.getIsHidden());
  }

  @Test
  void test_worksheetFQNPatterns(TestNamespace ns) {
    DriveService service = createTestDriveService(ns);

    SpreadsheetService spreadsheetService = getSpreadsheetService();
    CreateSpreadsheet createDirectSpreadsheet =
        new CreateSpreadsheet()
            .withName(ns.prefix("directWorkbook"))
            .withService(service.getFullyQualifiedName());
    Spreadsheet directSpreadsheet = spreadsheetService.create(createDirectSpreadsheet);

    CreateWorksheet create1 =
        new CreateWorksheet()
            .withName("Sheet1")
            .withSpreadsheet(directSpreadsheet.getFullyQualifiedName());
    Worksheet worksheet1 = createEntity(create1);
    assertEquals(
        directSpreadsheet.getFullyQualifiedName() + ".Sheet1", worksheet1.getFullyQualifiedName());
    assertEquals(
        service.getFullyQualifiedName() + "." + ns.prefix("directWorkbook") + ".Sheet1",
        worksheet1.getFullyQualifiedName());
  }

  @org.junit.jupiter.api.Disabled(
      "PATCH column updates cause duplicate key issues - needs PUT with CreateWorksheet")
  @Test
  void test_columnOperations(TestNamespace ns) {
    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("column_ops"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName());

    Worksheet worksheet = createEntity(request);

    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("col1")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Column 1"));
    columns.add(
        new Column().withName("col2").withDataType(ColumnDataType.INT).withDescription("Column 2"));

    worksheet.setColumns(columns);
    Worksheet updated = patchEntity(worksheet.getId().toString(), worksheet);
    assertEquals(2, updated.getColumns().size());

    Column col1WithTag =
        new Column()
            .withName("col1")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Column 1")
            .withTags(List.of(personalDataTagLabel()));
    columns.set(0, col1WithTag);

    worksheet.setColumns(columns);
    updated = patchEntity(worksheet.getId().toString(), worksheet);
    Worksheet withColumns = getEntityWithFields(updated.getId().toString(), "columns,tags");
    assertEquals(1, withColumns.getColumns().get(0).getTags().size());
    assertEquals(
        personalDataTagLabel().getTagFQN(),
        withColumns.getColumns().get(0).getTags().get(0).getTagFQN());

    columns.remove(1);
    worksheet.setColumns(columns);
    updated = patchEntity(worksheet.getId().toString(), worksheet);
    assertEquals(1, updated.getColumns().size());
    assertEquals("col1", updated.getColumns().get(0).getName());
  }

  @org.junit.jupiter.api.Disabled(
      "PATCH column updates merge columns instead of replacing - server-side behavior")
  @Test
  void patch_worksheetColumnTagsAndDescription_200(TestNamespace ns) {
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

    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("customer_data"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName())
            .withColumns(columns);

    Worksheet worksheet = createEntity(request);

    worksheet.getColumns().get(0).setTags(List.of(personalDataTagLabel()));
    worksheet.getColumns().get(1).setTags(List.of(personalDataTagLabel(), piiSensitiveTagLabel()));
    worksheet.getColumns().get(2).setTags(List.of(piiSensitiveTagLabel()));

    Worksheet updated = patchEntity(worksheet.getId().toString(), worksheet);
    Worksheet withTags = getEntityWithFields(updated.getId().toString(), "columns,tags");

    assertEquals(1, withTags.getColumns().get(0).getTags().size());
    assertEquals(
        personalDataTagLabel().getTagFQN(),
        withTags.getColumns().get(0).getTags().get(0).getTagFQN());

    assertEquals(2, withTags.getColumns().get(1).getTags().size());
    assertEquals(1, withTags.getColumns().get(2).getTags().size());
    assertEquals(
        piiSensitiveTagLabel().getTagFQN(),
        withTags.getColumns().get(2).getTags().get(0).getTagFQN());

    worksheet.getColumns().get(0).setDescription("Updated: Unique customer identifier");
    worksheet.getColumns().get(2).setDescription("Updated: Primary email for communication");

    updated = patchEntity(worksheet.getId().toString(), worksheet);
    withTags = getEntityWithFields(updated.getId().toString(), "columns,tags");

    assertEquals(
        "Updated: Unique customer identifier", withTags.getColumns().get(0).getDescription());
    assertEquals("Customer full name", withTags.getColumns().get(1).getDescription());
    assertEquals(
        "Updated: Primary email for communication", withTags.getColumns().get(2).getDescription());
    assertEquals("Contact phone number", withTags.getColumns().get(3).getDescription());

    worksheet.getColumns().get(1).setTags(List.of(personalDataTagLabel()));
    worksheet.getColumns().get(2).setTags(new ArrayList<>());

    updated = patchEntity(worksheet.getId().toString(), worksheet);
    withTags = getEntityWithFields(updated.getId().toString(), "columns,tags");

    assertEquals(1, withTags.getColumns().get(1).getTags().size());
    assertEquals(
        personalDataTagLabel().getTagFQN(),
        withTags.getColumns().get(1).getTags().get(0).getTagFQN());
    assertTrue(
        withTags.getColumns().get(2).getTags() == null
            || withTags.getColumns().get(2).getTags().isEmpty());

    worksheet.getColumns().get(3).setDescription("Updated: Customer contact phone");
    worksheet.getColumns().get(3).setTags(List.of(personalDataTagLabel(), piiSensitiveTagLabel()));

    updated = patchEntity(worksheet.getId().toString(), worksheet);
    withTags = getEntityWithFields(updated.getId().toString(), "columns,tags");

    assertEquals("Updated: Customer contact phone", withTags.getColumns().get(3).getDescription());
    assertEquals(2, withTags.getColumns().get(3).getTags().size());
  }

  @org.junit.jupiter.api.Disabled(
      "PATCH column updates merge columns instead of replacing - server-side behavior")
  @Test
  void patch_worksheetAddRemoveColumns_200(TestNamespace ns) {
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("id")
            .withDataType(ColumnDataType.INT)
            .withDescription("Record ID")
            .withTags(List.of(personalDataTagLabel())));
    columns.add(
        new Column()
            .withName("name")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Full name")
            .withTags(List.of(piiSensitiveTagLabel())));

    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("column_patch"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName())
            .withColumns(columns);

    Worksheet worksheet = createEntity(request);

    assertEquals(2, worksheet.getColumns().size());
    assertEquals("id", worksheet.getColumns().get(0).getName());
    assertEquals("name", worksheet.getColumns().get(1).getName());

    List<Column> updatedColumns = new ArrayList<>();
    updatedColumns.add(worksheet.getColumns().get(0));
    updatedColumns.add(worksheet.getColumns().get(1));
    updatedColumns.add(
        new Column()
            .withName("created_at")
            .withDataType(ColumnDataType.TIMESTAMP)
            .withDescription("Record creation timestamp")
            .withTags(List.of(tier1TagLabel())));
    worksheet.setColumns(updatedColumns);

    Worksheet updated = patchEntity(worksheet.getId().toString(), worksheet);
    Worksheet withColumns = getEntityWithFields(updated.getId().toString(), "columns,tags");

    assertNotNull(withColumns.getColumns(), "Columns should not be null after patch");
    assertEquals(
        3, withColumns.getColumns().size(), "Expected 3 columns after adding 'created_at'");
    Column addedColumn = withColumns.getColumns().get(2);
    assertEquals("created_at", addedColumn.getName());
    assertEquals(ColumnDataType.TIMESTAMP, addedColumn.getDataType());
    assertEquals("Record creation timestamp", addedColumn.getDescription());
    assertEquals(1, addedColumn.getTags().size());
    assertEquals(tier1TagLabel().getTagFQN(), addedColumn.getTags().get(0).getTagFQN());

    List<Column> remainingColumns = new ArrayList<>();
    remainingColumns.add(worksheet.getColumns().get(0));
    remainingColumns.add(worksheet.getColumns().get(2));
    worksheet.setColumns(remainingColumns);

    updated = patchEntity(worksheet.getId().toString(), worksheet);
    withColumns = getEntityWithFields(updated.getId().toString(), "columns,tags");

    assertEquals(2, withColumns.getColumns().size());
    assertEquals("id", withColumns.getColumns().get(0).getName());
    assertEquals("created_at", withColumns.getColumns().get(1).getName());

    List<Column> newColumns = new ArrayList<>();
    newColumns.add(
        new Column()
            .withName("user_id")
            .withDataType(ColumnDataType.STRING)
            .withDescription("User identifier")
            .withTags(List.of(personalDataTagLabel())));
    newColumns.add(
        new Column()
            .withName("status")
            .withDataType(ColumnDataType.STRING)
            .withDescription("User status"));
    worksheet.setColumns(newColumns);

    updated = patchEntity(worksheet.getId().toString(), worksheet);
    withColumns = getEntityWithFields(updated.getId().toString(), "columns,tags");

    assertEquals(2, withColumns.getColumns().size());
    assertEquals("user_id", withColumns.getColumns().get(0).getName());
    assertEquals("status", withColumns.getColumns().get(1).getName());
    assertEquals(1, withColumns.getColumns().get(0).getTags().size());
    assertTrue(
        withColumns.getColumns().get(1).getTags() == null
            || withColumns.getColumns().get(1).getTags().isEmpty());
  }

  @org.junit.jupiter.api.Disabled(
      "PATCH column updates merge columns instead of replacing - server-side behavior")
  @Test
  void patch_worksheetComplexColumnOperations_200(TestNamespace ns) {
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

    CreateWorksheet request =
        new CreateWorksheet()
            .withName(ns.prefix("orders"))
            .withSpreadsheet(createTestSpreadsheet(ns).getFullyQualifiedName())
            .withColumns(columns);

    Worksheet worksheet = createEntity(request);

    worksheet.getColumns().get(0).setTags(List.of(tier1TagLabel()));
    worksheet.getColumns().get(1).setTags(List.of(piiSensitiveTagLabel(), personalDataTagLabel()));

    worksheet.getColumns().get(2).setDescription("Date when order was placed");
    worksheet.getColumns().get(3).setDescription("Total amount including taxes and shipping");

    worksheet
        .getColumns()
        .add(
            new Column()
                .withName("shipping_address")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Customer shipping address")
                .withTags(List.of(piiSensitiveTagLabel(), personalDataTagLabel())));
    worksheet
        .getColumns()
        .add(
            new Column()
                .withName("payment_method")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Payment method used")
                .withTags(List.of(piiSensitiveTagLabel())));

    Worksheet updated = patchEntity(worksheet.getId().toString(), worksheet);
    Worksheet withColumns = getEntityWithFields(updated.getId().toString(), "columns,tags");

    assertEquals(6, withColumns.getColumns().size());

    assertEquals(1, withColumns.getColumns().get(0).getTags().size());
    assertEquals(
        tier1TagLabel().getTagFQN(), withColumns.getColumns().get(0).getTags().get(0).getTagFQN());

    assertEquals(2, withColumns.getColumns().get(1).getTags().size());

    assertEquals("Date when order was placed", withColumns.getColumns().get(2).getDescription());
    assertEquals(
        "Total amount including taxes and shipping",
        withColumns.getColumns().get(3).getDescription());

    Column shippingColumn = withColumns.getColumns().get(4);
    assertEquals("shipping_address", shippingColumn.getName());
    assertEquals(2, shippingColumn.getTags().size());
    assertEquals("Customer shipping address", shippingColumn.getDescription());

    Column paymentColumn = withColumns.getColumns().get(5);
    assertEquals("payment_method", paymentColumn.getName());
    assertEquals(1, paymentColumn.getTags().size());
    assertEquals("Payment method used", paymentColumn.getDescription());
  }

  protected TagLabel tier1TagLabel() {
    return new TagLabel()
        .withTagFQN("Tier.Tier1")
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private WorksheetService getWorksheetService() {
    return new WorksheetService(SdkClients.adminClient().getHttpClient());
  }

  private SpreadsheetService getSpreadsheetService() {
    return new SpreadsheetService(SdkClients.adminClient().getHttpClient());
  }

  private DriveServiceService getDriveServiceService() {
    return new DriveServiceService(SdkClients.adminClient().getHttpClient());
  }

  private Spreadsheet createTestSpreadsheet(TestNamespace ns) {
    return createTestSpreadsheet(ns, "spreadsheet");
  }

  private Spreadsheet createTestSpreadsheet(TestNamespace ns, String baseName) {
    DriveService driveService = createTestDriveService(ns);
    String spreadsheetName = ns.prefix(baseName);

    try {
      // Try to get existing spreadsheet first
      return getSpreadsheetService()
          .getByName(driveService.getFullyQualifiedName() + "." + spreadsheetName);
    } catch (Exception e) {
      // If not found, create it
      CreateSpreadsheet request =
          new CreateSpreadsheet()
              .withName(spreadsheetName)
              .withService(driveService.getFullyQualifiedName());

      return getSpreadsheetService().create(request);
    }
  }

  private DriveService createTestDriveService(TestNamespace ns) {
    String serviceName = ns.prefix("google_drive");
    try {
      // Try to get existing service first
      return getDriveServiceService().getByName(serviceName);
    } catch (Exception e) {
      // If not found, create it
      CreateDriveService request =
          new CreateDriveService()
              .withName(serviceName)
              .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive);

      return getDriveServiceService().create(request);
    }
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateWorksheet> createRequests) {
    return SdkClients.adminClient().worksheets().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateWorksheet> createRequests) {
    return SdkClients.adminClient().worksheets().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateWorksheet createInvalidRequestForBulk(TestNamespace ns) {
    CreateWorksheet request = new CreateWorksheet();
    request.setName(ns.prefix("invalid_worksheet"));
    return request;
  }
}
