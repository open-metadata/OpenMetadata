package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchSortFilter;

public class TriggerBatchEntityWorkflowImpl implements JavaDelegate {
  private Expression entityTypeExpr;
  private Expression searchFilterExpr;
  private Expression workflowNameExpr;
  private Expression batchSizeExpr;

  @Override
  public void execute(DelegateExecution execution) {
    String entityType = (String) entityTypeExpr.getValue(execution);
    String searchFilter =
        Optional.ofNullable(searchFilterExpr)
            .map(expr -> (String) expr.getValue(execution))
            .orElse(null);
    String workflowName = (String) workflowNameExpr.getValue(execution);
    int batchSize = Integer.parseInt((String) batchSizeExpr.getValue(execution));

    WorkflowHandler workflowHandler = WorkflowHandler.getInstance();

    triggerBatchEntityWorkflow(
        workflowHandler,
        entityType,
        execution.getProcessInstanceBusinessKey(),
        searchFilter,
        workflowName,
        batchSize);
  }

  private void triggerBatchEntityWorkflow(
      WorkflowHandler workflowHandler,
      String entityType,
      String businessKey,
      String searchFilter,
      String workflowName,
      int batchSize) {
    SearchRepository searchRepository = Entity.getSearchRepository();
    SearchSortFilter searchSortFilter =
        new SearchSortFilter("fullyQualifiedName", null, null, null);
    Object[] searchAfter = null;
    boolean isDone = false;

    while (!isDone) {
      try {
        SearchClient.SearchResultListMapper response =
            searchRepository.listWithDeepPagination(
                entityType, null, searchFilter, searchSortFilter, batchSize, searchAfter);

        List<Map<String, Object>> results = response.getResults();
        searchAfter = response.getLastHitSortValues();

        triggerWorkflow(
            results.stream().map(result -> (String) result.get("fullyQualifiedName")).toList(),
            entityType,
            workflowName,
            businessKey,
            workflowHandler);

        if (Optional.ofNullable(searchAfter).isEmpty()) {
          isDone = true;
        }

      } catch (IOException e) {
        throw new RuntimeException(e);
      }
    }
  }

  private void triggerWorkflow(
      List<String> entityFQNs,
      String entityType,
      String workflowName,
      String businessKey,
      WorkflowHandler workflowHandler) {
    List<String> runningProcessInstanceIds = new ArrayList<>();

    for (String entityFQN : entityFQNs) {
      MessageParser.EntityLink entityLink = new MessageParser.EntityLink(entityType, entityFQN);

      Map<String, Object> variables = new HashMap<>();
      variables.put("relatedEntity", entityLink.getLinkString());

      runningProcessInstanceIds.add(
          workflowHandler.triggerByKey(workflowName, businessKey, variables).getId());
    }

    // TODO: Improve Waiting
    while (!runningProcessInstanceIds.isEmpty()) {
      runningProcessInstanceIds =
          getRunningProcessInstances(runningProcessInstanceIds, workflowHandler);
      try {
        Thread.sleep(1000);
      } catch (InterruptedException e) {
        throw new RuntimeException(e);
      }
    }
  }

  private List<String> getRunningProcessInstances(
      List<String> processInstanceIds, WorkflowHandler workflowHandler) {
    return processInstanceIds.stream()
        .filter(
            (processInstanceId) -> !workflowHandler.hasProcessInstanceFinished(processInstanceId))
        .toList();
  }
}
