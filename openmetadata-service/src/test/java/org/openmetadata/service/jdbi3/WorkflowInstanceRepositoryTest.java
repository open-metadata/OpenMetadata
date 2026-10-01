package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
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
import org.openmetadata.service.jdbi3.WorkflowDocStoreDAOs.WorkflowInstanceTimeSeriesDAO;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository.StopRequest;

class WorkflowInstanceRepositoryTest {

  private static final String STOP_REASON = "Terminated by admin: sink running";

  private final UUID workflowInstanceId = UUID.randomUUID();
  private final WorkflowInstanceTimeSeriesDAO timeSeriesDao =
      mock(WorkflowInstanceTimeSeriesDAO.class);
  private final WorkflowInstanceStateRepository stateRepository =
      mock(WorkflowInstanceStateRepository.class);
  private final AtomicReference<String> storedJson = new AtomicReference<>();

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
    when(timeSeriesDao.getById(workflowInstanceId)).thenAnswer(invocation -> storedJson.get());
    doAnswer(
            invocation -> {
              storedJson.set(invocation.getArgument(0));
              return null;
            })
        .when(timeSeriesDao)
        .update(anyString(), any(UUID.class));
    repository = new WorkflowInstanceRepository();
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
    repository.updateWorkflowInstance(workflowInstanceId, 42L, Map.of());

    WorkflowInstance ended = storedInstance();
    assertEquals(WorkflowStatus.FAILURE, ended.getStatus());
    assertEquals(STOP_REASON, ended.getException());
    assertEquals(42L, ended.getEndedAt());
    assertEquals("kept", ended.getVariables().get("existing"));
    assertEquals(Optional.of(stopRequest), repository.findStopRequest(workflowInstanceId));
    verify(stateRepository).markRunningStatesAsFailed(workflowInstanceId, STOP_REASON);
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

    repository.updateWorkflowInstance(workflowInstanceId, 42L, Map.of());

    assertEquals(WorkflowStatus.FINISHED, storedInstance().getStatus());
    assertEquals(Optional.empty(), repository.findStopRequest(workflowInstanceId));
    verify(stateRepository, never()).markRunningStatesAsFailed(any(UUID.class), anyString());
  }

  @Test
  void aSupersededInstanceStaysSupersededEvenWhenAStopWasRequested() {
    storeRunningInstance();
    repository.requestStop(workflowInstanceId, new StopRequest(true, STOP_REASON, "admin", 1L));
    repository.markInstanceAsSuperseded(workflowInstanceId, "newer run");

    repository.updateWorkflowInstance(workflowInstanceId, 42L, Map.of());

    assertEquals(WorkflowStatus.SUPERSEDED, storedInstance().getStatus());
  }

  private void storeRunningInstance() {
    Map<String, Object> variables = new HashMap<>();
    variables.put("existing", "kept");
    storedJson.set(
        JsonUtils.pojoToJson(
            new WorkflowInstance()
                .withId(workflowInstanceId)
                .withStatus(WorkflowStatus.RUNNING)
                .withVariables(variables)));
  }

  private WorkflowInstance storedInstance() {
    return JsonUtils.readValue(storedJson.get(), WorkflowInstance.class);
  }
}
