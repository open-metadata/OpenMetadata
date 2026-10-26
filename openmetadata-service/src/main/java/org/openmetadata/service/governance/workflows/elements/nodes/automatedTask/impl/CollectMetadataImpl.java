package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.REJECTED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.REJECTION_COMMENT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;

import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataCompletionRevision;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.governance.workflows.metadata.MetadataCollectionService;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

@Slf4j
public class CollectMetadataImpl implements JavaDelegate {
  private Expression configurationExpr;
  private Expression inputNamespaceMapExpr;
  private Expression workflowNameExpr;
  private Expression nodeNameExpr;

  /** The workflow and node a collect step runs in, which name the tasks it keeps. */
  private record Step(String workflow, String node) {}

  @Override
  public void execute(final DelegateExecution execution) {
    final var variables = new WorkflowVariableHandler(execution);
    try {
      collect(execution, variables);
    } catch (RuntimeException failure) {
      // Any failure collecting becomes the workflow's runtime error, so the stage's error boundary
      // handles it; collect() declares no checked exceptions.
      LOG.error("Metadata collection failed for {}", execution.getCurrentActivityId(), failure);
      variables.setGlobalVariable(EXCEPTION_VARIABLE, failure.toString());
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, failure.getMessage());
    }
  }

  private void collect(final DelegateExecution execution, final WorkflowVariableHandler variables) {
    final var namespaces = InputNamespaces.from(inputNamespaceMapExpr, execution);
    final var link =
        EntityLink.parse(
            (String)
                variables.getNamespacedVariable(
                    namespaces.namespaceFor(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));
    final var configuration =
        JsonUtils.readOrConvertValue(
            configurationExpr.getValue(execution), MetadataCollectionConfiguration.class);
    final var entity = variables.getRelatedEntity(link, "*", Include.NON_DELETED);
    final var repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    final var actor =
        Entity.getEntityReferenceByName(Entity.USER, "governance-bot", Include.NON_DELETED);
    final var service = new MetadataCollectionService(repository, actor);
    final var step =
        new Step(
            (String) workflowNameExpr.getValue(execution),
            (String) nodeNameExpr.getValue(execution));
    if (configuration.getRevision() == null) {
      service.reconcile(entity, configuration, step.workflow(), step.node());
    } else {
      revise(service, variables, entity, configuration, step);
    }
  }

  private static void revise(
      final MetadataCollectionService service,
      final WorkflowVariableHandler variables,
      final EntityInterface<?> entity,
      final MetadataCollectionConfiguration configuration,
      final Step step) {
    switch (configuration.getRevision()) {
      case REQUEST -> service.requestRevision(
          entity, configuration, step.workflow(), step.node(), rejectionOf(variables));
      case RESUBMIT -> service.resubmit(entity, configuration, step.workflow());
    }
  }

  // The resolve path records the rejection as global variables, and Flowable returns variables as
  // untyped Object, so each is pattern-matched as the String it was stored as. A rejection without
  // a comment leaves only who rejected.
  private static MetadataCompletionRevision rejectionOf(final WorkflowVariableHandler variables) {
    final MetadataCompletionRevision revision = new MetadataCompletionRevision();
    if (variables.getNamespacedVariable(GLOBAL_NAMESPACE, REJECTION_COMMENT_VARIABLE)
            instanceof String comment
        && !comment.isBlank()) {
      revision.setComment(comment);
    }
    if (variables.getNamespacedVariable(GLOBAL_NAMESPACE, REJECTED_BY_VARIABLE)
        instanceof String rejectedBy) {
      revision.setRequestedBy(rejectedBy);
    }
    return revision;
  }
}
