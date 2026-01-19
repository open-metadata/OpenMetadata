package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TAG;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.type.RecognizerException;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.Resolution;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class RecognizerFeedbackRepository {

  private final CollectionDAO daoCollection;
  private final TagRepository tagRepository;

  public RecognizerFeedbackRepository(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
    this.tagRepository = (TagRepository) Entity.getEntityRepository(TAG);
  }

  public RecognizerFeedback create(RecognizerFeedback feedback) {
    if (feedback.getId() == null) {
      feedback.setId(UUID.randomUUID());
    }

    if (feedback.getCreatedAt() == null) {
      feedback.setCreatedAt(System.currentTimeMillis());
    }

    if (feedback.getStatus() == null) {
      feedback.setStatus(RecognizerFeedback.Status.PENDING);
    }

    String json = JsonUtils.pojoToJson(feedback);
    daoCollection.recognizerFeedbackDAO().insert(json);

    publishChangeEvent(feedback);

    return feedback;
  }

  private void publishChangeEvent(RecognizerFeedback feedback) {
    try {
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(feedback.getEntityLink());

      String userName =
          feedback.getCreatedBy() != null ? feedback.getCreatedBy().getName() : "unknown";

      ChangeEvent changeEvent =
          new ChangeEvent()
              .withId(UUID.randomUUID())
              .withEventType(EventType.ENTITY_CREATED)
              .withEntityType(Entity.RECOGNIZER_FEEDBACK)
              .withEntityId(feedback.getId())
              .withEntityFullyQualifiedName(feedback.getId().toString())
              .withUserName(userName)
              .withTimestamp(feedback.getCreatedAt())
              .withCurrentVersion(1.0)
              .withPreviousVersion(0.0);

      Entity.getChangeEventRepository().insert(changeEvent);

      LOG.debug(
          "Published ChangeEvent for RecognizerFeedback {} on entity {}",
          feedback.getId(),
          entityLink.getLinkString());
    } catch (Exception e) {
      LOG.error("Failed to publish ChangeEvent for RecognizerFeedback {}", feedback.getId(), e);
    }
  }

  public RecognizerFeedback processFeedback(RecognizerFeedback feedback, String updatedBy) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(feedback.getEntityLink());
    EntityUtil.validateEntityLink(entityLink);

    validateTagIsAutoApplied(feedback.getEntityLink(), feedback.getTagFQN());

    feedback.setStatus(RecognizerFeedback.Status.PENDING);
    feedback.setCreatedBy(getUserReference(updatedBy));

    return create(feedback);
  }

  public RecognizerFeedback applyFeedback(RecognizerFeedback feedback, String reviewedBy) {
    if (feedback.getStatus() != RecognizerFeedback.Status.PENDING) {
      throw new IllegalStateException(
          String.format("Cannot apply feedback in status %s", feedback.getStatus()));
    }

    Tag tag =
        tagRepository.getByName(null, feedback.getTagFQN(), tagRepository.getFields("recognizers"));

    if (tag.getRecognizers() != null) {
      Tag originalTag = JsonUtils.readValue(JsonUtils.pojoToJson(tag), Tag.class);

      for (Recognizer recognizer : tag.getRecognizers()) {
        if (shouldUpdateRecognizer(recognizer, feedback)) {
          addExceptionToRecognizer(recognizer, feedback);
        }
      }

      tagRepository.patch(
          null,
          tag.getId(),
          reviewedBy,
          JsonUtils.getJsonPatch(originalTag, tag),
          reviewedBy != null ? ChangeSource.MANUAL : ChangeSource.AUTOMATED);
    }

    removeTagFromEntity(feedback.getEntityLink(), feedback.getTagFQN(), reviewedBy);

    feedback.setStatus(RecognizerFeedback.Status.APPLIED);
    feedback.setResolution(createAppliedResolution(reviewedBy));

    return update(feedback);
  }

  public RecognizerFeedback rejectFeedback(
      RecognizerFeedback feedback, String reviewedBy, String comment) {
    if (feedback.getStatus() != RecognizerFeedback.Status.PENDING) {
      throw new IllegalStateException(
          String.format("Cannot reject feedback in status %s", feedback.getStatus()));
    }

    feedback.setStatus(RecognizerFeedback.Status.REJECTED);
    feedback.setResolution(createRejectedResolution(reviewedBy, comment));

    return update(feedback);
  }

  public RecognizerFeedback update(RecognizerFeedback feedback) {
    String json = JsonUtils.pojoToJson(feedback);
    daoCollection.recognizerFeedbackDAO().update(feedback.getId(), json);
    return feedback;
  }

  public RecognizerFeedback get(UUID id) {
    String json = daoCollection.recognizerFeedbackDAO().findById(id);
    if (json == null) {
      throw new org.openmetadata.service.exception.EntityNotFoundException(
          "Feedback not found: " + id);
    }
    return JsonUtils.readValue(json, RecognizerFeedback.class);
  }

  private void addExceptionToRecognizer(Recognizer recognizer, RecognizerFeedback feedback) {
    if (recognizer.getExceptionList() == null) {
      recognizer.setExceptionList(new ArrayList<>());
    }

    boolean exists =
        recognizer.getExceptionList().stream()
            .anyMatch(e -> e.getEntityLink().equals(feedback.getEntityLink()));

    if (!exists) {
      String userReason = feedback.getUserReason().toString();
      if (feedback.getUserComments() != null) {
        userReason += ": " + feedback.getUserComments();
      }

      RecognizerException exception =
          new RecognizerException()
              .withEntityLink(feedback.getEntityLink())
              .withReason(userReason)
              .withAddedBy(feedback.getCreatedBy())
              .withAddedAt(System.currentTimeMillis())
              .withFeedbackId(feedback.getId());

      recognizer.getExceptionList().add(exception);
      LOG.info(
          "Added exception for entity {} to recognizer {}",
          feedback.getEntityLink(),
          recognizer.getName());
    }
  }

  private boolean shouldUpdateRecognizer(Recognizer recognizer, RecognizerFeedback feedback) {
    return feedback.getFeedbackType() == RecognizerFeedback.FeedbackType.FALSE_POSITIVE;
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private void validateTagIsAutoApplied(String entityLink, String tagFQN) {
    try {
      MessageParser.EntityLink parsedLink = MessageParser.EntityLink.parse(entityLink);

      String entityType = parsedLink.getEntityType();
      String entityFQN = parsedLink.getEntityFQN();
      String fieldName = parsedLink.getFieldName();
      String arrayFieldName = parsedLink.getArrayFieldName();

      EntityRepository repository = (EntityRepository) Entity.getEntityRepository(entityType);
      if (repository == null) {
        throw new IllegalArgumentException("Unknown entity type: " + entityType);
      }

      org.openmetadata.schema.EntityInterface entity =
          (org.openmetadata.schema.EntityInterface)
              repository.getByName(null, entityFQN, repository.getFields("tags"));

      List<TagLabel> tagsToCheck = null;

      if (Entity.TABLE.equals(entityType) && Entity.FIELD_COLUMNS.equals(fieldName)) {
        TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
        List<Column> results =
            tableRepository
                .getTableColumnsByFQN(
                    entity.getFullyQualifiedName(), Integer.MAX_VALUE, 0, "tags", null, null, null)
                .getData();

        for (Column column : results) {
          if (column.getName().equals(arrayFieldName)) {
            tagsToCheck = column.getTags();
            break;
          }
        }
      } else if (arrayFieldName != null && fieldName != null) {
        String entityJson = JsonUtils.pojoToJson(entity);
        com.fasterxml.jackson.databind.JsonNode rootNode = JsonUtils.readTree(entityJson);

        if (rootNode.has(fieldName) && rootNode.get(fieldName).isArray()) {
          com.fasterxml.jackson.databind.node.ArrayNode arrayNode =
              (com.fasterxml.jackson.databind.node.ArrayNode) rootNode.get(fieldName);

          for (int i = 0; i < arrayNode.size(); i++) {
            com.fasterxml.jackson.databind.JsonNode fieldNode = arrayNode.get(i);
            if (fieldNode.has("name") && fieldNode.get("name").asText().equals(arrayFieldName)) {
              if (fieldNode.has("tags") && fieldNode.get("tags").isArray()) {
                tagsToCheck =
                    JsonUtils.readValue(
                        fieldNode.get("tags").toString(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<TagLabel>>() {});
              }
              break;
            }
          }
        }
      } else {
        tagsToCheck = entity.getTags();
      }

      if (tagsToCheck != null) {
        boolean isAutoApplied =
            tagsToCheck.stream()
                .anyMatch(
                    tag ->
                        tag.getTagFQN().equals(tagFQN)
                            && tag.getLabelType() == TagLabel.LabelType.GENERATED);

        if (!isAutoApplied) {
          throw new IllegalArgumentException(
              "Feedback can only be submitted for auto-applied tags");
        }
      } else {
        throw new IllegalArgumentException("Tag not found on entity");
      }
    } catch (Exception e) {
      if (e instanceof IllegalArgumentException) {
        throw e;
      }
      throw new RuntimeException("Failed to validate tag", e);
    }
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private void removeTagFromEntity(String entityLink, String tagFQN, String updatedBy) {
    try {
      MessageParser.EntityLink parsedLink = MessageParser.EntityLink.parse(entityLink);

      String entityType = parsedLink.getEntityType();
      String entityFQN = parsedLink.getEntityFQN();
      String fieldName = parsedLink.getFieldName();
      String arrayFieldName = parsedLink.getArrayFieldName();

      EntityRepository repository = (EntityRepository) Entity.getEntityRepository(entityType);
      if (repository == null) {
        LOG.error("Unknown entity type: {}", entityType);
        return;
      }

      org.openmetadata.schema.EntityInterface entity =
          (org.openmetadata.schema.EntityInterface)
              repository.getByName(null, entityFQN, repository.getFields("tags"));

      org.openmetadata.schema.EntityInterface originalEntity =
          JsonUtils.readValue(JsonUtils.pojoToJson(entity), entity.getClass());

      boolean entityModified = false;

      if (Entity.TABLE.equals(entityType) && Entity.FIELD_COLUMNS.equals(fieldName)) {
        TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
        List<Column> results =
            tableRepository
                .getTableColumnsByFQN(
                    entity.getFullyQualifiedName(), Integer.MAX_VALUE, 0, "tags", null, null, null)
                .getData();

        originalEntity =
            ((Table) originalEntity)
                .withColumns(
                    results.stream()
                        .map(c -> JsonUtils.readValue(JsonUtils.pojoToJson(c), c.getClass()))
                        .collect(Collectors.toList()));

        for (Column column : results) {
          if (column.getName().equals(arrayFieldName)) {
            entityModified =
                column
                    .getTags()
                    .removeIf(
                        tag ->
                            tag.getTagFQN().equals(tagFQN)
                                && tag.getLabelType() == TagLabel.LabelType.GENERATED);
            break;
          }
        }

        entity = ((Table) entity).withColumns(results);

      } else if (arrayFieldName != null) {
        // Tag is on a nested field (schemaFields, requestSchema, responseSchema, etc.)
        // We need to handle this through JSON manipulation since we don't know the specific
        // structure

        // Convert entity to JSON for manipulation
        String entityJson = JsonUtils.pojoToJson(entity);
        com.fasterxml.jackson.databind.JsonNode rootNode = JsonUtils.readTree(entityJson);

        // Try to find and update the nested field
        if (rootNode.has(fieldName) && rootNode.get(fieldName).isArray()) {
          com.fasterxml.jackson.databind.node.ArrayNode arrayNode =
              (com.fasterxml.jackson.databind.node.ArrayNode) rootNode.get(fieldName);

          // Find the specific field in the array
          for (int i = 0; i < arrayNode.size(); i++) {
            com.fasterxml.jackson.databind.JsonNode fieldNode = arrayNode.get(i);
            if (fieldNode.has("name") && fieldNode.get("name").asText().equals(arrayFieldName)) {
              // Found the field, now remove the tag
              if (fieldNode.has("tags") && fieldNode.get("tags").isArray()) {
                com.fasterxml.jackson.databind.node.ArrayNode tagsArray =
                    (com.fasterxml.jackson.databind.node.ArrayNode) fieldNode.get("tags");

                // Create new array without the matching tag
                com.fasterxml.jackson.databind.node.ArrayNode newTagsArray =
                    JsonUtils.getObjectMapper().createArrayNode();

                for (com.fasterxml.jackson.databind.JsonNode tagNode : tagsArray) {
                  if (!(tagNode.has("tagFQN")
                      && tagNode.get("tagFQN").asText().equals(tagFQN)
                      && tagNode.has("labelType")
                      && "AUTOMATED".equals(tagNode.get("labelType").asText()))) {
                    newTagsArray.add(tagNode);
                  } else {
                    entityModified = true;
                  }
                }

                // Replace the tags array with the filtered one
                ((com.fasterxml.jackson.databind.node.ObjectNode) fieldNode)
                    .set("tags", newTagsArray);
              }
              break;
            }
          }
        }

        if (entityModified) {
          // Convert back to entity object
          entity = JsonUtils.readValue(rootNode.toString(), entity.getClass());
        }
      } else if (fieldName != null) {
        // Tag is on a regular field of the entity
        // This is less common for tags, but handle it for completeness
        LOG.info("Removing tag from regular field is not yet supported");
        return;
      } else {
        // Tag is on the entity itself
        if (entity.getTags() != null) {
          entityModified =
              entity
                  .getTags()
                  .removeIf(
                      tag ->
                          tag.getTagFQN().equals(tagFQN)
                              && tag.getLabelType() == TagLabel.LabelType.GENERATED);
        }
      }

      if (entityModified) {
        // Update the entity
        repository.patch(
            null, entity.getId(), updatedBy, JsonUtils.getJsonPatch(originalEntity, entity));
        LOG.info("Removed auto-applied tag {} from entity {}", tagFQN, entityLink);
      }
    } catch (Exception e) {
      LOG.error("Failed to remove tag from entity: {}", entityLink, e);
    }
  }

  private Resolution createAppliedResolution(String reviewedBy) {
    return new Resolution()
        .withAction(Resolution.Action.ADDED_TO_EXCEPTION_LIST)
        .withResolvedBy(getUserReference(reviewedBy))
        .withResolvedAt(System.currentTimeMillis())
        .withResolutionNotes("Feedback accepted and applied");
  }

  private Resolution createRejectedResolution(String reviewedBy, String comment) {
    return new Resolution()
        .withAction(Resolution.Action.NO_ACTION_NEEDED)
        .withResolvedBy(getUserReference(reviewedBy))
        .withResolvedAt(System.currentTimeMillis())
        .withResolutionNotes(comment != null ? comment : "Feedback rejected by reviewer");
  }

  private org.openmetadata.schema.type.EntityReference getUserReference(String userName) {
    if (userName == null || userName.isEmpty()) {
      LOG.warn("Attempted to get user reference with null or empty userName");
      return null;
    }
    try {
      return Entity.getEntityReferenceByName(
          Entity.USER, userName, org.openmetadata.schema.type.Include.NON_DELETED);
    } catch (EntityNotFoundException e) {
      LOG.warn("User '{}' not found, returning null reference", userName);
      return null;
    }
  }

  /**
   * Get all pending feedback for review
   */
  public List<RecognizerFeedback> getPendingFeedback() {
    List<String> jsonList = daoCollection.recognizerFeedbackDAO().findByStatus("PENDING");
    return jsonList.stream()
        .map(json -> JsonUtils.readValue(json, RecognizerFeedback.class))
        .collect(Collectors.toList());
  }

  /**
   * Get feedback by entity link
   */
  public List<RecognizerFeedback> getFeedbackByEntity(String entityLink) {
    List<String> jsonList = daoCollection.recognizerFeedbackDAO().findByEntityLink(entityLink);
    return jsonList.stream()
        .map(json -> JsonUtils.readValue(json, RecognizerFeedback.class))
        .collect(Collectors.toList());
  }

  /**
   * Get feedback by tag FQN
   */
  public List<RecognizerFeedback> getFeedbackByTagFQN(String tagFQN) {
    List<String> jsonList = daoCollection.recognizerFeedbackDAO().findByTagFQN(tagFQN);
    return jsonList.stream()
        .map(json -> JsonUtils.readValue(json, RecognizerFeedback.class))
        .collect(Collectors.toList());
  }
}
