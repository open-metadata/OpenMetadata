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

package org.openmetadata.service.resources.feeds;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.feed.CreateSuggestion;
import org.openmetadata.schema.entity.feed.Suggestion;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.SuggestionPayload;
import org.openmetadata.schema.type.SuggestionStatus;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * Adapter for converting between old Suggestion format and new Task format.
 * This enables backward compatibility for the /api/v1/suggestions endpoint
 * while using the new Task-based storage underneath.
 */
public class SuggestionTaskAdapter {

  /**
   * Convert a CreateSuggestion request to a Task entity.
   */
  public Task createSuggestionToTask(CreateSuggestion create, String createdBy) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(create.getEntityLink());

    EntityReference about =
        Entity.getEntityReferenceByName(
            entityLink.getEntityType(), entityLink.getEntityFQN(), Include.NON_DELETED);

    SuggestionPayload payload = buildSuggestionPayload(create, entityLink);

    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.Suggestion)
            .withStatus(TaskEntityStatus.Open)
            .withPriority(TaskPriority.Medium)
            .withAbout(about)
            .withPayload(payload)
            .withCreatedBy(
                Entity.getEntityReferenceByName(Entity.USER, createdBy, Include.NON_DELETED))
            .withCreatedAt(System.currentTimeMillis())
            .withUpdatedBy(createdBy)
            .withUpdatedAt(System.currentTimeMillis());

    return task;
  }

  /**
   * Build a SuggestionPayload from a CreateSuggestion request.
   */
  private SuggestionPayload buildSuggestionPayload(
      CreateSuggestion create, MessageParser.EntityLink entityLink) {
    SuggestionPayload payload = new SuggestionPayload();

    if (create.getType() == SuggestionType.SuggestDescription) {
      payload.setSuggestionType(SuggestionPayload.SuggestionType.DESCRIPTION);
      payload.setSuggestedValue(create.getDescription());
    } else if (create.getType() == SuggestionType.SuggestTagLabel) {
      payload.setSuggestionType(SuggestionPayload.SuggestionType.TAG);
      if (!nullOrEmpty(create.getTagLabels())) {
        payload.setSuggestedValue(JsonUtils.pojoToJson(create.getTagLabels()));
      }
    }

    String fieldPath = buildFieldPath(entityLink);
    payload.setFieldPath(fieldPath);
    payload.setSource(SuggestionPayload.Source.USER);

    return payload;
  }

  /**
   * Build the field path from an entity link.
   */
  private String buildFieldPath(MessageParser.EntityLink entityLink) {
    if (entityLink.getFieldName() != null) {
      if (entityLink.getArrayFieldName() != null) {
        if (entityLink.getArrayFieldValue() != null) {
          return entityLink.getFieldName()
              + "::"
              + entityLink.getArrayFieldName()
              + "::"
              + entityLink.getArrayFieldValue();
        }
        return entityLink.getFieldName() + "::" + entityLink.getArrayFieldName() + "::description";
      }
      return entityLink.getFieldName();
    }
    return "description";
  }

  /**
   * Convert a Task entity to a Suggestion for API response.
   */
  public Suggestion taskToSuggestion(Task task) {
    Suggestion suggestion = new Suggestion();
    suggestion.setId(task.getId());
    suggestion.setCreatedAt(task.getCreatedAt());
    suggestion.setCreatedBy(task.getCreatedBy());
    suggestion.setUpdatedAt(task.getUpdatedAt());
    suggestion.setUpdatedBy(task.getUpdatedBy());
    suggestion.setStatus(mapTaskStatusToSuggestionStatus(task.getStatus()));

    EntityReference about = task.getAbout();
    if (about != null) {
      String entityLink = buildEntityLink(about, task);
      suggestion.setEntityLink(entityLink);
    }

    Object payloadObj = task.getPayload();
    if (payloadObj instanceof SuggestionPayload payload) {
      suggestion.setType(mapSuggestionType(payload.getSuggestionType()));
      if (payload.getSuggestionType() == SuggestionPayload.SuggestionType.DESCRIPTION) {
        suggestion.setDescription(payload.getSuggestedValue());
      } else if (payload.getSuggestionType() == SuggestionPayload.SuggestionType.TAG) {
        if (payload.getSuggestedValue() != null) {
          try {
            List<TagLabel> tags =
                JsonUtils.readObjects(payload.getSuggestedValue(), TagLabel.class);
            suggestion.setTagLabels(tags);
          } catch (Exception e) {
            // Ignore parse errors
          }
        }
      }
    }

    return suggestion;
  }

  /**
   * Build an entity link string from a Task's about reference.
   */
  private String buildEntityLink(EntityReference about, Task task) {
    StringBuilder entityLink = new StringBuilder();
    entityLink
        .append("<#E::")
        .append(about.getType())
        .append("::")
        .append(about.getFullyQualifiedName());

    Object payloadObj = task.getPayload();
    if (payloadObj instanceof SuggestionPayload payload) {
      String fieldPath = payload.getFieldPath();
      if (fieldPath != null && !fieldPath.equals("description")) {
        if (fieldPath.contains("::")) {
          String[] parts = fieldPath.split("::");
          entityLink.append("::").append(parts[0]);
          if (parts.length > 1) {
            entityLink.append("::").append(parts[1]);
          }
        } else {
          entityLink.append("::").append(fieldPath);
        }
      }
    }

    entityLink.append(">");
    return entityLink.toString();
  }

  /**
   * Map Task status to Suggestion status.
   */
  private SuggestionStatus mapTaskStatusToSuggestionStatus(TaskEntityStatus status) {
    if (status == null) {
      return SuggestionStatus.Open;
    }
    return switch (status) {
      case Open, InProgress, Pending -> SuggestionStatus.Open;
      case Approved, Completed -> SuggestionStatus.Accepted;
      case Rejected, Cancelled, Failed -> SuggestionStatus.Rejected;
    };
  }

  /**
   * Map SuggestionPayload.SuggestionType to SuggestionType.
   */
  private SuggestionType mapSuggestionType(SuggestionPayload.SuggestionType type) {
    if (type == null) {
      return SuggestionType.SuggestDescription;
    }
    return switch (type) {
      case DESCRIPTION -> SuggestionType.SuggestDescription;
      case TAG -> SuggestionType.SuggestTagLabel;
      default -> SuggestionType.SuggestDescription;
    };
  }

  /**
   * Map old SuggestionType to new SuggestionPayload.SuggestionType.
   */
  public SuggestionPayload.SuggestionType mapToPayloadSuggestionType(SuggestionType type) {
    if (type == null) {
      return SuggestionPayload.SuggestionType.DESCRIPTION;
    }
    return switch (type) {
      case SuggestDescription -> SuggestionPayload.SuggestionType.DESCRIPTION;
      case SuggestTagLabel -> SuggestionPayload.SuggestionType.TAG;
    };
  }
}
