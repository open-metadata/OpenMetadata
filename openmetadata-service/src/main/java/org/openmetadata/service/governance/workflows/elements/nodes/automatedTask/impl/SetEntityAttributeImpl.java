package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Universal entity attribute setter implementation for OpenMetadata workflows.
 *
 * This class provides a generic way to set any field on any entity type using a map-based approach.
 * It follows OpenMetadata's schema-first design pattern and uses JSON deep copy for safe entity modification.
 *
 * <h2>Features:</h2>
 * <ul>
 *   <li>Works with ALL 43+ supported entity types (tables, dashboards, pipelines, etc.)</li>
 *   <li>Supports simple fields: status, description, displayName</li>
 *   <li>Supports nested fields using dot notation: certification.tagLabel.tagFQN</li>
 *   <li>Uses JSON deep copy pattern (no reflection)</li>
 *   <li>Thread-safe and follows OpenMetadata conventions</li>
 * </ul>
 *
 * <h2>Configuration Examples:</h2>
 * <pre>{@code
 * // Simple field setting
 * {
 *   "config": {
 *     "fieldName": "status",
 *     "fieldValue": "Approved"
 *   }
 * }
 *
 * // Nested field setting
 * {
 *   "config": {
 *     "fieldName": "certification.tagLabel.tagFQN",
 *     "fieldValue": "Certification.Gold"
 *   }
 * }
 *
 * // Array field setting (replaces entire array)
 * {
 *   "config": {
 *     "fieldName": "tags",
 *     "fieldValue": "[{\"tagFQN\": \"Quality.High\"}]"
 *   }
 * }
 * }</pre>
 *
 * <h2>Input Variables:</h2>
 * <ul>
 *   <li><strong>relatedEntity</strong> (required): Entity to modify from workflow context</li>
 *   <li><strong>updatedBy</strong> (optional): User who should be credited for the change</li>
 * </ul>
 *
 * <h2>Workflow Integration:</h2>
 * <pre>{@code
 * {
 *   "type": "automatedTask",
 *   "subType": "setEntityAttributeTask",
 *   "name": "SetTableStatus",
 *   "config": {
 *     "fieldName": "status",
 *     "fieldValue": "Approved"
 *   },
 *   "input": ["relatedEntity", "updatedBy"],
 *   "output": [],
 *   "inputNamespaceMap": {
 *     "relatedEntity": "global",
 *     "updatedBy": null
 *   }
 * }
 * }</pre>
 *
 * @author OpenMetadata Workflow Engine
 * @version 1.0
 * @since 1.9.0
 */
@Slf4j
public class SetEntityAttributeImpl implements JavaDelegate {
  /** Expression for the field name to set (supports dot notation for nested fields) */
  private Expression fieldNameExpr;

  /** Expression for the value to set in the specified field */
  private Expression fieldValueExpr;

  /** Expression for input namespace mapping configuration */
  private Expression inputNamespaceMapExpr;

  /**
   * Main execution method called by Flowable BPM engine.
   *
   * This method performs the following steps:
   * 1. Extracts configuration from Flowable field expressions
   * 2. Retrieves the target entity from workflow variables
   * 3. Applies the field modification using JSON deep copy pattern
   * 4. Creates and applies a JSON patch to update the entity in the database
   *
   * @param execution The Flowable execution context containing all workflow variables and configuration
   * @throws BpmnError if any error occurs during field setting (wrapped with workflow exception details)
   *
   * @see #setEntityField(EntityInterface, String, String, String, String) for the core field setting logic
   */
  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      // Extract input namespace mapping to understand where variables come from
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      // Parse entity link from workflow variables (e.g., "table::database.schema.tableName")
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));

      String entityType = entityLink.getEntityType();
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

      // Extract field name and value from Flowable expressions
      String fieldName = (String) fieldNameExpr.getValue(execution);
      String fieldValue = (String) fieldValueExpr.getValue(execution);

      // Get user for audit trail (defaults to governance-bot if not provided)
      String user =
          Optional.ofNullable(
                  (String)
                      varHandler.getNamespacedVariable(
                          inputNamespaceMap.get(UPDATED_BY_VARIABLE), UPDATED_BY_VARIABLE))
              .orElse("governance-bot");

      // Perform the actual field modification
      setEntityField(entity, entityType, user, fieldName, fieldValue);
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  /**
   * Core method that safely modifies any field on any entity using OpenMetadata's JSON deep copy pattern.
   *
   * This method follows OpenMetadata's best practices:
   * - Uses JSON serialization for deep copying (no reflection)
   * - Works with the map representation for generic field access
   * - Supports nested field paths with dot notation
   * - Creates proper JSON patches for database updates
   * - Uses the correct non-deprecated patch method signature
   *
   * <h3>Supported Field Types:</h3>
   * <ul>
   *   <li><strong>Simple fields:</strong> status, description, displayName</li>
   *   <li><strong>Nested objects:</strong> certification.tagLabel.tagFQN</li>
   *   <li><strong>Array fields:</strong> tags, owners (replaces entire array)</li>
   *   <li><strong>Any JSON field:</strong> Dynamic access via map manipulation</li>
   * </ul>
   *
   * <h3>Field Examples:</h3>
   * <pre>{@code
   * setEntityField(table, "table", "user", "status", "Approved");
   * setEntityField(dashboard, "dashboard", "user", "certification.tagLabel.tagFQN", "Certification.Gold");
   * setEntityField(pipeline, "pipeline", "user", "description", "Updated description");
   * }</pre>
   *
   * @param entity The entity to modify (original entity remains unchanged)
   * @param entityType The type of entity (e.g., "table", "dashboard", "pipeline")
   * @param user The user to be credited with this change for audit trail
   * @param fieldName The field to set, supports dot notation for nested fields (e.g., "certification.tagLabel.tagFQN")
   * @param fieldValue The value to set in the specified field
   *
   * @throws RuntimeException if JSON processing fails or entity repository is not found
   * @see #setNestedField(Map, String, Object) for nested field handling details
   */
  private void setEntityField(
      EntityInterface entity, String entityType, String user, String fieldName, String fieldValue) {
    // Step 1: Get original JSON for patch creation
    String originalJson = JsonUtils.pojoToJson(entity);

    // Step 2: Create a deep copy by converting to JSON and back - this is the OpenMetadata way
    EntityInterface entityCopy = JsonUtils.readValue(originalJson, entity.getClass());

    // Step 3: Convert copy to map for generic field manipulation
    Map<String, Object> entityMap = JsonUtils.getMap(entityCopy);

    // Step 4: Parse field value - could be JSON object/array or simple string
    Object parsedValue = parseFieldValue(fieldValue);

    // Step 5: Set the field value in the map - supports nested fields with dot notation
    setNestedField(entityMap, fieldName, parsedValue);

    // Step 6: Convert the modified map back to entity
    String modifiedJson = JsonUtils.pojoToJson(entityMap);
    EntityInterface modifiedEntity = JsonUtils.readValue(modifiedJson, entity.getClass());

    // Step 7: Get the updated JSON from the modified entity
    String updatedJson = JsonUtils.pojoToJson(modifiedEntity);

    // Step 8: Create patch from original to updated
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

    // Step 9: Apply patch using the non-deprecated repository method
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    entityRepository.patch(null, entity.getId(), user, patch, null);
  }

  /**
   * Parses field value from string to appropriate object type.
   * Handles JSON objects, arrays, booleans, numbers, and plain strings.
   *
   * @param fieldValue The string value to parse
   * @return Parsed object (Map, List, Boolean, Number, or String)
   */
  private Object parseFieldValue(String fieldValue) {
    if (fieldValue == null || fieldValue.isEmpty()) {
      return null;
    }

    // Try to parse as JSON object or array
    if ((fieldValue.startsWith("{") && fieldValue.endsWith("}"))
        || (fieldValue.startsWith("[") && fieldValue.endsWith("]"))) {
      try {
        return JsonUtils.readValue(fieldValue, Object.class);
      } catch (Exception e) {
        // Not valid JSON, treat as string
      }
    }

    // Try to parse as boolean
    if ("true".equalsIgnoreCase(fieldValue) || "false".equalsIgnoreCase(fieldValue)) {
      return Boolean.parseBoolean(fieldValue);
    }

    // Try to parse as number
    try {
      if (fieldValue.contains(".")) {
        return Double.parseDouble(fieldValue);
      } else {
        return Long.parseLong(fieldValue);
      }
    } catch (NumberFormatException e) {
      // Not a number, return as string
    }

    return fieldValue;
  }

  /**
   * Sets a field value in a nested map structure using dot notation path navigation.
   *
   * This method enables setting deeply nested fields by splitting the field name on dots
   * and navigating through the map hierarchy. If intermediate maps don't exist, they are
   * created automatically. This allows for flexible field manipulation without knowing
   * the exact entity structure at compile time.
   *
   * <h3>Special Handling for Common Patterns:</h3>
   * <ul>
   *   <li><strong>Tags:</strong> "tags.tagFQN" automatically finds/creates tag with specified FQN</li>
   *   <li><strong>Owners:</strong> "owners.name" automatically finds/creates owner with specified name</li>
   *   <li><strong>Array Operations:</strong> Smart handling of array fields without requiring indices</li>
   * </ul>
   *
   * <h3>Supported Patterns:</h3>
   * <ul>
   *   <li><strong>Simple fields:</strong> "name", "status", "description"</li>
   *   <li><strong>Nested objects:</strong> "certification.tagLabel.tagFQN"</li>
   *   <li><strong>Smart tags:</strong> "tags.tagFQN" (adds/updates tag without index)</li>
   *   <li><strong>Smart owners:</strong> "owners.name" (adds/updates owner without index)</li>
   *   <li><strong>Multiple levels:</strong> "lifeCycle.created.time"</li>
   *   <li><strong>Auto-creation:</strong> Missing intermediate maps are created</li>
   * </ul>
   *
   * <h3>Examples:</h3>
   * <pre>{@code
   * // Simple field
   * setNestedField(entityMap, "status", "Approved");
   * // Result: entityMap.put("status", "Approved")
   *
   * // Nested field
   * setNestedField(entityMap, "certification.tagLabel.tagFQN", "Certification.Gold");
   * // Result: entityMap.certification.tagLabel.tagFQN = "Certification.Gold"
   *
   * // Smart tag handling (NO INDEX NEEDED!)
   * setNestedField(entityMap, "tags.tagFQN", "PII.Sensitive");
   * // Result: Finds existing tag with FQN "PII.Sensitive" or creates new one
   * // User doesn't need to know it's tags[0].tagFQN or tags[1].tagFQN
   *
   * // Smart owner handling
   * setNestedField(entityMap, "owners.name", "john.doe");
   * // Result: Finds existing owner "john.doe" or creates new one
   *
   * // Auto-creation of intermediate maps
   * setNestedField(entityMap, "newSection.subsection.value", "test");
   * // Creates: entityMap -> newSection -> subsection -> value = "test"
   *
   * // Removal (null or empty value)
   * setNestedField(entityMap, "status", null);
   * // Result: removes "status" key from entityMap
   * }</pre>
   *
   * <h3>Behavior:</h3>
   * <ul>
   *   <li>Creates missing intermediate maps automatically</li>
   *   <li>Removes the field if value is null or empty string</li>
   *   <li>Handles array fields intelligently without requiring indices</li>
   *   <li>Overwrites existing values</li>
   *   <li>Thread-safe for map operations</li>
   * </ul>
   *
   * @param map The root map to modify (typically an entity converted to map)
   * @param fieldName The field path using dot notation (e.g., "tags.tagFQN", "certification.tagLabel.tagFQN")
   * @param fieldValue The value to set, or null/empty to remove the field
   *
   * @throws ClassCastException if an intermediate value is not a Map when expected
   */
  @SuppressWarnings("unchecked")
  private void setNestedField(Map<String, Object> map, String fieldName, Object fieldValue) {
    // Handle special array patterns intelligently
    if (isSmartArrayPattern(fieldName) && fieldValue instanceof String) {
      handleSmartArrayField(map, fieldName, (String) fieldValue);
      return;
    }

    // Direct array replacement (when fieldValue is already a List)
    if ((fieldName.equals("tags") || fieldName.equals("owners") || fieldName.equals("reviewers"))
        && (fieldValue instanceof List || fieldValue == null)) {
      if (fieldValue == null) {
        map.remove(fieldName);
      } else {
        map.put(fieldName, fieldValue);
      }
      return;
    }

    // Handle nested fields with dot notation (e.g., "certification.tagLabel.tagFQN")
    String[] parts = fieldName.split("\\.");
    Map<String, Object> currentMap = map;

    // Navigate to the parent map - create intermediate maps if needed
    for (int i = 0; i < parts.length - 1; i++) {
      Object value = currentMap.get(parts[i]);
      if (value instanceof Map) {
        // Navigate to existing nested map
        currentMap = (Map<String, Object>) value;
      } else {
        // Create intermediate maps if they don't exist
        Map<String, Object> newMap = new HashMap<>();
        currentMap.put(parts[i], newMap);
        currentMap = newMap;
      }
    }

    // Set the final value or remove if null
    String finalKey = parts[parts.length - 1];
    if (fieldValue == null || (fieldValue instanceof String && ((String) fieldValue).isEmpty())) {
      currentMap.remove(finalKey);
    } else {
      currentMap.put(finalKey, fieldValue);
    }
  }

  /**
   * Checks if the field pattern requires smart array handling.
   *
   * @param fieldName The field name to check
   * @return true if this is a smart array pattern like "tags.tagFQN", "owners.name"
   */
  private boolean isSmartArrayPattern(String fieldName) {
    return fieldName.equals("tags.tagFQN")
        || fieldName.equals("tags.name")
        || fieldName.equals("owners.name")
        || fieldName.equals("owners.displayName")
        || fieldName.equals("reviewers.name")
        || fieldName.equals("reviewers.displayName");
  }

  /**
   * Handles smart array field operations like tags and owners without requiring array indices.
   * This makes the API user-friendly for UI development.
   *
   * @param map The entity map
   * @param fieldName The smart field name (e.g., "tags.tagFQN")
   * @param fieldValue The value to set
   */
  @SuppressWarnings("unchecked")
  private void handleSmartArrayField(Map<String, Object> map, String fieldName, String fieldValue) {
    String[] parts = fieldName.split("\\.");
    String arrayFieldName = parts[0]; // e.g., "tags"
    String propertyName = parts[1]; // e.g., "tagFQN"

    // Get or create the array
    List<Map<String, Object>> arrayList = (List<Map<String, Object>>) map.get(arrayFieldName);
    if (arrayList == null) {
      arrayList = new ArrayList<>();
      map.put(arrayFieldName, arrayList);
    }

    if (fieldValue == null || fieldValue.isEmpty()) {
      // Remove items where the property value is null or empty
      arrayList.removeIf(
          item -> {
            Object value = item.get(propertyName);
            return value == null || (value instanceof String && ((String) value).isEmpty());
          });
    } else {
      // Find existing item or create new one
      Map<String, Object> targetItem =
          arrayList.stream()
              .filter(item -> fieldValue.equals(item.get(propertyName)))
              .findFirst()
              .orElse(null);

      if (targetItem == null) {
        // Create new item with appropriate defaults
        targetItem = createDefaultArrayItem(arrayFieldName, propertyName, fieldValue);
        arrayList.add(targetItem);
      } else {
        // Update existing item
        targetItem.put(propertyName, fieldValue);
      }
    }
  }

  /**
   * Creates a default array item with required fields based on the array type.
   *
   * @param arrayFieldName The array field name (e.g., "tags", "owners")
   * @param propertyName The property being set (e.g., "tagFQN", "name")
   * @param propertyValue The value for the property
   * @return A new map representing the array item with defaults
   */
  private Map<String, Object> createDefaultArrayItem(
      String arrayFieldName, String propertyName, String propertyValue) {
    Map<String, Object> item = new HashMap<>();

    switch (arrayFieldName) {
      case "tags":
        // Create a valid TagLabel with required fields
        item.put("tagFQN", propertyValue);
        item.put("source", "Classification"); // Default source
        item.put("labelType", "Manual"); // Default label type
        item.put("state", "Confirmed"); // Default state
        if ("name".equals(propertyName)) {
          item.put("name", propertyValue);
        }
        break;

      case "owners":
      case "reviewers":
        // Create a valid EntityReference
        item.put("name", propertyValue);
        item.put("type", "user"); // Default type
        item.put("id", UUID.randomUUID().toString()); // Generate UUID for now
        if ("displayName".equals(propertyName)) {
          item.put("displayName", propertyValue);
        }
        break;

      default:
        // Generic array item
        item.put(propertyName, propertyValue);
        break;
    }

    return item;
  }
}
