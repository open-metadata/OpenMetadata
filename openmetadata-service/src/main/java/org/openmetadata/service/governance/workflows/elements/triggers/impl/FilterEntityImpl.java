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
import org.openmetadata.service.rules.RuleEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class FilterEntityImpl implements JavaDelegate {
  private static final Logger log = LoggerFactory.getLogger(FilterEntityImpl.class);
  private Expression excludedFieldsExpr;
  private Expression filterExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    List<String> excludedFilter =
        JsonUtils.readOrConvertValue(excludedFieldsExpr.getValue(execution), List.class);
    String filterLogic = null;
    if (filterExpr != null) {
      filterLogic = (String) filterExpr.getValue(execution);
    }
    String entityLinkStr =
        (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE);
    boolean passesFilter = passesExcludedFilter(entityLinkStr, excludedFilter, filterLogic);
    log.debug("Trigger Glossary Term Approval Workflow: {}", passesFilter);
    execution.setVariable(PASSES_FILTER_VARIABLE, passesFilter);
  }

  private boolean passesExcludedFilter(
      String entityLinkStr, List<String> excludedFilter, String filterLogic) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

    boolean excludeFieldFilter;
    Optional<ChangeDescription> oChangeDescription =
        Optional.ofNullable(entity.getChangeDescription());

    // ChangeDescription is empty means it is a Create event.
    if (oChangeDescription.isEmpty()) {
      excludeFieldFilter = true;
    } else {
      ChangeDescription changeDescription = oChangeDescription.get();

      List<FieldChange> changedFields = changeDescription.getFieldsAdded();
      changedFields.addAll(changeDescription.getFieldsDeleted());
      changedFields.addAll(changeDescription.getFieldsUpdated());
      excludeFieldFilter =
          changedFields.isEmpty()
              || changedFields.stream()
                  .anyMatch(changedField -> !excludedFilter.contains(changedField.getName()));
    }

    // If excludeFields are there in change description, then don't even trigger workflow or
    // evaluate jsonLogic, so return false to not trigger workflow
    if (!excludeFieldFilter) return false;
    // If excludeFields are not there in change description, then evaluate jsonLogic, if jsonLogic
    // evaluates to true, then don't trigger the workflow, send false
    boolean jsonFilter;
    if (filterLogic != null && !filterLogic.trim().isEmpty()) {
      jsonFilter =
          (Boolean.TRUE.equals(
              RuleEngine.getInstance().apply(filterLogic, JsonUtils.getMap(entity))));
    } else {
      jsonFilter = false; // No filter means pass
    }

    return !jsonFilter;
  }
}
