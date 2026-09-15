package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.delete.EntityDeletionPersistence;
import org.openmetadata.service.entity.delete.EntityDependentCleanup;
import org.openmetadata.service.jdbi3.TableRepository;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
class EntityDependentCleanupIT {
  private static final String EXTENSION = "cleanup.transaction.probe";

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void dependentRowsRollBackWithTheEntityRow(boolean bulk, TestNamespace ns) {
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    final var collection = Entity.getCollectionDAO();
    collection
        .entityExtensionDAO()
        .insert(table.getId(), EXTENSION, "cleanupProbe", "\"retained\"");
    final var cleanup = cleanup();
    final var repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);

    assertThrows(
        IllegalStateException.class,
        () ->
            repository.executeInTransaction(
                () -> {
                  if (bulk) {
                    cleanup.deleteMany(List.of(table));
                  } else {
                    cleanup.delete("operator", table);
                  }
                  assertNull(
                      collection.entityExtensionDAO().getExtension(table.getId(), EXTENSION));
                  assertEquals(
                      List.of(),
                      collection
                          .relationshipDAO()
                          .findFrom(
                              table.getId(),
                              Entity.TABLE,
                              Relationship.CONTAINS.ordinal(),
                              Entity.DATABASE_SCHEMA));
                  throw new IllegalStateException(
                      "Injected failure after deleting metadata and the entity row");
                }));

    assertEquals(
        "\"retained\"", collection.entityExtensionDAO().getExtension(table.getId(), EXTENSION));
    assertEquals(
        schema.getId(),
        collection
            .relationshipDAO()
            .findFrom(
                table.getId(),
                Entity.TABLE,
                Relationship.CONTAINS.ordinal(),
                Entity.DATABASE_SCHEMA)
            .getFirst()
            .getId());
    assertEquals(1, storedRows(table));
    assertEquals(
        table.getId(), SdkClients.adminClient().tables().get(table.getId().toString()).getId());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void dependentRowsCommitWithTheEntityRow(boolean bulk, TestNamespace ns) {
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    final var collection = Entity.getCollectionDAO();
    collection
        .entityExtensionDAO()
        .insert(table.getId(), EXTENSION, "cleanupProbe", "\"retained\"");
    final var persistence = cleanup();
    if (bulk) {
      persistence.deleteMany(List.of(table));
    } else {
      persistence.delete("operator", table);
    }
    assertNull(collection.entityExtensionDAO().getExtension(table.getId(), EXTENSION));
    assertEquals(
        List.of(),
        collection
            .relationshipDAO()
            .findFrom(
                table.getId(),
                Entity.TABLE,
                Relationship.CONTAINS.ordinal(),
                Entity.DATABASE_SCHEMA));
    assertEquals(0, storedRows(table));
  }

  private static int storedRows(Table table) {
    return Entity.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT count(*) FROM table_entity WHERE id = :id")
                    .bind("id", table.getId().toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private EntityDeletionPersistence<Table> cleanup() {
    final var collection = Entity.getCollectionDAO();
    final var repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    return new EntityDeletionPersistence<>(
        new EntityDeletionPersistence.Schema<>(Entity.TABLE, collection.tableDAO(), collection),
        new EntityDeletionPersistence.Policy(
            new EntityDependentCleanup.Policy(() -> true, () -> false), () -> true),
        new EntityDeletionPersistence.Hooks<>((actor, entity) -> {}, entity -> {}, entity -> {}),
        work ->
            repository.executeInTransaction(
                () -> {
                  work.run();
                  return null;
                }));
  }
}
