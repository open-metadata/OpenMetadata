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
import jakarta.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.changeRequest.ChangeApplication;
import org.openmetadata.schema.governance.changeRequest.ChangeConflict;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
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

  // waiting: a request decided change by change with nothing agreed to publish yet; its commit
  // step publishes nothing and the workflow goes back to the review.
  private record Approval(
      ChangeRequest request, boolean current, boolean eligible, boolean waiting) {}

  public static ChangeRequest approveAndApply(UUID changeRequestId, int revisionNumber) {
    Approval approval = approve(changeRequestId, revisionNumber);
    if (approval.current() && !approval.eligible() && !approval.waiting()) {
      refuse(approval.request(), revisionNumber);
    }
    return approval.current() && approval.eligible() ? apply(changeRequestId) : approval.request();
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
    ChangeRevision revision = ChangeRequestService.activeRevision(request);
    return applicability(request, selection(request, revision).open());
  }

  /** Whether {@code ops}, changes of the active revision, still apply to the asset as published. */
  public static Applicability applicability(ChangeRequest request, List<MutationOp> ops) {
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    Applicability result;
    try (FreshReadScope.Handle fresh = FreshReadScope.enter();
        EntityCacheBypass.Handle bypass = EntityCacheBypass.skip()) {
      JsonNode currentTree =
          JsonUtils.valueToTree(readCurrent(repository, request.getEntityId(), ops));
      MutationPlanner.ConflictSplit split = MutationPlanner.splitConflicts(currentTree, ops);
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
    ChangeSelection selection =
        current ? selection(request, ChangeRequestService.activeRevision(request)) : null;
    boolean eligible =
        current
            && (request.getStatus() == ChangeRequestStatus.APPROVED
                || !selection.toApply().isEmpty()
                || (selection.settled() && selection.anyApproved()));
    // A request decided change by change stays Pending while some of its changes still wait for a
    // decision. Any other request is Approved once its approval step approves: its review is over,
    // and changes nobody agreed on are dropped.
    boolean partial = ChangeSelection.partialDecisions(request.getReviewPolicy());
    if (eligible
        && request.getStatus() == ChangeRequestStatus.PENDING
        && (selection.settled() || !partial)) {
      ChangeRequestService.dao()
          .changeRequestDAO()
          .update(request.withStatus(ChangeRequestStatus.APPROVED));
      ChangeRequestLifecycle.record(
          request, LifecycleEventType.APPROVED, ChangeRequestStatus.PENDING, null, null);
    }
    boolean waiting = current && partial && !selection.settled();
    return new Approval(request, current, eligible, waiting);
  }

  /**
   * Where each change of {@code revision} stands for {@code request}. An Approved request that is
   * not decided change by change has finished its review, so nothing of it is still pending.
   */
  static ChangeSelection selection(ChangeRequest request, ChangeRevision revision) {
    ChangeSelection selection =
        ChangeSelection.of(
            revision.getOps(),
            ApprovalDecisionService.decisions(revision.getId()),
            request.getRequestedBy(),
            request.getReviewPolicy(),
            decidedTargets(revision),
            ChangeSelection.refTargets(request.getAlreadyPublished()),
            droppedTargets(request));
    boolean reviewEnded =
        request.getStatus() == ChangeRequestStatus.APPROVED
            && !ChangeSelection.partialDecisions(request.getReviewPolicy());
    return reviewEnded ? selection.closed() : selection;
  }

  // Changes that leave the review without a rejection: its reviewers could not agree on them, or
  // their field was published with another value after the request was submitted.
  private static Set<String> droppedTargets(ChangeRequest request) {
    Set<String> dropped = new HashSet<>(ChangeSelection.refTargets(request.getDisagreed()));
    dropped.addAll(ChangeSelection.refTargets(request.getSuperseded()));
    return dropped;
  }

  // Changes an application already settled: published, or dropped because a newer value of an
  // ungated field won. An application recorded without its changes published the whole revision.
  private static Set<String> decidedTargets(ChangeRevision revision) {
    Set<String> targets = new HashSet<>();
    for (ChangeApplication application :
        ChangeRequestService.dao().changeApplicationDAO().listByRevision(revision.getId())) {
      if (nullOrEmpty(application.getAppliedOps()) && nullOrEmpty(application.getDroppedOps())) {
        targets.addAll(ChangeSelection.targets(revision.getOps()));
      }
      targets.addAll(ChangeSelection.targets(listOrEmpty(application.getAppliedOps())));
      targets.addAll(ChangeSelection.targets(listOrEmpty(application.getDroppedOps())));
    }
    return targets;
  }

  /**
   * Open changes of a request the asset as published has overtaken: {@code published} it already
   * shows, for example a tag another request added; {@code superseded} it holds another value for,
   * because the field was published after the request was submitted.
   */
  public record Moved(List<MutationOp> published, List<MutationOp> superseded) {
    public boolean isEmpty() {
      return published.isEmpty() && superseded.isEmpty();
    }
  }

  /** The open changes of the request the asset as published has overtaken. */
  static Moved moved(ChangeRequest request) {
    EntityRepository<?> repository = Entity.getEntityRepository(request.getEntityType());
    Moved moved = new Moved(List.of(), List.of());
    try (FreshReadScope.Handle fresh = FreshReadScope.enter();
        EntityCacheBypass.Handle bypass = EntityCacheBypass.skip()) {
      List<MutationOp> open =
          selection(request, ChangeRequestService.activeRevision(request)).open();
      if (!open.isEmpty()) {
        JsonNode current =
            JsonUtils.valueToTree(readCurrent(repository, request.getEntityId(), open));
        List<MutationOp> published =
            open.stream().filter(op -> MutationPlanner.alreadyPublished(current, op)).toList();
        List<MutationOp> rest = open.stream().filter(op -> !published.contains(op)).toList();
        moved =
            new Moved(published, MutationPlanner.splitConflicts(current, rest).gatedConflicts());
      }
    }
    return moved;
  }

  /** Whether any part of the request has been published, under any of its revisions. */
  public static boolean isPublished(ChangeRequest request) {
    return publishedCount(request.getId()) > 0;
  }

  /** How many times part of the request has been published. */
  public static int publishedCount(UUID changeRequestId) {
    return ChangeRequestService.dao().changeApplicationDAO().countByRequest(changeRequestId);
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
            || request.getStatus() == ChangeRequestStatus.PENDING;
    return applicable
        ? applyRevision(repository, request, ChangeRequestService.activeRevision(request))
        : request;
  }

  // Publishes the changes the reviewers agreed on and not yet published. Changes still waiting
  // for a decision keep the request Pending on the same revision; once none are left it ends.
  private static ChangeRequest applyRevision(
      EntityRepository<?> repository, ChangeRequest request, ChangeRevision revision) {
    ChangeSelection selection = selection(request, revision);
    ChangeRequest result;
    if (!selection.toApply().isEmpty()) {
      EntityInterface current = readCurrent(repository, request.getEntityId(), selection.toApply());
      JsonNode currentTree = JsonUtils.valueToTree(current);
      MutationPlanner.ConflictSplit split =
          MutationPlanner.splitConflicts(currentTree, selection.toApply());
      result =
          split.gatedConflicts().isEmpty()
              ? publish(repository, request, revision, currentTree, split, selection)
              : markConflicted(request, currentTree, split.gatedConflicts());
    } else if (selection.settled()) {
      result = finishSettled(request, selection);
    } else {
      result = request;
    }
    return result;
  }

  // A request that published part of itself, under this revision or an earlier one, ends Applied.
  private static ChangeRequest finishSettled(ChangeRequest request, ChangeSelection selection) {
    return selection.anyApproved() || isPublished(request)
        ? finishApplied(request, selection)
        : ChangeRequestService.finish(
            request.getId(),
            request.getActiveRevisionNumber(),
            ChangeRequestStatus.REJECTED,
            "Every change was rejected");
  }

  /**
   * Drops the changes its reviewers rejected. When changes still wait for a decision the request
   * stays Pending on the same revision; otherwise it ends Rejected, or Applied when part of it was
   * published earlier.
   */
  public static ChangeRequest discard(UUID changeRequestId, int revisionNumber, String reason) {
    ChangeRequest snapshot = ChangeRequestService.get(changeRequestId);
    EntityRepository<?> repository = Entity.getEntityRepository(snapshot.getEntityType());
    return repository.executeInTransaction(
        () -> discardLocked(repository, snapshot, revisionNumber, reason));
  }

  private static ChangeRequest discardLocked(
      EntityRepository<?> repository, ChangeRequest snapshot, int revisionNumber, String reason) {
    repository.getDao().findJsonByIdForUpdate(snapshot.getEntityId(), Include.ALL);
    ChangeRequest request =
        ChangeRequestService.dao().changeRequestDAO().findByIdForUpdate(snapshot.getId());
    ChangeRequest result = request;
    if (ChangeRequestService.isOpen(request)
        && Objects.equals(request.getActiveRevisionNumber(), revisionNumber)) {
      ChangeSelection selection = selection(request, ChangeRequestService.activeRevision(request));
      if (!selection.settled() && ChangeSelection.partialDecisions(request.getReviewPolicy())) {
        ChangeRequestLifecycle.record(
            request,
            LifecycleEventType.PARTIALLY_APPLIED,
            request.getStatus(),
            null,
            outcome(selection));
      } else if (!selection.applied().isEmpty() || isPublished(request)) {
        result = finishApplied(request, selection);
      } else {
        result =
            ChangeRequestService.finish(
                request.getId(), revisionNumber, ChangeRequestStatus.REJECTED, reason);
      }
    }
    return result;
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
      MutationPlanner.ConflictSplit split,
      ChangeSelection selection) {
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
        .insert(application(request, revision, published, split.applicable(), split.dropped()));
    ChangeSelection after = selection(request, revision);
    return after.settled() ? finishApplied(request, after) : continuePending(request, after);
  }

  // Part of the revision is published and the rest waits for its reviewers on the same task.
  private static ChangeRequest continuePending(ChangeRequest request, ChangeSelection selection) {
    ChangeRequestStatus from = request.getStatus();
    ChangeRequestService.dao()
        .changeRequestDAO()
        .update(
            request
                .withStatus(ChangeRequestStatus.PENDING)
                .withStatusReason(null)
                .withConflicts(List.of()));
    ChangeRequestLifecycle.record(
        request, LifecycleEventType.PARTIALLY_APPLIED, from, null, outcome(selection));
    return request;
  }

  static String outcome(ChangeSelection selection) {
    List<String> parts = new ArrayList<>();
    if (!selection.applied().isEmpty()) {
      parts.add("applied: %s".formatted(ChangeSelection.describe(selection.applied())));
    }
    if (!selection.rejected().isEmpty()) {
      parts.add("rejected: %s".formatted(ChangeSelection.describe(selection.rejected())));
    }
    if (!selection.open().isEmpty()) {
      parts.add("still pending: %s".formatted(ChangeSelection.describe(selection.open())));
    }
    return String.join("; ", parts);
  }

  private static ChangeRequest finishApplied(ChangeRequest request, ChangeSelection selection) {
    ChangeRequestStatus from = request.getStatus();
    ChangeRequestService.dao()
        .changeRequestDAO()
        .update(
            request
                .withStatus(ChangeRequestStatus.APPLIED)
                .withStatusReason(null)
                .withConflicts(List.of()));
    ChangeRequestLifecycle.record(
        request,
        LifecycleEventType.APPLIED,
        from,
        null,
        selection.rejected().isEmpty() ? null : outcome(selection));
    return request;
  }

  private static ChangeApplication application(
      ChangeRequest request,
      ChangeRevision revision,
      EntityInterface published,
      List<MutationOp> applied,
      List<MutationOp> dropped) {
    return new ChangeApplication()
        .withId(UUID.randomUUID())
        .withChangeRequestId(request.getId())
        .withRevisionId(revision.getId())
        .withDigest(revision.getDigest())
        .withAppliedBy(request.getRequestedBy())
        .withResultingEntityVersion(published.getVersion())
        .withAppliedOps(applied)
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
