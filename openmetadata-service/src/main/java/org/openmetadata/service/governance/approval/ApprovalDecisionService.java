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
import org.openmetadata.service.util.PostCommitActionQueue;

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

  /**
   * What a reviewer's decision means for the workflow waiting on the task. {@code NONE}: the task
   * does not decide a change request change by change, so it resolves as requested. {@code WAIT}:
   * the vote is recorded but no change is agreed yet, so the task stays open. The partial outcomes
   * leave the task through the {@code partialApprove} or {@code partialReject} edge and come back to
   * it with the changes still pending; {@code APPROVE} and {@code REJECT} end the review.
   */
  public enum ReviewOutcome {
    NONE(null),
    WAIT(null),
    PARTIAL_APPROVE("partialApprove"),
    PARTIAL_REJECT("partialReject"),
    APPROVE(null),
    REJECT(null);

    /** The approval node's outgoing edge condition a partial outcome leaves through. */
    private final String transition;

    ReviewOutcome(String transition) {
      this.transition = transition;
    }

    public String transition() {
      return transition;
    }

    public boolean partial() {
      return transition != null;
    }
  }

  public static ReviewOutcome recordForTask(
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
    ReviewOutcome outcome = ReviewOutcome.NONE;
    if (request != null) {
      ChangeRequestReview reviewed = review == null ? ChangeRequestReview.ofRevision(null) : review;
      Integer revisionNumber = reviewed.revision() == null ? revisionOf(task) : reviewed.revision();
      requireRevision(revisionNumber);
      ChangeRevision revision = ChangeRequestService.activeRevision(request);
      ChangeSelection before = ChangeApplyService.selection(request, revision);
      Choice choice = choiceOf(request, revision, before, decision, reviewed, user);
      if (decision == DecisionType.APPROVE) {
        requireApplicable(request, choice.approvedOps());
      }
      EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
      outcome =
          repository.executeInTransaction(
              () ->
                  recordLocked(
                      repository,
                      request,
                      new Proposed(
                          decision,
                          revisionNumber,
                          task.getId(),
                          comment,
                          user,
                          choice,
                          reviewed)));
    }
    return outcome;
  }

  static ReviewOutcome outcomeOf(ChangeSelection before, ChangeSelection after) {
    ReviewOutcome outcome;
    if (after.settled()) {
      outcome = after.anyApproved() ? ReviewOutcome.APPROVE : ReviewOutcome.REJECT;
    } else if (!after.toApply().isEmpty()) {
      outcome = ReviewOutcome.PARTIAL_APPROVE;
    } else if (after.rejected().size() > before.rejected().size()) {
      outcome = ReviewOutcome.PARTIAL_REJECT;
    } else {
      outcome = ReviewOutcome.WAIT;
    }
    return outcome;
  }

  /**
   * The changes a decision approves and rejects. Without per-change decisions it covers the whole
   * revision and both lists stay unset. {@code approvedOps} are the open changes it approves.
   */
  private record Choice(
      List<ChangeRef> approved,
      List<ChangeRef> rejected,
      List<MutationOp> approvedOps,
      boolean repeat) {
    Choice(List<ChangeRef> approved, List<ChangeRef> rejected, List<MutationOp> approvedOps) {
      this(approved, rejected, approvedOps, false);
    }
  }

  private static Choice choiceOf(
      ChangeRequest request,
      ChangeRevision revision,
      ChangeSelection before,
      DecisionType decision,
      ChangeRequestReview review,
      String user) {
    Choice choice = new Choice(null, null, before.open());
    if (!review.perChange()
        && ChangeSelection.partialDecisions(request.getReviewPolicy())
        && !before.toApply().isEmpty()) {
      throw conflict(
          "Agreed changes of this request are being published; reload the task and decide the rest");
    }
    if (!review.perChange() && decidesChangeByChange(revision, user)) {
      throw conflict(
          "You already decided changes of revision %d one by one; decide the rest the same way"
              .formatted(revision.getRevisionNumber()));
    }
    if (review.perChange()) {
      choice =
          isRepeat(revision, user, decision, review)
              ? repeated(review)
              : perChangeChoice(request, revision, before, decision, review, user);
    }
    return choice;
  }

  private static Choice perChangeChoice(
      ChangeRequest request,
      ChangeRevision revision,
      ChangeSelection before,
      DecisionType decision,
      ChangeRequestReview review,
      String user) {
    // Decided change by change, a change agreed on and waiting to be published is no longer open
    // to votes; otherwise every change not yet published or dropped is.
    Map<String, MutationOp> open = new LinkedHashMap<>();
    (ChangeSelection.partialDecisions(request.getReviewPolicy()) ? before.pending() : before.open())
        .forEach(op -> open.put(MutationPlanner.targetOf(op), op));
    Set<String> known = ChangeSelection.targets(revision.getOps());
    Set<String> decidedBefore = decidedBy(revision, user);
    List<ChangeRef> approved = new ArrayList<>();
    List<ChangeRef> rejected = new ArrayList<>();
    List<MutationOp> approvedOps = new ArrayList<>();
    Set<String> decided = new HashSet<>();
    for (ChangeDecision change : review.changeDecisions()) {
      String target = requireChange(change, known, open, decidedBefore, decided);
      ChangeRef ref = new ChangeRef().withField(change.getField()).withKey(change.getKey());
      if (change.getDecision() == ChangeDecisionType.APPROVE) {
        approved.add(ref);
        approvedOps.add(open.get(target));
      } else {
        rejected.add(ref);
      }
    }
    requireConsistent(request, decision, approved, decided, open);
    return new Choice(
        approved.isEmpty() ? null : approved, rejected.isEmpty() ? null : rejected, approvedOps);
  }

  private static String requireChange(
      ChangeDecision change,
      Set<String> known,
      Map<String, MutationOp> open,
      Set<String> decidedBefore,
      Set<String> decided) {
    if (change == null || change.getField() == null || change.getDecision() == null) {
      throw new BadRequestException("Each change decision requires a field and a decision");
    }
    String target = MutationPlanner.targetOf(change.getField(), change.getKey());
    String named =
        "%s %s".formatted(change.getField(), Objects.toString(change.getKey(), "")).trim();
    if (!known.contains(target)) {
      throw new BadRequestException("The change request has no change to %s".formatted(named));
    }
    if (!decided.add(target)) {
      throw new BadRequestException("The change to %s is decided more than once".formatted(named));
    }
    if (!open.containsKey(target)) {
      throw conflict("The change to %s is already decided".formatted(named));
    }
    if (decidedBefore.contains(target)) {
      throw conflict("You already decided the change to %s".formatted(named));
    }
    return target;
  }

  // Without partial decisions a review decides every open change at once; with them, a decision
  // that approves anything is an approval and one that only rejects is a rejection.
  private static void requireConsistent(
      ChangeRequest request,
      DecisionType decision,
      List<ChangeRef> approved,
      Set<String> decided,
      Map<String, MutationOp> open) {
    if (!ChangeSelection.partialDecisions(request.getReviewPolicy())
        && !decided.containsAll(open.keySet())) {
      throw new BadRequestException(
          "This review step decides every change at once: approve or reject each of them");
    }
    if (!approved.isEmpty() && decision != DecisionType.APPROVE) {
      throw new BadRequestException("A task that approves changes is resolved as Approved");
    }
    if (approved.isEmpty() && decision != DecisionType.REJECT) {
      throw new BadRequestException("A task that only rejects changes is resolved as Rejected");
    }
  }

  // A reviewer resubmitting exactly what they already recorded (for example a retry after the
  // workflow failed to move) repeats that decision instead of being refused.
  private static boolean isRepeat(
      ChangeRevision revision, String user, DecisionType decision, ChangeRequestReview review) {
    Set<String> approved = new HashSet<>();
    Set<String> rejected = new HashSet<>();
    boolean wellFormed = true;
    for (ChangeDecision change : review.changeDecisions()) {
      wellFormed &= change != null && change.getField() != null && change.getDecision() != null;
      if (wellFormed) {
        String target = MutationPlanner.targetOf(change.getField(), change.getKey());
        (change.getDecision() == ChangeDecisionType.APPROVE ? approved : rejected).add(target);
      }
    }
    return wellFormed
        && decisions(revision.getId()).stream()
            .filter(earlier -> user.equals(earlier.getDecidedBy()))
            .filter(earlier -> earlier.getDecision() == decision)
            .anyMatch(
                earlier ->
                    approved.equals(targetsOf(earlier.getApprovedChanges()))
                        && rejected.equals(targetsOf(earlier.getRejectedChanges())));
  }

  private static Set<String> targetsOf(List<ChangeRef> refs) {
    Set<String> targets = new HashSet<>();
    listOrEmpty(refs)
        .forEach(ref -> targets.add(MutationPlanner.targetOf(ref.getField(), ref.getKey())));
    return targets;
  }

  private static Choice repeated(ChangeRequestReview review) {
    List<ChangeRef> approved = new ArrayList<>();
    List<ChangeRef> rejected = new ArrayList<>();
    for (ChangeDecision change : review.changeDecisions()) {
      ChangeRef ref = new ChangeRef().withField(change.getField()).withKey(change.getKey());
      (change.getDecision() == ChangeDecisionType.APPROVE ? approved : rejected).add(ref);
    }
    return new Choice(
        approved.isEmpty() ? null : approved,
        rejected.isEmpty() ? null : rejected,
        List.of(),
        true);
  }

  private static boolean decidesChangeByChange(ChangeRevision revision, String user) {
    return decisions(revision.getId()).stream()
        .filter(earlier -> user.equals(earlier.getDecidedBy()))
        .anyMatch(earlier -> !isWholeRevision(earlier));
  }

  private static boolean isWholeRevision(ApprovalDecision decision) {
    return nullOrEmpty(decision.getApprovedChanges()) && nullOrEmpty(decision.getRejectedChanges());
  }

  // Changes the reviewer already decided on this revision; a decision on the whole revision decides
  // every one of its changes.
  private static Set<String> decidedBy(ChangeRevision revision, String user) {
    Set<String> targets = new HashSet<>();
    for (ApprovalDecision earlier : decisions(revision.getId())) {
      if (user.equals(earlier.getDecidedBy()) && isWholeRevision(earlier)) {
        targets.addAll(ChangeSelection.targets(revision.getOps()));
      } else if (user.equals(earlier.getDecidedBy())) {
        listOrEmpty(earlier.getApprovedChanges())
            .forEach(ref -> targets.add(MutationPlanner.targetOf(ref.getField(), ref.getKey())));
        listOrEmpty(earlier.getRejectedChanges())
            .forEach(ref -> targets.add(MutationPlanner.targetOf(ref.getField(), ref.getKey())));
      }
    }
    return targets;
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
            if (existingWholeDecision(revision.getId(), GOVERNANCE_BOT) == null) {
              insert(
                  locked,
                  revision,
                  new Proposed(
                      DecisionType.APPROVE,
                      revisionNumber,
                      null,
                      reason,
                      GOVERNANCE_BOT,
                      new Choice(null, null, revision.getOps()),
                      null));
            }
          }
          return locked;
        });
  }

  public static List<ApprovalDecision> decisions(UUID revisionId) {
    return ChangeRequestService.dao().approvalDecisionDAO().listByRevision(revisionId);
  }

  // review: what the reviewer submitted, checked again under the lock; null for decisions the
  // server records itself.
  private record Proposed(
      DecisionType decision,
      int revisionNumber,
      UUID taskId,
      String comment,
      String user,
      Choice choice,
      ChangeRequestReview review) {}

  // A reviewer deciding change by change may submit several decisions on a revision; a decision on
  // the whole revision is recorded once per reviewer, and repeating it is a no-op.
  // The outcome is read under the same locks as the decision, so two reviewers deciding at once
  // each see the other's vote in the order the database records them.
  private static ReviewOutcome recordLocked(
      EntityRepository<?> repository, ChangeRequest snapshot, Proposed submitted) {
    repository.getDao().findJsonByIdForUpdate(snapshot.getEntityId(), Include.ALL);
    ChangeRequest request =
        ChangeRequestService.dao().changeRequestDAO().findByIdForUpdate(snapshot.getId());
    requireDecidable(request, submitted);
    ChangeRevision revision = ChangeRequestService.activeRevision(request);
    ChangeSelection before = ChangeApplyService.selection(request, revision);
    // Checked again under the lock, so two submissions of one reviewer never both count.
    Proposed proposed =
        submitted.review() == null
            ? submitted
            : new Proposed(
                submitted.decision(),
                submitted.revisionNumber(),
                submitted.taskId(),
                submitted.comment(),
                submitted.user(),
                choiceOf(
                    request,
                    revision,
                    before,
                    submitted.decision(),
                    submitted.review(),
                    submitted.user()),
                submitted.review());
    boolean wholeRevision =
        proposed.choice().approved() == null && proposed.choice().rejected() == null;
    ApprovalDecision existing =
        wholeRevision ? existingWholeDecision(revision.getId(), proposed.user()) : null;
    if (existing != null && existing.getDecision() != proposed.decision()) {
      throw conflict(
          "%s already recorded %s on revision %d"
              .formatted(
                  proposed.user(), existing.getDecision().value(), proposed.revisionNumber()));
    }
    if (existing == null && !proposed.choice().repeat()) {
      insert(request, revision, proposed);
    }
    return ChangeSelection.partialDecisions(request.getReviewPolicy())
        ? outcomeOf(before, afterDisagreements(request, revision))
        : ReviewOutcome.NONE;
  }

  // A vote can leave changes out of reach of agreement: they are recorded as disagreed and not
  // published, the review task says who voted which way, and review of the rest goes on.
  private static ChangeSelection afterDisagreements(
      ChangeRequest request, ChangeRevision revision) {
    ChangeSelection after = ChangeApplyService.selection(request, revision);
    List<ApprovalDecision> decisions = decisions(revision.getId());
    List<MutationOp> outOfReach =
        ReviewDisagreement.outOfReach(
            after,
            decisions,
            request.getReviewPolicy(),
            ChangeRequestTasks.reviewersOf(request.getTaskId()),
            request.getRequestedBy());
    ChangeSelection result = after;
    if (!outOfReach.isEmpty()) {
      List<ChangeRef> disagreed = new ArrayList<>(listOrEmpty(request.getDisagreed()));
      outOfReach.forEach(
          op -> disagreed.add(new ChangeRef().withField(op.getField()).withKey(op.getKey())));
      ChangeRequestService.dao().changeRequestDAO().update(request.withDisagreed(disagreed));
      String note = ReviewDisagreement.describe(outOfReach, decisions, request.getRequestedBy());
      UUID taskId = request.getTaskId();
      PostCommitActionQueue.runOrDefer(() -> ChangeRequestTasks.comment(taskId, note));
      result = ChangeApplyService.selection(request, revision);
    }
    return result;
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
    ChangeApplyService.Applicability applicability =
        approvedOps.isEmpty()
            ? new ChangeApplyService.Applicability(List.of(), null)
            : ChangeApplyService.applicability(request, approvedOps);
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

  private static ApprovalDecision existingWholeDecision(UUID revisionId, String user) {
    return decisions(revisionId).stream()
        .filter(d -> user.equals(d.getDecidedBy()))
        .filter(d -> nullOrEmpty(d.getApprovedChanges()) && nullOrEmpty(d.getRejectedChanges()))
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
