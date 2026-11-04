package org.openmetadata.service.governance.workflows;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.WorkflowTriggerInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.SinkProviderRegistry;

/**
 * Provider-owned entity type restrictions shared by workflow validation and trigger deployment.
 * Capabilities are read from factories without constructing providers or resolving credentials.
 */
public final class SinkEntityTypeRule {

  private SinkEntityTypeRule() {}

  /** Configured trigger types that at least one sink in this workflow cannot sync. */
  public static Set<String> unsupportedTriggerEntityTypes(WorkflowDefinition workflow) {
    Set<String> unsupported = triggerEntityTypes(workflow.getTrigger());
    unsupported.retainAll(excludedTriggerEntityTypes(workflow));
    return Set.copyOf(unsupported);
  }

  /** Entity types excluded from deployed triggers, including legacy stored definitions. */
  public static Set<String> excludedTriggerEntityTypes(WorkflowDefinition workflow) {
    Set<String> excluded = new HashSet<>();
    for (WorkflowNodeDefinitionInterface node : listOrEmpty(workflow.getNodes())) {
      // The node interface has an untyped config; sink definitions carry the generated schema.
      if (node instanceof SinkTaskDefinition sink
          && sink.getConfig() != null
          && sink.getConfig().getSinkType() != null) {
        excluded.addAll(
            SinkProviderRegistry.getInstance()
                .excludedEntityTypes(sink.getConfig().getSinkType().value()));
      }
    }
    return Set.copyOf(excluded);
  }

  public static String rejectionMessage(Set<String> unsupportedEntityTypes) {
    return "The workflow's sinks cannot sync entity types %s. Remove them from the trigger's entity types."
        .formatted(unsupportedEntityTypes.stream().sorted().toList());
  }

  private static Set<String> triggerEntityTypes(WorkflowTriggerInterface trigger) {
    Set<String> entityTypes = new HashSet<>();
    // The trigger is held as WorkflowTriggerInterface, whose config is an untyped Object; the typed
    // entity types are read from the concrete trigger definition.
    if (trigger instanceof PeriodicBatchEntityTriggerDefinition periodic
        && periodic.getConfig() != null) {
      addEntityTypes(
          entityTypes, periodic.getConfig().getEntityTypes(), periodic.getConfig().getEntityType());
    }
    // Same untyped trigger interface; the event-based definition carries its own typed config.
    if (trigger instanceof EventBasedEntityTriggerDefinition eventBased
        && eventBased.getConfig() != null) {
      addEntityTypes(
          entityTypes,
          eventBased.getConfig().getEntityTypes(),
          eventBased.getConfig().getEntityType());
    }
    return entityTypes;
  }

  private static void addEntityTypes(
      Set<String> entityTypes, Set<String> configuredTypes, String deprecatedType) {
    entityTypes.addAll(Optional.ofNullable(configuredTypes).orElse(Set.of()));
    Optional.ofNullable(deprecatedType).ifPresent(entityTypes::add);
  }
}
