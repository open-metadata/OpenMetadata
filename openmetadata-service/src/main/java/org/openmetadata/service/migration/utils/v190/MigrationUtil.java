package org.openmetadata.service.migration.utils.v190;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class MigrationUtil {
  private static final String QUERY_AUTOMATOR =
      "SELECT json FROM ingestion_pipeline_entity WHERE appType = 'Automator'";
  private static final String ADD_DOMAIN_ACTION = "AddDomainAction";
  private static final String REMOVE_DOMAIN_ACTION = "RemoveDomainAction";
  private static final String LINEAGE_PROPAGATION_ACTION = "LineagePropagationAction";
  private static final String DOMAIN_KEY = "domain";
  private static final String DOMAINS_KEY = "domains";
  private static final String PROPAGATE_DOMAIN_KEY = "propagateDomain";
  private static final String PROPAGATE_DOMAINS_KEY = "propagateDomains";

  private final CollectionDAO collectionDAO;

  public MigrationUtil(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
  }

  /**
   * Migrate automator configurations from single domain to multiple domains:
   * 1. AddDomainAction: domain (EntityReference) -> domains (EntityReferenceList)
   * 2. RemoveDomainAction: No change needed as it doesn't have domain field
   * 3. LineagePropagationAction: propagateDomain -> propagateDomains
   */
  public void migrateAutomatorDomainToDomainsAction(Handle handle) {
    try {
      LOG.info("Starting migration of automator domain to domains actions");
      
      handle
          .createQuery(QUERY_AUTOMATOR)
          .mapToMap()
          .forEach(
              row -> {
                try {
                  ObjectMapper objectMapper = new ObjectMapper();
                  JsonNode rootNode = objectMapper.readTree(row.get("json").toString());
                  
                  // Navigate to the actions array
                  JsonNode sourceConfigNode = rootNode.path("sourceConfig");
                  JsonNode configNode = sourceConfigNode.path("config");
                  JsonNode appConfigNode = configNode.path("appConfig");
                  ArrayNode actionsNode = (ArrayNode) appConfigNode.path("actions");
                  
                  boolean hasChanges = false;

                  // Process each action
                  for (JsonNode actionNode : actionsNode) {
                    if (actionNode.isObject()) {
                      ObjectNode actionObj = (ObjectNode) actionNode;
                      String actionType = actionObj.path("type").asText();
                      
                      // Migrate AddDomainAction
                      if (ADD_DOMAIN_ACTION.equals(actionType) && actionObj.has(DOMAIN_KEY)) {
                        LOG.info("Migrating AddDomainAction from domain to domains");
                        JsonNode domainNode = actionObj.get(DOMAIN_KEY);
                        ArrayNode domainsArray = objectMapper.createArrayNode();
                        domainsArray.add(domainNode);
                        
                        actionObj.set(DOMAINS_KEY, domainsArray);
                        actionObj.remove(DOMAIN_KEY);
                        hasChanges = true;
                      }
                      
                      // Migrate LineagePropagationAction
                      if (LINEAGE_PROPAGATION_ACTION.equals(actionType) && actionObj.has(PROPAGATE_DOMAIN_KEY)) {
                        LOG.info("Migrating LineagePropagationAction from propagateDomain to propagateDomains");
                        JsonNode propagateDomainNode = actionObj.get(PROPAGATE_DOMAIN_KEY);
                        actionObj.set(PROPAGATE_DOMAINS_KEY, propagateDomainNode);
                        actionObj.remove(PROPAGATE_DOMAIN_KEY);
                        hasChanges = true;
                      }
                    }
                  }

                  // Update the ingestion pipeline if changes were made
                  if (hasChanges) {
                    String updatedJsonString = objectMapper.writeValueAsString(rootNode);
                    IngestionPipeline ingestionPipeline =
                        JsonUtils.readValue(updatedJsonString, IngestionPipeline.class);
                    collectionDAO.ingestionPipelineDAO().update(ingestionPipeline);
                    LOG.info("Updated automator configuration for pipeline: {}", 
                        ingestionPipeline.getName());
                  }

                } catch (Exception ex) {
                  LOG.warn("Error updating automator configuration [{}] due to [{}]", row, ex.getMessage());
                }
              });
              
      LOG.info("Completed migration of automator domain to domains actions");
    } catch (Exception ex) {
      LOG.warn("Error running the automator domain to domains migration", ex);
    }
  }
} 