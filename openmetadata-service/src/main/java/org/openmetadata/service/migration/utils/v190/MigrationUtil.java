package org.openmetadata.service.migration.utils.v190;

import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.migration.utils.v170.MigrationUtil.createChart;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.WorkflowTriggerInterface;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
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
  static DataInsightSystemChartRepository dataInsightSystemChartRepository;

  public static void updateChart(String chartName, Object chartDetails) {
    DataInsightCustomChart chart =
        dataInsightSystemChartRepository.getByName(null, chartName, EntityUtil.Fields.EMPTY_FIELDS);
    chart.setChartDetails(chartDetails);
    dataInsightSystemChartRepository.prepareInternal(chart, false);
    try {
      dataInsightSystemChartRepository.getDao().update(chart);
    } catch (Exception ex) {
      LOG.warn(ex.toString());
      LOG.warn(String.format("Error updating chart %s ", chart));
    }
  }

  public static void createSummaryChart(String chartName, Object chartObject) {
    DataInsightCustomChart chart =
        new DataInsightCustomChart()
            .withId(UUID.randomUUID())
            .withName(chartName)
            .withChartDetails(chartObject)
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withIsSystemChart(true);
    dataInsightSystemChartRepository.prepareInternal(chart, false);
    try {
      dataInsightSystemChartRepository
          .getDao()
          .insert("fqnHash", chart, chart.getFullyQualifiedName());
    } catch (Exception ex) {
      LOG.warn(ex.toString());
      LOG.warn(String.format("Chart %s exists", chart));
    }
  }

  public static void updateServiceCharts() {
    dataInsightSystemChartRepository = new DataInsightSystemChartRepository();
    updateChart(
        "tag_source_breakdown",
        new LineChart()
            .withxAxisField("service.name.keyword")
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='tagSources.Ingested')+"
                                + "sum(k='tagSources.Manual')+"
                                + "sum(k='tagSources.Propagated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='tagSources.Generated')")
                        .withName("ai"))));

    updateChart(
        "tier_source_breakdown",
        new LineChart()
            .withxAxisField("service.name.keyword")
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='tierSources.Ingested')+"
                                + "sum(k='tierSources.Manual')+"
                                + "sum(k='tierSources.Propagated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='tierSources.Generated')")
                        .withName("ai"))));

    updateChart(
        "description_source_breakdown",
        new LineChart()
            .withxAxisField("service.name.keyword")
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='descriptionSources.Ingested')+"
                                + "sum(k='descriptionSources.Manual')+"
                                + "sum(k='descriptionSources.Propagated')+"
                                + "sum(k='descriptionSources.Automated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='descriptionSources.Suggested')")
                        .withName("ai"))));

    updateChart(
        "assets_with_pii_bar",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("columns.tags.tagFQN")
            .withIncludeXAxisFiled("PII.*|pii.*")
            .withGroupBy("columns.tags.name.keyword"));
    updateChart(
        "assets_with_tier_bar",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("tags.tagFQN")
            .withIncludeXAxisFiled("Tier.*|tier.*")
            .withGroupBy("tags.name.keyword"));

    createChart(
        "assets_with_tier_bar_live",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("tier.tagFQN")
            .withIncludeXAxisFiled("Tier.*|tier.*")
            .withGroupBy("tier.name.keyword"),
        DataInsightCustomChart.ChartType.BAR_CHART);

    createChart(
        "assets_with_description_live",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='descriptionStatus: COMPLETE')/count(k='id.keyword'))*100")))
            .withxAxisField("service.name.keyword"));

    createChart(
        "assets_with_pii_live",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(q='columns.tags.tagFQN: pii.*')/count(k='id.keyword'))*100")))
            .withxAxisField("service.name.keyword"));

    createChart(
        "assets_with_tier_live",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("(count(q='tier.tagFQN: tier.*')/count(k='id.keyword'))*100")))
            .withxAxisField("service.name.keyword"));

    createChart(
        "assets_with_owner_live",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100")))
            .withxAxisField("service.name.keyword"));

    createChart(
        "healthy_data_assets",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "unique(k='table.id.keyword',q='testCaseStatus.keyword: Failed OR testCaseStatus.keyword: Aborted')")))
            .withxAxisField("service.name.keyword"));

    createChart(
        "total_data_assets_live",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withGroupBy("entityType")
            .withxAxisField("service.name.keyword")
            .withExcludeGroups(List.of("testSuite", "testCase")));

    createChart(
        "pipeline_status_live",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withGroupBy("pipelineStatuses.pipelineState")
            .withxAxisField("service.name.keyword")
            .withSearchIndex("ingestionPipeline"));
  }

  private final CollectionDAO collectionDAO;

  public MigrationUtil(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
  }

  /**
   * Update GlossaryTermApprovalWorkflow
   */
  public static void updateGlossaryTermApprovalWorkflow() {
    try {
      LOG.info(
          "Starting v190 migration - Adding reviewer auto-approval nodes, setting storeStageStatus to true in GlossaryTermApprovalWorkflow");
      WorkflowDefinitionRepository repository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

      try {
        WorkflowDefinition workflowDefinition =
            repository.getByName(
                null, GLOSSARY_TERM_APPROVAL_WORKFLOW, EntityUtil.Fields.EMPTY_FIELDS);
        if (workflowDefinition.getConfig() == null) {
          workflowDefinition.setConfig(new WorkflowConfiguration().withStoreStageStatus(true));
        } else {
          // Update only storeStageStatus, preserve everything else
          workflowDefinition.getConfig().setStoreStageStatus(true);
        }
        LOG.info(
            "Adding reviewer auto-approval nodes to workflow '{}'", workflowDefinition.getName());

        // Add new nodes if they don't already exist
        List<WorkflowNodeDefinitionInterface> nodes =
            new ArrayList<>(workflowDefinition.getNodes());
        List<EdgeDefinition> edges = new ArrayList<>(workflowDefinition.getEdges());

        // Check and add AutoApprovedByReviewerEnd node
        if (nodes.stream().noneMatch(node -> "AutoApprovedByReviewerEnd".equals(node.getName()))) {
          WorkflowNodeDefinitionInterface autoApprovedEndNode =
              JsonUtils.readValue(
                  """
                      {
                        "type": "endEvent",
                        "subType": "endEvent",
                        "name": "AutoApprovedByReviewerEnd",
                        "displayName": "Auto-Approved by Reviewer"
                      }
                      """,
                  WorkflowNodeDefinitionInterface.class);
          nodes.add(autoApprovedEndNode);
          LOG.info("Added new node: AutoApprovedByReviewerEnd");
        }

        // Check and add CheckIfGlossaryTermUpdatedByIsReviewer node
        if (nodes.stream()
            .noneMatch(node -> "CheckIfGlossaryTermUpdatedByIsReviewer".equals(node.getName()))) {
          WorkflowNodeDefinitionInterface checkReviewerNode =
              JsonUtils.readValue(
                  """
                      {
                        "type": "automatedTask",
                        "subType": "checkEntityAttributesTask",
                        "name": "CheckIfGlossaryTermUpdatedByIsReviewer",
                        "displayName": "Check if Glossary Term Updated By is Reviewer",
                        "config": {
                          "rules": "{\\"and\\":[{\\"isReviewer\\":{\\"var\\":\\"updatedBy\\"}}]}"
                        },
                        "inputNamespaceMap": {
                          "relatedEntity": "global"
                        }
                      }
                      """,
                  WorkflowNodeDefinitionInterface.class);
          nodes.add(checkReviewerNode);
          LOG.info("Added new node: CheckIfGlossaryTermUpdatedByIsReviewer");
        }

        // Check and add SetGlossaryTermStatusToApprovedByReviewer node
        if (nodes.stream()
            .noneMatch(
                node -> "SetGlossaryTermStatusToApprovedByReviewer".equals(node.getName()))) {
          WorkflowNodeDefinitionInterface setApprovedNode =
              JsonUtils.readValue(
                  """
                      {
                        "type": "automatedTask",
                        "subType": "setGlossaryTermStatusTask",
                        "name": "SetGlossaryTermStatusToApprovedByReviewer",
                        "displayName": "Set Status to 'Approved' (By Reviewer)",
                        "config": {
                          "glossaryTermStatus": "Approved"
                        },
                        "inputNamespaceMap": {
                          "relatedEntity": "global",
                          "updatedBy": "global"
                        }
                      }
                      """,
                  WorkflowNodeDefinitionInterface.class);
          nodes.add(setApprovedNode);
          LOG.info("Added new node: SetGlossaryTermStatusToApprovedByReviewer");
        }

        // Update the existing edge: CheckGlossaryTermHasReviewers ->
        // CheckGlossaryTermIsReadyToBeReviewed (true)
        // Change it to: CheckGlossaryTermHasReviewers -> CheckIfGlossaryTermUpdatedByIsReviewer
        // (true)
        for (EdgeDefinition edge : edges) {
          if ("CheckGlossaryTermHasReviewers".equals(edge.getFrom())
              && "CheckGlossaryTermIsReadyToBeReviewed".equals(edge.getTo())
              && "true".equals(edge.getCondition())) {
            edge.setTo("CheckIfGlossaryTermUpdatedByIsReviewer");
            LOG.info(
                "Updated edge: CheckGlossaryTermHasReviewers -> CheckIfGlossaryTermUpdatedByIsReviewer");
            break;
          }
        }

        // Add new edges if they don't exist
        addEdgeIfNotExists(
            edges,
            "CheckIfGlossaryTermUpdatedByIsReviewer",
            "SetGlossaryTermStatusToApprovedByReviewer",
            "true");
        addEdgeIfNotExists(
            edges,
            "CheckIfGlossaryTermUpdatedByIsReviewer",
            "CheckGlossaryTermIsReadyToBeReviewed",
            "false");
        addEdgeIfNotExists(
            edges, "SetGlossaryTermStatusToApprovedByReviewer", "AutoApprovedByReviewerEnd", null);

        // Add filter field to trigger config if it doesn't exist
        addFilterToTriggerConfig(workflowDefinition);
        // Add updatedBy to trigger output if it doesn't exist
        addUpdatedByToTriggerOutput(workflowDefinition);

        workflowDefinition.setNodes(nodes);
        workflowDefinition.setEdges(edges);

        repository.createOrUpdate(null, workflowDefinition, ADMIN_USER_NAME);

        LOG.info(
            "Successfully added reviewer auto-approval nodes to workflow '{}'",
            workflowDefinition.getName());

      } catch (Exception ex) {
        LOG.warn("GlossaryTermApprovalWorkflow not found or error updating: {}", ex.getMessage());
        LOG.info("This might be expected if the workflow doesn't exist yet");
      }

      LOG.info("Completed v190 reviewer auto-approval nodes migration");
    } catch (Exception e) {
      LOG.error("Failed to add reviewer auto-approval nodes to workflow", e);
    }
  }

  private static void addEdgeIfNotExists(
      List<EdgeDefinition> edges, String from, String to, String condition) {
    boolean exists =
        edges.stream()
            .anyMatch(
                edge ->
                    from.equals(edge.getFrom())
                        && to.equals(edge.getTo())
                        && Objects.equals(condition, edge.getCondition()));
    if (!exists) {
      EdgeDefinition newEdge = new EdgeDefinition().withFrom(from).withTo(to);
      if (condition != null) {
        newEdge.withCondition(condition);
      }
      edges.add(newEdge);
      LOG.info("Added new edge: {} -> {} (condition: {})", from, to, condition);
    }
  }

  // Add filter field to trigger config (new field in this branch)
  private static void addFilterToTriggerConfig(WorkflowDefinition workflowDefinition) {
    try {
      if (workflowDefinition.getTrigger() != null) {
        // Convert trigger to JSON, modify, and convert back
        String triggerJson = JsonUtils.pojoToJson(workflowDefinition.getTrigger());
        JsonNode triggerNode = JsonUtils.readTree(triggerJson);

        if (triggerNode instanceof ObjectNode) {
          ObjectNode triggerObj = (ObjectNode) triggerNode;

          // Check if config exists and add filter if missing
          if (triggerObj.has("config")) {
            JsonNode configNode = triggerObj.get("config");
            if (configNode instanceof ObjectNode) {
              ObjectNode configObj = (ObjectNode) configNode;
              if (!configObj.has("filter")) {
                configObj.put("filter", "");

                // Convert back to trigger object using WorkflowTriggerInterface
                WorkflowTriggerInterface updatedTrigger =
                    JsonUtils.readValue(triggerObj.toString(), WorkflowTriggerInterface.class);
                workflowDefinition.setTrigger(updatedTrigger);
                LOG.info("Added filter field to trigger config: {\"and\":[]}");
              } else {
                LOG.info("Filter field already exists in trigger config");
              }
            }
          }
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to add filter to trigger config: {}", e.getMessage());
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

  private static void addUpdatedByToTriggerOutput(WorkflowDefinition workflowDefinition) {
    try {
      WorkflowTriggerInterface trigger = workflowDefinition.getTrigger();
      if (trigger != null) {
        Set<String> currentOutput = trigger.getOutput();
        if (currentOutput == null || !currentOutput.contains(UPDATED_BY_VARIABLE)) {
          Set<String> newOutput = new HashSet<>();
          if (currentOutput != null) {
            newOutput.addAll(currentOutput);
          } else {
            newOutput.add(RELATED_ENTITY_VARIABLE);
          }
          newOutput.add(UPDATED_BY_VARIABLE);

          if (trigger instanceof EventBasedEntityTriggerDefinition) {
            EventBasedEntityTriggerDefinition eventTrigger =
                (EventBasedEntityTriggerDefinition) trigger;
            eventTrigger.setOutput(newOutput);
            LOG.info("Updated trigger output to include updatedBy: {}", newOutput);
          }
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to update trigger output: {}", e.getMessage());
    }
  }
}
