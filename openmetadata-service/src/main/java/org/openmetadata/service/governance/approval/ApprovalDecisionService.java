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
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
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
      Integer revisionNumber,
      String comment,
      String user) {
    DecisionType decision = resolution == null ? null : DECISIONS.get(resolution);
    ChangeRequest request =
        decision != null && ChangeRequestTasks.reviewsChangeRequest(task)
            ? ChangeRequestService.dao().changeRequestDAO().findByTaskId(task.getId())
            : null;
    if (request != null) {
      Integer reviewed = revisionNumber == null ? revisionOf(task) : revisionNumber;
      requireRevision(reviewed);
      if (decision == DecisionType.APPROVE) {
        requireApplicable(request);
      }
      EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
      repository.executeInTransaction(
          () ->
              recordLocked(
                  repository,
                  request,
                  new Proposed(decision, reviewed, task.getId(), comment, user)));
    }
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
                  new Proposed(DecisionType.APPROVE, revisionNumber, null, reason, GOVERNANCE_BOT));
            }
          }
          return locked;
        });
  }

  public static List<ApprovalDecision> decisions(UUID revisionId) {
    return ChangeRequestService.dao().approvalDecisionDAO().listByRevision(revisionId);
  }

  private record Proposed(
      DecisionType decision, int revisionNumber, UUID taskId, String comment, String user) {}

  private static ApprovalDecision recordLocked(
      EntityRepository<?> repository, ChangeRequest snapshot, Proposed proposed) {
    repository.getDao().findJsonByIdForUpdate(snapshot.getEntityId(), Include.ALL);
    ChangeRequest request =
        ChangeRequestService.dao().changeRequestDAO().findByIdForUpdate(snapshot.getId());
    requireDecidable(request, proposed);
    ChangeRevision revision = ChangeRequestService.activeRevision(request);
    ApprovalDecision existing = existingDecision(revision.getId(), proposed.user());
    ApprovalDecision result = existing == null ? insert(request, revision, proposed) : existing;
    if (result.getDecision() != proposed.decision()) {
      throw conflict(
          "%s already recorded %s on revision %d"
              .formatted(proposed.user(), result.getDecision().value(), proposed.revisionNumber()));
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

  private static void requireApplicable(ChangeRequest request) {
    ChangeApplyService.Applicability applicability = ChangeApplyService.applicability(request);
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
            .withDecidedAt(System.currentTimeMillis());
    ChangeRequestService.dao().approvalDecisionDAO().insert(decision);
    return decision;
  }

  private static ClientErrorException conflict(String message) {
    return new ClientErrorException(message, Status.CONFLICT);
  }
}
