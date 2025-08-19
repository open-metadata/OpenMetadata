package org.openmetadata.service.migration.utils.v193;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;

@Slf4j
public class MigrationUtil {
  private static final String ADD_TAGS_ACTION = "AddTagsAction";
  private static final String REMOVE_TAGS_ACTION = "RemoveTagsAction";
  private static final String ADD_TERMS_ACTION = "AddTermsAction";
  private static final String REMOVE_TERMS_ACTION = "RemoveTermsAction";
  private static final String TAGS_KEY = "tags";
  private static final String TERMS_KEY = "terms";
  private static final String GLOSSARY_SOURCE = "Glossary";
  private static final String CLASSIFICATION_SOURCE = "Classification";
  private static final String AUTOMATOR_APP_TYPE = "Automator";
  private static final int BATCH_SIZE = 100;

  private final CollectionDAO collectionDAO;

  public MigrationUtil(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
  }

  /**
   * Migrate automator actions to separate tags and terms.
   * In older versions, both tags and terms were in AddTagsAction and RemoveTagsAction.
   * Now they are separated into AddTagsAction/RemoveTagsAction (for classification tags only)
   * and AddTermsAction/RemoveTermsAction (for glossary terms only).
   *
   * This migration is idempotent - it can be run multiple times safely.
   */
  public void migrateAutomatorTagsAndTerms(Handle handle) {
    try {
      LOG.info("Starting v193 migration of automator tags and terms separation");

      int totalProcessed = 0;
      int totalUpdated = 0;

      // Create filter for Automator application type
      ListFilter filter = new ListFilter(Include.ALL);
      filter.addQueryParam("applicationType", AUTOMATOR_APP_TYPE);

      // Process automator pipelines in batches using listAfter for pagination
      String afterName = "";
      String afterId = "";
      boolean hasMore = true;

      while (hasMore) {
        List<String> pipelineJsonList =
            collectionDAO.ingestionPipelineDAO().listAfter(filter, BATCH_SIZE, afterName, afterId);

        if (pipelineJsonList.isEmpty()) {
          hasMore = false;
          break;
        }

        LOG.debug("Processing batch of {} automator pipelines", pipelineJsonList.size());

        for (String pipelineJson : pipelineJsonList) {
          try {
            totalProcessed++;

            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode rootNode = objectMapper.readTree(pipelineJson);

            // Get pipeline name for logging
            String pipelineName = rootNode.path("name").asText("unknown");

            // Navigate to the actions array - handle missing nodes gracefully
            JsonNode sourceConfigNode = rootNode.path("sourceConfig");
            if (sourceConfigNode.isMissingNode()) {
              LOG.debug("Skipping pipeline {} - no sourceConfig found", pipelineName);
              continue;
            }

            JsonNode configNode = sourceConfigNode.path("config");
            if (configNode.isMissingNode()) {
              LOG.debug("Skipping pipeline {} - no config found", pipelineName);
              continue;
            }

            JsonNode appConfigNode = configNode.path("appConfig");
            if (appConfigNode.isMissingNode()) {
              LOG.debug("Skipping pipeline {} - no appConfig found", pipelineName);
              continue;
            }

            JsonNode actionsNode = appConfigNode.path("actions");
            if (actionsNode.isMissingNode() || !actionsNode.isArray()) {
              LOG.debug("Skipping pipeline {} - no actions array found", pipelineName);
              continue;
            }

            boolean hasChanges = false;
            ArrayNode updatedActions = objectMapper.createArrayNode();

            // Process each action
            for (JsonNode actionNode : actionsNode) {
              if (actionNode.isObject()) {
                ObjectNode actionObj = (ObjectNode) actionNode;
                String actionType = actionObj.path("type").asText();

                if (ADD_TAGS_ACTION.equals(actionType) || REMOVE_TAGS_ACTION.equals(actionType)) {
                  // Process AddTagsAction or RemoveTagsAction
                  boolean actionModified = processTagsAction(updatedActions, actionObj, actionType, objectMapper);
                  if (actionModified) {
                    hasChanges = true;
                  }
                } else {
                  // Keep other actions as-is
                  updatedActions.add(actionObj);
                }
              }
            }

            // Update the ingestion pipeline if changes were made
            if (hasChanges) {
              try {
                // Update the actions array in the JSON structure
                ((ObjectNode) appConfigNode).set("actions", updatedActions);
                
                String updatedJsonString = objectMapper.writeValueAsString(rootNode);
                IngestionPipeline ingestionPipeline =
                    JsonUtils.readValue(updatedJsonString, IngestionPipeline.class);
                collectionDAO.ingestionPipelineDAO().update(ingestionPipeline);
                totalUpdated++;
                LOG.info(
                    "Successfully updated automator configuration for pipeline: {} (separated tags and terms)",
                    pipelineName);
              } catch (Exception updateEx) {
                LOG.error(
                    "Failed to update pipeline {} after migration: {}",
                    pipelineName,
                    updateEx.getMessage());
              }
            } else {
              LOG.debug(
                  "No changes needed for pipeline: {} (already migrated or no applicable actions)",
                  pipelineName);
            }

            // Update pagination parameters for next batch
            afterName = rootNode.path("name").asText();
            afterId = rootNode.path("id").asText();

          } catch (Exception ex) {
            LOG.warn(
                "Error processing automator configuration for pipeline due to [{}]",
                ex.getMessage());
          }
        }

        // If we got fewer results than batch size, we've reached the end
        if (pipelineJsonList.size() < BATCH_SIZE) {
          hasMore = false;
        }
      }

      LOG.info(
          "Completed v193 migration of automator tags and terms separation. Processed: {}, Updated: {}",
          totalProcessed,
          totalUpdated);
    } catch (Exception ex) {
      LOG.error("Error running the automator tags/terms migration", ex);
      throw new RuntimeException("Migration v193 failed", ex);
    }
  }

  private boolean processTagsAction(
      ArrayNode updatedActions, ObjectNode actionObj, String actionType, ObjectMapper objectMapper) {
    // Check if the action has tags array
    if (!actionObj.has(TAGS_KEY)) {
      updatedActions.add(actionObj);
      return false;
    }

    JsonNode tagsArray = actionObj.get(TAGS_KEY);
    if (!tagsArray.isArray() || tagsArray.size() == 0) {
      updatedActions.add(actionObj);
      return false;
    }

    ArrayNode classificationTags = objectMapper.createArrayNode();
    ArrayNode glossaryTerms = objectMapper.createArrayNode();

    // Separate tags and terms based on source
    for (JsonNode tagNode : tagsArray) {
      if (tagNode.isObject()) {
        String source = tagNode.path("source").asText("");

        if (CLASSIFICATION_SOURCE.equals(source)) {
          classificationTags.add(tagNode);
        } else if (GLOSSARY_SOURCE.equals(source)) {
          glossaryTerms.add(tagNode);
        } else {
          // Default to classification if source is not specified
          classificationTags.add(tagNode);
        }
      }
    }

    // Check if we need to make changes (idempotent check)
    boolean hasGlossaryTerms = glossaryTerms.size() > 0;
    boolean hasClassificationTags = classificationTags.size() > 0;
    
    if (!hasGlossaryTerms && hasClassificationTags) {
      // No glossary terms, only classification tags - no change needed
      updatedActions.add(actionObj);
      return false;
    }

    // If we have classification tags, keep/update the original action
    if (hasClassificationTags) {
      ObjectNode updatedAction = actionObj.deepCopy();
      updatedAction.set(TAGS_KEY, classificationTags);
      updatedActions.add(updatedAction);
    }

    // If we have glossary terms, create a new terms action
    if (hasGlossaryTerms) {
      String newActionType =
          ADD_TAGS_ACTION.equals(actionType) ? ADD_TERMS_ACTION : REMOVE_TERMS_ACTION;

      ObjectNode termsAction = objectMapper.createObjectNode();
      termsAction.put("type", newActionType);
      termsAction.set(TERMS_KEY, glossaryTerms);

      // Copy other properties from original action
      if (actionObj.has("applyToChildren")) {
        termsAction.set("applyToChildren", actionObj.get("applyToChildren"));
      }
      if (actionObj.has("overwriteMetadata")) {
        termsAction.set("overwriteMetadata", actionObj.get("overwriteMetadata"));
      }

      updatedActions.add(termsAction);
    }

    return true; // Changes were made
  }
}