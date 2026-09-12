package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Batch;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Edge;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Selection;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Value;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

class EntityRelationshipWriterTest {
  private static final UUID FIRST = new UUID(0, 1);
  private static final UUID SECOND = new UUID(0, 2);
  private static final Relationship RELATION = Relationship.CONTAINS;

  @Test
  void insertionKeepsJsonRelationTypeAndBothCacheTargets() {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    store.writer().add(edge(FIRST, SECOND), new Value("custom", "{}"), false);
    final EntityRelationshipObject row = store.rows.getFirst();
    assertEquals(FIRST.toString(), row.getFromId());
    assertEquals(SECOND.toString(), row.getToId());
    assertEquals("custom", row.getRelationType());
    assertEquals("{}", row.getJson());
    assertEquals(FIRST, store.rdf.getFirst().getFromId());
    assertEquals(
        List.of(Entity.FOLDER + ":" + FIRST, Entity.CONTEXT_FILE + ":" + SECOND),
        store.invalidated);
    assertEquals(1, store.writes);
  }

  @Test
  void bidirectionalSingleInsertRetainsLegacyIdOrderingAndRdfDirections() {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    store.writer().add(edge(SECOND, FIRST), new Value(null, null), true);
    final EntityRelationshipObject row = store.rows.getFirst();
    assertEquals(FIRST.toString(), row.getFromId());
    assertEquals(SECOND.toString(), row.getToId());
    assertEquals(Entity.FOLDER, row.getFromEntity());
    assertEquals(Entity.CONTEXT_FILE, row.getToEntity());
    assertEquals("", row.getRelationType());
    assertEquals(
        List.of(SECOND, FIRST), store.rdf.stream().map(value -> value.getFromId()).toList());
    assertEquals(
        List.of(Entity.FOLDER, Entity.CONTEXT_FILE),
        store.rdf.stream().map(value -> value.getFromEntity()).toList());
    store.writer().add(edge(FIRST, SECOND), Value.EMPTY, true);
    assertEquals(1, store.rows.size());
  }

  @Test
  void deletingAnEdgeUpdatesStoredAndRdfStateWithoutTouchingAnotherRelation() {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    final EntityRelationshipWriter writer = store.writer();
    writer.add(edge(FIRST, SECOND), Value.EMPTY, false);
    writer.add(
        new Edge(FIRST, SECOND, Entity.FOLDER, Entity.CONTEXT_FILE, Relationship.HAS),
        Value.EMPTY,
        false);
    store.invalidated.clear();
    writer.delete(edge(FIRST, SECOND));
    assertEquals(1, store.rows.size());
    assertEquals(Relationship.HAS.ordinal(), store.rows.getFirst().getRelation());
    assertEquals(1, store.rdf.size());
    assertEquals(Relationship.HAS, store.rdf.getFirst().getRelationshipType());
    assertEquals(2, store.invalidated.size());
  }

  @Test
  void bulkWritesKeepInputOrderAndInvalidateEveryEndpoint() {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    final Batch batch =
        new Batch(FIRST, List.of(SECOND, FIRST), Entity.FOLDER, Entity.CONTEXT_FILE, RELATION);
    store.writer().addMany(batch);
    assertEquals(
        List.of(SECOND.toString(), FIRST.toString()),
        store.rows.stream().map(EntityRelationshipObject::getToId).toList());
    assertEquals(3, store.invalidated.size());
    assertTrue(store.rdf.isEmpty());
    store.writer().removeMany(batch);
    assertTrue(store.rows.isEmpty());
    assertEquals(6, store.invalidated.size());
  }

  @Test
  void deterministicBatchInsertionLeavesTheCallersOrderIntact() {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    final EntityRelationshipObject first =
        EntityRelationshipWriter.row(FIRST, SECOND, Entity.FOLDER, Entity.CONTEXT_FILE, RELATION);
    final EntityRelationshipObject second =
        EntityRelationshipWriter.row(SECOND, FIRST, Entity.FOLDER, Entity.CONTEXT_FILE, RELATION);
    final List<EntityRelationshipObject> input = List.of(second, first);
    store.writer().insertMany(input);
    assertEquals(List.of(first, second), store.insertOrder);
    assertSame(second, input.getFirst());
    assertTrue(store.rdf.isEmpty());
    assertTrue(store.invalidated.isEmpty());
    store.writer().insertMany(null);
    store.writer().insertMany(List.of());
    assertEquals(1, store.writes);
  }

  @Test
  void incomingDeletionHonorsOptionalRelatedTypeAndOutgoingDeletionIsDirectional() {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    final EntityRelationshipWriter writer = store.writer();
    writer.add(edge(FIRST, SECOND), Value.EMPTY, false);
    writer.add(
        new Edge(new UUID(0, 3), SECOND, Entity.USER, Entity.CONTEXT_FILE, RELATION),
        Value.EMPTY,
        false);
    writer.deleteIncoming(new Selection(SECOND, Entity.CONTEXT_FILE, RELATION, Entity.FOLDER));
    assertEquals(Entity.USER, store.rows.getFirst().getFromEntity());
    writer.deleteIncoming(new Selection(SECOND, Entity.CONTEXT_FILE, RELATION, null));
    assertTrue(store.rows.isEmpty());
    writer.add(edge(FIRST, SECOND), Value.EMPTY, false);
    writer.deleteOutgoing(new Selection(SECOND, Entity.CONTEXT_FILE, RELATION, Entity.FOLDER));
    assertEquals(1, store.rows.size());
    writer.deleteOutgoing(new Selection(FIRST, Entity.FOLDER, RELATION, Entity.CONTEXT_FILE));
    assertTrue(store.rows.isEmpty());
  }

  @Test
  void failedSqlDoesNotPublishCacheOrRdfEffects() {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    store.failure = new IllegalStateException("write failed");
    assertSame(
        store.failure,
        assertThrows(
            IllegalStateException.class,
            () -> store.writer().add(edge(FIRST, SECOND), Value.EMPTY, true)));
    assertTrue(store.rdf.isEmpty());
    assertTrue(store.invalidated.isEmpty());
    assertTrue(store.rows.isEmpty());
  }

  private static Edge edge(final UUID from, final UUID to) {
    return new Edge(from, to, Entity.FOLDER, Entity.CONTEXT_FILE, RELATION);
  }
}
