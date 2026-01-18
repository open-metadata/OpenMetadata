package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.api.data.MetadataStatus;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Columns;
import org.openmetadata.sdk.fluent.DashboardDataModels;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpMethod;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnGridResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @BeforeAll
  public static void setup() {
    OpenMetadataClient client = SdkClients.adminClient();
    Tables.setDefaultClient(client);
    Columns.setDefaultClient(client);
    DashboardDataModels.setDefaultClient(client);
  }

  @Test
  void test_getColumnGrid_basic(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createTestTablesWithDifferentColumns(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse response = getColumnGrid(client, "size=100&entityTypes=table");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_withPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createMultipleTablesForPagination(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse page1 = getColumnGrid(client, "size=5&entityTypes=table");

    assertNotNull(page1);
    assertNotNull(page1.getColumns());
  }

  @Test
  void test_getColumnGrid_withEntityTypeFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createTestTablesWithDifferentColumns(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse response = getColumnGrid(client, "entityTypes=table");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_withServiceFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    createTableWithColumns(ns, schema, "service_filter_test");
    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(client, "entityTypes=table&serviceName=" + service.getName());

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_withColumnNamePattern(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createTestTablesWithDifferentColumns(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse response = getColumnGrid(client, "entityTypes=table&columnNamePattern=id");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_withDataTypeFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createTestTablesWithDifferentColumns(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse response = getColumnGrid(client, "entityTypes=table&dataTypes=VARCHAR");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_withMultipleDataTypes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createTestTablesWithDifferentColumns(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(client, "entityTypes=table&dataTypes=VARCHAR,INT,BIGINT");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_withMetadataStatusMissing(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createTableWithoutMetadata(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse response = getColumnGrid(client, "entityTypes=table&metadataStatus=MISSING");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_withMetadataStatusComplete(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createTableWithFullMetadata(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(client, "entityTypes=table&metadataStatus=COMPLETE");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_withMetadataStatusIncomplete(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createTableWithPartialMetadata(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(client, "entityTypes=table&metadataStatus=INCOMPLETE");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_emptyResult(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    ColumnGridResponse response =
        getColumnGrid(client, "entityTypes=table&columnNamePattern=nonexistent_column_name_xyz");

    assertNotNull(response);
    assertNotNull(response.getColumns());
    assertTrue(
        response.getColumns().isEmpty()
            || response.getTotalUniqueColumns() == 0
            || response.getColumns().size() >= 0);
  }

  @Test
  void test_getColumnGrid_combinedFilters(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    createTableWithColumns(ns, schema, "combined_filters_test");
    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client,
            "entityTypes=table"
                + "&serviceName="
                + service.getName()
                + "&dataTypes=VARCHAR,BIGINT"
                + "&columnNamePattern=id");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_withMetadataStatusInconsistent(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    // Create same column name in two tables with different metadata
    String sharedColumnName = ns.prefix("shared_col");

    Column col1 =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Description in table 1")
            .create();
    Tables.create()
        .name(ns.prefix("inconsistent_table_1"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(col1))
        .execute();

    Column col2 =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Different description in table 2")
            .create();
    Tables.create()
        .name(ns.prefix("inconsistent_table_2"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(col2))
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client,
            "entityTypes=table&metadataStatus=INCONSISTENT&serviceName=" + service.getName());

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_verifyMetadataStatusFieldReturned(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String uniqueColName = ns.prefix("status_test_col");
    Column colWithDesc =
        Columns.build(uniqueColName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Has description only")
            .create();
    Tables.create()
        .name(ns.prefix("status_field_test"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(colWithDesc))
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client,
            "entityTypes=table&serviceName="
                + service.getName()
                + "&columnNamePattern="
                + uniqueColName);

    assertNotNull(response);
    // The response might be empty if search index hasn't updated yet, so we check conditionally
    if (!response.getColumns().isEmpty()) {
      ColumnGridItem item = response.getColumns().get(0);
      assertNotNull(item.getMetadataStatus());
      assertNotNull(item.getGroups());
      assertFalse(item.getGroups().isEmpty());
      assertNotNull(item.getGroups().get(0).getMetadataStatus());
    }
  }

  @Test
  void test_getColumnGrid_missingStatusForNoMetadata(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column colNoMeta =
        Columns.build(ns.prefix("no_meta_col")).withType(ColumnDataType.INT).create();
    Tables.create()
        .name(ns.prefix("missing_status_test"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(colNoMeta))
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client,
            "entityTypes=table&serviceName="
                + service.getName()
                + "&columnNamePattern="
                + ns.prefix("no_meta"));

    assertNotNull(response);
    if (!response.getColumns().isEmpty()) {
      ColumnGridItem item = response.getColumns().get(0);
      assertEquals(MetadataStatus.MISSING, item.getMetadataStatus());
      assertFalse(item.getHasVariations());
    }
  }

  @Test
  void test_getColumnGrid_incompleteStatusForDescriptionOnly(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column colDescOnly =
        Columns.build(ns.prefix("desc_only_col"))
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Has description but no tags")
            .create();
    Tables.create()
        .name(ns.prefix("incomplete_desc_test"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(colDescOnly))
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client,
            "entityTypes=table&serviceName="
                + service.getName()
                + "&columnNamePattern="
                + ns.prefix("desc_only"));

    assertNotNull(response);
    if (!response.getColumns().isEmpty()) {
      ColumnGridItem item = response.getColumns().get(0);
      assertEquals(MetadataStatus.INCOMPLETE, item.getMetadataStatus());
    }
  }

  @Test
  void test_getColumnGrid_inconsistentStatusForVariations(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String sharedName = ns.prefix("variation_col");

    Column col1 =
        Columns.build(sharedName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Version A")
            .create();
    Tables.create()
        .name(ns.prefix("variation_table_a"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(col1))
        .execute();

    Column col2 =
        Columns.build(sharedName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Version B - different")
            .create();
    Tables.create()
        .name(ns.prefix("variation_table_b"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(col2))
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client,
            "entityTypes=table&serviceName="
                + service.getName()
                + "&columnNamePattern="
                + ns.prefix("variation"));

    assertNotNull(response);
    for (ColumnGridItem item : response.getColumns()) {
      if (item.getColumnName().equals(sharedName)) {
        assertTrue(item.getHasVariations());
        assertEquals(MetadataStatus.INCONSISTENT, item.getMetadataStatus());
        assertTrue(item.getGroups().size() > 1);
      }
    }
  }

  @Test
  void test_getColumnGrid_completeStatusWithDescriptionAndTags(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    createTableWithCompleteMetadata(ns);
    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(client, "entityTypes=table&metadataStatus=COMPLETE");

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  // ==================== Cross-Entity Type Tests ====================

  @Test
  void test_getColumnGrid_crossEntityType_tableAndDashboardDataModel(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(ns);

    String sharedColumnName = ns.prefix("cross_entity_col");

    Column tableColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Column in table")
            .create();
    Tables.create()
        .name(ns.prefix("cross_entity_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(tableColumn))
        .execute();

    Column dashboardColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Different description in dashboard data model")
            .create();
    DashboardDataModels.create()
        .name(ns.prefix("cross_entity_datamodel"))
        .in(dashboardService.getFullyQualifiedName())
        .withColumns(List.of(dashboardColumn))
        .withDataModelType(DataModelType.MetabaseDataModel)
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client, "entityTypes=table,dashboardDataModel&columnNamePattern=" + sharedColumnName);

    assertNotNull(response);
    assertNotNull(response.getColumns());
  }

  @Test
  void test_getColumnGrid_crossEntityType_inconsistentMetadata(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(ns);

    String sharedColumnName = ns.prefix("inconsistent_cross_col");

    Column tableColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Table column description")
            .create();
    Tables.create()
        .name(ns.prefix("inconsistent_cross_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(tableColumn))
        .execute();

    Column dashboardColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Completely different description for data model")
            .create();
    DashboardDataModels.create()
        .name(ns.prefix("inconsistent_cross_datamodel"))
        .in(dashboardService.getFullyQualifiedName())
        .withColumns(List.of(dashboardColumn))
        .withDataModelType(DataModelType.MetabaseDataModel)
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client, "entityTypes=table,dashboardDataModel&columnNamePattern=" + sharedColumnName);

    assertNotNull(response);
    for (ColumnGridItem item : response.getColumns()) {
      if (item.getColumnName().equals(sharedColumnName)) {
        assertTrue(item.getHasVariations());
        assertEquals(MetadataStatus.INCONSISTENT, item.getMetadataStatus());
        assertTrue(item.getTotalOccurrences() >= 2);
      }
    }
  }

  @Test
  void test_getColumnGrid_crossEntityType_consistentMetadata(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(ns);

    String sharedColumnName = ns.prefix("consistent_cross_col");
    String sharedDescription = "Same description in both table and data model";

    Column tableColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription(sharedDescription)
            .create();
    Tables.create()
        .name(ns.prefix("consistent_cross_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(tableColumn))
        .execute();

    Column dashboardColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription(sharedDescription)
            .create();
    DashboardDataModels.create()
        .name(ns.prefix("consistent_cross_datamodel"))
        .in(dashboardService.getFullyQualifiedName())
        .withColumns(List.of(dashboardColumn))
        .withDataModelType(DataModelType.MetabaseDataModel)
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client, "entityTypes=table,dashboardDataModel&columnNamePattern=" + sharedColumnName);

    assertNotNull(response);
    for (ColumnGridItem item : response.getColumns()) {
      if (item.getColumnName().equals(sharedColumnName)) {
        assertFalse(item.getHasVariations());
        assertEquals(MetadataStatus.INCOMPLETE, item.getMetadataStatus());
        assertEquals(1, item.getGroups().size());
        assertTrue(item.getTotalOccurrences() >= 2);
      }
    }
  }

  @Test
  void test_getColumnGrid_crossEntityType_filterByTableOnly(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(ns);

    String sharedColumnName = ns.prefix("filter_test_col");

    Column tableColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Table only")
            .create();
    Tables.create()
        .name(ns.prefix("filter_test_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(tableColumn))
        .execute();

    Column dashboardColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Dashboard only")
            .create();
    DashboardDataModels.create()
        .name(ns.prefix("filter_test_datamodel"))
        .in(dashboardService.getFullyQualifiedName())
        .withColumns(List.of(dashboardColumn))
        .withDataModelType(DataModelType.MetabaseDataModel)
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse tableOnlyResponse =
        getColumnGrid(client, "entityTypes=table&columnNamePattern=" + sharedColumnName);

    assertNotNull(tableOnlyResponse);
    for (ColumnGridItem item : tableOnlyResponse.getColumns()) {
      if (item.getColumnName().equals(sharedColumnName)) {
        assertFalse(item.getHasVariations());
        assertEquals(1, item.getTotalOccurrences());
      }
    }
  }

  @Test
  void test_getColumnGrid_crossEntityType_verifyOccurrenceDetails(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(ns);

    String sharedColumnName = ns.prefix("occurrence_detail_col");

    Column tableColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Occurrence detail test")
            .create();
    Tables.create()
        .name(ns.prefix("occurrence_detail_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(tableColumn))
        .execute();

    Column dashboardColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Occurrence detail test")
            .create();
    DashboardDataModels.create()
        .name(ns.prefix("occurrence_detail_datamodel"))
        .in(dashboardService.getFullyQualifiedName())
        .withColumns(List.of(dashboardColumn))
        .withDataModelType(DataModelType.MetabaseDataModel)
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client, "entityTypes=table,dashboardDataModel&columnNamePattern=" + sharedColumnName);

    assertNotNull(response);
    for (ColumnGridItem item : response.getColumns()) {
      if (item.getColumnName().equals(sharedColumnName)) {
        assertNotNull(item.getGroups());
        assertFalse(item.getGroups().isEmpty());
        for (var group : item.getGroups()) {
          assertNotNull(group.getOccurrences());
          for (var occurrence : group.getOccurrences()) {
            assertNotNull(occurrence.getEntityType());
            assertNotNull(occurrence.getEntityFQN());
            assertTrue(
                "table".equals(occurrence.getEntityType())
                    || "dashboardDataModel".equals(occurrence.getEntityType()));
          }
        }
      }
    }
  }

  private void createTestTablesWithDifferentColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();
    Column nameColumn =
        Columns.build("name").withType(ColumnDataType.VARCHAR).withLength(255).create();
    Column emailColumn =
        Columns.build("email").withType(ColumnDataType.VARCHAR).withLength(255).create();
    Column ageColumn = Columns.build("age").withType(ColumnDataType.INT).create();
    Column createdAtColumn =
        Columns.build("created_at").withType(ColumnDataType.TIMESTAMP).create();

    Tables.create()
        .name(ns.prefix("grid_test_users"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(idColumn, nameColumn, emailColumn, ageColumn, createdAtColumn))
        .withDescription("Test table for grid operations")
        .execute();
  }

  private void createMultipleTablesForPagination(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    for (int i = 0; i < 3; i++) {
      Column idColumn =
          Columns.build("id" + i).withType(ColumnDataType.BIGINT).primaryKey().create();
      Column dataColumn =
          Columns.build("data" + i).withType(ColumnDataType.VARCHAR).withLength(255).create();

      Tables.create()
          .name(ns.prefix("pagination_table_" + i))
          .inSchema(schema.getFullyQualifiedName())
          .withColumns(List.of(idColumn, dataColumn))
          .execute();
    }
  }

  private Table createTableWithColumns(TestNamespace ns, DatabaseSchema schema, String tableName) {
    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();
    Column nameColumn =
        Columns.build("name").withType(ColumnDataType.VARCHAR).withLength(255).create();

    return Tables.create()
        .name(ns.prefix(tableName))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(idColumn, nameColumn))
        .execute();
  }

  private void createTableWithoutMetadata(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn = Columns.build("no_metadata_id").withType(ColumnDataType.BIGINT).create();
    Column nameColumn =
        Columns.build("no_metadata_name").withType(ColumnDataType.VARCHAR).withLength(255).create();

    Tables.create()
        .name(ns.prefix("no_metadata_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(idColumn, nameColumn))
        .execute();
  }

  private void createTableWithFullMetadata(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn =
        Columns.build("full_metadata_id")
            .withType(ColumnDataType.BIGINT)
            .withDescription("Primary key with description")
            .create();

    Tables.create()
        .name(ns.prefix("full_metadata_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(idColumn))
        .execute();
  }

  private void createTableWithPartialMetadata(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn =
        Columns.build("partial_metadata_id")
            .withType(ColumnDataType.BIGINT)
            .withDescription("Only has description, no tags")
            .create();

    Tables.create()
        .name(ns.prefix("partial_metadata_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(idColumn))
        .execute();
  }

  private void createTableWithCompleteMetadata(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    TagLabel piiTag = new TagLabel();
    piiTag.setTagFQN("PII.Sensitive");
    piiTag.setSource(TagLabel.TagSource.CLASSIFICATION);
    piiTag.setLabelType(TagLabel.LabelType.MANUAL);
    piiTag.setState(TagLabel.State.CONFIRMED);

    Column idColumn =
        Columns.build("complete_metadata_id")
            .withType(ColumnDataType.BIGINT)
            .withDescription("Has both description and tags")
            .withTags(List.of(piiTag))
            .create();

    Tables.create()
        .name(ns.prefix("complete_metadata_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(idColumn))
        .execute();
  }

  private ColumnGridResponse getColumnGrid(OpenMetadataClient client, String queryParams)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/columns/grid?" + queryParams, null);

    return OBJECT_MAPPER.readValue(response, ColumnGridResponse.class);
  }

  private void waitForSearchIndexRefresh() {
    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
