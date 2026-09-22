package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.models.TableColumnList;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TableMetadataLoader;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RequestEntityCache;

/** Uses real SQL execution counts because mock timings cannot detect an N+1 read. */
@Isolated("Temporarily decorates the application's SQL logger")
@ExtendWith(TestNamespaceExtension.class)
class TableMetadataReadIT {

  @ParameterizedTest
  @ValueSource(ints = {3, 100, 1000})
  void columnMetricsHaveAConstantQueryBudget(int columnCount, TestNamespace ns) {
    Table table = createTable(ns, columnCount);
    insertMetric(table, new CustomMetric().withName("table_count").withExpression("count(*)"));
    insertMetric(
        table,
        new CustomMetric().withName("column_sum").withColumnName("c0").withExpression("sum(c0)"));
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(
            table.getId(),
            TableRepository.CUSTOM_METRICS_EXTENSION + "table.tableish.unrelated",
            "customMetric",
            JsonUtils.pojoToJson("This extension is outside the requested metric scopes"));

    ReadResult<Table> result = read(table, "columns,customMetrics");

    assertEquals(1, result.extensionQueries());
    assertMetrics(result.value(), columnCount);
    assertMetrics(
        SdkClients.adminClient().tables().get(table.getId().toString(), "columns,customMetrics"),
        columnCount);
  }

  @Test
  void columnExtensionsUseOneQueryAndPreserveLegacyKeys(TestNamespace ns) {
    Table table = createTable(ns, 100);
    String key =
        FullyQualifiedName.buildHash(table.getColumns().getFirst().getFullyQualifiedName());
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(
            table.getId(),
            key,
            "legacyColumnExtension",
            JsonUtils.pojoToJson(Map.of("note", "legacy")));

    ReadResult<Table> result = read(table, "columns,extension");

    // One table-extension query and one query for all requested column keys.
    assertEquals(2, result.extensionQueries());
    assertEquals(Map.of("note", "legacy"), result.value().getColumns().getFirst().getExtension());
    assertNull(result.value().getColumns().getLast().getExtension());
  }

  @Test
  void omittedMetadataDoesNotQueryExtensions(TestNamespace ns) {
    Table table = createTable(ns, 100);
    ReadResult<Table> result = read(table, "columns");
    assertEquals(0, result.extensionQueries());
    assertNull(result.value().getCustomMetrics());
    assertNull(result.value().getColumns().getFirst().getCustomMetrics());
  }

  @Test
  void bulkMetricsAreBatchedAcrossTablesWithoutMixingColumnNames(TestNamespace ns) {
    Table first = createTable(ns, 100);
    Table second = createTable(ns, 100, "other_table");
    insertMetric(first, new CustomMetric().withName("first").withColumnName("c0"));
    insertMetric(second, new CustomMetric().withName("second").withColumnName("c0"));
    TableRepository repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    List<Table> tables = List.of(first, second);

    ReadResult<List<Table>> result =
        countExtensionQueries(
            () -> {
              repository.setFieldsInBulk(repository.getFields("columns,customMetrics"), tables);
              return tables;
            });

    assertEquals(1, result.extensionQueries());
    assertEquals("first", first.getColumns().getFirst().getCustomMetrics().getFirst().getName());
    assertEquals("second", second.getColumns().getFirst().getCustomMetrics().getFirst().getName());
    assertEquals(List.of(), first.getCustomMetrics());
    assertEquals(List.of(), second.getColumns().getLast().getCustomMetrics());
  }

  @Test
  void paginatedColumnMetricsUseOneQuery(TestNamespace ns) {
    Table table = createTable(ns, 100);
    insertMetric(table, new CustomMetric().withName("table_count").withExpression("count(*)"));
    insertMetric(
        table,
        new CustomMetric().withName("column_sum").withColumnName("c0").withExpression("sum(c0)"));

    try (var queries = SqlQueryCounter.forRequests(Entity.getJdbi(), "from entity_extension")) {
      TableColumnList page = columnPage(table, "customMetrics");
      assertEquals(1, queries.count());
      assertEquals(3, page.getData().size());
      assertEquals("column_sum", page.getData().getFirst().getCustomMetrics().getFirst().getName());
      assertEquals(List.of(), page.getData().getLast().getCustomMetrics());
    }
  }

  @Test
  void paginatedColumnExtensionsPreserveLegacyKeys(TestNamespace ns) {
    // The paginated endpoint used to filter on jsonschema = 'columnExtension', so a row written
    // under an older schema name was returned by the entity read and the single-column read - both
    // of which resolve by the persisted key - and silently dropped here. The three reads have to
    // agree on what a column's extension is.
    Table table = createTable(ns, 100);
    String key =
        FullyQualifiedName.buildHash(table.getColumns().getFirst().getFullyQualifiedName());
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(
            table.getId(),
            key,
            "legacyColumnExtension",
            JsonUtils.pojoToJson(Map.of("note", "legacy")));

    try (var queries = SqlQueryCounter.forRequests(Entity.getJdbi(), "from entity_extension")) {
      TableColumnList page = columnPage(table, "extension");
      assertEquals(Map.of("note", "legacy"), page.getData().getFirst().getExtension());
      assertNull(page.getData().getLast().getExtension());
      // One query for the page's keys, not one for every extension row on the table.
      assertEquals(1, queries.count());
    }
  }

  @Test
  void metadataReadsJoinTheCallersTransaction(TestNamespace ns) {
    Table table = createTable(ns, 3);
    var loader = new TableMetadataLoader(() -> Entity.getCollectionDAO().entityExtensionDAO());

    assertThrows(
        IllegalStateException.class,
        () ->
            Entity.getJdbi()
                .inTransaction(
                    handle -> {
                      insertMetric(
                          table,
                          new CustomMetric().withName("uncommitted").withExpression("count(*)"));
                      loader.loadMetrics(List.of(table), false);
                      assertEquals("uncommitted", table.getCustomMetrics().getFirst().getName());
                      throw new IllegalStateException(
                          "Injected rollback after reading our own write");
                    }));

    loader.loadMetrics(List.of(table), false);
    assertTrue(
        table.getCustomMetrics().isEmpty(),
        "The extension must roll back with the outer transaction");
  }

  private Table createTable(TestNamespace ns, int columnCount) {
    return createTable(ns, columnCount, "metadata");
  }

  private Table createTable(TestNamespace ns, int columnCount, String name) {
    SdkClients.adminClient();
    var schema = DatabaseSchemaTestFactory.createSimple(ns);
    List<Column> columns =
        IntStream.range(0, columnCount)
            .mapToObj(i -> new Column().withName("c" + i).withDataType(ColumnDataType.BIGINT))
            .toList();
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix(name))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(columns));
  }

  private void insertMetric(Table table, CustomMetric metric) {
    String scope =
        metric.getColumnName() == null
            ? TableRepository.TABLE_EXTENSION
            : TableRepository.TABLE_COLUMN_EXTENSION;
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(
            table.getId(),
            TableRepository.CUSTOM_METRICS_EXTENSION + scope + "." + metric.getName(),
            "customMetric",
            JsonUtils.pojoToJson(metric));
  }

  private TableColumnList columnPage(Table table, String fields) {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/tables/" + table.getId() + "/columns?limit=3&fields=" + fields,
                null);
    return JsonUtils.readValue(response, TableColumnList.class);
  }

  private ReadResult<Table> read(Table table, String fields) {
    RequestEntityCache.clear();
    TableRepository repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    return countExtensionQueries(
        () ->
            repository.get(null, table.getId(), repository.getFields(fields), Include.ALL, false));
  }

  private void assertMetrics(Table table, int columnCount) {
    assertNotNull(table);
    assertEquals(columnCount, table.getColumns().size());
    assertEquals("table_count", table.getCustomMetrics().getFirst().getName());
    assertEquals(
        "column_sum", table.getColumns().getFirst().getCustomMetrics().getFirst().getName());
    assertEquals(List.of(), table.getColumns().getLast().getCustomMetrics());
  }

  private <T> ReadResult<T> countExtensionQueries(Supplier<T> operation) {
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_extension")) {
      return new ReadResult<>(operation.get(), queries.count());
    } finally {
      RequestEntityCache.clear();
    }
  }

  private record ReadResult<T>(T value, int extensionQueries) {}
}
