package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowInstanceListener;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.JsonUtils;

public class TriggerEntityWorkflowImpl implements JavaDelegate {
  private Expression workflowNameExpr;
  private Expression excludedFilterExpr;

  @Override
  public void execute(DelegateExecution execution) {
    String workflowName = (String) workflowNameExpr.getValue(execution);
    List<String> excludedFilter =
        JsonUtils.readOrConvertValue(excludedFilterExpr.getValue(execution), List.class);

    String entityLinkStr = (String) execution.getVariable("relatedEntity");

    if (passesExcludedFilter(entityLinkStr, excludedFilter)) {
      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      triggerWorkflow(
          workflowHandler, execution.getProcessInstanceBusinessKey(), entityLinkStr, workflowName);
    } else {
      execution.setEventName("end");
      new WorkflowInstanceListener().execute(execution);
    }
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

  private void triggerWorkflow(
      WorkflowHandler workflowHandler,
      String businessKey,
      String entityLinkStr,
      String workflowName) {
    Map<String, Object> variables = new HashMap<>();
    variables.put("relatedEntity", entityLinkStr);
    workflowHandler.triggerByKey(workflowName, businessKey, variables);
  }
}
