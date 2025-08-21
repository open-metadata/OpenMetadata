package org.openmetadata.service.migration.utils.v1100;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
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
   * Update GlossaryTermApprovalWorkflow to add approval and rejection thresholds
   * This migration adds the new threshold fields with default values to maintain
   * backward compatibility.
   */
  public static void updateGlossaryTermApprovalWorkflowWithThresholds() {
    try {
      LOG.info(
          "Starting v1100 migration - Adding approval and rejection thresholds to GlossaryTermApprovalWorkflow");

      WorkflowDefinitionRepository repository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

      try {
        WorkflowDefinition workflowDefinition =
            repository.getByName(
                null, GLOSSARY_TERM_APPROVAL_WORKFLOW, EntityUtil.Fields.EMPTY_FIELDS);

        LOG.info(
            "Updating approval task with thresholds in workflow '{}'",
            workflowDefinition.getName());

        // Find the ApproveGlossaryTerm node and update its config
        boolean updated = false;
        for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
          if ("ApproveGlossaryTerm".equals(node.getName())
              && "userApprovalTask".equals(node.getSubType())) {

            // Get the node's config as JSON to manipulate it
            String nodeJson = JsonUtils.pojoToJson(node);

            // Parse and update the config
            String updatedNodeJson = updateNodeConfigWithThresholds(nodeJson);

            // Convert back to node
            WorkflowNodeDefinitionInterface updatedNode =
                JsonUtils.readValue(updatedNodeJson, WorkflowNodeDefinitionInterface.class);

            // Replace the node in the list
            int index = workflowDefinition.getNodes().indexOf(node);
            workflowDefinition.getNodes().set(index, updatedNode);

            updated = true;
            LOG.info("Added approval and rejection thresholds to ApproveGlossaryTerm node");
            break;
          }
        }

        if (updated) {
          // Use createOrUpdate to update the workflow
          // This will handle the deployment to Flowable as well
          repository.createOrUpdate(null, workflowDefinition, ADMIN_USER_NAME);

          LOG.info(
              "Successfully updated workflow '{}' with approval and rejection thresholds",
              workflowDefinition.getName());
        } else {
          LOG.warn("ApproveGlossaryTerm node not found in workflow");
        }

      } catch (Exception ex) {
        LOG.warn("GlossaryTermApprovalWorkflow not found or error updating: {}", ex.getMessage());
        LOG.info("This might be expected if the workflow doesn't exist yet");
      }

      LOG.info("Completed v1100 approval/rejection thresholds migration");
    } catch (Exception e) {
      LOG.error("Failed to add approval/rejection thresholds to workflow", e);
    }
  }

  /**
   * Update the node config JSON to add threshold fields
   */
  private static String updateNodeConfigWithThresholds(String nodeJson) {
    try {
      // Parse the node JSON
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode rootNode = mapper.readTree(nodeJson);

      // Navigate to config
      if (rootNode.has("config") && rootNode.get("config").isObject()) {
        com.fasterxml.jackson.databind.node.ObjectNode configNode =
            (com.fasterxml.jackson.databind.node.ObjectNode) rootNode.get("config");

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

      return mapper.writeValueAsString(rootNode);
    } catch (Exception e) {
      LOG.error("Failed to update node config with thresholds", e);
      return nodeJson; // Return original if update fails
    }
  }
}
