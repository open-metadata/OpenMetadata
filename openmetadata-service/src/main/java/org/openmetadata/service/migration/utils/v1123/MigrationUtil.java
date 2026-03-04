package org.openmetadata.service.migration.utils.v1123;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Migrates workflow definitions for v1.12.3 changes:
 *
 * <p>Adds the new "include" field to existing workflow trigger configurations to enable
 * include field filtering for Tag and Domain change approval workflows.
 *
 * <p>For each workflow definition with an eventBasedEntity trigger that doesn't have
 * an "include" field in its config, the migration adds an empty include object:
 * {@code "include": {}}.
 *
 * <p>This ensures backward compatibility - existing workflows continue to work as before,
 * and new workflows can use the include fields feature for fine-grained control over
 * which metadata changes trigger approval workflows.
 *
 * Uses {@link WorkflowDefinitionRepository#createOrUpdate} so that Flowable also receives the
 * updated workflow definition. The migration is idempotent – running it more than once is safe.
 */
@Slf4j
public class MigrationUtil {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String ADMIN_USER_NAME = "admin";

  public static void migrateWorkflowDefinitions() {
    LOG.info(
        "Starting v1123 migration: adding include fields support to workflow trigger configurations");

    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    List<WorkflowDefinition> allWorkflows =
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());

    int totalUpdated = 0;
    for (WorkflowDefinition workflow : allWorkflows) {
      try {
        String originalJson = JsonUtils.pojoToJson(workflow);
        JsonNode originalNode = MAPPER.readTree(originalJson);

        JsonNode migrated = migrateIncludeFields(originalNode);

        if (migrated != originalNode) {
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
        "Completed v1123 migration: {} workflow definitions updated with include fields support",
        totalUpdated);
  }

  /**
   * Recursively walks the workflow JSON and adds "include": {} to any trigger config
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
      com.fasterxml.jackson.databind.node.ArrayNode result = MAPPER.createArrayNode();
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
      return includeNode == null; // Needs migration if include field is missing
    }

    return false;
  }

  private static ObjectNode addIncludeField(ObjectNode triggerObj) {
    ObjectNode result = triggerObj.deepCopy();
    JsonNode configNode = result.get("config");

    if (configNode != null && configNode.isObject()) {
      ObjectNode configObj = (ObjectNode) configNode;
      // Add empty include object
      configObj.set("include", MAPPER.createObjectNode());
    }

    return result;
  }
}
