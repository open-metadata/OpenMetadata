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

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeApplication;
import org.openmetadata.schema.governance.changeRequest.ChangeConflict;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.LifecycleEventType;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.FreshReadScope;

/**
 * Publishes approved change request revisions. Application locks the entity then the request,
 * re-reads the entity bypassing every cache, and never overwrites a gated field that moved since
 * submission. The entity write, version history, change event and application record commit
 * together.
 */
@Slf4j
public final class ChangeApplyService {
  private static final String MOVED = "Newer published values conflict with this change";
  private static final String CONNECTION = "connection";

  private ChangeApplyService() {}

  private record Approval(ChangeRequest request, boolean current, boolean eligible) {}

  public static ChangeRequest approveAndApply(UUID changeRequestId, int revisionNumber) {
    Approval approval = approve(changeRequestId, revisionNumber);
    if (approval.current() && !approval.eligible()) {
      refuse(approval.request(), revisionNumber);
    }
    return approval.current() ? apply(changeRequestId) : approval.request();
  }

  public static ChangeRequest apply(UUID changeRequestId) {
    ChangeRequest request = ChangeRequestService.get(changeRequestId);
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    try (FreshReadScope.Handle fresh = FreshReadScope.enter()) {
      return repository.executeInTransaction(() -> applyBypassingCache(repository, request));
    } catch (IllegalArgumentException | EntityNotFoundException | WebApplicationException e) {
      return ChangeRequestService.flagConflicts(
          changeRequestId, new Applicability(List.of(), notApplicable(e)));
    }
  }

  /**
   * Whether the active revision still applies to the asset as published now: no gated field it
   * changes has moved since submission, and the resulting entity passes the same validation a PATCH
   * runs. Nothing is saved.
   */
  public static Applicability applicability(ChangeRequest request) {
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    Applicability result;
    try (FreshReadScope.Handle fresh = FreshReadScope.enter();
        EntityCacheBypass.Handle bypass = EntityCacheBypass.skip()) {
      ChangeRevision revision = ChangeRequestService.activeRevision(request);
      JsonNode currentTree =
          JsonUtils.valueToTree(readCurrent(repository, request.getEntityId(), revision.getOps()));
      MutationPlanner.ConflictSplit split =
          MutationPlanner.splitConflicts(currentTree, revision.getOps());
      result =
          split.gatedConflicts().isEmpty()
              ? validated(repository, request, currentTree, split)
              : new Applicability(conflictDetails(currentTree, split.gatedConflicts()), MOVED);
    } catch (IllegalArgumentException | EntityNotFoundException | WebApplicationException e) {
      result = new Applicability(List.of(), notApplicable(e));
    }
    return result;
  }

  /** Conflicts and the reason a revision cannot apply; applicable when the reason is null. */
  public record Applicability(List<ChangeConflict> conflicts, String reason) {
    public boolean applicable() {
      return reason == null;
    }
  }

  private static String notApplicable(Exception e) {
    return "This change can no longer be applied: %s".formatted(e.getMessage());
  }

  // Connection secrets are written to the secrets manager while an entity is prepared, so a
  // revision that changes a connection is only checked for moved values here.
  private static Applicability validated(
      EntityRepository<?> repository,
      ChangeRequest request,
      JsonNode currentTree,
      MutationPlanner.ConflictSplit split) {
    if (!MutationPlanner.fieldsOf(split.applicable()).contains(CONNECTION)) {
      JsonPatch patch =
          JsonUtils.getJsonPatch(
              currentTree.toString(),
              MutationPlanner.applyTo(currentTree, split.applicable()).toString());
      repository.validatePatch(request.getEntityId(), request.getRequestedBy(), patch);
    }
    return new Applicability(List.of(), null);
  }

  // The entity is read past every cache inside the transaction; the cache evictions recorded by
  // the write still run after commit, outside this scope.
  private static ChangeRequest applyBypassingCache(
      EntityRepository<?> repository, ChangeRequest request) {
    try (EntityCacheBypass.Handle bypass = EntityCacheBypass.skip()) {
      return applyLocked(repository, request);
    }
  }

  private static Approval approve(UUID id, int revisionNumber) {
    ChangeRequest snapshot = ChangeRequestService.get(id);
    EntityRepository<?> repository = Entity.getEntityRepository(snapshot.getEntityType());
    return repository.executeInTransaction(
        () -> approveLocked(repository, snapshot, revisionNumber));
  }

  private static Approval approveLocked(
      EntityRepository<?> repository, ChangeRequest snapshot, int revisionNumber) {
    repository.getDao().findJsonByIdForUpdate(snapshot.getEntityId(), Include.ALL);
    ChangeRequest request =
        ChangeRequestService.dao().changeRequestDAO().findByIdForUpdate(snapshot.getId());
    boolean current =
        ChangeRequestService.isOpen(request)
            && Objects.equals(request.getActiveRevisionNumber(), revisionNumber);
    boolean eligible =
        current
            && (request.getStatus() == ChangeRequestStatus.APPROVED
                || hasEligibleApproval(request));
    if (eligible && request.getStatus() == ChangeRequestStatus.PENDING) {
      ChangeRequestService.dao()
          .changeRequestDAO()
          .update(request.withStatus(ChangeRequestStatus.APPROVED));
      ChangeRequestLifecycle.record(
          request, LifecycleEventType.APPROVED, ChangeRequestStatus.PENDING, null, null);
    }
    return new Approval(request, current, eligible);
  }

  private static boolean hasEligibleApproval(ChangeRequest request) {
    List<ApprovalDecision> decisions =
        ApprovalDecisionService.decisions(request.getActiveRevisionId());
    boolean rejected = decisions.stream().anyMatch(d -> d.getDecision() == DecisionType.REJECT);
    boolean approved =
        decisions.stream()
            .anyMatch(
                d ->
                    d.getDecision() == DecisionType.APPROVE
                        && !d.getDecidedBy().equals(request.getRequestedBy()));
    // An administrator override publishes without review; it is recorded as its own decision.
    boolean overridden = decisions.stream().anyMatch(d -> d.getDecision() == DecisionType.OVERRIDE);
    return overridden || (approved && !rejected);
  }

  private static void refuse(ChangeRequest request, int revisionNumber) {
    ChangeRequestService.dao().changeRequestDAO().markAttentionRequired(request.getId());
    throw new IllegalStateException(
        "Change request %s revision %d has no eligible approval recorded; it was not applied"
            .formatted(request.getId(), revisionNumber));
  }

  private static ChangeRequest applyLocked(EntityRepository<?> repository, ChangeRequest snapshot) {
    repository.getDao().findJsonByIdForUpdate(snapshot.getEntityId(), Include.NON_DELETED);
    ChangeRequest request =
        ChangeRequestService.dao().changeRequestDAO().findByIdForUpdate(snapshot.getId());
    boolean applicable =
        request.getStatus() == ChangeRequestStatus.APPROVED
            && ChangeRequestService.dao().changeApplicationDAO().findByRequest(request.getId())
                == null;
    return applicable
        ? applyRevision(repository, request, ChangeRequestService.activeRevision(request))
        : request;
  }

  private static ChangeRequest applyRevision(
      EntityRepository<?> repository, ChangeRequest request, ChangeRevision revision) {
    EntityInterface current = readCurrent(repository, request.getEntityId(), revision.getOps());
    JsonNode currentTree = JsonUtils.valueToTree(current);
    MutationPlanner.ConflictSplit split =
        MutationPlanner.splitConflicts(currentTree, revision.getOps());
    return split.gatedConflicts().isEmpty()
        ? publish(repository, request, revision, currentTree, split)
        : markConflicted(request, currentTree, split.gatedConflicts());
  }

  static EntityInterface readCurrent(
      EntityRepository<?> repository, UUID entityId, List<MutationOp> ops) {
    Set<String> relationFields = new TreeSet<>(MutationPlanner.fieldsOf(ops));
    relationFields.retainAll(repository.getAllowedFields());
    return repository.get(
        null,
        entityId,
        repository.getFields(String.join(",", relationFields)),
        Include.NON_DELETED,
        false);
  }

  private static ChangeRequest publish(
      EntityRepository<?> repository,
      ChangeRequest request,
      ChangeRevision revision,
      JsonNode currentTree,
      MutationPlanner.ConflictSplit split) {
    JsonPatch patch =
        JsonUtils.getJsonPatch(
            currentTree.toString(),
            MutationPlanner.applyTo(currentTree, split.applicable()).toString());
    ApprovedApplication approval =
        new ApprovedApplication(
            request.getId(), revision.getId(), request.getEntityId(), request.getRequestedBy());
    EntityInterface published = repository.applyApprovedChange(approval, patch).entity();
    ChangeRequestService.dao()
        .changeApplicationDAO()
        .insert(application(request, revision, published, split.dropped()));
    ChangeRequestStatus from = request.getStatus();
    ChangeRequestService.dao()
        .changeRequestDAO()
        .update(
            request
                .withStatus(ChangeRequestStatus.APPLIED)
                .withStatusReason(null)
                .withConflicts(List.of()));
    ChangeRequestLifecycle.record(request, LifecycleEventType.APPLIED, from, null, null);
    return request;
  }

  private static ChangeApplication application(
      ChangeRequest request,
      ChangeRevision revision,
      EntityInterface published,
      List<MutationOp> dropped) {
    return new ChangeApplication()
        .withId(UUID.randomUUID())
        .withChangeRequestId(request.getId())
        .withRevisionId(revision.getId())
        .withDigest(revision.getDigest())
        .withAppliedBy(request.getRequestedBy())
        .withResultingEntityVersion(published.getVersion())
        .withDroppedOps(dropped)
        .withAppliedAt(System.currentTimeMillis());
  }

  private static ChangeRequest markConflicted(
      ChangeRequest request, JsonNode current, List<MutationOp> conflicts) {
    return ChangeRequestService.flagConflictsLocked(
        request, new Applicability(conflictDetails(current, conflicts), MOVED));
  }

  private static List<ChangeConflict> conflictDetails(
      JsonNode current, List<MutationOp> conflicts) {
    return conflicts.stream()
        .map(
            op ->
                new ChangeConflict()
                    .withField(op.getField())
                    .withBaseValue(op.getBaseValue())
                    .withCurrentValue(String.valueOf(current.get(op.getField())))
                    .withProposedValue(op.getValue()))
        .toList();
  }
}
