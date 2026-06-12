package org.openmetadata.service.migration.utils.v1130;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
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
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  private static final String UPDATE_MYSQL =
      "UPDATE event_subscription_entity SET json = :json WHERE id = :id";
  private static final String UPDATE_POSTGRES =
      "UPDATE event_subscription_entity SET json = :json::jsonb WHERE id = :id";
  private static final String OLD_FIELD = "owners.name.keyword";
  private static final String NEW_FIELD = "ownerName";
  private static final String TABLE_COLUMN_ASSET_TYPE = "tableColumn";

  // Highlight fields dropped from the searchSettings.json seed when the underlying mapping field
  // was converted to flattened (PR #28214 flattened container dataModel.columns.children). On
  // OpenSearch, highlighting a flattened field throws "no associated analyzer", failing the search.
  // Upgraded clusters keep their stored asset config wholesale, so the seed fix never reaches them;
  // this scrub removes exactly the seed-removed entries from the DB-stored settings.
  private static final Set<String> STALE_FLATTENED_CHILDREN_FIELDS =
      Set.of(
          "columns.children.name",
          "columns.children.description",
          "dataModel.columns.children.name",
          "messageSchema.schemaFields.children.name",
          "requestSchema.schemaFields.children.name",
          "responseSchema.schemaFields.children.name");

  public static void updateOwnerChartFormulas() {
    DataInsightSystemChartRepository repository = new DataInsightSystemChartRepository();
    String[] chartNames = {
      "percentage_of_data_asset_with_owner",
      "percentage_of_service_with_owner",
      "data_assets_with_owner_summary_card",
      "percentage_of_data_asset_with_owner_kpi",
      "number_of_data_asset_with_owner_kpi",
      "assets_with_owners",
      "assets_with_owner_live"
    };

    for (String chartName : chartNames) {
      try {
        DataInsightCustomChart chart =
            repository.getByName(null, chartName, EntityUtil.Fields.EMPTY_FIELDS);
        String json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(chart.getChartDetails());
        if (json.contains(OLD_FIELD)) {
          String updatedJson = json.replace(OLD_FIELD, NEW_FIELD);
          Object updatedDetails =
              org.openmetadata.schema.utils.JsonUtils.readValue(
                  updatedJson, chart.getChartDetails().getClass());
          chart.setChartDetails(updatedDetails);
          repository.prepareInternal(chart, false);
          repository.getDao().update(chart);
          LOG.info(
              "Updated chart formula for '{}': replaced '{}' with '{}'",
              chartName,
              OLD_FIELD,
              NEW_FIELD);
        }
      } catch (Exception ex) {
        LOG.warn("Could not update chart '{}': {}", chartName, ex.getMessage());
      }
    }
  }

  public static void migrateWebhookSecretKeyToAuthType(Handle handle) {
    LOG.info("Starting migration of webhook secretKey to authType");
    List<Map<String, Object>> rows =
        handle.createQuery("SELECT id, json FROM event_subscription_entity").mapToMap().list();
    int migratedCount = 0;

    for (Map<String, Object> row : rows) {
      String id = row.get("id").toString();
      String jsonStr = row.get("json").toString();

      try {
        ObjectNode root = (ObjectNode) JsonUtils.readTree(jsonStr);
        JsonNode destinations = root.get("destinations");
        if (destinations == null || !destinations.isArray()) {
          continue;
        }

        boolean modified = false;
        for (JsonNode destination : destinations) {
          String type =
              destination.get("type") != null
                  ? destination.get("type").asText().toLowerCase()
                  : null;
          if (!SubscriptionDestination.SubscriptionType.WEBHOOK
              .value()
              .toLowerCase()
              .equals(type)) {
            continue;
          }

          JsonNode config = destination.get("config");
          if (config == null || !config.isObject()) {
            continue;
          }

          JsonNode secretKeyNode = config.get("secretKey");
          if (secretKeyNode == null
              || secretKeyNode.isNull()
              || secretKeyNode.asText().trim().isEmpty()) {
            continue;
          }

          ObjectNode configObj = (ObjectNode) config;
          ObjectNode bearerAuth =
              JsonUtils.getObjectMapper()
                  .createObjectNode()
                  .put("type", "bearer")
                  .put("secretKey", secretKeyNode.asText());
          configObj.set("authType", bearerAuth);
          configObj.remove("secretKey");
          modified = true;
        }

        if (modified) {
          String updateSql =
              Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())
                  ? UPDATE_MYSQL
                  : UPDATE_POSTGRES;
          handle.createUpdate(updateSql).bind("json", root.toString()).bind("id", id).execute();
          migratedCount++;
        }
      } catch (Exception e) {
        LOG.warn("Error migrating event subscription {}", id, e);
      }
    }

    LOG.info("Migrated {} event subscriptions with secretKey to authType", migratedCount);
  }

  private static final String SELECT_GLOSSARY_VERSIONS_MYSQL =
      "SELECT id, extension, json FROM entity_extension "
          + "WHERE extension LIKE 'glossaryTerm.version.%' "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.relatedTerms[0].id') "
          + "AND (id > :id OR (id = :id AND extension > :extension)) "
          + "ORDER BY id, extension LIMIT :pageSize";

  private static final String SELECT_GLOSSARY_VERSIONS_POSTGRES =
      "SELECT id, extension, json::text AS json FROM entity_extension "
          + "WHERE extension LIKE 'glossaryTerm.version.%' "
          + "AND jsonb_exists((json::jsonb)->'relatedTerms'->0, 'id') "
          + "AND (id > :id OR (id = :id AND extension > :extension)) "
          + "ORDER BY id, extension LIMIT :pageSize";

  private static final String UPDATE_VERSION_JSON_MYSQL =
      "UPDATE entity_extension SET json = :json WHERE id = :id AND extension = :extension";

  private static final String UPDATE_VERSION_JSON_POSTGRES =
      "UPDATE entity_extension SET json = :json::jsonb WHERE id = :id AND extension = :extension";

  private static final int VERSION_RELATED_TERMS_PAGE_SIZE = 500;
  private static final String RELATED_TERMS = "relatedTerms";
  private static final String CHANGE_DESCRIPTION = "changeDescription";

  /**
   * Wraps legacy {@code EntityReference[]} relatedTerms as {@code TermRelation[]} in
   * glossaryTerm version snapshots — both top-level and inside changeDescription diff strings.
   * Version reads bypass entity_relationship rehydration, so a strip would lose history. Idempotent.
   */
  public static void migrateGlossaryTermVersionRelatedTermsToTermRelation(Handle handle) {
    LOG.info("v1130: transforming legacy relatedTerms in glossaryTerm version snapshots");
    boolean isMySQL = Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL());
    String selectSql = isMySQL ? SELECT_GLOSSARY_VERSIONS_MYSQL : SELECT_GLOSSARY_VERSIONS_POSTGRES;
    String updateSql = isMySQL ? UPDATE_VERSION_JSON_MYSQL : UPDATE_VERSION_JSON_POSTGRES;

    String cursorId = "";
    String cursorExtension = "";
    long totalTransformed = 0;
    long totalSkipped = 0;
    int pageNumber = 0;
    boolean morePages = true;

    while (morePages) {
      List<Map<String, Object>> rows =
          handle
              .createQuery(selectSql)
              .bind("id", cursorId)
              .bind("extension", cursorExtension)
              .bind("pageSize", VERSION_RELATED_TERMS_PAGE_SIZE)
              .mapToMap()
              .list();

      if (rows.isEmpty()) {
        break;
      }
      pageNumber++;
      morePages = rows.size() == VERSION_RELATED_TERMS_PAGE_SIZE;

      PreparedBatch batch = handle.prepareBatch(updateSql);
      int batchedUpdates = 0;
      for (Map<String, Object> row : rows) {
        String id = String.valueOf(row.get("id"));
        String extension = String.valueOf(row.get("extension"));
        String jsonStr = String.valueOf(row.get("json"));

        cursorId = id;
        cursorExtension = extension;

        try {
          ObjectNode root = (ObjectNode) JsonUtils.readTree(jsonStr);
          if (transformSnapshot(root)) {
            batch.bind("id", id).bind("extension", extension).bind("json", root.toString()).add();
            batchedUpdates++;
          }
        } catch (Exception e) {
          totalSkipped++;
          LOG.warn(
              "Skipping malformed glossaryTerm version snapshot id={} extension={}: {}",
              id,
              extension,
              e.getMessage());
        }
      }

      if (batchedUpdates > 0) {
        batch.execute();
        totalTransformed += batchedUpdates;
      }

      LOG.info(
          "v1130 relatedTerms transform: page={} transformed={} skipped={} cursor=({},{})",
          pageNumber,
          totalTransformed,
          totalSkipped,
          cursorId,
          cursorExtension);
    }

    LOG.info(
        "v1130 relatedTerms transform done: pages={} transformed={} skipped={}",
        pageNumber,
        totalTransformed,
        totalSkipped);
  }

  private static boolean transformSnapshot(ObjectNode root) {
    boolean changed = false;
    ArrayNode wrappedTopLevel = wrapLegacyRelatedTerms(root.get(RELATED_TERMS));
    if (wrappedTopLevel != null) {
      root.set(RELATED_TERMS, wrappedTopLevel);
      changed = true;
    }
    JsonNode changeDescription = root.get(CHANGE_DESCRIPTION);
    if (changeDescription instanceof ObjectNode cd) {
      changed |= rewriteChangeDescriptionEntries(cd, "fieldsAdded", "newValue");
      changed |= rewriteChangeDescriptionEntries(cd, "fieldsDeleted", "oldValue");
      changed |= rewriteChangeDescriptionEntries(cd, "fieldsUpdated", "newValue");
      changed |= rewriteChangeDescriptionEntries(cd, "fieldsUpdated", "oldValue");
    }
    return changed;
  }

  /** Wraps legacy items as TermRelation; returns null when nothing needs wrapping. */
  private static ArrayNode wrapLegacyRelatedTerms(JsonNode array) {
    if (array == null || !array.isArray() || array.isEmpty()) {
      return null;
    }
    ArrayNode wrapped = JsonUtils.getObjectMapper().createArrayNode();
    boolean changed = false;
    for (JsonNode item : array) {
      if (isWrappedTermRelation(item)) {
        wrapped.add(item);
      } else {
        ObjectNode tr = JsonUtils.getObjectMapper().createObjectNode();
        tr.set("term", item);
        tr.put("relationType", "relatedTo");
        wrapped.add(tr);
        changed = true;
      }
    }
    return changed ? wrapped : null;
  }

  private static boolean isWrappedTermRelation(JsonNode item) {
    return item != null && item.isObject() && item.has("term");
  }

  /** Rewrites legacy relatedTerms items inside changeDescription diff JSON strings. */
  private static boolean rewriteChangeDescriptionEntries(
      ObjectNode changeDescription, String bucket, String valueField) {
    JsonNode entries = changeDescription.get(bucket);
    if (entries == null || !entries.isArray()) {
      return false;
    }
    boolean anyChanged = false;
    for (JsonNode entry : entries) {
      if (!(entry instanceof ObjectNode entryObj)) {
        continue;
      }
      JsonNode nameNode = entryObj.get("name");
      if (nameNode == null || !RELATED_TERMS.equals(nameNode.asText())) {
        continue;
      }
      JsonNode valueNode = entryObj.get(valueField);
      if (valueNode == null || !valueNode.isTextual() || valueNode.asText().isEmpty()) {
        continue;
      }
      try {
        JsonNode parsed = JsonUtils.readTree(valueNode.asText());
        ArrayNode wrapped = wrapLegacyRelatedTerms(parsed);
        if (wrapped != null) {
          entryObj.put(valueField, wrapped.toString());
          anyChanged = true;
        }
      } catch (Exception ignored) {
      }
    }
    return anyChanged;
  }

  /**
   * Adds tableColumn (column) search settings configuration if it doesn't already exist. Moved
   * from v200 to v1130 because column search was introduced in 1.13.0; the registration belongs
   * with the version that introduced the entity.
   *
   * <p>Idempotent: each helper returns false when the entry is already present, and the DB write
   * is skipped if neither addition was needed. Safe to call on every reprocessing pass.
   */
  public static void addTableColumnSearchSettings() {
    try {
      LOG.info("Adding tableColumn search settings configuration for column search support");

      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (searchSettings == null) {
        LOG.warn(
            "Search settings not found in database. "
                + "Default settings will be loaded on next startup which includes tableColumn.");
        return;
      }

      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      SearchSettings defaultSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();
      if (defaultSettings == null) {
        LOG.error("Failed to load default search settings from file, skipping migration");
        return;
      }

      boolean assetTypeAdded =
          SearchSettingsMergeUtil.addMissingAssetTypeConfiguration(
              currentSettings, defaultSettings, TABLE_COLUMN_ASSET_TYPE);
      boolean allowedFieldsAdded =
          SearchSettingsMergeUtil.addMissingAllowedFields(
              currentSettings, defaultSettings, TABLE_COLUMN_ASSET_TYPE);

      if (assetTypeAdded || allowedFieldsAdded) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info(
            "Successfully added tableColumn search settings: "
                + "assetTypeConfiguration={}, allowedFields={}",
            assetTypeAdded,
            allowedFieldsAdded);
      } else {
        LOG.info("tableColumn search settings already exist, no updates needed");
      }
    } catch (Exception e) {
      // Non-fatal: column search settings can be re-saved later. Log and swallow
      // so the migration step doesn't abort the rest of v1130's reprocessing.
      LOG.error("Error adding tableColumn search settings", e);
    }
  }

  /**
   * Removes every reference to the now non-indexed {@code *.children} fields from the DB-stored
   * SearchSettings on upgraded clusters. The recursive column/schema {@code children} subtree is
   * mapped {@code object} with {@code "enabled": false} (stored for display, not indexed) so a
   * single oversized leaf can no longer trip Lucene's per-term limit on the previous
   * {@code flattened} representation. Its leaves ({@code columns.children.name},
   * {@code dataModel.columns.children.name}, the schemaFields variants, etc.) therefore no longer
   * resolve, yet the additive settings merge preserves a cluster's stored config, so these entries
   * survive an upgrade — including the highlight entry that broke container search on OpenSearch
   * ("no associated analyzer"). Scrubs them from highlightFields, searchFields, and the
   * allowedFields catalog. Idempotent; safe to call on every reprocessing pass.
   */
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
  // seed was updated but the additive settings merge means upgraded clusters (1.11 → 1.13) still
  // carry both stale entries, causing a 500 on every file search query.
  private static final String STALE_FILE_EXTENSION_FIELD = "extension";
  private static final String FILE_ASSET_TYPE = "file";

  /**
   * Removes the stale {@code extension} searchField and aggregation from the DB-stored file
   * SearchSettings on upgraded clusters. PR #27080 renamed both to {@code fileExtension}, but the
   * additive settings merge preserves a cluster's stored config — the old entries on a flattened
   * field survive and cause {@code illegal_argument_exception} on OpenSearch. Idempotent.
   */
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
   * tag_usage. v1125 on PostgreSQL silently failed on a missing varchar->json cast for the
   * metadata column, leaving any 1.12.5+ PG database stuck. Idempotent: the SELECT filter only
   * picks rows that still carry certification in JSON, so fresh installs, healthy MySQL, and PG
   * databases with no certified entities exit at zero rows.
   */
  public static void healStuckCertificationOnEntityJson(Handle handle, ConnectionType connType) {
    int totalHealed = 0;
    for (String table : CERTIFIED_ENTITY_TABLES) {
      try {
        int healed = healCertificationForTable(handle, connType, table);
        totalHealed += healed;
        if (healed > 0) {
          LOG.info("v1130 heal: moved {} stuck certification rows from {}", healed, table);
        }
      } catch (Exception e) {
        // Per-table failure shouldn't stop the rest; logged at ERROR so it isn't lost.
        LOG.error("v1130 heal failed for table '{}': {}", table, e.getMessage(), e);
      }
    }
    LOG.info("v1130 heal: total stuck certification rows healed: {}", totalHealed);
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
