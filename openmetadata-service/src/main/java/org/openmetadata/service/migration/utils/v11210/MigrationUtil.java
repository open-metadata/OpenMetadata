/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.migration.utils.v11210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  // The recursive column/schema children subtree was remapped from flattened to
  // object/enabled:false. Its indexed leaves no longer exist so references to
  // columns.children.name, dataModel.columns.children.name, and the schemaFields
  // variants in highlightFields, searchFields, and allowedFields are now dead weight.
  private static final Set<String> STALE_FLATTENED_CHILDREN_FIELDS =
      Set.of(
          "columns.children.name",
          "columns.children.description",
          "dataModel.columns.children.name",
          "messageSchema.schemaFields.children.name",
          "requestSchema.schemaFields.children.name",
          "responseSchema.schemaFields.children.name");

  public static void removeFlattenedChildrenSearchSettings() {
    try {
      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (searchSettings == null) {
        LOG.warn("Search settings not found in database; skipping flattened-children scrub");
      } else {
        SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
        if (stripFlattenedChildrenReferences(currentSettings)) {
          SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
          LOG.info("Removed stale flattened children references from search settings");
        } else {
          LOG.info("No stale flattened children references found in search settings");
        }
      }
    } catch (Exception e) {
      LOG.error("Error removing stale flattened children references from search settings", e);
    }
  }

  public static boolean stripFlattenedChildrenReferences(SearchSettings settings) {
    boolean changed = false;
    if (settings != null) {
      if (settings.getGlobalSettings() != null) {
        changed = removeStaleHighlightFields(settings.getGlobalSettings().getHighlightFields());
      }
      for (AssetTypeConfiguration assetConfig :
          listOrEmpty(settings.getAssetTypeConfigurations())) {
        changed |= removeStaleHighlightFields(assetConfig.getHighlightFields());
        changed |= removeStaleSearchFields(assetConfig.getSearchFields());
      }
      changed |= removeStaleAllowedFields(settings.getAllowedFields());
    }
    return changed;
  }

  private static boolean removeStaleHighlightFields(List<String> highlightFields) {
    boolean removed = false;
    if (!nullOrEmpty(highlightFields)) {
      removed = highlightFields.removeIf(STALE_FLATTENED_CHILDREN_FIELDS::contains);
    }
    return removed;
  }

  private static boolean removeStaleSearchFields(List<FieldBoost> searchFields) {
    boolean removed = false;
    if (!nullOrEmpty(searchFields)) {
      removed =
          searchFields.removeIf(
              field -> STALE_FLATTENED_CHILDREN_FIELDS.contains(field.getField()));
    }
    return removed;
  }

  private static boolean removeStaleAllowedFields(List<AllowedSearchFields> allowedFields) {
    boolean removed = false;
    for (AllowedSearchFields allowedField : listOrEmpty(allowedFields)) {
      if (!nullOrEmpty(allowedField.getFields())) {
        removed |=
            allowedField
                .getFields()
                .removeIf(field -> STALE_FLATTENED_CHILDREN_FIELDS.contains(field.getName()));
      }
    }
    return removed;
  }

  // PR #27080 renamed the file search field and aggregation from "extension" (flattened —
  // unsupported for terms agg and multi_match on OpenSearch) to "fileExtension" (keyword). The
  // seed was updated but the additive settings merge means clusters upgraded from pre-1.12.5
  // still carry both stale entries, causing a 500 on every file search query on OpenSearch.
  private static final String STALE_FILE_EXTENSION_FIELD = "extension";
  private static final String FILE_ASSET_TYPE = "file";

  public static void removeStaleFileExtensionAggregation() {
    try {
      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (searchSettings == null) {
        LOG.warn("Search settings not found in database; skipping stale file extension scrub");
        return;
      }
      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      if (stripStaleFileExtensionSettings(currentSettings)) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info("Removed stale 'extension' searchField and aggregation from file search settings");
      } else {
        LOG.info("No stale 'extension' entries found in file search settings");
      }
    } catch (Exception e) {
      LOG.error("Error removing stale file extension settings", e);
    }
  }

  public static boolean stripStaleFileExtensionSettings(SearchSettings settings) {
    boolean changed = false;
    if (settings == null) {
      return false;
    }
    for (AssetTypeConfiguration assetConfig : listOrEmpty(settings.getAssetTypeConfigurations())) {
      if (FILE_ASSET_TYPE.equals(assetConfig.getAssetType())) {
        changed |= removeStaleAggregation(assetConfig.getAggregations());
        changed |= removeStaleSearchField(assetConfig.getSearchFields());
      }
    }
    return changed;
  }

  private static boolean removeStaleAggregation(List<Aggregation> aggregations) {
    boolean removed = false;
    if (!nullOrEmpty(aggregations)) {
      removed = aggregations.removeIf(agg -> STALE_FILE_EXTENSION_FIELD.equals(agg.getField()));
    }
    return removed;
  }

  private static boolean removeStaleSearchField(List<FieldBoost> searchFields) {
    boolean removed = false;
    if (!nullOrEmpty(searchFields)) {
      removed = searchFields.removeIf(field -> STALE_FILE_EXTENSION_FIELD.equals(field.getField()));
    }
    return removed;
  }

  // Entity tables that v1125 attempted to drain of inline certification into tag_usage.
  private static final String[] CERTIFIED_ENTITY_TABLES = {
    "table_entity",
    "dashboard_entity",
    "topic_entity",
    "pipeline_entity",
    "storage_container_entity",
    "search_index_entity",
    "ml_model_entity",
    "stored_procedure_entity",
    "dashboard_data_model_entity",
    "api_endpoint_entity",
    "api_collection_entity",
    "database_entity",
    "database_schema_entity",
    "data_product_entity",
    "domain_entity",
    "chart_entity",
    "metric_entity",
    "file_entity",
    "directory_entity",
    "spreadsheet_entity",
    "worksheet_entity",
    "llm_model_entity",
    "ai_application_entity"
  };

  private static final int HEAL_BATCH_SIZE = 500;
  private static final int CERT_SOURCE = TagLabel.TagSource.CLASSIFICATION.ordinal();
  private static final int CERT_LABEL_TYPE = TagLabel.LabelType.AUTOMATED.ordinal();
  private static final int CERT_STATE = TagLabel.State.CONFIRMED.ordinal();

  /**
   * Heals installs where certification is still inlined in entity JSON instead of being in
   * tag_usage. v1125 on PostgreSQL silently failed on a missing varchar-&gt;json cast for the
   * metadata column: the insert threw, the per-table catch swallowed it, and v1125 was still
   * recorded as DONE — stranding certification in entity JSON with no tag_usage row. v1125 never
   * re-runs, so this heal (self-contained with the correct cast, independent of the v1125 SQL)
   * recovers those clusters. Idempotent: the select only matches rows that still carry
   * certification in JSON, so fresh installs, healthy MySQL, and already-healed PG databases exit
   * at zero rows.
   */
  public static void healStuckCertificationOnEntityJson(Handle handle, ConnectionType connType) {
    int totalHealed = 0;
    for (String table : CERTIFIED_ENTITY_TABLES) {
      try {
        int healed = healCertificationForTable(handle, connType, table);
        totalHealed += healed;
        if (healed > 0) {
          LOG.info("v11210 heal: moved {} stuck certification rows from {}", healed, table);
        }
      } catch (Exception e) {
        // Per-table failure shouldn't stop the rest; logged at ERROR so it isn't lost.
        LOG.error("v11210 heal failed for table '{}': {}", table, e.getMessage(), e);
      }
    }
    LOG.info("v11210 heal: total stuck certification rows healed: {}", totalHealed);
  }

  private record BatchResult(int rowsFetched, int healed) {}

  private static int healCertificationForTable(
      Handle handle, ConnectionType connType, String table) {
    int totalHealed = 0;
    boolean morePages = true;
    while (morePages) {
      BatchResult batch = healCertificationBatch(handle, connType, table);
      totalHealed += batch.healed();
      morePages = batch.rowsFetched() == HEAL_BATCH_SIZE;
    }
    return totalHealed;
  }

  private static BatchResult healCertificationBatch(
      Handle handle, ConnectionType connType, String table) {
    boolean isPostgres = connType == ConnectionType.POSTGRES;
    int healed = 0;
    List<Map<String, Object>> rows =
        handle.createQuery(buildSelectStuckCertificationSql(table, isPostgres)).mapToMap().list();
    if (!nullOrEmpty(rows)) {
      List<String> selectedIds = new ArrayList<>();
      PreparedBatch batch = handle.prepareBatch(buildInsertTagUsageSql(isPostgres));
      for (Map<String, Object> row : rows) {
        String tagFQN = (String) row.get("tagfqn");
        // SELECT already filters tagFQN NOT NULL, but stay defensive against concurrent edits.
        if (tagFQN != null) {
          selectedIds.add(row.get("id").toString());
          batch
              .bind("source", CERT_SOURCE)
              .bind("tagFQN", tagFQN)
              .bind("tagFQNHash", FullyQualifiedName.buildHash(tagFQN))
              .bind("targetFQNHash", row.get("fqnhash").toString())
              .bind("labelType", CERT_LABEL_TYPE)
              .bind("state", CERT_STATE)
              .bind("appliedAt", parseEpochMillisToTimestamp(row.get("applieddate")))
              .bind("metadata", buildCertMetadataJson(row.get("expirydate")))
              .add();
        }
      }
      if (!nullOrEmpty(selectedIds)) {
        batch.execute();
        handle
            .createUpdate(buildStripCertificationFromJsonSql(table, isPostgres))
            .bindList("ids", selectedIds)
            .execute();
        healed = selectedIds.size();
      }
    }
    return new BatchResult(rows.size(), healed);
  }

  private static String buildSelectStuckCertificationSql(String table, boolean isPostgres) {
    String sql;
    if (isPostgres) {
      sql =
          String.format(
              "SELECT id, fqnHash, "
                  + "json::json -> 'certification' -> 'tagLabel' ->> 'tagFQN' AS tagFQN, "
                  + "json::json -> 'certification' ->> 'expiryDate' AS expiryDate, "
                  + "json::json -> 'certification' ->> 'appliedDate' AS appliedDate "
                  + "FROM %s WHERE json::jsonb ?? 'certification' "
                  + "AND json::json -> 'certification' -> 'tagLabel' ->> 'tagFQN' IS NOT NULL "
                  + "LIMIT %d",
              table, HEAL_BATCH_SIZE);
    } else {
      sql =
          String.format(
              "SELECT id, fqnHash, "
                  + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.certification.tagLabel.tagFQN')) AS tagFQN, "
                  + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.certification.expiryDate')) AS expiryDate, "
                  + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.certification.appliedDate')) AS appliedDate "
                  + "FROM %s WHERE JSON_CONTAINS_PATH(json, 'one', '$.certification') = 1 "
                  + "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.certification.tagLabel.tagFQN')) IS NOT NULL "
                  + "LIMIT %d",
              table, HEAL_BATCH_SIZE);
    }
    return sql;
  }

  private static String buildInsertTagUsageSql(boolean isPostgres) {
    // PG won't auto-cast varchar -> json on the metadata column; MySQL JSON accepts a string.
    String sql;
    if (isPostgres) {
      sql =
          "INSERT INTO tag_usage "
              + "(source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, appliedBy, appliedAt, metadata) "
              + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, 'admin', :appliedAt, :metadata::json) "
              + "ON CONFLICT (source, tagFQNHash, targetFQNHash) DO NOTHING";
    } else {
      sql =
          "INSERT IGNORE INTO tag_usage "
              + "(source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, appliedBy, appliedAt, metadata) "
              + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, 'admin', :appliedAt, :metadata)";
    }
    return sql;
  }

  private static String buildStripCertificationFromJsonSql(String table, boolean isPostgres) {
    String sql;
    if (isPostgres) {
      sql =
          "UPDATE "
              + table
              + " SET json = (json::jsonb - 'certification')::json WHERE id IN (<ids>)";
    } else {
      sql =
          "UPDATE "
              + table
              + " SET json = JSON_REMOVE(json, '$.certification') WHERE id IN (<ids>)";
    }
    return sql;
  }

  private static Timestamp parseEpochMillisToTimestamp(Object val) {
    Timestamp result = null;
    if (val != null) {
      try {
        long epochMillis =
            val instanceof Number num ? num.longValue() : Long.parseLong(val.toString());
        result = new Timestamp(epochMillis);
      } catch (NumberFormatException e) {
        LOG.warn("Unparseable appliedDate '{}' on heal; binding null", val);
      }
    }
    return result;
  }

  private static String buildCertMetadataJson(Object expiryDateVal) {
    ObjectNode node = JsonUtils.getObjectNode();
    if (expiryDateVal != null) {
      if (expiryDateVal instanceof Long longVal) {
        node.put("expiryDate", longVal);
      } else if (expiryDateVal instanceof Number numberVal) {
        node.put("expiryDate", numberVal.longValue());
      } else {
        try {
          node.put("expiryDate", Long.parseLong(expiryDateVal.toString()));
        } catch (NumberFormatException e) {
          LOG.warn("Unparseable expiryDate '{}' on heal; omitting from metadata", expiryDateVal);
        }
      }
    }
    return node.toString();
  }
}
