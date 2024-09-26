package org.openmetadata.service.governance.workflows.elements.processes.automated.impl;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.governanceWorkflows.elements.processes.automated.Update;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

import java.util.List;

public class UpdateEntityImpl implements JavaDelegate {
  private Expression updatesExpr;
  @Override
  public void execute(DelegateExecution execution) {
    // TODO: Implement behaviour
    // String entityType = (String) execution.getVariable("entityType");
    EntityReference entityReference = JsonUtils.readOrConvertValue(execution.getVariable("relatedEntity"), EntityReference.class);
    List<Update> updates = JsonUtils.readOrConvertValue(updatesExpr.getValue(execution), List.class);

    Entity.getEntity(entityReference, "*", Include.NON_DELETED);
  }
}
