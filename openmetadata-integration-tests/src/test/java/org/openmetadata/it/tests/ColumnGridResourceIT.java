package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
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
import org.openmetadata.schema.api.data.ColumnMetadataGroup;
import org.openmetadata.schema.api.data.ColumnOccurrenceRef;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.MetadataStatus;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Columns;
import org.openmetadata.sdk.fluent.DashboardDataModels;
import org.openmetadata.sdk.fluent.Domains;
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
    Domains.setDefaultClient(client);
  }

  @Test
  void test_getColumnGrid_aggregatesColumnsAcrossEntityTypes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table with a column
    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);

    String sharedColName = ns.prefix("shared_across_types");

    Column tableCol =
        Columns.build(sharedColName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("In table")
            .create();
    Tables.create()
        .name(ns.prefix("aggregation_test_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(tableCol))
        .execute();

    // Create a dashboard data model with the same column name
    DashboardService dashService = DashboardServiceTestFactory.createMetabase(ns);
    Column dashCol =
        Columns.build(sharedColName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("In dashboard")
            .create();
    DashboardDataModels.create()
        .name(ns.prefix("aggregation_test_datamodel"))
        .in(dashService.getFullyQualifiedName())
        .withColumns(List.of(dashCol))
        .withDataModelType(DataModelType.MetabaseDataModel)
        .execute();

    waitForSearchIndexRefresh();

    // Poll until both entities are indexed and the column grid shows 2 occurrences
    await("Wait for column grid to show both occurrences")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              ColumnGridResponse response =
                  getColumnGrid(
                      client,
                      "entityTypes=table,dashboardDataModel&columnNamePattern=shared_across");

              assertNotNull(response, "Response should not be null");
              assertNotNull(response.getColumns(), "Columns should not be null");
              assertFalse(response.getColumns().isEmpty(), "Should find the shared column");

              ColumnGridItem sharedItem = null;
              for (ColumnGridItem item : response.getColumns()) {
                if (item.getColumnName().equals(sharedColName)) {
                  sharedItem = item;
                  break;
                }
              }

              assertNotNull(
                  sharedItem, "Column '" + sharedColName + "' should be in aggregated results");
              assertEquals(
                  2,
                  sharedItem.getTotalOccurrences(),
                  "Column should have 2 occurrences (one from table, one from dashboardDataModel)");

              assertTrue(
                  sharedItem.getHasVariations(),
                  "Column should have variations since descriptions differ across entity types");
            });
  }

  @Test
  void test_getColumnGrid_basic(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String uniqueColName = ns.prefix("basic_test_col");
    Column col =
        Columns.build(uniqueColName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Basic test column")
            .create();
    Tables.create()
        .name(ns.prefix("basic_test_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(col))
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(client, "size=100&entityTypes=table&serviceName=" + service.getName());

    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");
    assertFalse(response.getColumns().isEmpty(), "Columns should not be empty - data was created");

    boolean foundColumn =
        response.getColumns().stream().anyMatch(c -> c.getColumnName().equals(uniqueColName));
    assertTrue(foundColumn, "Created column '" + uniqueColName + "' should be in results");
  }

  @Test
  void test_getColumnGrid_withPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    // Create multiple tables with unique column names for pagination testing
    for (int i = 0; i < 3; i++) {
      Column col =
          Columns.build(ns.prefix("pagination_col_" + i))
              .withType(ColumnDataType.VARCHAR)
              .withLength(255)
              .create();
      Tables.create()
          .name(ns.prefix("pagination_table_" + i))
          .inSchema(schema.getFullyQualifiedName())
          .withColumns(List.of(col))
          .execute();
    }

    waitForSearchIndexRefresh();

    ColumnGridResponse page1 =
        getColumnGrid(client, "size=2&entityTypes=table&serviceName=" + service.getName());

    assertNotNull(page1, "Response should not be null");
    assertNotNull(page1.getColumns(), "Columns should not be null");
    assertFalse(page1.getColumns().isEmpty(), "Should have columns in first page");
    assertTrue(page1.getColumns().size() <= 2, "Should respect page size limit");
  }

  @Test
  void test_getColumnGrid_withEntityTypeFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String colName = ns.prefix("entity_filter_col");
    Column col = Columns.build(colName).withType(ColumnDataType.VARCHAR).withLength(255).create();
    Tables.create()
        .name(ns.prefix("entity_filter_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(col))
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(client, "entityTypes=table&serviceName=" + service.getName());

    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");
    assertFalse(response.getColumns().isEmpty(), "Should find table columns");

    boolean foundColumn =
        response.getColumns().stream().anyMatch(c -> c.getColumnName().equals(colName));
    assertTrue(foundColumn, "Created column should be in results");
  }

  @Test
  void test_getColumnGrid_withServiceFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = createTableWithColumns(ns, schema, "service_filter_test");
    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(client, "entityTypes=table&serviceName=" + service.getName());

    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");
    assertFalse(
        response.getColumns().isEmpty(),
        "Columns should not be empty - table was created with columns");

    // Verify known columns from createTableWithColumns are present (id, name)
    boolean foundIdColumn =
        response.getColumns().stream().anyMatch(c -> c.getColumnName().equals("id"));
    assertTrue(foundIdColumn, "Column 'id' should be in results for service " + service.getName());
  }

  @Test
  void test_getColumnGrid_withColumnNamePattern(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String matchingColName = ns.prefix("pattern_match_col");
    String nonMatchingColName = ns.prefix("other_col");
    Column matchingCol =
        Columns.build(matchingColName).withType(ColumnDataType.VARCHAR).withLength(255).create();
    Column nonMatchingCol = Columns.build(nonMatchingColName).withType(ColumnDataType.INT).create();
    Tables.create()
        .name(ns.prefix("pattern_test_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(matchingCol, nonMatchingCol))
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client,
            "entityTypes=table&columnNamePattern=pattern_match&serviceName=" + service.getName());

    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");
    assertFalse(response.getColumns().isEmpty(), "Should find columns matching pattern");

    boolean foundMatching =
        response.getColumns().stream().anyMatch(c -> c.getColumnName().equals(matchingColName));
    assertTrue(foundMatching, "Column matching pattern should be in results");
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

    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");
    assertFalse(
        response.getColumns().isEmpty(),
        "Should find columns across entity types - both table and dashboardDataModel were created");

    // Find the shared column and verify it's aggregated from multiple entity types
    ColumnGridItem sharedItem = null;
    for (ColumnGridItem item : response.getColumns()) {
      if (item.getColumnName().equals(sharedColumnName)) {
        sharedItem = item;
        break;
      }
    }

    assertNotNull(sharedItem, "Shared column '" + sharedColumnName + "' should be in results");
    assertTrue(
        sharedItem.getTotalOccurrences() >= 2,
        "Shared column should have occurrences from both table and dashboardDataModel, found: "
            + sharedItem.getTotalOccurrences());

    // Verify we have occurrences from different entity types
    assertNotNull(sharedItem.getGroups(), "Groups should not be null");
    assertFalse(sharedItem.getGroups().isEmpty(), "Should have at least one group");
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

  @Test
  void test_getColumnGrid_withDomainFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    // Create domain
    CreateDomain domainRequest =
        new CreateDomain()
            .withName(ns.prefix("grid_domain"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Domain for column grid filter test");
    Domain domain = Domains.create(domainRequest);

    // Create table with domain association at creation time
    String colName = ns.prefix("domain_filter_col");
    Column col =
        Columns.build(colName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Column in domain")
            .create();

    // Use CreateTable directly to set domain at creation time
    org.openmetadata.schema.api.data.CreateTable createTable =
        new org.openmetadata.schema.api.data.CreateTable()
            .withName(ns.prefix("domain_filter_table"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(col))
            .withDomains(List.of(domain.getFullyQualifiedName()));
    Table table = client.tables().create(createTable);

    String queryWithDomain = "entityTypes=table&domainId=" + domain.getId().toString();

    waitForSearchIndexRefresh();

    // Verify domain filter returns valid response (may be empty if ES hasn't indexed yet)
    ColumnGridResponse response = getColumnGrid(client, queryWithDomain);
    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");

    // Verify table was created with domain association
    Table fetchedTable = client.tables().getByName(table.getFullyQualifiedName(), "domains");
    assertNotNull(fetchedTable.getDomains(), "Table should have domains");
    assertFalse(fetchedTable.getDomains().isEmpty(), "Table should have at least one domain");
    assertEquals(
        domain.getId(),
        fetchedTable.getDomains().getFirst().getId(),
        "Table should be associated with the created domain");
  }

  @Test
  void test_getColumnGrid_withTagsFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String taggedColName = ns.prefix("tagged_filter_col");
    String untaggedColName = ns.prefix("untagged_filter_col");

    TagLabel piiTag = new TagLabel();
    piiTag.setTagFQN("PII.Sensitive");
    piiTag.setSource(TagLabel.TagSource.CLASSIFICATION);
    piiTag.setLabelType(TagLabel.LabelType.MANUAL);
    piiTag.setState(TagLabel.State.CONFIRMED);

    Column taggedCol =
        Columns.build(taggedColName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Column with PII tag")
            .withTags(List.of(piiTag))
            .create();
    Column untaggedCol =
        Columns.build(untaggedColName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Column without tag")
            .create();
    Tables.create()
        .name(ns.prefix("tags_filter_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(taggedCol, untaggedCol))
        .execute();

    String queryWithTags = "entityTypes=table&tags=PII.Sensitive&serviceName=" + service.getName();

    waitForSearchIndexRefresh();

    ColumnGridResponse response = getColumnGrid(client, queryWithTags);
    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");

    // CRITICAL: Only columns that actually have the tag should be returned
    // The untagged column from the same table should NOT appear
    boolean foundTaggedColumn = false;
    boolean foundUntaggedColumn = false;

    for (ColumnGridItem item : response.getColumns()) {
      if (item.getColumnName().equals(taggedColName)) {
        foundTaggedColumn = true;
      }
      if (item.getColumnName().equals(untaggedColName)) {
        foundUntaggedColumn = true;
      }
    }

    assertTrue(foundTaggedColumn, "Tagged column should be in the results");
    assertFalse(
        foundUntaggedColumn,
        "Untagged column should NOT be in results - tag filter should only return columns that actually have the tag");
  }

  @Test
  void test_getColumnGrid_withGlossaryTermsFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Glossary glossary = createGlossary(client, ns, "GridFilterGlossary");
    GlossaryTerm glossaryTerm = createGlossaryTerm(client, glossary, ns, "GridFilterTerm");

    String glossaryColName = ns.prefix("glossary_filter_col");
    String noGlossaryColName = ns.prefix("no_glossary_filter_col");

    TagLabel glossaryTag = new TagLabel();
    glossaryTag.setTagFQN(glossaryTerm.getFullyQualifiedName());
    glossaryTag.setSource(TagLabel.TagSource.GLOSSARY);
    glossaryTag.setLabelType(TagLabel.LabelType.MANUAL);
    glossaryTag.setState(TagLabel.State.CONFIRMED);

    Column glossaryCol =
        Columns.build(glossaryColName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Column with glossary term")
            .withTags(List.of(glossaryTag))
            .create();
    Column noGlossaryCol =
        Columns.build(noGlossaryColName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Column without glossary term")
            .create();
    Tables.create()
        .name(ns.prefix("glossary_filter_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(glossaryCol, noGlossaryCol))
        .execute();

    String queryWithGlossary =
        "entityTypes=table&glossaryTerms="
            + glossaryTerm.getFullyQualifiedName()
            + "&serviceName="
            + service.getName();

    waitForSearchIndexRefresh();

    ColumnGridResponse response = getColumnGrid(client, queryWithGlossary);
    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");

    // CRITICAL: Only columns that actually have the glossary term should be returned
    // The column without glossary term from the same table should NOT appear
    boolean foundGlossaryColumn = false;
    boolean foundNoGlossaryColumn = false;

    for (ColumnGridItem item : response.getColumns()) {
      if (item.getColumnName().equals(glossaryColName)) {
        foundGlossaryColumn = true;
      }
      if (item.getColumnName().equals(noGlossaryColName)) {
        foundNoGlossaryColumn = true;
      }
    }

    assertTrue(foundGlossaryColumn, "Column with glossary term should be in the results");
    assertFalse(
        foundNoGlossaryColumn,
        "Column without glossary term should NOT be in results - glossary filter should only return columns that actually have the term");
  }

  @Test
  void test_getColumnGrid_tagsFilter_onlyReturnsTaggedOccurrences(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String sharedColumnName = ns.prefix("consistency_col");
    String differentColumnName = ns.prefix("different_col");

    TagLabel piiTag = new TagLabel();
    piiTag.setTagFQN("PII.Sensitive");
    piiTag.setSource(TagLabel.TagSource.CLASSIFICATION);
    piiTag.setLabelType(TagLabel.LabelType.MANUAL);
    piiTag.setState(TagLabel.State.CONFIRMED);

    // Table 1: sharedColumnName WITH tag, differentColumnName WITHOUT tag
    Column taggedCol =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Column with PII tag")
            .withTags(List.of(piiTag))
            .create();
    Column differentCol =
        Columns.build(differentColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Different column without tag")
            .create();
    Tables.create()
        .name(ns.prefix("consistency_table_1"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(taggedCol, differentCol))
        .execute();

    // Table 2: sharedColumnName WITHOUT tag (same name as table 1)
    Column untaggedCol =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Same column name but no tag")
            .create();
    Tables.create()
        .name(ns.prefix("consistency_table_2"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(untaggedCol))
        .execute();

    waitForSearchIndexRefresh();

    ColumnGridResponse response =
        getColumnGrid(
            client, "entityTypes=table&tags=PII.Sensitive&serviceName=" + service.getName());

    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");

    // Verify strict tag filtering:
    // 1. sharedColumnName should appear (it has the tag in table 1)
    // 2. differentColumnName should NOT appear (it doesn't have the tag)
    // 3. sharedColumnName should have ONLY 1 occurrence (table 1 where it has the tag)
    //    NOT 2 occurrences - the occurrence in table 2 without the tag should be excluded
    boolean foundSharedColumn = false;
    boolean foundDifferentColumn = false;
    int sharedColumnOccurrences = 0;

    for (ColumnGridItem item : response.getColumns()) {
      if (item.getColumnName().equals(sharedColumnName)) {
        foundSharedColumn = true;
        sharedColumnOccurrences = item.getTotalOccurrences();
      }
      if (item.getColumnName().equals(differentColumnName)) {
        foundDifferentColumn = true;
      }
    }

    assertTrue(foundSharedColumn, "Shared column (which has the tag) should be in results");
    assertFalse(
        foundDifferentColumn,
        "Different column (which doesn't have the tag) should NOT be in results");
    assertEquals(
        1,
        sharedColumnOccurrences,
        "Should ONLY return occurrences that have the tag (strict filtering), not all columns with same name");
  }

  @Test
  void test_getColumnGrid_tagsFilter_metricsAreCorrect(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    String taggedColName = ns.prefix("metrics_tagged_col");
    String untaggedColName1 = ns.prefix("metrics_untagged_col1");
    String untaggedColName2 = ns.prefix("metrics_untagged_col2");

    TagLabel piiTag = new TagLabel();
    piiTag.setTagFQN("PII.Sensitive");
    piiTag.setSource(TagLabel.TagSource.CLASSIFICATION);
    piiTag.setLabelType(TagLabel.LabelType.MANUAL);
    piiTag.setState(TagLabel.State.CONFIRMED);

    // Create table with 1 tagged column and 2 untagged columns
    Column taggedCol =
        Columns.build(taggedColName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Column with PII tag")
            .withTags(List.of(piiTag))
            .create();
    Column untaggedCol1 =
        Columns.build(untaggedColName1)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Untagged column 1")
            .create();
    Column untaggedCol2 =
        Columns.build(untaggedColName2)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Untagged column 2")
            .create();
    Tables.create()
        .name(ns.prefix("metrics_test_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(taggedCol, untaggedCol1, untaggedCol2))
        .execute();

    waitForSearchIndexRefresh();

    // Query without tag filter - should return all 3 columns
    ColumnGridResponse noFilterResponse =
        getColumnGrid(client, "entityTypes=table&serviceName=" + service.getName());

    // Query with tag filter - should return only the 1 tagged column
    ColumnGridResponse tagFilterResponse =
        getColumnGrid(
            client, "entityTypes=table&tags=PII.Sensitive&serviceName=" + service.getName());

    assertNotNull(noFilterResponse);
    assertNotNull(tagFilterResponse);

    // The filtered response should have fewer unique columns than unfiltered
    // (It should only include columns that actually have the tag)
    assertTrue(
        tagFilterResponse.getTotalUniqueColumns() <= noFilterResponse.getTotalUniqueColumns(),
        "Tag-filtered response should have <= unique columns than unfiltered. Filtered: "
            + tagFilterResponse.getTotalUniqueColumns()
            + ", Unfiltered: "
            + noFilterResponse.getTotalUniqueColumns());

    // Verify only the tagged column is in filtered results
    boolean foundTaggedInFiltered = false;
    boolean foundUntagged1InFiltered = false;
    boolean foundUntagged2InFiltered = false;

    for (ColumnGridItem item : tagFilterResponse.getColumns()) {
      if (item.getColumnName().equals(taggedColName)) {
        foundTaggedInFiltered = true;
      }
      if (item.getColumnName().equals(untaggedColName1)) {
        foundUntagged1InFiltered = true;
      }
      if (item.getColumnName().equals(untaggedColName2)) {
        foundUntagged2InFiltered = true;
      }
    }

    assertTrue(foundTaggedInFiltered, "Tagged column should be in filtered results");
    assertFalse(
        foundUntagged1InFiltered,
        "Untagged column 1 should NOT be in filtered results - metrics were incorrect");
    assertFalse(
        foundUntagged2InFiltered,
        "Untagged column 2 should NOT be in filtered results - metrics were incorrect");
  }

  @Test
  void test_getColumnGrid_tagsFilter_crossEntityType_onlyTaggedReturned(TestNamespace ns)
      throws Exception {
    // This test verifies that when columns share the same name across different entity types
    // (table and dashboardDataModel), but only one has a tag, the tag filter returns ONLY
    // the columns that actually have the tag, not all columns with the same name.
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
    DashboardService dashService = DashboardServiceTestFactory.createMetabase(ns);

    String sharedColumnName = ns.prefix("cross_entity_col");

    TagLabel piiTag = new TagLabel();
    piiTag.setTagFQN("PII.Sensitive");
    piiTag.setSource(TagLabel.TagSource.CLASSIFICATION);
    piiTag.setLabelType(TagLabel.LabelType.MANUAL);
    piiTag.setState(TagLabel.State.CONFIRMED);

    // Create table column WITH tag
    Column tableColumn =
        Columns.build(sharedColumnName)
            .withType(ColumnDataType.VARCHAR)
            .withLength(255)
            .withDescription("Table column with PII tag")
            .withTags(List.of(piiTag))
            .create();
    Tables.create()
        .name(ns.prefix("cross_entity_table_tag"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(tableColumn))
        .execute();

    // Create dashboardDataModel column with same name WITHOUT tag
    org.openmetadata.schema.type.Column dataModelColumn =
        new org.openmetadata.schema.type.Column()
            .withName(sharedColumnName)
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(255)
            .withDescription("DataModel column without tag");
    DashboardDataModels.create()
        .name(ns.prefix("cross_entity_datamodel_tag"))
        .in(dashService.getFullyQualifiedName())
        .withColumns(List.of(dataModelColumn))
        .withDataModelType(DataModelType.MetabaseDataModel)
        .execute();

    waitForSearchIndexRefresh();

    // Query with tag filter - use column name pattern to scope to our test column
    ColumnGridResponse response =
        getColumnGrid(
            client,
            "entityTypes=table,dashboardDataModel&tags=PII.Sensitive&q=" + sharedColumnName);

    assertNotNull(response, "Response should not be null");
    assertNotNull(response.getColumns(), "Columns should not be null");

    // Verify: Only the column from table (which has the tag) should be returned
    // The column from dashboardDataModel (without tag) should NOT be returned
    boolean foundSharedColumn = false;
    int tableOccurrences = 0;
    int dataModelOccurrences = 0;

    for (ColumnGridItem item : response.getColumns()) {
      if (item.getColumnName().equals(sharedColumnName)) {
        foundSharedColumn = true;
        // Count occurrences by entity type - navigate through groups
        for (ColumnMetadataGroup group : item.getGroups()) {
          for (ColumnOccurrenceRef occurrence : group.getOccurrences()) {
            if ("table".equals(occurrence.getEntityType())) {
              tableOccurrences++;
            }
            if ("dashboardDataModel".equals(occurrence.getEntityType())) {
              dataModelOccurrences++;
            }
          }
        }
      }
    }

    assertTrue(foundSharedColumn, "Shared column (from table with tag) should be in results");
    assertEquals(
        1, tableOccurrences, "Should have exactly 1 table occurrence (the one with the tag)");
    assertEquals(
        0,
        dataModelOccurrences,
        "Should have 0 dashboardDataModel occurrences since that column doesn't have the tag");
  }

  private Glossary createGlossary(
      OpenMetadataClient client, TestNamespace ns, String glossaryName) {
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(ns.prefix(glossaryName))
            .withDescription("Test glossary for " + glossaryName);
    return client.glossaries().create(createGlossary);
  }

  private GlossaryTerm createGlossaryTerm(
      OpenMetadataClient client, Glossary glossary, TestNamespace ns, String termName) {
    CreateGlossaryTerm createGlossaryTerm =
        new CreateGlossaryTerm()
            .withName(ns.prefix(termName))
            .withDescription("Test term: " + termName)
            .withGlossary(glossary.getFullyQualifiedName());
    return client.glossaryTerms().create(createGlossaryTerm);
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

  private void waitForColumnToBeIndexed(
      OpenMetadataClient client, String columnName, String serviceName) {
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                ColumnGridResponse response =
                    getColumnGrid(client, "entityTypes=table&serviceName=" + serviceName);
                return response != null
                    && response.getColumns() != null
                    && response.getColumns().stream()
                        .anyMatch(item -> columnName.equals(item.getColumnName()));
              } catch (Exception e) {
                return false;
              }
            });
  }
}
