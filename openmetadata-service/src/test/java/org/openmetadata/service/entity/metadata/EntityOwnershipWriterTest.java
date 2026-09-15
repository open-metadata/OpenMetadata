package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityMetadataWriter.Field;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Edge;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Value;
import org.openmetadata.service.entity.write.EntityChangeRecorder;

class EntityOwnershipWriterTest {
  @Test
  void ownerChangesReassertTheWholeRequestedSetAfterGroupedRemovals() {
    final Fixture fixture = new Fixture();
    final EntityReference removedUser = reference(Entity.USER);
    final EntityReference removedTeam = reference(Entity.TEAM);
    final EntityReference retained = reference(Entity.USER);
    final EntityReference added = reference(Entity.TEAM);
    fixture.seed(removedUser, Relationship.OWNS);
    fixture.seed(removedTeam, Relationship.OWNS);
    final List<EntityReference> requested = List.of(retained, added);
    fixture.writer.owners(fixture.table, List.of(removedUser, removedTeam, retained), requested);
    assertEquals(
        Set.of(retained.getId().toString(), added.getId().toString()), fixture.storedIds());
    assertEquals(3, fixture.store.writes);
    assertSame(requested, fixture.storedOwners);
    assertTrue(fixture.store.rdf.isEmpty());
    assertTrue(fixture.store.invalidated.isEmpty());
  }

  @Test
  void sameIdsWithDifferentMetadataOrderOrMultiplicityRemainANoop() {
    final Fixture fixture = new Fixture();
    final EntityReference owner = reference(Entity.USER);
    final EntityReference renamed =
        new EntityReference().withId(owner.getId()).withType(Entity.TEAM).withName("renamed");
    fixture.writer.owners(fixture.table, List.of(owner, owner), List.of(renamed));
    fixture.writer.domains(
        fixture.table, () -> fixture.lineageTarget, List.of(owner), List.of(renamed, renamed));
    assertEquals(0, fixture.store.writes);
    assertTrue(fixture.lineage.isEmpty());
    fixture.writer.domains(
        fixture.table,
        () -> {
          throw new AssertionError("Unchanged domains need no lineage target");
        },
        List.of(owner),
        List.of(owner));
  }

  @Test
  void addingOnlyAndRemovingAllOwnersKeepTheOriginalShortCircuits() {
    final Fixture fixture = new Fixture();
    final EntityReference owner = reference(Entity.USER);
    fixture.writer.owners(fixture.table, List.of(), List.of(owner));
    assertEquals(Set.of(owner.getId().toString()), fixture.storedIds());
    fixture.writer.owners(fixture.table, List.of(owner), List.of());
    assertTrue(fixture.store.rows.isEmpty());
    assertEquals(2, fixture.store.writes);
    assertEquals(List.of(), fixture.storedOwners);
  }

  @Test
  void domainRemovalKeepsTheUpdatedEntityLineageIdentityAndLocalRelationshipIdentity() {
    final Fixture fixture = new Fixture();
    final EntityReference removed = reference(Entity.DOMAIN);
    final EntityReference added = reference(Entity.DOMAIN);
    fixture.seed(removed, Relationship.HAS);
    final List<EntityReference> requested = List.of(added);
    fixture.writer.domains(fixture.table, () -> fixture.lineageTarget, List.of(removed), requested);
    assertEquals(Set.of(added.getId().toString()), fixture.storedIds());
    assertEquals(List.of(fixture.lineageTarget + ":" + removed.getId()), fixture.lineage);
    assertSame(requested, fixture.storedDomains);
    assertEquals(2, fixture.store.writes);
    assertEquals(1, fixture.store.rdf.size());
  }

  @Test
  void addingOnlyAndRemovingAllDomainsStillCallTheRepositoryStorePolicy() {
    final Fixture fixture = new Fixture();
    final EntityReference domain = reference(Entity.DOMAIN);
    fixture.writer.domains(fixture.table, () -> fixture.lineageTarget, List.of(), List.of(domain));
    assertTrue(fixture.lineage.isEmpty());
    fixture.writer.domains(fixture.table, () -> fixture.lineageTarget, List.of(domain), List.of());
    assertTrue(fixture.store.rows.isEmpty());
    assertEquals(List.of(), fixture.storedDomains);
    assertEquals(2, fixture.store.writes);
  }

  @Test
  void malformedOwnerTypesFailBeforeAnyRemoval() {
    final Fixture fixture = new Fixture();
    final EntityReference owner = reference(null);
    assertThrows(
        NullPointerException.class,
        () -> fixture.writer.owners(fixture.table, List.of(owner), List.of()));
    assertEquals(0, fixture.store.writes);
  }

  @Test
  void failedRemovalDoesNotStoreRequestedMetadata() {
    final Fixture fixture = new Fixture();
    fixture.store.failure = new IllegalStateException("Removal failed");
    assertThrows(
        IllegalStateException.class,
        () -> fixture.writer.owners(fixture.table, List.of(reference(Entity.USER)), List.of()));
    assertThrows(
        IllegalStateException.class,
        () ->
            fixture.writer.domains(
                fixture.table,
                () -> fixture.lineageTarget,
                List.of(reference(Entity.DOMAIN)),
                List.of()));
    assertEquals(0, fixture.storeCalls);
    assertEquals(1, fixture.lineage.size());
  }

  @Test
  void differenceKeepsOrderDuplicatesNullKeysAndMutableResults() {
    final List<String> result =
        EntityChangeRecorder.difference(
            List.of(reference(null), new EntityReference(), reference(Entity.USER)),
            List.of(new EntityReference()),
            EntityReference::getId,
            EntityReference::getId,
            reference -> reference.getId().toString());
    assertEquals(2, result.size());
    result.add("mutable");
    final List<Integer> duplicates =
        EntityChangeRecorder.difference(
            List.of(2, 1, 2, 3), List.of(1), value -> value, value -> value, value -> value * 10);
    assertEquals(List.of(20, 20, 30), duplicates);
  }

  @Test
  void nullDifferenceInputsRetainTheirFailures() {
    final Fixture fixture = new Fixture();
    assertThrows(
        NullPointerException.class, () -> fixture.writer.owners(fixture.table, null, List.of()));
    assertThrows(
        NullPointerException.class,
        () -> fixture.writer.domains(fixture.table, () -> fixture.lineageTarget, List.of(), null));
    assertEquals(0, fixture.store.writes);
  }

  private static EntityReference reference(final String type) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type);
  }

  private static final class Fixture {
    private final Table table = new Table().withId(UUID.randomUUID());
    private final UUID lineageTarget = UUID.randomUUID();
    private final RelationshipStoreFixture store = new RelationshipStoreFixture();
    private final EntityRelationshipWriter relationships = store.writer();
    private final List<String> lineage = new ArrayList<>();
    private final EntityOwnershipWriter<Table> writer;
    private List<EntityReference> storedOwners;
    private List<EntityReference> storedDomains;
    private int storeCalls;

    private Fixture() {
      final EntityMetadataWriter metadata =
          new EntityMetadataWriter(
              new EntityMetadataWriter.Schema(Entity.TABLE, Set.of(Field.OWNERS, Field.DOMAINS)),
              relationships,
              refs -> {},
              (id, domain) -> {});
      writer =
          new EntityOwnershipWriter<>(
              Entity.TABLE,
              () -> store.dao,
              relationships,
              new EntityOwnershipWriter.Writes<>(
                  (entity, owners) -> {
                    storedOwners = owners;
                    storeCalls++;
                    metadata.store(Field.OWNERS, entity, owners);
                  },
                  (entity, domains) -> {
                    storedDomains = domains;
                    storeCalls++;
                    metadata.store(Field.DOMAINS, entity, domains);
                  },
                  (id, domain) -> lineage.add(id + ":" + domain.getId())));
    }

    private void seed(final EntityReference reference, final Relationship relation) {
      relationships.add(
          new Edge(reference.getId(), table.getId(), reference.getType(), Entity.TABLE, relation),
          Value.EMPTY,
          false);
      store.writes = 0;
      store.rdf.clear();
      store.invalidated.clear();
    }

    private Set<String> storedIds() {
      return store.rows.stream().map(row -> row.getFromId()).collect(Collectors.toSet());
    }
  }
}
