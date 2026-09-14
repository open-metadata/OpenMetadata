package org.openmetadata.service.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.entity.bulk.EntityBulkPreparation;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DocumentRepository;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityModuleFactoryTest {
  @Test
  void constructionDoesNotPublishAnUnconfiguredRepository() {
    final FlatPolicy policy = policy("unconfigured-" + UUID.randomUUID());
    EntityModuleFactory.initialize(policy);
    assertFalse(Entity.hasEntityRepository(policy.getEntityType()));
  }

  @Test
  void pilotRepositoriesUseInjectedInfrastructureWithoutReplacingRegisteredModules() {
    final var entities = Set.copyOf(Entity.getEntityList());
    final var daos = mock(CollectionDAO.class);
    final var charts = mock(CollectionDAO.ChartDAO.class);
    final var tables = mock(CollectionDAO.TableDAO.class);
    final var documents = mock(CollectionDAO.DocStoreDAO.class);
    when(daos.chartDAO()).thenReturn(charts);
    when(daos.tableDAO()).thenReturn(tables);
    when(daos.docStoreDAO()).thenReturn(documents);
    final var dependencies =
        new EntityModuleDependencies(daos, null, null, null, Clock.systemUTC());
    assertSame(charts, new ChartRepository(dependencies).getDao());
    assertSame(tables, new TableRepository(dependencies).getDao());
    assertSame(documents, new DocumentRepository(dependencies).getDao());
    assertEquals(entities, Entity.getEntityList());
  }

  @Test
  void applicationContractCannotExposeStorageOrPartialWriteSteps() {
    final var internal =
        Set.of(
            "getDao",
            "preparation",
            "bulkPreparation",
            "persistence",
            "subtrees",
            "context",
            "prepare",
            "storeEntity");
    for (final var method : EntityModule.class.getMethods()) {
      assertFalse(internal.contains(method.getName()), method::toString);
    }
  }

  @Test
  void startupUsesTheAvailableConstructor() {
    final var config = new OpenMetadataApplicationConfig();
    final var jdbi = mock(Jdbi.class);
    EntityModuleFactory.create(ConfigConstructor.class, config, jdbi);
    EntityModuleFactory.create(DatabaseConstructor.class, config, jdbi);
    assertSame(config, ConfigConstructor.received);
    assertSame(jdbi, DatabaseConstructor.received);
  }

  @Test
  void failedConstructionCannotFallBackToAnUnconfiguredInstance() {
    final var failure =
        assertThrows(
            IllegalStateException.class,
            () ->
                EntityModuleFactory.create(
                    FailingConstructor.class, new OpenMetadataApplicationConfig(), null));
    assertTrue(failure.getMessage().contains(FailingConstructor.class.getName()));
    assertInstanceOf(IllegalArgumentException.class, failure.getCause().getCause());
    assertFalse(FailingConstructor.fallbackCalled);
  }

  public static final class ConfigConstructor {
    private static OpenMetadataApplicationConfig received;

    public ConfigConstructor(OpenMetadataApplicationConfig config) {
      received = config;
    }
  }

  public static final class DatabaseConstructor {
    private static Jdbi received;

    public DatabaseConstructor(Jdbi jdbi) {
      received = jdbi;
    }
  }

  public static final class FailingConstructor {
    private static boolean fallbackCalled;

    public FailingConstructor() {
      throw new IllegalArgumentException("Invalid repository definition");
    }

    public FailingConstructor(OpenMetadataApplicationConfig config) {
      fallbackCalled = true;
    }
  }

  @Test
  void constructsNativeServicesWithoutRepositoryInheritanceOrDatabaseReads() {
    final FlatPolicy policy = policy("flat");
    EntityModuleFactory.initialize(policy);
    final Container entity = new Container().withId(UUID.randomUUID()).withName("name");
    policy.preparation().prepare(entity, false);
    assertEquals("prepared", entity.getDescription());
    assertEquals("name", entity.getFullyQualifiedName());
    assertSame(policy.creates(), policy.creates());
    assertSame(policy.reads(), policy.reads());
    assertSame(policy.persistence(), policy.persistence());
    assertEquals("flat", policy.getEntityType());
    assertEquals(Container.class, policy.getEntityClass());
  }

  @Test
  void independentGraphsKeepTheirInjectedCanonicalRows() {
    final FlatPolicy first = policy("first");
    final FlatPolicy second = policy("second");
    EntityModuleFactory.initialize(first);
    EntityModuleFactory.initialize(second);
    assertNotSame(first.reads(), second.reads());
    final UUID id = UUID.randomUUID();
    when(first.getDao().findEntityById(id, ALL))
        .thenReturn(new Container().withId(id).withName("first"));
    when(second.getDao().findEntityById(id, ALL))
        .thenReturn(new Container().withId(id).withName("second"));
    assertEquals("first", first.lookup().byId(id, ALL, false).getName());
    assertEquals("second", second.lookup().byId(id, ALL, false).getName());
  }

  @Test
  void anInitializedPolicyCannotRebuildItsGraph() {
    final FlatPolicy policy = policy("once");
    EntityModuleFactory.initialize(policy);
    final var reader = policy.reads();
    assertThrows(IllegalStateException.class, () -> EntityModuleFactory.initialize(policy));
    assertSame(reader, policy.reads());
  }

  @Test
  void bulkPreparationUsesTheInitializedGraphAndReleasesItsParentScope() {
    final FlatPolicy policy = policy("bulk");
    EntityModuleFactory.initialize(policy);
    final Container parent = new Container().withId(UUID.randomUUID()).withName("parent");
    policy.setParentCache(Map.of(parent.getId(), parent));
    assertSame(parent, policy.getCachedParentOrLoad(parent.getEntityReference(), "", ALL));
    final Container child = new Container().withId(UUID.randomUUID()).withName("child");
    final var prepared = policy.bulkPreparation().prepare(List.of(child));
    assertEquals(List.of(child), prepared.prepared());
    assertEquals("prepared", prepared.prepared().getFirst().getDescription());
    assertNull(policy.context().parentCache().get());
  }

  @Test
  void parentCacheCannotGrowBeyondTheSqlChunkAcrossPolicyCalls() {
    final FlatPolicy policy = policy("bounded");
    EntityModuleFactory.initialize(policy);
    policy.setParentCache(Map.of());
    final var cache = policy.context().parentCache().get();
    for (int index = 0; index <= EntityBulkPreparation.MAX_PARENTS; index++) {
      final Container parent = new Container().withId(new UUID(0, index));
      cache.put(parent.getId(), parent);
    }
    cache.cleanUp();
    assertEquals(EntityBulkPreparation.MAX_PARENTS, cache.size());
    policy.clearParentCache();
    assertNull(policy.context().parentCache().get());
  }

  @SuppressWarnings("unchecked")
  private static FlatPolicy policy(final String type) {
    final EntityDAO<Container> rows = mock(EntityDAO.class);
    when(rows.getTableName()).thenReturn("container_entity");
    final CollectionDAO daos =
        mock(
            CollectionDAO.class,
            call -> {
              throw new AssertionError(
                  "Unexpected database access during module construction: "
                      + call.getMethod().getName());
            });
    final var schema = new EntityPolicyContext.Schema<>("/containers", type, Container.class, rows);
    final var fields = new EntityPolicyContext.WriteFields("", "", Set.of());
    final var dependencies =
        new EntityModuleDependencies(daos, null, null, null, Clock.systemUTC());
    return new FlatPolicy(new EntityPolicyContext<>(schema, fields, dependencies));
  }

  private record FlatPolicy(EntityPolicyContext<Container> context)
      implements EntityPolicy<Container> {
    @Override
    public void setFields(Container entity, Fields fields, RelationIncludes includes) {}

    @Override
    public void clearFields(Container entity, Fields fields) {}

    @Override
    public void prepare(Container entity, boolean update) {
      entity.setDescription("prepared");
    }

    @Override
    public void storeEntity(Container entity, boolean update) {
      persistence().store(entity, update);
    }

    @Override
    public void storeRelationships(Container entity) {}
  }
}
