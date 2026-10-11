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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.antlr.v4.runtime.misc.ParseCancellationException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSource;
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
      EntityInterface<?> entity,
      EntityRepository<?> repository,
      String user,
      String fieldPath,
      String newDescription) {
    return updateFieldDescription(entity, repository, user, fieldPath, newDescription, null);
  }

  /**
   * Update a field's description, recording where the new text came from.
   *
   * <p>The source rides the patch, so one versioned write carries the provenance into the change
   * summary and, through the normal lifecycle, the search document's {@code descriptionSource}.
   *
   * @param changeSource provenance of the new text, or null to leave it defaulted
   */
  public static boolean updateFieldDescription(
      EntityInterface<?> entity,
      EntityRepository<?> repository,
      String user,
      String fieldPath,
      String newDescription,
      ChangeSource changeSource) {

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
    repository.patch(null, entity.getId(), user, patch, changeSource, null);
    LOG.info(
        "[FieldPathUtils] Updated description at '{}' in entity '{}'", fieldPath, entity.getName());
    return true;
  }

  /**
   * Locate the nested field POJO addressed by {@code fieldPath} (e.g. a Column or SchemaField).
   * Returns empty when the path cannot be resolved. Callers can then read/mutate the POJO via
   * its own getters/setters and generate a JSON patch against the parent entity.
   */
  public static Optional<Object> findField(EntityInterface<?> entity, String fieldPath) {
    FieldPathComponents components = parseFieldPath(fieldPath);
    if (components == null) {
      return Optional.empty();
    }
    return locateField(entity, components);
  }

  /**
   * Resolve the current description for a field path.
   *
   * @param entity The entity to inspect
   * @param fieldPath The field path (e.g., "columns::customer_id::description")
   * @return the current description if the field path could be resolved
   */
  public static Optional<String> getFieldDescription(EntityInterface<?> entity, String fieldPath) {
    if (fieldPath == null
        || fieldPath.isEmpty()
        || fieldPath.equals("description")
        || fieldPath.equals("entity")) {
      return Optional.ofNullable(entity.getDescription());
    }

    FieldPathComponents components = parseFieldPath(fieldPath);
    if (components == null) {
      LOG.warn("[FieldPathUtils] Could not parse field path: {}", fieldPath);
      return Optional.empty();
    }

    return navigateAndGetDescription(entity, components);
  }

  /**
   * Set description on a field identified by field path.
   * Modifies the entity in memory.
   */
  private static boolean setFieldDescription(
      EntityInterface<?> entity, String fieldPath, String description) {

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
  public static FieldPathComponents parseFieldPath(String fieldPath) {
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

    // Handle dot separator format. The property is always the final segment; everything
    // between the container and it is the field name, which may itself be a dotted path
    // into nested children (e.g. columns.profile.personal.full_name.description).
    if (fieldPath.contains(".")) {
      try {
        String[] parts = FullyQualifiedName.split(fieldPath);
        if (parts.length >= 2) {
          boolean hasProperty = parts.length >= 3;
          String property = hasProperty ? parts[parts.length - 1] : "description";
          int fieldEnd = hasProperty ? parts.length - 1 : parts.length;
          String fieldName =
              FullyQualifiedName.unquoteName(
                  String.join(".", Arrays.copyOfRange(parts, 1, fieldEnd)));
          return new FieldPathComponents(parts[0], fieldName, property);
        }
      } catch (ParseCancellationException | IllegalArgumentException e) {
        LOG.warn("[FieldPathUtils] Could not parse dot field path: {}", fieldPath, e);
      }
    }

    return null;
  }

  /** Navigate entity structure and set description on target field. */
  private static boolean navigateAndSetDescription(
      EntityInterface<?> entity, FieldPathComponents components, String description) {
    List<?> fieldList = resolveContainerList(entity, components.containerName());
    if (fieldList == null) {
      LOG.warn("[FieldPathUtils] Unknown container type: {}", components.containerName());
    }
    return fieldList != null
        && setDescriptionInList(fieldList, components.fieldName(), description);
  }

  /** Navigate entity structure and get the description on the target field. */
  private static Optional<String> navigateAndGetDescription(
      EntityInterface<?> entity, FieldPathComponents components) {
    List<?> fieldList = resolveContainerList(entity, components.containerName());
    if (fieldList == null) {
      LOG.warn("[FieldPathUtils] Unknown container type: {}", components.containerName());
    }
    return fieldList == null
        ? Optional.empty()
        : getDescriptionFromList(fieldList, components.fieldName());
  }

  /**
   * Resolve the list of child POJOs that a field path's container segment names.
   *
   * <p>The registry is consulted before the plain reflective getter so that a container segment on
   * a registry type always means what the registry says it means. Falling back to the getter only
   * serves entity types the registry does not cover, for example a dashboard's charts.
   */
  private static List<?> resolveContainerList(EntityInterface<?> entity, String container) {
    List<?> fromRegistry = ChildFieldResolver.containerListFor(entity, container);
    return fromRegistry != null ? fromRegistry : getFieldList(entity, container);
  }

  /**
   * Find field by name in list and set its description.
   * Handles nested paths like "parent.child" by traversing children.
   */
  private static boolean setDescriptionInList(
      List<?> fieldList, String fieldName, String description) {

    // Before any match: an ambiguous name must not be resolved by position, and must not fall
    // through to the nested/recursive branches below either, which would write to a grandchild.
    if (isAmbiguous(fieldList, fieldName)) {
      return false;
    }

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

    // Search the immediate children of every sibling. The recursive "descend into the first
    // matching subtree" shape used to short-circuit on the first sibling whose children
    // contained fieldName, so a bare leaf shared by two siblings' subtrees silently wrote to
    // whichever sibling was iterated first and reported success. Collecting every hit across
    // siblings first turns that first-match write into a detectable, refusable ambiguity.
    List<Object> nestedHits = findNestedHits(fieldList, fieldName);
    if (nestedHits.size() > 1) {
      return false;
    }
    if (nestedHits.size() == 1) {
      return setDescription(nestedHits.get(0), description);
    }

    LOG.warn("[FieldPathUtils] Field '{}' not found in list", fieldName);
    return false;
  }

  /** Find field by name in list and get its description. */
  private static Optional<String> getDescriptionFromList(List<?> fieldList, String fieldName) {

    if (isAmbiguous(fieldList, fieldName)) {
      return Optional.empty();
    }

    Optional<?> field = findFieldByName(fieldList, fieldName);
    if (field.isPresent()) {
      return getDescription(field.get());
    }

    if (fieldName.contains(".")) {
      String[] parts = fieldName.split("\\.", 2);
      String parentName = parts[0];
      String childPath = parts[1];

      Optional<?> parent = findFieldByName(fieldList, parentName);
      if (parent.isPresent()) {
        List<?> children = getFieldListFromObject(parent.get(), "children");
        if (children != null) {
          return getDescriptionFromList(children, childPath);
        }
      }
    }

    // Mirror setDescriptionInList: collect the immediate-children match from every sibling so a
    // bare leaf shared by two siblings' subtrees is refused instead of returning the first hit.
    List<Object> nestedHits = findNestedHits(fieldList, fieldName);
    if (nestedHits.size() > 1) {
      return Optional.empty();
    }
    if (nestedHits.size() == 1) {
      return getDescription(nestedHits.get(0));
    }

    LOG.warn("[FieldPathUtils] Field '{}' not found in list", fieldName);
    return Optional.empty();
  }

  /** Navigate the parsed components to the target field POJO. */
  private static Optional<Object> locateField(
      EntityInterface<?> entity, FieldPathComponents components) {
    String container = components.containerName();
    String fieldName = components.fieldName();

    List<?> fieldList = resolveContainerList(entity, container);
    if (fieldList == null) {
      LOG.warn("[FieldPathUtils] Unknown container type: {}", container);
    }
    return fieldList == null ? Optional.empty() : findFieldInList(fieldList, fieldName);
  }

  /**
   * Locate a field POJO in a list by name, traversing `children` for dotted paths and the
   * immediate-children fallback, mirroring {@link #setDescriptionInList}.
   */
  @SuppressWarnings("unchecked")
  private static Optional<Object> findFieldInList(List<?> fieldList, String fieldName) {
    // The tag path resolves through here (TaskWorkflowHandler.patchFieldTags), so an approved
    // `columns.<name>.tags` on an apiEndpoint would otherwise write onto whichever of the request
    // and response schemas holds that name first. The isAmbiguous guard handles the same-list
    // form; findNestedHits below handles the cross-subtree form.
    if (isAmbiguous(fieldList, fieldName)) {
      return Optional.empty();
    }

    Optional<Object> found = (Optional<Object>) findFieldByName(fieldList, fieldName);
    if (found.isPresent()) {
      return found;
    }

    if (fieldName.contains(".")) {
      String[] parts = fieldName.split("\\.", 2);
      Optional<?> parent = findFieldByName(fieldList, parts[0]);
      if (parent.isPresent()) {
        List<?> children = getFieldListFromObject(parent.get(), "children");
        if (children != null) {
          Optional<Object> childHit = findFieldInList(children, parts[1]);
          if (childHit.isPresent()) {
            return childHit;
          }
        }
      }
    }

    // Mirror the description walkers: collect the immediate-children match from every sibling
    // so a bare leaf shared by two siblings' subtrees is refused instead of resolving to the
    // first sibling's child POJO. Without this, an approved `columns.<name>.tags` suggestion
    // would write onto whichever of the two schemas' same-named fields came first.
    List<Object> nestedHits = findNestedHits(fieldList, fieldName);
    if (nestedHits.size() > 1) {
      return Optional.empty();
    }
    if (nestedHits.size() == 1) {
      return Optional.of(nestedHits.get(0));
    }

    return Optional.empty();
  }

  /** Find a field by name in a list of fields. */
  private static Optional<?> findFieldByName(List<?> fieldList, String name) {
    for (Object item : fieldList) {
      String itemName = (String) ChildFieldResolver.invokeGetter(item, "getName");
      if (name.equals(itemName)) {
        return Optional.of(item);
      }
    }
    return Optional.empty();
  }

  /**
   * Collect every immediate {@code children} entry named {@code fieldName} across the siblings in
   * {@code fieldList}, so the caller can refuse an ambiguous name instead of writing to the first
   * match.
   *
   * <p>Only the immediate {@code children} lists are scanned (one level deep). The previous
   * depth-first "descend into the first matching subtree" fallback resolved a bare leaf shared by
   * two siblings' subtrees to whichever sibling was iterated first and reported success;
   * collecting every sibling's hit first turns that silent first-match write into a detectable
   * ambiguity (size {@code > 1}) the callers refuse to guess.
   */
  private static List<Object> findNestedHits(List<?> fieldList, String fieldName) {
    List<Object> hits = new ArrayList<>();
    for (Object item : fieldList) {
      List<?> children = getFieldListFromObject(item, "children");
      if (children != null && !children.isEmpty()) {
        findFieldByName(children, fieldName).ifPresent(hits::add);
      }
    }
    return hits;
  }

  /**
   * Whether more than one child in this list answers to {@code name}.
   *
   * <p>The {@code columns} alias serves an apiEndpoint by concatenating its request and response
   * schemas, and a REST endpoint normally echoes its request shape in its response, so
   * {@code columns.category.description} names two different fields. Resolving that by position
   * wrote the caller's text onto whichever came first and reported success. A caller that means
   * one of them addresses it through that field's own container
   * ({@code requestSchema.category.description}), which resolves to a single list and is
   * unambiguous.
   */
  private static boolean isAmbiguous(List<?> fieldList, String name) {
    int matches = 0;
    for (Object item : fieldList) {
      if (name.equals(ChildFieldResolver.invokeGetter(item, "getName"))) {
        matches++;
      }
    }
    if (matches > 1) {
      LOG.warn(
          "[FieldPathUtils] Field '{}' matches {} children of this entity; refusing to guess. "
              + "Address it through its own container, e.g. requestSchema.{}.description",
          name,
          matches,
          name);
    }
    return matches > 1;
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

  /** Get description from a field object. */
  private static Optional<String> getDescription(Object field) {
    Object description = ChildFieldResolver.invokeGetter(field, "getDescription");
    return Optional.ofNullable((String) description);
  }

  /** Get a field list from entity by name (columns, fields, schemaFields, etc.). */
  private static List<?> getFieldList(EntityInterface<?> entity, String listName) {
    Object result =
        ChildFieldResolver.invokeGetter(entity, ChildFieldResolver.getterName(listName));
    return result instanceof List<?> ? (List<?>) result : null;
  }

  /** Get a field list from an object by name. */
  private static List<?> getFieldListFromObject(Object obj, String listName) {
    Object result = ChildFieldResolver.invokeGetter(obj, ChildFieldResolver.getterName(listName));
    return result instanceof List<?> ? (List<?>) result : null;
  }
}
