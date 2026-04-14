package org.openmetadata.service.migration.utils.v1140;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.runtime.ProcessInstance;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Set<String> BATCH_NODE_SUBTYPES =
      Set.of(
          "checkEntityAttributesTask",
          "checkChangeDescriptionTask",
          "setEntityAttributeTask",
          "rollbackEntityTask",
          "sinkTask",
          "dataCompletenessTask",
          "setEntityCertificationTask",
          "setGlossaryTermStatusTask",
          "runAppTask",
          "createAndRunIngestionPipelineTask",
          "applyRecognizerFeedbackTask",
          "rejectRecognizerFeedbackTask",
          "userApprovalTask",
          "createRecognizerFeedbackApprovalTask");

  private static final Set<String> CHECK_NODE_SUBTYPES =
      Set.of("checkEntityAttributesTask", "checkChangeDescriptionTask", "dataCompletenessTask");

  private static final String PERIODIC_BATCH_ENTITY = "periodicBatchEntity";

  /**
   * Migrates all workflow definitions to support batch entity processing:
   *
   * <ol>
   *   <li>Rebuilds the trigger {@code output} array to contain exactly {@code ["entityList", …,
   *       "updatedBy"]}, stripping legacy {@code relatedEntity} entries.
   *   <li>Ensures {@code config.storeStageStatus} is {@code true} for periodic-batch workflows.
   *   <li>Adds {@code entityList} to each batch-capable automated task node's
   *       {@code inputNamespaceMap}, using the same namespace as {@code relatedEntity} (or
   *       {@code "global"} if absent).
   * </ol>
   *
   * <p>Phase 2 deletes stuck EXCEPTION-state Flowable instances and redeploys the fixed workflows,
   * ensuring the new inclusive-gateway BPMN expression is active.
   *
   * <p>The migration is idempotent — safe to run multiple times.
   */
  public static void migrateWorkflowInputNamespaceMap() {
    LOG.info("Starting v1140 migration: adding entityList to workflow node inputNamespaceMaps");

    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    // Phase 1: Fix raw JSON in the DB without going through POJO deserialization.
    // Stored workflows may contain fields (e.g. "relatedEntity" in setEntityAttributeTask
    // inputNamespaceMap) that now fail schema validation, preventing listAll() from working.
    // Reading and writing raw JSON strings bypasses that issue entirely.
    int fixedCount = 0;
    int offset = 0;
    final int PAGE_SIZE = 100;
    Set<String> migratedFqns = new HashSet<>();
    List<String> rawPage;
    do {
      rawPage = repository.getDao().listAfterWithOffset(PAGE_SIZE, offset);
      for (String rawJson : rawPage) {
        try {
          JsonNode originalNode = MAPPER.readTree(rawJson);
          JsonNode migrated = migrateWorkflowJson(originalNode);
          if (migrated != originalNode) {
            UUID id = UUID.fromString(originalNode.get("id").asText());
            String fqn = originalNode.get("fullyQualifiedName").asText();
            repository.getDao().update(id, fqn, MAPPER.writeValueAsString(migrated));
            migratedFqns.add(fqn);
            fixedCount++;
            LOG.info("Fixed workflow JSON for '{}'", fqn);
          }
        } catch (Exception e) {
          LOG.error("Error fixing raw workflow JSON: {}", e.getMessage(), e);
        }
      }
      offset += PAGE_SIZE;
    } while (rawPage.size() == PAGE_SIZE);

    LOG.info("Phase 1 complete: {} workflow JSON records updated", fixedCount);

    if (migratedFqns.isEmpty()) {
      LOG.info("No workflows required migration, skipping BPMN redeploy");
      return;
    }

    // Phase 2: Clean up stuck EXCEPTION-state Flowable instances and redeploy migrated workflows.
    int totalRedeployed = 0;
    List<String> failures = new ArrayList<>();
    for (String fqn : migratedFqns) {
      try {
        forceCleanBrokenInstancesForFqn(fqn);
        WorkflowDefinition workflow =
            repository.getByName(null, fqn, EntityUtil.Fields.EMPTY_FIELDS);
        WorkflowHandler.getInstance().deploy(new Workflow(workflow));
        totalRedeployed++;
        LOG.info("Redeployed workflow to Flowable: {}", fqn);
      } catch (Exception e) {
        LOG.error("Error redeploying workflow '{}': {}", fqn, e.getMessage(), e);
        failures.add(fqn);
      }
    }

    LOG.info(
        "Completed v1140 migration: {} workflow definitions redeployed with entityList support",
        totalRedeployed);

    if (!failures.isEmpty()) {
      throw new RuntimeException("v1140 migration failed to redeploy workflows: " + failures);
    }
  }

  private static void forceCleanBrokenInstancesForFqn(String fqn) {
    if (!WorkflowHandler.isInitialized()) {
      LOG.warn("WorkflowHandler not initialized, skipping broken-instance cleanup for '{}'", fqn);
      return;
    }
    RuntimeService runtimeService = WorkflowHandler.getInstance().getRuntimeService();

    List<ProcessInstance> mainInstances =
        runtimeService.createProcessInstanceQuery().processDefinitionKey(fqn).list();
    for (ProcessInstance pi : mainInstances) {
      LOG.info(
          "Deleting stuck process instance {} for workflow {} (pre-fix EXCEPTION state)",
          pi.getId(),
          fqn);
      runtimeService.deleteProcessInstance(
          pi.getId(), "v1140 reprocessing — cleaning up pre-fix EXCEPTION state");
    }

    List<ProcessInstance> triggerInstances =
        runtimeService
            .createProcessInstanceQuery()
            .processDefinitionKeyLike(fqn + "Trigger%")
            .list();
    for (ProcessInstance pi : triggerInstances) {
      LOG.info(
          "Deleting stuck trigger instance {} for workflow {} (pre-fix EXCEPTION state)",
          pi.getId(),
          fqn);
      runtimeService.deleteProcessInstance(
          pi.getId(), "v1140 reprocessing — cleaning up pre-fix EXCEPTION state");
    }
  }

  static JsonNode migrateWorkflowJson(JsonNode root) {
    if (root == null || !root.isObject()) {
      return root;
    }

    boolean changed = false;
    ObjectNode result = ((ObjectNode) root).deepCopy();

    JsonNode triggerNode = result.get("trigger");
    if (triggerNode != null && triggerNode.isObject()) {
      ObjectNode triggerObj = (ObjectNode) triggerNode;

      // Rebuild the trigger output array: always ["entityList", ...custom..., "updatedBy"]
      // This replaces the old guard `if (!hasEntityList)` which left half-migrated rows intact.
      JsonNode outputNode = triggerObj.get("output");
      if (outputNode != null && outputNode.isArray()) {
        LinkedHashSet<String> canonical = new LinkedHashSet<>();
        canonical.add("entityList");
        for (JsonNode item : outputNode) {
          String val = item.asText();
          if (!"entityList".equals(val)
              && !"relatedEntity".equals(val)
              && !"updatedBy".equals(val)) {
            canonical.add(val);
          }
        }
        canonical.add("updatedBy");

        List<String> existing = new ArrayList<>();
        for (JsonNode item : outputNode) {
          existing.add(item.asText());
        }
        if (!existing.equals(new ArrayList<>(canonical))) {
          ArrayNode newOutput = MAPPER.createArrayNode();
          for (String val : canonical) {
            newOutput.add(val);
          }
          triggerObj.set("output", newOutput);
          changed = true;
        }
      }

      // Ensure storeStageStatus=true for periodicBatchEntity triggers
      JsonNode typeNode = triggerObj.get("type");
      if (typeNode != null && PERIODIC_BATCH_ENTITY.equals(typeNode.asText())) {
        JsonNode configNode = result.get("config");
        if (configNode == null || !configNode.isObject()) {
          ObjectNode newConfig = MAPPER.createObjectNode();
          newConfig.put("storeStageStatus", true);
          result.set("config", newConfig);
          changed = true;
        } else if (!configNode.has("storeStageStatus")
            || !configNode.get("storeStageStatus").asBoolean()) {
          ((ObjectNode) configNode).put("storeStageStatus", true);
          changed = true;
        }
      }
    }

    // Build a map: targetNode → list of {sourceNode, condition} from edges
    Map<String, List<String[]>> incomingEdge = new HashMap<>();
    JsonNode edgesNode = result.get("edges");
    if (edgesNode != null && edgesNode.isArray()) {
      for (JsonNode edge : edgesNode) {
        String from = edge.has("from") ? edge.get("from").asText() : null;
        String to = edge.has("to") ? edge.get("to").asText() : null;
        String condition = edge.has("condition") ? edge.get("condition").asText() : null;
        if (from != null && to != null) {
          incomingEdge
              .computeIfAbsent(to, k -> new ArrayList<>())
              .add(new String[] {from, condition});
        }
      }
    }

    // Build a map: nodeName → subType
    Map<String, String> nodeSubType = new HashMap<>();
    JsonNode nodesNode = result.get("nodes");
    if (nodesNode != null && nodesNode.isArray()) {
      for (JsonNode nodeElement : nodesNode) {
        String name = nodeElement.has("name") ? nodeElement.get("name").asText() : null;
        String subType = nodeElement.has("subType") ? nodeElement.get("subType").asText() : "";
        if (name != null) {
          nodeSubType.put(name, subType);
        }
      }
    }

    if (nodesNode != null && nodesNode.isArray()) {
      ArrayNode newNodes = MAPPER.createArrayNode();
      boolean nodesChanged = false;
      for (JsonNode nodeElement : nodesNode) {
        if (nodeElement.isObject()) {
          JsonNode subTypeNode = nodeElement.get("subType");
          String subType = subTypeNode != null ? subTypeNode.asText() : "";
          if (BATCH_NODE_SUBTYPES.contains(subType)) {
            String nodeName = nodeElement.has("name") ? nodeElement.get("name").asText() : null;
            List<String[]> incoming = nodeName != null ? incomingEdge.get(nodeName) : null;
            JsonNode migratedNode = addEntityListToNamespaceMap(nodeElement, incoming, nodeSubType);
            migratedNode = migrateInputArray(migratedNode);
            newNodes.add(migratedNode);
            if (migratedNode != nodeElement) {
              nodesChanged = true;
            }
          } else {
            newNodes.add(nodeElement);
          }
        } else {
          newNodes.add(nodeElement);
        }
      }
      if (nodesChanged) {
        result.set("nodes", newNodes);
        changed = true;
      }
    }

    return changed ? result : root;
  }

  static JsonNode addEntityListToNamespaceMap(
      JsonNode nodeObj, List<String[]> incomingEdges, Map<String, String> nodeSubType) {
    JsonNode inputNamespaceMapNode = nodeObj.get("inputNamespaceMap");
    if (inputNamespaceMapNode == null || !inputNamespaceMapNode.isObject()) {
      return nodeObj;
    }
    ObjectNode inputNamespaceMap = (ObjectNode) inputNamespaceMapNode;

    boolean hasEntityList = inputNamespaceMap.has("entityList");
    boolean hasTrueEntityList = inputNamespaceMap.has("true_entityList");
    boolean hasFalseEntityList = inputNamespaceMap.has("false_entityList");
    boolean hasRelatedEntity = inputNamespaceMap.has("relatedEntity");

    // Already correctly set with no legacy relatedEntity — nothing to do
    if ((hasEntityList || hasTrueEntityList || hasFalseEntityList) && !hasRelatedEntity) {
      return nodeObj;
    }

    ObjectNode newInputNamespaceMap = inputNamespaceMap.deepCopy();
    newInputNamespaceMap.remove("relatedEntity");

    // Only compute entityList keys when none are already present — preserves correct mappings
    if (!hasEntityList && !hasTrueEntityList && !hasFalseEntityList) {
      if (incomingEdges != null && !incomingEdges.isEmpty()) {
        for (String[] incoming : incomingEdges) {
          String sourceNode = incoming[0];
          String condition = incoming[1];
          String sourceSubType = nodeSubType.getOrDefault(sourceNode, "");
          if (CHECK_NODE_SUBTYPES.contains(sourceSubType)) {
            if (condition != null && !condition.isEmpty()) {
              // "true"/"false" for checkEntity/checkChangeDesc, band name for dataCompleteness
              newInputNamespaceMap.put(condition + "_entityList", sourceNode);
            } else {
              newInputNamespaceMap.put("entityList", sourceNode);
            }
          } else {
            newInputNamespaceMap.put("entityList", "global");
          }
        }
      } else {
        newInputNamespaceMap.put("entityList", "global");
      }
    }

    ObjectNode result = ((ObjectNode) nodeObj).deepCopy();
    result.set("inputNamespaceMap", newInputNamespaceMap);
    return result;
  }

  static JsonNode migrateInputArray(JsonNode nodeObj) {
    JsonNode inputNode = nodeObj.get("input");
    if (inputNode == null || !inputNode.isArray()) {
      return nodeObj;
    }

    boolean needsChange = false;
    for (JsonNode item : inputNode) {
      if ("relatedEntity".equals(item.asText())) {
        needsChange = true;
        break;
      }
    }
    if (!needsChange) {
      return nodeObj;
    }

    ArrayNode newInput = MAPPER.createArrayNode();
    boolean addedEntityList = false;
    for (JsonNode item : inputNode) {
      if ("relatedEntity".equals(item.asText())) {
        if (!addedEntityList) {
          newInput.add("entityList");
          addedEntityList = true;
        }
      } else {
        newInput.add(item);
      }
    }

    ObjectNode result = ((ObjectNode) nodeObj).deepCopy();
    result.set("input", newInput);
    return result;
  }
}
