package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.jdbi3.RepositoryDependencies;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.FullyQualifiedName;

@ExtendWith(TestNamespaceExtension.class)
class EntityCreateLifecycleIT {
  private enum Path {
    SINGLE,
    BULK,
    IMPORT
  }

  @ParameterizedTest
  @EnumSource(Path.class)
  void persistsColumnExtensionsAcrossCreatePaths(Path path, TestNamespace ns) {
    final var tables = tables(path, ns);
    create(repository(), path, tables);
    assertStoredColumns(tables);
    for (Table table : tables) {
      final var byId = SdkClients.adminClient().tables().get(table.getId().toString(), "columns");
      final var byName =
          SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns");
      assertEquals(table.getColumns(), byId.getColumns());
      assertEquals(byId.getColumns(), byName.getColumns());
    }
  }

  @ParameterizedTest
  @EnumSource(Path.class)
  void writesCanonicalRedisEntriesBeforeReturning(Path path, TestNamespace ns) {
    final var tables = tables(path, ns);
    assumeTrue(CacheBundle.getCachedEntityDao() != null);
    create(repository(), path, tables);
    assertCanonicalCache(tables);
  }

  @Test
  void nestedBulkCreateDoesNotDiscardTheEnclosingStoredJson(TestNamespace ns) {
    final var tables = tables(Path.SINGLE, ns);
    assumeTrue(CacheBundle.getCachedEntityDao() != null);
    final var dependencies =
        new RepositoryDependencies(
            Entity.getCollectionDAO(),
            Entity.getJobDAO(),
            Entity.getSearchRepository(),
            repository().getRelationshipRepository());
    final var repository =
        new TableRepository(dependencies) {
          @Override
          protected void postCreate(Table table) {
            super.postCreate(table);
            table.setDescription("Only the response was enriched");
            createMany(null, List.of());
          }
        };
    create(repository, Path.SINGLE, tables);
    assertCanonicalCache(tables);
  }

  private static void assertCanonicalCache(List<Table> tables) {
    for (Table table : tables) {
      final String stored =
          Entity.getJdbi()
              .withHandle(
                  handle ->
                      handle
                          .createQuery("SELECT json FROM table_entity WHERE id = :id")
                          .bind("id", table.getId().toString())
                          .mapTo(String.class)
                          .one());
      final var cache = CacheBundle.getCachedEntityDao();
      assertEquals(
          JsonUtils.readTree(stored),
          JsonUtils.readTree(cache.getBase(table.getId(), Entity.TABLE).orElseThrow()));
      assertEquals(
          JsonUtils.readTree(stored),
          JsonUtils.readTree(
              cache.getByName(Entity.TABLE, table.getFullyQualifiedName()).orElseThrow()));
    }
  }

  @ParameterizedTest
  @EnumSource(Path.class)
  void failedCreateRollsBackRowsExtensionsAndCache(Path path, TestNamespace ns) {
    final var tables = tables(path, ns);
    assertThrows(
        IllegalStateException.class, () -> create(new FaultyTableRepository(false), path, tables));
    assertAbsent(tables);
  }

  @ParameterizedTest
  @EnumSource(Path.class)
  void deadlockReplayPersistsEachColumnOnce(Path path, TestNamespace ns) {
    final var tables = tables(path, ns);
    final var repository = new FaultyTableRepository(true);
    create(repository, path, tables);
    assertEquals(2, repository.attempts);
    assertStoredColumns(tables);
  }

  @ParameterizedTest
  @EnumSource(Path.class)
  void enclosingTransactionRetainsRollbackOwnership(Path path, TestNamespace ns) {
    final var tables = tables(path, ns);
    final var repository = repository();
    assertThrows(
        IllegalStateException.class,
        () ->
            repository.executeInTransaction(
                () -> {
                  create(repository, path, tables);
                  throw new IllegalStateException("Rollback the owning transaction");
                }));
    assertAbsent(tables);
  }

  private static void create(TableRepository repository, Path path, List<Table> tables) {
    switch (path) {
      case SINGLE -> repository.createInternal(tables.getFirst());
      case BULK -> repository.createMany(null, tables);
      case IMPORT -> {
        tables.forEach(table -> repository.prepareInternal(table, false));
        repository.createManyEntitiesForImport(tables);
      }
    }
  }

  private static List<Table> tables(Path path, TestNamespace ns) {
    SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    return IntStream.range(0, path == Path.SINGLE ? 1 : 2)
        .mapToObj(
            index ->
                new Table()
                    .withId(UUID.randomUUID())
                    .withName(ns.prefix("create" + index))
                    .withDatabaseSchema(schema.getEntityReference())
                    .withUpdatedBy("admin")
                    .withUpdatedAt(System.currentTimeMillis())
                    .withColumns(
                        List.of(
                            new Column()
                                .withName("parent")
                                .withDataType(ColumnDataType.STRUCT)
                                .withExtension(Map.of("createValue", "parent"))
                                .withChildren(
                                    List.of(
                                        new Column()
                                            .withName("child")
                                            .withDataType(ColumnDataType.BIGINT)
                                            .withExtension(Map.of("createValue", "child")))))))
        .toList();
  }

  private static void assertStoredColumns(List<Table> tables) {
    for (Table table : tables) {
      assertEquals(2, count("entity_extension", table.getId()));
      final var parent = table.getColumns().getFirst();
      for (Column column : List.of(parent, parent.getChildren().getFirst())) {
        final String json =
            Entity.getJdbi()
                .withHandle(
                    handle ->
                        handle
                            .createQuery(
                                "SELECT json FROM entity_extension WHERE id = :id AND extension = :extension")
                            .bind("id", table.getId().toString())
                            .bind(
                                "extension",
                                FullyQualifiedName.buildHash(column.getFullyQualifiedName()))
                            .mapTo(String.class)
                            .one());
        assertEquals(JsonUtils.valueToTree(column.getExtension()), JsonUtils.readTree(json));
      }
    }
  }

  private static void assertAbsent(List<Table> tables) {
    for (Table table : tables) {
      assertEquals(0, count("table_entity", table.getId()));
      assertEquals(0, count("entity_extension", table.getId()));
      final var cache = CacheBundle.getCachedEntityDao();
      if (cache != null) {
        assertTrue(cache.getBase(table.getId(), Entity.TABLE).isEmpty());
        assertTrue(cache.getByName(Entity.TABLE, table.getFullyQualifiedName()).isEmpty());
      }
    }
  }

  private static int count(String table, UUID id) {
    return Entity.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT count(*) FROM " + table + " WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private static TableRepository repository() {
    return (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  private static final class FaultyTableRepository extends TableRepository {
    private final boolean retry;
    private int attempts;

    private FaultyTableRepository(boolean retry) {
      super(
          new RepositoryDependencies(
              Entity.getCollectionDAO(),
              Entity.getJobDAO(),
              Entity.getSearchRepository(),
              repository().getRelationshipRepository()));
      this.retry = retry;
    }

    @Override
    public void storeRelationships(Table table) {
      super.storeRelationships(table);
      fail();
    }

    @Override
    protected void storeEntitySpecificRelationshipsForMany(List<Table> tables) {
      super.storeEntitySpecificRelationshipsForMany(tables);
      fail();
    }

    private void fail() {
      attempts++;
      if (!retry) {
        throw new IllegalStateException("Injected after the relationship write");
      }
      if (attempts == 1) {
        throw new RuntimeException(
            "Injected deadlock", new SQLException("Deadlock", "40001", 1213));
      }
    }
  }
}
