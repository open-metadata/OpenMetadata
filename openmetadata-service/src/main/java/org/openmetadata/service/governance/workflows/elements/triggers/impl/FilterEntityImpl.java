package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger.PASSES_FILTER_VARIABLE;

import java.util.List;
import java.util.Optional;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.resources.feeds.MessageParser;

public class FilterEntityImpl implements JavaDelegate {
  private Expression excludedFilterExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    List<String> excludedFilter =
        JsonUtils.readOrConvertValue(excludedFilterExpr.getValue(execution), List.class);

    String entityLinkStr =
        (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE);

    execution.setVariable(
        PASSES_FILTER_VARIABLE, passesExcludedFilter(entityLinkStr, excludedFilter));
  }

  private boolean passesExcludedFilter(String entityLinkStr, List<String> excludedFilter) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);
    Optional<ChangeDescription> oChangeDescription =
        Optional.ofNullable(entity.getChangeDescription());

    // ChangeDescription is empty means it is a Create event.
    if (oChangeDescription.isEmpty()) {
      return true;
    }
    ChangeDescription changeDescription = oChangeDescription.get();

    List<FieldChange> changedFields = changeDescription.getFieldsAdded();
    changedFields.addAll(changeDescription.getFieldsDeleted());
    changedFields.addAll(changeDescription.getFieldsUpdated());
    return changedFields.isEmpty()
        || changedFields.stream()
            .anyMatch(changedField -> !excludedFilter.contains(changedField.getName()));
  }
}
