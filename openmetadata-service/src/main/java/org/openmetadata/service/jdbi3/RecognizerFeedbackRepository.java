package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TAG;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.type.RecognizerException;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.Resolution;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
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

    return feedback;
  }

  public RecognizerFeedback processFeedback(RecognizerFeedback feedback, String updatedBy) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(feedback.getEntityLink());
    EntityUtil.validateEntityLink(entityLink);

    validateTagIsAutoApplied(feedback.getEntityLink(), feedback.getTagFQN());

    RecognizerFeedback stored = create(feedback);

    Tag tag =
        tagRepository.getByName(null, feedback.getTagFQN(), tagRepository.getFields("recognizers"));

    if (tag.getRecognizers() != null) {
      Tag originalTag = JsonUtils.readValue(JsonUtils.pojoToJson(tag), Tag.class);

      for (Recognizer recognizer : tag.getRecognizers()) {
        if (shouldUpdateRecognizer(recognizer, feedback)) {
          addExceptionToRecognizer(recognizer, feedback);
        }
      }

      tagRepository.patch(null, tag.getId(), updatedBy, JsonUtils.getJsonPatch(originalTag, tag));
    }

    removeTagFromEntity(feedback.getEntityLink(), feedback.getTagFQN(), updatedBy);

    stored.setStatus(RecognizerFeedback.Status.APPLIED);
    stored.setResolution(createResolution(feedback));

    return update(stored);
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
      RecognizerException exception =
          new RecognizerException()
              .withEntityLink(feedback.getEntityLink())
              .withReason(feedback.getUserReason() + ": " + feedback.getUserComments())
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

      if (arrayFieldName != null && fieldName != null) {
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
                            && tag.getLabelType() == TagLabel.LabelType.AUTOMATED);

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

      if (arrayFieldName != null) {
        // Tag is on a nested field (columns, schemaFields, requestSchema, responseSchema, etc.)
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
                              && tag.getLabelType() == TagLabel.LabelType.AUTOMATED);
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

  /**
   * Create resolution information
   */
  private Resolution createResolution(RecognizerFeedback feedback) {
    return new Resolution()
        .withAction(Resolution.Action.ADDED_TO_EXCEPTION_LIST)
        .withResolvedBy(feedback.getCreatedBy()) // Auto-resolved
        .withResolvedAt(System.currentTimeMillis())
        .withResolutionNotes("Automatically added entity to recognizer exception list");
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
