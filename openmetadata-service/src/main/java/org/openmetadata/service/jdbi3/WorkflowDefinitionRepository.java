package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Queue;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.governance.WorkflowDefinitionResource;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class WorkflowDefinitionRepository extends EntityRepository<WorkflowDefinition> {

  private static final String USER_APPROVAL_TASK = "userApprovalTask";

  public WorkflowDefinitionRepository() {
    super(
        WorkflowDefinitionResource.COLLECTION_PATH,
        Entity.WORKFLOW_DEFINITION,
        WorkflowDefinition.class,
        Entity.getCollectionDAO().workflowDefinitionDAO(),
        "",
        "");
  }

  @Override
  public List<WorkflowDefinition> getEntitiesFromSeedData() {
    return getEntitiesFromSeedData(".*json/data/governance/workflows/.*\\.json$");
  }

  @Override
  protected void postCreate(WorkflowDefinition entity) {
    WorkflowHandler.getInstance().deploy(new Workflow(entity));
  }

  @Override
  public void postUpdate(WorkflowDefinition original, WorkflowDefinition updated) {
    WorkflowHandler.getInstance().deploy(new Workflow(updated));
  }

  @Override
  protected void postDelete(WorkflowDefinition entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    WorkflowHandler.getInstance().deleteWorkflowDefinition(entity);
  }

  @Override
  protected void setFields(WorkflowDefinition entity, EntityUtil.Fields fields) {
    if (WorkflowHandler.isInitialized()) {
      entity.withDeployed(WorkflowHandler.getInstance().isDeployed(entity));
    } else {
      LOG.debug("Can't get `deploy` status since WorkflowHandler is not initialized.");
    }
  }

  @Override
  protected void clearFields(WorkflowDefinition entity, EntityUtil.Fields fields) {}

  @Override
  protected void prepare(WorkflowDefinition entity, boolean update) {
    // Validate workflow configuration - single entry point for all validations
    LOG.info("Validating workflow configuration for: {}", entity.getName());
    validateWorkflow(entity);
  }

  @Override
  public EntityRepository<WorkflowDefinition>.EntityUpdater getUpdater(
      WorkflowDefinition original,
      WorkflowDefinition updated,
      Operation operation,
      ChangeSource changeSource) {
    return new WorkflowDefinitionRepository.WorkflowDefinitionUpdater(original, updated, operation);
  }

  public class WorkflowDefinitionUpdater extends EntityUpdater {
    public WorkflowDefinitionUpdater(
        WorkflowDefinition original, WorkflowDefinition updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateTrigger();
      updateConfig();
      updateNodes();
      updateEdges();
    }

    private void updateTrigger() {
      if (original.getTrigger() == updated.getTrigger()) {
        return;
      }
      recordChange("trigger", original.getTrigger(), updated.getTrigger());
    }

    private void updateConfig() {
      if (Objects.equals(original.getConfig(), updated.getConfig())) {
        return;
      }
      recordChange("config", original.getConfig(), updated.getConfig());
    }

    private void updateNodes() {
      List<WorkflowNodeDefinitionInterface> addedNodes = new ArrayList<>();
      List<WorkflowNodeDefinitionInterface> deletedNodes = new ArrayList<>();
      recordListChange(
          "nodes",
          original.getNodes(),
          updated.getNodes(),
          addedNodes,
          deletedNodes,
          WorkflowNodeDefinitionInterface::equals);
    }

    private void updateEdges() {
      List<EdgeDefinition> addedEdges = new ArrayList<>();
      List<EdgeDefinition> deletedEdges = new ArrayList<>();
      recordListChange(
          "nodes",
          original.getEdges(),
          updated.getEdges(),
          addedEdges,
          deletedEdges,
          EdgeDefinition::equals);
    }
  }

  @Override
  protected void storeEntity(WorkflowDefinition entity, boolean update) {
    store(entity, update);
  }

  @Override
  protected void storeRelationships(WorkflowDefinition entity) {}

  public UUID getIdFromName(String workflowDefinitionName) {
    EntityReference workflowDefinitionReference =
        getByName(null, workflowDefinitionName, new EntityUtil.Fields(Set.of("*")))
            .getEntityReference();
    return workflowDefinitionReference.getId();
  }

  /**
   * Efficiently retrieves WorkflowDefinition with minimal fields for stage processing.
   * This returns the full object so callers can extract both ID and stage displayName without additional DB calls.
   */
  public WorkflowDefinition getByNameForStageProcessing(String workflowDefinitionName) {
    return getByName(null, workflowDefinitionName, EntityUtil.Fields.EMPTY_FIELDS);
  }

  /**
   * Main validation entry point - executes all validations in order.
   * This follows the command pattern where each validation is executed sequentially.
   * Any validation failure will throw BadRequestException and stop further validations.
   *
   * @param workflowDefinition The workflow to validate
   * @throws BadRequestException if any validation fails
   */
  public void validateWorkflow(WorkflowDefinition workflowDefinition) {
    // Execute validations in order of importance
    // 1. Basic structural validations
    validateNodeIds(workflowDefinition);
    // 2. Comprehensive graph structure validations (cycles, connectivity, edges, start/end nodes)
    validateWorkflowGraphStructure(workflowDefinition);
    // 3. Business rule validations
    validateUserTasksForReviewerSupport(workflowDefinition);
    // 4. Namespace configuration validations
    validateUpdatedByNamespace(workflowDefinition);
    // 5. Node input/output validations
    validateNodeInputOutputMapping(workflowDefinition);
    // 6. Conditional task validations
    validateConditionalTasks(workflowDefinition);
  }

  /**
   * Comprehensive workflow graph structure validation.
   * Performs all graph validations in a single traversal for efficiency:
   * 1. Exactly one start node (if nodes exist)
   * 2. No cycles in the graph
   * 3. No orphaned nodes (all nodes are reachable from start)
   * 4. All edges reference valid nodes
   * 5. Non-end nodes must have outgoing edges
   * 6. End nodes must not have outgoing edges
   */
  private void validateWorkflowGraphStructure(WorkflowDefinition workflowDefinition) {
    // Skip validation if no nodes are present - allow empty workflows
    if (workflowDefinition.getNodes() == null || workflowDefinition.getNodes().isEmpty()) {
      return;
    }

    if (workflowDefinition.getEdges() == null) {
      workflowDefinition.setEdges(new ArrayList<>());
    }

    String workflowName = workflowDefinition.getName();

    // Build node sets and maps for validation
    Set<String> allNodeIds = new java.util.HashSet<>();
    Set<String> startNodes = new java.util.HashSet<>();
    Set<String> endNodes = new java.util.HashSet<>();
    Map<String, WorkflowNodeDefinitionInterface> nodeMap = new java.util.HashMap<>();

    // Collect all nodes and identify start/end nodes
    for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
      String nodeId = node.getName();
      allNodeIds.add(nodeId);
      nodeMap.put(nodeId, node);

      if ("startEvent".equals(node.getSubType())) {
        startNodes.add(nodeId);
      }
      if ("endEvent".equals(node.getSubType())) {
        endNodes.add(nodeId);
      }
    }

    // Validation 1: Exactly one start node
    if (startNodes.isEmpty()) {
      throw BadRequestException.of(
          String.format("Workflow '%s' must have exactly one start event node", workflowName));
    }
    if (startNodes.size() > 1) {
      throw BadRequestException.of(
          String.format(
              "Workflow '%s' must have exactly one start event node, found %d: %s",
              workflowName, startNodes.size(), startNodes));
    }

    // Build adjacency lists
    Map<String, List<String>> outgoingEdges = new java.util.HashMap<>();
    Map<String, List<String>> incomingEdges = new java.util.HashMap<>();

    // Initialize empty lists for all nodes
    for (String nodeId : allNodeIds) {
      outgoingEdges.put(nodeId, new ArrayList<>());
      incomingEdges.put(nodeId, new ArrayList<>());
    }

    // Validation 4: All edges must reference valid nodes
    for (EdgeDefinition edge : workflowDefinition.getEdges()) {
      String from = edge.getFrom();
      String to = edge.getTo();

      if (!allNodeIds.contains(from)) {
        throw BadRequestException.of(
            String.format(
                "Workflow '%s' has edge from non-existent node: '%s'", workflowName, from));
      }
      if (!allNodeIds.contains(to)) {
        throw BadRequestException.of(
            String.format("Workflow '%s' has edge to non-existent node: '%s'", workflowName, to));
      }

      outgoingEdges.get(from).add(to);
      incomingEdges.get(to).add(from);
    }

    // Validation 5 & 6: End nodes validation and non-end nodes must have outgoing edges
    for (String nodeId : allNodeIds) {
      WorkflowNodeDefinitionInterface node = nodeMap.get(nodeId);
      boolean hasOutgoing = !outgoingEdges.get(nodeId).isEmpty();
      boolean isEndNode = "endEvent".equals(node.getSubType());

      if (isEndNode && hasOutgoing) {
        throw BadRequestException.of(
            String.format(
                "Workflow '%s': End node '%s' cannot have outgoing edges",
                workflowName, node.getNodeDisplayName()));
      }

      // Non-end nodes must have outgoing edges
      if (!isEndNode && !hasOutgoing) {
        throw BadRequestException.of(
            String.format(
                "Workflow '%s': Node '%s' requires outgoing edges",
                workflowName, node.getNodeDisplayName()));
      }
    }

    // Validation 2 & 3: Cycle detection and orphaned nodes check using DFS
    String startNode = startNodes.iterator().next();
    Set<String> visited = new java.util.HashSet<>();
    Set<String> recursionStack = new java.util.HashSet<>();

    // Check for cycles and collect reachable nodes
    if (hasCycleDFS(startNode, outgoingEdges, visited, recursionStack)) {
      throw BadRequestException.of(
          String.format("Workflow '%s' contains a cycle in its execution path", workflowName));
    }

    // Validation 3: Check for orphaned nodes (nodes not reachable from start)
    Set<String> orphanedNodes = new java.util.HashSet<>(allNodeIds);
    orphanedNodes.removeAll(visited);

    if (!orphanedNodes.isEmpty()) {
      throw BadRequestException.of(
          String.format(
              "Workflow '%s' has orphaned nodes not reachable from start: %s",
              workflowName, orphanedNodes));
    }
  }

  /**
   * Depth-First Search to detect cycles in directed graph.
   * Returns true if a cycle is detected.
   *
   * @param node Current node being visited
   * @param adjacencyList Graph representation
   * @param visited Set of completely processed nodes (black nodes)
   * @param recursionStack Set of nodes currently in the DFS path (gray nodes)
   */
  private boolean hasCycleDFS(
      String node,
      Map<String, List<String>> adjacencyList,
      Set<String> visited,
      Set<String> recursionStack) {

    // If node is in current recursion path, we've found a cycle
    if (recursionStack.contains(node)) {
      return true;
    }

    // If node is already completely processed, skip it
    if (visited.contains(node)) {
      return false;
    }

    // Mark node as being processed (gray)
    visited.add(node);
    recursionStack.add(node);

    // Recursively visit all neighbors
    List<String> neighbors = adjacencyList.get(node);
    if (neighbors != null) {
      for (String neighbor : neighbors) {
        if (hasCycleDFS(neighbor, adjacencyList, visited, recursionStack)) {
          return true;
        }
      }
    }

    // Mark node as completely processed (black) by removing from recursion stack
    recursionStack.remove(node);
    return false;
  }

  public void suspendWorkflow(WorkflowDefinition workflow) {
    String workflowName = workflow.getName();

    try {
      // Suspend all active process instances for this workflow
      WorkflowHandler.getInstance().suspendWorkflow(workflowName);

      workflow.setSuspended(true);
      dao.update(workflow);
      LOG.info("Suspended workflow '{}' in Flowable engine", workflowName);
    } catch (IllegalArgumentException e) {
      // Workflow not deployed to Flowable - this can happen for workflows that haven't been
      // triggered yet
      LOG.warn(
          "Workflow '{}' is not deployed to Flowable engine: {}", workflowName, e.getMessage());
      throw BadRequestException.of(
          "Workflow '"
              + workflowName
              + "' is not deployed to the workflow engine. "
              + "Please ensure the workflow has been triggered at least once before attempting to suspend it.");
    }
  }

  public void resumeWorkflow(WorkflowDefinition workflow) {
    String workflowName = workflow.getName();

    try {
      // Resume all suspended process instances for this workflow
      WorkflowHandler.getInstance().resumeWorkflow(workflowName);

      workflow.setSuspended(false);
      dao.update(workflow);

      // Log the resumption
      LOG.info("Resumed workflow '{}' in Flowable engine", workflowName);
    } catch (IllegalArgumentException e) {
      // Workflow not deployed to Flowable - this can happen for workflows that haven't been
      // triggered yet
      LOG.warn(
          "Workflow '{}' is not deployed to Flowable engine: {}", workflowName, e.getMessage());
      throw BadRequestException.of(
          "Workflow '"
              + workflowName
              + "' is not deployed to the workflow engine. "
              + "Please ensure the workflow has been triggered at least once before attempting to resume it.");
    }
  }

  /**
   * Validates that node IDs are unique and don't clash with workflow name.
   */
  private void validateNodeIds(WorkflowDefinition workflowDefinition) {
    if (workflowDefinition.getNodes() == null) {
      return;
    }

    Set<String> nodeIds = new java.util.HashSet<>();
    String workflowName = workflowDefinition.getName();

    for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
      String nodeId = node.getName();

      // Check for duplicate node IDs
      if (!nodeIds.add(nodeId)) {
        throw BadRequestException.of(
            String.format("Workflow '%s' has duplicate node ID: '%s'", workflowName, nodeId));
      }

      // Check if node ID clashes with workflow name
      if (nodeId.equals(workflowName)) {
        throw BadRequestException.of(
            String.format(
                "Workflow '%s' has a node with ID '%s' that clashes with the workflow name",
                workflowName, nodeId));
      }
    }

    // Validate that all edges reference existing nodes
    if (workflowDefinition.getEdges() != null) {
      for (EdgeDefinition edge : workflowDefinition.getEdges()) {
        if (!nodeIds.contains(edge.getFrom())) {
          throw BadRequestException.of(
              String.format(
                  "Workflow '%s' has an edge from non-existent node: '%s'",
                  workflowName, edge.getFrom()));
        }
        if (!nodeIds.contains(edge.getTo())) {
          throw BadRequestException.of(
              String.format(
                  "Workflow '%s' has an edge to non-existent node: '%s'",
                  workflowName, edge.getTo()));
        }
      }
    }
  }

  /**
   * Validates user tasks are only used with entities that support reviewers.
   */
  private void validateUserTasksForReviewerSupport(WorkflowDefinition workflowDefinition) {
    // Check if workflow has any user approval or change review tasks
    boolean hasUserApprovalTasks = false;
    List<String> userTaskTypes = List.of(USER_APPROVAL_TASK);

    if (workflowDefinition.getNodes() != null) {
      for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
        if (userTaskTypes.contains(node.getSubType())) {
          hasUserApprovalTasks = true;
          break;
        }
      }
    }

    // If workflow has user approval tasks, validate entity types support reviewers
    if (hasUserApprovalTasks) {
      List<String> entityTypes = getEntityTypesFromWorkflow(workflowDefinition);
      if (!entityTypes.isEmpty()) {
        validateEntityTypesSupportsReviewers(entityTypes, workflowDefinition.getName());
      }
    }
  }

  /**
   * Validates updatedBy namespace configuration.
   */
  private void validateUpdatedByNamespace(WorkflowDefinition workflowDefinition) {
    if (workflowDefinition.getNodes() == null || workflowDefinition.getEdges() == null) {
      return;
    }

    // Build node map
    Map<String, WorkflowNodeDefinitionInterface> nodeMap = new java.util.HashMap<>();
    for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
      nodeMap.put(node.getName(), node);
    }

    // Build adjacency list for reverse traversal
    Map<String, List<String>> reverseAdjacency = new java.util.HashMap<>();
    for (EdgeDefinition edge : workflowDefinition.getEdges()) {
      reverseAdjacency.computeIfAbsent(edge.getTo(), k -> new ArrayList<>()).add(edge.getFrom());
    }

    // Check each node that uses updatedBy
    for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
      Object inputNamespaceMapObj = node.getInputNamespaceMap();
      if (inputNamespaceMapObj != null && inputNamespaceMapObj instanceof Map) {
        @SuppressWarnings("unchecked")
        Map<String, String> inputNamespaceMap = (Map<String, String>) inputNamespaceMapObj;

        if (inputNamespaceMap.containsKey("updatedBy")) {
          String namespace = inputNamespaceMap.get("updatedBy");
          boolean hasUserTaskBefore = hasUserTaskInPath(node.getName(), reverseAdjacency, nodeMap);

          if (!hasUserTaskBefore && !"global".equals(namespace)) {
            throw BadRequestException.of(
                String.format(
                    "Workflow '%s' node '%s' uses updatedBy with namespace '%s' but has no user task in its path. Should use 'global' namespace.",
                    workflowDefinition.getName(), node.getName(), namespace));
          }

          if (hasUserTaskBefore && "global".equals(namespace)) {
            LOG.warn(
                "Workflow '{}' node '{}' has user task before it but uses 'global' namespace for updatedBy",
                workflowDefinition.getName(),
                node.getName());
          }
        }
      }
    }
  }

  /**
   * Performs BFS traversal backwards from a node to check if there's any user task in its execution path.
   * This is used to validate the updatedBy namespace - if a user task exists before a node,
   * the updatedBy should come from that task, not from global namespace.
   *
   * @param nodeId The node to start backward traversal from
   * @param reverseAdjacency Reverse adjacency list (edges pointing backwards)
   * @param nodeMap Map of node names to node definitions
   * @return true if there's a user task in the path leading to this node
   */
  private boolean hasUserTaskInPath(
      String nodeId,
      Map<String, List<String>> reverseAdjacency,
      Map<String, WorkflowNodeDefinitionInterface> nodeMap) {
    Set<String> visited = new java.util.HashSet<>();
    Queue<String> queue = new java.util.LinkedList<>();
    queue.add(nodeId);

    List<String> userTaskTypes = List.of(USER_APPROVAL_TASK);

    // BFS traversal backwards through the workflow
    while (!queue.isEmpty()) {
      String current = queue.poll();
      if (visited.contains(current)) {
        continue;
      }
      visited.add(current);

      // Check all predecessors of current node
      List<String> predecessors = reverseAdjacency.get(current);
      if (predecessors != null) {
        for (String pred : predecessors) {
          WorkflowNodeDefinitionInterface predNode = nodeMap.get(pred);
          // If predecessor is a user task, we found one in the path
          if (predNode != null && userTaskTypes.contains(predNode.getSubType())) {
            return true;
          }
          queue.add(pred);
        }
      }
    }
    return false;
  }

  /**
   * Validates node input/output mappings.
   * Ensures that nodes properly reference variables from global scope or from reachable upstream nodes.
   */
  private void validateNodeInputOutputMapping(WorkflowDefinition workflowDefinition) {
    if (workflowDefinition.getNodes() == null || workflowDefinition.getNodes().isEmpty()) {
      return;
    }

    // Build node map and reachability information
    Map<String, WorkflowNodeDefinitionInterface> nodeMap = new java.util.HashMap<>();
    Map<String, List<String>> adjacencyList = new java.util.HashMap<>();

    for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
      nodeMap.put(node.getName(), node);
    }

    if (workflowDefinition.getEdges() != null) {
      for (EdgeDefinition edge : workflowDefinition.getEdges()) {
        adjacencyList.computeIfAbsent(edge.getFrom(), k -> new ArrayList<>()).add(edge.getTo());
      }
    }

    Set<String> globalVariables = workflowDefinition.getTrigger().getOutput();
    boolean isNoOpTrigger = "noOp".equals(workflowDefinition.getTrigger().getType());

    // Validate each node's input namespace mapping
    for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(node.getInputNamespaceMap(), Map.class);

      if (inputNamespaceMap == null) {
        continue;
      }

      for (Map.Entry<String, String> entry : inputNamespaceMap.entrySet()) {
        String variable = entry.getKey();
        String namespace = entry.getValue();

        if (Workflow.GLOBAL_NAMESPACE.equals(namespace)) {
          // Validate global variable exists (unless noOp trigger)
          if (!isNoOpTrigger && !globalVariables.contains(variable)) {
            throw BadRequestException.of(
                String.format(
                    "Invalid Workflow: Node '%s' expects '%s' to be a global variable, but it is not present in trigger outputs",
                    node.getName(), variable));
          }
        } else {
          // Validate the referenced node exists and is reachable
          WorkflowNodeDefinitionInterface sourceNode = nodeMap.get(namespace);
          if (sourceNode == null) {
            throw BadRequestException.of(
                String.format(
                    "Invalid Workflow: Node '%s' references non-existent node '%s'",
                    node.getName(), namespace));
          }

          // Check if the source node outputs the expected variable
          if (sourceNode.getOutput() != null && !sourceNode.getOutput().contains(variable)) {
            throw BadRequestException.of(
                String.format(
                    "Invalid Workflow: Node '%s' expects '%s' from node '%s', but it does not output this variable",
                    node.getName(), variable, namespace));
          }

          // Validate node is reachable
          if (!isNodeReachable(namespace, node.getName(), adjacencyList)) {
            throw BadRequestException.of(
                String.format(
                    "Invalid Workflow: Node '%s' expects input from '%s', but no path exists between them",
                    node.getName(), namespace));
          }
        }
      }
    }
  }

  /**
   * Checks if targetNode is reachable from sourceNode in the workflow graph.
   */
  private boolean isNodeReachable(
      String sourceNode, String targetNode, Map<String, List<String>> adjacencyList) {
    if (sourceNode.equals(targetNode)) {
      return false; // Self-reference is not allowed
    }

    Set<String> visited = new java.util.HashSet<>();
    Queue<String> queue = new java.util.LinkedList<>();
    queue.add(sourceNode);

    while (!queue.isEmpty()) {
      String current = queue.poll();
      if (visited.contains(current)) {
        continue;
      }
      visited.add(current);

      List<String> neighbors = adjacencyList.get(current);
      if (neighbors != null) {
        for (String neighbor : neighbors) {
          if (neighbor.equals(targetNode)) {
            return true;
          }
          queue.add(neighbor);
        }
      }
    }
    return false;
  }

  /**
   * Extracts entity types from workflow trigger configuration.
   * Migration has already converted single entityType to entityTypes array.
   */
  private List<String> getEntityTypesFromWorkflow(WorkflowDefinition workflowDefinition) {
    List<String> entityTypes = new ArrayList<>();

    if (workflowDefinition.getTrigger() != null
        && workflowDefinition.getTrigger().getConfig() != null) {

      // Convert config to Map for field access
      Map<String, Object> configMap = JsonUtils.getMap(workflowDefinition.getTrigger().getConfig());

      // Check for multiple entityTypes (both eventBasedEntity and periodicBatchEntity triggers)
      @SuppressWarnings("unchecked")
      List<String> multipleEntityTypes = (List<String>) configMap.get("entityTypes");
      if (multipleEntityTypes != null) {
        entityTypes.addAll(multipleEntityTypes);
      }
    }

    return entityTypes;
  }

  /**
   * Validates that the entity types support reviewers.
   */
  private void validateEntityTypesSupportsReviewers(List<String> entityTypes, String workflowName) {
    for (String entityType : entityTypes) {
      try {
        // Get the repository for the entity type to check if it supports reviewers
        EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
        boolean supportsReviewers = entityRepository.isSupportsReviewers();

        LOG.debug("Entity type '{}' supports reviewers: {}", entityType, supportsReviewers);

        if (!supportsReviewers) {
          String errorMsg =
              String.format(
                  "Workflow '%s' contains user approval tasks but entity type '%s' does not support reviewers. "
                      + "User approval tasks can only be used with entities that have reviewer support.",
                  workflowName, entityType);
          LOG.error(errorMsg);
          throw BadRequestException.of(errorMsg);
        }

        LOG.debug(
            "Workflow '{}' validated: Entity type '{}' supports reviewers for user approval tasks",
            workflowName,
            entityType);
      } catch (BadRequestException e) {
        LOG.error("Validation failed: {}", e.getMessage());
        throw e; // Re-throw validation exceptions
      } catch (Exception e) {
        // If we can't determine the entity type repository, log a warning but allow the workflow
        LOG.warn(
            "Could not verify reviewer support for entity type '{}' in workflow '{}': {}",
            entityType,
            workflowName,
            e.getMessage());
      }
    }
  }

  private void validateConditionalTasks(WorkflowDefinition workflowDefinition) {
    if (workflowDefinition.getNodes() == null || workflowDefinition.getEdges() == null) {
      return;
    }

    String workflowName = workflowDefinition.getName();

    // Build outgoing edges map for each node
    Map<String, List<EdgeDefinition>> outgoingEdgesMap = new java.util.HashMap<>();
    for (EdgeDefinition edge : workflowDefinition.getEdges()) {
      outgoingEdgesMap.computeIfAbsent(edge.getFrom(), k -> new ArrayList<>()).add(edge);
    }

    // Check each conditional task node
    for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
      if (isConditionalTask(node)) {
        List<EdgeDefinition> outgoingEdges = outgoingEdgesMap.get(node.getName());

        if (outgoingEdges == null || outgoingEdges.isEmpty()) {
          throw BadRequestException.of(
              String.format(
                  "Workflow '%s': Conditional task '%s' must have outgoing sequence flows for both TRUE and FALSE conditions",
                  workflowName, node.getNodeDisplayName()));
        }

        // Check if we have both TRUE and FALSE conditions
        boolean hasTrueCondition = false;
        boolean hasFalseCondition = false;

        for (EdgeDefinition edge : outgoingEdges) {
          String condition = edge.getCondition();
          if (condition != null) {
            if ("true".equals(condition.trim())) {
              hasTrueCondition = true;
            } else if ("false".equals(condition.trim())) {
              hasFalseCondition = true;
            }
          }
        }

        if (!hasTrueCondition || !hasFalseCondition) {
          throw BadRequestException.of(
              String.format(
                  "Workflow '%s': Conditional task '%s' must have both TRUE and FALSE outgoing sequence flows. "
                      + "Add sequence flows with conditions for both outcomes to prevent workflow execution errors.",
                  workflowName, node.getNodeDisplayName()));
        }
      }
    }
  }

  /**
   * Checks if a node is a conditional task that requires TRUE/FALSE outputs.
   */
  private boolean isConditionalTask(WorkflowNodeDefinitionInterface node) {
    String nodeType = node.getSubType();
    return "checkEntityAttributesTask".equals(nodeType) || "userApprovalTask".equals(nodeType);
  }
}
