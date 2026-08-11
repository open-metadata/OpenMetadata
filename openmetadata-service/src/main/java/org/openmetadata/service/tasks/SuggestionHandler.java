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

package org.openmetadata.service.tasks;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.json.JsonPatchBuilder;
import jakarta.json.JsonReader;
import jakarta.json.JsonValue;
import java.io.StringReader;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.SuggestionPayload;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * Generic handler for applying suggestions to entities.
 * Replaces per-entity applySuggestion() methods with a unified approach.
 */
@Slf4j
public class SuggestionHandler {

  /**
   * Apply a suggestion task to its target entity.
   * This is a generic handler that works with any entity type.
   */
  public void applySuggestion(Task suggestionTask, String resolvedBy) {
    if (suggestionTask.getType() != TaskEntityType.Suggestion) {
      throw new IllegalArgumentException(
          "Task is not a suggestion task: " + suggestionTask.getType());
    }

    Object payload = suggestionTask.getPayload();
    SuggestionPayload suggestionPayload;

    if (payload instanceof SuggestionPayload sp) {
      suggestionPayload = sp;
    } else if (payload != null) {
      // Convert from LinkedHashMap or other generic type to SuggestionPayload
      try {
        suggestionPayload = JsonUtils.convertValue(payload, SuggestionPayload.class);
        suggestionTask.setPayload(suggestionPayload);
      } catch (Exception e) {
        throw new IllegalArgumentException(
            "Task payload cannot be converted to SuggestionPayload: " + e.getMessage());
      }
    } else {
      throw new IllegalArgumentException("Task does not have a payload");
    }

    EntityReference about = suggestionTask.getAbout();
    if (about == null) {
      throw new IllegalArgumentException("Suggestion task has no target entity (about)");
    }

    EntityRepository<?> repository = Entity.getEntityRepository(about.getType());
    EntityInterface entity = repository.get(null, about.getId(), repository.getFields("*"));

    String origJson = JsonUtils.pojoToJson(entity);
    JsonPatch patch = generatePatch(entity, suggestionPayload);

    if (patch == null || patch.toJsonArray().isEmpty()) {
      LOG.warn("No changes to apply for suggestion task {}", suggestionTask.getTaskId());
      return;
    }

    repository.patch(null, entity.getId(), resolvedBy, patch);

    LOG.info(
        "Applied suggestion {} to entity {} by user {}",
        suggestionTask.getTaskId(),
        about.getFullyQualifiedName(),
        resolvedBy);
  }

  /**
   * Approve a suggestion task - applies the suggestion and marks task as approved.
   */
  public void approveSuggestion(Task task, String approvedBy, String comment) {
    applySuggestion(task, approvedBy);

    task.setStatus(TaskEntityStatus.Approved);
    task.setResolution(
        new TaskResolution()
            .withType(TaskResolutionType.Approved)
            .withResolvedBy(Entity.getEntityReferenceByName(Entity.USER, approvedBy, null))
            .withResolvedAt(System.currentTimeMillis())
            .withComment(comment)
            .withNewValue(getSuggestedValue(task)));
  }

  /**
   * Reject a suggestion task.
   */
  public void rejectSuggestion(Task task, String rejectedBy, String reason) {
    task.setStatus(TaskEntityStatus.Rejected);
    task.setResolution(
        new TaskResolution()
            .withType(TaskResolutionType.Rejected)
            .withResolvedBy(Entity.getEntityReferenceByName(Entity.USER, rejectedBy, null))
            .withResolvedAt(System.currentTimeMillis())
            .withComment(reason));
  }

  private String getSuggestedValue(Task task) {
    Object payload = task.getPayload();
    if (payload instanceof SuggestionPayload suggestionPayload) {
      return suggestionPayload.getSuggestedValue();
    }
    return null;
  }

  /**
   * Generate JSON Patch based on suggestion type and field path.
   */
  private JsonPatch generatePatch(EntityInterface entity, SuggestionPayload payload) {
    String fieldPath = payload.getFieldPath();
    SuggestionPayload.SuggestionType suggestionType = payload.getSuggestionType();

    if (suggestionType == null) {
      LOG.warn("Suggestion type is null, cannot generate patch");
      return null;
    }

    return switch (suggestionType) {
      case DESCRIPTION -> generateDescriptionPatch(fieldPath, payload.getSuggestedValue());
      case TAG -> generateTagsPatch(fieldPath, payload.getSuggestedValue());
      case OWNER -> generateOwnerPatch(payload.getSuggestedValue());
      case TIER -> generateTierPatch(payload.getSuggestedValue());
      case DOMAIN -> generateDomainPatch(payload.getSuggestedValue());
      case CUSTOM_PROPERTY -> generateCustomPropertyPatch(fieldPath, payload.getSuggestedValue());
    };
  }

  /**
   * Generate patch for description field.
   * Handles both entity-level description and nested field descriptions.
   */
  private JsonPatch generateDescriptionPatch(String fieldPath, String newValue) {
    String jsonPointer = convertToJsonPointer(fieldPath);
    JsonPatchBuilder builder = Json.createPatchBuilder();

    if (nullOrEmpty(newValue)) {
      builder.remove(jsonPointer);
    } else {
      builder.replace(jsonPointer, newValue);
    }

    return builder.build();
  }

  /**
   * Generate patch for tags field.
   */
  private JsonPatch generateTagsPatch(String fieldPath, String tagsJson) {
    String jsonPointer = convertToJsonPointer(fieldPath);
    if (!jsonPointer.endsWith("/tags")) {
      jsonPointer = jsonPointer + "/tags";
    }

    JsonPatchBuilder builder = Json.createPatchBuilder();

    if (nullOrEmpty(tagsJson)) {
      builder.replace(jsonPointer, Json.createArrayBuilder().build());
    } else {
      try {
        List<TagLabel> tags = JsonUtils.readObjects(tagsJson, TagLabel.class);
        String tagsJsonStr = JsonUtils.pojoToJson(tags);
        JsonValue tagsValue = parseJsonValue(tagsJsonStr);
        builder.replace(jsonPointer, tagsValue);
      } catch (Exception e) {
        LOG.error("Failed to parse tags JSON: {}", tagsJson, e);
        return null;
      }
    }

    return builder.build();
  }

  /**
   * Generate patch for owner field.
   */
  private JsonPatch generateOwnerPatch(String ownerJson) {
    JsonPatchBuilder builder = Json.createPatchBuilder();

    if (nullOrEmpty(ownerJson)) {
      builder.remove("/owners");
    } else {
      try {
        JsonValue ownerValue = parseJsonValue(ownerJson);
        builder.replace("/owners", ownerValue);
      } catch (Exception e) {
        LOG.error("Failed to parse owner JSON: {}", ownerJson, e);
        return null;
      }
    }

    return builder.build();
  }

  /**
   * Generate patch for tier field.
   */
  private JsonPatch generateTierPatch(String tierFqn) {
    JsonPatchBuilder builder = Json.createPatchBuilder();

    if (nullOrEmpty(tierFqn)) {
      builder.remove("/tags");
    } else {
      builder.add(
          "/tags/-",
          Json.createObjectBuilder()
              .add("tagFQN", tierFqn)
              .add("source", "Classification")
              .add("labelType", "Manual")
              .build());
    }

    return builder.build();
  }

  /**
   * Generate patch for domain field.
   */
  private JsonPatch generateDomainPatch(String domainJson) {
    JsonPatchBuilder builder = Json.createPatchBuilder();

    if (nullOrEmpty(domainJson)) {
      builder.remove("/domain");
    } else {
      try {
        JsonValue domainValue = parseJsonValue(domainJson);
        builder.replace("/domain", domainValue);
      } catch (Exception e) {
        LOG.error("Failed to parse domain JSON: {}", domainJson, e);
        return null;
      }
    }

    return builder.build();
  }

  /**
   * Generate patch for custom property.
   */
  private JsonPatch generateCustomPropertyPatch(String fieldPath, String value) {
    String jsonPointer = "/extension/" + fieldPath.replace("extension.", "");
    JsonPatchBuilder builder = Json.createPatchBuilder();

    if (nullOrEmpty(value)) {
      builder.remove(jsonPointer);
    } else {
      try {
        JsonValue jsonValue = parseJsonValue(value);
        builder.replace(jsonPointer, jsonValue);
      } catch (Exception e) {
        builder.replace(jsonPointer, value);
      }
    }

    return builder.build();
  }

  /**
   * Parse a JSON string into a Jakarta JsonValue.
   */
  private JsonValue parseJsonValue(String jsonString) {
    try (JsonReader reader = Json.createReader(new StringReader(jsonString))) {
      return reader.readValue();
    }
  }

  /**
   * Convert field path to JSON pointer.
   * Examples:
   * - "description" → "/description"
   * - "columns[0].description" → "/columns/0/description"
   * - "columns.customer_id.description" → "/columns/customer_id/description"
   */
  private String convertToJsonPointer(String fieldPath) {
    if (nullOrEmpty(fieldPath)) {
      return "/description";
    }

    StringBuilder pointer = new StringBuilder("/");
    String[] parts = fieldPath.split("\\.");

    for (int i = 0; i < parts.length; i++) {
      String part = parts[i];

      // Handle array index notation: columns[0] or columns[name='customer_id']
      if (part.contains("[")) {
        int bracketStart = part.indexOf('[');
        String arrayName = part.substring(0, bracketStart);
        String indexPart = part.substring(bracketStart + 1, part.length() - 1);

        pointer.append(arrayName).append("/");

        // If it's a numeric index, use directly
        if (indexPart.matches("\\d+")) {
          pointer.append(indexPart);
        } else {
          // It's a name reference like name='customer_id'
          // For now, pass through as-is (actual resolution would need entity data)
          pointer.append(indexPart.replace("name='", "").replace("'", ""));
        }
      } else {
        pointer.append(part);
      }

      if (i < parts.length - 1) {
        pointer.append("/");
      }
    }

    return pointer.toString();
  }
}
