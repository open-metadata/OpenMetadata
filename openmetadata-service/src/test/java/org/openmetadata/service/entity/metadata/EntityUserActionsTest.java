package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.VoteRequest.VoteType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil.PutResponse;

class EntityUserActionsTest {
  @Test
  void followingPublishesTheHydratedEntityAndPerRequestChangeWithoutChangingItsVersion() {
    final Fixture fixture = new Fixture();
    final long before = System.currentTimeMillis();
    final ChangeEvent event = fixture.follow();
    assertEvent(fixture, event, before);
    assertEquals(1, fixture.store.writes);
    assertEquals(Relationship.FOLLOWS.ordinal(), fixture.store.rows.getFirst().getRelation());
    assertEquals(fixture.user.getId().toString(), fixture.store.rows.getFirst().getFromId());
    assertEquals(fixture.table.getId().toString(), fixture.store.rows.getFirst().getToId());
    assertEquals(List.of(fixture.follower), fixture.table.getFollowers());
    assertSame(event.getChangeDescription(), fixture.table.getChangeDescription());
    assertSame(event.getChangeDescription(), fixture.table.getIncrementalChangeDescription());
    assertEquals(
        Entity.FIELD_FOLLOWERS, event.getChangeDescription().getFieldsAdded().getFirst().getName());
    assertEquals(
        List.of(fixture.user.getEntityReference()),
        event.getChangeDescription().getFieldsAdded().getFirst().getNewValue());
    assertEquals(1, fixture.hydrations);
    assertEquals(1, fixture.reactions);
  }

  @ParameterizedTest
  @EnumSource(VoteType.class)
  @NullSource
  void votingKeepsItsRelationshipJsonAndSeparateEventDescription(final VoteType vote) {
    final Fixture fixture = new Fixture();
    final ChangeDescription previous = new ChangeDescription().withPreviousVersion(0.3);
    fixture.table.setChangeDescription(previous);
    fixture.table.setIncrementalChangeDescription(previous);
    fixture
        .store
        .writer()
        .add(
            new EntityRelationshipWriter.Edge(
                fixture.user.getId(),
                fixture.table.getId(),
                Entity.USER,
                Entity.TABLE,
                Relationship.VOTED),
            new EntityRelationshipWriter.Value("", JsonUtils.pojoToJson(VoteType.VOTED_UP)),
            false);
    fixture.store.writes = 0;
    fixture.store.invalidated.clear();
    final long before = System.currentTimeMillis();
    final ChangeEvent event =
        event(
            fixture.service.vote(
                fixture.actor, fixture.table.getId(), new VoteRequest().withUpdatedVoteType(vote)));
    assertEvent(fixture, event, before);
    assertEquals(FullyQualifiedName.quoteName(fixture.actor), fixture.loadedUserName);
    assertEquals(1, fixture.store.writes);
    if (vote == VoteType.UN_VOTED) {
      assertTrue(fixture.store.rows.isEmpty());
    } else {
      assertEquals(JsonUtils.pojoToJson(vote), fixture.store.rows.getFirst().getJson());
      assertEquals(Relationship.VOTED.ordinal(), fixture.store.rows.getFirst().getRelation());
    }
    assertSame(previous, fixture.table.getChangeDescription());
    assertSame(previous, fixture.table.getIncrementalChangeDescription());
    assertEquals(
        Entity.FIELD_VOTES, event.getChangeDescription().getFieldsUpdated().getFirst().getName());
    assertEquals(vote, event.getChangeDescription().getFieldsUpdated().getFirst().getNewValue());
    assertNull(event.getChangeDescription().getFieldsUpdated().getFirst().getOldValue());
    assertSame(fixture.votes, fixture.table.getVotes());
    assertEquals(1, fixture.hydrations);
    assertEquals(1, fixture.reactions);
  }

  @Test
  void deletedUsersKeepTheirErrorAndDoNotWriteOrHydrate() {
    final Fixture fixture = new Fixture();
    fixture.user.setDeleted(true);
    final String expected = CatalogExceptionMessage.deletedUser(fixture.user.getId());
    assertEquals(
        expected, assertThrows(IllegalArgumentException.class, fixture::follow).getMessage());
    assertEquals(
        expected,
        assertThrows(
                IllegalArgumentException.class,
                () -> fixture.service.vote(fixture.actor, fixture.table.getId(), new VoteRequest()))
            .getMessage());
    assertEquals(0, fixture.store.writes);
    assertEquals(0, fixture.hydrations);
    assertEquals(0, fixture.reactions);
  }

  @Test
  void missingEntitiesFailBeforeResolvingUsers() {
    final Fixture fixture = new Fixture();
    fixture.entityFailure = new IllegalArgumentException("Missing table");
    assertSame(
        fixture.entityFailure, assertThrows(IllegalArgumentException.class, fixture::follow));
    assertSame(
        fixture.entityFailure,
        assertThrows(
            IllegalArgumentException.class,
            () -> fixture.service.vote(fixture.actor, fixture.table.getId(), null)));
    assertEquals(0, fixture.userReads);
    assertEquals(0, fixture.store.writes);
  }

  @Test
  void nullVoteRequestStillResolvesTheUserBeforeFailing() {
    final Fixture fixture = new Fixture();
    assertThrows(
        NullPointerException.class,
        () -> fixture.service.vote(fixture.actor, fixture.table.getId(), null));
    assertEquals(1, fixture.userReads);
    assertEquals(0, fixture.store.writes);
  }

  @Test
  void failedWritesDoNotPublishAHydratedResponse() {
    final Fixture fixture = new Fixture();
    fixture.store.failure = new IllegalStateException("Write failed");
    assertThrows(IllegalStateException.class, fixture::follow);
    assertThrows(
        IllegalStateException.class,
        () ->
            fixture.service.vote(
                fixture.actor,
                fixture.table.getId(),
                new VoteRequest().withUpdatedVoteType(VoteType.VOTED_UP)));
    assertEquals(0, fixture.hydrations);
    assertEquals(0, fixture.reactions);
    assertNull(fixture.table.getChangeDescription());
  }

  @Test
  void failedHydrationRetainsTheWriteAndStopsPublication() {
    final Fixture fixture = new Fixture();
    fixture.failHydration = true;
    assertThrows(IllegalStateException.class, fixture::follow);
    assertEquals(1, fixture.store.rows.size());
    assertNotNull(fixture.table.getChangeDescription());
    assertEquals(0, fixture.reactions);
  }

  @Test
  void unfollowingPublishesTheValidatedReferenceAndRemainingFollowers() {
    final Fixture fixture = new Fixture();
    fixture.seedFollower();
    final EntityReference inherited =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER);
    fixture.followers = List.of(inherited);
    final long before = System.currentTimeMillis();
    final ChangeEvent event =
        event(fixture.service.unfollow(fixture.actor, fixture.table.getId(), fixture.user.getId()));
    assertEvent(fixture, event, before);
    assertTrue(fixture.store.rows.isEmpty());
    assertEquals(1, fixture.store.writes);
    assertEquals(List.of(inherited), fixture.table.getFollowers());
    assertSame(event.getChangeDescription(), fixture.table.getChangeDescription());
    assertSame(event.getChangeDescription(), fixture.table.getIncrementalChangeDescription());
    assertEquals(
        Entity.FIELD_FOLLOWERS,
        event.getChangeDescription().getFieldsDeleted().getFirst().getName());
    assertEquals(
        List.of(fixture.follower),
        event.getChangeDescription().getFieldsDeleted().getFirst().getOldValue());
    assertEquals(1, fixture.hydrations);
    assertEquals(1, fixture.reactions);
    assertEquals(1, fixture.referenceReads);
  }

  @Test
  void removingAnAbsentFollowerStillReturnsTheExistingDeletionEventContract() {
    final Fixture fixture = new Fixture();
    fixture.followers = List.of();
    final ChangeEvent event =
        event(fixture.service.unfollow(fixture.actor, fixture.table.getId(), fixture.user.getId()));
    assertTrue(fixture.store.rows.isEmpty());
    assertEquals(1, event.getChangeDescription().getFieldsDeleted().size());
    assertTrue(fixture.table.getFollowers().isEmpty());
    assertEquals(1, fixture.reactions);
  }

  @Test
  void missingEntityStopsUnfollowingBeforeResolvingTheReference() {
    final Fixture fixture = new Fixture();
    fixture.entityFailure = new IllegalArgumentException("Missing entity");
    assertSame(
        fixture.entityFailure,
        assertThrows(
            IllegalArgumentException.class,
            () ->
                fixture.service.unfollow(
                    fixture.actor, fixture.table.getId(), fixture.user.getId())));
    assertEquals(0, fixture.referenceReads);
    assertEquals(0, fixture.store.writes);
  }

  @Test
  void referenceValidationFailureLeavesTheExistingFollowerRelationship() {
    final Fixture fixture = new Fixture();
    fixture.seedFollower();
    fixture.referenceFailure = new IllegalArgumentException("Missing or deleted user reference");
    assertSame(
        fixture.referenceFailure,
        assertThrows(
            IllegalArgumentException.class,
            () ->
                fixture.service.unfollow(
                    fixture.actor, fixture.table.getId(), fixture.user.getId())));
    assertEquals(1, fixture.store.rows.size());
    assertEquals(0, fixture.store.writes);
    assertEquals(0, fixture.hydrations);
    assertEquals(0, fixture.reactions);
  }

  @Test
  void failedUnfollowHydrationKeepsTheDeletionAndStopsPublication() {
    final Fixture fixture = new Fixture();
    fixture.seedFollower();
    fixture.failHydration = true;
    assertThrows(
        IllegalStateException.class,
        () -> fixture.service.unfollow(fixture.actor, fixture.table.getId(), fixture.user.getId()));
    assertTrue(fixture.store.rows.isEmpty());
    assertEquals(1, fixture.table.getChangeDescription().getFieldsDeleted().size());
    assertEquals(0, fixture.reactions);
  }

  private static ChangeEvent event(final PutResponse<Table> response) {
    assertEquals(200, response.toResponse().getStatus());
    assertEquals(EventType.ENTITY_FIELDS_CHANGED, response.getChangeType());
    return (ChangeEvent) response.toResponse().getEntity();
  }

  private static void assertEvent(
      final Fixture fixture, final ChangeEvent event, final long before) {
    assertNotNull(event.getId());
    assertSame(fixture.table, event.getEntity());
    assertEquals(Entity.TABLE, event.getEntityType());
    assertEquals(fixture.table.getId(), event.getEntityId());
    assertEquals(fixture.table.getFullyQualifiedName(), event.getEntityFullyQualifiedName());
    assertEquals(fixture.actor, event.getUserName());
    assertEquals(EventType.ENTITY_UPDATED, event.getEventType());
    assertEquals(0.7, event.getPreviousVersion());
    assertEquals(0.7, event.getCurrentVersion());
    assertSame(event.getChangeDescription(), event.getIncrementalChangeDescription());
    assertTrue(
        event.getTimestamp() >= before && event.getTimestamp() <= System.currentTimeMillis());
    assertEquals(1, fixture.entityReads);
    assertEquals(1, fixture.userReads);
  }

  private static final class Fixture {
    private final String actor = "first.last";
    private final Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("service.schema.table")
            .withVersion(0.7);
    private final User user = new User().withId(UUID.randomUUID()).withName(actor);
    private final EntityReference follower =
        new EntityReference().withId(user.getId()).withType(Entity.USER);
    private List<EntityReference> followers = List.of(follower);
    private final Votes votes = new Votes().withUpVotes(1);
    private final RelationshipStoreFixture store = new RelationshipStoreFixture();
    private final EntityUserActions<Table> service;
    private RuntimeException entityFailure;
    private RuntimeException referenceFailure;
    private int referenceReads;
    private boolean failHydration;
    private String loadedUserName;
    private int hydrations;
    private int reactions;
    private int entityReads;
    private int userReads;

    private Fixture() {
      service =
          new EntityUserActions<>(
              Entity.TABLE,
              new EntityUserActions.Lookup<>(
                  id -> {
                    entityReads++;
                    if (entityFailure != null) {
                      throw entityFailure;
                    }
                    return table;
                  },
                  id -> {
                    userReads++;
                    return user;
                  },
                  name -> {
                    userReads++;
                    loadedUserName = name;
                    return user;
                  },
                  id -> {
                    userReads++;
                    referenceReads++;
                    if (referenceFailure != null) {
                      throw referenceFailure;
                    }
                    return follower;
                  }),
              store.writer(),
              new EntityUserActions.Hydration<>(
                  entity -> {
                    hydrate();
                    return followers;
                  },
                  entity -> {
                    hydrate();
                    entity.setVotes(votes);
                  },
                  (original, updated) -> {
                    assertSame(original, updated);
                    assertTrue(
                        updated.getVotes() == votes || followers.equals(updated.getFollowers()));
                    reactions++;
                  }));
    }

    private ChangeEvent follow() {
      return event(service.follow(actor, table.getId(), user.getId()));
    }

    private void seedFollower() {
      store
          .writer()
          .add(
              new EntityRelationshipWriter.Edge(
                  user.getId(), table.getId(), Entity.USER, Entity.TABLE, Relationship.FOLLOWS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
      store.writes = 0;
      store.invalidated.clear();
    }

    private void hydrate() {
      hydrations++;
      assertFalse(store.invalidated.isEmpty());
      if (failHydration) {
        throw new IllegalStateException("Hydration failed");
      }
    }
  }
}
