package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;

class FetchEntitiesImplTest {

  private static final int TOTAL_ENTITIES = 12_000;

  @Test
  void cappedFetchSizeStillCoversEveryEntityAcrossIterations() throws Exception {
    ServiceTask fetchTask = fetchTaskOf(singleExecutionTrigger(20_000));
    String batchSize = fieldValue(fetchTask, "batchSizeExpr");
    List<String> fqns =
        IntStream.range(0, TOTAL_ENTITIES).mapToObj("svc.db.sch.t%04d"::formatted).toList();
    Map<String, Object> variables = new HashMap<>();
    DelegateExecution execution = executionBackedBy(variables);
    FetchEntitiesImpl fetch = fetchWithBatchSize(batchSize);
    SearchRepository search = pagedSearch(fqns);

    List<Integer> iterationSizes = new ArrayList<>();
    Set<String> fetched = new LinkedHashSet<>();
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(search);
      boolean finished = false;
      while (!finished) {
        fetch.execute(execution);
        @SuppressWarnings("unchecked")
        List<String> batch = (List<String>) variables.get("entityList");
        fetched.addAll(batch);
        finished = (Boolean) variables.get("hasFinished");
        if (!finished) {
          iterationSizes.add(batch.size());
        }
      }
    }

    assertTrue(fetchTask.isAsynchronousLeave(), "the cursor is committed after every fetch");
    assertEquals(List.of(5000, 5000, 2000), iterationSizes);
    assertEquals(TOTAL_ENTITIES, fetched.size(), "every entity is fetched exactly once");
  }

  @Test
  void aStopRequestEndsTheBatchLoopWithoutFetching() throws Exception {
    String workflowInstanceId = UUID.randomUUID().toString();
    Map<String, Object> variables = new HashMap<>();
    DelegateExecution execution = executionBackedBy(variables);
    when(execution.getProcessInstanceBusinessKey()).thenReturn(workflowInstanceId);
    FetchEntitiesImpl fetch = fetchWithBatchSize("100");
    List<String> checkedKeys = new ArrayList<>();
    fetch.isStopRequested =
        businessKey -> {
          checkedKeys.add(businessKey);
          return true;
        };
    SearchRepository search = pagedSearch(List.of("svc.db.sch.t1"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(search);
      fetch.execute(execution);
    }

    assertEquals(List.of(workflowInstanceId), checkedKeys);
    assertEquals(Boolean.TRUE, variables.get("hasFinished"));
    assertEquals(List.of(), variables.get("entityList"));
    assertEquals(0, variables.get("numberOfEntities"));
    verify(search, never())
        .listWithDeepPagination(any(), any(), any(), any(), any(), anyInt(), any());
  }

  private static SearchRepository pagedSearch(List<String> fqns) throws Exception {
    SearchRepository search = mock(SearchRepository.class);
    when(search.checkIfIndexingIsSupported("table")).thenReturn(true);
    when(search.listWithDeepPagination(eq("table"), any(), any(), any(), any(), anyInt(), any()))
        .thenAnswer(
            invocation -> {
              int size = invocation.getArgument(5);
              Object[] after = invocation.getArgument(6);
              int from = after == null ? 0 : fqns.indexOf((String) after[0]) + 1;
              List<Map<String, Object>> page =
                  fqns.subList(from, Math.min(from + size, fqns.size())).stream()
                      .map(fqn -> Map.<String, Object>of("fullyQualifiedName", fqn))
                      .toList();
              Object[] last =
                  page.isEmpty() ? null : new Object[] {page.getLast().get("fullyQualifiedName")};
              return new SearchResultListMapper(page, fqns.size(), last, last);
            });
    return search;
  }

  private static DelegateExecution executionBackedBy(Map<String, Object> variables) {
    DelegateExecution execution = mock(DelegateExecution.class);
    when(execution.getProcessDefinitionId()).thenReturn("GitSinkTrigger-table:1:abc");
    when(execution.getVariable(anyString()))
        .thenAnswer(invocation -> variables.get((String) invocation.getArgument(0)));
    doAnswer(
            invocation -> {
              variables.put(invocation.getArgument(0), invocation.getArgument(1));
              return null;
            })
        .when(execution)
        .setVariable(anyString(), any());
    return execution;
  }

  private static FetchEntitiesImpl fetchWithBatchSize(String batchSize) throws Exception {
    FetchEntitiesImpl fetch = new FetchEntitiesImpl();
    Expression entityTypes = mock(Expression.class);
    Expression size = mock(Expression.class);
    when(size.getValue(any())).thenReturn(batchSize);
    inject(fetch, "entityTypesExpr", entityTypes);
    inject(fetch, "batchSizeExpr", size);
    return fetch;
  }

  private static void inject(Object target, String name, Object value) throws Exception {
    Field field = FetchEntitiesImpl.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }

  private static PeriodicBatchEntityTrigger singleExecutionTrigger(int batchSize) {
    PeriodicBatchEntityTriggerDefinition definition =
        JsonUtils.readValue(
            """
            {
              "type": "periodicBatchEntity",
              "config": {
                "schedule": {"scheduleTimeline": "None"},
                "entityTypes": ["table"],
                "batchSize": %d
              },
              "output": ["relatedEntity"]
            }
            """
                .formatted(batchSize),
            PeriodicBatchEntityTriggerDefinition.class);
    return new PeriodicBatchEntityTrigger("GitSink", "GitSinkTrigger", definition, true);
  }

  private static ServiceTask fetchTaskOf(PeriodicBatchEntityTrigger trigger) {
    BpmnModel model = new BpmnModel();
    trigger.addToWorkflow(model);
    return model.getProcesses().getFirst().getFlowElements().stream()
        .filter(ServiceTask.class::isInstance)
        .map(ServiceTask.class::cast)
        .findFirst()
        .orElseThrow();
  }

  private static String fieldValue(ServiceTask task, String fieldName) {
    return task.getFieldExtensions().stream()
        .filter(field -> fieldName.equals(field.getFieldName()))
        .findFirst()
        .orElseThrow()
        .getStringValue();
  }
}
