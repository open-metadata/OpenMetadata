package org.openmetadata.service.migration.utils.v1123;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  private static final String UPDATE_EVENT_SUB_MYSQL =
      "UPDATE event_subscription_entity SET json = :json WHERE id = :id";
  private static final String UPDATE_EVENT_SUB_POSTGRESQL =
      "UPDATE event_subscription_entity SET json = :json::jsonb WHERE id = :id";
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String ADMIN_USER_NAME = "admin";

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
          String destinationType =
              destination.get("type") != null
                  ? destination.get("type").asText().toLowerCase()
                  : null;
          if (destinationType == null
              || !destinationType.equals(
                  SubscriptionDestination.SubscriptionType.WEBHOOK.value().toLowerCase())) {
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
                  ? UPDATE_EVENT_SUB_MYSQL
                  : UPDATE_EVENT_SUB_POSTGRESQL;
          handle.createUpdate(updateSql).bind("json", root.toString()).bind("id", id).execute();
          migratedCount++;
        }
      } catch (Exception e) {
        LOG.warn("Error migrating event subscription {}: {}", id, e.getMessage());
      }
    }

    LOG.info("Migrated {} event subscriptions with secretKey to authType", migratedCount);
  }

  public static void migrateWorkflowDefinitions() {
    LOG.info(
        "Starting v1123 migration: converting include fields from map to array format in workflow trigger configurations");

    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    List<WorkflowDefinition> allWorkflows =
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());

    int needsMigration = 0;
    int totalUpdated = 0;
    for (WorkflowDefinition workflow : allWorkflows) {
      try {
        String originalJson = JsonUtils.pojoToJson(workflow);
        JsonNode originalNode = MAPPER.readTree(originalJson);

        JsonNode migrated = migrateIncludeFields(originalNode);

        if (migrated != originalNode) {
          needsMigration++;
          WorkflowDefinition updated =
              JsonUtils.readValue(MAPPER.writeValueAsString(migrated), WorkflowDefinition.class);
          repository.createOrUpdate(null, updated, ADMIN_USER_NAME);
          totalUpdated++;
          LOG.debug("Migrated workflow definition: {}", workflow.getFullyQualifiedName());
        }
      } catch (Exception e) {
        LOG.error(
            "Error migrating workflow definition '{}': {}",
            workflow.getFullyQualifiedName(),
            e.getMessage(),
            e);
      }
    }

    LOG.info(
        "Completed v1123 migration: {} of {} workflow definitions updated with array-based include fields",
        totalUpdated,
        allWorkflows.size());

    // Only throw exception if workflows needed migration but failed to update
    if (needsMigration > 0 && totalUpdated == 0) {
      throw new RuntimeException(
          "v1123 migration: failed to update any workflow definitions out of "
              + needsMigration
              + " that needed migration");
    }
  }

  /**
   * Recursively walks the workflow JSON and adds "include": [] to any trigger config
   * that is eventBasedEntity type and doesn't already have an include field.
   */
  private static JsonNode migrateIncludeFields(JsonNode node) {
    if (node == null || node.isNull()) {
      return node;
    }

    if (node.isObject()) {
      ObjectNode obj = (ObjectNode) node;

      // Check if this is a trigger config that needs migration
      if (needsIncludeFieldMigration(obj)) {
        return addIncludeField(obj);
      }

      boolean changed = false;
      ObjectNode result = MAPPER.createObjectNode();

      for (java.util.Iterator<java.util.Map.Entry<String, JsonNode>> it = obj.fields();
          it.hasNext(); ) {
        java.util.Map.Entry<String, JsonNode> entry = it.next();
        JsonNode migratedChild = migrateIncludeFields(entry.getValue());
        result.set(entry.getKey(), migratedChild);
        if (migratedChild != entry.getValue()) {
          changed = true;
        }
      }
      return changed ? result : node;
    }

    if (node.isArray()) {
      boolean changed = false;
      ArrayNode result = MAPPER.createArrayNode();
      for (JsonNode element : node) {
        JsonNode migratedElement = migrateIncludeFields(element);
        result.add(migratedElement);
        if (migratedElement != element) {
          changed = true;
        }
      }
      return changed ? result : node;
    }

    return node;
  }

  private static boolean needsIncludeFieldMigration(ObjectNode obj) {
    // Check if this object represents a trigger config for eventBasedEntity
    JsonNode typeNode = obj.get("type");
    JsonNode configNode = obj.get("config");

    if (typeNode != null && "eventBasedEntity".equals(typeNode.asText()) && configNode != null) {
      // This is an eventBasedEntity trigger, check if config already has include field
      JsonNode includeNode = configNode.get("include");
      if (includeNode == null) {
        return true; // Needs migration if include field is missing
      }
      // Check if include field is in old map format and needs conversion to array
      return includeNode.isObject(); // Needs migration if include is still an object
    }

    return false;
  }

  private static ObjectNode addIncludeField(ObjectNode triggerObj) {
    ObjectNode result = triggerObj.deepCopy();
    JsonNode configNode = result.get("config");

    if (configNode != null && configNode.isObject()) {
      ObjectNode configObj = (ObjectNode) configNode;
      JsonNode includeNode = configObj.get("include");

      if (includeNode == null) {
        // Add empty include array if missing
        configObj.set("include", MAPPER.createArrayNode());
      } else if (includeNode.isObject()) {
        // Convert old map format to array format
        ArrayNode includeArray = MAPPER.createArrayNode();
        includeNode.fieldNames().forEachRemaining(includeArray::add);
        configObj.set("include", includeArray);
      }
    }

    return result;
  }
}
