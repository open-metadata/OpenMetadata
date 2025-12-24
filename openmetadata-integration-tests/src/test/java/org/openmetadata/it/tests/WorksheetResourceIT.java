package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

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
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.drives.SpreadsheetService;
import org.openmetadata.sdk.services.drives.WorksheetService;
import org.openmetadata.sdk.services.services.DriveServiceService;

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
}
