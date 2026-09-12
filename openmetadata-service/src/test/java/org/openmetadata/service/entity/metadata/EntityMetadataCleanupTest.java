package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityMetadataWriter.Field;
import org.openmetadata.service.entity.metadata.EntityMetadataWriter.Schema;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

class EntityMetadataCleanupTest {
  @Test
  void allSharedMetadataIsRemovedInItsExistingOrderWithoutDeletingContainerEdges() {
    final Fixture fixture = new Fixture(true, Set.of(Field.values()));
    fixture.populate();
    final Table unrelated = new Table().withId(UUID.randomUUID());
    final EntityRelationshipObject untouched =
        EntityRelationshipWriter.row(
            UUID.randomUUID(), unrelated.getId(), Entity.USER, Entity.TABLE, Relationship.OWNS);
    fixture.store.rows.add(untouched);
    fixture.cleanup.clearMany(List.of(fixture.table));
    assertEquals(List.of(fixture.container, untouched), fixture.store.rows);
    assertEquals(
        List.of("tags", "OWNS:null", "HAS:domain", "REVIEWS:null", "HAS:dataProduct"),
        fixture.operations);
    assertTrue(fixture.tags.isEmpty());
    assertEquals(4, fixture.store.writes);
    assertTrue(fixture.store.invalidated.isEmpty());
  }

  @Test
  void unsupportedFieldsLeaveTheirRowsAndTagsUntouched() {
    final Fixture fixture = new Fixture(false, Set.of(Field.OWNERS, Field.REVIEWERS));
    fixture.populate();
    fixture.cleanup.clearMany(List.of(fixture.table));
    assertEquals(3, fixture.store.rows.size());
    assertTrue(fixture.store.rows.contains(fixture.container));
    assertEquals(List.of(fixture.table.getFullyQualifiedName()), fixture.tags);
    assertEquals(List.of("OWNS:null", "REVIEWS:null"), fixture.operations);
    assertEquals(2, fixture.store.writes);
  }

  @Test
  void duplicateEntitiesKeepTheirTagAndRelationshipBindings() {
    final Fixture fixture = new Fixture(true, Set.of(Field.OWNERS));
    fixture.populate();
    fixture.cleanup.clearMany(List.of(fixture.table, fixture.table));
    assertEquals(
        List.of(fixture.table.getFullyQualifiedName(), fixture.table.getFullyQualifiedName()),
        fixture.deletedTags);
    assertEquals(List.of(2), fixture.store.deletionSizes);
  }

  @Test
  void emptyAndNullInputsRetainTheirBoundaryBehavior() {
    final Fixture fixture = new Fixture(true, Set.of(Field.values()));
    fixture.cleanup.clearMany(List.of());
    assertThrows(NullPointerException.class, () -> fixture.cleanup.clearMany(null));
    assertTrue(fixture.operations.isEmpty());
  }

  @Test
  void tagDeletionFailureStopsRelationshipDeletion() {
    final Fixture fixture = new Fixture(true, Set.of(Field.values()));
    fixture.populate();
    fixture.failTags = true;
    assertThrows(
        IllegalStateException.class, () -> fixture.cleanup.clearMany(List.of(fixture.table)));
    assertEquals(6, fixture.store.rows.size());
    assertEquals(0, fixture.store.writes);
  }

  @Test
  void relationshipFailurePreservesPrecedingTagDeletionForTheOwningRollback() {
    final Fixture fixture = new Fixture(true, Set.of(Field.values()));
    fixture.populate();
    fixture.store.failure = new IllegalStateException("Relationship deletion failed");
    assertThrows(
        IllegalStateException.class, () -> fixture.cleanup.clearMany(List.of(fixture.table)));
    assertTrue(fixture.tags.isEmpty());
    assertEquals(List.of("tags", "OWNS:null"), fixture.operations);
  }

  private static final class Fixture {
    private final Table table =
        new Table().withId(UUID.randomUUID()).withFullyQualifiedName("service.schema.table");
    private final RelationshipStoreFixture store = new RelationshipStoreFixture();
    private final List<String> tags = new ArrayList<>();
    private final List<String> operations = new ArrayList<>();
    private final EntityMetadataCleanup cleanup;
    private List<String> deletedTags;
    private EntityRelationshipObject container;
    private boolean failTags;

    private Fixture(final boolean supportsTags, final Set<Field> fields) {
      cleanup =
          new EntityMetadataCleanup(
              new EntityMetadataCleanup.Capabilities(
                  new Schema(Entity.TABLE, fields), supportsTags),
              fqns -> {
                operations.add("tags");
                if (failTags) {
                  throw new IllegalStateException("Tag deletion failed");
                }
                deletedTags = fqns;
                tags.removeAll(fqns);
              },
              selection -> {
                operations.add(selection.relation().name() + ":" + selection.relatedType());
                store.writer().deleteIncomingMany(selection);
              });
    }

    private void populate() {
      tags.add(table.getFullyQualifiedName());
      add(Entity.USER, Relationship.OWNS);
      add(Entity.TEAM, Relationship.OWNS);
      add(Entity.DOMAIN, Relationship.HAS);
      add(Entity.USER, Relationship.REVIEWS);
      add(Entity.DATA_PRODUCT, Relationship.HAS);
      container = add(Entity.DATABASE_SCHEMA, Relationship.CONTAINS);
    }

    private EntityRelationshipObject add(final String type, final Relationship relation) {
      final EntityRelationshipObject row =
          EntityRelationshipWriter.row(
              UUID.randomUUID(), table.getId(), type, Entity.TABLE, relation);
      store.rows.add(row);
      return row;
    }
  }
}
