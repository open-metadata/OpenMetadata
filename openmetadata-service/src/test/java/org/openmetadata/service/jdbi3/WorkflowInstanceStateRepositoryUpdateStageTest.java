package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.Stage;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

/**
 * Unit tests for {@link WorkflowInstanceStateRepository#updateStage}. The method derives the
 * persisted {@link WorkflowInstance.WorkflowStatus} from specific keys in the variables map: the
 * canonical {@code failure} and {@code global_exception} keys, plus a defensive {@code status}
 * fallback so failure recorders that wrote {@code status=FAILED} (the historical contract) still
 * persist a failure. These tests lock in that contract so the cross-component mismatch that
 * silently persisted failures as FINISHED cannot return.
 */
class WorkflowInstanceStateRepositoryUpdateStageTest {

  private static final String STAGE_NAME = "approve";
  private final UUID stageId = UUID.randomUUID();
  private final CollectionDAO.WorkflowInstanceStateTimeSeriesDAO timeSeriesDao =
      mock(CollectionDAO.WorkflowInstanceStateTimeSeriesDAO.class);
  private final AtomicReference<String> storedJson = new AtomicReference<>();
  private MockedStatic<Entity> entity;
  private WorkflowInstanceStateRepository repository;

  @BeforeEach
  void setUp() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.workflowInstanceStateTimeSeriesDAO()).thenReturn(timeSeriesDao);
    entity = mockStatic(Entity.class);
    entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    store(WorkflowStatus.RUNNING);
    when(timeSeriesDao.getById(stageId)).thenAnswer(invocation -> storedJson.get());
    doAnswer(
            invocation -> {
              storedJson.set(invocation.getArgument(0));
              return null;
            })
        .when(timeSeriesDao)
        .update(anyString(), any(UUID.class));
    repository = new WorkflowInstanceStateRepository();
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void aStageEndWithoutAFailureVariableIsFinished() {
    repository.updateStage(stageId, 10L, variables(Map.of("result", "ok")));

    assertEquals(WorkflowStatus.FINISHED, storedState().getStatus());
  }

  @Test
  void theFailureVariableMarksTheStageAsFailure() {
    repository.updateStage(stageId, 10L, variables(Map.of(Workflow.FAILURE_VARIABLE, true)));

    assertEquals(WorkflowStatus.FAILURE, storedState().getStatus());
  }

  @Test
  void theGlobalExceptionMarksTheStageAsExceptionAndStoresTheMessage() {
    Map<String, Object> vars = new HashMap<>();
    vars.put(
        WorkflowVariableHandler.getNamespacedVariableName(
            Workflow.GLOBAL_NAMESPACE, Workflow.EXCEPTION_VARIABLE),
        "sink exploded");

    repository.updateStage(stageId, 10L, vars);

    WorkflowInstanceState state = storedState();
    assertEquals(WorkflowStatus.EXCEPTION, state.getStatus());
    assertEquals("sink exploded", state.getException());
  }

  @Test
  void aStatusOfFailedPersistsAsFailure() {
    // The exact map WorkflowInstanceStageListener's catch block used to send.
    Map<String, Object> failureData = new HashMap<>();
    failureData.put("status", "FAILED");
    failureData.put("error", "boom");
    failureData.put("errorClass", "RuntimeException");

    repository.updateStage(stageId, 10L, failureData);

    assertEquals(WorkflowStatus.FAILURE, storedState().getStatus());
  }

  @Test
  void aStatusOfFailedWithExceptionDetailsPersistsAsFailure() {
    // The exact map WorkflowFailureListener.addFailureStage used to send.
    Map<String, Object> stageData = new HashMap<>();
    stageData.put("status", "FAILED");
    stageData.put("failureType", "JOB_EXECUTION_FAILURE");
    stageData.put("processInstanceId", "process-instance");
    stageData.put("exception", "job blew up");

    repository.updateStage(stageId, 10L, stageData);

    assertEquals(WorkflowStatus.FAILURE, storedState().getStatus());
  }

  @Test
  void theEnumValueFailureIsHonoredLikeTheLegacyFailedAlias() {
    repository.updateStage(
        stageId, 10L, variables(Map.of(Workflow.STATUS_VARIABLE_KEY, "FAILURE")));

    assertEquals(WorkflowStatus.FAILURE, storedState().getStatus());
  }

  @Test
  void aStatusOfExceptionPersistsAsException() {
    repository.updateStage(
        stageId, 10L, variables(Map.of(Workflow.STATUS_VARIABLE_KEY, "EXCEPTION")));

    assertEquals(WorkflowStatus.EXCEPTION, storedState().getStatus());
  }

  @Test
  void aStatusOfFinishedLeavesTheStageFinished() {
    repository.updateStage(
        stageId, 10L, variables(Map.of(Workflow.STATUS_VARIABLE_KEY, "FINISHED")));

    assertEquals(WorkflowStatus.FINISHED, storedState().getStatus());
  }

  @Test
  void aNonFailureStatusValueIsNotHonoredAsATerminalStageStatus() {
    // updateStage records a stage's terminal state; the status fallback only escalates to a
    // failure/error status, never to RUNNING / SUPERSEDED / CANCELLED.
    for (String value : List.of("RUNNING", "SUPERSEDED", "CANCELLED")) {
      store(WorkflowStatus.RUNNING);
      repository.updateStage(stageId, 10L, variables(Map.of(Workflow.STATUS_VARIABLE_KEY, value)));
      assertEquals(WorkflowStatus.FINISHED, storedState().getStatus(), "status=" + value);
    }
  }

  @Test
  void anUnrecognizedStatusValueLeavesTheStageFinished() {
    repository.updateStage(stageId, 10L, variables(Map.of(Workflow.STATUS_VARIABLE_KEY, "NOPE")));

    assertEquals(WorkflowStatus.FINISHED, storedState().getStatus());
  }

  @Test
  void theFailureVariableTakesPrecedenceOverTheStatusFallback() {
    Map<String, Object> vars = new HashMap<>();
    vars.put(Workflow.FAILURE_VARIABLE, true);
    vars.put(Workflow.STATUS_VARIABLE_KEY, "EXCEPTION");

    repository.updateStage(stageId, 10L, vars);

    assertEquals(WorkflowStatus.FAILURE, storedState().getStatus());
  }

  @Test
  void theGlobalExceptionTakesPrecedenceOverTheStatusFallback() {
    Map<String, Object> vars = new HashMap<>();
    vars.put(
        WorkflowVariableHandler.getNamespacedVariableName(
            Workflow.GLOBAL_NAMESPACE, Workflow.EXCEPTION_VARIABLE),
        "sink exploded");
    vars.put(Workflow.STATUS_VARIABLE_KEY, "FAILED");

    repository.updateStage(stageId, 10L, vars);

    WorkflowInstanceState state = storedState();
    assertEquals(WorkflowStatus.EXCEPTION, state.getStatus());
    assertEquals("sink exploded", state.getException());
  }

  @Test
  void theStatusFallbackDoesNotOverwriteAnExceptionFieldSetByTheGlobalExceptionKey() {
    Map<String, Object> vars = new HashMap<>();
    vars.put(
        WorkflowVariableHandler.getNamespacedVariableName(
            Workflow.GLOBAL_NAMESPACE, Workflow.EXCEPTION_VARIABLE),
        "from-global-exception");
    vars.put(Workflow.STATUS_VARIABLE_KEY, "FAILED");

    repository.updateStage(stageId, 10L, vars);

    assertEquals("from-global-exception", storedState().getException());
  }

  @Test
  void theStatusFallbackSetsOnlyTheStatusAndLeavesTheExceptionFieldNull() {
    repository.updateStage(stageId, 10L, variables(Map.of(Workflow.STATUS_VARIABLE_KEY, "FAILED")));

    WorkflowInstanceState state = storedState();
    assertEquals(WorkflowStatus.FAILURE, state.getStatus());
    assertNull(state.getException());
  }

  @Test
  void stageEndedAtAndVariablesArePersisted() {
    Map<String, Object> vars = variables(Map.of("result", "ok"));

    repository.updateStage(stageId, 99L, vars);

    WorkflowInstanceState state = storedState();
    assertEquals(99L, state.getStage().getEndedAt());
    assertEquals("ok", state.getStage().getVariables().get("result"));
  }

  @Test
  void anEmptyVariablesMapLeavesTheStageFinished() {
    repository.updateStage(stageId, 10L, new HashMap<>());

    assertEquals(WorkflowStatus.FINISHED, storedState().getStatus());
  }

  private void store(WorkflowStatus status) {
    storedJson.set(
        JsonUtils.pojoToJson(
            new WorkflowInstanceState()
                .withId(stageId)
                .withStage(new Stage().withName(STAGE_NAME))
                .withStatus(status)));
  }

  private static Map<String, Object> variables(Map<String, Object> vars) {
    return new HashMap<>(vars);
  }

  private WorkflowInstanceState storedState() {
    return JsonUtils.readValue(storedJson.get(), WorkflowInstanceState.class);
  }
}
