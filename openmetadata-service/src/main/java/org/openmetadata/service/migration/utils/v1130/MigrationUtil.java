package org.openmetadata.service.migration.utils.v1130;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.EntityUtil;

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
}
