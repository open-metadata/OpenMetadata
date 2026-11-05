package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Set;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.repository.ProcessDefinitionQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.SinkProviderRegistry;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

/**
 * The trigger processes {@link WorkflowHandler#triggerWorkflow} starts for a Git-sink workflow, whose
 * trigger is deployed without query although an older deployment of it carried a query process.
 */
class WorkflowHandlerTriggerTest {

  private static final String WORKFLOW_NAME = "gitWorkflow";
  private static final String TABLE_TRIGGER_KEY = "gitWorkflowTrigger-table";
  private static final String QUERY_TRIGGER_KEY = "gitWorkflowTrigger-query";

  private static final String GIT_SINK_WORKFLOW =
      """
      {"name": "gitWorkflow", "fullyQualifiedName": "gitWorkflow",
       "trigger": {"type": "periodicBatchEntity",
                   "config": {"entityTypes": %s, "schedule": {"scheduleTimeline": "None"}, "filters": "{}"}},
       "nodes": [
         {"name": "start", "displayName": "start", "type": "startEvent", "subType": "startEvent"},
         {"name": "sink", "displayName": "sink", "type": "automatedTask", "subType": "sinkTask",
          "config": {"sinkType": "git", "sinkConfig": {"repositoryUrl": "https://github.com/o/r.git"}}},
         {"name": "end", "displayName": "end", "type": "endEvent", "subType": "endEvent"}
       ],
       "edges": [{"from": "start", "to": "sink"}, {"from": "sink", "to": "end"}]}""";

  private final RuntimeService runtimeService = mock(RuntimeService.class);
  private final RepositoryService repositoryService = mock(RepositoryService.class);
  private final WorkflowDefinitionRepository workflowRepository =
      mock(WorkflowDefinitionRepository.class);
  private WorkflowHandler workflowHandler;
  private MockedStatic<Entity> entity;

  private MockedStatic<SinkProviderRegistry> registryStatic;

  @BeforeEach
  void setUp() throws ReflectiveOperationException {
    SinkProviderRegistry registry = mock(SinkProviderRegistry.class);
    registryStatic = mockStatic(SinkProviderRegistry.class);
    registryStatic.when(SinkProviderRegistry::getInstance).thenReturn(registry);
    when(registry.excludedEntityTypes("git")).thenReturn(Set.of("query"));

    ProcessEngine processEngine = mock(ProcessEngine.class);
    when(processEngine.getRuntimeService()).thenReturn(runtimeService);
    when(processEngine.getRepositoryService()).thenReturn(repositoryService);
    workflowHandler = mock(WorkflowHandler.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
    Field processEngineField = WorkflowHandler.class.getDeclaredField("processEngine");
    processEngineField.setAccessible(true);
    processEngineField.set(workflowHandler, processEngine);
    deployTriggerProcesses(TABLE_TRIGGER_KEY, QUERY_TRIGGER_KEY);
    entity = mockStatic(Entity.class);
    entity
        .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
        .thenReturn(workflowRepository);
  }

  @AfterEach
  void tearDown() {
    registryStatic.close();
    entity.close();
  }

  @Test
  void failureToReadTheWorkflowStartsNoTriggerProcess() {
    IllegalStateException lookupFailure = new IllegalStateException("database unavailable");
    when(workflowRepository.getByName(
            isNull(), eq(WORKFLOW_NAME), any(), eq(Include.NON_DELETED), eq(true)))
        .thenThrow(lookupFailure);

    IllegalStateException thrown =
        assertThrows(
            IllegalStateException.class, () -> workflowHandler.triggerWorkflow(WORKFLOW_NAME));

    assertSame(lookupFailure, thrown);
    verify(runtimeService, never()).startProcessInstanceByKey(anyString(), anyString());
  }

  @Test
  void configuredTriggerSkipsTheProcessOfAnEntityTypeTheSinkCannotSync() {
    storedWorkflow("[\"table\", \"query\"]");

    assertTrue(workflowHandler.triggerWorkflow(WORKFLOW_NAME));

    verify(runtimeService).startProcessInstanceByKey(eq(TABLE_TRIGGER_KEY), anyString());
    verify(runtimeService, never()).startProcessInstanceByKey(eq(QUERY_TRIGGER_KEY), anyString());
  }

  @Test
  void deployedTriggerFallbackSkipsTheProcessOfAnEntityTypeTheSinkCannotSync() {
    storedWorkflow("[\"query\"]");

    assertTrue(workflowHandler.triggerWorkflow(WORKFLOW_NAME));

    verify(runtimeService).startProcessInstanceByKey(eq(TABLE_TRIGGER_KEY), anyString());
    verify(runtimeService, never()).startProcessInstanceByKey(eq(QUERY_TRIGGER_KEY), anyString());
  }

  private void storedWorkflow(String entityTypes) {
    WorkflowDefinition workflow =
        JsonUtils.readValue(GIT_SINK_WORKFLOW.formatted(entityTypes), WorkflowDefinition.class);
    when(workflowRepository.getByName(
            isNull(), eq(WORKFLOW_NAME), any(), eq(Include.NON_DELETED), eq(true)))
        .thenReturn(workflow);
  }

  /** Every query answers with the latest versions of the given trigger process keys. */
  private void deployTriggerProcesses(String... processKeys) {
    List<ProcessDefinition> definitions =
        List.of(processKeys).stream().map(WorkflowHandlerTriggerTest::definition).toList();
    when(repositoryService.createProcessDefinitionQuery())
        .thenAnswer(
            invocation -> {
              ProcessDefinitionQuery query = mock(ProcessDefinitionQuery.class, RETURNS_SELF);
              when(query.list()).thenReturn(definitions);
              when(query.singleResult()).thenReturn(definitions.getFirst());
              return query;
            });
  }

  private static ProcessDefinition definition(String processKey) {
    ProcessDefinition definition = mock(ProcessDefinition.class);
    when(definition.getKey()).thenReturn(processKey);
    return definition;
  }
}
