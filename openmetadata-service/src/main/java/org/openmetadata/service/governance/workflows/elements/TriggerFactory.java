package org.openmetadata.service.governance.workflows.elements;

import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.TriggerType;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.NoOpTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.SinkEntityTypeRule;
import org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger;
import org.openmetadata.service.governance.workflows.elements.triggers.NoOpTrigger;
import org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger;

@Slf4j
public class TriggerFactory {
  public static TriggerInterface createTrigger(WorkflowDefinition workflow) {
    String triggerWorkflowId = getTriggerWorkflowId(workflow.getFullyQualifiedName());
    Set<String> excludedEntityTypes = excludedEntityTypes(workflow);

    return switch (TriggerType.fromValue(workflow.getTrigger().getType())) {
      case EVENT_BASED_ENTITY -> new EventBasedEntityTrigger(
          workflow.getName(),
          triggerWorkflowId,
          (EventBasedEntityTriggerDefinition) workflow.getTrigger(),
          excludedEntityTypes);
      case NO_OP -> new NoOpTrigger(
          workflow.getName(), triggerWorkflowId, (NoOpTriggerDefinition) workflow.getTrigger());
      case PERIODIC_BATCH_ENTITY -> new PeriodicBatchEntityTrigger(
          workflow.getName(),
          triggerWorkflowId,
          (PeriodicBatchEntityTriggerDefinition) workflow.getTrigger(),
          hasBatchModeNodes(workflow),
          excludedEntityTypes);
    };
  }

  /** Excludes unsupported types from legacy definitions that predate a provider restriction. */
  private static Set<String> excludedEntityTypes(WorkflowDefinition workflow) {
    Set<String> unsupported = SinkEntityTypeRule.unsupportedTriggerEntityTypes(workflow);
    if (!unsupported.isEmpty()) {
      LOG.warn(
          "Workflow '{}' has sinks that cannot sync entity types {}; its trigger excludes them",
          workflow.getName(),
          unsupported);
    }
    return SinkEntityTypeRule.excludedTriggerEntityTypes(workflow);
  }

  /**
   * Whether the workflow runs its main process once per fetched batch of entities rather than once
   * per entity: a periodic-batch trigger whose workflow holds a batch sink.
   */
  public static boolean runsOncePerBatch(WorkflowDefinition workflow) {
    return workflow.getTrigger() != null
        && TriggerType.fromValue(workflow.getTrigger().getType())
            == TriggerType.PERIODIC_BATCH_ENTITY
        && hasBatchModeNodes(workflow);
  }

  /**
   * Check if the workflow contains any nodes with batchMode enabled. When batch mode is detected,
   * the trigger should create a single workflow execution per batch instead of N parallel
   * executions (one per entity).
   *
   * <p>Note: Per the schema, batchMode defaults to true when not explicitly set. This ensures Git
   * sinks use single execution mode by default, preventing race conditions from parallel commits.
   */
  private static boolean hasBatchModeNodes(WorkflowDefinition workflow) {
    return workflow.getNodes() != null
        && workflow.getNodes().stream().anyMatch(TriggerFactory::isBatchSink);
  }

  /** Whether a node is a sink with batchMode enabled; batchMode defaults to true when unset. */
  public static boolean isBatchSink(WorkflowNodeDefinitionInterface node) {
    boolean batchSink = false;
    if (node.getNodeSubType() == NodeSubType.SINK_TASK) {
      // Nodes are held as the WorkflowNodeDefinitionInterface; a sink node is usually the typed
      // SinkTaskDefinition, but a definition built from a raw map carries an untyped config.
      if (node instanceof SinkTaskDefinition sinkTask) {
        if (sinkTask.getConfig() != null) {
          // Schema default is true, so treat null as true
          Boolean batchMode = sinkTask.getConfig().getBatchMode();
          batchSink = batchMode == null || batchMode;
        }
      } else {
        // Fallback for Map-based config (e.g., from JSON deserialization)
        Object config = node.getConfig();
        if (config != null) {
          Map<String, Object> configMap = JsonUtils.getMap(config);
          Object batchMode = configMap.get("batchMode");
          // Schema default is true, so treat null/absent as true
          batchSink = batchMode == null || Boolean.TRUE.equals(batchMode);
        }
      }
    }
    return batchSink;
  }

  public static String getTriggerWorkflowId(String workflowFQN) {
    return String.format("%sTrigger", workflowFQN);
  }

  public static String getMainWorkflowDefinitionNameFromTrigger(
      String triggerWorkflowDefinitionName) {
    return triggerWorkflowDefinitionName.replaceFirst("Trigger$", "");
  }
}
