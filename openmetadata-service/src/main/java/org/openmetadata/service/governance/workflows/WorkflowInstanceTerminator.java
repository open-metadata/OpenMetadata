package org.openmetadata.service.governance.workflows;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.sql.SQLException;
import java.sql.SQLTransactionRollbackException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.FlowableObjectNotFoundException;
import org.flowable.common.engine.api.FlowableOptimisticLockingException;
import org.flowable.engine.ManagementService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.job.service.impl.asyncexecutor.AsyncExecutor;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.WorkflowInstanceConflictException;
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
 * <p>Every termination first records a stop request on the WorkflowInstance, which a batch sink
 * reads before its next sub-batch and the periodic-batch fetch loop before its next batch, on
 * whichever server runs them; a process left running then ends on its own and is recorded as
 * FAILURE with the request's reason. A lock held by another server cannot be told apart from a
 * dead server's lock, so such a process is deleted. If its job is in fact still executing, the
 * request stops it at its next batch boundary; should the delete instead have to wait for rows
 * that job holds, the process is left running once the database gives up the wait.
 *
 * <p>The OpenMetadata tasks still open for the process tree's user tasks are cancelled before the
 * delete, which removes the Flowable tasks that link to them.
 */
@Slf4j
public class WorkflowInstanceTerminator {

  /** Postgres {@code lock_not_available}, raised when a lock_timeout expires. */
  static final String POSTGRES_LOCK_NOT_AVAILABLE = "55P03";

  private final RuntimeService runtimeService;
  private final ManagementService managementService;
  private final String serverLockOwner;
  private final WorkflowTaskCloser taskCloser;
  private final WorkflowInstanceRepository workflowInstanceRepository;
  private final WorkflowInstanceStateRepository workflowInstanceStateRepository;

  public record TerminationRequest(UUID workflowInstanceId, String reason, String requestedBy) {
    String auditMessage() {
      return nullOrEmpty(reason) || reason.isBlank()
          ? "Terminated by %s".formatted(requestedBy)
          : "Terminated by %s: %s".formatted(requestedBy, reason.strip());
    }
  }

  /**
   * What a termination did: {@code stopRequested} means a job was executing, so the instance is
   * still running and stops at its next batch boundary.
   */
  public record TerminationOutcome(WorkflowInstance workflowInstance, boolean stopRequested) {}

  /** The process engine of this server; {@code serverLockOwner} is its async executor's lock owner. */
  public record Engine(
      RuntimeService runtimeService, ManagementService managementService, String serverLockOwner) {}

  public WorkflowInstanceTerminator(
      Engine engine,
      WorkflowTaskCloser taskCloser,
      WorkflowInstanceRepository workflowInstanceRepository,
      WorkflowInstanceStateRepository workflowInstanceStateRepository) {
    this.runtimeService = engine.runtimeService();
    this.managementService = engine.managementService();
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
    List<String> rootIds = findRootProcessInstanceIds(workflowInstanceId);
    requireTerminable(workflowInstance, rootIds);
    List<String> processTreeIds = collectProcessTree(rootIds, this::findChildProcessInstanceIds);
    requestStop(request);
    boolean isDeleted = false;
    if (countJobsLockedByThisServer(processTreeIds) == 0) {
      isDeleted = deleteProcessTree(request, rootIds, processTreeIds);
    }
    if (!isDeleted) {
      LOG.info(
          "[WorkflowTerminate] Workflow instance {} has a job executing; stop requested",
          workflowInstanceId);
    }
    return new TerminationOutcome(
        workflowInstanceRepository.getByIdOrNotFound(workflowInstanceId), !isDeleted);
  }

  /** Deletes the process tree; {@code false} when a job executing now holds rows it needs. */
  private boolean deleteProcessTree(
      TerminationRequest request, List<String> rootIds, List<String> processTreeIds) {
    processTreeIds.forEach(
        id -> taskCloser.closeOpenTasks(id, request.requestedBy(), request.auditMessage()));
    boolean isDeleted = rootIds.stream().allMatch(this::deleteRootProcessInstance);
    if (isDeleted) {
      markTerminated(request.workflowInstanceId(), request.auditMessage());
      LOG.info(
          "[WorkflowTerminate] Workflow instance {} terminated; deleted process instances {}",
          request.workflowInstanceId(),
          processTreeIds);
    }
    return isDeleted;
  }

  private void requestStop(TerminationRequest request) {
    workflowInstanceRepository.requestStop(
        request.workflowInstanceId(),
        new StopRequest(
            true, request.auditMessage(), request.requestedBy(), System.currentTimeMillis()));
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

  private List<String> findRootProcessInstanceIds(UUID workflowInstanceId) {
    return runtimeService
        .createProcessInstanceQuery()
        .processInstanceBusinessKey(workflowInstanceId.toString())
        .excludeSubprocesses(true)
        .list()
        .stream()
        .map(ProcessInstance::getId)
        .toList();
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
  private boolean deleteRootProcessInstance(String rootProcessInstanceId) {
    boolean isDeleted = true;
    try {
      runtimeService.deleteProcessInstance(rootProcessInstanceId, Workflow.TERMINATED_BY_ADMIN);
    } catch (FlowableObjectNotFoundException e) {
      LOG.debug(
          "[WorkflowTerminate] Process instance {} ended before it could be deleted",
          rootProcessInstanceId);
    } catch (FlowableOptimisticLockingException e) {
      isDeleted = false;
      logDeleteBlocked(rootProcessInstanceId, e);
    } catch (RuntimeException e) {
      // Translates, never swallows: a lock wait reaches here wrapped by Flowable, MyBatis or JDBI,
      // so the cause chain, not the outer type, identifies it.
      if (!isLockConflict(e)) {
        throw e;
      }
      isDeleted = false;
      logDeleteBlocked(rootProcessInstanceId, e);
    }
    return isDeleted;
  }

  private static void logDeleteBlocked(String rootProcessInstanceId, RuntimeException cause) {
    LOG.warn(
        "[WorkflowTerminate] Process instance {} is held by a job executing now; requesting a stop",
        rootProcessInstanceId,
        cause);
  }

  private void markTerminated(UUID workflowInstanceId, String auditMessage) {
    workflowInstanceStateRepository.markRunningStatesAsFailed(workflowInstanceId, auditMessage);
    // A process that ended on its own between the lookup and the delete has already recorded
    // its real outcome, which is kept.
    WorkflowStatus currentStatus =
        workflowInstanceRepository.getByIdOrNotFound(workflowInstanceId).getStatus();
    if (currentStatus == WorkflowStatus.RUNNING) {
      workflowInstanceRepository.markInstanceAsFailed(workflowInstanceId, auditMessage);
    }
  }
}
