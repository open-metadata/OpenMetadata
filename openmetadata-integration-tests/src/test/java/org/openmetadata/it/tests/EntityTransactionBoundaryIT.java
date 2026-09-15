package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.DelegatingTransactionHandler;
import org.jdbi.v3.core.transaction.TransactionHandler;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityExtensionService;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.PostCommitActionQueue;

/** Checks the retained SQL-object transaction using real commits and persisted extension rows. */
@Isolated("Temporarily decorates the application's transaction handler")
class EntityTransactionBoundaryIT {
  private static final String EXTENSION = "transaction.boundary.test";

  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @Test
  void nestedDeadlockReplaysTheOwningTransaction() {
    final UUID first = UUID.randomUUID();
    final UUID second = UUID.randomUUID();
    final AtomicInteger attempts = new AtomicInteger();
    final AtomicInteger published = new AtomicInteger();
    final AtomicBoolean inject = new AtomicBoolean(true);
    final var repository = Entity.getEntityRepository(Entity.CHART);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      repository.executeInTransaction(
          () -> {
            attempts.incrementAndGet();
            insert(first);
            PostCommitActionQueue.runOrDefer(published::incrementAndGet);
            repository.executeInTransaction(
                () -> {
                  insert(second);
                  if (inject.getAndSet(false)) {
                    throw new RuntimeException(new SQLException("Nested deadlock", "40001", 1213));
                  }
                  return null;
                });
            return null;
          });
      assertEquals(2, attempts.get(), "The outer writes must replay after a nested deadlock");
      assertEquals(1, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertEquals("{}", read(first));
    assertEquals("{}", read(second));
    assertEquals(1, published.get());
  }

  @Test
  void nestedRepositoriesCommitOnceAndPublishAfterCommit() {
    UUID first = UUID.randomUUID();
    UUID second = UUID.randomUUID();
    List<String> published = new ArrayList<>();

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      Entity.getEntityRepository(Entity.CHART)
          .executeInTransaction(
              () -> {
                insert(first);
                Entity.getEntityRepository(Entity.TABLE)
                    .executeInTransaction(
                        () -> {
                          insert(second);
                          PostCommitActionQueue.runOrDefer(() -> published.add(read(second)));
                          return null;
                        });
                assertTrue(published.isEmpty(), "Nested work must wait for the outer commit");
                return null;
              });

      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
      assertEquals(List.of("{}"), published);
      assertEquals("{}", read(first));
    }
  }

  @Test
  void outerFailureRollsBackNestedWritesAndDiscardsPublication() {
    UUID first = UUID.randomUUID();
    UUID second = UUID.randomUUID();
    AtomicInteger published = new AtomicInteger();

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              Entity.getEntityRepository(Entity.CHART)
                  .executeInTransaction(
                      () -> {
                        insert(first);
                        Entity.getEntityRepository(Entity.TABLE)
                            .executeInTransaction(
                                () -> {
                                  insert(second);
                                  PostCommitActionQueue.runOrDefer(published::incrementAndGet);
                                  return null;
                                });
                        throw new IllegalStateException("Injected failure before commit");
                      }));

      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
      assertNull(read(first));
      assertNull(read(second));
      assertEquals(0, published.get());
      PostCommitActionQueue.runOrDefer(published::incrementAndGet);
      assertEquals(1, published.get(), "Rollback must release the request thread's collector");
    }
  }

  @Test
  void customPropertyReplacementPreservesColumnRowsAndCommitsOnce() {
    final EntityExtensionService extensions = extensions();
    final Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withExtension(Map.of("keep", "first", "remove", "obsolete"));
    final Column column = column(table.getId());

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      Entity.getEntityRepository(Entity.TABLE)
          .executeInTransaction(
              () -> {
                extensions.store(table);
                extensions.storeColumns(table.getId(), List.of(column));
                extensions.remove(
                    new Table().withId(table.getId()).withExtension(Map.of("remove", "ignored")));
                assertEquals(JsonUtils.readTree("{\"keep\":\"first\"}"), extensions.read(table));

                table.setExtension(Map.of("keep", "updated"));
                extensions.removeMany(List.of(table));
                extensions.storeMany(List.of(table));
                assertEquals(
                    JsonUtils.readTree("{\"keep\":\"updated\"}"),
                    extensions.readMany(List.of(table)).get(table.getId()));
                assertColumnExtension(table.getId(), column);
                return null;
              });

      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
      assertColumnExtension(table.getId(), column);
      assertEquals(JsonUtils.readTree("{\"keep\":\"updated\"}"), extensions.read(table));
    }
  }

  @Test
  void customPropertyAndNestedColumnWritesRollBackTogether() {
    final EntityExtensionService extensions = extensions();
    final Table table =
        new Table().withId(UUID.randomUUID()).withExtension(Map.of("keep", "value"));
    final Column column = column(table.getId());

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              Entity.getEntityRepository(Entity.TABLE)
                  .executeInTransaction(
                      () -> {
                        extensions.storeMany(List.of(table));
                        extensions.storeColumns(table.getId(), List.of(column));
                        assertColumnExtension(table.getId(), column);
                        throw new IllegalStateException("Injected custom-property rollback");
                      }));

      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
      assertNull(extensions.read(table));
      assertNull(readColumn(table.getId(), column));
      assertNull(readColumn(table.getId(), column.getChildren().getFirst()));
    }
  }

  private static EntityExtensionService extensions() {
    final String prefix = "transaction.customProperties";
    return new EntityExtensionService(
        () -> Entity.getCollectionDAO().entityExtensionDAO(),
        new EntityExtensionService.Properties(
            prefix,
            field -> prefix + "." + field,
            fqn -> fqn.substring(prefix.length() + 1),
            field -> "string"),
        true);
  }

  private static Column column(final UUID id) {
    final String fqn = "transaction." + id + ".parent";
    return new Column()
        .withName("parent")
        .withFullyQualifiedName(fqn)
        .withExtension(Map.of("note", "parent"))
        .withChildren(
            List.of(
                new Column()
                    .withName("child")
                    .withFullyQualifiedName(fqn + ".child")
                    .withExtension(Map.of("note", "child"))));
  }

  private static void assertColumnExtension(final UUID id, final Column column) {
    assertEquals(
        JsonUtils.valueToTree(column.getExtension()), JsonUtils.readTree(readColumn(id, column)));
    final Column child = column.getChildren().getFirst();
    assertEquals(
        JsonUtils.valueToTree(child.getExtension()), JsonUtils.readTree(readColumn(id, child)));
  }

  private static String readColumn(final UUID id, final Column column) {
    return Entity.getCollectionDAO()
        .entityExtensionDAO()
        .getExtension(id, FullyQualifiedName.buildHash(column.getFullyQualifiedName()));
  }

  private static void insert(UUID id) {
    Entity.getCollectionDAO().entityExtensionDAO().insert(id, EXTENSION, EXTENSION, "{}");
  }

  private static String read(UUID id) {
    return Entity.getCollectionDAO().entityExtensionDAO().getExtension(id, EXTENSION);
  }

  static final class TransactionCounter extends DelegatingTransactionHandler
      implements AutoCloseable {
    private final Jdbi jdbi;
    private final Thread owner = Thread.currentThread();
    private int commits;
    private int rollbacks;

    TransactionCounter(Jdbi jdbi) {
      super(jdbi.getTransactionHandler());
      this.jdbi = jdbi;
      jdbi.setTransactionHandler(this);
    }

    @Override
    public TransactionHandler specialize(Handle handle) throws SQLException {
      return new DelegatingTransactionHandler(getDelegate().specialize(handle)) {
        @Override
        public void commit(Handle handle) {
          super.commit(handle);
          if (Thread.currentThread() == owner) {
            commits++;
          }
        }

        @Override
        public void rollback(Handle handle) {
          super.rollback(handle);
          if (Thread.currentThread() == owner) {
            rollbacks++;
          }
        }
      };
    }

    int commits() {
      return commits;
    }

    int rollbacks() {
      return rollbacks;
    }

    @Override
    public void close() {
      jdbi.setTransactionHandler(getDelegate());
    }
  }
}
