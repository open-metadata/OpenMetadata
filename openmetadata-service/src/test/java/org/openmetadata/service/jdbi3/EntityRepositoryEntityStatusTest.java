package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.governance.EntityLifecycle;
import org.openmetadata.service.governance.workflows.StageOwnership;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityRepositoryEntityStatusTest {

  private static final String REVIEWER = "alice";
  private static final String NON_REVIEWER = "bob";
  private static final String REVIEWING_TEAM = "metric_stewards";
  private static final String STAGE_WORKFLOW = "MetricApprovalWorkflow";
  private static final String EXCLUDED_METRIC = "internal_metric";

  private CollectionDAO.MetricDAO metricDAO;

  private static class TestMetricRepo extends EntityRepository<Metric> {
    TestMetricRepo(CollectionDAO.MetricDAO dao) {
      super("metrics", Entity.METRIC, Metric.class, dao, "", "");
    }

    @Override
    protected void setFields(Metric entity, Fields fields, RelationIncludes r) {}

    @Override
    protected void clearFields(Metric entity, Fields fields) {}

    @Override
    protected void prepare(Metric entity, boolean update) {}

    @Override
    protected void storeEntity(Metric entity, boolean update) {}

    @Override
    protected void storeRelationships(Metric entity) {}
  }

  /** Starts new metrics in Draft, which must be approved before it can be deprecated. */
  private static class ReviewedMetricRepo extends TestMetricRepo {
    ReviewedMetricRepo(CollectionDAO.MetricDAO dao) {
      super(dao);
      defaultEntityStatus = EntityStatus.DRAFT;
      entityLifecycle =
          new EntityLifecycle(
              Map.of(
                  EntityStatus.DRAFT, Set.of(EntityStatus.APPROVED),
                  EntityStatus.APPROVED, Set.of(EntityStatus.DEPRECATED),
                  EntityStatus.DEPRECATED, Set.of()));
    }
  }

  /** Lets only a reviewer delete a metric while it is in review. */
  private static class ReviewerDeletedMetricRepo extends TestMetricRepo {
    ReviewerDeletedMetricRepo(CollectionDAO.MetricDAO dao) {
      super(dao);
      onlyReviewersDeleteInReview = true;
    }
  }

  /** A type whose stage something other than workflows drives, as registration drives AI assets. */
  private static class RegistrationDrivenMetricRepo extends TestMetricRepo {
    RegistrationDrivenMetricRepo(CollectionDAO.MetricDAO dao) {
      super(dao);
      workflowsOwnEntityStatus = false;
    }
  }

  /** One active workflow owns the stage of every metric its trigger filter does not exclude. */
  private static class StageWorkflowOwnership implements StageOwnership {
    @Override
    public List<String> owningStageOf(String entityType) {
      return List.of(STAGE_WORKFLOW);
    }

    @Override
    public Optional<String> owningStageOf(String entityType, EntityInterface entity) {
      return EXCLUDED_METRIC.equals(entity.getName())
          ? Optional.empty()
          : Optional.of(STAGE_WORKFLOW);
    }
  }

  @BeforeEach
  void setUp() {
    Entity.setCollectionDAO(mock(CollectionDAO.class));
    Entity.setJobDAO(null);
    Entity.setSearchRepository(null);
    Entity.setEntityRelationshipRepository(null);
    metricDAO = mock(CollectionDAO.MetricDAO.class);
    registerNoUsersFound();
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
    Entity.cleanup();
  }

  @Test
  void newEntityStartsInTheStageItsRequestAskedFor() {
    Metric metric = metric().withEntityStatus(EntityStatus.IN_REVIEW);

    new TestMetricRepo(metricDAO).assignInitialEntityStatus(metric);

    assertEquals(EntityStatus.IN_REVIEW, metric.getEntityStatus());
  }

  @Test
  void newEntityWithoutAStageStartsInItsTypesDefaultStage() {
    Metric ingested = metric();
    Metric reviewed = metric();

    new TestMetricRepo(metricDAO).assignInitialEntityStatus(ingested);
    new ReviewedMetricRepo(metricDAO).assignInitialEntityStatus(reviewed);

    assertEquals(EntityStatus.APPROVED, ingested.getEntityStatus());
    assertEquals(EntityStatus.DRAFT, reviewed.getEntityStatus());
  }

  @Test
  void newEntityInAStageItsTypeDoesNotUseIsRejected() {
    Metric inReview = metric().withEntityStatus(EntityStatus.IN_REVIEW);

    assertThrows(
        BadRequestException.class,
        () -> new ReviewedMetricRepo(metricDAO).assignInitialEntityStatus(inReview));
  }

  @Test
  void newEntityAskingForAStageAWorkflowOwnsStartsInItsTypesStage() {
    TestMetricRepo repo = ownedByStageWorkflow(new ReviewedMetricRepo(metricDAO));
    Metric owned = metric().withEntityStatus(EntityStatus.APPROVED);
    Metric excluded = metric().withName(EXCLUDED_METRIC).withEntityStatus(EntityStatus.APPROVED);

    repo.assignInitialEntityStatus(owned);
    repo.assignInitialEntityStatus(excluded);

    assertEquals(EntityStatus.DRAFT, owned.getEntityStatus());
    assertEquals(
        EntityStatus.APPROVED,
        excluded.getEntityStatus(),
        "A metric the workflow's filter excludes keeps the stage it asked for");
  }

  @Test
  void owningWorkflowCanCreateAnEntityInTheStageItOwns() {
    TestMetricRepo repo = ownedByStageWorkflow(new ReviewedMetricRepo(metricDAO));
    Metric createdByWorkflow =
        metric().withEntityStatus(EntityStatus.APPROVED).withUpdatedBy(GOVERNANCE_BOT);

    repo.assignInitialEntityStatus(createdByWorkflow);

    assertEquals(EntityStatus.APPROVED, createdByWorkflow.getEntityStatus());
  }

  @Test
  void updateThatOmitsTheStageKeepsTheStoredStage() {
    Metric original = metric().withEntityStatus(EntityStatus.APPROVED);
    Metric updated = metric().withId(original.getId()).withEntityStatus(null);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new TestMetricRepo(metricDAO), original, updated);

    updater.updateEntityStatus(false);

    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
    assertTrue(updater.changeDescription.getFieldsUpdated().isEmpty());
  }

  @Test
  void updateThatChangesTheStageRecordsTheChange() {
    Metric original = metric().withEntityStatus(EntityStatus.DRAFT);
    Metric updated = metric().withId(original.getId()).withEntityStatus(EntityStatus.APPROVED);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new TestMetricRepo(metricDAO), original, updated);

    updater.updateEntityStatus(false);

    FieldChange change = updater.changeDescription.getFieldsUpdated().getFirst();
    assertEquals(Entity.FIELD_ENTITY_STATUS, change.getName());
    assertEquals(EntityStatus.DRAFT, change.getOldValue());
    assertEquals(EntityStatus.APPROVED, change.getNewValue());
  }

  @Test
  void entityTypeCanRejectAStageTransition() {
    Metric original = metric().withEntityStatus(EntityStatus.DRAFT);
    Metric updated = metric().withId(original.getId()).withEntityStatus(EntityStatus.DEPRECATED);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new ReviewedMetricRepo(metricDAO), original, updated);

    assertThrows(BadRequestException.class, () -> updater.updateEntityStatus(false));
  }

  @Test
  void entitySavedWithoutAStageCanTakeOnlyAStageOfItsTypesLifecycle() {
    TestMetricRepo repo = new ReviewedMetricRepo(metricDAO);
    Metric unstaged = metric().withEntityStatus(null);

    assertThrows(
        BadRequestException.class,
        () ->
            newUpdater(repo, unstaged, movedBy(unstaged, EntityStatus.IN_REVIEW, REVIEWER))
                .updateEntityStatus(false));
    assertDoesNotThrow(
        () ->
            newUpdater(repo, unstaged, movedBy(unstaged, EntityStatus.DEPRECATED, REVIEWER))
                .updateEntityStatus(false));
  }

  @Test
  void memoryStageChangesFollowTheMemoryLifecycle() {
    ContextMemoryRepository repo = new ContextMemoryRepository();
    ContextMemory archived = memory(EntityStatus.ARCHIVED);

    assertThrows(
        BadRequestException.class,
        () ->
            newUpdater(repo, archived, memoryMovedTo(archived, EntityStatus.DRAFT))
                .updateEntityStatus(false));
    assertDoesNotThrow(
        () ->
            newUpdater(repo, archived, memoryMovedTo(archived, EntityStatus.APPROVED))
                .updateEntityStatus(false));
  }

  @Test
  void consolidatingChangesDoesNotRevalidateTheTransition() {
    Metric original = metric().withEntityStatus(EntityStatus.DRAFT);
    Metric updated = metric().withId(original.getId()).withEntityStatus(EntityStatus.DEPRECATED);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new ReviewedMetricRepo(metricDAO), original, updated);

    assertDoesNotThrow(() -> updater.updateEntityStatus(true));
  }

  @Test
  void consolidatedDiffDoesNotRevalidateAStageChangeAnEarlierVersionMade() {
    Metric sessionStart = metric().withEntityStatus(EntityStatus.DRAFT);
    Metric updated =
        metric().withId(sessionStart.getId()).withEntityStatus(EntityStatus.DEPRECATED);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new ReviewedMetricRepo(metricDAO), sessionStart, updated);
    updater.previous = sessionStart;

    assertDoesNotThrow(() -> updater.updateEntityStatus(false));
  }

  @Test
  void whileConsolidatingTheRequestsOwnStageChangeIsStillValidated() {
    Metric stored = metric().withEntityStatus(EntityStatus.DRAFT);
    Metric updated = metric().withId(stored.getId()).withEntityStatus(EntityStatus.DEPRECATED);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new ReviewedMetricRepo(metricDAO), stored, updated);
    updater.previous = metric().withId(stored.getId()).withEntityStatus(EntityStatus.APPROVED);

    assertThrows(BadRequestException.class, () -> updater.updateEntityStatus(false));
  }

  @Test
  void directStageChangeIsRejectedWhileAWorkflowOwnsTheStage() {
    TestMetricRepo repo = ownedByStageWorkflow(new TestMetricRepo(metricDAO));
    Metric owned = metric().withEntityStatus(EntityStatus.APPROVED);
    Metric excluded = metric().withName(EXCLUDED_METRIC).withEntityStatus(EntityStatus.APPROVED);

    AuthorizationException rejected =
        assertThrows(
            AuthorizationException.class,
            () ->
                newUpdater(repo, owned, movedBy(owned, EntityStatus.DEPRECATED, NON_REVIEWER))
                    .updateEntityStatus(false));
    assertTrue(rejected.getMessage().contains(STAGE_WORKFLOW), rejected.getMessage());
    assertDoesNotThrow(
        () ->
            newUpdater(repo, excluded, movedBy(excluded, EntityStatus.DEPRECATED, NON_REVIEWER))
                .updateEntityStatus(false));
  }

  @Test
  void owningWorkflowChangesTheStageAsOrOnBehalfOfAUser() {
    TestMetricRepo repo = ownedByStageWorkflow(new TestMetricRepo(metricDAO));
    Metric owned = metric().withEntityStatus(EntityStatus.APPROVED);
    Metric asWorkflow = movedBy(owned, EntityStatus.DEPRECATED, GOVERNANCE_BOT);
    Metric onBehalfOfUser =
        movedBy(owned, EntityStatus.DEPRECATED, REVIEWER).withImpersonatedBy(GOVERNANCE_BOT);

    assertDoesNotThrow(() -> newUpdater(repo, owned, asWorkflow).updateEntityStatus(false));
    assertDoesNotThrow(() -> newUpdater(repo, owned, onBehalfOfUser).updateEntityStatus(false));
  }

  @Test
  void typeWhoseStageNoWorkflowOwnsIgnoresActiveWorkflows() {
    TestMetricRepo repo = ownedByStageWorkflow(new RegistrationDrivenMetricRepo(metricDAO));
    Metric created = metric().withEntityStatus(EntityStatus.IN_REVIEW);

    repo.assignInitialEntityStatus(created);

    assertEquals(EntityStatus.IN_REVIEW, created.getEntityStatus());
    assertDoesNotThrow(
        () ->
            newUpdater(repo, created, movedBy(created, EntityStatus.DEPRECATED, NON_REVIEWER))
                .updateEntityStatus(false));
  }

  @Test
  void stageWorkflowsAreReportedOnlyForTypesWorkflowsCanOwn() {
    assertEquals(
        List.of(STAGE_WORKFLOW),
        ownedByStageWorkflow(new TestMetricRepo(metricDAO)).getStageWorkflows());
    assertTrue(
        ownedByStageWorkflow(new RegistrationDrivenMetricRepo(metricDAO))
            .getStageWorkflows()
            .isEmpty());
  }

  @Test
  void onlyAReviewerCanApproveAnEntityInReview() {
    TestMetricRepo repo = new TestMetricRepo(metricDAO);
    Metric inReview =
        metric().withEntityStatus(EntityStatus.IN_REVIEW).withReviewers(List.of(user(REVIEWER)));

    assertThrows(
        AuthorizationException.class,
        () ->
            newUpdater(repo, inReview, movedBy(inReview, EntityStatus.APPROVED, NON_REVIEWER))
                .updateEntityStatus(false));
    assertDoesNotThrow(
        () ->
            newUpdater(repo, inReview, movedBy(inReview, EntityStatus.APPROVED, REVIEWER))
                .updateEntityStatus(false));
  }

  @Test
  void onlyAReviewerCanRejectAnEntityInReview() {
    TestMetricRepo repo = new TestMetricRepo(metricDAO);
    Metric inReview =
        metric().withEntityStatus(EntityStatus.IN_REVIEW).withReviewers(List.of(user(REVIEWER)));

    assertThrows(
        AuthorizationException.class,
        () ->
            newUpdater(repo, inReview, movedBy(inReview, EntityStatus.REJECTED, NON_REVIEWER))
                .updateEntityStatus(false));
    assertDoesNotThrow(
        () ->
            newUpdater(repo, inReview, movedBy(inReview, EntityStatus.REJECTED, REVIEWER))
                .updateEntityStatus(false));
  }

  @Test
  void anyoneCanSendAnEntityInReviewBackToDraft() {
    TestMetricRepo repo = new TestMetricRepo(metricDAO);
    Metric inReview =
        metric().withEntityStatus(EntityStatus.IN_REVIEW).withReviewers(List.of(user(REVIEWER)));

    assertDoesNotThrow(
        () ->
            newUpdater(repo, inReview, movedBy(inReview, EntityStatus.DRAFT, NON_REVIEWER))
                .updateEntityStatus(false));
  }

  @Test
  void anyoneCanApproveAnEntityInReviewThatHasNoReviewers() {
    TestMetricRepo repo = new TestMetricRepo(metricDAO);
    Metric inReview = metric().withEntityStatus(EntityStatus.IN_REVIEW);

    assertDoesNotThrow(
        () ->
            newUpdater(repo, inReview, movedBy(inReview, EntityStatus.APPROVED, NON_REVIEWER))
                .updateEntityStatus(false));
  }

  @Test
  void aMemberOfAReviewingTeamCanApprove() {
    registerTeam(REVIEWING_TEAM, REVIEWER);
    TestMetricRepo repo = new TestMetricRepo(metricDAO);
    Metric inReview =
        metric()
            .withEntityStatus(EntityStatus.IN_REVIEW)
            .withReviewers(List.of(team(REVIEWING_TEAM)));

    assertDoesNotThrow(
        () ->
            newUpdater(repo, inReview, movedBy(inReview, EntityStatus.APPROVED, REVIEWER))
                .updateEntityStatus(false));
    assertThrows(
        AuthorizationException.class,
        () ->
            newUpdater(repo, inReview, movedBy(inReview, EntityStatus.APPROVED, NON_REVIEWER))
                .updateEntityStatus(false));
  }

  @Test
  void onlyAReviewerCanDeleteAnEntityInReviewWhenItsTypeRequiresIt() {
    TestMetricRepo guarded = new ReviewerDeletedMetricRepo(metricDAO);
    TestMetricRepo unguarded = new TestMetricRepo(metricDAO);
    Metric inReview =
        metric().withEntityStatus(EntityStatus.IN_REVIEW).withReviewers(List.of(user(REVIEWER)));
    Metric approved =
        metric().withEntityStatus(EntityStatus.APPROVED).withReviewers(List.of(user(REVIEWER)));

    assertThrows(
        AuthorizationException.class, () -> guarded.beginDeleteLifecycle(inReview, NON_REVIEWER));
    assertDoesNotThrow(() -> guarded.beginDeleteLifecycle(inReview, REVIEWER));
    assertDoesNotThrow(() -> guarded.beginDeleteLifecycle(approved, NON_REVIEWER));
    assertDoesNotThrow(() -> unguarded.beginDeleteLifecycle(inReview, NON_REVIEWER));
  }

  @Test
  void approvalTaskClosesWhenTheEntityLeavesReviewOrGoesBackToDraft() {
    assertEquals(
        Optional.of("Approved the data product"),
        EntityRepository.approvalTaskClosingComment(
            Entity.DATA_PRODUCT, EntityStatus.IN_REVIEW, EntityStatus.APPROVED));
    assertEquals(
        Optional.of("Rejected the metric"),
        EntityRepository.approvalTaskClosingComment(
            Entity.METRIC, EntityStatus.IN_REVIEW, EntityStatus.REJECTED));
    assertEquals(
        Optional.of("Closed due to glossary term going back to DRAFT."),
        EntityRepository.approvalTaskClosingComment(
            Entity.GLOSSARY_TERM, EntityStatus.IN_REVIEW, EntityStatus.DRAFT));
  }

  @Test
  void approvalTaskStaysOpenForOtherStageChanges() {
    assertTrue(
        EntityRepository.approvalTaskClosingComment(
                Entity.METRIC, EntityStatus.DRAFT, EntityStatus.IN_REVIEW)
            .isEmpty());
    assertTrue(
        EntityRepository.approvalTaskClosingComment(
                Entity.METRIC, EntityStatus.DRAFT, EntityStatus.DRAFT)
            .isEmpty());
    assertTrue(
        EntityRepository.approvalTaskClosingComment(
                Entity.METRIC, EntityStatus.APPROVED, EntityStatus.DEPRECATED)
            .isEmpty());
  }

  private static <R extends EntityRepository<Metric>> R ownedByStageWorkflow(R repo) {
    repo.stageOwnership = new StageWorkflowOwnership();
    return repo;
  }

  private static Metric metric() {
    return new Metric()
        .withId(UUID.randomUUID())
        .withName("weekly_active_users")
        .withFullyQualifiedName("weekly_active_users")
        .withUpdatedBy(Entity.ADMIN_USER_NAME);
  }

  private static Metric movedBy(Metric current, EntityStatus stage, String userName) {
    return metric()
        .withId(current.getId())
        .withEntityStatus(stage)
        .withUpdatedBy(userName)
        .withReviewers(current.getReviewers());
  }

  private static ContextMemory memory(EntityStatus stage) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName("orders_are_net_of_refunds")
        .withFullyQualifiedName("orders_are_net_of_refunds")
        .withEntityStatus(stage)
        .withUpdatedBy(Entity.ADMIN_USER_NAME);
  }

  private static ContextMemory memoryMovedTo(ContextMemory current, EntityStatus stage) {
    return memory(stage).withId(current.getId());
  }

  private static EntityReference user(String name) {
    return reference(Entity.USER, name);
  }

  private static EntityReference team(String name) {
    return reference(Entity.TEAM, name);
  }

  private static EntityReference reference(String type, String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(name)
        .withFullyQualifiedName(name);
  }

  private static <E extends EntityInterface> EntityRepository<E>.EntityUpdater newUpdater(
      EntityRepository<E> repo, E original, E updated) {
    EntityRepository<E>.EntityUpdater updater =
        repo.new EntityUpdater(original, updated, EntityRepository.Operation.PUT);
    updater.changeDescription =
        new ChangeDescription()
            .withFieldsAdded(new ArrayList<>())
            .withFieldsUpdated(new ArrayList<>())
            .withFieldsDeleted(new ArrayList<>());
    return updater;
  }

  @SuppressWarnings("unchecked")
  private static void registerNoUsersFound() {
    EntityRepository<User> userRepository = mock(EntityRepository.class);
    when(userRepository.findByNameOrNull(anyString(), any())).thenReturn(null);
    Entity.registerEntity(User.class, Entity.USER, userRepository);
  }

  @SuppressWarnings("unchecked")
  private static void registerTeam(String teamName, String memberName) {
    EntityRepository<Team> teamRepository = mock(EntityRepository.class);
    Team team = new Team().withName(teamName).withUsers(List.of(user(memberName)));
    when(teamRepository.getByName(any(), eq(teamName), any(), any(Include.class), anyBoolean()))
        .thenReturn(team);
    Entity.registerEntity(Team.class, Entity.TEAM, teamRepository);
  }
}
