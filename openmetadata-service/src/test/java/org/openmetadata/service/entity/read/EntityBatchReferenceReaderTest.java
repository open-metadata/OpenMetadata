package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

class EntityBatchReferenceReaderTest {
  @Test
  void outgoingQueriesKeepTypedReferencesIncludingDeletedValues() {
    final Fixture fixture = new Fixture();
    final EntityReference user = fixture.reference("user").withDeleted(true);
    fixture.outgoing(Relationship.EXPERT, "user", fixture.outgoingRow(user));
    final var result = fixture.reader.outgoing(fixture.entities, Relationship.EXPERT, "user");
    assertEquals(List.of(user), result.get(fixture.entity.getId()));
  }

  @Test
  void incomingQueriesKeepTheirRelatedTypeAndInclude() {
    final Fixture fixture = new Fixture();
    final EntityReference domain = fixture.reference("domain").withDeleted(true);
    fixture.incoming(Relationship.HAS, "domain", fixture.incomingRow(domain));
    final var result = fixture.reader.incoming(fixture.entities, Relationship.HAS, "domain");
    assertEquals(List.of(domain), result.get(fixture.entity.getId()));
  }

  @Test
  void duplicateRowsPreserveOrderAndTheResolvedReferenceObjects() {
    final Fixture fixture = new Fixture();
    final EntityReference first = fixture.reference("user");
    final EntityReference second = fixture.reference("user");
    fixture.outgoing(
        Relationship.EXPERT,
        "user",
        fixture.outgoingRow(second),
        fixture.outgoingRow(first),
        fixture.outgoingRow(second));
    final var result = fixture.reader.outgoing(fixture.entities, Relationship.EXPERT, "user");
    assertEquals(List.of(second, first, second), result.get(fixture.entity.getId()));
    assertSame(second, result.get(fixture.entity.getId()).getFirst());
  }

  @Test
  void aSharedReferenceIsMappedToEveryEntityInTheBatch() {
    final Fixture fixture = new Fixture();
    final Table second = new Table().withId(UUID.randomUUID());
    final EntityReference shared = fixture.reference("user");
    final List<Table> entities = List.of(fixture.entity, second);
    final List<String> ids = entities.stream().map(table -> table.getId().toString()).toList();
    when(fixture.dao.findToBatch(ids, Relationship.EXPERT.ordinal(), "user", ALL))
        .thenReturn(
            List.of(
                fixture.outgoingRow(shared),
                EntityRelationshipObject.builder()
                    .fromId(second.getId().toString())
                    .fromEntity("table")
                    .toId(shared.getId().toString())
                    .toEntity("user")
                    .build()));
    final var result = fixture.reader.outgoing(entities, Relationship.EXPERT, "user");
    assertEquals(2, result.size());
    assertSame(shared, result.get(fixture.entity.getId()).getFirst());
    assertSame(shared, result.get(second.getId()).getFirst());
  }

  @Test
  void missingReferencesAreOmittedWithoutCreatingAnEmptyEntry() {
    final Fixture fixture = new Fixture();
    final EntityReference missing = fixture.reference("user");
    fixture.outgoing(Relationship.EXPERT, "user", fixture.outgoingRow(missing));
    fixture.incoming(Relationship.OWNS, "user", fixture.incomingRow(missing));
    fixture.references.clear();
    assertTrue(fixture.reader.outgoing(fixture.entities, Relationship.EXPERT, "user").isEmpty());
    assertTrue(fixture.reader.incoming(fixture.entities, Relationship.OWNS, "user").isEmpty());
  }

  @Test
  void duplicateReferenceRowsRetainTheTypedLookupFailure() {
    final Fixture fixture = new Fixture();
    final EntityReference reference = fixture.reference("user");
    fixture.references.get("user").add(reference);
    fixture.outgoing(Relationship.EXPERT, "user", fixture.outgoingRow(reference));
    assertThrows(
        IllegalStateException.class,
        () -> fixture.reader.outgoing(fixture.entities, Relationship.EXPERT, "user"));
  }

  @Test
  void childrenResolveTheFirstRowsTypeAsTheExistingFallbackDoes() {
    final Fixture fixture = new Fixture();
    final EntityReference child = fixture.reference("column");
    final EntityReference otherType = fixture.reference("testCase");
    fixture.outgoing(
        Relationship.CONTAINS, "table", fixture.outgoingRow(child), fixture.outgoingRow(otherType));
    assertEquals(
        List.of(child),
        fixture.reader.children(fixture.entities, "table").get(fixture.entity.getId()));
  }

  @Test
  void childrenWithAbsentRowsAvoidReferenceResolution() {
    final Fixture fixture = new Fixture();
    fixture.outgoing(Relationship.CONTAINS, "table");
    assertTrue(fixture.reader.children(fixture.entities, "table").isEmpty());
    when(fixture.dao.findToBatch(fixture.ids(), Relationship.CONTAINS.ordinal(), "table", ALL))
        .thenReturn(null);
    assertTrue(fixture.reader.children(fixture.entities, "table").isEmpty());
  }

  @Test
  void singleIncomingKeepsTheLastResolvedParentAcrossTypes() {
    final Fixture fixture = new Fixture();
    final EntityReference user = fixture.reference("user");
    final EntityReference team = fixture.reference("team");
    final EntityReference missing =
        new EntityReference().withId(UUID.randomUUID()).withType("user");
    when(fixture.dao.findFromBatch(fixture.ids(), Relationship.OWNS.ordinal(), ALL))
        .thenReturn(
            List.of(
                fixture.incomingRow(user),
                fixture.incomingRow(team),
                fixture.incomingRow(missing)));
    assertSame(
        team,
        fixture
            .reader
            .singleIncoming(fixture.entities, Relationship.OWNS)
            .get(fixture.entity.getId()));
  }

  @Test
  void singleIncomingOverwritesDuplicateReferenceResultsAsBefore() {
    final Fixture fixture = new Fixture();
    final EntityReference first = fixture.reference("user");
    final EntityReference last =
        new EntityReference().withId(first.getId()).withType("user").withName("last");
    fixture.references.get("user").add(last);
    when(fixture.dao.findFromBatch(fixture.ids(), Relationship.OWNS.ordinal(), ALL))
        .thenReturn(List.of(fixture.incomingRow(first)));
    assertSame(
        last,
        fixture
            .reader
            .singleIncoming(fixture.entities, Relationship.OWNS)
            .get(fixture.entity.getId()));
  }

  @Test
  void emptyEntitiesAvoidPersistenceAndUnknownParentsHaveNoEntry() {
    final EntityBatchReferenceReader reader =
        new EntityBatchReferenceReader(
            () -> {
              throw new AssertionError("Unexpected relationship query");
            },
            (type, ids, include) -> {
              throw new AssertionError("Unexpected reference query");
            });
    assertTrue(reader.incoming(null, Relationship.OWNS, "user").isEmpty());
    assertTrue(reader.outgoing(List.of(), Relationship.EXPERT, "user").isEmpty());
    assertTrue(reader.children(null, "table").isEmpty());
    assertTrue(reader.singleIncoming(List.of(), Relationship.CONTAINS).isEmpty());
    final Fixture fixture = new Fixture();
    when(fixture.dao.findFromBatch(fixture.ids(), Relationship.CONTAINS.ordinal(), ALL))
        .thenReturn(List.of());
    assertNull(
        fixture
            .reader
            .singleIncoming(fixture.entities, Relationship.CONTAINS)
            .get(fixture.entity.getId()));
  }

  private static final class Fixture {
    private final Table entity = new Table().withId(UUID.randomUUID());
    private final List<Table> entities = List.of(entity);
    private final EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class);
    private final Map<String, List<EntityReference>> references = new HashMap<>();
    private final EntityBatchReferenceReader reader =
        new EntityBatchReferenceReader(
            () -> dao,
            (type, ids, include) -> {
              assertEquals(ALL, include);
              assertEquals(ids.size(), ids.stream().distinct().count());
              return references.getOrDefault(type, List.of()).stream()
                  .filter(reference -> ids.contains(reference.getId()))
                  .toList();
            });

    private List<String> ids() {
      return List.of(entity.getId().toString());
    }

    private EntityReference reference(final String type) {
      final EntityReference reference =
          new EntityReference().withId(UUID.randomUUID()).withType(type);
      references.computeIfAbsent(type, ignored -> new ArrayList<>()).add(reference);
      return reference;
    }

    private void outgoing(
        final Relationship relationship,
        final String type,
        final EntityRelationshipObject... rows) {
      when(dao.findToBatch(ids(), relationship.ordinal(), type, ALL)).thenReturn(List.of(rows));
    }

    private void incoming(
        final Relationship relationship,
        final String type,
        final EntityRelationshipObject... rows) {
      when(dao.findFromBatch(ids(), relationship.ordinal(), type, ALL)).thenReturn(List.of(rows));
    }

    private EntityRelationshipObject incomingRow(final EntityReference reference) {
      return EntityRelationshipObject.builder()
          .fromId(reference.getId().toString())
          .fromEntity(reference.getType())
          .toId(entity.getId().toString())
          .toEntity("table")
          .build();
    }

    private EntityRelationshipObject outgoingRow(final EntityReference reference) {
      return EntityRelationshipObject.builder()
          .fromId(entity.getId().toString())
          .fromEntity("table")
          .toId(reference.getId().toString())
          .toEntity(reference.getType())
          .build();
    }
  }
}
