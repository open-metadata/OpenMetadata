package org.openmetadata.service.entity.types.table;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecord;
import org.openmetadata.service.util.FullyQualifiedName;

class TableMetadataLoaderTest {
  private final UUID tableId = UUID.randomUUID();
  private final EntityExtensionDAO dao = mock(EntityExtensionDAO.class);
  private final TableMetadataLoader loader = new TableMetadataLoader(() -> dao);

  @Test
  void absentInputsDoNotRequireADatabase() {
    final TableMetadataLoader unavailable =
        new TableMetadataLoader(
            () -> {
              throw new AssertionError("No metadata was requested");
            });

    unavailable.loadMetrics(null, true);
    unavailable.loadMetrics(List.of(), true);
    unavailable.loadColumnMetrics(tableId, null);
    unavailable.loadColumnMetrics(tableId, List.of());
    unavailable.loadColumnExtensions(tableId, null);
    unavailable.loadColumnExtensions(tableId, List.of());
  }

  @Test
  void columnMetricsOnlyPopulateTheSelectedColumns() {
    final Column selected = column("selected");
    final Column absent = column("absent");
    final CustomMetric expected = new CustomMetric().withName("sum").withColumnName("selected");
    when(dao.getExtensions(
            tableId,
            TableMetadataLoader.CUSTOM_METRICS_EXTENSION
                + TableMetadataLoader.TABLE_COLUMN_EXTENSION))
        .thenReturn(
            List.of(
                metricRecord(expected),
                metricRecord(new CustomMetric().withName("other").withColumnName("other")),
                metricRecord(new CustomMetric().withName("table_metric")),
                new ExtensionRecord("null_metric", "null")));

    loader.loadColumnMetrics(tableId, List.of(selected, absent));

    assertEquals(List.of(expected), selected.getCustomMetrics());
    assertEquals(List.of(), absent.getCustomMetrics());
  }

  @Test
  void omittedColumnMetricsRemainUntouchedAndMissingColumnsAreAccepted() {
    final CustomMetric existing = new CustomMetric().withName("existing");
    final Column column = column("selected").withCustomMetrics(List.of(existing));
    final Table table = new Table().withId(tableId).withColumns(List.of(column));

    loader.loadMetrics(List.of(table), false);

    assertEquals(List.of(), table.getCustomMetrics());
    assertEquals(List.of(existing), column.getCustomMetrics());
    loader.loadMetrics(List.of(new Table().withId(tableId)), true);
  }

  @Test
  void malformedExtensionDoesNotPreventLaterColumnsFromLoading() {
    final Column malformed = column("malformed").withExtension(Map.of("stale", true));
    final Column valid = column("valid");
    final Column absent = column("absent").withExtension(Map.of("stale", true));
    when(dao.getExtensionsByKeys(eq(tableId), anyList()))
        .thenReturn(
            List.of(
                new ExtensionRecord(key(malformed), "{"),
                new ExtensionRecord(key(valid), "{\"note\":\"loaded\"}")));

    loader.loadColumnExtensions(tableId, List.of(malformed, valid, absent));

    assertNull(malformed.getExtension());
    assertEquals(Map.of("note", "loaded"), valid.getExtension());
    assertNull(absent.getExtension());
  }

  @Test
  void invalidColumnKeyDoesNotPreventValidColumnsFromLoading() {
    final Column invalid = column("invalid").withFullyQualifiedName("<#E::table::invalid>");
    final Column valid = column("valid");
    when(dao.getExtensionsByKeys(tableId, List.of(key(valid))))
        .thenReturn(List.of(new ExtensionRecord(key(valid), "{\"note\":\"loaded\"}")));

    loader.loadColumnExtensions(tableId, List.of(invalid, valid));

    assertNull(invalid.getExtension());
    assertEquals(Map.of("note", "loaded"), valid.getExtension());
  }

  @Test
  void unavailableExtensionsClearStaleValuesAndRetainBestEffortReads() {
    final Column column = column("selected").withExtension(Map.of("stale", true));
    when(dao.getExtensionsByKeys(tableId, List.of(key(column))))
        .thenThrow(new IllegalStateException("Extension storage unavailable"));

    loader.loadColumnExtensions(tableId, List.of(column));

    assertNull(column.getExtension());
  }

  private Column column(final String name) {
    return new Column()
        .withName(name)
        .withFullyQualifiedName("service.database.schema.table." + name);
  }

  private String key(final Column column) {
    return FullyQualifiedName.buildHash(column.getFullyQualifiedName());
  }

  private ExtensionRecord metricRecord(final CustomMetric metric) {
    return new ExtensionRecord(metric.getName(), JsonUtils.pojoToJson(metric));
  }
}
