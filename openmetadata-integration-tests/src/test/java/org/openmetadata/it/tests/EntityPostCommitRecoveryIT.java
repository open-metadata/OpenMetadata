package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexRetryQueueDAO.SearchIndexRetryRecord;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.LineageUtil;
import org.openmetadata.service.util.PostCommitActionQueue;

@Isolated("Temporarily replaces only the external search client")
@ExtendWith(TestNamespaceExtension.class)
class EntityPostCommitRecoveryIT {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void searchFailureQueuesRepairOnlyAfterTheOwningCommit(boolean rollback, TestNamespace ns) {
    final Domain domain = domain(ns, "search" + rollback);
    final var repository = Entity.getEntityRepository(Entity.DOMAIN);
    final AtomicBoolean laterAction = new AtomicBoolean();
    final Runnable mutation =
        () ->
            repository.executeInTransaction(
                () -> {
                  domain.setDescription("committed description");
                  repository.getDao().update(domain);
                  EntityCaches.invalidations()
                      .referencesChanged(
                          Entity.DOMAIN, domain.getId(), domain.getFullyQualifiedName());
                  SearchRepository.deferOrRunSearchWrite(
                      () -> {
                        throw new IllegalStateException("search unavailable");
                      },
                      "cascade",
                      domain.getId().toString(),
                      domain.getFullyQualifiedName(),
                      Entity.DOMAIN);
                  PostCommitActionQueue.runOrDefer(() -> laterAction.set(true));
                  assertNull(retry(domain));
                  assertFalse(laterAction.get());
                  if (rollback) throw new IllegalStateException("Discard the domain change");
                  return null;
                });
    try {
      if (rollback) assertThrows(IllegalStateException.class, mutation::run);
      else mutation.run();
      final Domain stored =
          Entity.getEntity(Entity.DOMAIN, domain.getId(), "", Include.NON_DELETED);
      assertEquals(
          rollback ? "original description" : "committed description", stored.getDescription());
      assertEquals(!rollback, laterAction.get());
      if (rollback) assertNull(retry(domain));
      else assertRetry(domain, "cascade: search unavailable");
    } finally {
      deleteRetry(domain);
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void lineageFailurePreservesCommittedEdgesAndQueuesDestinationRepair(
      boolean remove, TestNamespace ns) throws ReflectiveOperationException {
    final Domain upstream = domain(ns, "upstream" + remove);
    final Domain downstream = domain(ns, "downstream" + remove);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table from = table(ns, "from", schema.getFullyQualifiedName(), upstream);
    final Table to = table(ns, "to", schema.getFullyQualifiedName(), downstream);
    relationships()
        .insert(
            from.getId(),
            to.getId(),
            Entity.TABLE,
            Entity.TABLE,
            Relationship.UPSTREAM.ordinal(),
            null);
    if (remove)
      LineageUtil.addDomainLineage(from.getId(), Entity.TABLE, upstream.getEntityReference());
    final AtomicBoolean laterAction = new AtomicBoolean();
    try (var ignored = new FailedSearchClient(Set.of("updateLineage", "updateChildren"))) {
      Entity.getEntityRepository(Entity.TABLE)
          .executeInTransaction(
              () -> {
                if (remove) {
                  LineageUtil.removeDomainLineage(
                      from.getId(), Entity.TABLE, upstream.getEntityReference());
                } else {
                  LineageUtil.addDomainLineage(
                      from.getId(), Entity.TABLE, upstream.getEntityReference());
                }
                PostCommitActionQueue.runOrDefer(() -> laterAction.set(true));
                assertNull(retry(downstream));
                return null;
              });
      final var edge =
          relationships()
              .getRecord(upstream.getId(), downstream.getId(), Relationship.UPSTREAM.ordinal());
      if (remove) assertNull(edge);
      else assertNotNull(edge);
      assertRetry(downstream, "lineage: search unavailable");
      assertTrue(laterAction.get());
    } finally {
      deleteRetry(downstream);
    }
  }

  private static Domain domain(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(name))
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("original description")));
  }

  private static Table table(TestNamespace ns, String name, String schema, Domain domain) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix(name))
                .withDatabaseSchema(schema)
                .withDomains(List.of(domain.getFullyQualifiedName()))
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private static CollectionDAO.EntityRelationshipDAO relationships() {
    return Entity.getCollectionDAO().relationshipDAO();
  }

  private static SearchIndexRetryRecord retry(Domain domain) {
    return Entity.getCollectionDAO()
        .searchIndexRetryQueueDAO()
        .findByStatus(SearchIndexRetryQueue.STATUS_PENDING, 1000)
        .stream()
        .filter(record -> record.getEntityId().equals(domain.getId().toString()))
        .findFirst()
        .orElse(null);
  }

  private static void assertRetry(Domain domain, String reason) {
    final SearchIndexRetryRecord record = retry(domain);
    assertNotNull(record);
    assertEquals(domain.getFullyQualifiedName(), record.getEntityFqn());
    assertEquals(Entity.DOMAIN, record.getEntityType());
    assertEquals(reason, record.getFailureReason());
  }

  private static void deleteRetry(Domain domain) {
    Entity.getCollectionDAO()
        .searchIndexRetryQueueDAO()
        .deleteByEntity(domain.getId().toString(), domain.getFullyQualifiedName());
  }

  private static final class FailedSearchClient implements AutoCloseable {
    private final SearchRepository repository = Entity.getSearchRepository();
    private final SearchClient original = repository.getSearchClient();
    private final Field client = SearchRepository.class.getDeclaredField("searchClient");

    private FailedSearchClient(Set<String> failures) throws ReflectiveOperationException {
      client.setAccessible(true);
      client.set(
          repository,
          Proxy.newProxyInstance(
              SearchClient.class.getClassLoader(),
              new Class<?>[] {SearchClient.class},
              (proxy, method, arguments) -> {
                if (failures.contains(method.getName()))
                  throw new IllegalStateException("search unavailable");
                try {
                  return method.invoke(original, arguments);
                } catch (InvocationTargetException failure) {
                  throw failure.getCause();
                }
              }));
    }

    @Override
    public void close() throws IllegalAccessException {
      client.set(repository, original);
    }
  }
}
