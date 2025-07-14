package org.openmetadata.service.migration.utils.v184;

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

  // JSON field names
  private static final String ALLOWED_FIELDS = "allowedFields";
  private static final String FIELDS = "fields";
  private static final String ENTITY_TYPE = "entityType";
  private static final String TABLE = "table";
  private static final String NAME = "name";

  // Column field names
  private static final String COLUMNS_DESCRIPTION = "columns.description";
  private static final String COLUMNS_CHILDREN_DESCRIPTION = "columns.children.description";

  // Field descriptions
  private static final String COLUMNS_DESC_DESCRIPTION =
      "Full-text search on column descriptions to find tables based on specific column purposes or contents.";
  private static final String COLUMNS_CHILDREN_DESC_DESCRIPTION =
      "Search on descriptions of nested columns within complex data types. Helps find tables with nested fields serving specific purposes.";

  public static void updateSearchSettings() {
    try {
      LOG.info("Updating search settings to add column description to allowed fields");

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

      JsonNode allowedFields = settingsNode.get(ALLOWED_FIELDS);
      if (allowedFields != null && allowedFields.isArray()) {
        StreamSupport.stream(allowedFields.spliterator(), false)
            .map(
                fieldConfig ->
                    new IndexedNode(fieldConfig, getNodeIndex(allowedFields, fieldConfig)))
            .filter(indexedNode -> TABLE.equals(indexedNode.node.get(ENTITY_TYPE).asText()))
            .findFirst()
            .ifPresent(
                indexedNode -> {
                  boolean updated =
                      addAllowedFieldPatch(patchBuilder, indexedNode.node, indexedNode.index);
                  updated |=
                      addChildrenDescriptionAllowedFieldPatch(
                          patchBuilder, indexedNode.node, indexedNode.index);
                  needsUpdate.compareAndSet(false, updated);
                });
      }

      // Apply patches if any changes are needed
      if (needsUpdate.get()) {
        JsonPatch patch = patchBuilder.build();
        LOG.debug("Applying patch: {}", patch.toString());
        JsonValue updated = JsonUtils.applyPatch(searchSettings.getConfigValue(), patch);
        SearchSettings updatedSettings =
            JsonUtils.readValue(updated.toString(), SearchSettings.class);
        searchSettings.withConfigValue(updatedSettings);
        systemRepository.updateSetting(searchSettings);
        LOG.info("Search settings updated successfully");
      } else {
        LOG.info("No updates needed for search settings");
      }

    } catch (Exception e) {
      LOG.error("Error updating search settings", e);
    }
  }

  private static boolean addAllowedFieldPatch(
      JsonPatchBuilder patchBuilder, JsonNode fieldConfig, int configIndex) {
    try {
      JsonNode fields = fieldConfig.get(FIELDS);
      if (fields != null && fields.isArray()) {
        for (JsonNode field : fields) {
          if (COLUMNS_DESCRIPTION.equals(field.get(NAME).asText())) {
            return false;
          }
        }

        patchBuilder.add(
            "/" + ALLOWED_FIELDS + "/" + configIndex + "/" + FIELDS + "/-",
            Json.createObjectBuilder()
                .add(NAME, COLUMNS_DESCRIPTION)
                .add("description", COLUMNS_DESC_DESCRIPTION)
                .build());
        LOG.info("Adding {} to allowedFields for table configuration", COLUMNS_DESCRIPTION);
        return true;
      }
    } catch (Exception e) {
      LOG.error("Error adding allowed field patch", e);
    }
    return false;
  }

  private static boolean addChildrenDescriptionAllowedFieldPatch(
      JsonPatchBuilder patchBuilder, JsonNode fieldConfig, int configIndex) {
    try {
      JsonNode fields = fieldConfig.get(FIELDS);
      if (fields != null && fields.isArray()) {
        for (JsonNode field : fields) {
          if (COLUMNS_CHILDREN_DESCRIPTION.equals(field.get(NAME).asText())) {
            return false;
          }
        }

        patchBuilder.add(
            "/" + ALLOWED_FIELDS + "/" + configIndex + "/" + FIELDS + "/-",
            Json.createObjectBuilder()
                .add(NAME, COLUMNS_CHILDREN_DESCRIPTION)
                .add("description", COLUMNS_CHILDREN_DESC_DESCRIPTION)
                .build());
        LOG.info(
            "Adding {} to allowedFields for table configuration", COLUMNS_CHILDREN_DESCRIPTION);
        return true;
      }
    } catch (Exception e) {
      LOG.error("Error adding children description allowed field patch", e);
    }
    return false;
  }

  private static class IndexedNode {
    final JsonNode node;
    final int index;

    IndexedNode(JsonNode node, int index) {
      this.node = node;
      this.index = index;
    }
  }

  private static int getNodeIndex(JsonNode arrayNode, JsonNode targetNode) {
    for (int i = 0; i < arrayNode.size(); i++) {
      if (arrayNode.get(i).equals(targetNode)) {
        return i;
      }
    }
    return -1;
  }
}
