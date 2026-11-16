package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;

class SubWorkflowFailureListenerTest {

  private final SubWorkflowFailureListener listener = new SubWorkflowFailureListener();

  @Test
  void mappedSubWorkflowFailureMarksTheTriggerFailed() {
    DelegateExecution execution = mock(DelegateExecution.class);
    when(execution.getVariable(SubWorkflowFailureListener.SUB_WORKFLOW_FAILURE_VARIABLE))
        .thenReturn(true);

    listener.execute(execution);

    verify(execution).setVariable(Workflow.FAILURE_VARIABLE, true);
  }

  @Test
  void successfulSubWorkflowLeavesAnEarlierFailureInPlace() {
    DelegateExecution execution = mock(DelegateExecution.class);
    when(execution.getVariable(SubWorkflowFailureListener.SUB_WORKFLOW_FAILURE_VARIABLE))
        .thenReturn(null);

    listener.execute(execution);

    verify(execution, never()).setVariable(eq(Workflow.FAILURE_VARIABLE), any());
  }

  @Test
  void outParameterReadsTheCalledWorkflowGlobalFailure() {
    IOParameter parameter = SubWorkflowFailureListener.outParameter();

    assertEquals("global_failure", parameter.getSource());
    assertEquals(SubWorkflowFailureListener.SUB_WORKFLOW_FAILURE_VARIABLE, parameter.getTarget());
  }

  @Test
  void triggerInstanceEndsAsFailureWhenTheFailureVariableIsSet() {
    UUID instanceId = UUID.randomUUID();
    DelegateExecution execution = mock(DelegateExecution.class);
    when(execution.getEventName()).thenReturn("end");
    when(execution.getProcessDefinitionId()).thenReturn("GitSinkTrigger-table:3:abc");
    when(execution.getProcessInstanceId()).thenReturn("pi-1");
    when(execution.getProcessInstanceBusinessKey()).thenReturn(instanceId.toString());
    Map<String, Object> variables = new HashMap<>();
    variables.put(Workflow.FAILURE_VARIABLE, true);
    variables.put(SubWorkflowFailureListener.SUB_WORKFLOW_FAILURE_VARIABLE, null);
    when(execution.getVariables()).thenReturn(variables);
    WorkflowInstanceRepository repository = mock(WorkflowInstanceRepository.class);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityTimeSeriesRepository(anyString()))
          .thenAnswer(invocation -> repository);

      new WorkflowInstanceListener().execute(execution);
    }

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> stored = ArgumentCaptor.forClass(Map.class);
    verify(repository).recordProcessEnd(eq(instanceId), anyLong(), stored.capture());
    assertEquals(WorkflowInstance.WorkflowStatus.FAILURE.value(), stored.getValue().get("status"));
  }
}
