package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TransactionCounter;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecord;
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

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void mixedBoundariesRollbackTogether(final boolean flushFirst) {
    final UnregisteredChartRepository repository = new UnregisteredChartRepository();
    final UUID first = UUID.randomUUID();
    final UUID second = UUID.randomUUID();
    final AtomicInteger published = new AtomicInteger();

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              runBoundary(
                  repository,
                  flushFirst,
                  () -> {
                    insert(first);
                    runBoundary(
                        repository,
                        !flushFirst,
                        () -> {
                          insert(second);
                          PostCommitActionQueue.runOrDefer(published::incrementAndGet);
                        });
                    throw new IllegalStateException("Failure after nested write");
                  }));

      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
      assertNull(read(first));
      assertNull(read(second));
      assertEquals(0, published.get());
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void mixedBoundariesPublishOnlyAfterTheirSingleCommit(final boolean flushFirst) {
    final UnregisteredChartRepository repository = new UnregisteredChartRepository();
    final UUID first = UUID.randomUUID();
    final UUID second = UUID.randomUUID();
    final List<String> published = new ArrayList<>();

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      runBoundary(
          repository,
          flushFirst,
          () -> {
            insert(first);
            runBoundary(
                repository,
                !flushFirst,
                () -> {
                  insert(second);
                  PostCommitActionQueue.runOrDefer(() -> published.add(read(second)));
                });
            assertTrue(published.isEmpty());
          });

      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
      assertEquals(List.of("{}"), published);
      assertEquals("{}", read(first));
    }
  }

  @Test
  void customPropertyReplacementPreservesColumnRowsAndCommitsOnce() {
    final UnregisteredChartRepository repository = new UnregisteredChartRepository();
    final Chart chart =
        new Chart()
            .withId(UUID.randomUUID())
            .withExtension(Map.of("keep", "first", "remove", "obsolete"));
    final Column column = column(chart.getId());

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      repository.executeInTransaction(
          () -> {
            repository.storeExtension(chart);
            repository.storeColumns(chart.getId(), List.of(column));
            repository.removeExtension(
                new Chart().withId(chart.getId()).withExtension(Map.of("remove", "ignored")));
            assertEquals(JsonUtils.readTree("{\"keep\":\"first\"}"), readCustomProperties(chart));

            chart.setExtension(Map.of("keep", "updated"));
            repository.removeExtensions(List.of(chart));
            repository.storeExtensions(List.of(chart));
            assertEquals(JsonUtils.readTree("{\"keep\":\"updated\"}"), readCustomProperties(chart));
            assertColumnExtension(chart.getId(), column);
            return null;
          });

      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
      assertColumnExtension(chart.getId(), column);
      assertEquals(JsonUtils.readTree("{\"keep\":\"updated\"}"), readCustomProperties(chart));
    }
  }

  @Test
  void customPropertyAndNestedColumnWritesRollBackTogether() {
    final UnregisteredChartRepository repository = new UnregisteredChartRepository();
    final Chart chart =
        new Chart().withId(UUID.randomUUID()).withExtension(Map.of("keep", "value"));
    final Column column = column(chart.getId());

    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              repository.executeInTransaction(
                  () -> {
                    repository.storeExtensions(List.of(chart));
                    repository.storeColumns(chart.getId(), List.of(column));
                    assertColumnExtension(chart.getId(), column);
                    throw new IllegalStateException("Injected custom-property rollback");
                  }));

      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
      assertNull(readCustomProperties(chart));
      assertNull(readColumn(chart.getId(), column));
      assertNull(readColumn(chart.getId(), column.getChildren().getFirst()));
    }
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

  /**
   * Reads the custom-property rows the way the repository's batch fetch does. The repository's
   * single-entity read resolves every property through {@link TypeRegistry}, which rejects
   * properties that were never registered on the chart type.
   */
  private static JsonNode readCustomProperties(final Chart chart) {
    final List<ExtensionRecord> records =
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtensions(chart.getId(), TypeRegistry.getCustomPropertyFQNPrefix(Entity.CHART));
    if (records.isEmpty()) {
      return null;
    }
    final ObjectNode properties = JsonUtils.getObjectNode();
    for (ExtensionRecord record : records) {
      properties.set(
          TypeRegistry.getPropertyName(record.extensionName()),
          JsonUtils.readTree(record.extensionJson()));
    }
    return properties;
  }

  private static void insert(UUID id) {
    Entity.getCollectionDAO().entityExtensionDAO().insert(id, EXTENSION, EXTENSION, "{}");
  }

  private static void runBoundary(
      final UnregisteredChartRepository repository, final boolean flush, final Runnable work) {
    if (flush) {
      repository.runFlush(work);
    } else {
      repository.executeInTransaction(
          () -> {
            work.run();
            return null;
          });
    }
  }

  private static String read(UUID id) {
    return Entity.getCollectionDAO().entityExtensionDAO().getExtension(id, EXTENSION);
  }

  /** Chart repository that leaves the registered one in place and exposes the column writer. */
  static final class UnregisteredChartRepository extends ChartRepository {
    UnregisteredChartRepository() {
      super(false);
    }

    void storeColumns(final UUID id, final List<Column> columns) {
      storeColumnExtensions(id, columns);
    }

    void runFlush(final Runnable work) {
      flushInOneTransaction(work);
    }
  }
}
