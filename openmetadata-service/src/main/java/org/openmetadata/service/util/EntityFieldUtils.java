/*
 *  Copyright 2021 Collate
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
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.tags.TagLabelUtil;

/**
 * Shared utility class for setting entity fields across different workflow components.
 * This provides a unified approach to field setting used by both ApprovalTaskWorkflow
 * and SetEntityAttributeImpl.
 */
@Slf4j
public class EntityFieldUtils {

  /**
   * Sets a field on an entity using the most appropriate method based on field type.
   * This method handles both simple fields and complex entity relationships.
   *
   * @param entity The entity to update
   * @param entityType The entity type (for repository operations)
   * @param user The user making the change
   * @param fieldName The name of the field to set
   * @param fieldValue The value to set (format depends on field type)
   * @param applyPatch Whether to apply the patch immediately (true for workflows, false for manual patching)
   */
  public static void setEntityField(
      EntityInterface entity,
      String entityType,
      String user,
      String fieldName,
      String fieldValue,
      boolean applyPatch) {
    setEntityField(entity, entityType, user, fieldName, fieldValue, applyPatch, null);
  }

  public static void setEntityField(
      EntityInterface entity,
      String entityType,
      String user,
      String fieldName,
      String fieldValue,
      boolean applyPatch,
      String impersonatedBy) {

    // Store original state for patch creation
    String originalJson = applyPatch ? JsonUtils.pojoToJson(entity) : null;

    // Handle different field types
    switch (fieldName) {
      case "description":
      case "displayName":
      case "name":
        // Simple string fields
        setSimpleStringField(entity, fieldName, fieldValue);
        break;

      case "tags":
        // Fetch Tag entities and append to existing tags
        appendTags(entity, fieldValue);
        break;

      case "glossaryTerms":
        // Fetch GlossaryTerm entities and append to existing glossaryTerms
        appendGlossaryTerms(entity, fieldValue);
        break;

      case "certification":
        // Set certification (replaces existing)
        setCertification(entity, fieldValue);
        break;

      case "tier":
        // Set tier (replaces existing tier tag)
        setTier(entity, fieldValue);
        break;

      case "owners":
        // Fetch User/Team entities and set as owners
        setOwners(entity, fieldValue);
        break;

      case "reviewers":
        // Fetch User/Team entities and set as reviewers
        setReviewers(entity, fieldValue);
        break;

      case "status":
      case "entityStatus":
        // Set entity status - handle different entity types appropriately
        setEntityStatus(entity, fieldValue);
        break;

      default:
        // For other simple fields, try direct setting
        setSimpleStringField(entity, fieldName, fieldValue);
        break;
    }

    // Update entity metadata
    updateEntityMetadata(entity, user);

    // Create and apply patch if requested
    if (applyPatch) {
      String updatedJson = JsonUtils.pojoToJson(entity);
      JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
      if (!originalJson.equals(updatedJson)) {
        EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
        entityRepository.patch(null, entity.getId(), user, patch, null, impersonatedBy);
        ChangeEvent changeEvent =
            new ChangeEvent()
                .withId(UUID.randomUUID())
                .withEventType(EventType.ENTITY_UPDATED)
                .withEntityId(entity.getId())
                .withEntityType(entityType)
                .withEntityFullyQualifiedName(entity.getFullyQualifiedName())
                .withUserName(user)
                .withImpersonatedBy(impersonatedBy)
                .withTimestamp(System.currentTimeMillis())
                .withEntity(entity);

        Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToMaskedJson(changeEvent));
      }
    }
  }

  /**
   * Sets a simple string field using reflection.
   */
  public static void setSimpleStringField(
      EntityInterface entity, String fieldName, String fieldValue) {
    try {
      // Try setter method first
      String setterName = "set" + fieldName.substring(0, 1).toUpperCase() + fieldName.substring(1);
      Method[] methods = entity.getClass().getMethods();
      for (Method method : methods) {
        if (method.getName().equals(setterName) && method.getParameterCount() == 1) {
          Class<?> paramType = method.getParameterTypes()[0];
          if (paramType == String.class) {
            method.invoke(entity, fieldValue);
            return;
          }
        }
      }

      // Fallback to direct field access
      java.lang.reflect.Field field = entity.getClass().getDeclaredField(fieldName);
      field.setAccessible(true);
      field.set(entity, fieldValue);

    } catch (Exception e) {
      LOG.debug("Could not set field {} on entity: {}", fieldName, e.getMessage());
    }
  }

  /**
   * Appends tags to the entity by fetching actual Tag entities.
   * If new tags are mutually exclusive with existing tags, replaces the conflicting tags.
   */
  public static void appendTags(EntityInterface entity, String tagFQNs) {
    if (tagFQNs == null || tagFQNs.isEmpty()) {
      return;
    }

    List<TagLabel> existingTags = entity.getTags() != null ? entity.getTags() : new ArrayList<>();
    List<TagLabel> newTagsToAdd = new ArrayList<>();
    String[] fqns = tagFQNs.contains(",") ? tagFQNs.split(",") : new String[] {tagFQNs};

    // First, collect all new tags to add
    for (String fqn : fqns) {
      String trimmedFQN = fqn.trim();
      if (!trimmedFQN.isEmpty()) {
        // Check if tag already exists
        boolean exists = existingTags.stream().anyMatch(tag -> trimmedFQN.equals(tag.getTagFQN()));

        if (!exists) {
          try {
            // Fetch the actual Tag entity
            Tag tag = TagLabelUtil.getTag(trimmedFQN);
            if (tag != null) {
              // Convert to TagLabel and add
              TagLabel tagLabel = EntityUtil.toTagLabel(tag);
              tagLabel.setLabelType(TagLabel.LabelType.AUTOMATED);
              tagLabel.setState(TagLabel.State.CONFIRMED);
              newTagsToAdd.add(tagLabel);
            }
          } catch (Exception e) {
            LOG.warn("Could not fetch tag {}: {}", trimmedFQN, e.getMessage());
          }
        }
      }
    }

    // Try to append first
    List<TagLabel> combinedTags = new ArrayList<>(existingTags);
    combinedTags.addAll(newTagsToAdd);

    // Check for mutual exclusivity
    try {
      TagLabelUtil.checkMutuallyExclusive(combinedTags);
      // If no exception, we can safely append
      entity.setTags(combinedTags);
    } catch (IllegalArgumentException e) {
      // Mutual exclusivity conflict detected - remove conflicting tags and add new ones
      LOG.debug(
          "Mutual exclusivity conflict detected. Replacing conflicting tags: {}", e.getMessage());

      // Keep only non-glossary tags that don't conflict with new tags
      List<TagLabel> filteredTags = new ArrayList<>();
      for (TagLabel existingTag : existingTags) {
        // Keep glossary terms (they have different source)
        if (TagLabel.TagSource.GLOSSARY.equals(existingTag.getSource())) {
          filteredTags.add(existingTag);
          continue;
        }

        // Check if this existing tag conflicts with any new tag
        boolean conflicts = false;
        for (TagLabel newTag : newTagsToAdd) {
          List<TagLabel> testList = List.of(existingTag, newTag);
          try {
            TagLabelUtil.checkMutuallyExclusive(testList);
          } catch (IllegalArgumentException ex) {
            conflicts = true;
            break;
          }
        }

        if (!conflicts) {
          filteredTags.add(existingTag);
        }
      }

      // Add the new tags
      filteredTags.addAll(newTagsToAdd);

      // Final validation
      try {
        TagLabelUtil.checkMutuallyExclusive(filteredTags);
        entity.setTags(filteredTags);
      } catch (IllegalArgumentException ex) {
        throw new RuntimeException("Cannot resolve tag conflicts: " + ex.getMessage(), ex);
      }
    }
  }

  /**
   * Appends glossary terms to the entity by fetching actual GlossaryTerm entities.
   * If new glossary terms are mutually exclusive with existing tags/terms, replaces the conflicting ones.
   */
  public static void appendGlossaryTerms(EntityInterface entity, String termFQNs) {
    if (termFQNs == null || termFQNs.isEmpty()) {
      return;
    }

    // Get existing tags (glossary terms are stored as tags with source=GLOSSARY)
    List<TagLabel> existingTags = entity.getTags() != null ? entity.getTags() : new ArrayList<>();
    List<TagLabel> newTermsToAdd = new ArrayList<>();
    String[] fqns = termFQNs.contains(",") ? termFQNs.split(",") : new String[] {termFQNs};

    // First, collect all new glossary terms to add
    for (String fqn : fqns) {
      String trimmedFQN = fqn.trim();
      if (!trimmedFQN.isEmpty()) {
        // Check if term already exists
        boolean exists =
            existingTags.stream()
                .anyMatch(
                    tag ->
                        trimmedFQN.equals(tag.getTagFQN())
                            && TagLabel.TagSource.GLOSSARY.equals(tag.getSource()));

        if (!exists) {
          try {
            // Fetch the actual GlossaryTerm entity
            GlossaryTerm term = TagLabelUtil.getGlossaryTerm(trimmedFQN);
            if (term != null) {
              // Convert to TagLabel and add
              TagLabel tagLabel = EntityUtil.toTagLabel(term);
              tagLabel.setLabelType(TagLabel.LabelType.AUTOMATED);
              tagLabel.setState(TagLabel.State.CONFIRMED);
              newTermsToAdd.add(tagLabel);
            }
          } catch (Exception e) {
            LOG.warn("Could not fetch glossary term {}: {}", trimmedFQN, e.getMessage());
          }
        }
      }
    }

    // Try to append first
    List<TagLabel> combinedTags = new ArrayList<>(existingTags);
    combinedTags.addAll(newTermsToAdd);

    // Check for mutual exclusivity
    try {
      TagLabelUtil.checkMutuallyExclusive(combinedTags);
      // If no exception, we can safely append
      entity.setTags(combinedTags);
    } catch (IllegalArgumentException e) {
      // Mutual exclusivity conflict detected - remove conflicting tags/terms and add new ones
      LOG.debug(
          "Mutual exclusivity conflict detected. Replacing conflicting glossary terms: {}",
          e.getMessage());

      // Keep only tags/terms that don't conflict with new terms
      List<TagLabel> filteredTags = new ArrayList<>();
      for (TagLabel existingTag : existingTags) {
        // Check if this existing tag/term conflicts with any new term
        boolean conflicts = false;
        for (TagLabel newTerm : newTermsToAdd) {
          List<TagLabel> testList = List.of(existingTag, newTerm);
          try {
            TagLabelUtil.checkMutuallyExclusive(testList);
          } catch (IllegalArgumentException ex) {
            conflicts = true;
            break;
          }
        }

        if (!conflicts) {
          filteredTags.add(existingTag);
        }
      }

      // Add the new terms
      filteredTags.addAll(newTermsToAdd);

      // Final validation
      try {
        TagLabelUtil.checkMutuallyExclusive(filteredTags);
        entity.setTags(filteredTags);
      } catch (IllegalArgumentException ex) {
        throw new RuntimeException(
            "Cannot resolve glossary term conflicts: " + ex.getMessage(), ex);
      }
    }
  }

  /**
   * Sets certification on the entity (replaces existing).
   */
  public static void setCertification(EntityInterface entity, String certificationFQN) {
    if (certificationFQN == null || certificationFQN.isEmpty()) {
      entity.setCertification(null);
      return;
    }

    try {
      // Fetch the certification tag
      Tag certTag = TagLabelUtil.getTag(certificationFQN);
      if (certTag != null) {
        TagLabel tagLabel = EntityUtil.toTagLabel(certTag);
        tagLabel.setLabelType(TagLabel.LabelType.AUTOMATED);
        tagLabel.setState(TagLabel.State.CONFIRMED);

        AssetCertification certification = new AssetCertification();
        certification.setTagLabel(tagLabel);
        entity.setCertification(certification);
      }
    } catch (Exception e) {
      LOG.warn("Could not set certification {}: {}", certificationFQN, e.getMessage());
    }
  }

  /**
   * Sets tier on the entity by managing Tier.* tags (replaces existing tier).
   */
  public static void setTier(EntityInterface entity, String tierFQN) {
    if (tierFQN == null || tierFQN.isEmpty()) {
      return;
    }

    List<TagLabel> tags = entity.getTags() != null ? entity.getTags() : new ArrayList<>();

    // Remove existing Tier.* tags
    tags.removeIf(tag -> tag.getTagFQN() != null && tag.getTagFQN().startsWith("Tier."));

    // Add new tier tag
    try {
      Tag tierTag = TagLabelUtil.getTag(tierFQN);
      if (tierTag != null) {
        TagLabel tagLabel = EntityUtil.toTagLabel(tierTag);
        tagLabel.setLabelType(TagLabel.LabelType.AUTOMATED);
        tagLabel.setState(TagLabel.State.CONFIRMED);
        tags.add(tagLabel);
      }
    } catch (Exception e) {
      LOG.warn("Could not set tier {}: {}", tierFQN, e.getMessage());
    }

    entity.setTags(tags);
  }

  /**
   * Sets owners on the entity by fetching User/Team entities.
   * Format: "user:userName" or "team:teamName"
   */
  public static void setOwners(EntityInterface entity, String ownerNames) {
    if (ownerNames == null || ownerNames.isEmpty()) {
      entity.setOwners(null);
      return;
    }

    List<EntityReference> owners = new ArrayList<>();
    String[] names = ownerNames.contains(",") ? ownerNames.split(",") : new String[] {ownerNames};

    for (String ownerSpec : names) {
      String trimmedSpec = ownerSpec.trim();
      if (!trimmedSpec.isEmpty()) {
        // Parse format like "user:john.doe" or "team:data-team"
        String[] parts = trimmedSpec.split(":", 2);
        if (parts.length != 2) {
          LOG.warn("Invalid owner format: {}. Expected 'user:name' or 'team:name'", trimmedSpec);
          continue;
        }

        String type = parts[0].trim().toLowerCase();
        String name = parts[1].trim();

        try {
          if ("user".equals(type)) {
            User user = Entity.getEntityByName(Entity.USER, name, "", Include.NON_DELETED);
            if (user != null) {
              owners.add(user.getEntityReference());
            }
          } else if ("team".equals(type)) {
            Team team = Entity.getEntityByName(Entity.TEAM, name, "", Include.NON_DELETED);
            if (team != null) {
              owners.add(team.getEntityReference());
            }
          } else {
            LOG.warn("Unknown owner type: {}. Expected 'user' or 'team'", type);
          }
        } catch (Exception e) {
          LOG.warn("Could not find {} with name: {}", type, name);
        }
      }
    }

    if (!owners.isEmpty()) {
      entity.setOwners(owners);
    }
  }

  /**
   * Sets reviewers on the entity by fetching User entities.
   * Format: "user:userName" or "team:teamName"
   */
  public static void setReviewers(EntityInterface entity, String reviewerNames) {
    if (reviewerNames == null || reviewerNames.isEmpty()) {
      entity.setReviewers(null);
      return;
    }

    List<EntityReference> reviewers = new ArrayList<>();
    String[] names =
        reviewerNames.contains(",") ? reviewerNames.split(",") : new String[] {reviewerNames};

    for (String reviewerSpec : names) {
      String trimmedSpec = reviewerSpec.trim();
      if (!trimmedSpec.isEmpty()) {
        // Parse format like "user:john.doe" or "team:data-team"
        String[] parts = trimmedSpec.split(":", 2);
        if (parts.length != 2) {
          LOG.warn("Invalid reviewer format: {}. Expected 'user:name' or 'team:name'", trimmedSpec);
          continue;
        }

        String type = parts[0].trim().toLowerCase();
        String name = parts[1].trim();

        try {
          if ("user".equals(type)) {
            User user = Entity.getEntityByName(Entity.USER, name, "", Include.NON_DELETED);
            if (user != null) {
              reviewers.add(user.getEntityReference());
            }
          } else if ("team".equals(type)) {
            Team team = Entity.getEntityByName(Entity.TEAM, name, "", Include.NON_DELETED);
            if (team != null) {
              reviewers.add(team.getEntityReference());
            }
          } else {
            LOG.warn("Unknown reviewer type: {}. Expected 'user' or 'team'", type);
          }
        } catch (Exception e) {
          LOG.warn("Could not find {} with name: {}", type, name);
        }
      }
    }

    if (!reviewers.isEmpty()) {
      entity.setReviewers(reviewers);
    }
  }

  /**
   * Update entity metadata (updatedBy, updatedAt) using reflection
   */
  public static void updateEntityMetadata(EntityInterface entity, String user) {
    try {
      entity.setUpdatedBy(user);
      entity.setUpdatedAt(System.currentTimeMillis());
    } catch (Exception e) {
      LOG.debug("Failed to update entity metadata: {}", e.getMessage());
    }
  }

  /**
   * Sets the status field on various entity types using appropriate enum values.
   * Handles both legacy 'status' field and new 'entityStatus' field.
   */
  public static void setEntityStatus(EntityInterface entity, String statusValue) {
    try {
      // Try to parse as EntityStatus enum and use the EntityInterface method
      // This works for all entities that support entityStatus field
      try {
        EntityStatus status = EntityStatus.fromValue(statusValue);
        entity.setEntityStatus(status);
        LOG.debug(
            "Successfully set entityStatus to '{}' on entity type: {}",
            statusValue,
            entity.getClass().getSimpleName());
        return;
      } catch (IllegalArgumentException e) {
        // Not a valid EntityStatus enum value
        LOG.warn(
            "Invalid EntityStatus value '{}' for entity type: {}",
            statusValue,
            entity.getClass().getSimpleName());
      } catch (UnsupportedOperationException e) {
        // Entity doesn't support entityStatus
        LOG.debug(
            "Entity type {} doesn't support entityStatus field, trying legacy status field",
            entity.getClass().getSimpleName());
      }

      // Fallback: Try to set legacy "status" field for entities that don't support entityStatus
      // This maintains backward compatibility with older entities
      try {
        setSimpleStringField(entity, "status", statusValue);
        LOG.debug(
            "Successfully set legacy status field to '{}' on entity type: {}",
            statusValue,
            entity.getClass().getSimpleName());
      } catch (Exception e) {
        LOG.debug(
            "Entity type {} doesn't have a legacy status field either",
            entity.getClass().getSimpleName());
      }

    } catch (Exception e) {
      LOG.error(
          "Failed to set status field to '{}' on entity type: {}",
          statusValue,
          entity.getClass().getSimpleName(),
          e);
      throw new RuntimeException("Failed to set status field", e);
    }
  }
}
