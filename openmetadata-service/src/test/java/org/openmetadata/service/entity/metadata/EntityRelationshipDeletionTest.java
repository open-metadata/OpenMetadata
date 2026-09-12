package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.BatchSelection;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

class EntityRelationshipDeletionTest {
  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void bothDirectionsBoundTheCanonicalDeleteToFiveHundredIds(final boolean incoming) {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    final List<UUID> ids = IntStream.range(0, 1001).mapToObj(value -> new UUID(0, value)).toList();
    final UUID related = UUID.randomUUID();
    ids.forEach(id -> store.rows.add(row(id, related, Entity.USER, Relationship.OWNS, incoming)));
    final EntityRelationshipObject outside =
        row(UUID.randomUUID(), related, Entity.USER, Relationship.OWNS, incoming);
    store.rows.add(outside);
    delete(
        store.writer(), new BatchSelection(ids, Entity.TABLE, Relationship.OWNS, null), incoming);
    assertEquals(List.of(outside), store.rows);
    assertEquals(3, store.writes);
    assertEquals(List.of(500, 500, 1), store.deletionSizes);
    assertTrue(store.rdf.isEmpty());
    assertTrue(store.invalidated.isEmpty());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void typedPredicatesRetainOtherTypesAndRelations(final boolean incoming) {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    final UUID entity = UUID.randomUUID();
    final UUID related = UUID.randomUUID();
    final EntityRelationshipObject removed =
        row(entity, related, Entity.USER, Relationship.OWNS, incoming);
    final EntityRelationshipObject otherType =
        row(entity, related, Entity.TEAM, Relationship.OWNS, incoming);
    final EntityRelationshipObject otherRelation =
        row(entity, related, Entity.USER, Relationship.HAS, incoming);
    store.rows.addAll(List.of(removed, otherType, otherRelation));
    delete(
        store.writer(),
        new BatchSelection(List.of(entity), Entity.TABLE, Relationship.OWNS, Entity.USER),
        incoming);
    assertEquals(List.of(otherType, otherRelation), store.rows);
    assertEquals(1, store.writes);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void emptySelectionsDoNotAcquireADaoButNullIdsRetainTheirFailure(final boolean incoming) {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    delete(store.writer(), new BatchSelection(List.of(), null, null, null), incoming);
    assertEquals(0, store.writes);
    assertThrows(
        NullPointerException.class,
        () ->
            delete(
                store.writer(),
                new BatchSelection(null, Entity.TABLE, Relationship.OWNS, null),
                incoming));
    assertThrows(
        NullPointerException.class,
        () ->
            delete(
                store.writer(),
                new BatchSelection(
                    Arrays.asList(UUID.randomUUID(), null), Entity.TABLE, Relationship.OWNS, null),
                incoming));
    assertEquals(0, store.writes);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void duplicateIdsKeepTheirOccurrencesAndCallerOrder(final boolean incoming) {
    final RelationshipStoreFixture store = new RelationshipStoreFixture();
    final UUID id = UUID.randomUUID();
    final List<UUID> ids = new ArrayList<>(List.of(id, id));
    delete(
        store.writer(),
        new BatchSelection(ids, Entity.TABLE, Relationship.OWNS, Entity.USER),
        incoming);
    assertEquals(List.of(id, id), ids);
    assertEquals(List.of(2), store.deletionSizes);
  }

  private static EntityRelationshipObject row(
      final UUID entity,
      final UUID related,
      final String relatedType,
      final Relationship relation,
      final boolean incoming) {
    return EntityRelationshipWriter.row(
        incoming ? related : entity,
        incoming ? entity : related,
        incoming ? relatedType : Entity.TABLE,
        incoming ? Entity.TABLE : relatedType,
        relation);
  }

  private static void delete(
      final EntityRelationshipWriter writer,
      final BatchSelection selection,
      final boolean incoming) {
    if (incoming) {
      writer.deleteIncomingMany(selection);
    } else {
      writer.deleteOutgoingMany(selection);
    }
  }
}
