package org.openmetadata.service.governance.workflows.elements.processes.automated.impl;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

import java.util.List;

public class CheckEntityAttributesImpl implements JavaDelegate {
  private Expression conditionsExpr;

  @Override
  public void execute(DelegateExecution execution) {
    // TODO: Implement behaviour
    // String entityType = (String) execution.getVariable("entityType");
    EntityReference entityReference = JsonUtils.readOrConvertValue(execution.getVariable("relatedEntity"), EntityReference.class);
    List<String> conditions = JsonUtils.readOrConvertValue(conditionsExpr.getValue(execution), List.class);

    EntityInterface entity = Entity.getEntity(entityReference, "*", Include.NON_DELETED);

    // ConditionEvaluator
    // execution.setVariable("checkPassed", true);
    // execution.setVariable("checkPassed", false);
    execution.setVariable("checkPassed", true);
  }
}
