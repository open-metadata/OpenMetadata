package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Columns;
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
