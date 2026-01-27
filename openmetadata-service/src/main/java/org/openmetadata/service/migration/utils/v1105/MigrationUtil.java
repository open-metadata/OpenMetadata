package org.openmetadata.service.migration.utils.v1105;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {
  private static final String ADMIN_USER_NAME = "admin";
  private static final String GLOSSARY_TERM_APPROVAL_WORKFLOW = "GlossaryTermApprovalWorkflow";

  /**
   * Update GlossaryTermApprovalWorkflow to:
   * 1. Replace setGlossaryTermStatusTask nodes with generic setEntityAttributeTask nodes
   * 2. Add approval and rejection thresholds to support multi-person voting
   * 3. Add version-based approval routing for different paths between creates and updates
   * 4. Add detailed approval task for updates with higher thresholds
   * 5. Add rollback capability for rejected updates
   * 6. Update trigger to use entityTypes array instead of entityType string
   */
  public static void updateGlossaryTermApprovalWorkflow() {
    try {
      LOG.info(
          "Starting v1100 migration - Updating GlossaryTermApprovalWorkflow with thresholds and version-based routing");

      WorkflowDefinitionRepository repository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

      try {
        WorkflowDefinition workflowDefinition =
            repository.getByName(
                null, GLOSSARY_TERM_APPROVAL_WORKFLOW, EntityUtil.Fields.EMPTY_FIELDS);

        LOG.info(
            "Updating workflow '{}' with thresholds and version-based routing",
            workflowDefinition.getName());

        // Get existing nodes and edges for modification
        List<WorkflowNodeDefinitionInterface> nodes =
            new ArrayList<>(workflowDefinition.getNodes());
        List<EdgeDefinition> edges = new ArrayList<>(workflowDefinition.getEdges());

        boolean workflowModified = false;

        // Update trigger to use entityTypes array if needed
        workflowModified |= updateTriggerToEntityTypes(workflowDefinition);

        // Step 1: Migrate setGlossaryTermStatusTask nodes to setEntityAttributeTask
        for (int i = 0; i < nodes.size(); i++) {
          WorkflowNodeDefinitionInterface node = nodes.get(i);
          if ("setGlossaryTermStatusTask".equals(node.getSubType())) {
            WorkflowNodeDefinitionInterface migratedNode = migrateGlossaryTermStatusNode(node);
            nodes.set(i, migratedNode);
            workflowModified = true;
            LOG.info(
                "Migrated node '{}' from setGlossaryTermStatusTask to setEntityAttributeTask",
                node.getName());
          }
        }

        // Step 2: Update ApproveGlossaryTerm node with thresholds and output
        for (WorkflowNodeDefinitionInterface node : nodes) {
          if ("userApprovalTask".equals(node.getSubType())) {

            // Get the node's config as JSON to manipulate it
            String nodeJson = JsonUtils.pojoToJson(node);

            // Parse and update the config with thresholds and output
            String updatedNodeJson = updateApprovalNodeWithThresholdsAndOutput(nodeJson);

            // Convert back to node
            WorkflowNodeDefinitionInterface updatedNode =
                JsonUtils.readValue(updatedNodeJson, WorkflowNodeDefinitionInterface.class);

            // Replace the node in the list
            int index = nodes.indexOf(node);
            nodes.set(index, updatedNode);

            workflowModified = true;
            LOG.info("Updated ApproveGlossaryTerm node with thresholds and output field");
            break;
          }
        }

        // Step 3: Add new nodes for version-based routing
        workflowModified |= addVersionRoutingNodes(nodes);

        // Step 4: Update and add edges for version-based routing
        workflowModified |= updateEdgesForVersionRouting(edges);

        if (workflowModified) {
          workflowDefinition.setNodes(nodes);
          workflowDefinition.setEdges(edges);

          // Use createOrUpdate to update the workflow
          // This will handle the deployment to Flowable as well
          repository.createOrUpdate(null, workflowDefinition, ADMIN_USER_NAME);

          LOG.info(
              "Successfully updated workflow '{}' with thresholds and version-based routing",
              workflowDefinition.getName());
        } else {
          LOG.info("No updates needed for workflow '{}'", workflowDefinition.getName());
        }

      } catch (Exception ex) {
        LOG.warn("GlossaryTermApprovalWorkflow not found or error updating: {}", ex.getMessage());
        LOG.info("This might be expected if the workflow doesn't exist yet");
      }

      LOG.info("Completed v1100 workflow migration");
    } catch (Exception e) {
      LOG.error("Failed to update workflow", e);
    }
  }

  /**
   * Add new nodes for version-based routing
   */
  private static boolean addVersionRoutingNodes(List<WorkflowNodeDefinitionInterface> nodes) {
    boolean nodesAdded = false;

    // Check and add CheckIfGlossaryTermIsNew node
    if (nodes.stream().noneMatch(node -> "CheckIfGlossaryTermIsNew".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface versionCheckNode =
            JsonUtils.readValue(
                """
                                                                                            {
                                                                                              "type": "automatedTask",
                                                                                              "subType": "checkEntityAttributesTask",
                                                                                              "name": "CheckIfGlossaryTermIsNew",
                                                                                              "displayName": "Check if Glossary Term is New",
                                                                                              "config": {
                                                                                                "rules": "{\\"and\\":[{\\"==\\":[{\\"var\\":\\"version\\"},0.1]}]}"
                                                                                              },
                                                                                              "inputNamespaceMap": {
                                                                                                "relatedEntity": "global"
                                                                                              }
                                                                                            }
                                                                                            """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(versionCheckNode);
        LOG.info("Added new node: CheckIfGlossaryTermIsNew");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add CheckIfGlossaryTermIsNew node", e);
      }
    }

    // Add SetGlossaryTermStatusToInReviewForUpdate node for update path
    if (nodes.stream()
        .noneMatch(node -> "SetGlossaryTermStatusToInReviewForUpdate".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface inReviewUpdateNode =
            JsonUtils.readValue(
                """
                                                                                            {
                                                                                              "type": "automatedTask",
                                                                                              "subType": "setEntityAttributeTask",
                                                                                              "name": "SetGlossaryTermStatusToInReviewForUpdate",
                                                                                              "displayName": "Set Status to 'In Review' (Update)",
                                                                                              "config": {
                                                                                                "fieldName": "status",
                                                                                                "fieldValue": "In Review"
                                                                                              },
                                                                                              "inputNamespaceMap": {
                                                                                                "relatedEntity": "global",
                                                                                                "updatedBy": "global"
                                                                                              }
                                                                                            }
                                                                                            """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(inReviewUpdateNode);
        LOG.info("Added new node: SetGlossaryTermStatusToInReviewForUpdate");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add SetGlossaryTermStatusToInReviewForUpdate node", e);
      }
    }

    // Check and add ApprovalForUpdates node (unified userApprovalTask with suggestions)
    if (nodes.stream().noneMatch(node -> "ApprovalForUpdates".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface unifiedApprovalNode =
            JsonUtils.readValue(
                """
                                                                                            {
                                                                                              "type": "userTask",
                                                                                              "subType": "userApprovalTask",
                                                                                              "name": "ApprovalForUpdates",
                                                                                              "displayName": "Review Changes for Updates",
                                                                                              "config": {
                                                                                                "assignees": {
                                                                                                  "addReviewers": true
                                                                                                },
                                                                                                "approvalThreshold": 1,
                                                                                                "rejectionThreshold": 1
                                                                                              },
                                                                                              "inputNamespaceMap": {
                                                                                                "relatedEntity": "global"
                                                                                              },
                                                                                              "output": ["updatedBy"]
                                                                                            }
                                                                                            """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(unifiedApprovalNode);
        LOG.info("Added new node: ApprovalForUpdates");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add ApprovalForUpdates node", e);
      }
    }

    // Check and add RollbackGlossaryTermChanges node
    if (nodes.stream().noneMatch(node -> "RollbackGlossaryTermChanges".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface rollbackNode =
            JsonUtils.readValue(
                """
                                                                                            {
                                                                                              "type": "automatedTask",
                                                                                              "subType": "rollbackEntityTask",
                                                                                              "name": "RollbackGlossaryTermChanges",
                                                                                              "displayName": "Rollback Glossary Term Changes",
                                                                                              "config": {},
                                                                                              "inputNamespaceMap": {
                                                                                                "relatedEntity": "global",
                                                                                                "updatedBy": "ApprovalForUpdates"
                                                                                              }
                                                                                            }
                                                                                            """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(rollbackNode);
        LOG.info("Added new node: RollbackGlossaryTermChanges");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add RollbackGlossaryTermChanges node", e);
      }
    }

    // Check and add SetGlossaryTermStatusToApprovedAfterReview node
    if (nodes.stream()
        .noneMatch(node -> "SetGlossaryTermStatusToApprovedAfterReview".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface approvedDetailedNode =
            JsonUtils.readValue(
                """
                                                                                            {
                                                                                              "type": "automatedTask",
                                                                                              "subType": "setEntityAttributeTask",
                                                                                              "name": "SetGlossaryTermStatusToApprovedAfterReview",
                                                                                              "displayName": "Set Status to 'Approved' (After Review)",
                                                                                              "config": {
                                                                                                "fieldName": "status",
                                                                                                "fieldValue": "Approved"
                                                                                              },
                                                                                              "inputNamespaceMap": {
                                                                                                "relatedEntity": "global",
                                                                                                "updatedBy": "ApprovalForUpdates"
                                                                                              }
                                                                                            }
                                                                                            """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(approvedDetailedNode);
        LOG.info("Added new node: SetGlossaryTermStatusToApprovedAfterReview");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add SetGlossaryTermStatusToApprovedAfterReview node", e);
      }
    }

    // Check and add RollbackEnd node
    if (nodes.stream().noneMatch(node -> "RollbackEnd".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface rollbackEndNode =
            JsonUtils.readValue(
                """
                                                                                            {
                                                                                              "type": "endEvent",
                                                                                              "subType": "endEvent",
                                                                                              "name": "RollbackEnd",
                                                                                              "displayName": "Changes Rolled Back"
                                                                                            }
                                                                                            """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(rollbackEndNode);
        LOG.info("Added new node: RollbackEnd");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add RollbackEnd node", e);
      }
    }

    // Check and add ChangeReviewEnd node
    if (nodes.stream().noneMatch(node -> "ChangeReviewEnd".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface changeReviewEndNode =
            JsonUtils.readValue(
                """
                                                                                            {
                                                                                              "type": "endEvent",
                                                                                              "subType": "endEvent",
                                                                                              "name": "ChangeReviewEnd",
                                                                                              "displayName": "Approved After Change Review"
                                                                                            }
                                                                                            """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(changeReviewEndNode);
        LOG.info("Added new node: ChangeReviewEnd");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add ChangeReviewEnd node", e);
      }
    }

    return nodesAdded;
  }

  /**
   * Update and add edges for version-based routing
   */
  private static boolean updateEdgesForVersionRouting(List<EdgeDefinition> edges) {
    boolean edgesModified = false;

    // Check if we need to update the routing (look for the old direct edge)
    boolean hasOldDirectEdge =
        edges.stream()
            .anyMatch(
                edge ->
                    "CheckGlossaryTermIsReadyToBeReviewed".equals(edge.getFrom())
                        && "SetGlossaryTermStatusToInReview".equals(edge.getTo())
                        && "true".equals(edge.getCondition()));

    // Check if we already have the new routing through CheckIfGlossaryTermIsNew
    boolean hasNewRouting =
        edges.stream()
            .anyMatch(
                edge ->
                    "CheckGlossaryTermIsReadyToBeReviewed".equals(edge.getFrom())
                        && "CheckIfGlossaryTermIsNew".equals(edge.getTo())
                        && "true".equals(edge.getCondition()));

    // Only modify if we have the old routing and don't have the new routing
    if (hasOldDirectEdge && !hasNewRouting) {
      // Remove the old edge
      edges.removeIf(
          edge ->
              "CheckGlossaryTermIsReadyToBeReviewed".equals(edge.getFrom())
                  && "SetGlossaryTermStatusToInReview".equals(edge.getTo())
                  && "true".equals(edge.getCondition()));

      LOG.info(
          "Removed edge: CheckGlossaryTermIsReadyToBeReviewed -> SetGlossaryTermStatusToInReview (true)");
      edgesModified = true;

      // Add new routing through CheckIfGlossaryTermIsNew
      EdgeDefinition newRoutingEdge =
          new EdgeDefinition()
              .withFrom("CheckGlossaryTermIsReadyToBeReviewed")
              .withTo("CheckIfGlossaryTermIsNew")
              .withCondition("true");
      edges.add(newRoutingEdge);
      LOG.info(
          "Added edge: CheckGlossaryTermIsReadyToBeReviewed -> CheckIfGlossaryTermIsNew (true)");
    }

    // Add edges from CheckIfGlossaryTermIsNew to both review status nodes
    edgesModified |=
        addEdgeIfNotExists(
            edges, "CheckIfGlossaryTermIsNew", "SetGlossaryTermStatusToInReview", "true");
    edgesModified |=
        addEdgeIfNotExists(
            edges, "CheckIfGlossaryTermIsNew", "SetGlossaryTermStatusToInReviewForUpdate", "false");

    // Add edge from SetGlossaryTermStatusToInReviewForUpdate to ApprovalForUpdates
    edgesModified |=
        addEdgeIfNotExists(
            edges, "SetGlossaryTermStatusToInReviewForUpdate", "ApprovalForUpdates", null);

    // Add edges for ApprovalForUpdates outcomes
    edgesModified |=
        addEdgeIfNotExists(
            edges, "ApprovalForUpdates", "SetGlossaryTermStatusToApprovedAfterReview", "true");
    edgesModified |=
        addEdgeIfNotExists(edges, "ApprovalForUpdates", "RollbackGlossaryTermChanges", "false");

    // Add edges for final nodes
    edgesModified |= addEdgeIfNotExists(edges, "RollbackGlossaryTermChanges", "RollbackEnd", null);
    edgesModified |=
        addEdgeIfNotExists(
            edges, "SetGlossaryTermStatusToApprovedAfterReview", "ChangeReviewEnd", null);

    return edgesModified;
  }

  /**
   * Add edge if it doesn't already exist
   */
  private static boolean addEdgeIfNotExists(
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
      return true;
    }
    return false;
  }

  /**
   * Update the ApprovalGlossaryTerm node to add thresholds and output field
   */
  private static String updateApprovalNodeWithThresholdsAndOutput(String nodeJson) {
    try {
      // Parse the node JSON
      ObjectMapper mapper = new ObjectMapper();
      JsonNode rootNode = mapper.readTree(nodeJson);

      if (rootNode instanceof ObjectNode) {
        ObjectNode nodeObj = (ObjectNode) rootNode;

        // Navigate to config and add thresholds
        if (nodeObj.has("config") && nodeObj.get("config").isObject()) {
          ObjectNode configNode = (ObjectNode) nodeObj.get("config");

          // Add thresholds if they don't exist
          if (!configNode.has("approvalThreshold")) {
            configNode.put("approvalThreshold", 1);
            LOG.info("Added approvalThreshold: 1 (default)");
          }

          if (!configNode.has("rejectionThreshold")) {
            configNode.put("rejectionThreshold", 1);
            LOG.info("Added rejectionThreshold: 1 (default)");
          }
        }

        // Add output field if it doesn't exist
        if (!nodeObj.has("output")) {
          ArrayNode outputArray = mapper.createArrayNode();
          outputArray.add("updatedBy");
          nodeObj.set("output", outputArray);
          LOG.info("Added output: ['updatedBy'] to ApproveGlossaryTerm node");
        }
      }

      return mapper.writeValueAsString(rootNode);
    } catch (Exception e) {
      LOG.error("Failed to update node config with thresholds and output", e);
      return nodeJson; // Return original if update fails
    }
  }

  /**
   * Migrate setGlossaryTermStatusTask to setEntityAttributeTask
   */
  private static WorkflowNodeDefinitionInterface migrateGlossaryTermStatusNode(
      WorkflowNodeDefinitionInterface node) {
    try {
      // Parse original node as JSON to manipulate it
      String nodeJson = JsonUtils.pojoToJson(node);
      ObjectMapper mapper = new ObjectMapper();
      JsonNode nodeJsonNode = mapper.readTree(nodeJson);

      if (nodeJsonNode instanceof ObjectNode) {
        ObjectNode nodeObj = (ObjectNode) nodeJsonNode;

        // Change subType
        nodeObj.put("subType", "setEntityAttributeTask");

        // Transform config from glossaryTermStatus to fieldName/fieldValue
        if (nodeObj.has("config") && nodeObj.get("config").isObject()) {
          ObjectNode configNode = (ObjectNode) nodeObj.get("config");

          if (configNode.has("glossaryTermStatus")) {
            String statusValue = configNode.get("glossaryTermStatus").asText();
            configNode.remove("glossaryTermStatus");
            configNode.put("fieldName", "status");
            configNode.put("fieldValue", statusValue);
          }
        }
      }

      // Convert back to WorkflowNodeDefinitionInterface
      return JsonUtils.readValue(
          mapper.writeValueAsString(nodeJsonNode), WorkflowNodeDefinitionInterface.class);

    } catch (Exception e) {
      LOG.error("Failed to migrate glossary term status node", e);
      return node;
    }
  }

  /**
   * Update trigger from entityType string to entityTypes array
   */
  private static boolean updateTriggerToEntityTypes(WorkflowDefinition workflowDefinition) {
    try {
      if (workflowDefinition.getTrigger() != null) {
        String triggerJson = JsonUtils.pojoToJson(workflowDefinition.getTrigger());
        ObjectMapper mapper = new ObjectMapper();
        JsonNode triggerNode = mapper.readTree(triggerJson);

        if (triggerNode instanceof ObjectNode) {
          ObjectNode triggerObj = (ObjectNode) triggerNode;

          // Check if it's an eventBasedEntity trigger
          if ("eventBasedEntity".equals(triggerObj.get("type").asText())) {
            JsonNode configNode = triggerObj.get("config");

            if (configNode instanceof ObjectNode) {
              ObjectNode configObj = (ObjectNode) configNode;

              boolean triggerModified = false;

              // Check if there's an entityType field (old format)
              if (configObj.has("entityType")) {
                String entityType = configObj.get("entityType").asText();

                // Create entityTypes array with the single value
                ArrayNode entityTypesArray = mapper.createArrayNode();
                entityTypesArray.add(entityType);
                configObj.set("entityTypes", entityTypesArray);

                // Remove the old entityType field
                configObj.remove("entityType");

                LOG.info(
                    "Updated trigger from entityType='{}' to entityTypes=['{}']",
                    entityType,
                    entityType);
                triggerModified = true;
              }

              // Also migrate filter from string to entity-specific object format
              if (configObj.has("filter")) {
                JsonNode filterNode = configObj.get("filter");

                // If filter is a string, convert to entity-specific format
                if (filterNode.isTextual()) {
                  String filterStr = filterNode.asText();
                  ObjectNode newFilterObj = mapper.createObjectNode();

                  // Get entity types to create specific filters
                  if (configObj.has("entityTypes")) {
                    JsonNode entityTypesNode = configObj.get("entityTypes");
                    if (entityTypesNode.isArray()) {
                      for (JsonNode entityTypeNode : entityTypesNode) {
                        String entityType = entityTypeNode.asText();
                        // Apply the filter string to this specific entity type
                        // Keep the filter value as a string (it contains JSON Logic)
                        // PeriodicBatchEntityTrigger
                        newFilterObj.put(entityType, filterStr);
                      }
                    }
                  }

                  // Add a default filter as well for fallback
                  newFilterObj.put("default", filterStr);

                  if (filterStr != null && !filterStr.trim().isEmpty()) {
                    LOG.info(
                        "Migrated filter to entity-specific object format with filter: {}",
                        filterStr);
                  } else {
                    LOG.info("Migrated empty filter to entity-specific object format");
                  }

                  // Replace the string filter with object filter
                  configObj.set("filter", newFilterObj);
                  triggerModified = true;
                }
              }

              if (triggerModified) {
                // Convert back to trigger object
                var updatedTrigger =
                    JsonUtils.readValue(
                        mapper.writeValueAsString(triggerObj),
                        workflowDefinition.getTrigger().getClass());
                workflowDefinition.setTrigger(updatedTrigger);

                return true;
              }
            }
          }
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to update trigger to entityTypes array", e);
    }
    return false;
  }
}
