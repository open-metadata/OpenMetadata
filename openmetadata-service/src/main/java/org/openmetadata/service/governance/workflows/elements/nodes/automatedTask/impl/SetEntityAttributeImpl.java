package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.EntityUtil;

/**
 * Universal entity attribute setter for OpenMetadata workflows.
 *
 * Sets top-level entity fields properly by fetching actual entities from repositories.
 *
 * <h2>Supported Field Types:</h2>
 * <ul>
 *   <li><strong>Simple fields:</strong> description, displayName - direct value setting</li>
 *   <li><strong>Tags:</strong> Fetches Tag entities and creates proper TagLabels (APPENDS)</li>
 *   <li><strong>GlossaryTerms:</strong> Fetches GlossaryTerm entities and creates TagLabels (APPENDS)</li>
 *   <li><strong>Certification:</strong> Creates AssetCertification with proper TagLabel (REPLACES)</li>
 *   <li><strong>Tier:</strong> Manages Tier.* tags in tags array (REPLACES existing tier)</li>
 *   <li><strong>Owners:</strong> Fetches User/Team entities and creates EntityReferences</li>
 *   <li><strong>Reviewers:</strong> Fetches User/Team entities and creates EntityReferences</li>
 * </ul>
 *
 * <h2>Configuration Examples:</h2>
 * <pre>{@code
 * // Simple field
 * {
 *   "config": {
 *     "fieldName": "description",
 *     "fieldValue": "Updated description"
 *   }
 * }
 *
 * // Tags - provide FQN(s), will fetch actual Tag entities
 * {
 *   "config": {
 *     "fieldName": "tags",
 *     "fieldValue": "PII.Sensitive"  // or "PII.Sensitive, Quality.High"
 *   }
 * }
 *
 * // GlossaryTerms - provide FQN(s), will fetch actual GlossaryTerm entities
 * {
 *   "config": {
 *     "fieldName": "glossaryTerms",
 *     "fieldValue": "BusinessGlossary.Customer"
 *   }
 * }
 *
 * // Certification
 * {
 *   "config": {
 *     "fieldName": "certification",
 *     "fieldValue": "Certification.Gold"
 *   }
 * }
 *
 * // Tier
 * {
 *   "config": {
 *     "fieldName": "tier",
 *     "fieldValue": "Tier.Tier1"
 *   }
 * }
 *
 * // Owners - use format "user:name" or "team:name"
 * {
 *   "config": {
 *     "fieldName": "owners",
 *     "fieldValue": "user:john.doe, team:data-team"
 *   }
 * }
 *
 * // Reviewers - use format "user:name" or "team:name"
 * {
 *   "config": {
 *     "fieldName": "reviewers",
 *     "fieldValue": "user:jane.smith, user:bob.jones"
 *   }
 * }
 * }</pre>
 */
@Slf4j
public class SetEntityAttributeImpl implements JavaDelegate {
  private Expression fieldNameExpr;
  private Expression fieldValueExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      // Extract entity from workflow context
      Map<String, Object> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      String relatedEntityNamespace = (String) inputNamespaceMap.get(RELATED_ENTITY_VARIABLE);
      String relatedEntityValue =
          (String)
              varHandler.getNamespacedVariable(relatedEntityNamespace, RELATED_ENTITY_VARIABLE);
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(relatedEntityValue);

      String entityType = entityLink.getEntityType();
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

      String fieldName = (String) fieldNameExpr.getValue(execution);
      String fieldValue =
          fieldValueExpr.getValue(execution) != null
              ? (String) fieldValueExpr.getValue(execution)
              : null;

      String updatedByNamespace = (String) inputNamespaceMap.get(UPDATED_BY_VARIABLE);
      String user =
          Optional.ofNullable(updatedByNamespace)
              .map(ns -> (String) varHandler.getNamespacedVariable(ns, UPDATED_BY_VARIABLE))
              .orElse("governance-bot");

      // Apply the field change
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
   * Sets a top-level field on an entity by creating the proper object structure.
   */
  private void setEntityField(
      EntityInterface entity, String entityType, String user, String fieldName, String fieldValue) {

    // Store original state for patch creation
    String originalJson = JsonUtils.pojoToJson(entity);

    // Handle different field types
    switch (fieldName) {
      case "description":
      case "displayName":
        // Simple string fields
        setSimpleField(entity, fieldName, fieldValue);
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

      default:
        // For other simple fields, try direct setting
        setSimpleField(entity, fieldName, fieldValue);
        break;
    }

    // Create and apply patch
    String updatedJson = JsonUtils.pojoToJson(entity);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    entityRepository.patch(null, entity.getId(), user, patch, null);
  }

  /**
   * Sets a simple field value using reflection.
   */
  private void setSimpleField(EntityInterface entity, String fieldName, String fieldValue) {
    try {
      // Use reflection to set the field
      java.lang.reflect.Field field = entity.getClass().getDeclaredField(fieldName);
      field.setAccessible(true);
      field.set(entity, fieldValue);
    } catch (Exception e) {
      LOG.warn("Could not set field {} directly: {}", fieldName, e.getMessage());
    }
  }

  /**
   * Appends tags to the entity by fetching actual Tag entities.
   */
  private void appendTags(EntityInterface entity, String tagFQNs) {
    if (tagFQNs == null || tagFQNs.isEmpty()) {
      return;
    }

    List<TagLabel> existingTags = entity.getTags() != null ? entity.getTags() : new ArrayList<>();
    List<TagLabel> newTags = new ArrayList<>(existingTags);

    String[] fqns = tagFQNs.contains(",") ? tagFQNs.split(",") : new String[] {tagFQNs};

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
              newTags.add(tagLabel);
            }
          } catch (Exception e) {
            LOG.warn("Could not fetch tag {}: {}", trimmedFQN, e.getMessage());
          }
        }
      }
    }

    // Validate mutual exclusivity
    try {
      TagLabelUtil.checkMutuallyExclusive(newTags);
    } catch (IllegalArgumentException e) {
      throw new RuntimeException(
          "Cannot add tags due to mutual exclusivity constraint: " + e.getMessage(), e);
    }

    entity.setTags(newTags);
  }

  /**
   * Appends glossary terms to the entity by fetching actual GlossaryTerm entities.
   */
  private void appendGlossaryTerms(EntityInterface entity, String termFQNs) {
    if (termFQNs == null || termFQNs.isEmpty()) {
      return;
    }

    // Get existing tags (glossary terms are stored as tags with source=GLOSSARY)
    List<TagLabel> existingTags = entity.getTags() != null ? entity.getTags() : new ArrayList<>();
    List<TagLabel> newTags = new ArrayList<>(existingTags);

    String[] fqns = termFQNs.contains(",") ? termFQNs.split(",") : new String[] {termFQNs};

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
              newTags.add(tagLabel);
            }
          } catch (Exception e) {
            LOG.warn("Could not fetch glossary term {}: {}", trimmedFQN, e.getMessage());
          }
        }
      }
    }

    // Validate mutual exclusivity
    try {
      TagLabelUtil.checkMutuallyExclusive(newTags);
    } catch (IllegalArgumentException e) {
      throw new RuntimeException(
          "Cannot add glossary terms due to mutual exclusivity constraint: " + e.getMessage(), e);
    }

    entity.setTags(newTags);
  }

  /**
   * Sets certification on the entity (replaces existing).
   */
  private void setCertification(EntityInterface entity, String certificationFQN) {
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
  private void setTier(EntityInterface entity, String tierFQN) {
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
  private void setOwners(EntityInterface entity, String ownerNames) {
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
   * Format: "user:userName" or "team:teamName" (though typically only users are reviewers)
   */
  private void setReviewers(EntityInterface entity, String reviewerNames) {
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
}
