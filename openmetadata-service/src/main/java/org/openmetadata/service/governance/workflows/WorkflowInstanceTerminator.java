package org.openmetadata.service.governance.workflows;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.sql.SQLException;
import java.sql.SQLTransactionRollbackException;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.FlowableObjectNotFoundException;
import org.flowable.common.engine.api.FlowableOptimisticLockingException;
import org.flowable.engine.ManagementService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.job.service.impl.asyncexecutor.AsyncExecutor;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.WorkflowInstanceConflictException;
import org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger;
import org.openmetadata.service.jdbi3.DeadlockRetry;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository.StopRequest;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;

/**
 * Terminates a governance workflow instance, including one left running by a server that died
 * mid-job.
 *
 * <p>The instance's root is the trigger process whose business key is the WorkflowInstance id; the
 * main workflow runs beneath it as a call-activity child that inherits the same key. Only roots
 * are passed to {@code deleteProcessInstance}: Flowable cascades that delete into every
 * call-activity child within the same command. Deleting a child on its own instead completes the
 * parent's call activity, and a periodic-batch trigger then goes on to fetch its next batch.
 *
 * <p>The cascade removes job rows by execution id and executions by id and revision without
 * reading LOCK_OWNER_, so rows still locked by a dead server's async executor go with it. A job
 * held by this server's own async executor may be executing right now and hold the rows the
 * delete needs, so the process is then left running.
 *
 * <p>Terminating a periodic-batch trigger first records a stop request on the WorkflowInstance,
 * which a batch sink reads before its next sub-batch and the periodic-batch fetch loop before its
 * next batch, on whichever server runs them; a process left running then ends on its own and is
 * recorded as FAILURE with the request's reason. No other process reads a stop request, so for any
 * other trigger none is recorded, and a process that cannot be deleted because a job of it is
 * executing is left as it is and the termination refused. A lock held by another server cannot be
 * told apart from a dead server's lock, so such a process is deleted. If its job is in fact still
 * executing, a periodic-batch trigger's request stops it at its next batch boundary, and any other
 * workflow's job keeps applying its side effects. Each statement of the delete waits at most
 * {@link #DELETE_LOCK_WAIT_SECONDS} seconds for rows that job holds; a timeout leaves the process
 * running.
 *
 * <p>The OpenMetadata tasks still open for the process tree's user tasks are looked up before the
 * delete, which removes the Flowable tasks that link to them, and cancelled once the delete
 * succeeded; a process left running keeps its tasks open.
 *
 * <p>A stop request is recorded only on a RUNNING or EXCEPTION instance: a failed job attempt
 * records EXCEPTION while Flowable retries the job. When neither the delete nor the stop request is
 * possible, because the instance has already ended while a job of its process is still executing,
 * the termination is refused.
 */
@Slf4j
public class WorkflowInstanceTerminator {

  /** Maximum row-lock wait per statement while deleting a process. */
  public static final int DELETE_LOCK_WAIT_SECONDS = 5;

  /** Postgres {@code lock_not_available}, raised when a lock_timeout expires. */
  static final String POSTGRES_LOCK_NOT_AVAILABLE = "55P03";

  /** Why a process that reads no stop request is not terminated while a job of it executes. */
  static final String JOB_EXECUTING_MESSAGE =
      "Workflow instance %s cannot be terminated now: a job is executing for this workflow instance; retry after it finishes";

  private final RuntimeService runtimeService;
  private final ManagementService managementService;
  private final RepositoryService repositoryService;
  private final String serverLockOwner;
  private final WorkflowTaskCloser taskCloser;
  private final WorkflowInstanceRepository workflowInstanceRepository;
  private final WorkflowInstanceStateRepository workflowInstanceStateRepository;

  /** A user's close of one workflow-managed task, which ends the process waiting on it. */
  public record TaskCloseRequest(UUID taskId, UUID workflowInstanceId, String closedBy) {
    String auditMessage() {
      return "Task %s was closed by %s".formatted(taskId, closedBy);
    }
  }

  public record TerminationRequest(UUID workflowInstanceId, String reason, String requestedBy) {
    String auditMessage() {
      return nullOrEmpty(reason) || reason.isBlank()
          ? "Terminated by %s".formatted(requestedBy)
          : "Terminated by %s: %s".formatted(requestedBy, reason.strip());
    }
  }

  /**
   * What a termination did: {@code stopRequested} means a job of a periodic-batch trigger was
   * executing, so the instance is still running and stops at its next batch boundary.
   */
  public record TerminationOutcome(WorkflowInstance workflowInstance, boolean stopRequested) {}

  /** The process engine of this server; {@code serverLockOwner} is its async executor's lock owner. */
  public record Engine(
      RuntimeService runtimeService,
      ManagementService managementService,
      RepositoryService repositoryService,
      String serverLockOwner) {}

  public WorkflowInstanceTerminator(
      Engine engine,
      WorkflowTaskCloser taskCloser,
      WorkflowInstanceRepository workflowInstanceRepository,
      WorkflowInstanceStateRepository workflowInstanceStateRepository) {
    this.runtimeService = engine.runtimeService();
    this.managementService = engine.managementService();
    this.repositoryService = engine.repositoryService();
    this.serverLockOwner = engine.serverLockOwner();
    this.taskCloser = taskCloser;
    this.workflowInstanceRepository = workflowInstanceRepository;
    this.workflowInstanceStateRepository = workflowInstanceStateRepository;
  }

  /** Builds a terminator bound to the process engine currently running on this server. */
  public static WorkflowInstanceTerminator forCurrentEngine(
      WorkflowInstanceRepository workflowInstanceRepository) {
    WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
    AsyncExecutor asyncExecutor =
        workflowHandler.getProcessEngineConfiguration().getAsyncExecutor();
    Engine engine =
        new Engine(
            workflowHandler.getRuntimeService(),
            workflowHandler.getManagementService(),
            workflowHandler.getRepositoryService(),
            asyncExecutor == null ? null : asyncExecutor.getLockOwner());
    WorkflowTaskCloser taskCloser =
        new WorkflowTaskCloser(
            workflowHandler.getProcessEngineConfiguration().getTaskService(),
            (TaskRepository) Entity.getEntityRepository(Entity.TASK));
    return new WorkflowInstanceTerminator(
        engine,
        taskCloser,
        workflowInstanceRepository,
        (WorkflowInstanceStateRepository)
            Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE));
  }

  public TerminationOutcome terminate(TerminationRequest request) {
    UUID workflowInstanceId = request.workflowInstanceId();
    WorkflowInstance workflowInstance =
        workflowInstanceRepository.getByIdOrNotFound(workflowInstanceId);
    List<ProcessInstance> roots = findRootProcessInstances(workflowInstanceId);
    List<String> rootIds = roots.stream().map(ProcessInstance::getId).toList();
    requireTerminable(workflowInstance, rootIds);
    List<String> processTreeIds = collectProcessTree(rootIds, this::findChildProcessInstanceIds);
    boolean isStoppable = roots.stream().anyMatch(this::isPeriodicBatchTrigger);
    boolean isStopRecorded = isStoppable && requestStop(request);
    boolean isDeleted =
        countJobsLockedByThisServer(processTreeIds) == 0
            && deleteProcessTree(request, rootIds, processTreeIds);
    if (!isDeleted) {
      requireStopRecorded(workflowInstanceId, isStoppable, isStopRecorded);
    }
    return new TerminationOutcome(
        workflowInstanceRepository.getByIdOrNotFound(workflowInstanceId), !isDeleted);
  }

  /**
   * Ends the processes waiting on a task a user closed, per
   * ADR:2026-11-17-closing-a-workflow-task-ends-only-the-process-holding-it. A run that is not a
   * periodic batch belongs to this task alone, so its whole process tree is deleted from its root and
   * the run is recorded as CANCELLED once the delete succeeded; a refused delete leaves both as they
   * were. In a periodic batch only the process holding the task is deleted, never the trigger root:
   * Flowable then completes the call that started it, so the batch carries on, and the run's status
   * is left to its trigger. Tasks still open in a deleted process are closed after it. Best effort:
   * a process this server is executing a job of is left running. Returns {@code true} when the run
   * ended.
   */
  public boolean endClosedTaskProcess(TaskCloseRequest request) {
    return WorkflowHandler.getInstance().findTaskProcessInstanceIds(request.taskId()).stream()
        .map(
            processInstanceId ->
                runtimeService
                    .createProcessInstanceQuery()
                    .processInstanceId(processInstanceId)
                    .singleResult())
        .filter(Objects::nonNull)
        .map(process -> endTaskProcess(request, process))
        .reduce(false, Boolean::logicalOr);
  }

  /** The process a close deletes, with its call-activity children. */
  private record ClosedTaskProcess(
      String processInstanceId, List<String> processTreeIds, boolean isWholeRun) {}

  /** {@code true} when the close ended the task's whole run. */
  private boolean endTaskProcess(TaskCloseRequest request, ProcessInstance process) {
    boolean isWholeRun = !isInPeriodicBatchRun(process);
    String target = isWholeRun ? process.getRootProcessInstanceId() : process.getId();
    ClosedTaskProcess closed =
        new ClosedTaskProcess(
            target,
            collectProcessTree(List.of(target), this::findChildProcessInstanceIds),
            isWholeRun);
    boolean isJobExecuting = countJobsLockedByThisServer(closed.processTreeIds()) > 0;
    if (isJobExecuting) {
      LOG.warn(
          "[WorkflowTerminate] Task {} closed; its process {} has a job executing and keeps running",
          request.taskId(),
          target);
    }
    return !isJobExecuting && deleteTaskProcess(request, closed);
  }

  /**
   * Deletes the process, then records the run's end when the whole run was deleted and closes the
   * tasks the process still had open. The open tasks are read first because the delete removes what
   * links them, and nothing is recorded when the delete is refused.
   */
  private boolean deleteTaskProcess(TaskCloseRequest request, ClosedTaskProcess closed) {
    List<UUID> otherOpenTaskIds = otherOpenTaskIds(request, closed.processTreeIds());
    boolean isDeleted =
        deleteProcessInstance(closed.processInstanceId(), Workflow.TASK_CLOSED_BY_USER);
    if (isDeleted && closed.isWholeRun()) {
      recordRunCancelled(request);
    }
    if (isDeleted) {
      taskCloser.closeTasks(otherOpenTaskIds, request.closedBy(), request.auditMessage());
    }
    return isDeleted && closed.isWholeRun();
  }

  private List<UUID> otherOpenTaskIds(TaskCloseRequest request, List<String> processTreeIds) {
    return taskCloser.findTaskIds(processTreeIds).stream()
        .filter(taskId -> !taskId.equals(request.taskId()))
        .toList();
  }

  private boolean isInPeriodicBatchRun(ProcessInstance process) {
    ProcessInstance root =
        process.getId().equals(process.getRootProcessInstanceId())
            ? process
            : runtimeService
                .createProcessInstanceQuery()
                .processInstanceId(process.getRootProcessInstanceId())
                .singleResult();
    return root != null && isPeriodicBatchTrigger(root);
  }

  private void recordRunCancelled(TaskCloseRequest request) {
    String reason = request.auditMessage();
    if (workflowInstanceRepository.endRunningInstance(
        request.workflowInstanceId(), WorkflowStatus.CANCELLED, reason)) {
      workflowInstanceStateRepository.markInstanceStatesAs(
          request.workflowInstanceId(), WorkflowStatus.CANCELLED, reason);
    }
  }

  /** Deletes the process tree; {@code false} when a job executing now holds rows it needs. */
  private boolean deleteProcessTree(
      TerminationRequest request, List<String> rootIds, List<String> processTreeIds) {
    List<UUID> openTaskIds = taskCloser.findTaskIds(processTreeIds);
    boolean isDeleted =
        rootIds.stream()
            .allMatch(rootId -> deleteProcessInstance(rootId, Workflow.TERMINATED_BY_ADMIN));
    if (isDeleted) {
      taskCloser.closeTasks(openTaskIds, request.requestedBy(), request.auditMessage());
      markTerminated(request.workflowInstanceId(), request.auditMessage());
      LOG.info(
          "[WorkflowTerminate] Workflow instance {} terminated; deleted process instances {}",
          request.workflowInstanceId(),
          processTreeIds);
    }
    return isDeleted;
  }

  /** {@code false} when the instance is neither RUNNING nor EXCEPTION, so none was recorded. */
  private boolean requestStop(TerminationRequest request) {
    return workflowInstanceRepository.requestStop(
        request.workflowInstanceId(),
        new StopRequest(
            true, request.auditMessage(), request.requestedBy(), System.currentTimeMillis()));
  }

  /**
   * A process left running must have a stop request it reads to end it; otherwise nothing was done.
   */
  private void requireStopRecorded(
      UUID workflowInstanceId, boolean isStoppable, boolean isStopRecorded) {
    if (!isStoppable) {
      throw new WorkflowInstanceConflictException(
          JOB_EXECUTING_MESSAGE.formatted(workflowInstanceId));
    }
    if (!isStopRecorded) {
      throw new WorkflowInstanceConflictException(
          "Workflow instance %s is already %s and a job of its process is executing now; try again once it completes"
              .formatted(
                  workflowInstanceId,
                  workflowInstanceRepository.getByIdOrNotFound(workflowInstanceId).getStatus()));
    }
    LOG.info(
        "[WorkflowTerminate] Workflow instance {} has a job executing; stop requested",
        workflowInstanceId);
  }

  /** Breadth-first walk from the roots through call-activity children; roots come first. */
  static List<String> collectProcessTree(
      List<String> rootIds, Function<String, List<String>> childIdsOf) {
    Set<String> collected = new LinkedHashSet<>();
    Deque<String> pending = new ArrayDeque<>(rootIds);
    while (!pending.isEmpty()) {
      String processInstanceId = pending.removeFirst();
      if (collected.add(processInstanceId)) {
        pending.addAll(childIdsOf.apply(processInstanceId));
      }
    }
    return List.copyOf(collected);
  }

  /** A record still RUNNING needs repair even when no process is left behind it. */
  static boolean isTerminable(WorkflowStatus status, boolean hasRunningProcess) {
    return hasRunningProcess || status == WorkflowStatus.RUNNING;
  }

  private static void requireTerminable(WorkflowInstance workflowInstance, List<String> rootIds) {
    if (!isTerminable(workflowInstance.getStatus(), !rootIds.isEmpty())) {
      throw new WorkflowInstanceConflictException(
          "Workflow instance %s is already %s and has no running process to terminate"
              .formatted(workflowInstance.getId(), workflowInstance.getStatus()));
    }
  }

  private List<ProcessInstance> findRootProcessInstances(UUID workflowInstanceId) {
    return runtimeService
        .createProcessInstanceQuery()
        .processInstanceBusinessKey(workflowInstanceId.toString())
        .excludeSubprocesses(true)
        .list();
  }

  /** Whether the root runs a deployed periodic-batch trigger, whose process reads a stop request. */
  private boolean isPeriodicBatchTrigger(ProcessInstance root) {
    return PeriodicBatchEntityTrigger.isPeriodicBatchTrigger(
        repositoryService.getBpmnModel(root.getProcessDefinitionId()));
  }

  private List<String> findChildProcessInstanceIds(String processInstanceId) {
    return runtimeService
        .createProcessInstanceQuery()
        .superProcessInstanceId(processInstanceId)
        .list()
        .stream()
        .map(ProcessInstance::getId)
        .toList();
  }

  private long countJobsLockedByThisServer(List<String> processInstanceIds) {
    return serverLockOwner == null
        ? 0
        : processInstanceIds.stream()
            .mapToLong(
                processInstanceId ->
                    managementService
                        .createJobQuery()
                        .processInstanceId(processInstanceId)
                        .lockOwner(serverLockOwner)
                        .count())
            .sum();
  }

  /**
   * {@code true} when {@code failure}, or any of its causes, is the database refusing a lock: a
   * MySQL or Postgres deadlock or lock wait timeout, a serialization failure, or a Postgres lock
   * that was not available.
   */
  static boolean isLockConflict(Throwable failure) {
    return DeadlockRetry.isDeadlock(failure)
        || ExceptionUtils.getThrowableList(failure).stream()
            .anyMatch(WorkflowInstanceTerminator::isLockRefusal);
  }

  private static boolean isLockRefusal(Throwable cause) {
    // Causes are typed as Throwable; only SQL errors carry a SQLState.
    return cause instanceof SQLTransactionRollbackException
        || (cause instanceof SQLException sqlException
            && POSTGRES_LOCK_NOT_AVAILABLE.equals(sqlException.getSQLState()));
  }

  /** {@code false} when the delete is refused because a job executing now holds its rows. */
  private boolean deleteProcessInstance(String processInstanceId, String deleteReason) {
    boolean isDeleted = true;
    try {
      managementService.executeCommand(
          new BoundedLockWaitCommand(
              Duration.ofSeconds(DELETE_LOCK_WAIT_SECONDS),
              () -> runtimeService.deleteProcessInstance(processInstanceId, deleteReason)));
    } catch (FlowableObjectNotFoundException e) {
      LOG.debug(
          "[WorkflowTerminate] Process instance {} ended before it could be deleted",
          processInstanceId);
    } catch (FlowableOptimisticLockingException e) {
      isDeleted = false;
      logDeleteBlocked(processInstanceId, e);
    } catch (RuntimeException e) {
      // Translates, never swallows: a lock wait reaches here wrapped by Flowable, MyBatis or JDBI,
      // so the cause chain, not the outer type, identifies it.
      if (!isLockConflict(e)) {
        throw e;
      }
      isDeleted = false;
      logDeleteBlocked(processInstanceId, e);
    }
    return isDeleted;
  }

  private static void logDeleteBlocked(String rootProcessInstanceId, RuntimeException cause) {
    LOG.warn(
        "[WorkflowTerminate] Process instance {} is held by a job executing now; it is not deleted",
        rootProcessInstanceId,
        cause);
  }

  private void markTerminated(UUID workflowInstanceId, String auditMessage) {
    workflowInstanceStateRepository.markRunningStatesAsFailed(workflowInstanceId, auditMessage);
    // FINISHED, FAILURE or SUPERSEDED, recorded by a process that ended on its own between the
    // lookup and the delete, is kept. EXCEPTION is also what a failed job attempt records while
    // Flowable retries the job, so it gives way to the administrator's reason.
    WorkflowStatus currentStatus =
        workflowInstanceRepository.getByIdOrNotFound(workflowInstanceId).getStatus();
    if (currentStatus == WorkflowStatus.RUNNING || currentStatus == WorkflowStatus.EXCEPTION) {
      workflowInstanceRepository.markInstanceAsFailed(workflowInstanceId, auditMessage);
    }
  }
}
