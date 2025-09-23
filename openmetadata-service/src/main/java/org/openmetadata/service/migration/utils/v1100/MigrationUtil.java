package org.openmetadata.service.migration.utils.v1100;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {
  private static final int BATCH_SIZE = 500;
  private final CollectionDAO collectionDAO;
  private boolean isPostgres = false;

  private static final String ADMIN_USER_NAME = "admin";
  private static final String GLOSSARY_TERM_APPROVAL_WORKFLOW = "GlossaryTermApprovalWorkflow";

  public MigrationUtil(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
  }

  public void migrateEntityStatusForExistingEntities(Handle handle) {
    try {
      Connection connection = handle.getConnection();
      DatabaseMetaData metaData = connection.getMetaData();
      String dbType = metaData.getDatabaseProductName().toLowerCase();
      isPostgres = dbType.contains("postgres") || dbType.contains("postgresql");

      LOG.info(
          "Starting entityStatus migration for v1.10.0 on {} database",
          isPostgres ? "PostgreSQL" : "MySQL");
    } catch (SQLException e) {
      LOG.error("Failed to determine database type, assuming MySQL: {}", e.getMessage());
      isPostgres = false;
    }

    // All entity tables that need entityStatus field
    String[] entityTables = {
      "table_entity",
      "dashboard_entity",
      "pipeline_entity",
      "topic_entity",
      "ml_model_entity",
      "storage_container_entity",
      "search_index_entity",
      "stored_procedure_entity",
      "dashboard_data_model_entity",
      "database_entity",
      "database_schema_entity",
      "metric_entity",
      "chart_entity",
      "report_entity",
      "data_product_entity",
      "tag",
      "classification",
      "glossary_term_entity",
      "data_contract_entity",
      "test_case"
    };

    int totalEntitiesMigrated = 0;

    for (String tableName : entityTables) {
      int migrated = 0;

      if (tableName.equals("glossary_term_entity")) {
        migrated = migrateGlossaryTermStatus(handle);
      } else if (tableName.equals("data_contract_entity")) {
        migrated = migrateDataContractStatus(handle);
      } else {
        migrated = migrateEntityStatusForTable(handle, tableName);
      }

      totalEntitiesMigrated += migrated;
    }

    LOG.info("===== MIGRATION SUMMARY =====");
    LOG.info("Total entities migrated with entityStatus field: {}", totalEntitiesMigrated);
    LOG.info("===== MIGRATION COMPLETE =====");
  }

  private int migrateEntityStatusForTable(Handle handle, String tableName) {
    LOG.info("Processing table: {}", tableName);
    int totalMigrated = 0;
    int batchNumber = 0;

    try {
      // First, get the total count of entities that need migration
      String countSql = buildCountQuery(tableName);
      int totalToMigrate = handle.createQuery(countSql).mapTo(Integer.class).one();

      if (totalToMigrate == 0) {
        LOG.info(
            "✓ Completed {}: No records needed migration (already have entityStatus)", tableName);
        return 0;
      }

      LOG.info("  Found {} records to migrate in {}", totalToMigrate, tableName);

      if (isPostgres) {
        // PostgreSQL: Use CTE with LIMIT for batch processing
        totalMigrated = migratePostgresBatch(handle, tableName, totalToMigrate);
      } else {
        // MySQL: Need to use ORDER BY with LIMIT for deterministic batches
        totalMigrated = migrateMySQLBatch(handle, tableName, totalToMigrate);
      }

      if (totalMigrated > 0) {
        LOG.info("✓ Completed {}: {} total records migrated", tableName, totalMigrated);
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating entityStatus for table {}: {}", tableName, e.getMessage(), e);
    }

    return totalMigrated;
  }

  private int migratePostgresBatch(Handle handle, String tableName, int totalToMigrate)
      throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "WITH batch AS ( "
                  + "  SELECT id "
                  + "  FROM %1$s "
                  + "  WHERE NOT ((json)::jsonb ?? 'entityStatus') "
                  + "  ORDER BY id "
                  + "  LIMIT %2$d "
                  + ") "
                  + "UPDATE %1$s t "
                  + "SET json = jsonb_set((t.json)::jsonb, '{entityStatus}', '\"Approved\"'::jsonb)::json "
                  + "FROM batch "
                  + "WHERE t.id = batch.id "
                  + "  AND NOT ((t.json)::jsonb ?? 'entityStatus')",
              tableName, BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} records in {}ms (Total for {}: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            tableName,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateMySQLBatch(Handle handle, String tableName, int totalToMigrate)
      throws InterruptedException {
    int totalMigrated = 0;
    int batchNumber = 0;

    while (totalMigrated < totalToMigrate) {
      batchNumber++;

      String updateSql =
          String.format(
              "UPDATE %1$s t "
                  + "JOIN ( "
                  + "  SELECT id "
                  + "  FROM %1$s "
                  + "  WHERE JSON_EXTRACT(json, '$.entityStatus') IS NULL "
                  + "  ORDER BY id "
                  + "  LIMIT %2$d "
                  + ") s ON t.id = s.id "
                  + "SET t.json = JSON_SET(t.json, '$.entityStatus', 'Approved') "
                  + "WHERE JSON_EXTRACT(t.json, '$.entityStatus') IS NULL",
              tableName, BATCH_SIZE);

      long startTime = System.currentTimeMillis();
      int batchCount = handle.createUpdate(updateSql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (batchCount > 0) {
        totalMigrated += batchCount;
        LOG.info(
            "  Batch {}: Migrated {} records in {}ms (Total for {}: {}/{})",
            batchNumber,
            batchCount,
            executionTime,
            tableName,
            totalMigrated,
            totalToMigrate);
        Thread.sleep(100);
      } else {
        break;
      }
    }

    return totalMigrated;
  }

  private int migrateGlossaryTermStatus(Handle handle) {
    LOG.info("Processing glossary_term_entity: migrating 'status' to 'entityStatus'");
    int totalMigrated = 0;

    try {
      String sql;
      if (isPostgres) {
        sql =
            "UPDATE glossary_term_entity "
                + "SET json = jsonb_set(json - 'status', '{entityStatus}', "
                + "COALESCE(json->'status', '\"Approved\"'::jsonb)) "
                + "WHERE json ?? 'status' "
                + "AND NOT json ?? 'entityStatus'";
      } else {
        sql =
            "UPDATE glossary_term_entity "
                + "SET json = JSON_SET(JSON_REMOVE(json, '$.status'), '$.entityStatus', "
                + "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')), 'Approved')) "
                + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
      }

      long startTime = System.currentTimeMillis();
      totalMigrated = handle.createUpdate(sql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (totalMigrated > 0) {
        LOG.info(
            "✓ Completed glossary_term_entity: {} records migrated from 'status' to 'entityStatus' in {}ms",
            totalMigrated,
            executionTime);
      } else {
        LOG.info("✓ Completed glossary_term_entity: No records needed migration");
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating glossary_term_entity status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private int migrateDataContractStatus(Handle handle) {
    LOG.info(
        "Processing data_contract_entity: migrating 'status' to 'entityStatus' and 'Active' to 'Approved'");
    int totalMigrated = 0;

    try {
      String sql;
      if (isPostgres) {
        // PostgreSQL: Rename status to entityStatus and convert Active to Approved
        sql =
            "UPDATE data_contract_entity "
                + "SET json = jsonb_set(json - 'status', '{entityStatus}', "
                + "CASE "
                + "  WHEN json->>'status' = 'Active' THEN '\"Approved\"'::jsonb "
                + "  ELSE COALESCE(json->'status', '\"Approved\"'::jsonb) "
                + "END) "
                + "WHERE json ?? 'status' "
                + "AND NOT json ?? 'entityStatus'";
      } else {
        // MySQL: Rename status to entityStatus and convert Active to Approved
        sql =
            "UPDATE data_contract_entity "
                + "SET json = JSON_SET(JSON_REMOVE(json, '$.status'), '$.entityStatus', "
                + "CASE "
                + "  WHEN JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) = 'Active' THEN 'Approved' "
                + "  ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')), 'Approved') "
                + "END) "
                + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
                + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
      }

      long startTime = System.currentTimeMillis();
      totalMigrated = handle.createUpdate(sql).execute();
      long executionTime = System.currentTimeMillis() - startTime;

      if (totalMigrated > 0) {
        LOG.info(
            "✓ Completed data_contract_entity: {} records migrated from 'status' to 'entityStatus' in {}ms",
            totalMigrated,
            executionTime);
      } else {
        LOG.info("✓ Completed data_contract_entity: No records needed migration");
      }

    } catch (Exception e) {
      LOG.error("✗ FAILED migrating data_contract_entity status: {}", e.getMessage(), e);
    }

    return totalMigrated;
  }

  private String buildCountQuery(String tableName) {
    if (isPostgres) {
      return String.format(
          "SELECT COUNT(*) FROM %s " + "WHERE NOT (json ?? 'entityStatus')", tableName);

    } else {
      return String.format(
          "SELECT COUNT(*) FROM %s " + "WHERE JSON_EXTRACT(json, '$.entityStatus') IS NULL",
          tableName);
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
                                        "rules": "{\\"==\\":[{\\"var\\":\\"version\\"},0.1]}"
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
                                        "rejectionThreshold": 1,
                                        "supportsSuggestions": true
                                      },
                                      "inputNamespaceMap": {
                                        "relatedEntity": "global"
                                      },
                                      "output": ["updatedBy"]
                                    }
                                    """,
                WorkflowNodeDefinitionInterface.class);
        nodes.add(unifiedApprovalNode);
        LOG.info("Added new node: ApprovalForUpdates (unified task with suggestions)");
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
                                      "subType": "setGlossaryTermStatusTask",
                                      "name": "SetGlossaryTermStatusToApprovedAfterReview",
                                      "displayName": "Set Status to 'Approved' (After Review)",
                                      "config": {
                                        "glossaryTermStatus": "Approved"
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
              if (configObj.has("entityType") && !configObj.has("entityTypes")) {
                String entityType = configObj.get("entityType").asText();
                configObj.remove("entityType");

                // Create entityTypes array with the single value
                ArrayNode entityTypesArray = mapper.createArrayNode();
                entityTypesArray.add(entityType);
                configObj.set("entityTypes", entityTypesArray);

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
