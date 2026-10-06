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
import org.openmetadata.service.Entity;

/**
 * Query entities are not synced to a Git sink. A workflow is refused when it holds a Git sink and
 * its trigger lists {@code query} among its entity types, in {@code entityTypes} or in the
 * deprecated {@code entityType}. Triggers match their entity types exactly, with no wildcard, so
 * the listed types are the only ones a trigger delivers. A stored workflow that still lists {@code
 * query} is deployed without a trigger for it, see {@link #excludedTriggerEntityTypes}.
 */
public final class GitSinkEntityTypeRule {

  public static final String QUERY_IN_GIT_SINK_MESSAGE =
      "Query entities cannot be synced to a Git sink. Remove 'query' from the trigger's entity types.";

  private GitSinkEntityTypeRule() {}

  /** Whether the workflow writes with a Git sink and its trigger can deliver query entities. */
  public static boolean syncsQueriesToGit(WorkflowDefinition workflow) {
    return hasGitSink(workflow) && triggerEntityTypes(workflow.getTrigger()).contains(Entity.QUERY);
  }

  /**
   * Entity types the workflow's trigger is deployed without: {@code query} when the workflow writes
   * with a Git sink, none otherwise.
   */
  public static Set<String> excludedTriggerEntityTypes(WorkflowDefinition workflow) {
    return hasGitSink(workflow) ? Set.of(Entity.QUERY) : Set.of();
  }

  public static boolean hasGitSink(WorkflowDefinition workflow) {
    return listOrEmpty(workflow.getNodes()).stream().anyMatch(GitSinkEntityTypeRule::isGitSink);
  }

  private static boolean isGitSink(WorkflowNodeDefinitionInterface node) {
    // Nodes are held as WorkflowNodeDefinitionInterface; only the sink subtype carries a sink type.
    return node instanceof SinkTaskDefinition sinkTask
        && sinkTask.getConfig() != null
        && sinkTask.getConfig().getSinkType() != null
        && switch (sinkTask.getConfig().getSinkType()) {
          case GIT -> true;
          case WEBHOOK, HTTP_ENDPOINT -> false;
        };
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
