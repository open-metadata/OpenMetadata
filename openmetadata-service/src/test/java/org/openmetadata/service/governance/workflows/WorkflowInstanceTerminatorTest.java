package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.SQLException;
import java.sql.SQLTransactionRollbackException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.flowable.common.engine.api.FlowableException;
import org.flowable.common.engine.api.FlowableOptimisticLockingException;
import org.flowable.engine.ManagementService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.engine.runtime.ProcessInstanceQuery;
import org.flowable.job.api.JobQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus;
import org.openmetadata.service.exception.WorkflowInstanceConflictException;
import org.openmetadata.service.governance.workflows.WorkflowInstanceTerminator.Engine;
import org.openmetadata.service.governance.workflows.WorkflowInstanceTerminator.TerminationOutcome;
import org.openmetadata.service.governance.workflows.WorkflowInstanceTerminator.TerminationRequest;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository.StopRequest;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;

class WorkflowInstanceTerminatorTest {

  private static final String SERVER_LOCK_OWNER = "this-server-executor";
  private static final String ROOT_ID = "trigger-root";
  private static final String CHILD_ID = "main-child";
  private static final String GRANDCHILD_ID = "nested-child";

  private final UUID workflowInstanceId = UUID.randomUUID();
  private final RuntimeService runtimeService = mock(RuntimeService.class);
  private final ManagementService managementService = mock(ManagementService.class);
  private final WorkflowTaskCloser taskCloser = mock(WorkflowTaskCloser.class);
  private final WorkflowInstanceRepository instanceRepository =
      mock(WorkflowInstanceRepository.class);
  private final WorkflowInstanceStateRepository stateRepository =
      mock(WorkflowInstanceStateRepository.class);

  private final List<String> runningProcessInstanceIds = new ArrayList<>();
  private final List<String> deletedProcessInstanceIds = new ArrayList<>();
  private final List<String> deleteReasons = new ArrayList<>();
  private final AtomicReference<WorkflowInstance> storedInstance = new AtomicReference<>();
  private final AtomicReference<String> failedStagesReason = new AtomicReference<>();
  private final AtomicReference<StopRequest> recordedStopRequest = new AtomicReference<>();
  private Map<String, List<String>> childIdsBySuperId = Map.of();
  private Map<String, Long> jobsLockedHereByProcessInstanceId = Map.of();
  private boolean isStopRecordable = true;

  private WorkflowInstanceTerminator terminator;

  @BeforeEach
  void setUp() {
    terminator =
        new WorkflowInstanceTerminator(
            new Engine(runtimeService, managementService, SERVER_LOCK_OWNER),
            taskCloser,
            instanceRepository,
            stateRepository);
    when(runtimeService.createProcessInstanceQuery()).thenAnswer(invocation -> processQuery());
    when(managementService.createJobQuery()).thenAnswer(invocation -> jobQuery());
    doAnswer(
            invocation -> {
              // Flowable cascades the delete of a root into its call-activity children.
              String rootId = invocation.getArgument(0);
              deletedProcessInstanceIds.add(rootId);
              deleteReasons.add(invocation.getArgument(1));
              runningProcessInstanceIds.removeAll(
                  WorkflowInstanceTerminator.collectProcessTree(List.of(rootId), this::childIdsOf));
              return null;
            })
        .when(runtimeService)
        .deleteProcessInstance(anyString(), anyString());
    when(instanceRepository.getByIdOrNotFound(workflowInstanceId))
        .thenAnswer(invocation -> storedInstance.get());
    doAnswer(
            invocation -> {
              storedInstance.set(
                  storedInstance
                      .get()
                      .withStatus(WorkflowStatus.FAILURE)
                      .withException(invocation.getArgument(1)));
              return null;
            })
        .when(instanceRepository)
        .markInstanceAsFailed(any(UUID.class), anyString());
    doAnswer(
            invocation -> {
              failedStagesReason.set(invocation.getArgument(1));
              return null;
            })
        .when(stateRepository)
        .markRunningStatesAsFailed(any(UUID.class), anyString());
    doAnswer(
            invocation -> {
              if (isStopRecordable) {
                recordedStopRequest.set(invocation.getArgument(1));
              }
              return isStopRecordable;
            })
        .when(instanceRepository)
        .requestStop(any(UUID.class), any(StopRequest.class));
  }

  @Test
  void collectProcessTreeListsRootsBeforeEveryDescendant() {
    Map<String, List<String>> children =
        Map.of(
            "root-a", List.of("a-child-1", "a-child-2"),
            "a-child-1", List.of("a-grandchild"),
            "root-b", List.of("b-child"));

    List<String> tree =
        WorkflowInstanceTerminator.collectProcessTree(
            List.of("root-a", "root-b"), id -> children.getOrDefault(id, List.of()));

    assertEquals(
        List.of("root-a", "root-b", "a-child-1", "a-child-2", "b-child", "a-grandchild"), tree);
  }

  @Test
  void collectProcessTreeVisitsEachInstanceOnce() {
    Map<String, List<String>> children =
        Map.of("root", List.of("child", "child"), "child", List.of("root"));

    List<String> tree =
        WorkflowInstanceTerminator.collectProcessTree(
            List.of("root"), id -> children.getOrDefault(id, List.of()));

    assertEquals(List.of("root", "child"), tree);
  }

  @Test
  void onlyARunningProcessOrARunningRecordCanBeTerminated() {
    assertTrue(WorkflowInstanceTerminator.isTerminable(WorkflowStatus.FINISHED, true));
    assertTrue(WorkflowInstanceTerminator.isTerminable(WorkflowStatus.RUNNING, false));
    assertFalse(WorkflowInstanceTerminator.isTerminable(WorkflowStatus.FINISHED, false));
    assertFalse(WorkflowInstanceTerminator.isTerminable(WorkflowStatus.FAILURE, false));
  }

  @Test
  void terminateDeletesOnlyTheRootAndNeverAChild() {
    givenRunningTree();

    TerminationOutcome outcome = terminator.terminate(request("pod died"));
    WorkflowInstance terminated = outcome.workflowInstance();

    assertFalse(outcome.stopRequested());
    assertEquals(
        "Terminated by admin: pod died",
        recordedStopRequest.get().reason(),
        "a job of the instance executing on another server stops at its next batch boundary");
    assertEquals(List.of(ROOT_ID), deletedProcessInstanceIds);
    assertEquals(List.of(Workflow.TERMINATED_BY_ADMIN), deleteReasons);
    assertTrue(runningProcessInstanceIds.isEmpty());
    assertEquals(WorkflowStatus.FAILURE, terminated.getStatus());
    assertEquals("Terminated by admin: pod died", terminated.getException());
    assertEquals("Terminated by admin: pod died", failedStagesReason.get());
  }

  @Test
  void aJobHeldByThisServerIsAskedToStopInsteadOfBeingDeleted() {
    givenRunningTree();
    jobsLockedHereByProcessInstanceId = Map.of(CHILD_ID, 1L);
    long before = System.currentTimeMillis();

    TerminationOutcome outcome = terminator.terminate(request("sink running"));

    assertTrue(outcome.stopRequested());
    assertEquals(WorkflowStatus.RUNNING, outcome.workflowInstance().getStatus());
    assertEquals(List.of(ROOT_ID, CHILD_ID, GRANDCHILD_ID), runningProcessInstanceIds);
    verify(runtimeService, never()).deleteProcessInstance(anyString(), anyString());
    verify(taskCloser, never()).closeTasks(any(), anyString(), anyString());
    verify(instanceRepository, never()).markInstanceAsFailed(any(UUID.class), anyString());
    StopRequest stopRequest = recordedStopRequest.get();
    assertTrue(stopRequest.requested());
    assertEquals("Terminated by admin: sink running", stopRequest.reason());
    assertEquals("admin", stopRequest.requestedBy());
    assertTrue(stopRequest.requestedAt() >= before);
  }

  @Test
  void terminateRepairsARunningRecordWithNoProcessLeft() {
    storedInstance.set(instance(WorkflowStatus.RUNNING));

    WorkflowInstance terminated =
        terminator.terminate(request("orphaned record")).workflowInstance();

    assertTrue(deletedProcessInstanceIds.isEmpty());
    assertEquals(WorkflowStatus.FAILURE, terminated.getStatus());
  }

  @Test
  void terminateRejectsAnInstanceThatHasAlreadyEnded() {
    storedInstance.set(instance(WorkflowStatus.FINISHED));

    assertThrows(
        WorkflowInstanceConflictException.class, () -> terminator.terminate(request(null)));

    assertEquals(WorkflowStatus.FINISHED, storedInstance.get().getStatus());
  }

  @Test
  void terminateKeepsTheOutcomeOfAProcessThatEndedOnItsOwn() {
    givenRunningTree();
    storedInstance.set(instance(WorkflowStatus.EXCEPTION).withException("sink failed"));

    WorkflowInstance terminated = terminator.terminate(request(null)).workflowInstance();

    assertTrue(runningProcessInstanceIds.isEmpty());
    assertEquals(WorkflowStatus.EXCEPTION, terminated.getStatus());
    assertEquals("sink failed", terminated.getException());
  }

  @Test
  void aConcurrentChangeToTheProcessRequestsAStop() {
    givenRunningTree();
    doAnswer(
            invocation -> {
              throw new FlowableOptimisticLockingException("revision changed");
            })
        .when(runtimeService)
        .deleteProcessInstance(anyString(), anyString());

    TerminationOutcome outcome = terminator.terminate(request(null));

    assertTrue(outcome.stopRequested());
    assertEquals(WorkflowStatus.RUNNING, storedInstance.get().getStatus());
    assertEquals("Terminated by admin", recordedStopRequest.get().reason());
    verify(taskCloser, never()).closeTasks(any(), anyString(), anyString());
  }

  @Test
  void openTasksOfTheTreeAreLookedUpBeforeTheDeleteAndClosedOnlyAfterIt() {
    givenRunningTree();
    List<UUID> openTaskIds = List.of(UUID.randomUUID(), UUID.randomUUID());
    when(taskCloser.findTaskIds(List.of(ROOT_ID, CHILD_ID, GRANDCHILD_ID))).thenReturn(openTaskIds);

    TerminationOutcome outcome = terminator.terminate(request("pod died"));

    assertFalse(outcome.stopRequested());
    InOrder order = inOrder(taskCloser, runtimeService);
    order.verify(taskCloser).findTaskIds(List.of(ROOT_ID, CHILD_ID, GRANDCHILD_ID));
    order.verify(runtimeService).deleteProcessInstance(ROOT_ID, Workflow.TERMINATED_BY_ADMIN);
    order.verify(taskCloser).closeTasks(openTaskIds, "admin", "Terminated by admin: pod died");
  }

  @Test
  void anInstanceThatEndedWhileItsJobStillRunsIsRefusedWithoutClosingAnything() {
    givenRunningTree();
    storedInstance.set(instance(WorkflowStatus.FINISHED));
    jobsLockedHereByProcessInstanceId = Map.of(CHILD_ID, 1L);
    isStopRecordable = false;

    assertThrows(
        WorkflowInstanceConflictException.class, () -> terminator.terminate(request("late")));

    assertEquals(WorkflowStatus.FINISHED, storedInstance.get().getStatus());
    verify(runtimeService, never()).deleteProcessInstance(anyString(), anyString());
    verify(taskCloser, never()).closeTasks(any(), anyString(), anyString());
  }

  @Test
  void aDeleteBlockedByAnExecutingJobRequestsAStop() {
    givenRunningTree();
    FlowableException lockWait =
        new FlowableException(
            "Could not flush deletes",
            new SQLTransactionRollbackException("Lock wait timeout exceeded", "40001", 1205));
    doAnswer(
            invocation -> {
              throw lockWait;
            })
        .when(runtimeService)
        .deleteProcessInstance(anyString(), anyString());

    TerminationOutcome outcome = terminator.terminate(request("stuck"));

    assertTrue(outcome.stopRequested());
    assertEquals(WorkflowStatus.RUNNING, outcome.workflowInstance().getStatus());
    assertEquals("Terminated by admin: stuck", recordedStopRequest.get().reason());
    verify(instanceRepository, never()).markInstanceAsFailed(any(UUID.class), anyString());
    verify(taskCloser, never()).closeTasks(any(), anyString(), anyString());
  }

  @Test
  void aDeleteFailureThatIsNotALockConflictPropagatesUnchanged() {
    givenRunningTree();
    IllegalStateException unrelated = new IllegalStateException("engine is closed");
    doAnswer(
            invocation -> {
              throw unrelated;
            })
        .when(runtimeService)
        .deleteProcessInstance(anyString(), anyString());

    IllegalStateException thrown =
        assertThrows(IllegalStateException.class, () -> terminator.terminate(request(null)));

    assertSame(unrelated, thrown);
  }

  @Test
  void lockConflictsAreRecognisedAnywhereInTheCauseChain() {
    assertTrue(isLockConflict(new SQLTransactionRollbackException("rollback")));
    assertTrue(isLockConflict(new SQLException("lock wait timeout", "HY000", 1205)));
    assertTrue(isLockConflict(new SQLException("deadlock", "HY000", 1213)));
    assertTrue(isLockConflict(new SQLException("serialization failure", "40001")));
    assertTrue(isLockConflict(new SQLException("deadlock detected", "40P01")));
    assertTrue(isLockConflict(new SQLException("lock not available", "55P03")));
    assertFalse(isLockConflict(new SQLException("duplicate key", "23000", 1062)));
    assertFalse(isLockConflict(new IllegalStateException("engine is closed")));
    assertFalse(WorkflowInstanceTerminator.isLockConflict(null));
  }

  private static boolean isLockConflict(SQLException sqlError) {
    return WorkflowInstanceTerminator.isLockConflict(
        new RuntimeException("JDBI", new FlowableException("Flowable", sqlError)));
  }

  private static boolean isLockConflict(RuntimeException failure) {
    return WorkflowInstanceTerminator.isLockConflict(failure);
  }

  private void givenRunningTree() {
    storedInstance.set(instance(WorkflowStatus.RUNNING));
    runningProcessInstanceIds.addAll(List.of(ROOT_ID, CHILD_ID, GRANDCHILD_ID));
    childIdsBySuperId = Map.of(ROOT_ID, List.of(CHILD_ID), CHILD_ID, List.of(GRANDCHILD_ID));
  }

  private TerminationRequest request(String reason) {
    return new TerminationRequest(workflowInstanceId, reason, "admin");
  }

  private WorkflowInstance instance(WorkflowStatus status) {
    return new WorkflowInstance().withId(workflowInstanceId).withStatus(status);
  }

  private List<String> childIdsOf(String processInstanceId) {
    return childIdsBySuperId.getOrDefault(processInstanceId, List.of());
  }

  private ProcessInstanceQuery processQuery() {
    AtomicReference<String> superId = new AtomicReference<>();
    ProcessInstanceQuery query = mock(ProcessInstanceQuery.class, RETURNS_SELF);
    when(query.superProcessInstanceId(anyString()))
        .thenAnswer(
            invocation -> {
              superId.set(invocation.getArgument(0));
              return query;
            });
    when(query.list())
        .thenAnswer(
            invocation ->
                runningProcessInstanceIds.stream()
                    .filter(
                        id ->
                            superId.get() == null
                                ? ROOT_ID.equals(id)
                                : isChildOf(id, superId.get()))
                    .map(this::processInstance)
                    .toList());
    return query;
  }

  private boolean isChildOf(String processInstanceId, String superId) {
    return childIdsOf(superId).contains(processInstanceId);
  }

  private ProcessInstance processInstance(String processInstanceId) {
    ProcessInstance processInstance = mock(ProcessInstance.class);
    when(processInstance.getId()).thenReturn(processInstanceId);
    return processInstance;
  }

  private JobQuery jobQuery() {
    AtomicReference<String> processInstanceId = new AtomicReference<>();
    AtomicReference<String> lockOwner = new AtomicReference<>();
    JobQuery query = mock(JobQuery.class, RETURNS_SELF);
    when(query.processInstanceId(anyString()))
        .thenAnswer(
            invocation -> {
              processInstanceId.set(invocation.getArgument(0));
              return query;
            });
    when(query.lockOwner(anyString()))
        .thenAnswer(
            invocation -> {
              lockOwner.set(invocation.getArgument(0));
              return query;
            });
    when(query.count())
        .thenAnswer(
            invocation ->
                SERVER_LOCK_OWNER.equals(lockOwner.get())
                    ? jobsLockedHereByProcessInstanceId.getOrDefault(processInstanceId.get(), 0L)
                    : 0L);
    return query;
  }
}
