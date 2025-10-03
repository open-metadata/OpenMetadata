package org.openmetadata.service.migration.utils.v1100;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {
  private static final int BATCH_SIZE = 500;
  private final Handle handle;
  private final ConnectionType connectionType;

  private static final String ADMIN_USER_NAME = "admin";
  private static final String GLOSSARY_TERM_APPROVAL_WORKFLOW = "GlossaryTermApprovalWorkflow";

  public MigrationUtil(Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
  }

  public void migrateEntityStatusForExistingEntities() {
    int totalEntitiesMigrated = 0;
    // Only migrate glossary terms and data contracts that have existing status fields
    totalEntitiesMigrated += migrateGlossaryTermStatus();
    totalEntitiesMigrated += migrateDataContractStatus();

    LOG.info("===== MIGRATION SUMMARY =====");
    LOG.info("Total entities migrated with status field changes: {}", totalEntitiesMigrated);
    LOG.info("===== MIGRATION COMPLETE =====");
  }

  private int migrateGlossaryTermStatus() {
    LOG.info("Processing glossary_term_entity: migrating 'status' to 'entityStatus'");
    int totalMigrated = 0;

    try {
      // First, get the total count of entities that need migration
      String countSql = buildGlossaryTermCountQuery();
      int totalToMigrate = handle.createQuery(countSql).mapTo(Integer.class).one();

      if (totalToMigrate == 0) {
        LOG.info("✓ Completed glossary_term_entity: No records needed migration");
        return 0;
      }

      LOG.info("  Found {} glossary terms to migrate", totalToMigrate);

      if (connectionType == ConnectionType.POSTGRES) {
        totalMigrated = migrateGlossaryTermPostgresBatch(totalToMigrate);
      } else {
        totalMigrated = migrateGlossaryTermMySQLBatch(totalToMigrate);
      }

      if (totalMigrated > 0) {
        LOG.info("✓ Completed glossary_term_entity: {} total records migrated", totalMigrated);
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating glossary_term_entity status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private int migrateDataContractStatus() {
    LOG.info(
        "Processing data_contract_entity: migrating 'status' to 'entityStatus' and 'Active' to 'Approved'");
    int totalMigrated = 0;

    try {
      // First, get the total count of entities that need migration
      String countSql = buildDataContractCountQuery();
      int totalToMigrate = handle.createQuery(countSql).mapTo(Integer.class).one();

      if (totalToMigrate == 0) {
        LOG.info("✓ Completed data_contract_entity: No records needed migration");
        return 0;
      }

      LOG.info("  Found {} data contracts to migrate", totalToMigrate);

      if (connectionType == ConnectionType.POSTGRES) {
        totalMigrated = migrateDataContractPostgresBatch(totalToMigrate);
      } else {
        totalMigrated = migrateDataContractMySQLBatch(totalToMigrate);
      }

      if (totalMigrated > 0) {
        LOG.info("✓ Completed data_contract_entity: {} total records migrated", totalMigrated);
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating data_contract_entity status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private String buildGlossaryTermCountQuery() {
    if (connectionType == ConnectionType.POSTGRES) {
      return "SELECT COUNT(*) FROM glossary_term_entity "
          + "WHERE json ?? 'status' AND NOT json ?? 'entityStatus'";
    } else {
      return "SELECT COUNT(*) FROM glossary_term_entity "
          + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
    }
  }

  private String buildDataContractCountQuery() {
    if (connectionType == ConnectionType.POSTGRES) {
      return "SELECT COUNT(*) FROM data_contract_entity "
          + "WHERE json ?? 'status' AND NOT json ?? 'entityStatus'";
    } else {
      return "SELECT COUNT(*) FROM data_contract_entity "
          + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
    }
  }

  private int migrateGlossaryTermPostgresBatch(int totalToMigrate) throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "WITH batch AS ( "
                  + "  SELECT id "
                  + "  FROM glossary_term_entity "
                  + "  WHERE json ?? 'status' AND NOT json ?? 'entityStatus' "
                  + "  ORDER BY id "
                  + "  LIMIT %d "
                  + ") "
                  + "UPDATE glossary_term_entity t "
                  + "SET json = jsonb_set(t.json - 'status', '{entityStatus}', "
                  + "COALESCE(t.json->'status', '\"Approved\"'::jsonb)) "
                  + "FROM batch "
                  + "WHERE t.id = batch.id "
                  + "  AND t.json ?? 'status' AND NOT t.json ?? 'entityStatus'",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} glossary terms in {}ms (Total: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateGlossaryTermMySQLBatch(int totalToMigrate) throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "UPDATE glossary_term_entity t "
                  + "JOIN ( "
                  + "  SELECT id "
                  + "  FROM glossary_term_entity "
                  + "  WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                  + "    AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0 "
                  + "  ORDER BY id "
                  + "  LIMIT %d "
                  + ") s ON t.id = s.id "
                  + "SET t.json = JSON_SET(JSON_REMOVE(t.json, '$.status'), '$.entityStatus', "
                  + "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')), 'Approved')) "
                  + "WHERE JSON_CONTAINS_PATH(t.json, 'one', '$.status') = 1 "
                  + "  AND JSON_CONTAINS_PATH(t.json, 'one', '$.entityStatus') = 0",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} glossary terms in {}ms (Total: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateDataContractPostgresBatch(int totalToMigrate) throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "WITH batch AS ( "
                  + "  SELECT id "
                  + "  FROM data_contract_entity "
                  + "  WHERE json ?? 'status' AND NOT json ?? 'entityStatus' "
                  + "  ORDER BY id "
                  + "  LIMIT %d "
                  + ") "
                  + "UPDATE data_contract_entity t "
                  + "SET json = jsonb_set(t.json - 'status', '{entityStatus}', "
                  + "CASE "
                  + "  WHEN t.json->>'status' = 'Active' THEN '\"Approved\"'::jsonb "
                  + "  ELSE COALESCE(t.json->'status', '\"Approved\"'::jsonb) "
                  + "END) "
                  + "FROM batch "
                  + "WHERE t.id = batch.id "
                  + "  AND t.json ?? 'status' AND NOT t.json ?? 'entityStatus'",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} data contracts in {}ms (Total: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateDataContractMySQLBatch(int totalToMigrate) throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "UPDATE data_contract_entity t "
                  + "JOIN ( "
                  + "  SELECT id "
                  + "  FROM data_contract_entity "
                  + "  WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                  + "    AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0 "
                  + "  ORDER BY id "
                  + "  LIMIT %d "
                  + ") s ON t.id = s.id "
                  + "SET t.json = JSON_SET(JSON_REMOVE(t.json, '$.status'), '$.entityStatus', "
                  + "CASE "
                  + "  WHEN JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')) = 'Active' THEN 'Approved' "
                  + "  ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')), 'Approved') "
                  + "END) "
                  + "WHERE JSON_CONTAINS_PATH(t.json, 'one', '$.status') = 1 "
                  + "  AND JSON_CONTAINS_PATH(t.json, 'one', '$.entityStatus') = 0",
              BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} data contracts in {}ms (Total: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  public void cleanupOrphanedDataContracts() {
    LOG.info("Starting cleanup of orphaned data contracts...");

    try {
      DataContractRepository dataContractRepository =
          (DataContractRepository) Entity.getEntityRepository(Entity.DATA_CONTRACT);

      List<DataContract> allDataContracts =
          dataContractRepository.listAll(
              dataContractRepository.getFields("id,entity"), new ListFilter(Include.ALL));

      if (allDataContracts.isEmpty()) {
        LOG.info("✓ No data contracts found - cleanup complete");
        return;
      }

      int deletedCount = 0;
      int totalContracts = allDataContracts.size();

      LOG.info("Found {} data contracts to validate", totalContracts);

      for (DataContract dataContract : allDataContracts) {
        try {
          // Try to get the associated entity
          Entity.getEntityReferenceById(
              dataContract.getEntity().getType(),
              dataContract.getEntity().getId(),
              Include.NON_DELETED);

        } catch (EntityNotFoundException e) {
          LOG.info(
              "Deleting orphaned data contract '{}' - associated {} entity with ID {} not found",
              dataContract.getFullyQualifiedName(),
              dataContract.getEntity().getType(),
              dataContract.getEntity().getId());

          try {
            dataContractRepository.delete(Entity.ADMIN_USER_NAME, dataContract.getId(), true, true);
            deletedCount++;
          } catch (Exception deleteException) {
            LOG.warn(
                "Failed to delete orphaned data contract '{}': {}",
                dataContract.getFullyQualifiedName(),
                deleteException.getMessage());
          }
        }
      }

      LOG.info(
          "✓ Cleanup complete: {} orphaned data contracts deleted out of {} total",
          deletedCount,
          totalContracts);

    } catch (Exception e) {
      LOG.error("✗ FAILED cleanup of orphaned data contracts: {}", e.getMessage(), e);
    }
  }

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
