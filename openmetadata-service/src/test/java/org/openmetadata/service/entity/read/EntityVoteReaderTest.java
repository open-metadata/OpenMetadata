package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.VoteRequest.VoteType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

class EntityVoteReaderTest {
  @Test
  void missingAndUnsupportedEntitiesKeepEmptyVotesWithoutLoading() {
    final Fixture fixture = new Fixture(false);
    assertEquals(new Votes(), fixture.reader.read(fixture.table));
    assertEquals(new Votes(), fixture.reader.read(null));
    assertEquals(0, fixture.reads);
    assertEquals(0, fixture.bundleReads);
    fixture.reader.readMany(List.of(fixture.table));
    assertEquals(1, fixture.reads);
  }

  @Test
  void loadedVotesKeepTheirBundleIdentity() {
    final Fixture fixture = new Fixture(true);
    assertEquals(new Votes(), fixture.reader.read(null));
    fixture.bundle = new Votes().withUpVotes(9);
    assertSame(fixture.bundle, fixture.reader.read(fixture.table));
    assertEquals(0, fixture.reads);
    assertEquals(1, fixture.bundleReads);
  }

  @Test
  void individualFallbackRetainsItsReferenceResolverIncludingDeletedUsers() {
    final Fixture fixture = new Fixture(true);
    final EntityReference up = fixture.user(true);
    final EntityReference down = fixture.user(false);
    fixture.single.add(fixture.record(up, VoteType.VOTED_UP));
    fixture.single.add(fixture.record(down, VoteType.VOTED_DOWN));
    fixture.single.add(fixture.record(fixture.user(false), VoteType.UN_VOTED));
    fixture.single.add(
        EntityRelationshipRecord.builder().id(UUID.randomUUID()).json("null").build());
    final Votes result = fixture.reader.read(fixture.table);
    assertEquals(List.of(up), result.getUpVoters());
    assertEquals(List.of(down), result.getDownVoters());
    assertEquals(1, result.getUpVotes());
    assertEquals(1, result.getDownVotes());
    assertEquals(1, fixture.reads);
  }

  @Test
  void malformedIndividualVotesFailBeforeResolvingReferences() {
    final Fixture fixture = new Fixture(true);
    fixture.single.add(EntityRelationshipRecord.builder().json("invalid").build());
    assertThrows(JsonParsingException.class, () -> fixture.reader.read(fixture.table));
    assertTrue(fixture.resolvedIds.isEmpty());
  }

  @Test
  void bulkVotesResolveUsersOnceAndPreserveInputVoteOrderAndDuplicateEntities() {
    final Fixture fixture = new Fixture(true);
    final Table second = new Table().withId(UUID.randomUUID());
    final EntityReference first = fixture.user(false);
    final EntityReference next = fixture.user(false);
    fixture.vote(fixture.table, next, VoteType.VOTED_UP);
    fixture.vote(fixture.table, first, VoteType.VOTED_UP);
    fixture.vote(second, first, VoteType.VOTED_DOWN);
    fixture.vote(second, next, VoteType.UN_VOTED);
    fixture.batch.add(
        EntityRelationshipObject.builder()
            .toId(second.getId().toString())
            .fromId(next.getId().toString())
            .json("null")
            .build());
    final Map<UUID, Votes> result =
        fixture.reader.readMany(List.of(fixture.table, second, fixture.table));
    assertEquals(List.of(next, first), result.get(fixture.table.getId()).getUpVoters());
    assertEquals(List.of(first), result.get(second.getId()).getDownVoters());
    assertEquals(Set.of(first.getId(), next.getId()), Set.copyOf(fixture.resolvedIds));
    assertEquals(2, fixture.resolvedIds.size());
    assertEquals(2, result.size());
    assertEquals(1, fixture.reads);
  }

  @Test
  void bulkVotesIgnoreMissingAndSoftDeletedUsersButKeepDuplicateRows() {
    final Fixture fixture = new Fixture(true);
    final EntityReference existing = fixture.user(false);
    final EntityReference deleted = fixture.user(true);
    final EntityReference missing = new EntityReference().withId(UUID.randomUUID());
    fixture.vote(fixture.table, existing, VoteType.VOTED_UP);
    fixture.vote(fixture.table, existing, VoteType.VOTED_UP);
    fixture.vote(fixture.table, deleted, VoteType.VOTED_UP);
    fixture.vote(fixture.table, missing, VoteType.VOTED_DOWN);
    final Votes result = fixture.reader.readMany(List.of(fixture.table)).get(fixture.table.getId());
    assertEquals(List.of(existing, existing), result.getUpVoters());
    assertEquals(2, result.getUpVotes());
    assertEquals(0, result.getDownVotes());
  }

  @Test
  void emptyBulkInputsSkipReadsAndEmptyResultsRemainIndependent() {
    final Fixture fixture = new Fixture(true);
    assertTrue(fixture.reader.readMany(null).isEmpty());
    assertTrue(fixture.reader.readMany(List.of()).isEmpty());
    assertEquals(0, fixture.reads);
    final Table second = new Table().withId(UUID.randomUUID());
    final Map<UUID, Votes> results = fixture.reader.readMany(List.of(fixture.table, second));
    assertEquals(0, results.get(fixture.table.getId()).getUpVotes());
    assertNotSame(results.get(fixture.table.getId()), results.get(second.getId()));
    assertEquals(List.of(), fixture.resolvedIds);
  }

  @Test
  void invalidBulkIdsAndVotesRetainTheirFailures() {
    final Fixture fixture = new Fixture(true);
    fixture.batch.add(EntityRelationshipObject.builder().toId("invalid").build());
    assertThrows(
        IllegalArgumentException.class, () -> fixture.reader.readMany(List.of(fixture.table)));
    fixture.batch.clear();
    fixture.batch.add(
        EntityRelationshipObject.builder()
            .toId(fixture.table.getId().toString())
            .fromId(UUID.randomUUID().toString())
            .json("invalid")
            .build());
    assertThrows(JsonParsingException.class, () -> fixture.reader.readMany(List.of(fixture.table)));
    assertTrue(fixture.resolvedIds.isEmpty());
  }

  @Test
  void duplicateResolvedUserIdsRemainAnError() {
    final Fixture fixture = new Fixture(true);
    final EntityReference user = fixture.user(false);
    fixture.vote(fixture.table, user, VoteType.VOTED_UP);
    fixture.duplicateReference = true;
    assertThrows(
        IllegalStateException.class, () -> fixture.reader.readMany(List.of(fixture.table)));
  }

  private static final class Fixture {
    private final Table table = new Table().withId(UUID.randomUUID());
    private final Map<UUID, EntityReference> users = new HashMap<>();
    private final List<EntityRelationshipRecord> single = new ArrayList<>();
    private final List<EntityRelationshipObject> batch = new ArrayList<>();
    private final EntityVoteReader<Table> reader;
    private List<UUID> resolvedIds = List.of();
    private Votes bundle;
    private int reads;
    private int bundleReads;
    private boolean duplicateReference;

    private Fixture(final boolean supported) {
      reader =
          new EntityVoteReader<>(
              supported,
              new EntityVoteReader.Queries(
                  id -> {
                    reads++;
                    return single;
                  },
                  ids -> {
                    reads++;
                    return batch;
                  }),
              new EntityVoteReader.References(
                  records -> records.stream().map(record -> users.get(record.getId())).toList(),
                  ids -> {
                    resolvedIds = ids;
                    final List<EntityReference> found =
                        ids.stream()
                            .map(users::get)
                            .filter(user -> user != null && !Boolean.TRUE.equals(user.getDeleted()))
                            .toList();
                    return duplicateReference ? List.of(found.getFirst(), found.getFirst()) : found;
                  }),
              entity -> {
                bundleReads++;
                return Optional.ofNullable(bundle);
              });
    }

    private EntityReference user(final boolean deleted) {
      final EntityReference user =
          new EntityReference()
              .withType(Entity.USER)
              .withId(UUID.randomUUID())
              .withDeleted(deleted);
      users.put(user.getId(), user);
      return user;
    }

    private EntityRelationshipRecord record(final EntityReference user, final VoteType type) {
      return EntityRelationshipRecord.builder()
          .id(user.getId())
          .type(Entity.USER)
          .json(JsonUtils.pojoToJson(type))
          .build();
    }

    private void vote(final Table entity, final EntityReference user, final VoteType type) {
      batch.add(
          EntityRelationshipObject.builder()
              .toId(entity.getId().toString())
              .fromId(user.getId().toString())
              .json(JsonUtils.pojoToJson(type))
              .build());
    }
  }
}
