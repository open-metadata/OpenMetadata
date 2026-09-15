package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.history.EntitySummaryWriter;
import org.openmetadata.service.util.PostCommitActionQueue;

@Isolated("Decorates SQL and transaction boundaries for attribution concurrency tests")
@ExtendWith(TestNamespaceExtension.class)
class EntitySummaryPersistenceIT {
  private static final String TABLE = "table_entity";
  private static final String DESCRIPTION = "description";
  private static final String COLUMN = "columns.id.description";
  private static final String CHANGES = "changeDescription";
  private static final String SUMMARY = "changeSummary";
  private static final String ACTOR = "summary-test-actor";
  private static final String CACHED = "cached description";
  private static final String CURRENT = "newer committed description";

  @Test
  void attributionPreservesTheLatestRowAndCommitsOnce(TestNamespace ns) {
    final Table table = table(ns);
    final ObjectNode latest = raw(table);
    latest.put(DESCRIPTION, CURRENT);
    ((ObjectNode) latest.path("columns").get(0)).put(DESCRIPTION, CURRENT);
    writeRaw(table, latest);
    assertEquals(
        CACHED,
        Entity.<Table>getEntity(Entity.TABLE, table.getId(), "", Include.ALL).getDescription());
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      attribute(table, DESCRIPTION);
      assertAttribution(table, DESCRIPTION);
      assertUnchangedExceptSummary(latest, raw(table));
      assertEquals(1, transactions.commits());
    }
    assertEquals(
        CURRENT, SdkClients.adminClient().tables().get(table.getId().toString()).getDescription());
  }

  @Test
  void concurrentAttributionsPreserveBothFields(TestNamespace ns) throws Exception {
    final Table table = table(ns);
    final String prefix = "summary-writer-" + UUID.randomUUID() + "-";
    try (var locked = Entity.getJdbi().open();
        var probe = new WaitingWriters(Entity.getJdbi(), prefix);
        var executor =
            Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name(prefix, 0).factory())) {
      locked.begin();
      locked
          .createQuery("SELECT json FROM table_entity WHERE id = :id FOR UPDATE")
          .bind("id", table.getId().toString())
          .mapTo(String.class)
          .one();
      final var first = executor.submit(() -> attribute(table, DESCRIPTION));
      final var second = executor.submit(() -> attribute(table, COLUMN));
      final boolean bothWaiting;
      try {
        bothWaiting = probe.await();
      } finally {
        locked.commit();
      }
      first.get(20, TimeUnit.SECONDS);
      second.get(20, TimeUnit.SECONDS);
      assertTrue(bothWaiting, "Both writers must reach the locked row: " + probe.statements);
    }
    assertAttribution(table, DESCRIPTION);
    assertAttribution(table, COLUMN);
  }

  @Test
  void outerRollbackDiscardsAttributionAndPublication(TestNamespace ns) {
    final Table table = table(ns);
    final ObjectNode original = raw(table);
    final AtomicBoolean published = new AtomicBoolean();
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              Entity.getEntityRepository(Entity.TABLE)
                  .executeInTransaction(
                      () -> {
                        attribute(table, DESCRIPTION);
                        PostCommitActionQueue.runOrDefer(() -> published.set(true));
                        throw new IllegalStateException("Discard attribution");
                      }));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertEquals(original, raw(table));
    assertEquals(false, published.get());
  }

  @Test
  void deadlockReplaysTheLockedRowUpdate(TestNamespace ns) {
    final Table table = table(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "update table_entity",
                () -> new RuntimeException(new SQLException("Retry attribution", "40001", 1213)))) {
      attribute(table, DESCRIPTION);
      assertEquals(1, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertAttribution(table, DESCRIPTION);
  }

  @ParameterizedTest
  @ValueSource(ints = {3, 100, 1000})
  void attributionTransfersOnlyMetadataAcrossColumnWidths(int columns, TestNamespace ns) {
    final Table table = wideTable(ns, columns);
    assertSmallProjection(table);
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), TABLE)) {
      attribute(table, DESCRIPTION);
      assertEquals(2, queries.count(), "One locked metadata read and one update");
    }
    assertEquals(columns, raw(table).path("columns").size());
    assertAttribution(table, DESCRIPTION);
  }

  private static void assertSmallProjection(Table table) {
    final var repository = Entity.getEntityRepository(Entity.TABLE);
    final String projection =
        repository.executeInTransaction(
            () -> repository.getDao().findSummaryForUpdate(table.getId(), Include.NON_DELETED));
    final var metadata = JsonUtils.readTree(projection);
    assertEquals(3, metadata.size());
    assertEquals(table.getFullyQualifiedName(), metadata.path("fullyQualifiedName").asText());
    assertEquals(JsonUtils.valueToTree(table.getVersion()), metadata.path("version"));
    assertTrue(metadata.has(CHANGES));
    assertTrue(
        projection.getBytes(StandardCharsets.UTF_8).length < 2048,
        "Column graphs must not cross this read boundary");
  }

  private static Table wideTable(TestNamespace ns, int count) {
    SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final var columns =
        IntStream.range(0, count)
            .mapToObj(
                index ->
                    new Column().withName("column_" + index).withDataType(ColumnDataType.BIGINT))
            .toList();
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix("wide" + count))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(columns)
                .withDescription(CACHED));
  }

  private static Table table(TestNamespace ns) {
    SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table =
        TableTestFactory.createWithDescription(ns, schema.getFullyQualifiedName(), CACHED);
    Entity.getEntity(Entity.TABLE, table.getId(), "", Include.ALL);
    return table;
  }

  private static void attribute(Table table, String field) {
    Entity.getEntityRepository(Entity.TABLE)
        .summaryWrites()
        .update(
            new EntitySummaryWriter.Attribution(
                table.getId(), field, ChangeSource.SUGGESTED, ACTOR));
  }

  private static ObjectNode raw(Table table) {
    final var dao = Entity.getEntityRepository(Entity.TABLE).getDao();
    return (ObjectNode) JsonUtils.readTree(dao.findById(dao.getTableName(), table.getId(), ""));
  }

  private static void writeRaw(Table table, ObjectNode row) {
    Entity.getEntityRepository(Entity.TABLE)
        .getDao()
        .update(table.getId(), table.getFullyQualifiedName(), JsonUtils.pojoToJson(row));
  }

  private static void assertAttribution(Table table, String field) {
    assertEquals(
        ACTOR, raw(table).path(CHANGES).path(SUMMARY).path(field).path("changedBy").asText());
  }

  private static void assertUnchangedExceptSummary(ObjectNode expected, ObjectNode actual) {
    expected.remove(CHANGES);
    actual.remove(CHANGES);
    assertEquals(expected, actual);
  }

  private static final class WaitingWriters implements SqlLogger, AutoCloseable {
    private final Jdbi jdbi;
    private final SqlLogger delegate;
    private final String prefix;
    private final CountDownLatch waiting = new CountDownLatch(2);
    private final List<String> statements = new CopyOnWriteArrayList<>();

    private WaitingWriters(Jdbi jdbi, String prefix) {
      this.jdbi = jdbi;
      this.delegate = jdbi.getConfig(SqlStatements.class).getSqlLogger();
      this.prefix = prefix;
      jdbi.setSqlLogger(this);
    }

    @Override
    public void logBeforeExecution(StatementContext context) {
      delegate.logBeforeExecution(context);
      final String sql = context.getRenderedSql().toLowerCase(Locale.ROOT).strip();
      if (Thread.currentThread().getName().startsWith(prefix)) {
        if (statements.size() < 8) statements.add(sql);
        if (sql.contains(TABLE)
            && (sql.contains("update table_entity") || sql.contains("for update"))) {
          waiting.countDown();
        }
      }
    }

    @Override
    public void logAfterExecution(StatementContext context) {
      delegate.logAfterExecution(context);
    }

    @Override
    public void logException(StatementContext context, SQLException exception) {
      delegate.logException(context, exception);
    }

    private boolean await() throws InterruptedException {
      return waiting.await(20, TimeUnit.SECONDS);
    }

    @Override
    public void close() {
      jdbi.setSqlLogger(delegate);
    }
  }
}
