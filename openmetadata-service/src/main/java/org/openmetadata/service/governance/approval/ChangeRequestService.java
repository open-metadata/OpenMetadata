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

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Response.Status;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.api.governance.WithdrawChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestOrigin;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.ChangeRevisionStatus;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeRequestDAO;
import org.openmetadata.service.util.PostCommitActionQueue;

/**
 * Owns the change request aggregate. Every mutation locks the entity row first, then the request
 * row, then revision rows, so submission, withdrawal and application serialize on the same order.
 */
public final class ChangeRequestService {
  private static final String UNIQUE_VIOLATION_MYSQL = "23000";
  private static final String UNIQUE_VIOLATION_POSTGRES = "23505";
  private static final List<ChangeRequestStatus> OPEN_STATUSES =
      List.of(ChangeRequestStatus.PENDING, ChangeRequestStatus.APPROVED);

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

  public static ChangeDescription proposedChangeDescription(UUID changeRequestId) {
    ChangeRevision revision = activeRevision(get(changeRequestId));
    return MutationOps.toChangeDescription(revision.getOps(), revision.getBaseEntityVersion());
  }

  public static ChangeRevision activeRevision(ChangeRequest request) {
    return dao().changeRevisionDAO().findById(request.getActiveRevisionId());
  }

  public static void attachTask(UUID changeRequestId, int revisionNumber, UUID taskId) {
    ChangeRequest request = dao().changeRequestDAO().findById(changeRequestId);
    if (request != null && Objects.equals(request.getActiveRevisionNumber(), revisionNumber)) {
      dao().changeRequestDAO().update(request.withTaskId(taskId));
    }
  }

  /**
   * Ends an open request without publishing it. A no-op when the request is already terminal or its
   * active revision is no longer {@code expectedRevision} (null matches any revision). The review
   * task is terminated only for withdrawal/cancellation; rejection and conflict are reached from
   * inside the running workflow, which ends on its own.
   */
  public static ChangeRequest finish(
      UUID id, Integer expectedRevision, ChangeRequestStatus status, String reason) {
    ChangeRequest request = get(id);
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    return repository.executeInTransaction(
        () -> finishLocked(repository, request, expectedRevision, status, reason));
  }

  /** Withdraws the requester's own pending request, provided it is still at the revision they saw. */
  public static ChangeRequest withdraw(UUID id, WithdrawChangeRequest withdraw, String user) {
    if (!user.equals(get(id).getRequestedBy())) {
      throw new ForbiddenException("Only the requester can withdraw this change request");
    }
    String reason =
        withdraw.getReason() == null ? "Withdrawn by the requester" : withdraw.getReason();
    ChangeRequest result =
        finish(id, withdraw.getExpectedRevision(), ChangeRequestStatus.WITHDRAWN, reason);
    if (result.getStatus() != ChangeRequestStatus.WITHDRAWN) {
      throw new ClientErrorException(
          "Change request %s is %s at revision %d and was not withdrawn"
              .formatted(id, result.getStatus().value(), result.getActiveRevisionNumber()),
          Status.CONFLICT);
    }
    return result;
  }

  public static void cancelAllForEntity(UUID entityId, String reason) {
    ChangeRequestDAO requests = changeRequests();
    if (requests != null) {
      for (ChangeRequestStatus open : OPEN_STATUSES) {
        requests
            .listByEntityAndStatus(entityId, open.value())
            .forEach(
                request -> finish(request.getId(), null, ChangeRequestStatus.CANCELLED, reason));
      }
    }
  }

  public static void cancelAllForWorkflow(UUID workflowDefinitionId, String reason) {
    ChangeRequestDAO requests = changeRequests();
    if (requests != null) {
      for (ChangeRequestStatus open : OPEN_STATUSES) {
        requests
            .listByWorkflowAndStatus(workflowDefinitionId, open.value())
            .forEach(
                request -> finish(request.getId(), null, ChangeRequestStatus.CANCELLED, reason));
      }
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
      String reason) {
    repository.getDao().findJsonByIdForUpdate(request.getEntityId(), Include.ALL);
    ChangeRequest locked = dao().changeRequestDAO().findByIdForUpdate(request.getId());
    boolean revisionMatches =
        expectedRevision == null || expectedRevision.equals(locked.getActiveRevisionNumber());
    if (isOpen(locked) && revisionMatches) {
      dao().changeRequestDAO().update(locked.withStatus(status).withStatusReason(reason));
      closeTaskAfterCommit(locked, status, reason);
    }
    return locked;
  }

  private static void closeTaskAfterCommit(
      ChangeRequest request, ChangeRequestStatus status, String reason) {
    UUID taskId = request.getTaskId();
    if (status == ChangeRequestStatus.WITHDRAWN || status == ChangeRequestStatus.CANCELLED) {
      PostCommitActionQueue.runOrDefer(() -> ChangeRequestTasks.closeTask(taskId, reason));
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
    ChangeRequest request = active == null ? create(staged) : supersede(active, staged);
    UUID id = request.getId();
    PostCommitActionQueue.runOrDefer(() -> ChangeRequestDelivery.deliver(id));
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

  private static ChangeRequest supersede(ChangeRequest active, StagedChange staged) {
    ChangeRevision prior = activeRevision(active);
    dao().changeRevisionDAO().updateStatus(prior.withStatus(ChangeRevisionStatus.SUPERSEDED));
    int number = active.getActiveRevisionNumber() + 1;
    List<MutationOp> ops = MutationPlanner.merge(prior.getOps(), staged.ops());
    ChangeRevision next = newRevision(active.getId(), number, staged, ops);
    dao().changeRevisionDAO().insert(next);
    UUID supersededTask = active.getTaskId();
    active
        .withActiveRevisionId(next.getId())
        .withActiveRevisionNumber(number)
        .withWorkflowDefinitionId(staged.workflowDefinitionId())
        .withImpersonatedBy(staged.impersonatedBy())
        .withTaskId(null);
    dao().changeRequestDAO().update(active);
    dao().changeRequestDAO().markDeliveryDue(active.getId(), System.currentTimeMillis());
    PostCommitActionQueue.runOrDefer(
        () ->
            ChangeRequestTasks.closeTask(
                supersededTask, "Superseded by revision %d".formatted(number)));
    return active;
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
