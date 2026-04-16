package org.openmetadata.service.migration.utils.v1126;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.databases.DatasourceConfig;

@Slf4j
public final class MigrationUtil {

  private MigrationUtil() {}

  private static final String UPDATE_MYSQL =
      "UPDATE event_subscription_entity SET json = :json WHERE id = :id";
  private static final String UPDATE_POSTGRES =
      "UPDATE event_subscription_entity SET json = :json::jsonb WHERE id = :id";

  public static void revertWebhookAuthTypeToSecretKey(Handle handle) {
    LOG.info("Reverting webhook authType back to secretKey");
    List<Map<String, Object>> rows =
        handle.createQuery("SELECT id, json FROM event_subscription_entity").mapToMap().list();
    int revertedCount = 0;

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

          JsonNode authTypeNode = config.get("authType");
          if (authTypeNode == null || !authTypeNode.isObject()) {
            continue;
          }

          ObjectNode configObj = (ObjectNode) config;
          String authNodeType =
              authTypeNode.has("type") && !authTypeNode.get("type").isNull()
                  ? authTypeNode.get("type").asText()
                  : null;

          if ("bearer".equalsIgnoreCase(authNodeType)
              && authTypeNode.has("secretKey")
              && !authTypeNode.get("secretKey").isNull()) {
            configObj.put("secretKey", authTypeNode.get("secretKey").asText());
          } else {
            LOG.warn(
                "Dropping unrecognized authType (type={}) from webhook config for subscription {}",
                authNodeType,
                id);
          }
          configObj.remove("authType");
          modified = true;
        }

        if (modified) {
          String updateSql =
              Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())
                  ? UPDATE_MYSQL
                  : UPDATE_POSTGRES;
          handle.createUpdate(updateSql).bind("json", root.toString()).bind("id", id).execute();
          revertedCount++;
        }
      } catch (Exception e) {
        LOG.warn("Error reverting event subscription {}", id, e);
      }
    }

    LOG.info("Reverted {} event subscriptions from authType back to secretKey", revertedCount);
  }
}
