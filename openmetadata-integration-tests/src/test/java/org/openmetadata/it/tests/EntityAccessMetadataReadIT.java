package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.RequestEntityCache;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Counts relationship SQL during authorization and inheritance hydration")
class EntityAccessMetadataReadIT {
  @Test
  void authorizationLoadsOwnersAndDomainsWithOneRelationshipQuery(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final List<Table> entities =
        fixture.tables().stream().map(table -> new Table().withId(table.getId())).toList();
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_relationship")) {
      repository().enrichEntitiesForAuth(entities);
      assertMetadata(fixture, entities);
      assertEquals(1, queries.count());
    } finally {
      RequestEntityCache.clear();
    }
  }

  @Test
  void inheritanceLoadsRequestedOwnersAndDomainsWithOneRelationshipQuery(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final List<Table> entities =
        fixture.tables().stream().map(table -> new Table().withId(table.getId())).toList();
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_relationship")) {
      repository()
          .fetchInheritableRelationships(
              entities, repository().fieldPolicy().parse("owners,domains"));
      assertMetadata(fixture, entities);
      assertEquals(1, queries.count());
    } finally {
      RequestEntityCache.clear();
    }
  }

  @Test
  void absentLocalRelationshipsRetainAuthorizationValuesButClearRequestedInheritance(
      TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final Table entity =
        new Table()
            .withId(UUID.randomUUID())
            .withOwners(List.of(fixture.owner().withInherited(true)))
            .withDomains(List.of(fixture.domain().withInherited(true)));
    final List<EntityReference> owners = entity.getOwners();
    final List<EntityReference> domains = entity.getDomains();
    repository().enrichEntitiesForAuth(List.of(entity));
    assertSame(owners, entity.getOwners());
    assertSame(domains, entity.getDomains());
    repository()
        .fetchInheritableRelationships(
            List.of(entity), repository().fieldPolicy().parse("owners,domains"));
    assertTrue(entity.getOwners().isEmpty());
    assertTrue(entity.getDomains().isEmpty());
  }

  @Test
  void emptyAuthorizationAndUnrequestedInheritanceSkipRelationshipQueries(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_relationship")) {
      repository().enrichEntitiesForAuth(null);
      repository().enrichEntitiesForAuth(List.of());
      repository()
          .fetchInheritableRelationships(fixture.tables(), repository().fieldPolicy().parse(""));
      assertEquals(0, queries.count());
    }
  }

  @Test
  void deletedRelationshipRowsRemainAvailableForInheritance(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    Entity.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "UPDATE entity_relationship SET deleted = TRUE WHERE toId IN (<ids>)")
                    .bindList(
                        "ids",
                        fixture.tables().stream().map(table -> table.getId().toString()).toList())
                    .execute());
    final List<Table> entities =
        fixture.tables().stream().map(table -> new Table().withId(table.getId())).toList();
    repository()
        .fetchInheritableRelationships(
            entities, repository().fieldPolicy().parse("owners,domains"));
    assertMetadata(fixture, entities);
  }

  @Test
  void combinedQueriesChunkLargeInputsWithoutDuplicatingRelationships(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    final List<String> ids = new ArrayList<>();
    ids.add(fixture.tables().getFirst().getId().toString());
    IntStream.range(0, EntityDAO.MAX_IN_LIST_CHUNK_SIZE + 1)
        .mapToObj(index -> new UUID(0, index).toString())
        .forEach(ids::add);
    ids.add(fixture.tables().getLast().getId().toString());
    ids.add(fixture.tables().getFirst().getId().toString());
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_relationship")) {
      final var records =
          Entity.getCollectionDAO().relationshipDAO().findOwnersAndDomainsBatch(ids);
      assertEquals(4, records.size());
      assertEquals(2, records.stream().map(record -> record.getToId()).distinct().count());
      assertEquals(2, queries.count());
    }
  }

  private void assertMetadata(final Fixture fixture, final List<Table> entities) {
    for (final Table entity : entities) {
      assertEquals(
          List.of(fixture.owner().getId()),
          entity.getOwners().stream().map(EntityReference::getId).toList());
      assertEquals(
          List.of(fixture.domain().getId()),
          entity.getDomains().stream().map(EntityReference::getId).toList());
    }
  }

  private Fixture fixture(final TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var user = UserTestFactory.createUser(ns, "access_owner");
    final var domain =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("access_domain"))
                    .withDescription("Access metadata query regression")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final List<Table> tables =
        List.of(
            create(
                ns,
                "first",
                schema.getFullyQualifiedName(),
                user.getEntityReference(),
                domain.getFullyQualifiedName()),
            create(
                ns,
                "second",
                schema.getFullyQualifiedName(),
                user.getEntityReference(),
                domain.getFullyQualifiedName()));
    RequestEntityCache.clear();
    return new Fixture(tables, user.getEntityReference(), domain.getEntityReference());
  }

  private Table create(
      final TestNamespace ns,
      final String name,
      final String schema,
      final EntityReference owner,
      final String domain) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix(name))
                .withDatabaseSchema(schema)
                .withOwners(List.of(owner))
                .withDomains(List.of(domain))
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private TableRepository repository() {
    return (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  private record Fixture(List<Table> tables, EntityReference owner, EntityReference domain) {}
}
