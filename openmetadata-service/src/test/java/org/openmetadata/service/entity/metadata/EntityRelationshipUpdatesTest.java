package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates.References;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates.Target;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Edge;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Value;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

class EntityRelationshipUpdatesTest {
  private static final UUID ID = new UUID(0, 2);
  private static final Relationship RELATION = Relationship.RELATED_TO;
  private static final Target TARGET =
      new Target("related", ID, Entity.USER, Entity.USER, RELATION);

  @Test
  void unchangedAndUnselectedListsAvoidSqlAndPreserveInputOrder() {
    final Fixture fixture = new Fixture();
    final List<EntityReference> values =
        new ArrayList<>(List.of(ref(3, Entity.USER), ref(1, Entity.USER)));
    fixture.updates.outgoing(fixture, TARGET, new References(values, values), true);
    assertEquals(
        List.of(new UUID(0, 3), new UUID(0, 1)),
        values.stream().map(EntityReference::getId).toList());
    fixture.selected = false;
    fixture.updates.incoming(fixture, TARGET, new References(List.of(), values));
    assertEquals(0, fixture.store.writes);
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
  }

  @Test
  void outgoingDiffDeletesByActualTypeAndInsertsUsingTheDeclaredType() {
    final Fixture fixture = new Fixture();
    fixture.seed(ID, Entity.USER, ref(1, Entity.TEAM));
    fixture.seed(ID, Entity.USER, ref(3, Entity.USER));
    fixture.resetCounts();
    fixture.updates.outgoing(
        fixture,
        TARGET,
        new References(
            List.of(ref(1, Entity.TEAM), ref(3, Entity.USER)), List.of(ref(4, Entity.TEAM))),
        false);
    assertEquals(1, fixture.store.rows.size());
    assertEquals(Entity.USER, fixture.store.rows.getFirst().getToEntity());
    assertEquals(new UUID(0, 4).toString(), fixture.store.rows.getFirst().getToId());
    assertEquals(3, fixture.store.writes);
    assertEquals(1, fixture.changes.getFieldsAdded().size());
    assertEquals(1, fixture.changes.getFieldsDeleted().size());
    assertTrue(fixture.store.invalidated.isEmpty());
  }

  @Test
  void symmetricDiffDeletesBothDirectionsAndOrdersNewIdsWithTheirTypes() {
    final Fixture fixture = new Fixture();
    fixture.seed(ID, Entity.USER, ref(1, Entity.TEAM));
    fixture.seed(new UUID(0, 3), Entity.USER, ref(2, Entity.USER));
    fixture.resetCounts();
    fixture.updates.outgoing(
        fixture,
        TARGET,
        new References(
            List.of(ref(1, Entity.TEAM), ref(3, Entity.USER)),
            List.of(ref(1, Entity.USER), ref(4, Entity.TEAM))),
        true);
    assertEquals(2, fixture.store.rows.size());
    final EntityRelationshipObject lower = fixture.store.rows.getFirst();
    final EntityRelationshipObject upper = fixture.store.rows.getLast();
    assertEquals(new UUID(0, 1).toString(), lower.getFromId());
    assertEquals(ID.toString(), lower.getToId());
    assertEquals(Entity.USER, lower.getFromEntity());
    assertEquals(ID.toString(), upper.getFromId());
    assertEquals(Entity.TEAM, upper.getToEntity());
    assertEquals(5, fixture.store.writes);
  }

  @Test
  void incomingDiffSupportsMixedParentTypesAndDeterministicInsertion() {
    final Fixture fixture = new Fixture();
    fixture.seed(new UUID(0, 1), Entity.TEAM, ref(2, Entity.USER));
    fixture.seed(new UUID(0, 3), Entity.USER, ref(2, Entity.USER));
    fixture.resetCounts();
    fixture.updates.incoming(
        fixture,
        new Target("owners", ID, Entity.USER, null, RELATION),
        new References(
            List.of(ref(1, Entity.TEAM), ref(3, Entity.USER)),
            List.of(ref(5, Entity.TEAM), ref(4, Entity.USER))));
    assertEquals(
        List.of(new UUID(0, 4).toString(), new UUID(0, 5).toString()),
        fixture.store.rows.stream().map(EntityRelationshipObject::getFromId).toList());
    assertEquals(
        List.of(Entity.USER, Entity.TEAM),
        fixture.store.rows.stream().map(EntityRelationshipObject::getFromEntity).toList());
    assertEquals(3, fixture.store.writes);
  }

  @Test
  void changedMutableListsAreSortedAndImmutableListsRemainUsable() {
    final Fixture fixture = new Fixture();
    final List<EntityReference> original =
        new ArrayList<>(List.of(ref(3, Entity.USER).withName(null), ref(1, Entity.USER)));
    final List<EntityReference> updated =
        new ArrayList<>(
            List.of(ref(5, Entity.USER).withName("same"), ref(4, Entity.USER).withName("same")));
    fixture.updates.incoming(fixture, TARGET, new References(original, updated));
    assertEquals(new UUID(0, 1), original.getFirst().getId());
    assertEquals(new UUID(0, 4), updated.getFirst().getId());
    fixture.updates.incoming(fixture, TARGET, new References(List.copyOf(updated), List.of()));
    assertTrue(fixture.store.rows.isEmpty());
  }

  @Test
  void nullListsKeepAdditionAndRemovalBehavior() {
    final Fixture fixture = new Fixture();
    fixture.updates.outgoing(
        fixture, TARGET, new References(null, List.of(ref(1, Entity.USER))), false);
    assertEquals(1, fixture.store.rows.size());
    fixture.updates.outgoing(
        fixture, TARGET, new References(List.of(ref(1, Entity.USER)), null), false);
    assertTrue(fixture.store.rows.isEmpty());
  }

  @Test
  void outgoingSingleReplacementClearsBothDirectionsAndPublishesTheNewReference() {
    final Fixture fixture = new Fixture();
    fixture.seed(ID, Entity.USER, ref(3, Entity.USER));
    fixture.seed(new UUID(0, 1), Entity.USER, ref(2, Entity.USER));
    fixture.resetCounts();
    fixture.updates.outgoingSingle(fixture, TARGET, ref(3, Entity.USER), ref(4, Entity.USER), true);
    assertEquals(1, fixture.store.rows.size());
    assertEquals(new UUID(0, 4).toString(), fixture.store.rows.getFirst().getToId());
    assertEquals(2, fixture.store.rdf.size());
    assertEquals(2, fixture.store.invalidated.size());
    assertEquals(3, fixture.store.writes);
  }

  @Test
  void incomingSingleReplacementAndDeletionKeepDirectionAndCacheEffects() {
    final Fixture fixture = new Fixture();
    fixture.seed(new UUID(0, 1), Entity.USER, ref(2, Entity.USER));
    fixture.resetCounts();
    fixture.updates.incomingSingle(fixture, TARGET, ref(1, Entity.USER), ref(3, Entity.USER));
    assertEquals(new UUID(0, 3).toString(), fixture.store.rows.getFirst().getFromId());
    assertEquals(ID.toString(), fixture.store.rows.getFirst().getToId());
    assertEquals(2, fixture.store.invalidated.size());
    fixture.updates.incomingSingle(fixture, TARGET, ref(3, Entity.USER), null);
    assertTrue(fixture.store.rows.isEmpty());
  }

  @Test
  void scalarNoopsAndNonSymmetricDeletionDoNotPublishNewRelationships() {
    final Fixture fixture = new Fixture();
    fixture.seed(ID, Entity.USER, ref(3, Entity.USER));
    fixture.resetCounts();
    fixture.updates.outgoingSingle(
        fixture, TARGET, ref(3, Entity.USER), ref(3, Entity.USER), false);
    fixture.updates.incomingSingle(fixture, TARGET, null, null);
    assertEquals(0, fixture.store.writes);
    fixture.updates.outgoingSingle(fixture, TARGET, ref(3, Entity.USER), null, false);
    assertTrue(fixture.store.rows.isEmpty());
    assertTrue(fixture.store.invalidated.isEmpty());
  }

  @Test
  void failedPersistencePropagatesBeforeSortingCallerLists() {
    final Fixture fixture = new Fixture();
    fixture.store.failure = new IllegalStateException("write failed");
    final List<EntityReference> values =
        new ArrayList<>(List.of(ref(3, Entity.USER), ref(1, Entity.USER)));
    assertSame(
        fixture.store.failure,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.updates.incoming(fixture, TARGET, new References(List.of(), values))));
    assertEquals(new UUID(0, 3), values.getFirst().getId());
    assertTrue(EntityChangeRecorder.hasChanges(fixture.changes));
    assertTrue(fixture.store.rows.isEmpty());
  }

  private static EntityReference ref(final int id, final String type) {
    return new EntityReference().withId(new UUID(0, id)).withType(type).withName("reference" + id);
  }

  private static final class Fixture implements EntityRelationshipUpdates.Session {
    private final RelationshipStoreFixture store = new RelationshipStoreFixture();
    private final EntityRelationshipUpdates updates =
        new EntityRelationshipUpdates(() -> store.dao, store.writer());
    private final ChangeDescription changes = new ChangeDescription();
    private boolean selected = true;

    private void seed(final UUID fromId, final String fromType, final EntityReference to) {
      store
          .writer()
          .add(new Edge(fromId, to.getId(), fromType, to.getType(), RELATION), Value.EMPTY, false);
    }

    private void resetCounts() {
      store.writes = 0;
      store.rdf.clear();
      store.invalidated.clear();
    }

    @Override
    public boolean recordReferenceChanges(
        final String field, final ListChange<EntityReference> values) {
      return selected && EntityChangeRecorder.recordList(changes, field, values);
    }

    @Override
    public boolean recordReferenceChange(
        final String field, final EntityReference original, final EntityReference updated) {
      final boolean changed =
          selected && EntityChangeRecorder.differs(original, updated, entityReferenceMatch);
      if (changed) {
        EntityChangeRecorder.recordValue(changes, field, original, updated, true);
      }
      return changed;
    }
  }
}
