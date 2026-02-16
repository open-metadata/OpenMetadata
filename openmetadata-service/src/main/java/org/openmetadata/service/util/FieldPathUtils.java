/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import jakarta.json.JsonPatch;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * Utility for resolving and updating fields in entities using field paths.
 *
 * <p>Supports various field path formats:
 * - Simple: "description"
 * - Column/Field: "columns::column_name::description" or "columns.column_name.description"
 * - Nested: "messageSchema::\"parent.child\"::description" (Topic schema fields)
 * - Array index: "columns[0].description"
 *
 * <p>Uses "modify in memory, then diff" approach for clean patch generation.
 */
@Slf4j
public class FieldPathUtils {

  private FieldPathUtils() {}

  /**
   * Update a field's description in the entity and apply the change via patch.
   *
   * @param entity The entity to update
   * @param repository The entity repository
   * @param user The user making the change
   * @param fieldPath The field path (e.g., "columns::customer_id::description")
   * @param newDescription The new description value
   * @return true if update was successful
   */
  public static boolean updateFieldDescription(
      EntityInterface entity,
      EntityRepository<?> repository,
      String user,
      String fieldPath,
      String newDescription) {

    // Take snapshot before modification
    String originalJson = JsonUtils.pojoToJson(entity);

    // Parse field path and update in memory
    boolean updated = setFieldDescription(entity, fieldPath, newDescription);
    if (!updated) {
      LOG.warn("[FieldPathUtils] Could not update field at path: {}", fieldPath);
      return false;
    }

    // Generate patch from diff
    String updatedJson = JsonUtils.pojoToJson(entity);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

    if (patch == null || patch.toJsonArray().isEmpty()) {
      LOG.debug("[FieldPathUtils] No changes detected for field path: {}", fieldPath);
      return true; // No changes needed
    }

    // Apply patch
    repository.patch(null, entity.getId(), user, patch, null, null);
    LOG.info(
        "[FieldPathUtils] Updated description at '{}' in entity '{}'", fieldPath, entity.getName());
    return true;
  }

  /**
   * Set description on a field identified by field path.
   * Modifies the entity in memory.
   */
  private static boolean setFieldDescription(
      EntityInterface entity, String fieldPath, String description) {

    // Handle entity-level description
    if (fieldPath == null
        || fieldPath.isEmpty()
        || fieldPath.equals("description")
        || fieldPath.equals("entity")) {
      entity.setDescription(description);
      return true;
    }

    // Parse the field path to extract components
    FieldPathComponents components = parseFieldPath(fieldPath);
    if (components == null) {
      LOG.warn("[FieldPathUtils] Could not parse field path: {}", fieldPath);
      return false;
    }

    // Navigate to the field and set description
    return navigateAndSetDescription(entity, components, description);
  }

  /** Parsed components of a field path. */
  public record FieldPathComponents(
      String containerName, // e.g., "columns", "messageSchema", "schemaFields"
      String fieldName, // e.g., "customer_id", "level.somefield"
      String property // e.g., "description", "tags"
      ) {}

  /**
   * Parse field path into components.
   * Supports formats:
   * - "columns::field_name::description"
   * - "columns.field_name.description"
   * - "messageSchema::\"nested.field\"::description"
   */
  static FieldPathComponents parseFieldPath(String fieldPath) {
    if (fieldPath == null || fieldPath.isEmpty()) {
      return null;
    }

    // Handle :: separator format (most common for tasks)
    if (fieldPath.contains("::")) {
      String[] parts = fieldPath.split("::");
      if (parts.length >= 2) {
        String container = parts[0];
        String fieldName = parts[1];

        // Remove quotes from field name if present
        if (fieldName.startsWith("\"") && fieldName.endsWith("\"")) {
          fieldName = fieldName.substring(1, fieldName.length() - 1);
        }

        String property = parts.length >= 3 ? parts[2] : "description";
        return new FieldPathComponents(container, fieldName, property);
      }
    }

    // Handle array index format: columns[0].description (check BEFORE dot format)
    if (fieldPath.contains("[")) {
      int bracketStart = fieldPath.indexOf('[');
      int bracketEnd = fieldPath.indexOf(']');
      if (bracketStart > 0 && bracketEnd > bracketStart) {
        String container = fieldPath.substring(0, bracketStart);
        String index = fieldPath.substring(bracketStart + 1, bracketEnd);
        String remainder =
            bracketEnd + 1 < fieldPath.length()
                ? fieldPath.substring(bracketEnd + 2)
                : "description";
        return new FieldPathComponents(container, index, remainder);
      }
    }

    // Handle dot separator format
    if (fieldPath.contains(".")) {
      String[] parts = fieldPath.split("\\.", 3);
      if (parts.length >= 2) {
        return new FieldPathComponents(
            parts[0], parts[1], parts.length >= 3 ? parts[2] : "description");
      }
    }

    return null;
  }

  /** Navigate entity structure and set description on target field. */
  private static boolean navigateAndSetDescription(
      EntityInterface entity, FieldPathComponents components, String description) {

    String container = components.containerName();
    String fieldName = components.fieldName();

    // Try direct field lists first (columns, fields, schemaFields, tasks, charts)
    List<?> fieldList = getFieldList(entity, container);
    if (fieldList != null) {
      return setDescriptionInList(fieldList, fieldName, description);
    }

    // Handle nested containers (messageSchema.schemaFields, dataModel.columns)
    return handleNestedContainer(entity, container, fieldName, description);
  }

  /** Handle nested containers like messageSchema.schemaFields or dataModel.columns. */
  private static boolean handleNestedContainer(
      EntityInterface entity, String container, String fieldName, String description) {

    // Topic: messageSchema -> schemaFields
    if ("messageSchema".equals(container)) {
      Object schema = invokeGetter(entity, "getMessageSchema");
      if (schema != null) {
        List<?> schemaFields = getFieldListFromObject(schema, "schemaFields");
        if (schemaFields != null) {
          return setDescriptionInList(schemaFields, fieldName, description);
        }
      }
    }

    // Container: dataModel -> columns
    if ("dataModel".equals(container)) {
      Object dataModel = invokeGetter(entity, "getDataModel");
      if (dataModel != null) {
        List<?> columns = getFieldListFromObject(dataModel, "columns");
        if (columns != null) {
          return setDescriptionInList(columns, fieldName, description);
        }
      }
    }

    // API Endpoint: responseSchema/requestSchema -> schemaFields
    if ("responseSchema".equals(container) || "requestSchema".equals(container)) {
      String methodName = "get" + capitalize(container);
      Object schema = invokeGetter(entity, methodName);
      if (schema != null) {
        List<?> schemaFields = getFieldListFromObject(schema, "schemaFields");
        if (schemaFields != null) {
          return setDescriptionInList(schemaFields, fieldName, description);
        }
      }
    }

    LOG.warn("[FieldPathUtils] Unknown container type: {}", container);
    return false;
  }

  /**
   * Find field by name in list and set its description.
   * Handles nested paths like "parent.child" by traversing children.
   */
  private static boolean setDescriptionInList(
      List<?> fieldList, String fieldName, String description) {

    // Try exact match first
    Optional<?> field = findFieldByName(fieldList, fieldName);
    if (field.isPresent()) {
      return setDescription(field.get(), description);
    }

    // Handle nested path (e.g., "parent.child")
    if (fieldName.contains(".")) {
      String[] parts = fieldName.split("\\.", 2);
      String parentName = parts[0];
      String childPath = parts[1];

      Optional<?> parent = findFieldByName(fieldList, parentName);
      if (parent.isPresent()) {
        List<?> children = getFieldListFromObject(parent.get(), "children");
        if (children != null) {
          return setDescriptionInList(children, childPath, description);
        }
      }
    }

    // Search recursively in children
    for (Object item : fieldList) {
      List<?> children = getFieldListFromObject(item, "children");
      if (children != null && !children.isEmpty()) {
        if (setDescriptionInList(children, fieldName, description)) {
          return true;
        }
      }
    }

    LOG.warn("[FieldPathUtils] Field '{}' not found in list", fieldName);
    return false;
  }

  /** Find a field by name in a list of fields. */
  private static Optional<?> findFieldByName(List<?> fieldList, String name) {
    for (Object item : fieldList) {
      String itemName = (String) invokeGetter(item, "getName");
      if (name.equals(itemName)) {
        return Optional.of(item);
      }
    }
    return Optional.empty();
  }

  /** Set description on a field object. */
  private static boolean setDescription(Object field, String description) {
    try {
      Method setter = field.getClass().getMethod("setDescription", String.class);
      setter.invoke(field, description);
      return true;
    } catch (Exception e) {
      LOG.warn("[FieldPathUtils] Could not set description: {}", e.getMessage());
      return false;
    }
  }

  /** Get a field list from entity by name (columns, fields, schemaFields, etc.). */
  private static List<?> getFieldList(EntityInterface entity, String listName) {
    String methodName = "get" + capitalize(listName);
    Object result = invokeGetter(entity, methodName);
    return result instanceof List<?> ? (List<?>) result : null;
  }

  /** Get a field list from an object by name. */
  private static List<?> getFieldListFromObject(Object obj, String listName) {
    String methodName = "get" + capitalize(listName);
    Object result = invokeGetter(obj, methodName);
    return result instanceof List<?> ? (List<?>) result : null;
  }

  /** Invoke a getter method on an object. */
  private static Object invokeGetter(Object obj, String methodName) {
    try {
      Method method = obj.getClass().getMethod(methodName);
      return method.invoke(obj);
    } catch (NoSuchMethodException e) {
      // Expected for some entity types
      return null;
    } catch (Exception e) {
      LOG.debug("[FieldPathUtils] Could not invoke {}: {}", methodName, e.getMessage());
      return null;
    }
  }

  /** Capitalize first letter of a string. */
  private static String capitalize(String s) {
    return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
  }
}
