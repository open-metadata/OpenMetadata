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

import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response.Status;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeDecisionType;
import org.openmetadata.schema.governance.changeRequest.ChangeRef;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.ImpersonationContext;

/**
 * Records a reviewer's decision on one exact change request revision, in the catalog, before the
 * workflow task completes. The catalog record is what authorizes application; Flowable only routes.
 */
public final class ApprovalDecisionService {
  private static final Map<TaskResolutionType, DecisionType> DECISIONS =
      Map.of(
          TaskResolutionType.Approved,
          DecisionType.APPROVE,
          TaskResolutionType.Rejected,
          DecisionType.REJECT);

  private ApprovalDecisionService() {}

  public static void recordForTask(
      Task task,
      TaskResolutionType resolution,
      ChangeRequestReview review,
      String comment,
      String user) {
    DecisionType decision = resolution == null ? null : DECISIONS.get(resolution);
    ChangeRequest request =
        decision != null && ChangeRequestTasks.reviewsChangeRequest(task)
            ? ChangeRequestService.dao().changeRequestDAO().findByTaskId(task.getId())
            : null;
    if (request != null) {
      ChangeRequestReview reviewed = review == null ? ChangeRequestReview.ofRevision(null) : review;
      Integer revisionNumber = reviewed.revision() == null ? revisionOf(task) : reviewed.revision();
      requireRevision(revisionNumber);
      Choice choice = choiceOf(request, decision, reviewed);
      if (decision == DecisionType.APPROVE) {
        requireApplicable(request, approvedWithPriorReviews(request, choice, user));
      }
      EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
      repository.executeInTransaction(
          () ->
              recordLocked(
                  repository,
                  request,
                  new Proposed(decision, revisionNumber, task.getId(), comment, user, choice)));
    }
  }

  /**
   * The changes a decision approves and rejects. Without per-change decisions it covers the whole
   * revision and both lists stay unset; a decision that approves every change is recorded the same
   * way.
   */
  private record Choice(
      List<ChangeRef> approved, List<ChangeRef> rejected, List<MutationOp> approvedOps) {}

  private static List<MutationOp> approvedWithPriorReviews(
      ChangeRequest request, Choice choice, String user) {
    List<ApprovalDecision> reviews = new ArrayList<>(decisions(request.getActiveRevisionId()));
    reviews.add(
        new ApprovalDecision()
            .withDecision(DecisionType.APPROVE)
            .withDecidedBy(user)
            .withApprovedChanges(choice.approved())
            .withRejectedChanges(choice.rejected()));
    return ChangeSelection.of(choice.approvedOps(), reviews, request.getRequestedBy()).approved();
  }

  private static Choice choiceOf(
      ChangeRequest request, DecisionType decision, ChangeRequestReview review) {
    List<MutationOp> ops = ChangeRequestService.activeRevision(request).getOps();
    Choice choice = new Choice(null, null, ops);
    if (review.perChange()) {
      Map<String, MutationOp> byTarget = new LinkedHashMap<>();
      ops.forEach(op -> byTarget.put(MutationPlanner.targetOf(op), op));
      List<ChangeRef> approved = new ArrayList<>();
      List<ChangeRef> rejected = new ArrayList<>();
      Set<String> decided = new HashSet<>();
      for (ChangeDecision change : review.changeDecisions()) {
        if (change == null || change.getField() == null || change.getDecision() == null) {
          throw new BadRequestException("Each change decision requires a field and a decision");
        }
        String target = MutationPlanner.targetOf(change.getField(), change.getKey());
        requireChange(byTarget, decided, target, change);
        ChangeRef ref = new ChangeRef().withField(change.getField()).withKey(change.getKey());
        (change.getDecision() == ChangeDecisionType.APPROVE ? approved : rejected).add(ref);
      }
      choice = choiceFor(decision, approved, rejected, byTarget, decided);
    }
    return choice;
  }

  private static void requireChange(
      Map<String, MutationOp> byTarget, Set<String> decided, String target, ChangeDecision change) {
    if (!byTarget.containsKey(target)) {
      throw new BadRequestException(
          "The change request has no change to %s %s"
              .formatted(change.getField(), Objects.toString(change.getKey(), ""))
              .trim());
    }
    if (!decided.add(target)) {
      throw new BadRequestException(
          "The change to %s %s is decided more than once"
              .formatted(change.getField(), Objects.toString(change.getKey(), ""))
              .trim());
    }
  }

  private static Choice choiceFor(
      DecisionType decision,
      List<ChangeRef> approved,
      List<ChangeRef> rejected,
      Map<String, MutationOp> byTarget,
      Set<String> decided) {
    boolean everyChangeDecided = decided.size() == byTarget.size();
    if (approved.isEmpty() && !(everyChangeDecided && decision == DecisionType.REJECT)) {
      throw new BadRequestException(
          "Approve at least one change, or reject all of them by rejecting the task");
    }
    if (!approved.isEmpty() && decision != DecisionType.APPROVE) {
      throw new BadRequestException("A task that approves changes is resolved as Approved");
    }
    Choice choice = new Choice(null, null, List.copyOf(byTarget.values()));
    if (!approved.isEmpty() && (!rejected.isEmpty() || !everyChangeDecided)) {
      byTarget.forEach(
          (target, op) -> {
            if (!decided.contains(target)) {
              rejected.add(new ChangeRef().withField(op.getField()).withKey(op.getKey()));
            }
          });
      List<MutationOp> approvedOps =
          approved.stream()
              .map(ref -> byTarget.get(MutationPlanner.targetOf(ref.getField(), ref.getKey())))
              .toList();
      choice = new Choice(approved, rejected.isEmpty() ? null : rejected, approvedOps);
    }
    return choice;
  }

  /**
   * Records the approval a review step gives on its own when no one but the requester could review
   * the change request: the asset has no reviewers or owners and there is no other admin. Commit
   * then publishes the revision, and the decision explains why no one reviewed it.
   */
  public static void recordAutomaticApproval(UUID changeRequestId, int revisionNumber) {
    ChangeRequest request = ChangeRequestService.get(changeRequestId);
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    String reason =
        "Auto-approved: %s has no reviewers, owners or other admins who can review it"
            .formatted(request.getEntityFullyQualifiedName());
    repository.executeInTransaction(
        () -> {
          repository.getDao().findJsonByIdForUpdate(request.getEntityId(), Include.ALL);
          ChangeRequest locked =
              ChangeRequestService.dao().changeRequestDAO().findByIdForUpdate(request.getId());
          if (locked.getStatus() == ChangeRequestStatus.PENDING
              && Objects.equals(locked.getActiveRevisionNumber(), revisionNumber)) {
            ChangeRevision revision = ChangeRequestService.activeRevision(locked);
            if (existingDecision(revision.getId(), GOVERNANCE_BOT) == null) {
              insert(
                  locked,
                  revision,
                  new Proposed(
                      DecisionType.APPROVE,
                      revisionNumber,
                      null,
                      reason,
                      GOVERNANCE_BOT,
                      new Choice(null, null, revision.getOps())));
            }
          }
          return locked;
        });
  }

  public static List<ApprovalDecision> decisions(UUID revisionId) {
    return ChangeRequestService.dao().approvalDecisionDAO().listByRevision(revisionId);
  }

  private record Proposed(
      DecisionType decision,
      int revisionNumber,
      UUID taskId,
      String comment,
      String user,
      Choice choice) {}

  private static ApprovalDecision recordLocked(
      EntityRepository<?> repository, ChangeRequest snapshot, Proposed proposed) {
    repository.getDao().findJsonByIdForUpdate(snapshot.getEntityId(), Include.ALL);
    ChangeRequest request =
        ChangeRequestService.dao().changeRequestDAO().findByIdForUpdate(snapshot.getId());
    requireDecidable(request, proposed);
    ChangeRevision revision = ChangeRequestService.activeRevision(request);
    ApprovalDecision existing = existingDecision(revision.getId(), proposed.user());
    ApprovalDecision result = existing == null ? insert(request, revision, proposed) : existing;
    if (result.getDecision() != proposed.decision()
        || !sameChanges(result.getApprovedChanges(), proposed.choice().approved())
        || !sameChanges(result.getRejectedChanges(), proposed.choice().rejected())) {
      throw conflict(
          "%s already recorded %s on revision %d"
              .formatted(proposed.user(), result.getDecision().value(), proposed.revisionNumber()));
    }
    return result;
  }

  private static boolean sameChanges(List<ChangeRef> stored, List<ChangeRef> proposed) {
    Set<ChangeRef> storedChanges = stored == null ? Set.of() : Set.copyOf(stored);
    Set<ChangeRef> proposedChanges = proposed == null ? Set.of() : Set.copyOf(proposed);
    return storedChanges.equals(proposedChanges);
  }

  private static void requireDecidable(ChangeRequest request, Proposed proposed) {
    requirePending(request);
    requireActiveRevision(request, proposed.revisionNumber());
    requireIndependentReviewer(request, proposed.user());
  }

  private static void requirePending(ChangeRequest request) {
    if (request.getStatus() != ChangeRequestStatus.PENDING) {
      throw conflict(
          "Change request %s is %s and can no longer be reviewed"
              .formatted(request.getId(), request.getStatus().value()));
    }
  }

  private static void requireActiveRevision(ChangeRequest request, int revisionNumber) {
    if (!Objects.equals(request.getActiveRevisionNumber(), revisionNumber)) {
      throw conflict(
          "You reviewed revision %d but the active revision is %d; reload the task"
              .formatted(revisionNumber, request.getActiveRevisionNumber()));
    }
  }

  private static void requireIndependentReviewer(ChangeRequest request, String user) {
    if (user.equals(request.getRequestedBy())) {
      throw new ForbiddenException("You cannot approve or reject your own change request");
    }
    if (ImpersonationContext.getImpersonatedBy() != null) {
      throw new ForbiddenException("Change requests cannot be reviewed through impersonation");
    }
  }

  // Task payloads are schema-driven untyped maps; CreateTask stamps the revision each review task
  // decides, and every revision gets its own task, so the task names the revision on screen.
  private static Integer revisionOf(Task task) {
    Integer revision = null;
    if (task.getPayload() instanceof Map<?, ?> payload
        && payload.get(ChangePreviewUtils.CHANGE_REQUEST_REVISION_KEY) instanceof Number number) {
      revision = number.intValue();
    }
    return revision;
  }

  private static void requireApplicable(ChangeRequest request, List<MutationOp> approvedOps) {
    if (approvedOps.isEmpty()) {
      return;
    }
    ChangeApplyService.Applicability applicability =
        ChangeApplyService.applicability(request, approvedOps);
    if (!applicability.applicable()) {
      ChangeRequestService.flagConflicts(request.getId(), applicability);
      throw conflict(
          "%s. %s must submit an updated change before it can be approved."
              .formatted(applicability.reason(), request.getRequestedBy()));
    }
  }

  private static void requireRevision(Integer revisionNumber) {
    if (revisionNumber == null) {
      throw new BadRequestException(
          "changeRequestRevision is required to resolve a task that reviews a change request");
    }
  }

  private static ApprovalDecision existingDecision(UUID revisionId, String user) {
    return decisions(revisionId).stream()
        .filter(d -> user.equals(d.getDecidedBy()))
        .findFirst()
        .orElse(null);
  }

  private static ApprovalDecision insert(
      ChangeRequest request, ChangeRevision revision, Proposed proposed) {
    ApprovalDecision decision =
        new ApprovalDecision()
            .withId(UUID.randomUUID())
            .withChangeRequestId(request.getId())
            .withRevisionId(revision.getId())
            .withRevisionNumber(revision.getRevisionNumber())
            .withDigest(revision.getDigest())
            .withDecision(proposed.decision())
            .withDecidedBy(proposed.user())
            .withTaskId(proposed.taskId())
            .withComment(proposed.comment())
            .withApprovedChanges(proposed.choice().approved())
            .withRejectedChanges(proposed.choice().rejected())
            .withDecidedAt(System.currentTimeMillis());
    ChangeRequestService.dao().approvalDecisionDAO().insert(decision);
    return decision;
  }

  private static ClientErrorException conflict(String message) {
    return new ClientErrorException(message, Status.CONFLICT);
  }
}
