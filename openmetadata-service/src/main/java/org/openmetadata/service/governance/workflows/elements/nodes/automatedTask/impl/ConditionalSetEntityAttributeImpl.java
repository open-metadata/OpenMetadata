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
 * Conditional entity attribute setter for OpenMetadata workflows.
 *
 * This class sets entity field values based on boolean conditions from previous workflow nodes.
 * It enables dynamic field setting where the value depends on the outcome of condition checks,
 * user approvals, or other boolean results from earlier workflow steps.
 *
 * <h2>Key Features:</h2>
 * <ul>
 *   <li>Sets different values based on boolean conditions</li>
 *   <li>Works with any entity type and any field</li>
 *   <li>Integrates with JSON Logic check results</li>
 *   <li>Supports user approval outcomes</li>
 *   <li>Uses OpenMetadata's JSON deep copy pattern</li>
 *   <li>Smart array handling for tags, owners, reviewers without indices</li>
 * </ul>
 *
 * <h2>Common Use Cases:</h2>
 * <ul>
 *   <li>Set status to "Approved" if quality check passed, "Needs Review" otherwise</li>
 *   <li>Set certification based on data quality score</li>
 *   <li>Set description based on validation results</li>
 *   <li>Set tags based on content analysis outcomes</li>
 * </ul>
 *
 * <h2>Configuration Example:</h2>
 * <pre>{@code
 * {
 *   "type": "automatedTask",
 *   "subType": "conditionalSetEntityAttributeTask",
 *   "name": "SetStatusBasedOnQuality",
 *   "config": {
 *     "fieldName": "status",
 *     "conditionVariableName": "result",
 *     "trueValue": "Approved",
 *     "falseValue": "Needs Review"
 *   },
 *   "input": ["relatedEntity", "updatedBy", "result"],
 *   "inputNamespaceMap": {
 *     "relatedEntity": "global",
 *     "updatedBy": null,
 *     "result": "QualityCheckNode"
 *   }
 * }
 * }</pre>
 *
 * <h2>Smart Array Examples:</h2>
 * <pre>{@code
 * // Set tag based on condition (NO INDEX NEEDED!)
 * {
 *   "fieldName": "tags.tagFQN",
 *   "trueValue": "Quality.High",
 *   "falseValue": "Quality.Low"
 * }
 *
 * // Set owner based on approval
 * {
 *   "fieldName": "owners.name", 
 *   "trueValue": "data.steward",
 *   "falseValue": null  // Remove owner
 * }
 * }</pre>
 *
 * <h2>Input Variables:</h2>
 * <ul>
 *   <li><strong>relatedEntity</strong> (required): Entity to modify</li>
 *   <li><strong>conditionVariable</strong> (required): Boolean result from another node</li>
 *   <li><strong>updatedBy</strong> (optional): User to credit for the change</li>
 * </ul>
 *
 * <h2>Integration with Other Nodes:</h2>
 * <pre>{@code
 * // First: Check quality with JSON Logic
 * {
 *   "name": "CheckQuality",
 *   "subType": "checkEntityAttributesTask",
 *   "config": {
 *     "rules": "{\"and\":[{\"!!\":[{\"var\":\"description\"}]},{\">\": [{\"var\":\"owners.length\"}, 0]}]}"
 *   },
 *   "output": ["result"]
 * }
 *
 * // Then: Set status based on check result
 * {
 *   "name": "SetStatus",
 *   "subType": "conditionalSetEntityAttributeTask",
 *   "config": {
 *     "fieldName": "status",
 *     "conditionVariableName": "result",
 *     "trueValue": "Quality Approved",
 *     "falseValue": "Quality Failed"
 *   },
 *   "inputNamespaceMap": {
 *     "result": "CheckQuality"
 *   }
 * }
 * }</pre>
 *
 * @author OpenMetadata Workflow Engine
 * @version 1.0
 * @since 1.9.0
 * @see SetEntityAttributeImpl for unconditional field setting
 */
@Slf4j
public class ConditionalSetEntityAttributeImpl implements JavaDelegate {
  private Expression fieldNameExpr;
  private Expression conditionVariableNameExpr;
  private Expression trueValueExpr;
  private Expression falseValueExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      String fieldName = (String) fieldNameExpr.getValue(execution);
      String conditionVariableName = (String) conditionVariableNameExpr.getValue(execution);
      String trueValue = (String) trueValueExpr.getValue(execution);
      String falseValue = (String) falseValueExpr.getValue(execution);

      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));

      // Get the condition result from the specified variable
      Object conditionResult =
          varHandler.getNamespacedVariable(
              inputNamespaceMap.get(conditionVariableName), conditionVariableName);

      // Get updatedBy from workflow variables if available
      String updatedBy =
          Optional.ofNullable(
                  (String)
                      varHandler.getNamespacedVariable(
                          inputNamespaceMap.get(UPDATED_BY_VARIABLE), UPDATED_BY_VARIABLE))
              .orElse("admin"); // Default user

      // Determine the value to set based on condition
      String valueToSet = Boolean.TRUE.equals(conditionResult) ? trueValue : falseValue;

      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);
      setEntityFieldConditionally(entity, entityLink.getEntityType(), updatedBy, fieldName, valueToSet);

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
   * Sets an entity field conditionally using JSON deep copy and patch operations.
   *
   * This method follows OpenMetadata's pattern of creating a deep copy of the entity,
   * modifying the copy, and then creating a JSON patch to apply the changes to the database.
   * It supports both simple and nested field operations, including smart array handling.
   *
   * @param entity The entity to modify
   * @param entityType The type of the entity
   * @param user The user making the change
   * @param fieldName The field to set (supports dot notation and smart arrays)
   * @param fieldValue The value to set
   */
  private void setEntityFieldConditionally(
      EntityInterface entity, String entityType, String user, String fieldName, String fieldValue) {
    String originalJson = JsonUtils.pojoToJson(entity);

    // Create a deep copy by converting to JSON and back - this is the OpenMetadata way
    EntityInterface entityCopy = JsonUtils.readValue(originalJson, entity.getClass());

    // Convert copy to map for generic field manipulation
    Map<String, Object> entityMap = JsonUtils.getMap(entityCopy);

    // Set the field value in the map - supports nested fields with dot notation and smart arrays
    setNestedField(entityMap, fieldName, fieldValue);

    // Convert the modified map back to entity
    String modifiedJson = JsonUtils.pojoToJson(entityMap);
    EntityInterface modifiedEntity = JsonUtils.readValue(modifiedJson, entity.getClass());

    // Get the updated JSON from the modified entity
    String updatedJson = JsonUtils.pojoToJson(modifiedEntity);

    // Create patch from original to updated
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    entityRepository.patch(null, entity.getId(), user, patch, null);
  }

  /**
   * Sets a field value in a nested map structure using dot notation path navigation.
   * Includes smart handling for array fields like tags and owners.
   *
   * @param map The root map to modify
   * @param fieldName The field path using dot notation
   * @param fieldValue The value to set, or null/empty to remove the field
   */
  @SuppressWarnings("unchecked")
  private void setNestedField(Map<String, Object> map, String fieldName, String fieldValue) {
    // Handle special array patterns intelligently
    if (isSmartArrayPattern(fieldName)) {
      handleSmartArrayField(map, fieldName, fieldValue);
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

    // Set the final value or remove if null/empty
    String finalKey = parts[parts.length - 1];
    if (fieldValue == null || fieldValue.isEmpty()) {
      currentMap.remove(finalKey);
    } else {
      currentMap.put(finalKey, fieldValue);
    }
  }

  /**
   * Checks if the field pattern requires smart array handling.
   */
  private boolean isSmartArrayPattern(String fieldName) {
    return fieldName.equals("tags.tagFQN") || 
           fieldName.equals("tags.name") ||
           fieldName.equals("owners.name") ||
           fieldName.equals("owners.displayName") ||
           fieldName.equals("reviewers.name") ||
           fieldName.equals("reviewers.displayName");
  }

  /**
   * Handles smart array field operations like tags and owners without requiring array indices.
   */
  @SuppressWarnings("unchecked")
  private void handleSmartArrayField(Map<String, Object> map, String fieldName, String fieldValue) {
    String[] parts = fieldName.split("\\.");
    String arrayFieldName = parts[0]; // e.g., "tags"
    String propertyName = parts[1];   // e.g., "tagFQN"

    // Get or create the array
    List<Map<String, Object>> arrayList = (List<Map<String, Object>>) map.get(arrayFieldName);
    if (arrayList == null) {
      arrayList = new ArrayList<>();
      map.put(arrayFieldName, arrayList);
    }

    if (fieldValue == null || fieldValue.isEmpty()) {
      // Remove item with matching property
      arrayList.removeIf(item -> fieldValue.equals(item.get(propertyName)));
    } else {
      // Find existing item or create new one
      Map<String, Object> targetItem = arrayList.stream()
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
   */
  private Map<String, Object> createDefaultArrayItem(String arrayFieldName, String propertyName, String propertyValue) {
    Map<String, Object> item = new HashMap<>();
    
    switch (arrayFieldName) {
      case "tags":
        // Create a valid TagLabel with required fields
        item.put("tagFQN", propertyValue);
        item.put("source", "Classification"); // Default source
        item.put("labelType", "Manual");      // Default label type
        item.put("state", "Confirmed");       // Default state
        if ("name".equals(propertyName)) {
          item.put("name", propertyValue);
        }
        break;
        
      case "owners":
      case "reviewers":
        // Create a valid EntityReference
        item.put("name", propertyValue);
        item.put("type", "user");           // Default type
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
