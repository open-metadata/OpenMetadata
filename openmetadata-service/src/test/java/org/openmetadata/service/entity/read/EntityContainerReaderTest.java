package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATABASE;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.TABLE;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

class EntityContainerReaderTest {
  @Test
  void emptyInputsAndNoRowsDoNotResolveReferences() {
    final Fixture fixture = new Fixture();
    assertTrue(fixture.reader.containers(null, null, ALL).isEmpty());
    assertTrue(fixture.reader.containers(List.of(), null, ALL).isEmpty());
    assertTrue(fixture.reader.inheritanceParents(null, TABLE).isEmpty());
    assertTrue(fixture.reader.inheritanceParents(List.of(), TABLE).isEmpty());
    assertEquals(0, fixture.queries.size());
    assertTrue(fixture.reader.containers(List.of(fixture.table), null, ALL).isEmpty());
    assertTrue(fixture.resolved.isEmpty());
    fixture.rows = null;
    assertTrue(fixture.reader.containers(List.of(fixture.table), null, ALL).isEmpty());
  }

  @Test
  void typedAndUntypedQueriesPreserveTheRequestedInclude() {
    final Fixture fixture = new Fixture();
    final EntityReference parent = fixture.parent(DATABASE_SCHEMA);
    fixture.rows.add(fixture.row(parent, fixture.table.getId()));
    assertEquals(
        Map.of(fixture.table.getId(), parent),
        fixture.reader.containers(List.of(fixture.table), DATABASE_SCHEMA, ALL));
    assertEquals(new Query(DATABASE_SCHEMA, ALL), fixture.queries.getLast());
    assertEquals(
        new Resolution(DATABASE_SCHEMA, List.of(parent.getId()), ALL), fixture.resolved.getLast());
    fixture.reader.containers(List.of(fixture.table), null, NON_DELETED);
    assertEquals(new Query(null, NON_DELETED), fixture.queries.getLast());
    assertEquals(NON_DELETED, fixture.resolved.getLast().include());
  }

  @Test
  void parentReferencesStaySeparatedByTypeAndKeepTheFirstResolvedEdge() {
    final Fixture fixture = new Fixture();
    final EntityReference schema = fixture.parent(DATABASE_SCHEMA);
    final EntityReference database = fixture.parent(DATABASE).withId(schema.getId());
    final Table second = new Table().withId(UUID.randomUUID());
    fixture.rows.add(fixture.row(schema, fixture.table.getId()));
    fixture.rows.add(fixture.row(database, fixture.table.getId()));
    fixture.rows.add(fixture.row(database, second.getId()));
    fixture.rows.add(fixture.row(schema, fixture.table.getId()));
    final var result = fixture.reader.containers(List.of(fixture.table, second), null, ALL);
    assertSame(schema, result.get(fixture.table.getId()));
    assertSame(database, result.get(second.getId()));
    assertEquals(2, fixture.resolved.size());
    fixture.resolved.forEach(resolution -> assertEquals(1, resolution.ids().size()));
  }

  @Test
  void nullColumnsAndUnresolvedParentsDoNotProduceContainers() {
    final Fixture fixture = new Fixture();
    final EntityReference parent = fixture.parent(DATABASE_SCHEMA);
    fixture.rows.add(EntityRelationshipObject.builder().fromId(parent.getId().toString()).build());
    fixture.rows.add(EntityRelationshipObject.builder().fromEntity(DATABASE_SCHEMA).build());
    fixture.rows.add(fixture.row(parent, null));
    fixture.rows.add(
        fixture.row(
            new EntityReference().withType(DATABASE_SCHEMA).withId(UUID.randomUUID()),
            fixture.table.getId()));
    assertTrue(fixture.reader.containers(List.of(fixture.table), null, ALL).isEmpty());
    assertEquals(2, fixture.resolved.getFirst().ids().size());
  }

  @Test
  void duplicateReferenceIdsStillFailInsteadOfChoosingOne() {
    final Fixture fixture = new Fixture();
    final EntityReference parent = fixture.parent(DATABASE_SCHEMA);
    fixture.parents.get(DATABASE_SCHEMA).add(parent);
    fixture.rows.add(fixture.row(parent, fixture.table.getId()));
    assertThrows(
        IllegalStateException.class,
        () -> fixture.reader.containers(List.of(fixture.table), null, ALL));
  }

  @Test
  void inheritanceUsesLiveEdgesAndDoesNotLoadAnotherReferenceProjection() {
    final Fixture fixture = new Fixture();
    final EntityReference first = fixture.parent(DATABASE_SCHEMA);
    fixture.rows.add(fixture.row(first, fixture.table.getId()));
    fixture.rows.add(fixture.row(fixture.parent(DATABASE_SCHEMA), fixture.table.getId()));
    fixture.rows.add(fixture.row(fixture.parent(DATABASE_SCHEMA), fixture.table.getId()));
    final var result = fixture.reader.inheritanceParents(List.of(fixture.table), TABLE);
    assertEquals(
        new EntityReference().withType(DATABASE_SCHEMA).withId(first.getId()),
        result.get(fixture.table.getId()));
    assertEquals(List.of(new Query(null, NON_DELETED)), fixture.queries);
    assertTrue(fixture.resolved.isEmpty());
  }

  @Test
  void inheritanceSkipsMalformedEdgesAndRetainsTheFirstValidParent() {
    final Fixture fixture = new Fixture();
    final EntityReference parent = fixture.parent(DATABASE_SCHEMA);
    fixture.rows.add(fixture.row(parent, null));
    fixture.rows.add(
        EntityRelationshipObject.builder()
            .toId(fixture.table.getId().toString())
            .fromEntity("")
            .fromId("")
            .build());
    fixture.rows.add(
        EntityRelationshipObject.builder()
            .toId(fixture.table.getId().toString())
            .fromEntity(DATABASE_SCHEMA)
            .fromId("")
            .build());
    fixture.rows.add(fixture.row(parent, fixture.table.getId()));
    assertEquals(
        parent.getId(),
        fixture
            .reader
            .inheritanceParents(List.of(fixture.table), TABLE)
            .get(fixture.table.getId())
            .getId());
  }

  @Test
  void invalidUuidValuesRetainTheirFailures() {
    final Fixture fixture = new Fixture();
    fixture.rows.add(
        EntityRelationshipObject.builder()
            .fromId("invalid")
            .fromEntity(DATABASE_SCHEMA)
            .toId(fixture.table.getId().toString())
            .build());
    assertThrows(
        IllegalArgumentException.class,
        () -> fixture.reader.containers(List.of(fixture.table), null, ALL));
    assertThrows(
        IllegalArgumentException.class,
        () -> fixture.reader.inheritanceParents(List.of(fixture.table), TABLE));
  }

  private record Query(String type, Include include) {}

  private record Resolution(String type, List<UUID> ids, Include include) {}

  private static final class Fixture {
    private final Table table = new Table().withId(UUID.randomUUID());
    private List<EntityRelationshipObject> rows = new ArrayList<>();
    private final Map<String, List<EntityReference>> parents = new HashMap<>();
    private final List<Query> queries = new ArrayList<>();
    private final List<Resolution> resolved = new ArrayList<>();
    private final EntityBatchReferenceReader reader;

    private Fixture() {
      final EntityRelationshipDAO dao =
          mock(
              EntityRelationshipDAO.class,
              call -> {
                assertEquals("findFromBatch", call.getMethod().getName());
                assertEquals(Relationship.CONTAINS.ordinal(), (Integer) call.getArgument(1));
                final boolean typed = call.getArguments().length == 4;
                queries.add(
                    new Query(typed ? call.getArgument(2) : null, call.getArgument(typed ? 3 : 2)));
                return rows;
              });
      reader =
          new EntityBatchReferenceReader(
              () -> dao,
              (type, ids, include) -> {
                resolved.add(new Resolution(type, ids, include));
                return parents.getOrDefault(type, List.of()).stream()
                    .filter(parent -> ids.contains(parent.getId()))
                    .toList();
              });
    }

    private EntityReference parent(final String type) {
      final EntityReference parent =
          new EntityReference().withType(type).withId(UUID.randomUUID()).withName("parent");
      parents.computeIfAbsent(type, ignored -> new ArrayList<>()).add(parent);
      return parent;
    }

    private EntityRelationshipObject row(final EntityReference parent, final UUID target) {
      return EntityRelationshipObject.builder()
          .fromId(parent.getId().toString())
          .fromEntity(parent.getType())
          .toId(target == null ? null : target.toString())
          .build();
    }
  }
}
