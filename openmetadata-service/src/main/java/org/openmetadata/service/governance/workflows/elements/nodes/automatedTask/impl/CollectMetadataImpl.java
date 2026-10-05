package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;

import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.governance.workflows.metadata.MetadataCollectionService;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

@Slf4j
public class CollectMetadataImpl implements JavaDelegate {
  private Expression configurationExpr;
  private Expression inputNamespaceMapExpr;
  private Expression taskKeyExpr;

  @Override
  public void execute(final DelegateExecution execution) {
    final var variables = new WorkflowVariableHandler(execution);
    try {
      collect(execution, variables);
    } catch (Exception failure) {
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
    new MetadataCollectionService(repository, WorkflowHandler.getInstance(), actor)
        .reconcile(entity, configuration, (String) taskKeyExpr.getValue(execution));
  }
}
