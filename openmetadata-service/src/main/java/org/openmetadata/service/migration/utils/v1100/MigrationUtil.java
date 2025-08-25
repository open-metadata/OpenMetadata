package org.openmetadata.service.migration.utils.v1100;

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
   * 1. Add approval and rejection thresholds to support multi-person voting
   * 2. Add version-based approval routing for different paths between creates and updates
   * 3. Add detailed approval task for updates with higher thresholds
   * 4. Add rollback capability for rejected updates
   */
  public static void updateGlossaryTermApprovalWorkflowWithThresholds() {
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

        // Step 1: Update ApproveGlossaryTerm node with thresholds and output
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

        // Step 2: Add new nodes for version-based routing
        workflowModified |= addVersionRoutingNodes(nodes);

        // Step 3: Update and add edges for version-based routing
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

    // Check and add CheckIfEntityIsFirstVersion node
    if (nodes.stream().noneMatch(node -> "CheckIfEntityIsFirstVersion".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface versionCheckNode =
            JsonUtils.readValue(
                """
                    {
                      "type": "automatedTask",
                      "subType": "checkEntityAttributesTask",
                      "name": "CheckIfEntityIsFirstVersion",
                      "displayName": "Check if Entity is First Version",
                      "config": {
                        "rules": "{\\"<\\":[{\\"var\\":\\"version\\"},0.2]}"
                      },
                      "inputNamespaceMap": {
                        "relatedEntity": "global"
                      }
                    }
                    """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(versionCheckNode);
        LOG.info("Added new node: CheckIfEntityIsFirstVersion");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add CheckIfEntityIsFirstVersion node", e);
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
                      "subType": "setGlossaryTermStatusTask",
                      "name": "SetGlossaryTermStatusToInReviewForUpdate",
                      "displayName": "Set Status to 'In Review' (Update)",
                      "config": {
                        "glossaryTermStatus": "In Review"
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

    // Check and add DetailedApprovalForUpdates node
    if (nodes.stream().noneMatch(node -> "DetailedApprovalForUpdates".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface detailedApprovalNode =
            JsonUtils.readValue(
                """
                    {
                      "type": "userTask",
                      "subType": "detailedUserApprovalTask",
                      "name": "DetailedApprovalForUpdates",
                      "displayName": "Detailed Approval for Updates",
                      "config": {
                        "assignees": {
                          "addReviewers": true
                        },
                        "approvalThreshold": 2,
                        "rejectionThreshold": 1
                      },
                      "inputNamespaceMap": {
                        "relatedEntity": "global"
                      },
                      "output": ["updatedBy"]
                    }
                    """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(detailedApprovalNode);
        LOG.info("Added new node: DetailedApprovalForUpdates");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add DetailedApprovalForUpdates node", e);
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
                        "updatedBy": "DetailedApprovalForUpdates"
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

    // Check and add SetGlossaryTermStatusToApprovedDetailed node
    if (nodes.stream()
        .noneMatch(node -> "SetGlossaryTermStatusToApprovedDetailed".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface approvedDetailedNode =
            JsonUtils.readValue(
                """
                    {
                      "type": "automatedTask",
                      "subType": "setGlossaryTermStatusTask",
                      "name": "SetGlossaryTermStatusToApprovedDetailed",
                      "displayName": "Set Status to 'Approved' (After Detailed Review)",
                      "config": {
                        "glossaryTermStatus": "Approved"
                      },
                      "inputNamespaceMap": {
                        "relatedEntity": "global",
                        "updatedBy": "DetailedApprovalForUpdates"
                      }
                    }
                    """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(approvedDetailedNode);
        LOG.info("Added new node: SetGlossaryTermStatusToApprovedDetailed");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add SetGlossaryTermStatusToApprovedDetailed node", e);
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

    // Check and add DetailedApprovalEnd node
    if (nodes.stream().noneMatch(node -> "DetailedApprovalEnd".equals(node.getName()))) {
      try {
        WorkflowNodeDefinitionInterface detailedApprovalEndNode =
            JsonUtils.readValue(
                """
                    {
                      "type": "endEvent",
                      "subType": "endEvent",
                      "name": "DetailedApprovalEnd",
                      "displayName": "Approved After Detailed Review"
                    }
                    """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(detailedApprovalEndNode);
        LOG.info("Added new node: DetailedApprovalEnd");
        nodesAdded = true;
      } catch (Exception e) {
        LOG.error("Failed to add DetailedApprovalEnd node", e);
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

    // Check if we already have the new routing through CheckIfEntityIsFirstVersion
    boolean hasNewRouting =
        edges.stream()
            .anyMatch(
                edge ->
                    "CheckGlossaryTermIsReadyToBeReviewed".equals(edge.getFrom())
                        && "CheckIfEntityIsFirstVersion".equals(edge.getTo())
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

      // Add new routing through CheckIfEntityIsFirstVersion
      EdgeDefinition newRoutingEdge =
          new EdgeDefinition()
              .withFrom("CheckGlossaryTermIsReadyToBeReviewed")
              .withTo("CheckIfEntityIsFirstVersion")
              .withCondition("true");
      edges.add(newRoutingEdge);
      LOG.info(
          "Added edge: CheckGlossaryTermIsReadyToBeReviewed -> CheckIfEntityIsFirstVersion (true)");
    }

    // Add edges from CheckIfEntityIsFirstVersion to both review status nodes
    edgesModified |=
        addEdgeIfNotExists(
            edges, "CheckIfEntityIsFirstVersion", "SetGlossaryTermStatusToInReview", "true");
    edgesModified |=
        addEdgeIfNotExists(
            edges,
            "CheckIfEntityIsFirstVersion",
            "SetGlossaryTermStatusToInReviewForUpdate",
            "false");

    // Add edge from SetGlossaryTermStatusToInReviewForUpdate to DetailedApprovalForUpdates
    edgesModified |=
        addEdgeIfNotExists(
            edges, "SetGlossaryTermStatusToInReviewForUpdate", "DetailedApprovalForUpdates", null);

    // Add edges for DetailedApprovalForUpdates outcomes
    edgesModified |=
        addEdgeIfNotExists(
            edges, "DetailedApprovalForUpdates", "SetGlossaryTermStatusToApprovedDetailed", "true");
    edgesModified |=
        addEdgeIfNotExists(
            edges, "DetailedApprovalForUpdates", "RollbackGlossaryTermChanges", "false");

    // Add edges for final nodes
    edgesModified |= addEdgeIfNotExists(edges, "RollbackGlossaryTermChanges", "RollbackEnd", null);
    edgesModified |=
        addEdgeIfNotExists(
            edges, "SetGlossaryTermStatusToApprovedDetailed", "DetailedApprovalEnd", null);

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
}
