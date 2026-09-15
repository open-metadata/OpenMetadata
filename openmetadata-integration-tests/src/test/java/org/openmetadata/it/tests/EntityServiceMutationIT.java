package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Injects failures after real service writes and counts the owning transaction")
class EntityServiceMutationIT {
  private static final String CHANGED_HOST = "changed.example:5432";

  @Test
  void connectionAndVersionCommitOnceBeforePublishingBothAliases(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      fixture.mutation().update();
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    final DatabaseService stored = repository().getDao().findEntityById(fixture.id(), NON_DELETED);
    assertEquals(0.2, stored.getVersion());
    assertEquals(CHANGED_HOST, host(stored));
    final String changes = JsonUtils.pojoToJson(stored.getChangeDescription());
    assertFalse(changes.contains(CHANGED_HOST));
    assertEquals(
        "connection", stored.getChangeDescription().getFieldsUpdated().getFirst().getName());
    assertAliases(fixture, CHANGED_HOST, 0.2);
    assertEquals(
        fixture.historySize() + 1,
        SdkClients.adminClient()
            .databaseServices()
            .getVersionList(fixture.id())
            .getVersions()
            .size());
  }

  @Test
  void failedServiceRowWriteRollsBackTheConnectionHistoryAndCachedAliases(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "update " + repository().getDao().getTableName(),
                () -> new IllegalStateException("Failure after service row update"))) {
      assertThrows(RuntimeException.class, fixture.mutation()::update);
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertUnchanged(fixture);
  }

  @Test
  void anEnclosingTransactionOwnsTheServiceConnectionChange(TestNamespace ns) {
    final Fixture fixture = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              repository()
                  .executeInTransaction(
                      () -> {
                        fixture.mutation().update();
                        assertEquals(
                            CHANGED_HOST,
                            host(repository().getDao().findEntityById(fixture.id(), NON_DELETED)));
                        throw new IllegalStateException("Failure in enclosing transaction");
                      }));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertUnchanged(fixture);
  }

  private Fixture fixture(TestNamespace ns) {
    final DatabaseService created = DatabaseServiceTestFactory.createPostgres(ns);
    final var services = SdkClients.adminClient().databaseServices();
    services.get(created.getId().toString(), "connection");
    services.getByName(created.getFullyQualifiedName(), "connection");
    final DatabaseService original =
        repository().getDao().findEntityById(created.getId(), NON_DELETED);
    final String originalJson = JsonUtils.pojoToJson(original);
    final DatabaseService updated =
        JsonUtils.deepCopy(original, DatabaseService.class)
            .withUpdatedBy("admin")
            .withUpdatedAt(original.getUpdatedAt() + 1);
    updated
        .getConnection()
        .setConfig(
            JsonUtils.convertValue(updated.getConnection().getConfig(), PostgresConnection.class)
                .withHostPort(CHANGED_HOST));
    repository().preparation().prepare(updated, true);
    final var mutation = repository().getUpdater(original, updated, EntityOperation.PATCH, null);
    mutation.setPatchedFields(Set.of("connection"));
    return new Fixture(
        originalJson, mutation, services.getVersionList(created.getId()).getVersions().size());
  }

  private void assertUnchanged(Fixture fixture) {
    final DatabaseService original =
        JsonUtils.readValue(fixture.originalJson(), DatabaseService.class);
    final DatabaseService stored = repository().getDao().findEntityById(fixture.id(), NON_DELETED);
    assertEquals(JsonUtils.readTree(fixture.originalJson()), JsonUtils.valueToTree(stored));
    assertAliases(fixture, host(original), original.getVersion());
    assertEquals(
        fixture.historySize(),
        SdkClients.adminClient()
            .databaseServices()
            .getVersionList(fixture.id())
            .getVersions()
            .size());
  }

  private void assertAliases(Fixture fixture, String expectedHost, double expectedVersion) {
    final var services = SdkClients.adminClient().databaseServices();
    for (final DatabaseService service :
        List.of(
            services.get(fixture.id().toString(), "connection"),
            services.getByName(fixture.mutation().getOriginalFqn(), "connection"))) {
      assertEquals(expectedHost, host(service));
      assertEquals(expectedVersion, service.getVersion());
    }
  }

  private static String host(DatabaseService service) {
    return JsonUtils.convertValue(service.getConnection().getConfig(), PostgresConnection.class)
        .getHostPort();
  }

  private static DatabaseServiceRepository repository() {
    return (DatabaseServiceRepository) Entity.getEntityRepository(Entity.DATABASE_SERVICE);
  }

  private record Fixture(
      String originalJson, EntityUpdater<DatabaseService> mutation, int historySize) {
    private UUID id() {
      return mutation.getUpdated().getId();
    }
  }
}
