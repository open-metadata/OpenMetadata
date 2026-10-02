package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityRepositoryEntityStatusTest {

  private static final String REVIEWER = "alice";
  private static final String NON_REVIEWER = "bob";

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

  /** Starts new metrics in Draft and never lets a draft be deprecated directly. */
  private static class ReviewedMetricRepo extends TestMetricRepo {
    ReviewedMetricRepo(CollectionDAO.MetricDAO dao) {
      super(dao);
      defaultEntityStatus = EntityStatus.DRAFT;
    }

    @Override
    protected void validateEntityStatusTransition(EntityStatus from, EntityStatus to) {
      if (from == EntityStatus.DRAFT && to == EntityStatus.DEPRECATED) {
        throw new BadRequestException("A draft metric cannot be deprecated");
      }
    }
  }

  /** Lets only a reviewer delete a metric while it is in review. */
  private static class ReviewerDeletedMetricRepo extends TestMetricRepo {
    ReviewerDeletedMetricRepo(CollectionDAO.MetricDAO dao) {
      super(dao);
      onlyReviewersDeleteInReview = true;
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
    TestMetricRepo repo = new TestMetricRepo(metricDAO);

    assertEquals(
        EntityStatus.IN_REVIEW,
        repo.initialEntityStatus(new Metric().withEntityStatus(EntityStatus.IN_REVIEW)));
  }

  @Test
  void newEntityWithoutAStageStartsInItsTypesDefaultStage() {
    assertEquals(
        EntityStatus.APPROVED, new TestMetricRepo(metricDAO).initialEntityStatus(metric()));
    assertEquals(
        EntityStatus.DRAFT, new ReviewedMetricRepo(metricDAO).initialEntityStatus(metric()));
  }

  @Test
  void updateThatOmitsTheStageKeepsTheStoredStage() throws Exception {
    Metric original = metric().withEntityStatus(EntityStatus.APPROVED);
    Metric updated = metric().withId(original.getId()).withEntityStatus(null);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new TestMetricRepo(metricDAO), original, updated);

    updateEntityStatus(updater, false);

    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
    assertTrue(updater.changeDescription.getFieldsUpdated().isEmpty());
  }

  @Test
  void updateThatChangesTheStageRecordsTheChange() throws Exception {
    Metric original = metric().withEntityStatus(EntityStatus.DRAFT);
    Metric updated = metric().withId(original.getId()).withEntityStatus(EntityStatus.APPROVED);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new TestMetricRepo(metricDAO), original, updated);

    updateEntityStatus(updater, false);

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

    assertThrows(BadRequestException.class, () -> updateEntityStatus(updater, false));
  }

  @Test
  void consolidatingChangesDoesNotRevalidateTheTransition() {
    Metric original = metric().withEntityStatus(EntityStatus.DRAFT);
    Metric updated = metric().withId(original.getId()).withEntityStatus(EntityStatus.DEPRECATED);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new ReviewedMetricRepo(metricDAO), original, updated);

    assertDoesNotThrow(() -> updateEntityStatus(updater, true));
  }

  @Test
  void consolidatedDiffDoesNotRevalidateAStageChangeAnEarlierVersionMade() {
    Metric sessionStart = metric().withEntityStatus(EntityStatus.DRAFT);
    Metric updated =
        metric().withId(sessionStart.getId()).withEntityStatus(EntityStatus.DEPRECATED);
    EntityRepository<Metric>.EntityUpdater updater =
        newUpdater(new ReviewedMetricRepo(metricDAO), sessionStart, updated);
    updater.previous = sessionStart;

    assertDoesNotThrow(() -> updateEntityStatus(updater, false));
  }

  @Test
  void onlyAReviewerCanApproveAnEntityInReview() {
    TestMetricRepo repo = new TestMetricRepo(metricDAO);
    Metric inReview =
        metric().withEntityStatus(EntityStatus.IN_REVIEW).withReviewers(List.of(user(REVIEWER)));

    EntityRepository<Metric>.EntityUpdater byNonReviewer =
        newUpdater(repo, inReview, approvedBy(inReview, NON_REVIEWER));
    assertThrows(AuthorizationException.class, () -> updateEntityStatus(byNonReviewer, false));

    EntityRepository<Metric>.EntityUpdater byReviewer =
        newUpdater(repo, inReview, approvedBy(inReview, REVIEWER));
    assertDoesNotThrow(() -> updateEntityStatus(byReviewer, false));
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

  private static Metric metric() {
    return new Metric()
        .withId(UUID.randomUUID())
        .withName("weekly_active_users")
        .withFullyQualifiedName("weekly_active_users")
        .withUpdatedBy(Entity.ADMIN_USER_NAME);
  }

  private static Metric approvedBy(Metric inReview, String userName) {
    Metric approved =
        metric()
            .withId(inReview.getId())
            .withEntityStatus(EntityStatus.APPROVED)
            .withUpdatedBy(userName);
    return approved.withReviewers(inReview.getReviewers());
  }

  private static EntityReference user(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.USER)
        .withName(name)
        .withFullyQualifiedName(name);
  }

  private static EntityRepository<Metric>.EntityUpdater newUpdater(
      TestMetricRepo repo, Metric original, Metric updated) {
    EntityRepository<Metric>.EntityUpdater updater =
        repo.new EntityUpdater(original, updated, EntityRepository.Operation.PUT);
    updater.changeDescription =
        new ChangeDescription()
            .withFieldsAdded(new ArrayList<>())
            .withFieldsUpdated(new ArrayList<>())
            .withFieldsDeleted(new ArrayList<>());
    return updater;
  }

  private static void updateEntityStatus(
      EntityRepository<Metric>.EntityUpdater updater, boolean consolidatingChanges)
      throws Exception {
    Method method =
        EntityRepository.EntityUpdater.class.getDeclaredMethod("updateEntityStatus", boolean.class);
    method.setAccessible(true);
    try {
      method.invoke(updater, consolidatingChanges);
    } catch (InvocationTargetException e) {
      if (e.getCause() instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw e;
    }
  }

  @SuppressWarnings("unchecked")
  private static void registerNoUsersFound() {
    EntityRepository<User> userRepository = mock(EntityRepository.class);
    when(userRepository.findByNameOrNull(anyString(), any())).thenReturn(null);
    Entity.registerEntity(User.class, Entity.USER, userRepository);
  }
}
