/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.approval;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Response.Status;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.api.governance.OverrideChangeRequest;
import org.openmetadata.schema.api.governance.WithdrawChangeRequest;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeConflict;
import org.openmetadata.schema.governance.changeRequest.ChangeLifecycleEvent;
import org.openmetadata.schema.governance.changeRequest.ChangeOutcome;
import org.openmetadata.schema.governance.changeRequest.ChangeRef;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestOrigin;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestPreview;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.ChangeRevisionStatus;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.LifecycleEventType;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.changeRequest.ReviewPolicy;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeRequestDAO;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.PostCommitActionQueue;

/**
 * Owns the change request aggregate. Every mutation locks the entity row first, then the request
 * row, then revision rows, so submission, withdrawal and application serialize on the same order.
 */
@Slf4j
public final class ChangeRequestService {
  private static final String UNIQUE_VIOLATION_MYSQL = "23000";
  private static final String UNIQUE_VIOLATION_POSTGRES = "23505";
  private static final List<ChangeRequestStatus> OPEN_STATUSES =
      List.of(ChangeRequestStatus.PENDING, ChangeRequestStatus.APPROVED);
  private static final List<String> OPEN_STATUS_VALUES =
      OPEN_STATUSES.stream().map(ChangeRequestStatus::value).toList();

  private ChangeRequestService() {}

  public static ChangeRequest submit(StagedChange staged) {
    EntityRepository<?> repository = Entity.getEntityRepository(staged.entityType());
    try {
      return repository.executeInTransaction(() -> submitLocked(repository, staged));
    } catch (UnableToExecuteStatementException e) {
      throw uniqueViolation(e) ? concurrentSubmission(staged) : e;
    }
  }

  public static ChangeRequest get(UUID id) {
    ChangeRequest request = dao().changeRequestDAO().findById(id);
    if (request == null) {
      throw new NotFoundException("Change request %s not found".formatted(id));
    }
    return request.withActiveRevision(activeRevision(request));
  }

  private static ChangeOutcome outcomeOf(
      String target,
      Set<String> applied,
      Set<String> elsewhere,
      Set<String> superseded,
      Set<String> disagreed,
      Set<String> rejected) {
    ChangeOutcome outcome = ChangeOutcome.PENDING;
    if (applied.contains(target)) {
      outcome = ChangeOutcome.APPLIED;
    } else if (elsewhere.contains(target)) {
      outcome = ChangeOutcome.ALREADY_PUBLISHED;
    } else if (superseded.contains(target)) {
      outcome = ChangeOutcome.SUPERSEDED;
    } else if (disagreed.contains(target)) {
      outcome = ChangeOutcome.NOT_AGREED;
    } else if (rejected.contains(target)) {
      outcome = ChangeOutcome.REJECTED;
    }
    return outcome;
  }

  /** The request as the API reports it: its active revision says where each change stands. */
  public static ChangeRequest report(UUID id) {
    ChangeRequest request = get(id);
    return request.withActiveRevision(reportedRevision(request, request.getActiveRevision()));
  }

  /**
   * The revision with each change's outcome when the request is decided change by change or some
   * of its changes were published by another change, open or ended; any other request reports its
   * revision as stored, since all of its changes share the request's status.
   */
  public static ChangeRevision reportedRevision(ChangeRequest request, ChangeRevision revision) {
    boolean changeByChange =
        ChangeSelection.partialDecisions(request.getReviewPolicy())
            || !nullOrEmpty(request.getAlreadyPublished())
            || !nullOrEmpty(request.getSuperseded());
    return changeByChange ? withOutcomes(request, revision) : revision;
  }

  /**
   * A copy of the revision whose changes say where they stand: applied, rejected by its reviewers,
   * or still pending. The stored revision is not changed.
   */
  public static ChangeRevision withOutcomes(ChangeRequest request, ChangeRevision revision) {
    ChangeRevision reported = revision;
    if (revision != null) {
      ChangeSelection selection = ChangeApplyService.selection(request, revision);
      Set<String> applied = ChangeSelection.targets(selection.applied());
      Set<String> elsewhere = ChangeSelection.targets(selection.publishedElsewhere());
      Set<String> disagreed = ChangeSelection.refTargets(request.getDisagreed());
      Set<String> superseded = ChangeSelection.refTargets(request.getSuperseded());
      Set<String> rejected = ChangeSelection.targets(selection.rejected());
      reported = JsonUtils.deepCopy(revision, ChangeRevision.class);
      reported
          .getOps()
          .forEach(
              op -> {
                String target = MutationPlanner.targetOf(op);
                op.setOutcome(
                    outcomeOf(target, applied, elsewhere, superseded, disagreed, rejected));
              });
    }
    return reported;
  }

  /** The changes of the active revision still waiting for a decision, as a change description. */
  public static ChangeDescription proposedChangeDescription(UUID changeRequestId) {
    ChangeRequest request = get(changeRequestId);
    ChangeRevision revision = activeRevision(request);
    return MutationOps.toChangeDescription(
        ChangeApplyService.selection(request, revision).open(), revision.getBaseEntityVersion());
  }

  public static ChangeRevision activeRevision(ChangeRequest request) {
    return dao().changeRevisionDAO().findById(request.getActiveRevisionId());
  }

  /** The active revision of each request, read in one query and keyed by revision id. */
  public static Map<UUID, ChangeRevision> activeRevisions(List<ChangeRequest> requests) {
    List<String> ids =
        requests.stream()
            .map(ChangeRequest::getActiveRevisionId)
            .filter(Objects::nonNull)
            .map(UUID::toString)
            .distinct()
            .toList();
    Map<UUID, ChangeRevision> revisions = new HashMap<>();
    if (!ids.isEmpty()) {
      dao().changeRevisionDAO().findByIds(ids).forEach(r -> revisions.put(r.getId(), r));
    }
    return revisions;
  }

  /** Every revision of the request, oldest first. */
  public static List<ChangeRevision> revisions(UUID id) {
    return dao().changeRevisionDAO().listByRequest(id);
  }

  /** Every recorded decision on any revision of the request, oldest first. */
  public static List<ApprovalDecision> decisions(UUID id) {
    return dao().approvalDecisionDAO().listByRequest(id);
  }

  /** The request's lifecycle history, in the order it happened. */
  public static List<ChangeLifecycleEvent> events(UUID id) {
    return dao().changeLifecycleEventDAO().listByRequest(id);
  }

  /** What saving {@code patch} on the entity would do under approval gating, without saving it. */
  public static ChangeRequestPreview preview(
      String entityType, UUID entityId, JsonPatch patch, String user) {
    Optional<StagedChange> staged =
        Entity.getEntityRepository(entityType).previewPatch(entityId, user, patch);
    return new ChangeRequestPreview()
        .withEntityType(entityType)
        .withEntityId(entityId)
        .withRequiresApproval(staged.isPresent())
        .withWorkflowDefinitionId(staged.map(StagedChange::workflowDefinitionId).orElse(null))
        .withOps(staged.map(StagedChange::ops).orElse(List.of()));
  }

  /**
   * Links a review task to the revision it reviews. Returns false when the request has ended or
   * moved to a newer revision while the task was being created; that task then has nothing to
   * review and the caller closes it with {@link #closeStaleTask(UUID)}.
   */
  public static boolean attachTask(
      UUID changeRequestId, int revisionNumber, UUID taskId, ReviewPolicy reviewPolicy) {
    ChangeRequest snapshot = dao().changeRequestDAO().findById(changeRequestId);
    boolean reviewable = false;
    if (snapshot != null) {
      EntityRepository<?> repository = Entity.getEntityRepository(snapshot.getEntityType());
      // Read and write under the entity -> request locks, so a revision submitted concurrently is
      // never overwritten by this request's earlier state.
      reviewable =
          repository.executeInTransaction(
              () -> {
                ChangeRequest locked = lockForUpdate(repository, snapshot);
                boolean current =
                    isOpen(locked)
                        && Objects.equals(locked.getActiveRevisionNumber(), revisionNumber);
                if (current) {
                  dao()
                      .changeRequestDAO()
                      .update(locked.withTaskId(taskId).withReviewPolicy(reviewPolicy));
                }
                return current;
              });
    }
    return reviewable;
  }

  /**
   * The open review task of a pending request in workflow run {@code workflowInstanceId}, if any.
   */
  public static UUID openTaskOf(UUID changeRequestId, UUID workflowInstanceId) {
    ChangeRequest request = dao().changeRequestDAO().findById(changeRequestId);
    UUID openTask = null;
    if (request != null && isOpen(request) && request.getTaskId() != null) {
      TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      Task task = tasks.findCommittedTask(request.getTaskId());
      if (task != null
          && !TaskRepository.isTerminalStatus(task.getStatus())
          && Objects.equals(task.getWorkflowInstanceId(), workflowInstanceId)) {
        openTask = task.getId();
      }
    }
    return openTask;
  }

  /**
   * Hands pending requests whose delivery gave up back to the workflow, now that it is deployed or
   * resumed and can receive them. The recovery scan delivers them on its next pass.
   */
  public static void redeliverStuck(UUID workflowDefinitionId) {
    int requeued =
        dao()
            .changeRequestDAO()
            .requeueAttentionRequired(workflowDefinitionId, System.currentTimeMillis());
    if (requeued > 0) {
      LOG.info(
          "[ChangeRequest] Requeued {} stuck change requests for workflow {}",
          requeued,
          workflowDefinitionId);
    }
  }

  /** Closes a review task whose revision can no longer be decided, off the calling thread. */
  public static void closeStaleTask(UUID taskId) {
    AsyncService.getInstance()
        .execute(
            () ->
                ChangeRequestTasks.closeTask(
                    taskId,
                    "The change request is no longer waiting for this review",
                    WorkflowInstance.WorkflowStatus.CANCELLED));
  }

  /**
   * Ends an open request without publishing it. A no-op when the request is already terminal or its
   * active revision is no longer {@code expectedRevision} (null matches any revision). The review
   * task is terminated only for withdrawal/cancellation; rejection and conflict are reached from
   * inside the running workflow, which ends on its own.
   */
  public static ChangeRequest finish(
      UUID id, Integer expectedRevision, ChangeRequestStatus status, String reason) {
    return finish(id, expectedRevision, status, reason, null);
  }

  /** As {@link #finish(UUID, Integer, ChangeRequestStatus, String)}, recording who ended it. */
  public static ChangeRequest finish(
      UUID id, Integer expectedRevision, ChangeRequestStatus status, String reason, String actor) {
    ChangeRequest request = get(id);
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    return repository.executeInTransaction(
        () -> finishLocked(repository, request, expectedRevision, status, reason, actor));
  }

  /**
   * Publishes a pending request without review on an administrator's authority. The override is
   * recorded as a decision on the revision and as a lifecycle event; the change then applies through
   * the normal path, so conflicts with newer values still stop it. The review task is closed.
   */
  public static ChangeRequest override(UUID id, OverrideChangeRequest override, String admin) {
    ChangeRequest request = get(id);
    if (admin.equals(request.getRequestedBy())) {
      throw new ForbiddenException("An administrator cannot override their own change request");
    }
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    ChangeRevision revision;
    try {
      revision =
          repository.executeInTransaction(
              () -> recordOverride(repository, request, override, admin));
    } catch (UnableToExecuteStatementException e) {
      throw uniqueViolation(e) ? notOverridden(request) : e;
    }
    ChangeRequest result = ChangeApplyService.approveAndApply(id, revision.getRevisionNumber());
    UUID taskId = request.getTaskId();
    // A change that conflicts with the current asset is not published; the request stays open
    // with its conflicts, so its review task stays open too.
    boolean published = result.getStatus() == ChangeRequestStatus.APPLIED;
    PostCommitActionQueue.runOrDefer(
        () -> {
          if (published) {
            ChangeRequestTasks.closeTask(
                taskId,
                "Published by %s without review: %s".formatted(admin, override.getReason()));
          } else {
            ChangeRequestTasks.comment(
                taskId,
                "%s tried to publish this change without review, but it conflicts with the current version: %s"
                    .formatted(admin, result.getStatusReason()));
          }
        });
    return result;
  }

  // The open and revision checks run under the request lock, so a concurrent revision or ending
  // cannot slip between the check and the recorded override.
  private static ChangeRevision recordOverride(
      EntityRepository<?> repository,
      ChangeRequest request,
      OverrideChangeRequest override,
      String admin) {
    repository.getDao().findJsonByIdForUpdate(request.getEntityId(), Include.ALL);
    ChangeRequest locked = dao().changeRequestDAO().findByIdForUpdate(request.getId());
    if (!isOpen(locked)
        || !override.getExpectedRevision().equals(locked.getActiveRevisionNumber())) {
      throw notOverridden(locked);
    }
    ChangeRevision revision = activeRevision(locked);
    dao()
        .approvalDecisionDAO()
        .insert(
            new ApprovalDecision()
                .withId(UUID.randomUUID())
                .withChangeRequestId(locked.getId())
                .withRevisionId(revision.getId())
                .withRevisionNumber(revision.getRevisionNumber())
                .withDigest(revision.getDigest())
                .withDecision(DecisionType.OVERRIDE)
                .withDecidedBy(admin)
                .withComment(override.getReason())
                .withDecidedAt(System.currentTimeMillis()));
    ChangeRequestLifecycle.record(
        locked, LifecycleEventType.OVERRIDDEN, locked.getStatus(), admin, override.getReason());
    return revision;
  }

  private static ClientErrorException notOverridden(ChangeRequest request) {
    return new ClientErrorException(
        "Change request %s is %s at revision %d and was not overridden"
            .formatted(
                request.getId(), request.getStatus().value(), request.getActiveRevisionNumber()),
        Status.CONFLICT);
  }

  /**
   * Keeps an open request open but marks why its active revision cannot apply, so its review task
   * shows the conflict and the requester can submit a new revision. A request that has ended is
   * left as it is.
   */
  public static ChangeRequest flagConflicts(
      UUID id, ChangeApplyService.Applicability applicability) {
    ChangeRequest request = get(id);
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    return repository.executeInTransaction(
        () -> {
          ChangeRequest locked = lockForUpdate(repository, request);
          return isOpen(locked) ? flagConflictsLocked(locked, applicability) : locked;
        });
  }

  /** As {@link #flagConflicts}, for a caller that already holds the request lock. */
  static ChangeRequest flagConflictsLocked(
      ChangeRequest locked, ChangeApplyService.Applicability applicability) {
    ChangeRequestStatus from = locked.getStatus();
    boolean newlyFlagged =
        from != ChangeRequestStatus.PENDING
            || !Objects.equals(locked.getStatusReason(), applicability.reason());
    dao()
        .changeRequestDAO()
        .update(
            locked
                .withStatus(ChangeRequestStatus.PENDING)
                .withConflicts(applicability.conflicts())
                .withStatusReason(applicability.reason()));
    if (newlyFlagged) {
      ChangeRequestLifecycle.record(
          locked, LifecycleEventType.CONFLICTED, from, null, applicability.reason());
      UUID taskId = locked.getTaskId();
      String message = conflictMessage(locked, applicability);
      PostCommitActionQueue.runOrDefer(() -> ChangeRequestTasks.comment(taskId, message));
    }
    return locked;
  }

  private static String conflictMessage(
      ChangeRequest request, ChangeApplyService.Applicability applicability) {
    String fields =
        applicability.conflicts().stream()
            .map(ChangeConflict::getField)
            .distinct()
            .collect(Collectors.joining(", "));
    String moved = fields.isEmpty() ? "" : " Changed since submission: %s.".formatted(fields);
    return "%s changed after this request was submitted, so revision %d cannot be applied as it is. %s.%s %s can submit an updated change to continue the review."
        .formatted(
            request.getEntityFullyQualifiedName(),
            request.getActiveRevisionNumber(),
            applicability.reason(),
            moved,
            request.getRequestedBy());
  }

  /** Re-checks the open requests on an asset after it changed, once committed and off-thread. */
  public static void afterEntityChanged(String entityType, UUID entityId) {
    if (entityId != null && GovernanceApprovalRegistry.mayHaveRules(entityType)) {
      PostCommitActionQueue.runOrDefer(
          () -> AsyncService.getInstance().execute(() -> recheckOpenRequests(entityId)));
    }
  }

  static void recheckOpenRequests(UUID entityId) {
    ChangeRequestDAO requests = changeRequests();
    if (requests != null) {
      requests
          .listByEntitiesAndStatuses(
              List.of(entityId.toString()), List.of(ChangeRequestStatus.PENDING.value()))
          .forEach(ChangeRequestService::recheckSafely);
    }
  }

  // After the asset changed, changes of a request the asset has overtaken leave its review: ones it
  // already shows (another request added the same tag, for example) and ones whose field it now
  // holds another value for. The rest of the request stays under review on the same task; with
  // nothing left the request ends and its task is closed. A request that no longer passes
  // validation for another reason is flagged on its task.
  private static void recheckSafely(ChangeRequest request) {
    try {
      ChangeRequest current =
          ChangeApplyService.moved(request).isEmpty() ? request : recordMoved(request);
      ChangeApplyService.Applicability applicability =
          isOpen(current)
              ? ChangeApplyService.applicability(current)
              : new ChangeApplyService.Applicability(List.of(), null);
      if (!applicability.applicable()) {
        flagConflicts(request.getId(), applicability);
      } else if (current.getStatusReason() != null && isOpen(current)) {
        clearConflicts(request.getId());
      }
    } catch (RuntimeException e) {
      LOG.warn("[ChangeRequest] Could not re-check change request {}", request.getId(), e);
    }
  }

  /**
   * Takes the changes the asset has overtaken out of the request's review: they are recorded as
   * already published or superseded, and the review task says so and lists what is left. With
   * nothing left the request ends, Applied when it published part of itself, Superseded when a
   * change was overtaken by another value and Cancelled otherwise, and its task is closed. The asset
   * is read again under the locks, so only what it shows now counts.
   */
  private static ChangeRequest recordMoved(ChangeRequest request) {
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    return repository.executeInTransaction(
        () -> {
          ChangeRequest locked = lockForUpdate(repository, request);
          ChangeRequest result = locked;
          ChangeApplyService.Moved moved =
              isOpen(locked)
                      && Objects.equals(
                          locked.getActiveRevisionNumber(), request.getActiveRevisionNumber())
                  ? ChangeApplyService.moved(locked)
                  : new ChangeApplyService.Moved(List.of(), List.of());
          if (!moved.isEmpty()) {
            dao()
                .changeRequestDAO()
                .update(
                    locked
                        .withAlreadyPublished(
                            withRefs(locked.getAlreadyPublished(), moved.published()))
                        .withSuperseded(withRefs(locked.getSuperseded(), moved.superseded())));
            ChangeSelection selection =
                ChangeApplyService.selection(locked, activeRevision(locked));
            result =
                selection.open().isEmpty()
                    ? endMoved(repository, locked, moved)
                    : noteMoved(locked, moved, selection);
          }
          return result;
        });
  }

  private static List<ChangeRef> withRefs(List<ChangeRef> refs, List<MutationOp> ops) {
    List<ChangeRef> combined = new ArrayList<>(listOrEmpty(refs));
    ops.forEach(op -> combined.add(new ChangeRef().withField(op.getField()).withKey(op.getKey())));
    return combined;
  }

  // What happened to the overtaken changes, as the review task's comment reads it.
  private static String movedNote(ChangeApplyService.Moved moved) {
    List<String> parts = new ArrayList<>();
    if (!moved.published().isEmpty()) {
      parts.add(
          "Another change already published %s."
              .formatted(ChangeSelection.describe(moved.published())));
    }
    if (!moved.superseded().isEmpty()) {
      parts.add(
          "%s changed after this request was submitted, so %s superseded."
              .formatted(
                  ChangeSelection.describe(moved.superseded()),
                  moved.superseded().size() == 1 ? "this change is" : "these changes are"));
    }
    return String.join(" ", parts);
  }

  private static ChangeRequest noteMoved(
      ChangeRequest request, ChangeApplyService.Moved moved, ChangeSelection selection) {
    UUID taskId = request.getTaskId();
    UUID requestId = request.getId();
    String note =
        "%s Still waiting for review: %s."
            .formatted(movedNote(moved), ChangeSelection.describe(selection.open()));
    PostCommitActionQueue.runOrDefer(
        () -> {
          ChangeRequestTasks.comment(taskId, note);
          ChangeRequestTasks.refreshProposedChanges(taskId, requestId);
        });
    return request;
  }

  private static ChangeRequest endMoved(
      EntityRepository<?> repository, ChangeRequest request, ChangeApplyService.Moved moved) {
    String reason = "%s Nothing is left to review.".formatted(movedNote(moved));
    ChangeRequestStatus ending = ChangeRequestStatus.CANCELLED;
    if (ChangeApplyService.isPublished(request)) {
      ending = ChangeRequestStatus.APPLIED;
    } else if (!listOrEmpty(request.getSuperseded()).isEmpty()) {
      ending = ChangeRequestStatus.SUPERSEDED;
    }
    UUID taskId = request.getTaskId();
    PostCommitActionQueue.runOrDefer(() -> ChangeRequestTasks.comment(taskId, reason));
    ChangeRequest ended =
        finishLocked(repository, request, request.getActiveRevisionNumber(), ending, reason, null);
    if (ending == ChangeRequestStatus.APPLIED) {
      PostCommitActionQueue.runOrDefer(
          () ->
              ChangeRequestTasks.closeTask(
                  taskId, reason, WorkflowInstance.WorkflowStatus.FINISHED));
    }
    return ended;
  }

  // The asset no longer conflicts with the revision (for example, the newer value was reverted).
  private static void clearConflicts(UUID id) {
    ChangeRequest request = get(id);
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    repository.executeInTransaction(
        () -> {
          ChangeRequest locked = lockForUpdate(repository, request);
          if (locked.getStatus() == ChangeRequestStatus.PENDING
              && locked.getStatusReason() != null) {
            dao().changeRequestDAO().update(locked.withConflicts(List.of()).withStatusReason(null));
            UUID taskId = locked.getTaskId();
            PostCommitActionQueue.runOrDefer(
                () ->
                    ChangeRequestTasks.comment(
                        taskId, "The change applies to the current version again."));
          }
          return locked;
        });
  }

  private static ChangeRequest lockForUpdate(
      EntityRepository<?> repository, ChangeRequest request) {
    repository.getDao().findJsonByIdForUpdate(request.getEntityId(), Include.ALL);
    return dao().changeRequestDAO().findByIdForUpdate(request.getId());
  }

  /** Withdraws the requester's own pending request, provided it is still at the revision they saw. */
  public static ChangeRequest withdraw(UUID id, WithdrawChangeRequest withdraw, String user) {
    if (!user.equals(get(id).getRequestedBy())) {
      throw new ForbiddenException("Only the requester can withdraw this change request");
    }
    String reason =
        withdraw.getReason() == null ? "Withdrawn by the requester" : withdraw.getReason();
    ChangeRequest result =
        finish(id, withdraw.getExpectedRevision(), ChangeRequestStatus.WITHDRAWN, reason, user);
    if (result.getStatus() != ChangeRequestStatus.WITHDRAWN) {
      throw new ClientErrorException(
          "Change request %s is %s at revision %d and was not withdrawn"
              .formatted(id, result.getStatus().value(), result.getActiveRevisionNumber()),
          Status.CONFLICT);
    }
    return result;
  }

  /** Cancels the open change requests of deleted entities, reading them in one query. */
  public static void cancelForDeletedEntities(List<UUID> entityIds) {
    ChangeRequestDAO requests = changeRequests();
    List<String> ids = entityIds.stream().filter(Objects::nonNull).map(UUID::toString).toList();
    if (requests != null && !ids.isEmpty()) {
      requests
          .listByEntitiesAndStatuses(ids, OPEN_STATUS_VALUES)
          .forEach(
              request ->
                  finish(
                      request.getId(),
                      null,
                      ChangeRequestStatus.CANCELLED,
                      "%s was deleted".formatted(request.getEntityFullyQualifiedName())));
    }
  }

  public static void cancelAllForWorkflow(UUID workflowDefinitionId, String reason) {
    ChangeRequestDAO requests = changeRequests();
    if (requests != null) {
      requests
          .listByWorkflowAndStatuses(workflowDefinitionId, OPEN_STATUS_VALUES)
          .forEach(request -> finish(request.getId(), null, ChangeRequestStatus.CANCELLED, reason));
    }
  }

  // Before the server wires its DAOs (and in DAO-less unit tests) no change request can exist, so
  // lifecycle clean-up on delete has nothing to cancel.
  private static ChangeRequestDAO changeRequests() {
    CollectionDAO dao = dao();
    return dao == null ? null : dao.changeRequestDAO();
  }

  private static ChangeRequest finishLocked(
      EntityRepository<?> repository,
      ChangeRequest request,
      Integer expectedRevision,
      ChangeRequestStatus status,
      String reason,
      String actor) {
    repository.getDao().findJsonByIdForUpdate(request.getEntityId(), Include.ALL);
    ChangeRequest locked = dao().changeRequestDAO().findByIdForUpdate(request.getId());
    boolean revisionMatches =
        expectedRevision == null || expectedRevision.equals(locked.getActiveRevisionNumber());
    if (isOpen(locked) && revisionMatches) {
      ChangeRequestStatus from = locked.getStatus();
      dao().changeRequestDAO().update(locked.withStatus(status).withStatusReason(reason));
      ChangeRequestLifecycle.record(
          locked, ChangeRequestLifecycle.endedAs(status), from, actor, reason);
      closeTaskAfterCommit(locked, status, reason);
    }
    return locked;
  }

  private static void closeTaskAfterCommit(
      ChangeRequest request, ChangeRequestStatus status, String reason) {
    UUID taskId = request.getTaskId();
    if (status == ChangeRequestStatus.WITHDRAWN || status == ChangeRequestStatus.CANCELLED) {
      PostCommitActionQueue.runOrDefer(
          () ->
              ChangeRequestTasks.closeTask(
                  taskId, reason, WorkflowInstance.WorkflowStatus.CANCELLED));
    } else if (status == ChangeRequestStatus.SUPERSEDED) {
      PostCommitActionQueue.runOrDefer(
          () ->
              ChangeRequestTasks.closeTask(
                  taskId, reason, WorkflowInstance.WorkflowStatus.SUPERSEDED));
    }
  }

  static boolean isOpen(ChangeRequest request) {
    return request.getStatus() == ChangeRequestStatus.PENDING
        || request.getStatus() == ChangeRequestStatus.APPROVED;
  }

  private static ChangeRequest submitLocked(EntityRepository<?> repository, StagedChange staged) {
    lockEntityAtBase(repository, staged);
    String key = ChangeRequestKeys.activeInterceptKey(staged.entityId(), staged.requestedBy());
    ChangeRequest active = dao().changeRequestDAO().findByActiveInterceptKeyForUpdate(key);
    UUID supersededTask = active == null ? null : active.getTaskId();
    ChangeRequest request = active == null ? create(staged) : supersede(repository, active, staged);
    UUID id = request.getId();
    int revision = request.getActiveRevisionNumber();
    PostCommitActionQueue.runOrDefer(() -> ChangeRequestMetrics.admission(staged.entityType()));
    // Off the request thread, the review task of a superseded revision is closed and then delivery
    // starts the review workflow up to its new task; the recovery scheduler retries any delivery
    // that does not complete.
    PostCommitActionQueue.runOrDefer(
        () ->
            AsyncService.getInstance()
                .execute(
                    () -> {
                      ChangeRequestTasks.closeTask(
                          supersededTask,
                          "Superseded by revision %d".formatted(revision),
                          WorkflowInstance.WorkflowStatus.SUPERSEDED);
                      ChangeRequestDelivery.deliver(id);
                    }));
    return request;
  }

  private static void lockEntityAtBase(EntityRepository<?> repository, StagedChange staged) {
    String json = repository.getDao().findJsonByIdForUpdate(staged.entityId(), Include.NON_DELETED);
    if (json == null) {
      throw new NotFoundException(
          "%s %s not found".formatted(staged.entityType(), staged.entityId()));
    }
    Double current = JsonUtils.readValue(json, repository.getEntityClass()).getVersion();
    if (!Objects.equals(current, staged.baseVersion())) {
      throw new ClientErrorException(
          "%s %s changed while this change was being submitted; reload and retry"
              .formatted(staged.entityType(), staged.entityFqn()),
          Status.CONFLICT);
    }
  }

  private static ChangeRequest create(StagedChange staged) {
    UUID requestId = UUID.randomUUID();
    ChangeRevision revision = newRevision(requestId, 1, staged, staged.ops());
    ChangeRequest request = newRequest(requestId, staged, revision);
    dao().changeRequestDAO().insert(request);
    dao().changeRevisionDAO().insert(revision);
    ChangeRequestLifecycle.record(
        request, LifecycleEventType.SUBMITTED, null, staged.requestedBy(), null);
    return request;
  }

  private static ChangeRequest newRequest(UUID id, StagedChange staged, ChangeRevision revision) {
    long now = System.currentTimeMillis();
    return new ChangeRequest()
        .withId(id)
        .withEntityType(staged.entityType())
        .withEntityId(staged.entityId())
        .withEntityFullyQualifiedName(staged.entityFqn())
        .withRequestedBy(staged.requestedBy())
        .withImpersonatedBy(staged.impersonatedBy())
        .withOrigin(ChangeRequestOrigin.INTERCEPTED)
        .withWorkflowDefinitionId(staged.workflowDefinitionId())
        .withStatus(ChangeRequestStatus.PENDING)
        .withActiveRevisionId(revision.getId())
        .withActiveRevisionNumber(revision.getRevisionNumber())
        .withCreatedAt(now)
        .withUpdatedAt(now);
  }

  private static ChangeRequest supersede(
      EntityRepository<?> repository, ChangeRequest active, StagedChange staged) {
    ChangeRevision prior = activeRevision(active);
    dao().changeRevisionDAO().updateStatus(prior.withStatus(ChangeRevisionStatus.SUPERSEDED));
    int number = active.getActiveRevisionNumber() + 1;
    List<MutationOp> carried = ChangeApplyService.selection(active, prior).open();
    List<MutationOp> ops =
        againstPublished(
            repository, staged.entityId(), MutationPlanner.merge(carried, staged.ops()));
    ChangeRevision next = newRevision(active.getId(), number, staged, ops);
    dao().changeRevisionDAO().insert(next);
    active
        .withActiveRevisionId(next.getId())
        .withActiveRevisionNumber(number)
        .withWorkflowDefinitionId(staged.workflowDefinitionId())
        .withImpersonatedBy(staged.impersonatedBy())
        .withAlreadyPublished(List.of())
        .withSuperseded(List.of())
        .withDisagreed(List.of())
        .withTaskId(null)
        .withConflicts(List.of())
        .withStatusReason(null);
    dao().changeRequestDAO().update(active);
    ChangeRequestLifecycle.record(
        active,
        LifecycleEventType.REVISED,
        active.getStatus(),
        staged.requestedBy(),
        "Revision %d supersedes revision %d".formatted(number, number - 1));
    dao().changeRequestDAO().markDeliveryDue(active.getId(), System.currentTimeMillis());
    return active;
  }

  // Changes carried over from the superseded revision are restated against the asset as published
  // now, so the new revision is reviewed and applied against the current values.
  private static List<MutationOp> againstPublished(
      EntityRepository<?> repository, UUID entityId, List<MutationOp> ops) {
    List<MutationOp> restated = ops;
    if (MutationPlanner.hasFieldChange(ops)) {
      JsonNode current =
          JsonUtils.valueToTree(ChangeApplyService.readCurrent(repository, entityId, ops));
      restated = MutationPlanner.rebase(current, ops);
    }
    return restated;
  }

  private static ChangeRevision newRevision(
      UUID requestId, int number, StagedChange staged, List<MutationOp> ops) {
    return new ChangeRevision()
        .withId(UUID.randomUUID())
        .withChangeRequestId(requestId)
        .withRevisionNumber(number)
        .withBaseEntityVersion(staged.baseVersion())
        .withOps(ops)
        .withDigest(MutationPlanner.digest(ops))
        .withStatus(ChangeRevisionStatus.ACTIVE)
        .withCreatedBy(staged.requestedBy())
        .withCreatedAt(System.currentTimeMillis());
  }

  // JDBI wraps the driver exception; its SQL state is the only portable duplicate-key signal.
  private static boolean uniqueViolation(UnableToExecuteStatementException e) {
    return e.getCause() instanceof SQLException sql
        && (UNIQUE_VIOLATION_MYSQL.equals(sql.getSQLState())
            || UNIQUE_VIOLATION_POSTGRES.equals(sql.getSQLState()));
  }

  private static ClientErrorException concurrentSubmission(StagedChange staged) {
    return new ClientErrorException(
        "Another change to %s by %s was submitted at the same time; retry"
            .formatted(staged.entityFqn(), staged.requestedBy()),
        Status.CONFLICT);
  }

  static CollectionDAO dao() {
    return Entity.getCollectionDAO();
  }
}
