package org.openmetadata.service.governance.workflows.elements.processes.automated.impl;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

public class UpdateEntityImpl implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    // TODO: Implement behaviour
    // String entityType = (String) execution.getVariable("entityType");
    EntityReference entityReference = (EntityReference) execution.getVariable("relatedEntity");
    String updates = (String) execution.getVariableLocal("updates");

    Entity.getEntity(entityReference, "*", Include.NON_DELETED);
  }
}
