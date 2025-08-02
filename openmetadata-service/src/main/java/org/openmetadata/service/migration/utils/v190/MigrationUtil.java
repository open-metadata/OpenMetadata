package org.openmetadata.service.migration.utils.v190;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {
  private static final String ADMIN_USER_NAME = "admin";
  private static final String ADD_DOMAIN_ACTION = "AddDomainAction";
  private static final String REMOVE_DOMAIN_ACTION = "RemoveDomainAction";
  private static final String LINEAGE_PROPAGATION_ACTION = "LineagePropagationAction";
  private static final String DOMAIN_KEY = "domain";
  private static final String DOMAINS_KEY = "domains";
  private static final String PROPAGATE_DOMAIN_KEY = "propagateDomain";
  private static final String PROPAGATE_DOMAINS_KEY = "propagateDomains";
  private static final String AUTOMATOR_APP_TYPE = "Automator";
  private static final String GLOSSARY_TERM_APPROVAL_WORKFLOW = "GlossaryTermApprovalWorkflow";
  private static final int BATCH_SIZE = 100;

  private final CollectionDAO collectionDAO;

  public MigrationUtil(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
  }

  /**
   * Update workflow definitions to set storeStageStatus = true for GlossaryApprovalWorkflow only.
   */
  public static void updateGlossaryTermApprovalWorkflow() {
    try {
      LOG.info(
          "Starting v190 workflow definition migration - updating storeStageStatus for GlossaryTermApprovalWorkflow");
      WorkflowDefinitionRepository repository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
      try {

        WorkflowDefinition workflowDefinition =
            repository.getByName(
                null, GLOSSARY_TERM_APPROVAL_WORKFLOW, EntityUtil.Fields.EMPTY_FIELDS);
        LOG.info("Updating workflow definition '{}'", workflowDefinition.getName());
        if (workflowDefinition.getConfig() == null) {
          workflowDefinition.setConfig(new WorkflowConfiguration().withStoreStageStatus(true));
        } else {
          // Update only storeStageStatus, preserve everything else
          workflowDefinition.getConfig().setStoreStageStatus(true);
        }
        repository.createOrUpdate(null, workflowDefinition, ADMIN_USER_NAME);

        LOG.info("Successfully updated workflow definition '{}'", workflowDefinition.getName());

      } catch (Exception ex) {
        LOG.warn("GlossaryTermApprovalWorkflow not found or error updating: {}", ex.getMessage());
      }
      LOG.info("Completed v190 workflow definition migration");
    } catch (Exception e) {
      LOG.error("Failed to update workflow definitions", e);
    }
  }

  /**
   * Migrate automator configurations from single domain to multiple domains:
   * 1. AddDomainAction: domain (EntityReference) -> domains (EntityReferenceList)
   * 2. RemoveDomainAction: No change needed as it doesn't have domain field
   * 3. LineagePropagationAction: propagateDomain -> propagateDomains
   *
   * This migration is idempotent - it can be run multiple times safely.
   */
  public void migrateAutomatorDomainToDomainsAction(Handle handle) {
    try {
      LOG.info("Starting v190 migration of automator domain to domains actions");

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
            int actionCount = 0;

            // Process each action
            for (JsonNode actionNode : actionsNode) {
              actionCount++;
              if (actionNode.isObject()) {
                ObjectNode actionObj = (ObjectNode) actionNode;
                String actionType = actionObj.path("type").asText();

                // Migrate AddDomainAction (idempotent - only if old format exists)
                if (ADD_DOMAIN_ACTION.equals(actionType)
                    && actionObj.has(DOMAIN_KEY)
                    && !actionObj.has(DOMAINS_KEY)) {
                  LOG.info(
                      "Migrating AddDomainAction from domain to domains in pipeline: {}",
                      pipelineName);
                  JsonNode domainNode = actionObj.get(DOMAIN_KEY);
                  ArrayNode domainsArray = objectMapper.createArrayNode();
                  domainsArray.add(domainNode);

                  actionObj.set(DOMAINS_KEY, domainsArray);
                  actionObj.remove(DOMAIN_KEY);
                  hasChanges = true;
                }

                // Migrate LineagePropagationAction (idempotent - only if old format exists)
                if (LINEAGE_PROPAGATION_ACTION.equals(actionType)
                    && actionObj.has(PROPAGATE_DOMAIN_KEY)
                    && !actionObj.has(PROPAGATE_DOMAINS_KEY)) {
                  LOG.info(
                      "Migrating LineagePropagationAction from propagateDomain to propagateDomains in pipeline: {}",
                      pipelineName);
                  JsonNode propagateDomainNode = actionObj.get(PROPAGATE_DOMAIN_KEY);
                  actionObj.set(PROPAGATE_DOMAINS_KEY, propagateDomainNode);
                  actionObj.remove(PROPAGATE_DOMAIN_KEY);
                  hasChanges = true;
                }
              }
            }

            // Update the ingestion pipeline if changes were made
            if (hasChanges) {
              try {
                String updatedJsonString = objectMapper.writeValueAsString(rootNode);
                IngestionPipeline ingestionPipeline =
                    JsonUtils.readValue(updatedJsonString, IngestionPipeline.class);
                collectionDAO.ingestionPipelineDAO().update(ingestionPipeline);
                totalUpdated++;
                LOG.info(
                    "Successfully updated automator configuration for pipeline: {} (processed {} actions)",
                    pipelineName,
                    actionCount);
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
          "Completed v190 migration of automator domain to domains actions. Processed: {}, Updated: {}",
          totalProcessed,
          totalUpdated);
    } catch (Exception ex) {
      LOG.error("Error running the automator domain to domains migration", ex);
      throw new RuntimeException("Migration v190 failed", ex);
    }
  }
}
