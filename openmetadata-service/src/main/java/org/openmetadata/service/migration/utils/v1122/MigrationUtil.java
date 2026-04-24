package org.openmetadata.service.migration.utils.v1122;

import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.util.EntityUtil.hash;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.classification.LoadTags;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.util.EntityUtil;

/**
 * Migrates workflow definitions for v1.12.2 changes:
 *
 * <p>1. Removes "reviewers" from excludeFields in workflow trigger configurations.
 * This allows workflow triggers to respond to reviewer changes, enabling proper
 * workflow execution when reviewers are updated.
 *
 * <p>2. Migrates workflow definitions that use the deprecated {@code addReviewers: true} assignees
 * config to the new {@code assigneeSources: ["reviewers"]} format.
 *
 * <p>For each workflow definition node whose assignees config contains {@code addReviewers: true}
 * (and does not yet have an {@code assigneeSources} field), the migration:
 *
 * <ol>
 *   <li>Removes the {@code addReviewers} flag.
 *   <li>Adds {@code assigneeSources: ["reviewers"]}.
 * </ol>
 *
 * Uses {@link WorkflowDefinitionRepository#createOrUpdate} so that Flowable also receives the
 * updated workflow definition. The migration is idempotent – running it more than once is safe.
 */
@Slf4j
public class MigrationUtil {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String ADMIN_USER_NAME = "admin";

  public static void migrateWorkflowDefinitions() {
    LOG.info(
        "Starting v1122 migration: converting addReviewers to assigneeSources and removing reviewers from excludeFields");

    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    List<WorkflowDefinition> allWorkflows =
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());

    int totalUpdated = 0;
    for (WorkflowDefinition workflow : allWorkflows) {
      try {
        String originalJson = JsonUtils.pojoToJson(workflow);
        JsonNode originalNode = MAPPER.readTree(originalJson);

        // First migrate exclude fields, then assignee sources
        JsonNode excludeFieldsMigrated = migrateExcludeFields(originalNode);
        JsonNode fullyMigrated = migrateNodes(excludeFieldsMigrated);

        if (fullyMigrated != originalNode) {
          WorkflowDefinition updated =
              JsonUtils.readValue(
                  MAPPER.writeValueAsString(fullyMigrated), WorkflowDefinition.class);
          repository.createOrUpdate(null, updated, ADMIN_USER_NAME);
          totalUpdated++;
          LOG.debug("Migrated workflow definition: {}", workflow.getFullyQualifiedName());
        }
      } catch (Exception e) {
        LOG.error(
            "Error migrating workflow definition '{}': {}",
            workflow.getFullyQualifiedName(),
            e.getMessage(),
            e);
      }
    }

    LOG.info(
        "Completed v1122 migration: {} workflow definitions updated with assignee sources and exclude fields changes",
        totalUpdated);
  }

  /**
   * Recursively walks the workflow JSON and rewrites any {@code assignees} object that has {@code
   * addReviewers: true} but no {@code assigneeSources} field.
   */
  private static JsonNode migrateNodes(JsonNode node) {
    if (node == null || node.isNull()) {
      return node;
    }

    if (node.isObject()) {
      ObjectNode obj = (ObjectNode) node;
      if (needsMigration(obj)) {
        return migrateAssigneesNode(obj);
      }
      boolean changed = false;
      ObjectNode result = MAPPER.createObjectNode();
      for (java.util.Iterator<java.util.Map.Entry<String, JsonNode>> it = obj.fields();
          it.hasNext(); ) {
        java.util.Map.Entry<String, JsonNode> entry = it.next();
        JsonNode migratedChild = migrateNodes(entry.getValue());
        result.set(entry.getKey(), migratedChild);
        if (migratedChild != entry.getValue()) {
          changed = true;
        }
      }
      return changed ? result : node;
    }

    if (node.isArray()) {
      ArrayNode arr = (ArrayNode) node;
      boolean changed = false;
      ArrayNode result = MAPPER.createArrayNode();
      for (JsonNode element : arr) {
        JsonNode migratedElement = migrateNodes(element);
        result.add(migratedElement);
        if (migratedElement != element) {
          changed = true;
        }
      }
      return changed ? result : node;
    }

    return node;
  }

  private static boolean needsMigration(ObjectNode obj) {
    JsonNode addReviewers = obj.get("addReviewers");
    JsonNode assigneeSource = obj.get("assigneeSource");
    JsonNode assigneeSources = obj.get("assigneeSources");
    JsonNode addOwners = obj.get("addOwners");
    JsonNode candidates = obj.get("candidates");

    // Only migrate if we have old fields AND don't have the complete new structure
    boolean hasOldFields =
        (assigneeSource != null
            || assigneeSources != null
            || (addReviewers != null && addOwners == null && candidates == null));
    boolean hasNewStructure = (addReviewers != null && addOwners != null && candidates != null);

    return hasOldFields && !hasNewStructure;
  }

  private static ObjectNode migrateAssigneesNode(ObjectNode assigneesObj) {
    ObjectNode result = MAPPER.createObjectNode();

    // Set defaults
    boolean addReviewers = true;
    boolean addOwners = false;
    ArrayNode candidates = MAPPER.createArrayNode();

    // Handle old format conversions
    JsonNode addReviewersNode = assigneesObj.get("addReviewers");
    JsonNode assigneeSourceNode = assigneesObj.get("assigneeSource");
    JsonNode assigneeSourcesNode = assigneesObj.get("assigneeSources");

    // Process old addReviewers field
    if (addReviewersNode != null && addReviewersNode.isBoolean()) {
      addReviewers = addReviewersNode.asBoolean();
    }

    // Process assigneeSource (single source)
    if (assigneeSourceNode != null) {
      String source = assigneeSourceNode.asText();
      if ("reviewers".equals(source)) {
        addReviewers = true;
      } else if ("owners".equals(source)) {
        addOwners = true;
      }
    }

    // Process assigneeSources (array)
    if (assigneeSourcesNode != null && assigneeSourcesNode.isArray()) {
      for (JsonNode sourceNode : assigneeSourcesNode) {
        String source = sourceNode.asText();
        if ("reviewers".equals(source)) {
          addReviewers = true;
        } else if ("owners".equals(source)) {
          addOwners = true;
        } else {
          // It's an entity reference - add to candidates
          // For now, create a simple entity reference structure
          ObjectNode candidateRef = MAPPER.createObjectNode();
          candidateRef.put("type", "user"); // Default assumption
          candidateRef.put("fullyQualifiedName", source);
          candidates.add(candidateRef);
        }
      }
    }

    // Set the new structure
    result.put("addReviewers", addReviewers);
    result.put("addOwners", addOwners);
    result.set("candidates", candidates);

    return result;
  }

  /**
   * Recursively walks the workflow JSON and removes "reviewers" from any "exclude" array in trigger config.
   */
  private static JsonNode migrateExcludeFields(JsonNode node) {
    if (node == null || node.isNull()) {
      return node;
    }

    if (node.isObject()) {
      ObjectNode obj = (ObjectNode) node;
      boolean changed = false;
      ObjectNode result = MAPPER.createObjectNode();

      for (java.util.Iterator<java.util.Map.Entry<String, JsonNode>> it = obj.fields();
          it.hasNext(); ) {
        java.util.Map.Entry<String, JsonNode> entry = it.next();
        String fieldName = entry.getKey();
        JsonNode fieldValue = entry.getValue();

        if ("exclude".equals(fieldName) && fieldValue.isArray()) {
          ArrayNode excludeArray = (ArrayNode) fieldValue;
          ArrayNode newExcludeArray = MAPPER.createArrayNode();
          boolean excludeArrayChanged = false;

          for (JsonNode element : excludeArray) {
            if (element.isTextual() && "reviewers".equals(element.asText())) {
              excludeArrayChanged = true; // Skip this element (remove "reviewers")
            } else {
              newExcludeArray.add(element);
            }
          }

          if (excludeArrayChanged) {
            result.set(fieldName, newExcludeArray);
            changed = true;
          } else {
            result.set(fieldName, fieldValue);
          }
        } else {
          JsonNode migratedChild = migrateExcludeFields(fieldValue);
          result.set(fieldName, migratedChild);
          if (migratedChild != fieldValue) {
            changed = true;
          }
        }
      }
      return changed ? result : node;
    }

    if (node.isArray()) {
      ArrayNode arr = (ArrayNode) node;
      boolean changed = false;
      ArrayNode result = MAPPER.createArrayNode();
      for (JsonNode element : arr) {
        JsonNode migratedElement = migrateExcludeFields(element);
        result.add(migratedElement);
        if (migratedElement != element) {
          changed = true;
        }
      }
      return changed ? result : node;
    }

    return node;
  }

  public static Map<String, QueryStatus> setRecognizersForSensitiveTags(
      Handle handle, String version, MigrationDAO migrationDAO, boolean isForceMigration) {
    Map<String, QueryStatus> result = new HashMap<>();
    List<LoadTags> loadTagsList;
    try {
      loadTagsList =
          EntityRepository.getEntitiesFromSeedData(
              CLASSIFICATION, ".*json/data/tags/piiTagsWithRecognizers.json$", LoadTags.class);
    } catch (IOException e) {
      LOG.error("Failed to load tag data");
      return result;
    }

    Map<String, List<Recognizer>> recognizersByTag = new HashMap<>();
    for (LoadTags loadTags : loadTagsList) {
      String classification = loadTags.getCreateClassification().getName();
      for (CreateTag createTag : loadTags.getCreateTags()) {
        if (Boolean.TRUE.equals(createTag.getAutoClassificationEnabled()))
          recognizersByTag.put(
              classification + "." + createTag.getName(), createTag.getRecognizers());
      }
    }

    recognizersByTag.forEach(
        (tagFqn, recognizers) -> {
          try {
            updateTagRecognizers(
                handle, migrationDAO, tagFqn, recognizers, result, isForceMigration, version);
          } catch (Exception e) {
            LOG.error("Failed to update recognizers for tag: {}", tagFqn, e);
          }
        });

    return result;
  }

  private static void updateTagRecognizers(
      Handle handle,
      MigrationDAO migrationDAO,
      String tagFqn,
      List<Recognizer> recognizers,
      Map<String, QueryStatus> results,
      boolean isForceMigration,
      String version) {
    String recognizersJson = JsonUtils.pojoToJson(recognizers);

    String truncatedQuery =
        String.format(
            "UPDATE tag SET recognizers = [ ... data truncated for %s ... ] WHERE fullyQualifiedName = %s",
            tagFqn, tagFqn);

    try {
      handle.attach(CollectionDAO.TagDAO.class).patchRecognizers(tagFqn, recognizersJson);
      migrationDAO.upsertServerMigrationSQL(version, truncatedQuery, hash(truncatedQuery));
      results.put(
          truncatedQuery,
          new QueryStatus(QueryStatus.Status.SUCCESS, "Successfully Executed Query"));
    } catch (Exception e) {
      String message = String.format("Failed to run sql: [%s] due to [%s]", truncatedQuery, e);
      results.put(truncatedQuery, new QueryStatus(QueryStatus.Status.FAILURE, message));
      if (!isForceMigration) {
        throw new RuntimeException(message, e);
      }
    }
  }
}
