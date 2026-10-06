package org.openmetadata.service.governance.workflows;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.flowable.bpmn.model.ServiceTask;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;

/**
 * How the nodes of a workflow treat the entities of a batch.
 *
 * <p>A workflow that {@link TriggerFactory#runsOncePerBatch runs once per batch} starts its main
 * process once for every batch the trigger fetches. The process carries the batch's entity links in
 * {@code global_entityList}, while {@code global_relatedEntity} names only the first of them. Its
 * conditions therefore evaluate every entity of the list and narrow it to the entities that take
 * the branch the workflow continues on, and its actions apply to every entity of the list, so the
 * batch sink at the end writes exactly the entities that passed every condition.
 *
 * <p>This holds for a single path of nodes, where every branch but the continuing one ends at an
 * end event. {@link #violations()} lists the nodes and edges that break it. A definition with
 * violations is rejected when written; one already stored is deployed with every node reading
 * {@code relatedEntity} alone.
 */
public final class BatchExecutionPlan {
  /** Field holding {@code true} on a node that evaluates or acts on the whole batch. */
  public static final String BATCH_EXECUTION_FIELD = "batchExecutionExpr";

  /** Field holding the outcome a batch condition continues on, when it continues on one. */
  public static final String CONTINUING_OUTCOME_FIELD = "batchContinuingOutcomeExpr";

  private static final Set<NodeSubType> BATCH_NODES =
      EnumSet.of(
          NodeSubType.CHECK_ENTITY_ATTRIBUTES_TASK,
          NodeSubType.CHECK_CHANGE_DESCRIPTION_TASK,
          NodeSubType.SET_ENTITY_ATTRIBUTE_TASK,
          NodeSubType.SET_ENTITY_CERTIFICATION_TASK,
          NodeSubType.SET_GLOSSARY_TERM_STATUS_TASK,
          NodeSubType.ROLLBACK_ENTITY_TASK);

  private static final Set<NodeSubType> SUPPORTED_NODES =
      EnumSet.of(
          NodeSubType.START_EVENT,
          NodeSubType.END_EVENT,
          NodeSubType.PARALLEL_GATEWAY,
          NodeSubType.SINK_TASK,
          NodeSubType.CHECK_ENTITY_ATTRIBUTES_TASK,
          NodeSubType.CHECK_CHANGE_DESCRIPTION_TASK,
          NodeSubType.SET_ENTITY_ATTRIBUTE_TASK,
          NodeSubType.SET_ENTITY_CERTIFICATION_TASK,
          NodeSubType.SET_GLOSSARY_TERM_STATUS_TASK,
          NodeSubType.ROLLBACK_ENTITY_TASK);

  private static final Map<NodeSubType, String> UNSUPPORTED_REASONS = unsupportedReasons();

  private static final String DEFAULT_UNSUPPORTED_REASON = "does not handle a batch of entities";

  private static final String VIOLATION_MESSAGE =
      """
      Workflow '%s' writes its entities with a batch sink, so it runs once per batch of entities \
      and every node has to handle the whole batch: %s. Change these nodes, or set batchMode to \
      false on the sink to run the workflow once per entity.""";

  private final String workflowName;
  private final boolean runsOncePerBatch;
  private final List<String> violations;
  private final Map<String, NodeMode> nodeModes;

  private BatchExecutionPlan(
      String workflowName,
      boolean runsOncePerBatch,
      List<String> violations,
      Map<String, NodeMode> nodeModes) {
    this.workflowName = workflowName;
    this.runsOncePerBatch = runsOncePerBatch;
    this.violations = List.copyOf(violations);
    this.nodeModes = Map.copyOf(nodeModes);
  }

  public static BatchExecutionPlan of(WorkflowDefinition workflow) {
    boolean oncePerBatch = TriggerFactory.runsOncePerBatch(workflow);
    WorkflowGraph graph = oncePerBatch ? WorkflowGraph.of(workflow) : WorkflowGraph.EMPTY;
    List<String> violations = graph.violations();
    Map<String, NodeMode> nodeModes = violations.isEmpty() ? graph.batchNodeModes() : Map.of();
    return new BatchExecutionPlan(workflow.getName(), oncePerBatch, violations, nodeModes);
  }

  public boolean runsOncePerBatch() {
    return runsOncePerBatch;
  }

  /** Whether the nodes of the workflow evaluate and act on every entity of a batch. */
  public boolean isActive() {
    return runsOncePerBatch && violations.isEmpty();
  }

  public List<String> violations() {
    return violations;
  }

  public String violationMessage() {
    return VIOLATION_MESSAGE.formatted(workflowName, String.join("; ", violations));
  }

  public NodeMode modeFor(String nodeName) {
    return nodeModes.getOrDefault(nodeName, NodeMode.PER_ENTITY);
  }

  /**
   * How one node runs. {@code continuingOutcome} is the result value of the one edge that leaves a
   * batch condition for a node other than an end event; it is null when that edge is unconditional
   * or when every edge of the node ends.
   */
  public record NodeMode(boolean batch, String continuingOutcome) {
    public static final NodeMode PER_ENTITY = new NodeMode(false, null);

    /** Adds the batch fields to the node's service task; a per-entity node is left as it was. */
    public void addTo(ServiceTask serviceTask) {
      if (batch) {
        serviceTask
            .getFieldExtensions()
            .add(
                new FieldExtensionBuilder()
                    .fieldName(BATCH_EXECUTION_FIELD)
                    .fieldValue(String.valueOf(true))
                    .build());
      }
      if (batch && continuingOutcome != null) {
        serviceTask
            .getFieldExtensions()
            .add(
                new FieldExtensionBuilder()
                    .fieldName(CONTINUING_OUTCOME_FIELD)
                    .fieldValue(continuingOutcome)
                    .build());
      }
    }
  }

  private static Map<NodeSubType, String> unsupportedReasons() {
    Map<NodeSubType, String> reasons = new EnumMap<>(NodeSubType.class);
    reasons.put(NodeSubType.USER_APPROVAL_TASK, "waits for a person to decide on one entity");
    reasons.put(
        NodeSubType.CREATE_RECOGNIZER_FEEDBACK_APPROVAL_TASK,
        "waits for a person to review one recognizer feedback");
    reasons.put(
        NodeSubType.APPLY_RECOGNIZER_FEEDBACK_TASK,
        "acts on a recognizer feedback, which a batch of entities does not carry");
    reasons.put(
        NodeSubType.REJECT_RECOGNIZER_FEEDBACK_TASK,
        "acts on a recognizer feedback, which a batch of entities does not carry");
    reasons.put(NodeSubType.RUN_APP_TASK, "starts and waits for an app run for one entity");
    reasons.put(
        NodeSubType.CREATE_AND_RUN_INGESTION_PIPELINE_TASK,
        "creates and waits for an ingestion pipeline run for one entity");
    reasons.put(
        NodeSubType.CREATE_AND_RUN_AI_AUTOMATION_TASK,
        "creates and waits for an AI automation run for one entity");
    reasons.put(NodeSubType.POLICY_AGENT_TASK, "waits for a policy agent decision on one entity");
    reasons.put(
        NodeSubType.DATA_COMPLETENESS_TASK,
        "routes each entity to one of several quality bands, while a batch continues on one branch");
    return reasons;
  }

  /** The nodes and edges of a definition, indexed for the batch checks. */
  private record WorkflowGraph(
      List<WorkflowNodeDefinitionInterface> nodes,
      Map<String, NodeSubType> subTypes,
      Map<String, List<EdgeDefinition>> outgoing,
      Map<String, Integer> incomingCounts) {
    private static final WorkflowGraph EMPTY =
        new WorkflowGraph(List.of(), Map.of(), Map.of(), Map.of());

    static WorkflowGraph of(WorkflowDefinition workflow) {
      List<WorkflowNodeDefinitionInterface> nodes = listOrEmpty(workflow.getNodes());
      Map<String, NodeSubType> subTypes = new HashMap<>();
      nodes.forEach(node -> subTypes.put(node.getName(), NodeSubType.fromValue(node.getSubType())));
      Map<String, List<EdgeDefinition>> outgoing = new HashMap<>();
      Map<String, Integer> incomingCounts = new HashMap<>();
      for (EdgeDefinition edge : listOrEmpty(workflow.getEdges())) {
        outgoing.computeIfAbsent(edge.getFrom(), from -> new ArrayList<>()).add(edge);
        incomingCounts.merge(edge.getTo(), 1, Integer::sum);
      }
      return new WorkflowGraph(nodes, subTypes, outgoing, incomingCounts);
    }

    List<String> violations() {
      List<String> violations = new ArrayList<>();
      nodes.forEach(node -> addViolations(node, violations));
      return violations;
    }

    Map<String, NodeMode> batchNodeModes() {
      Map<String, NodeMode> modes = new HashMap<>();
      for (WorkflowNodeDefinitionInterface node : nodes) {
        if (BATCH_NODES.contains(subTypes.get(node.getName()))) {
          modes.put(node.getName(), new NodeMode(true, continuingOutcome(node.getName())));
        }
      }
      return modes;
    }

    private void addViolations(WorkflowNodeDefinitionInterface node, List<String> violations) {
      String name = node.getName();
      NodeSubType subType = subTypes.get(name);
      if (!SUPPORTED_NODES.contains(subType)) {
        violations.add(
            "node '%s' (%s) %s"
                .formatted(
                    name,
                    subType.value(),
                    UNSUPPORTED_REASONS.getOrDefault(subType, DEFAULT_UNSUPPORTED_REASON)));
      }
      if (subType == NodeSubType.SINK_TASK && !TriggerFactory.isBatchSink(node)) {
        violations.add(
            "sink '%s' has batchMode set to false and would write only the first entity of each batch"
                .formatted(name));
      }
      int incoming = incomingCounts.getOrDefault(name, 0);
      if (subType != NodeSubType.END_EVENT && incoming > 1) {
        violations.add(
            "node '%s' is reached by %d edges, while the branches of a batch cannot merge"
                .formatted(name, incoming));
      }
      List<String> continuingTargets =
          continuingEdges(name).stream().map(EdgeDefinition::getTo).toList();
      if (continuingTargets.size() > 1) {
        violations.add(
            """
            node '%s' continues to %s, while a batch continues on one branch and every other \
            branch has to go straight to an end event"""
                .formatted(name, continuingTargets));
      }
    }

    private List<EdgeDefinition> continuingEdges(String nodeName) {
      return outgoing.getOrDefault(nodeName, List.of()).stream()
          .filter(edge -> subTypes.get(edge.getTo()) != NodeSubType.END_EVENT)
          .toList();
    }

    private String continuingOutcome(String nodeName) {
      List<EdgeDefinition> continuing = continuingEdges(nodeName);
      String outcome = null;
      if (continuing.size() == 1 && !nullOrEmpty(continuing.getFirst().getCondition())) {
        outcome = continuing.getFirst().getCondition().trim();
      }
      return outcome;
    }
  }
}
