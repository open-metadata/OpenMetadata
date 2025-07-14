package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import java.util.*;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.util.EntityUtil;

@ExtendWith(MockitoExtension.class)
class WorkflowInstanceStageListenerTest {

  @Mock WorkflowInstanceRepository workflowInstanceRepository;
  @Mock WorkflowInstanceStateRepository workflowInstanceStateRepository;
  @Mock WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock DelegateExecution execution;
  @Mock DelegateExecution parentExecution;

  WorkflowInstanceStageListener listener;
  WorkflowDefinition workflowDefinition;
  WorkflowConfiguration config;
  UUID workflowInstanceId;
  UUID executionId;
  MockedStatic<Entity> entityStaticMock;

  @BeforeEach
  void setUp() {
    listener = new WorkflowInstanceStageListener();
    workflowInstanceId = UUID.randomUUID();
    executionId = UUID.randomUUID();
    config =
        new WorkflowConfiguration()
            .withStoreStageStatus(false)
            .withMaxStagesPerInstance(2)
            .withOptimisticLockMaxRetries(2);
    workflowDefinition = new WorkflowDefinition().withConfig(config).withId(UUID.randomUUID());

    // Use lenient() to avoid unnecessary stubbing errors
    lenient()
        .when(execution.getProcessInstanceBusinessKey())
        .thenReturn(workflowInstanceId.toString());
    lenient()
        .when(execution.getVariable(Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE))
        .thenReturn(executionId);
    lenient().when(execution.getProcessDefinitionId()).thenReturn("procDefId");
    lenient().when(execution.getEventName()).thenReturn("start");
    lenient().when(execution.getCurrentActivityId()).thenReturn("stage1");
    lenient()
        .when(execution.getVariables())
        .thenReturn(new HashMap<>()); // Always provide variables map
    // Mock execution.getParent() and its getCurrentActivityId()
    lenient().when(execution.getParent()).thenReturn(parentExecution);
    lenient().when(parentExecution.getCurrentActivityId()).thenReturn("stage1");

    entityStaticMock = mockStatic(Entity.class);
    entityStaticMock
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE))
        .thenReturn(workflowInstanceRepository);
    entityStaticMock
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE))
        .thenReturn(workflowInstanceStateRepository);
    entityStaticMock
        .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
        .thenReturn(workflowDefinitionRepository);
    lenient()
        .when(
            workflowDefinitionRepository.getByName(
                any(), anyString(), any(EntityUtil.Fields.class)))
        .thenReturn(workflowDefinition);
  }

  @AfterEach
  void tearDown() {
    entityStaticMock.close();
  }

  /**
   * Test that execute() in embedded mode adds a stage and enforces the cap.
   */
  @Test
  void testExecute_AddStage_EmbeddedMode_EnforcesCap() {
    WorkflowInstance instance =
        new WorkflowInstance().withId(workflowInstanceId).withStages(new LinkedList<>());
    instance
        .getStages()
        .add(new WorkflowInstanceState().withWorkflowInstanceExecutionId(UUID.randomUUID()));
    instance
        .getStages()
        .add(new WorkflowInstanceState().withWorkflowInstanceExecutionId(UUID.randomUUID()));
    instance.setVersion(0);
    when(workflowInstanceRepository.getById(workflowInstanceId)).thenReturn(instance);
    when(workflowInstanceRepository.updateIfVersionMatches(any(), anyInt())).thenReturn(true);
    listener.execute(execution);
    assertEquals(2, instance.getStages().size());
  }

  /**
   * Test that execute() in state table mode calls the state repository.
   */
  @Test
  void testExecute_AddStage_StateTableMode() {
    config.setStoreStageStatus(true);
    when(execution.getEventName()).thenReturn("start");
    listener.execute(execution);
    verify(workflowInstanceStateRepository, atLeastOnce())
        .addNewStageToInstance(anyString(), any(), any(), anyString(), anyLong());
  }

  /**
   * Test that execute() with event 'end' updates the stage in embedded mode.
   */
  @Test
  void testExecute_UpdateStage_EmbeddedMode() {
    when(execution.getEventName()).thenReturn("end");
    when(execution.getVariables()).thenReturn(new HashMap<>());
    // Ensure WorkflowInstanceState has a non-null Stage object
    WorkflowInstanceState state =
        new WorkflowInstanceState()
            .withWorkflowInstanceExecutionId(executionId)
            .withStage(new org.openmetadata.schema.governance.workflows.Stage().withName("stage1"));
    WorkflowInstance instance =
        new WorkflowInstance()
            .withId(workflowInstanceId)
            .withStages(new LinkedList<>(Arrays.asList(state)));
    instance.setVersion(0);
    when(workflowInstanceRepository.getById(workflowInstanceId)).thenReturn(instance);
    when(workflowInstanceRepository.updateIfVersionMatches(any(), anyInt())).thenReturn(true);
    listener.execute(execution);
    assertEquals(WorkflowInstance.WorkflowStatus.FINISHED, state.getStatus());
  }

  /**
   * Test that execute() with event 'end' in state table mode calls the state repository update.
   */
  @Test
  void testExecute_UpdateStage_StateTableMode() {
    config.setStoreStageStatus(true);
    when(execution.getEventName()).thenReturn("end");
    // Provide a UUID for the stage state variable
    when(execution.getVariable(anyString())).thenReturn(UUID.randomUUID());
    when(execution.getVariables()).thenReturn(new HashMap<>());
    // Ensure parent is mocked for this test as well
    when(execution.getParent()).thenReturn(parentExecution);
    when(parentExecution.getCurrentActivityId()).thenReturn("stage1");
    listener.execute(execution);
    verify(workflowInstanceStateRepository, atLeastOnce()).updateStage(any(), anyLong(), anyMap());
  }

  /**
   * Test that execute() handles optimistic lock failure by throwing an exception.
   */
  @Test
  void testExecute_OptimisticLockFailure_Throws() {
    // Attach in-memory appender to the logger used by the class under test
    Logger logger = (Logger) org.slf4j.LoggerFactory.getLogger(WorkflowInstanceStageListener.class);
    InMemoryLogAppender appender = new InMemoryLogAppender();
    appender.setContext(logger.getLoggerContext());
    logger.addAppender(appender);
    appender.start();

    when(execution.getEventName()).thenReturn("start");
    WorkflowInstance instance =
        new WorkflowInstance().withId(workflowInstanceId).withStages(new LinkedList<>());
    instance.setVersion(0);
    when(workflowInstanceRepository.getById(workflowInstanceId)).thenAnswer(invocation -> instance);
    when(workflowInstanceRepository.updateIfVersionMatches(any(), anyInt())).thenReturn(false);
    config.setStoreStageStatus(false);
    config.setOptimisticLockMaxRetries(3);
    when(workflowDefinitionRepository.getByName(any(), anyString(), any(EntityUtil.Fields.class)))
        .thenReturn(workflowDefinition);

    listener.execute(execution);

    // Assert that the error log was produced
    boolean found =
        appender.getErrorMessages().stream()
            .anyMatch(
                msg ->
                    msg.contains(
                        "Failed to update workflow instance after retries (optimistic locking)"));
    assertTrue(found, "Expected error log for optimistic locking failure");

    // Clean up
    logger.detachAppender(appender);
  }

  /**
   * Test that execute() with an unknown event does not throw.
   */
  @Test
  void testExecute_UnknownEvent_DoesNotThrow() {
    when(execution.getEventName()).thenReturn("unknown");
    assertDoesNotThrow(() -> listener.execute(execution));
  }

  // Minimal in-memory log appender for capturing error logs in tests
  @Getter
  public static class InMemoryLogAppender extends AppenderBase<ILoggingEvent> {
    private final List<ILoggingEvent> events = new ArrayList<>();

    @Override
    protected void append(ILoggingEvent eventObject) {
      events.add(eventObject);
    }

    public List<String> getErrorMessages() {
      List<String> errors = new ArrayList<>();
      for (ILoggingEvent event : events) {
        if (event.getLevel().isGreaterOrEqual(ch.qos.logback.classic.Level.ERROR)) {
          errors.add(event.getFormattedMessage());
        }
      }
      return errors;
    }
  }
}
