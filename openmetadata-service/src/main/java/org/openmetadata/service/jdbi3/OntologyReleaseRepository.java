package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.api.data.OntologyReleaseReview;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyApprovalRule;
import org.openmetadata.schema.type.OntologyReleaseEvent;
import org.openmetadata.schema.type.OntologyReleaseEvent.EventType;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.TaskStateConflictException;
import org.openmetadata.service.governance.workflows.OntologyWorkflowDecision;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.ontology.OntologyReleaseReviewReader;
import org.openmetadata.service.ontology.OntologyReview;
import org.openmetadata.service.util.PostCommitActionQueue;
import org.openmetadata.service.util.RestUtil;

@Repository
public final class OntologyReleaseRepository extends OntologyEntityRepository<OntologyRelease> {
  private static final String USER_APPROVAL_TASK = "userApprovalTask";
  private static final int OPEN_REVIEW_SCAN_LIMIT = 1000;

  public OntologyReleaseRepository() {
    super(
        Entity.ONTOLOGY_RELEASE,
        OntologyRelease.class,
        Entity.getCollectionDAO().ontologyReleaseDAO(),
        "/v1/ontologyReleases/",
        "releaseRevision,semanticVersion,releaseNotes,sourceWorkingRevision,ontologyIri,versionIri,encodingVersion,contentDigest,baseReleaseId,memberCount,totalBytes,sealedAt,sealedBy");
  }

  public void recordCapture(final OntologyRelease release) {
    setInheritedFields(release, getFields("owners,reviewers"));
    daoCollection
        .ontologyReleaseDAO()
        .appendEvent(
            event(release, EventType.CAPTURED, release.getSealedBy(), release.getSealedAt()));
    PostCommitActionQueue.runOrDefer(() -> postCreate(release));
  }

  public void recordDecision(final Task task, final OntologyWorkflowDecision decision) {
    decision.requireTarget(task);
    final OntologyRelease release = dao.findEntityById(task.getAbout().getId());
    final EventType type =
        switch (decision.resolution()) {
          case Approved -> EventType.APPROVED;
          case Rejected -> EventType.REJECTED;
          default -> throw new BadRequestException(
              "A release decision requires a completed approval workflow");
        };
    final OntologyReleaseEvent event =
        event(release, type, decision.user(), task.getResolution().getResolvedAt())
            .withTaskId(task.getId())
            .withWorkflowDefinitionId(task.getWorkflowDefinitionId())
            .withWorkflowInstanceId(task.getWorkflowInstanceId())
            .withReviewTarget(decision.target())
            .withVoters(decision.voters())
            .withResolution(task.getResolution());
    daoCollection.ontologyReleaseDAO().appendEvent(event);
  }

  public ResultList<OntologyReleaseEvent> listEvents(
      final UUID releaseId, final int limit, final String after) {
    final OntologyReleaseEvent cursor = after == null ? null : eventCursor(releaseId, after);
    final List<OntologyReleaseEvent> events =
        daoCollection
            .ontologyReleaseDAO()
            .listEvents(
                releaseId,
                cursor == null ? -1 : cursor.getCreatedAt(),
                cursor == null ? "" : cursor.getId().toString(),
                limit + 1)
            .stream()
            .map(json -> JsonUtils.readValue(json, OntologyReleaseEvent.class))
            .toList();
    final List<OntologyReleaseEvent> page =
        List.copyOf(events.subList(0, Math.min(limit, events.size())));
    return new ResultList<>(
        page,
        null,
        events.size() > limit ? page.getLast().getId().toString() : null,
        daoCollection.ontologyReleaseDAO().countEvents(releaseId));
  }

  private OntologyReleaseEvent eventCursor(final UUID releaseId, final String after) {
    final UUID id = UUID.fromString(RestUtil.decodeCursor(after));
    final String json = daoCollection.ontologyReleaseDAO().findEvent(releaseId, id);
    if (json == null) {
      throw new BadRequestException("The event cursor does not belong to this ontology release");
    }
    return JsonUtils.readValue(json, OntologyReleaseEvent.class);
  }

  private static OntologyReleaseEvent event(
      final OntologyRelease release, final EventType type, final String user, final long time) {
    return new OntologyReleaseEvent()
        .withId(UUID.randomUUID())
        .withOntologyId(release.getOntology().getId())
        .withReleaseId(release.getId())
        .withEventType(type)
        .withCreatedAt(time)
        .withCreatedBy(user)
        .withContentDigest(release.getContentDigest());
  }

  public OntologyReleaseMember getMember(
      final UUID releaseId, final MemberKind kind, final UUID memberId) {
    final OntologyReleaseMember member =
        daoCollection.ontologyReleaseDAO().getMember(releaseId, kind.value(), memberId);
    if (member == null) {
      throw new EntityNotFoundException("Ontology release member not found: " + memberId);
    }
    return member;
  }

  public ResultList<OntologyReleaseMember> listMembers(
      final UUID releaseId, final MemberKind kind, final int limit, final String after) {
    final String cursor =
        after == null ? "" : UUID.fromString(RestUtil.decodeCursor(after)).toString();
    final List<OntologyReleaseMember> members =
        daoCollection.ontologyReleaseDAO().listMembers(releaseId, kind.value(), cursor, limit + 1);
    final List<OntologyReleaseMember> page =
        List.copyOf(members.subList(0, Math.min(limit, members.size())));
    return new ResultList<>(
        page,
        null,
        members.size() > limit ? page.getLast().getMemberId().toString() : null,
        daoCollection.ontologyReleaseDAO().countMembers(releaseId, kind.value()));
  }

  @Override
  protected void validateDefinition(final OntologyRelease release) {
    throw immutableContent();
  }

  @Override
  protected EntityStatus initialEntityStatus(final OntologyRelease release) {
    throw immutableContent();
  }

  @Override
  public void storeEntity(final OntologyRelease release, final boolean update) {
    throw immutableContent();
  }

  @Override
  public EntityUpdater getUpdater(
      final OntologyRelease original,
      final OntologyRelease updated,
      final Operation operation,
      final ChangeSource source) {
    throw immutableContent();
  }

  @Override
  protected void preDelete(final OntologyRelease release, final String user) {
    throw immutableContent();
  }

  @Override
  protected <R> R executeEntityWrite(final List<OntologyRelease> releases, final Supplier<R> work) {
    return executeInTransaction(
        () -> {
          releases.stream()
              .map(release -> release.getOntology().getId())
              .distinct()
              .sorted()
              .forEach(
                  id -> {
                    daoCollection.ontologyStateDAO().initialize(id);
                    daoCollection.ontologyStateDAO().lock(id);
                  });
          return work.get();
        });
  }

  public void prepareReview(final Task task) {
    final OntologyRelease entity = reviewEntity(task);
    requireAvailableReview(entity, task);
    if (nullOrEmpty(entity.getReviewers())) {
      throw new BadRequestException("Configure ontology reviewers before submitting for approval");
    }
    final List<EntityReference> reviewers = OntologyReview.eligibleReviewers(entity, task);
    if (reviewers.isEmpty()) {
      throw new BadRequestException(
          "Ontology approval requires a reviewer other than the requester and the author");
    }
    requireReviewWorkflow(task);
    task.setOntologyReview(OntologyReview.target(entity).withApprovalRule(approvalRule(entity)));
    task.setAbout(entity.getEntityReference());
    task.setAssignees(reviewers);
    task.setReviewers(reviewers);
  }

  private static OntologyApprovalRule approvalRule(final OntologyRelease entity) {
    if (entity.getOntology() == null) {
      return OntologyApprovalRule.AnyReviewer;
    }
    final Ontology ontology =
        Entity.getEntity(Entity.ONTOLOGY, entity.getOntology().getId(), "", Include.NON_DELETED);
    return ontology.getApprovalRule() == null
        ? OntologyApprovalRule.AnyReviewer
        : ontology.getApprovalRule();
  }

  public OntologyReleaseReview review(final OntologyRelease release, final String caller) {
    if (release.getReviewTask() == null) {
      throw new EntityNotFoundException(
          "Ontology release " + release.getId() + " has no review task");
    }
    return reader(release, release.getReviewTask(), caller).review();
  }

  /** Open reviews only; a decided review stays readable through {@link #review}. */
  public ResultList<OntologyReleaseReview> listReviews(
      final OntologyReleaseReviewReader.View view,
      final String caller,
      final int limit,
      final String after) {
    final int offset = offset(after);
    final List<OntologyReleaseReview> rows =
        daoCollection
            .ontologyReleaseDAO()
            .listAllByStatus(EntityStatus.IN_REVIEW.value(), OPEN_REVIEW_SCAN_LIMIT)
            .stream()
            .map(json -> JsonUtils.readValue(json, OntologyRelease.class))
            .filter(release -> release.getReviewTask() != null)
            .map(release -> reader(release, release.getReviewTask(), caller))
            .filter(reader -> reader.matches(view))
            .map(OntologyReleaseReviewReader::review)
            .toList();
    return page(rows, offset, limit);
  }

  static ResultList<OntologyReleaseReview> page(
      final List<OntologyReleaseReview> rows, final int offset, final int limit) {
    final int from = Math.min(offset, rows.size());
    final int to = Math.min(offset + limit, rows.size());
    return new ResultList<>(
        rows.subList(from, to),
        offset == 0 ? null : String.valueOf(Math.max(0, offset - limit)),
        to < rows.size() ? String.valueOf(to) : null,
        rows.size());
  }

  static int offset(final String after) {
    try {
      return after == null ? 0 : Integer.parseInt(RestUtil.decodeCursor(after));
    } catch (IllegalArgumentException invalid) {
      throw new BadRequestException("The review list cursor is invalid");
    }
  }

  private OntologyReleaseReviewReader reader(
      final OntologyRelease release, final UUID taskId, final String caller) {
    final TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    final Task task =
        tasks.get(
            null,
            taskId,
            tasks.getFields("assignees,reviewers,createdBy"),
            Include.NON_DELETED,
            false);
    return new OntologyReleaseReviewReader(release, task, caller);
  }

  public void startReview(final Task task) {
    lockReviewTarget(task);
    final OntologyRelease original = reviewEntity(task);
    if (Objects.equals(original.getReviewTask(), task.getId())) {
      return;
    }
    requireAvailableReview(original, task);
    validateReviewTarget(original, task);
    final OntologyRelease updated = JsonUtils.deepCopy(original, entityClass);
    updated.setReviewTask(task.getId());
    updated.setEntityStatus(EntityStatus.IN_REVIEW);
    persistWorkflowState(original, updated, task.getUpdatedBy());
  }

  private void requireAvailableReview(final OntologyRelease entity, final Task task) {
    if (entity.getEntityStatus() == EntityStatus.APPROVED
        || entity.getEntityStatus() == EntityStatus.REJECTED) {
      throw TaskStateConflictException.of("A decided ontology release cannot be reviewed again");
    }
    if (entity.getEntityStatus() == EntityStatus.IN_REVIEW
        && entity.getReviewTask() != null
        && !Objects.equals(entity.getReviewTask(), task.getId())) {
      throw TaskStateConflictException.of("This ontology definition already has an open review");
    }
  }

  public void validateReview(final Task task, final String user) {
    final OntologyRelease entity = requireCurrentReview(task);
    OntologyReview.requireIndependentReviewer(entity, task, user);
    if (nullOrEmpty(entity.getReviewers())) {
      throw new BadRequestException("Ontology reviewers are no longer configured");
    }
    checkUpdatedByReviewer(entity, user);
  }

  public OntologyRelease requireCurrentReview(final Task task) {
    final OntologyRelease entity = reviewEntity(task);
    validateReviewTarget(entity, task);
    if (!Objects.equals(entity.getReviewTask(), task.getId())) {
      throw new BadRequestException("This ontology review has been superseded");
    }
    return entity;
  }

  public void validateRuntimeReview(final Task task) {
    final WorkflowHandler.ApprovalTaskContext context =
        WorkflowHandler.getInstance().approvalTaskContext(task.getId());
    context.voters().forEach(user -> validateReview(task, user));
  }

  public void completeReview(final Task task, final String user) {
    validateReview(task, user);
    final EntityStatus decision =
        switch (task.getStatus()) {
          case Approved -> EntityStatus.APPROVED;
          case Rejected -> EntityStatus.REJECTED;
          default -> throw new BadRequestException(
              "The approval workflow has not decided this review");
        };
    final OntologyRelease original = reviewEntity(task);
    validateReviewTarget(original, task);
    if (original.getEntityStatus() == decision) {
      return;
    }
    final OntologyRelease updated = JsonUtils.deepCopy(original, entityClass);
    updated.setEntityStatus(decision);
    persistWorkflowState(original, updated, user);
  }

  public void cancelReview(final Task task) {
    final String json = lockCancellationTarget(task.getAbout().getId());
    if (json == null) {
      return;
    }
    final OntologyRelease original = JsonUtils.readValue(json, entityClass);
    if (Boolean.TRUE.equals(original.getDeleted())
        || original.getEntityStatus() != EntityStatus.IN_REVIEW
        || !Objects.equals(original.getReviewTask(), task.getId())) {
      return;
    }
    setFieldsInternal(original, getFields("owners,reviewers"));
    setInheritedFields(original, getFields("owners,reviewers"));
    final OntologyRelease updated = JsonUtils.deepCopy(original, entityClass);
    updated.setReviewTask(null);
    updated.setEntityStatus(EntityStatus.DRAFT);
    persistWorkflowState(original, updated, task.getUpdatedBy());
  }

  private String lockCancellationTarget(final UUID id) {
    final String json = dao.findById(dao.getTableName(), id, dao.getCondition(Include.ALL));
    if (json == null) {
      return null;
    }
    // Ownership is immutable; discover it before locking to preserve module-before-definition
    // order.
    final OntologyRelease entity = JsonUtils.readValue(json, entityClass);
    workingState.lock(entity.getOntology() == null ? entity.getId() : entity.getOntology().getId());
    return dao.findJsonByIdForUpdate(id, Include.ALL);
  }

  public void lockReviewTarget(final Task task) {
    final OntologyReviewTarget target = task.getOntologyReview();
    if (target == null
        || target.getOntologyId() == null
        || target.getEntityId() == null
        || task.getAbout() == null
        || !Objects.equals(target.getEntityId(), task.getAbout().getId())) {
      throw new BadRequestException(
          "An ontology review must identify its target and owning ontology");
    }
    // Captured ownership avoids establishing a stale MySQL snapshot before the module lock.
    lockActiveEntity(daoCollection.workflowDefinitionDAO(), task.getWorkflowDefinitionId());
    workingState.lock(target.getOntologyId());
    lockActiveEntity(daoCollection.ontologyEntityDAO(), target.getOntologyId());
    lockActiveEntity(dao, target.getEntityId());
  }

  private static void lockActiveEntity(final EntityDAO<?> dao, final UUID id) {
    dao.jsonToEntity(dao.findJsonByIdForUpdate(id, Include.NON_DELETED), id);
  }

  private void persistWorkflowState(
      final OntologyRelease original, final OntologyRelease updated, final String user) {
    updated.setUpdatedBy(user);
    updated.setUpdatedAt(System.currentTimeMillis());
    new ReleaseUpdater(original, updated).updateWithOptimisticLocking();
  }

  private OntologyRelease reviewEntity(final Task task) {
    final UUID id = task.getAbout() == null ? null : task.getAbout().getId();
    if (id == null) {
      throw new BadRequestException("An ontology approval task must identify its target");
    }
    final OntologyRelease entity =
        get(null, id, getFields("owners,reviewers"), Include.NON_DELETED, false);
    if (entity.getOntology() != null) {
      daoCollection
          .ontologyEntityDAO()
          .findEntityById(entity.getOntology().getId(), Include.NON_DELETED);
    }
    return entity;
  }

  private void validateReviewTarget(final OntologyRelease entity, final Task task) {
    OntologyReview.validateTarget(entity, task.getOntologyReview());
    requireRetainedReviewContent(entity, task.getOntologyReview());
  }

  private void requireRetainedReviewContent(
      final OntologyRelease entity, final OntologyReviewTarget target) {
    if (!Objects.equals(entity.getVersion(), target.getEntityVersion())) {
      final OntologyRelease submitted =
          getVersion(entity.getId(), target.getEntityVersion().toString());
      OntologyReview.validateTarget(submitted, target);
    }
  }

  private static WorkflowDefinition requireReviewWorkflow(final Task task) {
    if (task.getWorkflowDefinitionId() == null || !WorkflowHandler.isInitialized()) {
      throw new BadRequestException("An active approval workflow is required for ontology review");
    }
    final WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    final WorkflowDefinition workflow =
        repository.get(
            null,
            task.getWorkflowDefinitionId(),
            repository.getFields("*"),
            Include.NON_DELETED,
            false);
    if (Boolean.TRUE.equals(workflow.getSuspended())
        || !WorkflowHandler.getInstance().isDeployed(workflow)) {
      throw new BadRequestException("The ontology approval workflow is unavailable");
    }
    if (listOrEmpty(workflow.getNodes()).stream()
        .noneMatch(node -> USER_APPROVAL_TASK.equals(node.getSubType()))) {
      throw new BadRequestException(
          "Ontology review requires a workflow with a user approval task");
    }
    return workflow;
  }

  private class ReleaseUpdater extends EntityUpdater {
    ReleaseUpdater(final OntologyRelease original, final OntologyRelease updated) {
      super(original, updated, Operation.PUT, null);
      setUseOptimisticLocking(true);
    }

    @Override
    void updateEntityStatus(final boolean consolidatingChanges) {}

    @Override
    protected void entitySpecificUpdate(final boolean consolidatingChanges) {
      recordChange("reviewTask", original.getReviewTask(), updated.getReviewTask());
      recordChange("entityStatus", original.getEntityStatus(), updated.getEntityStatus());
    }
  }

  private static BadRequestException immutableContent() {
    return new BadRequestException(
        "Ontology releases are immutable; capture a new working revision");
  }
}
