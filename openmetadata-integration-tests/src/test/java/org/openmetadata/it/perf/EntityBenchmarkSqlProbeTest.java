package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.monitoring.RequestLatencyContext;

class EntityBenchmarkSqlProbeTest {
  @Test
  void countsRequestSqlAndOwningTransactionsWithoutBackgroundOrPostWindowWork() {
    final Jdbi jdbi = database();
    final var probe = new EntityBenchmarkSqlProbe(jdbi);
    try (probe) {
      jdbi.useHandle(handle -> handle.execute("INSERT INTO sample VALUES (1, 0)"));
      RequestLatencyContext.startRequest("benchmark", "PUT");
      jdbi.useTransaction(
          handle -> {
            handle.execute("UPDATE sample SET amount = 1 WHERE id = 1");
            handle.execute("UPDATE sample SET amount = 2 WHERE id = 1");
          });
      assertThrows(
          IllegalStateException.class,
          () ->
              jdbi.useTransaction(
                  handle -> {
                    handle.execute("UPDATE sample SET amount = 3 WHERE id = 1");
                    throw new IllegalStateException("rollback");
                  }));
    } finally {
      RequestLatencyContext.clearContext();
    }
    assertEquals(new EntityBenchmarkSqlProbe.Counts(3, 1, 1, 0), probe.counts());
    final int amount =
        jdbi.withHandle(
            handle -> handle.createQuery("SELECT amount FROM sample").mapTo(Integer.class).one());
    assertEquals(2, amount);
    jdbi.useTransaction(handle -> handle.execute("UPDATE sample SET amount = 4"));
    assertEquals(new EntityBenchmarkSqlProbe.Counts(3, 1, 1, 0), probe.counts());
  }

  @Test
  void failedStatementsAreStillCountedAndKeepTheirOriginalDatabaseError() {
    final Jdbi jdbi = database();
    jdbi.useHandle(handle -> handle.execute("INSERT INTO sample VALUES (1, 0)"));
    try (var probe = new EntityBenchmarkSqlProbe(jdbi)) {
      RequestLatencyContext.startRequest("benchmark", "PUT");
      assertThrows(
          UnableToExecuteStatementException.class,
          () -> jdbi.useTransaction(handle -> handle.execute("INSERT INTO sample VALUES (1, 1)")));
      assertEquals(new EntityBenchmarkSqlProbe.Counts(1, 0, 1, 0), probe.counts());
    } finally {
      RequestLatencyContext.clearContext();
    }
  }

  @Test
  void emptyBoundariesAreDistinguishedFromTransactionsThatExecuteSql() {
    final Jdbi jdbi = database();
    try (var probe = new EntityBenchmarkSqlProbe(jdbi)) {
      RequestLatencyContext.startRequest("benchmark", "PUT");
      jdbi.useTransaction(handle -> {});
      assertEquals(new EntityBenchmarkSqlProbe.Counts(0, 1, 0, 1), probe.counts());
    } finally {
      RequestLatencyContext.clearContext();
    }
  }

  private static Jdbi database() {
    final Jdbi jdbi = Jdbi.create("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
    jdbi.useHandle(
        handle -> handle.execute("CREATE TABLE sample (id INTEGER PRIMARY KEY, amount INTEGER)"));
    return jdbi;
  }
}
