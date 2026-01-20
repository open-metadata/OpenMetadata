package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger.PASSES_FILTER_VARIABLE;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.WorkflowTriggerFields;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
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
    List<String> excludedFilter = null;
    if (excludedFieldsExpr != null && excludedFieldsExpr.getValue(execution) != null) {
      excludedFilter =
          JsonUtils.readOrConvertValue(excludedFieldsExpr.getValue(execution), List.class);
    }

    String entityLinkStr =
        (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE);

    // Parse entity type from entity link to determine which filter to use
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    String entityType = entityLink.getEntityType();

    // Extract entity-specific filter
    String filterLogic =
        extractEntitySpecificFilter(
            filterExpr != null ? filterExpr.getValue(execution) : null, entityType);

    boolean passesFilter = passesExcludedFilter(entityLinkStr, excludedFilter, filterLogic);

    if (passesFilter) {
      String triggerWorkflowDefinitionKey =
          WorkflowHandler.getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
      String mainWorkflowDefinitionName =
          TriggerFactory.getMainWorkflowDefinitionNameFromTrigger(triggerWorkflowDefinitionKey);
      String currentProcessInstanceId = execution.getProcessInstanceId();
      WorkflowHandler.getInstance()
          .terminateDuplicateInstances(
              mainWorkflowDefinitionName, entityLinkStr, currentProcessInstanceId);
    }

    String workflowKey =
        WorkflowHandler.getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    log.debug("Trigger {} - Entity {} passes filter: {}", workflowKey, entityLinkStr, passesFilter);
    execution.setVariable(PASSES_FILTER_VARIABLE, passesFilter);
  }

  private String extractEntitySpecificFilter(Object filterObj, String entityType) {
    if (filterObj == null || entityType == null) {
      return null;
    }

    // Parse JSON string into map if needed
    if (filterObj instanceof String) {
      String filterStr = (String) filterObj;
      // Handle empty string as "no filter"
      if (filterStr.trim().isEmpty()) {
        return null; // Empty string means no filtering
      }
      // Check if it's a JSON object string
      if (filterStr.trim().startsWith("{") && filterStr.trim().endsWith("}")) {
        try {
          java.util.Map<String, String> filterMap =
              JsonUtils.readValue(filterStr, java.util.Map.class);
          return extractFromFilterMap(filterMap, entityType);
        } catch (Exception e) {
          log.error(
              "Invalid filter format. Expected JSON object with entity-specific filters: {}",
              filterStr);
          return null;
        }
      }
      log.warn("Plain string filters are no longer supported. Use entity-specific filter object.");
      return null;
    }

    // Handle map format with entity-specific filters
    if (filterObj instanceof java.util.Map) {
      @SuppressWarnings("unchecked")
      java.util.Map<String, String> filterMap = (java.util.Map<String, String>) filterObj;
      return extractFromFilterMap(filterMap, entityType);
    }

    log.error("Unexpected filter object type: {}", filterObj.getClass().getName());
    return null;
  }

  private String extractFromFilterMap(java.util.Map<String, String> filterMap, String entityType) {
    if (filterMap == null || entityType == null) {
      return null;
    }

    // First check for entity-specific filter
    String specificFilter = filterMap.get(entityType);
    if (specificFilter != null && !specificFilter.trim().isEmpty()) {
      return specificFilter;
    }

    // Fall back to default filter if no specific filter found
    String defaultFilter = filterMap.get("default");
    if (defaultFilter != null && !defaultFilter.trim().isEmpty()) {
      return defaultFilter;
    }

    return null;
  }

  private boolean passesExcludedFilter(
      String entityLinkStr, List<String> excludedFilter, String filterLogic) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

    boolean fieldBasedFilter;
    Optional<ChangeDescription> oChangeDescription =
        Optional.ofNullable(entity.getChangeDescription());

    // ChangeDescription is empty means it is a Create event.
    if (oChangeDescription.isEmpty()) {
      fieldBasedFilter = true;
    } else {
      ChangeDescription changeDescription = oChangeDescription.get();
      List<FieldChange> changedFields = getAllChangedFields(changeDescription);

      // Check if ANY field is trigger-worthy AND not excluded
      fieldBasedFilter =
          changedFields.isEmpty()
              || changedFields.stream()
                  .anyMatch(
                      field -> {
                        String fieldName = field.getName();
                        boolean isTriggerField =
                            Arrays.stream(WorkflowTriggerFields.values())
                                .map(WorkflowTriggerFields::value)
                                .anyMatch(fieldName::equals);
                        boolean isNotExcluded =
                            excludedFilter == null || !excludedFilter.contains(fieldName);
                        return isTriggerField && isNotExcluded;
                      });
    }

    // Apply JSON filter
    boolean passesJsonFilter = true;
    if (filterLogic != null && !filterLogic.trim().isEmpty()) {
      passesJsonFilter =
          !Boolean.TRUE.equals(
              RuleEngine.getInstance().apply(filterLogic, JsonUtils.getMap(entity)));
    }

    return fieldBasedFilter && passesJsonFilter;
  }

  private List<FieldChange> getAllChangedFields(ChangeDescription changeDescription) {
    List<FieldChange> allChanges = new ArrayList<>(changeDescription.getFieldsAdded());
    allChanges.addAll(changeDescription.getFieldsDeleted());
    allChanges.addAll(changeDescription.getFieldsUpdated());
    return allChanges;
  }
}
