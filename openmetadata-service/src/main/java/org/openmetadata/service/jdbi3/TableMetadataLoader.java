package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecord;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecordWithId;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Loads table custom metrics and column extensions with a query count bounded by DAO chunks
 * rather than by the number of columns. The DAO is obtained inside each operation so the reads
 * join whichever transaction the caller already holds.
 */
@Slf4j
public final class TableMetadataLoader {
  public static final String TABLE_COLUMN_EXTENSION = "table.column";
  public static final String TABLE_EXTENSION = "table.table";
  public static final String CUSTOM_METRICS_EXTENSION = "customMetrics.";

  private static final String TABLE_METRICS_PREFIX = CUSTOM_METRICS_EXTENSION + TABLE_EXTENSION;
  private static final String COLUMN_METRICS_PREFIX =
      CUSTOM_METRICS_EXTENSION + TABLE_COLUMN_EXTENSION;

  private final Supplier<EntityExtensionDAO> extensions;

  public TableMetadataLoader(final Supplier<EntityExtensionDAO> extensions) {
    this.extensions = extensions;
  }

  /** Sets table metrics, and column metrics when requested, for every table in one query batch. */
  public void loadMetrics(final List<Table> tables, final boolean includeColumns) {
    if (nullOrEmpty(tables)) {
      return;
    }
    final List<String> ids = tables.stream().map(table -> table.getId().toString()).toList();
    final MetricsByTable metrics = loadMetricsByTable(ids, includeColumns);
    tables.forEach(
        table -> {
          table.setCustomMetrics(metrics.tableMetrics().getOrDefault(table.getId(), List.of()));
          if (includeColumns) {
            applyColumnMetrics(
                table.getColumns(), metrics.columnMetrics().getOrDefault(table.getId(), List.of()));
          }
        });
  }

  /** Sets column metrics for a subset of one table's columns, such as a paginated page. */
  public void loadColumnMetrics(final UUID tableId, final List<Column> columns) {
    if (!nullOrEmpty(columns)) {
      final List<CustomMetric> metrics =
          extensions.get().getExtensions(tableId, COLUMN_METRICS_PREFIX).stream()
              .map(record -> JsonUtils.readValue(record.extensionJson(), CustomMetric.class))
              .toList();
      applyColumnMetrics(columns, metrics);
    }
  }

  private MetricsByTable loadMetricsByTable(final List<String> ids, final boolean includeColumns) {
    final MetricsByTable metrics =
        new MetricsByTable(new HashMap<>(), includeColumns ? new HashMap<>() : Map.of());
    // Both metric scopes share the "customMetrics.table" prefix, so one LIKE covers them; other
    // extensions under that prefix are ignored by the exact scope checks below.
    final String prefix =
        includeColumns ? CUSTOM_METRICS_EXTENSION + "table" : TABLE_METRICS_PREFIX;
    for (final var record : extensions.get().getExtensionsBatch(ids, prefix)) {
      if (record.extensionName().startsWith(TABLE_METRICS_PREFIX + ".")) {
        addMetric(metrics.tableMetrics(), record);
      } else if (includeColumns && record.extensionName().startsWith(COLUMN_METRICS_PREFIX + ".")) {
        addMetric(metrics.columnMetrics(), record);
      }
    }
    return metrics;
  }

  private void addMetric(
      final Map<UUID, List<CustomMetric>> metrics, final ExtensionRecordWithId record) {
    metrics
        .computeIfAbsent(record.id(), ignored -> new ArrayList<>())
        .add(JsonUtils.readValue(record.extensionJson(), CustomMetric.class));
  }

  private record MetricsByTable(
      Map<UUID, List<CustomMetric>> tableMetrics, Map<UUID, List<CustomMetric>> columnMetrics) {}

  private void applyColumnMetrics(final List<Column> columns, final List<CustomMetric> metrics) {
    if (nullOrEmpty(columns)) {
      return;
    }
    final Map<String, List<CustomMetric>> byColumn = new HashMap<>();
    for (final CustomMetric metric : metrics) {
      if (metric != null && metric.getColumnName() != null) {
        byColumn.computeIfAbsent(metric.getColumnName(), ignored -> new ArrayList<>()).add(metric);
      }
    }
    columns.forEach(
        column -> column.setCustomMetrics(byColumn.getOrDefault(column.getName(), List.of())));
  }

  /** Sets each column's extension from its exact persisted key, clearing columns without one. */
  public void loadColumnExtensions(final UUID tableId, final List<Column> columns) {
    if (nullOrEmpty(columns)) {
      return;
    }
    final Map<String, List<Column>> columnsByKey = indexColumnKeys(columns);
    try {
      // Older rows can carry another jsonSchema; the exact persisted key is authoritative.
      for (final ExtensionRecord record :
          extensions.get().getExtensionsByKeys(tableId, new ArrayList<>(columnsByKey.keySet()))) {
        applyColumnExtension(record, columnsByKey.get(record.extensionName()));
      }
    } catch (RuntimeException exception) {
      LOG.warn("Failed to load column extensions for table {}", tableId, exception);
    }
  }

  private Map<String, List<Column>> indexColumnKeys(final List<Column> columns) {
    final Map<String, List<Column>> byKey = new HashMap<>();
    for (final Column column : columns) {
      column.setExtension(null);
      try {
        final String key = FullyQualifiedName.buildHash(column.getFullyQualifiedName());
        byKey.computeIfAbsent(key, ignored -> new ArrayList<>()).add(column);
      } catch (RuntimeException exception) {
        LOG.warn("Failed to resolve extension key for column {}", column.getName(), exception);
      }
    }
    return byKey;
  }

  private void applyColumnExtension(final ExtensionRecord record, final List<Column> columns) {
    try {
      final Object extension = JsonUtils.readValue(record.extensionJson(), Object.class);
      columns.forEach(column -> column.setExtension(extension));
    } catch (RuntimeException exception) {
      LOG.warn("Failed to deserialize column extension {}", record.extensionName(), exception);
    }
  }
}
