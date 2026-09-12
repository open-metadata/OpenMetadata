package org.openmetadata.service.entity.types.table;

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
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Loads requested table metadata with query counts bounded by DAO chunks, not column count.
 * Child SQL objects are obtained inside the operation to participate in the retained DAO transaction.
 */
@Slf4j
public final class TableMetadataLoader {
  public static final String TABLE_COLUMN_EXTENSION = "table.column";
  public static final String TABLE_EXTENSION = "table.table";
  public static final String CUSTOM_METRICS_EXTENSION = "customMetrics.";

  private final Supplier<EntityExtensionDAO> extensions;

  public TableMetadataLoader(final Supplier<EntityExtensionDAO> extensions) {
    this.extensions = extensions;
  }

  public void loadMetrics(final List<Table> tables, final boolean includeColumns) {
    if (nullOrEmpty(tables)) {
      return;
    }
    final List<String> ids = tables.stream().map(table -> table.getId().toString()).toList();
    final Map<UUID, List<CustomMetric>> tableMetrics = loadMetricsByTable(ids, TABLE_EXTENSION);
    tables.forEach(
        table -> table.setCustomMetrics(tableMetrics.getOrDefault(table.getId(), List.of())));
    if (includeColumns) {
      final Map<UUID, List<CustomMetric>> columnMetrics =
          loadMetricsByTable(ids, TABLE_COLUMN_EXTENSION);
      tables.forEach(
          table ->
              applyColumnMetrics(
                  table.getColumns(), columnMetrics.getOrDefault(table.getId(), List.of())));
    }
  }

  public void loadColumnMetrics(final UUID tableId, final List<Column> columns) {
    if (!nullOrEmpty(columns)) {
      final List<CustomMetric> metrics =
          extensions
              .get()
              .getExtensions(tableId, CUSTOM_METRICS_EXTENSION + TABLE_COLUMN_EXTENSION)
              .stream()
              .map(record -> JsonUtils.readValue(record.extensionJson(), CustomMetric.class))
              .toList();
      applyColumnMetrics(columns, metrics);
    }
  }

  private Map<UUID, List<CustomMetric>> loadMetricsByTable(
      final List<String> ids, final String scope) {
    final Map<UUID, List<CustomMetric>> metrics = new HashMap<>();
    for (final var record :
        extensions.get().getExtensionsBatch(ids, CUSTOM_METRICS_EXTENSION + scope)) {
      metrics
          .computeIfAbsent(record.id(), ignored -> new ArrayList<>())
          .add(JsonUtils.readValue(record.extensionJson(), CustomMetric.class));
    }
    return metrics;
  }

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
