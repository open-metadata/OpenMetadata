package org.openmetadata.service.migration.utils.v1131;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Backfills {@code entity_extension} from any inline {@code column.extension} found in
 * {@code table_entity.json} / {@code dashboard_data_model_entity.json}, then strips the
 * inline {@code extension} keys from the JSON so {@code entity_extension} remains the
 * single source of truth for column custom properties.
 *
 * <p>Idempotent: the upsert is {@code ON CONFLICT DO NOTHING} / {@code INSERT IGNORE}
 * (so a pre-existing {@code entity_extension} row wins), and the row UPDATE only runs
 * when the JSON actually changed.
 */
@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  private static final int BATCH_SIZE = 200;
  private static final String COLUMN_EXTENSION_JSON_SCHEMA = "columnExtension";

  private static final List<String> ENTITY_TABLES_WITH_COLUMN_EXTENSIONS =
      List.of("table_entity", "dashboard_data_model_entity");

  public static void migrateColumnExtensionsToEntityExtension(Handle handle, boolean postgres) {
    for (String table : ENTITY_TABLES_WITH_COLUMN_EXTENSIONS) {
      try {
        migrateOne(handle, postgres, table);
      } catch (Exception e) {
        LOG.error("v1131 column-extension migration failed for {}: {}", table, e.getMessage(), e);
      }
    }
  }

  private static void migrateOne(Handle handle, boolean postgres, String tableName) {
    LOG.info("v1131: migrating inline column.extension for {}", tableName);
    // ON CONFLICT DO NOTHING / INSERT IGNORE — pre-existing entity_extension rows
    // win; we only backfill the columns that have no row yet (the buggy-POST case).
    String backfillSql =
        postgres
            ? "INSERT INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :ext, :schema, (:json)::jsonb) "
                + "ON CONFLICT (id, extension) DO NOTHING"
            : "INSERT IGNORE INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :ext, :schema, :json)";
    String updateSql =
        postgres
            ? "UPDATE " + tableName + " SET json = (:json)::jsonb WHERE id = :id"
            : "UPDATE " + tableName + " SET json = :json WHERE id = :id";
    String fetchSql =
        "SELECT id, json FROM " + tableName + " ORDER BY id LIMIT :limit OFFSET :offset";

    int offset = 0;
    int touched = 0;
    while (true) {
      List<Map<String, Object>> rows =
          handle
              .createQuery(fetchSql)
              .bind("limit", BATCH_SIZE)
              .bind("offset", offset)
              .mapToMap()
              .list();
      if (rows.isEmpty()) {
        break;
      }
      for (Map<String, Object> row : rows) {
        String entityId = String.valueOf(row.get("id"));
        Object jsonObj = row.get("json");
        if (jsonObj == null) continue;
        try {
          if (processRow(handle, entityId, jsonObj.toString(), backfillSql, updateSql)) {
            touched++;
          }
        } catch (Exception e) {
          LOG.error(
              "v1131: failed to process {} id={}: {}", tableName, entityId, e.getMessage(), e);
        }
      }
      offset += BATCH_SIZE;
    }
    LOG.info("v1131: {} done — {} rows had inline column.extension migrated", tableName, touched);
  }

  /**
   * Returns true if the row had any inline extension to migrate.
   * One {@link PreparedBatch} for all (N) backfill inserts plus one row UPDATE — two
   * round-trips per affected row regardless of how many inline columns it has.
   */
  private static boolean processRow(
      Handle handle, String entityId, String json, String backfillSql, String updateSql) {
    JsonNode root = JsonUtils.readTree(json);
    if (!(root instanceof ObjectNode entityNode)) {
      return false;
    }
    JsonNode columns = entityNode.get("columns");
    if (!(columns instanceof ArrayNode columnsArr) || columnsArr.isEmpty()) {
      return false;
    }
    List<InlineExtension> found = new ArrayList<>();
    collectAndStrip(columnsArr, found);
    if (found.isEmpty()) {
      return false;
    }
    PreparedBatch backfill = handle.prepareBatch(backfillSql);
    for (InlineExtension entry : found) {
      backfill
          .bind("id", entityId)
          .bind("ext", entry.extensionKey)
          .bind("schema", COLUMN_EXTENSION_JSON_SCHEMA)
          .bind("json", entry.json)
          .add();
    }
    backfill.execute();
    handle
        .createUpdate(updateSql)
        .bind("json", JsonUtils.pojoToJson(entityNode))
        .bind("id", entityId)
        .execute();
    return true;
  }

  /** Walks columns (and nested children), records every inline extension, and strips it. */
  private static void collectAndStrip(ArrayNode columns, List<InlineExtension> found) {
    for (JsonNode column : columns) {
      if (!(column instanceof ObjectNode col)) continue;
      JsonNode ext = col.get("extension");
      JsonNode fqnNode = col.get("fullyQualifiedName");
      if (ext != null && !ext.isNull() && fqnNode != null && !fqnNode.isNull()) {
        found.add(
            new InlineExtension(
                FullyQualifiedName.buildHash(fqnNode.asText()), JsonUtils.pojoToJson(ext)));
        col.remove("extension");
      }
      JsonNode children = col.get("children");
      if (children instanceof ArrayNode childArr && !childArr.isEmpty()) {
        collectAndStrip(childArr, found);
      }
    }
  }

  private record InlineExtension(String extensionKey, String json) {}
}
