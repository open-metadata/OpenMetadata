package org.openmetadata.service.migration.utils.v1911;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.json.JsonPatchBuilder;
import jakarta.json.JsonValue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;

@Slf4j
public class MigrationUtil {

  private static final SystemRepository systemRepository = Entity.getSystemRepository();
  private static final String SEARCH_SETTINGS_KEY = "searchSettings";
  private static final String AGGREGATIONS = "aggregations";
  private static final String GLOBAL_SETTINGS = "globalSettings";
  private static final String NAME = "name";
  private static final String TYPE = "terms";
  private static final String FIELD = "field";
  private static final String ENTITY_TYPE_KEYWORD = "entityType.keyword";

  public static void updateSearchSettingsEntityTypeKeyword() {
    try {
      LOG.info("Updating search settings to ensure entityType.keyword aggregation exists");

      Settings searchSettings = systemRepository.getConfigWithKey(SEARCH_SETTINGS_KEY);
      if (searchSettings == null) {
        LOG.warn("Search settings not found, skipping migration");
        return;
      }

      String rawJson = JsonUtils.pojoToJson(searchSettings.getConfigValue());
      LOG.debug("Current search settings JSON: {}", rawJson);
      JsonNode settingsNode = JsonUtils.readTree(rawJson);
      JsonPatchBuilder patchBuilder = Json.createPatchBuilder();
      AtomicBoolean needsUpdate = new AtomicBoolean(false);

      JsonNode globalSettings = settingsNode.get(GLOBAL_SETTINGS);
      if (globalSettings != null) {
        JsonNode aggregations = globalSettings.get(AGGREGATIONS);
        if (aggregations != null && aggregations.isArray()) {
          boolean entityTypeKeywordExists =
              StreamSupport.stream(aggregations.spliterator(), false)
                  .anyMatch(
                      aggregation -> ENTITY_TYPE_KEYWORD.equals(aggregation.get(NAME).asText()));

          if (!entityTypeKeywordExists) {
            LOG.info("Adding missing entityType.keyword aggregation");
            patchBuilder.add(
                "/" + GLOBAL_SETTINGS + "/" + AGGREGATIONS + "/-",
                Json.createObjectBuilder()
                    .add(NAME, ENTITY_TYPE_KEYWORD)
                    .add("type", TYPE)
                    .add(FIELD, ENTITY_TYPE_KEYWORD)
                    .build());
            needsUpdate.set(true);
          } else {
            LOG.info("entityType.keyword aggregation already exists, no update needed");
          }
        }
      }

      if (needsUpdate.get()) {
        JsonPatch patch = patchBuilder.build();
        LOG.debug("Applying patch: {}", patch.toString());
        JsonValue updated = JsonUtils.applyPatch(searchSettings.getConfigValue(), patch);
        SearchSettings updatedSettings =
            JsonUtils.readValue(updated.toString(), SearchSettings.class);
        searchSettings.withConfigValue(updatedSettings);
        systemRepository.updateSetting(searchSettings);
        LOG.info("Search settings updated successfully with entityType.keyword aggregation");
      } else {
        LOG.info("No updates needed for search settings");
      }

    } catch (Exception e) {
      LOG.error("Error updating search settings for entityType.keyword aggregation", e);
    }
  }
}
