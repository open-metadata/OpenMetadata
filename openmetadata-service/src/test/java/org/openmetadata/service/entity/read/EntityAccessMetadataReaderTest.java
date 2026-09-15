package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;

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
import org.openmetadata.service.entity.read.EntityAccessMetadataReader.Projection;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

class EntityAccessMetadataReaderTest {
  @Test
  void combinedReadFiltersDeletedOwnersButRetainsDeletedDomains() {
    final Fixture fixture = new Fixture();
    final EntityReference owner = fixture.reference(USER, false);
    final EntityReference deletedOwner = fixture.reference(TEAM, true);
    final EntityReference domain = fixture.reference(DOMAIN, true);
    fixture.owns(owner);
    fixture.owns(deletedOwner);
    fixture.domain(domain);
    final var metadata = fixture.read(true, true);
    assertEquals(List.of(owner), metadata.owners().get(fixture.entity.getId()));
    assertEquals(List.of(domain), metadata.domains().get(fixture.entity.getId()));
  }

  @Test
  void ownerOnlyReadUsesAllRelationshipsAndNonDeletedReferences() {
    final Fixture fixture = new Fixture();
    final EntityReference owner = fixture.reference(TEAM, false);
    fixture.owns(owner);
    fixture.domain(fixture.reference(DOMAIN, false));
    final var metadata = fixture.read(true, false);
    assertEquals(List.of(owner), metadata.owners().get(fixture.entity.getId()));
    assertTrue(metadata.domains().isEmpty());
  }

  @Test
  void domainOnlyReadRetainsTheDomainTypeFilter() {
    final Fixture fixture = new Fixture();
    final EntityReference domain = fixture.reference(DOMAIN, false);
    fixture.domain(domain);
    fixture.owns(fixture.reference(USER, false));
    final var metadata = fixture.read(false, true);
    assertTrue(metadata.owners().isEmpty());
    assertEquals(List.of(domain), metadata.domains().get(fixture.entity.getId()));
  }

  @Test
  void duplicateRelationshipsKeepTheirOrderAndReuseResolvedReferences() {
    final Fixture fixture = new Fixture();
    final EntityReference first = fixture.reference(USER, false);
    final EntityReference second = fixture.reference(USER, false);
    fixture.owns(second);
    fixture.owns(first);
    fixture.owns(second);
    final Table other = new Table().withId(UUID.randomUUID());
    fixture.owners.add(fixture.relationship(other, first, Relationship.OWNS));
    fixture.entities.add(other);
    final var metadata = fixture.read(true, true);
    assertEquals(List.of(second, first, second), metadata.owners().get(fixture.entity.getId()));
    assertSame(first, metadata.owners().get(other.getId()).getFirst());
  }

  @Test
  void missingOwnerReferencesAreOmittedButMissingDomainReferencesRetainNull() {
    final Fixture fixture = new Fixture();
    fixture.owns(fixture.reference(USER, false));
    fixture.domain(fixture.reference(DOMAIN, false));
    fixture.references.clear();
    final var metadata = fixture.read(true, true);
    assertFalse(metadata.owners().containsKey(fixture.entity.getId()));
    assertEquals(1, metadata.domains().get(fixture.entity.getId()).size());
    assertNull(metadata.domains().get(fixture.entity.getId()).getFirst());
  }

  @Test
  void duplicateOwnerReferencesRetainTheFirstMatch() {
    final Fixture fixture = new Fixture();
    final EntityReference first = fixture.reference(USER, false);
    fixture.references.get(USER).add(new EntityReference().withId(first.getId()).withType(USER));
    fixture.owns(first);
    assertSame(first, fixture.read(true, false).owners().get(fixture.entity.getId()).getFirst());
  }

  @Test
  void duplicateDomainReferencesRetainTheExistingFailure() {
    final Fixture fixture = new Fixture();
    final EntityReference domain = fixture.reference(DOMAIN, false);
    fixture.references.get(DOMAIN).add(domain);
    fixture.domain(domain);
    assertThrows(IllegalStateException.class, () -> fixture.read(false, true));
  }

  @Test
  void authorizationRetainsExistingValuesWhenLocalRelationshipsAreAbsent() {
    final Fixture fixture = new Fixture();
    final List<EntityReference> owners =
        List.of(fixture.reference(USER, false).withInherited(true));
    final List<EntityReference> domains =
        List.of(fixture.reference(DOMAIN, false).withInherited(true));
    fixture.entity.withOwners(owners).withDomains(domains);
    fixture.prepareQueries();
    fixture.reader.populateForAuth(fixture.entities);
    assertSame(owners, fixture.entity.getOwners());
    assertSame(domains, fixture.entity.getDomains());
  }

  @Test
  void inheritanceOnlyReplacesRequestedFields() {
    final Fixture fixture = new Fixture();
    final List<EntityReference> domains = List.of(fixture.reference(DOMAIN, false));
    fixture.entity.withDomains(domains).withOwners(List.of(fixture.reference(USER, false)));
    fixture.prepareQueries();
    fixture.reader.populateForInheritance(fixture.entities, new Projection(true, false));
    assertTrue(fixture.entity.getOwners().isEmpty());
    assertSame(domains, fixture.entity.getDomains());
    fixture.reader.populateForInheritance(fixture.entities, new Projection(false, true));
    assertTrue(fixture.entity.getDomains().isEmpty());
  }

  @Test
  void emptyInputsAndUnrequestedFieldsDoNotAccessPersistence() {
    final EntityAccessMetadataReader reader =
        new EntityAccessMetadataReader(
            () -> {
              throw new AssertionError("Unexpected relationship read");
            },
            (type, ids, include) -> {
              throw new AssertionError("Unexpected reference read");
            });
    reader.populateForAuth(null);
    reader.populateForAuth(List.of());
    assertTrue(reader.read(List.of(), new Projection(true, true)).owners().isEmpty());
    reader.populateForInheritance(
        List.of(new Table().withId(UUID.randomUUID())), new Projection(false, false));
  }

  @Test
  void aReferenceReadFailurePropagatesWithoutAssigningPartialAuthorization() {
    final Fixture fixture = new Fixture();
    fixture.owns(fixture.reference(USER, false));
    fixture.domain(fixture.reference(DOMAIN, false));
    fixture.prepareQueries();
    final IllegalStateException failure =
        new IllegalStateException("Reference storage unavailable");
    final EntityAccessMetadataReader reader =
        new EntityAccessMetadataReader(
            () -> fixture.dao,
            (type, ids, include) -> {
              if (DOMAIN.equals(type)) {
                throw failure;
              }
              return fixture.resolve(type, ids, include);
            });
    assertSame(
        failure,
        assertThrows(IllegalStateException.class, () -> reader.populateForAuth(fixture.entities)));
    assertTrue(fixture.entity.getOwners() == null || fixture.entity.getOwners().isEmpty());
  }

  private static final class Fixture {
    private final Table entity = new Table().withId(UUID.randomUUID());
    private final List<Table> entities = new ArrayList<>(List.of(entity));
    private final EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class);
    private final List<EntityRelationshipObject> owners = new ArrayList<>();
    private final List<EntityRelationshipObject> domains = new ArrayList<>();
    private final Map<String, List<EntityReference>> references = new HashMap<>();
    private final EntityAccessMetadataReader reader =
        new EntityAccessMetadataReader(() -> dao, this::resolve);

    private EntityAccessMetadataReader.Metadata read(final boolean owners, final boolean domains) {
      prepareQueries();
      return reader.read(entities, new Projection(owners, domains));
    }

    private void prepareQueries() {
      final List<String> ids = entities.stream().map(table -> table.getId().toString()).toList();
      final List<EntityRelationshipObject> combined = new ArrayList<>(owners);
      combined.addAll(domains);
      when(dao.findOwnersAndDomainsBatch(ids)).thenReturn(combined);
      when(dao.findFromBatch(ids, Relationship.OWNS.ordinal(), ALL)).thenReturn(owners);
      when(dao.findFromBatch(ids, Relationship.HAS.ordinal(), DOMAIN, ALL)).thenReturn(domains);
    }

    private EntityReference reference(final String type, final boolean deleted) {
      final EntityReference reference =
          new EntityReference().withId(UUID.randomUUID()).withType(type).withDeleted(deleted);
      references.computeIfAbsent(type, ignored -> new ArrayList<>()).add(reference);
      return reference;
    }

    private List<EntityReference> resolve(
        final String type, final List<UUID> ids, final Include include) {
      assertEquals(ids.size(), ids.stream().distinct().count());
      assertEquals(DOMAIN.equals(type) ? ALL : NON_DELETED, include);
      return references.getOrDefault(type, List.of()).stream()
          .filter(reference -> ids.contains(reference.getId()))
          .filter(reference -> include == ALL || !Boolean.TRUE.equals(reference.getDeleted()))
          .toList();
    }

    private void owns(final EntityReference reference) {
      owners.add(relationship(entity, reference, Relationship.OWNS));
    }

    private void domain(final EntityReference reference) {
      domains.add(relationship(entity, reference, Relationship.HAS));
    }

    private EntityRelationshipObject relationship(
        final Table table, final EntityReference reference, final Relationship relationship) {
      return EntityRelationshipObject.builder()
          .toId(table.getId().toString())
          .toEntity("table")
          .fromId(reference.getId().toString())
          .fromEntity(reference.getType())
          .relation(relationship.ordinal())
          .build();
    }
  }
}
