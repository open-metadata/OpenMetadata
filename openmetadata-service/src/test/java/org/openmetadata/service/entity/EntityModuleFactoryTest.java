package org.openmetadata.service.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.service.entity.bulk.EntityBulkPreparation;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityModuleFactoryTest {
  @Test
  void constructsNativeServicesWithoutRepositoryInheritanceOrDatabaseReads() {
    final FlatPolicy policy = policy("flat");
    EntityModuleFactory.initialize(policy, false);
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
    EntityModuleFactory.initialize(first, false);
    EntityModuleFactory.initialize(second, false);
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
    EntityModuleFactory.initialize(policy, false);
    final var reader = policy.reads();
    assertThrows(IllegalStateException.class, () -> EntityModuleFactory.initialize(policy, false));
    assertSame(reader, policy.reads());
  }

  @Test
  void bulkPreparationUsesTheInitializedGraphAndReleasesItsParentScope() {
    final FlatPolicy policy = policy("bulk");
    EntityModuleFactory.initialize(policy, false);
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
    EntityModuleFactory.initialize(policy, false);
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
