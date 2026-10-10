package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.WorkflowDocStoreDAOs.WorkflowInstanceTimeSeriesDAO;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository.StopRequest;

class WorkflowInstanceRepositoryTest {

  private static final String STOP_REASON = "Terminated by admin: sink running";
  private static final String PROCESS_ENDED = "processEnded";
  private static final Map<String, Object> SINK_EXCEPTION =
      Map.of(
          WorkflowVariableHandler.getNamespacedVariableName(
              Workflow.GLOBAL_NAMESPACE, Workflow.EXCEPTION_VARIABLE),
          "sink exploded");

  private final UUID workflowInstanceId = UUID.randomUUID();
  private final WorkflowInstanceTimeSeriesDAO timeSeriesDao =
      mock(WorkflowInstanceTimeSeriesDAO.class);
  private final WorkflowInstanceStateRepository stateRepository =
      mock(WorkflowInstanceStateRepository.class);
  private final AtomicReference<String> storedJson = new AtomicReference<>();
  private final AtomicReference<Runnable> beforeNextReadReturns = new AtomicReference<>();
  private final AtomicReference<Runnable> beforeProcessEndMark = new AtomicReference<>();

  private MockedStatic<Entity> entity;
  private WorkflowInstanceRepository repository;

  @BeforeEach
  void setUp() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.workflowInstanceTimeSeriesDAO()).thenReturn(timeSeriesDao);
    entity = mockStatic(Entity.class);
    entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    entity
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE))
        .thenReturn(stateRepository);
    when(stateRepository.listAllStatesForInstance(workflowInstanceId)).thenReturn(List.of());
    when(timeSeriesDao.getById(workflowInstanceId))
        .thenAnswer(
            invocation -> {
              String json = storedJson.get();
              Runnable interleaved = beforeNextReadReturns.getAndSet(null);
              if (interleaved != null) {
                interleaved.run();
              }
              return json;
            });
    doAnswer(
            invocation -> {
              storedJson.set(invocation.getArgument(0));
              return null;
            })
        .when(timeSeriesDao)
        .update(anyString(), any(UUID.class));
    givenPartialUpdatesWithSqlSemantics();
    repository = new WorkflowInstanceRepository();
  }

  /**
   * The partial updates as their SQL behaves: each sets only its own paths on the stored document,
   * and the stop request only while the stored status is one of the two statuses it is given and
   * the process is not marked ended.
   */
  private void givenPartialUpdatesWithSqlSemantics() {
    when(timeSeriesDao.requestStop(anyString(), anyString(), anyString(), anyString()))
        .thenAnswer(
            invocation -> {
              Map<String, Object> document = storedDocument();
              Object status = document.get("status");
              Map<String, Object> variables = storedVariables(document);
              boolean isStoppable =
                  (invocation.getArgument(2).equals(status)
                          || invocation.getArgument(3).equals(status))
                      && !variables.containsKey(PROCESS_ENDED);
              if (isStoppable) {
                variables.put(
                    WorkflowInstanceRepository.STOP_REQUEST_VARIABLE_KEY,
                    JsonUtils.readValue(invocation.getArgument(1), Map.class));
                document.put("variables", variables);
                storedJson.set(JsonUtils.pojoToJson(document));
              }
              return isStoppable ? 1 : 0;
            });
    when(timeSeriesDao.markProcessEnded(anyString()))
        .thenAnswer(
            invocation -> {
              Runnable interleaved = beforeProcessEndMark.getAndSet(null);
              if (interleaved != null) {
                interleaved.run();
              }
              Map<String, Object> document = storedDocument();
              Map<String, Object> variables = storedVariables(document);
              variables.put(PROCESS_ENDED, true);
              document.put("variables", variables);
              storedJson.set(JsonUtils.pojoToJson(document));
              return 1;
            });
    when(timeSeriesDao.recordEnd(anyString(), anyString(), anyLong()))
        .thenAnswer(
            invocation -> setStoredFields(invocation.getArgument(1), invocation.getArgument(2)));
    when(timeSeriesDao.recordEndWithException(anyString(), anyString(), anyLong(), anyString()))
        .thenAnswer(
            invocation -> {
              setStoredFields(invocation.getArgument(1), invocation.getArgument(2));
              Map<String, Object> document = storedDocument();
              document.put("exception", invocation.getArgument(3));
              storedJson.set(JsonUtils.pojoToJson(document));
              return 1;
            });
  }

  private int setStoredFields(String status, long endedAt) {
    Map<String, Object> document = storedDocument();
    document.put("status", status);
    document.put("endedAt", endedAt);
    storedJson.set(JsonUtils.pojoToJson(document));
    return 1;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> storedVariables(Map<String, Object> document) {
    // The stored document is read back as an untyped Map, so its variables are one too.
    return document.get("variables") instanceof Map<?, ?> stored
        ? new HashMap<>(JsonUtils.convertValue(stored, Map.class))
        : new HashMap<>();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> storedDocument() {
    return new HashMap<>(JsonUtils.readValue(storedJson.get(), Map.class));
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void theEndOfAProcessAskedToStopKeepsTheFailureTheStopStandsFor() {
    storeRunningInstance();
    StopRequest stopRequest = new StopRequest(true, STOP_REASON, "admin", 1L);

    repository.requestStop(workflowInstanceId, stopRequest);
    repository.recordProcessEnd(workflowInstanceId, 42L, Map.of());

    WorkflowInstance ended = storedInstance();
    assertEquals(WorkflowStatus.FAILURE, ended.getStatus());
    assertEquals(STOP_REASON, ended.getException());
    assertEquals(42L, ended.getEndedAt());
    assertEquals("kept", ended.getVariables().get("existing"));
    assertEquals(Optional.of(stopRequest), repository.findStopRequest(workflowInstanceId));
    verify(stateRepository).markRunningStatesAsFailed(workflowInstanceId, STOP_REASON);
  }

  @Test
  void aStopRequestedBetweenTheEndListenersReadAndWriteEndsTheInstanceAsFailure() {
    storeRunningInstance();
    StopRequest stopRequest = new StopRequest(true, STOP_REASON, "admin", 1L);
    AtomicReference<Boolean> isStopRecorded = new AtomicReference<>();
    beforeNextReadReturns.set(
        () -> isStopRecorded.set(repository.requestStop(workflowInstanceId, stopRequest)));

    repository.recordProcessEnd(workflowInstanceId, 42L, Map.of());

    assertTrue(isStopRecorded.get(), "the instance was still RUNNING when the stop landed");
    WorkflowInstance ended = storedInstance();
    assertEquals(WorkflowStatus.FAILURE, ended.getStatus(), "the accepted stop is honoured");
    assertEquals(STOP_REASON, ended.getException());
    assertEquals(42L, ended.getEndedAt());
    assertEquals("kept", ended.getVariables().get("existing"));
    assertEquals(Optional.of(stopRequest), repository.findStopRequest(workflowInstanceId));
    verify(stateRepository).markRunningStatesAsFailed(workflowInstanceId, STOP_REASON);
    verify(timeSeriesDao, never()).update(anyString(), any(UUID.class));
  }

  @Test
  void aStopRequestedAfterTheEndIsNotRecorded() {
    storeRunningInstance();
    repository.recordProcessEnd(workflowInstanceId, 42L, Map.of());

    boolean isStopRecorded =
        repository.requestStop(workflowInstanceId, new StopRequest(true, STOP_REASON, "admin", 1L));

    assertFalse(isStopRecorded);
    assertEquals(WorkflowStatus.FINISHED, storedInstance().getStatus());
    assertEquals(Optional.empty(), repository.findStopRequest(workflowInstanceId));
  }

  @Test
  void aStopRequestOnAnInstanceWithoutVariablesCreatesThem() {
    storedJson.set(
        JsonUtils.pojoToJson(
            new WorkflowInstance().withId(workflowInstanceId).withStatus(WorkflowStatus.RUNNING)));

    assertTrue(
        repository.requestStop(
            workflowInstanceId, new StopRequest(true, STOP_REASON, "admin", 1L)));

    assertTrue(repository.findStopRequest(workflowInstanceId).isPresent());
  }

  @Test
  void anExceptionVariableRecordsTheExceptionAndAnEndWithoutOneKeepsTheStoredException() {
    storeRunningInstance();
    repository.updateWorkflowInstance(
        workflowInstanceId,
        42L,
        Map.of(
            WorkflowVariableHandler.getNamespacedVariableName(
                Workflow.GLOBAL_NAMESPACE, Workflow.EXCEPTION_VARIABLE),
            "sink exploded"));

    assertEquals(WorkflowStatus.EXCEPTION, storedInstance().getStatus());
    assertEquals("sink exploded", storedInstance().getException());

    repository.markInstanceAsSuperseded(workflowInstanceId, "newer run");
    repository.updateWorkflowInstance(workflowInstanceId, 43L, Map.of());

    assertEquals(WorkflowStatus.SUPERSEDED, storedInstance().getStatus());
    assertEquals("sink exploded", storedInstance().getException());
    assertEquals(43L, storedInstance().getEndedAt());
  }

  @Test
  void aStopRequestedRunStaysRunningUntilItsProcessEnds() {
    storeRunningInstance();

    repository.requestStop(workflowInstanceId, new StopRequest(true, STOP_REASON, "admin", 1L));

    WorkflowInstance running = storedInstance();
    assertEquals(WorkflowStatus.RUNNING, running.getStatus());
    assertNull(running.getEndedAt());
    assertTrue(repository.findStopRequest(workflowInstanceId).isPresent());
  }

  @Test
  void withoutAStopRequestTheEndOfAProcessRecordsItsOwnOutcome() {
    storeRunningInstance();

    repository.recordProcessEnd(workflowInstanceId, 42L, Map.of());

    assertEquals(WorkflowStatus.FINISHED, storedInstance().getStatus());
    assertEquals(Optional.empty(), repository.findStopRequest(workflowInstanceId));
    verify(stateRepository, never()).markRunningStatesAsFailed(any(UUID.class), anyString());
  }

  @Test
  void aSupersededInstanceStaysSupersededEvenWhenAStopWasRequested() {
    storeRunningInstance();
    repository.requestStop(workflowInstanceId, new StopRequest(true, STOP_REASON, "admin", 1L));
    repository.markInstanceAsSuperseded(workflowInstanceId, "newer run");

    repository.recordProcessEnd(workflowInstanceId, 42L, Map.of());

    assertEquals(WorkflowStatus.SUPERSEDED, storedInstance().getStatus());
  }

  @Test
  void aStopRequestedWhileAFailedJobAttemptIsRetriedIsRecordedAndEndsTheInstanceAsFailure() {
    storeInstance(WorkflowStatus.EXCEPTION);
    StopRequest stopRequest = new StopRequest(true, STOP_REASON, "admin", 1L);

    assertTrue(repository.requestStop(workflowInstanceId, stopRequest));
    assertEquals(WorkflowStatus.EXCEPTION, storedInstance().getStatus());

    repository.recordProcessEnd(workflowInstanceId, 42L, Map.of());

    WorkflowInstance ended = storedInstance();
    assertEquals(WorkflowStatus.FAILURE, ended.getStatus());
    assertEquals(STOP_REASON, ended.getException());
    assertEquals("kept", ended.getVariables().get("existing"));
  }

  @Test
  void aStopRequestAfterTheProcessEndedWithAnExceptionIsNotRecorded() {
    storeRunningInstance();
    repository.recordProcessEnd(workflowInstanceId, 42L, SINK_EXCEPTION);
    assertEquals(WorkflowStatus.EXCEPTION, storedInstance().getStatus());

    boolean isStopRecorded =
        repository.requestStop(workflowInstanceId, new StopRequest(true, STOP_REASON, "admin", 1L));

    assertFalse(isStopRecorded);
    assertEquals(WorkflowStatus.EXCEPTION, storedInstance().getStatus());
    assertEquals(Optional.empty(), repository.findStopRequest(workflowInstanceId));
  }

  @Test
  void aStopRequestAfterAFailedJobAttemptIsRecorded() {
    storeRunningInstance();
    repository.updateWorkflowInstance(workflowInstanceId, 42L, SINK_EXCEPTION);
    assertEquals(WorkflowStatus.EXCEPTION, storedInstance().getStatus());

    assertTrue(
        repository.requestStop(
            workflowInstanceId, new StopRequest(true, STOP_REASON, "admin", 1L)));
    assertTrue(repository.findStopRequest(workflowInstanceId).isPresent());
  }

  @Test
  void aStopRequestedBetweenTheEndWriteAndTheEndMarkEndsTheInstanceAsFailure() {
    storeRunningInstance();
    StopRequest stopRequest = new StopRequest(true, STOP_REASON, "admin", 1L);
    AtomicReference<Boolean> isStopRecorded = new AtomicReference<>();
    beforeProcessEndMark.set(
        () -> isStopRecorded.set(repository.requestStop(workflowInstanceId, stopRequest)));

    repository.recordProcessEnd(workflowInstanceId, 42L, SINK_EXCEPTION);

    assertTrue(isStopRecorded.get(), "the process was not marked ended when the stop landed");
    WorkflowInstance ended = storedInstance();
    assertEquals(WorkflowStatus.FAILURE, ended.getStatus(), "the accepted stop is honoured");
    assertEquals(STOP_REASON, ended.getException());
    verify(stateRepository).markRunningStatesAsFailed(workflowInstanceId, STOP_REASON);
  }

  @Test
  void aStopRequestOnAnInstanceThatEndedIsNotRecorded() {
    for (WorkflowStatus ended :
        List.of(WorkflowStatus.FINISHED, WorkflowStatus.FAILURE, WorkflowStatus.SUPERSEDED)) {
      storeInstance(ended);

      boolean isStopRecorded =
          repository.requestStop(
              workflowInstanceId, new StopRequest(true, STOP_REASON, "admin", 1L));

      assertFalse(isStopRecorded, ended.value());
      assertEquals(ended, storedInstance().getStatus());
      assertEquals(Optional.empty(), repository.findStopRequest(workflowInstanceId));
    }
  }

  @Test
  void aTriggerWhoseSinkThrewEndsAsFailure() {
    storeRunningInstance();

    repository.recordProcessEnd(
        workflowInstanceId,
        42L,
        Map.of(Workflow.FAILURE_VARIABLE, true, Workflow.EXCEPTION_VARIABLE, "sink stack trace"));

    assertEquals(WorkflowStatus.FAILURE, storedInstance().getStatus());
  }

  private void storeRunningInstance() {
    storeInstance(WorkflowStatus.RUNNING);
  }

  private void storeInstance(WorkflowStatus status) {
    Map<String, Object> variables = new HashMap<>();
    variables.put("existing", "kept");
    storedJson.set(
        JsonUtils.pojoToJson(
            new WorkflowInstance()
                .withId(workflowInstanceId)
                .withStatus(status)
                .withVariables(variables)));
  }

  private WorkflowInstance storedInstance() {
    return JsonUtils.readValue(storedJson.get(), WorkflowInstance.class);
  }
}
