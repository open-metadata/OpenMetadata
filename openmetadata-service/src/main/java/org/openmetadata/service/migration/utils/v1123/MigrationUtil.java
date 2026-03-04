package org.openmetadata.service.migration.utils.v1123;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

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
          JsonNode config = destination.get("config");
          if (config == null || !config.isObject()) {
            continue;
          }

          JsonNode secretKeyNode = config.get("secretKey");
          if (secretKeyNode == null || secretKeyNode.isNull()) {
            continue;
          }

          ObjectNode configObj = (ObjectNode) config;
          ObjectNode bearerAuth =
              JsonUtils.getObjectMapper()
                  .createObjectNode()
                  .put("secretKey", secretKeyNode.asText());
          configObj.set("authType", bearerAuth);
          configObj.remove("secretKey");
          modified = true;
        }

        if (modified) {
          handle
              .createUpdate("UPDATE event_subscription_entity SET json = :json WHERE id = :id")
              .bind("json", root.toString())
              .bind("id", id)
              .execute();
          migratedCount++;
        }
      } catch (Exception e) {
        LOG.warn("Error migrating event subscription {}: {}", id, e.getMessage());
      }
    }

    LOG.info("Migrated {} event subscriptions with secretKey to authType", migratedCount);
  }
}