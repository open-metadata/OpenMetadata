package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.junit.jupiter.api.Test;

/**
 * The counter is a measuring instrument: if it miscounts, every SQL-count assertion built on it is
 * quietly wrong. These exercise the match, the scope and the restore with no database — {@link
 * Jdbi#create(org.jdbi.v3.core.ConnectionFactory)} never opens a connection.
 */
class SqlQueryCounterTest {

  private static Jdbi unconnectedJdbi() {
    return Jdbi.create(
        () -> {
          throw new UnsupportedOperationException("unit test: no database");
        });
  }

  @Test
  void countsOnlyStatementsContainingTheFragment() {
    Jdbi jdbi = unconnectedJdbi();
    try (var counter = new SqlQueryCounter(jdbi, "entity_relationship")) {
      assertTrue(counter.record("SELECT * FROM entity_relationship WHERE fromId = ?"));
      assertTrue(counter.record("delete from entity_relationship"));
      assertFalse(counter.record("select * from table_entity"));

      assertEquals(2, counter.count());
    }
  }

  @Test
  void matchesTheFragmentWithoutRegardToCase() {
    Jdbi jdbi = unconnectedJdbi();
    try (var counter = new SqlQueryCounter(jdbi, "FROM Entity_Relationship")) {
      assertTrue(counter.record("select 1 from entity_relationship"));
      assertEquals(1, counter.count());
    }
  }

  @Test
  void ignoresStatementsFromOtherThreads() throws Exception {
    Jdbi jdbi = unconnectedJdbi();
    try (var counter = new SqlQueryCounter(jdbi, "entity_relationship")) {
      Thread background = new Thread(() -> counter.record("select * from entity_relationship"));
      background.start();
      background.join();

      assertEquals(
          0,
          counter.count(),
          "a background job running the same statement must not pollute the count");

      counter.record("select * from entity_relationship");
      assertEquals(1, counter.count());
    }
  }

  @Test
  void countsEveryConcurrentStatementWhenTheScopeAdmitsThem() throws Exception {
    Jdbi jdbi = unconnectedJdbi();
    int threads = 8;
    int perThread = 500;
    CountDownLatch start = new CountDownLatch(1);
    CountDownLatch done = new CountDownLatch(threads);

    try (var counter = new SqlQueryCounter(jdbi, "entity_relationship", () -> true)) {
      for (int i = 0; i < threads; i++) {
        new Thread(
                () -> {
                  try {
                    start.await();
                    for (int n = 0; n < perThread; n++) {
                      counter.record("select * from entity_relationship");
                    }
                  } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                  } finally {
                    done.countDown();
                  }
                })
            .start();
      }
      start.countDown();
      assertTrue(done.await(30, TimeUnit.SECONDS));

      assertEquals(threads * perThread, counter.count(), "no increment may be lost to a race");
    }
  }

  @Test
  void restoresTheApplicationSqlLoggerOnClose() {
    Jdbi jdbi = unconnectedJdbi();
    SqlLogger original = jdbi.getConfig(SqlStatements.class).getSqlLogger();

    try (var counter = new SqlQueryCounter(jdbi, "entity_relationship")) {
      assertSame(counter, jdbi.getConfig(SqlStatements.class).getSqlLogger());
    }

    assertSame(original, jdbi.getConfig(SqlStatements.class).getSqlLogger());
  }

  @Test
  void nestedCountersUnwindInOrder() {
    Jdbi jdbi = unconnectedJdbi();
    SqlLogger original = jdbi.getConfig(SqlStatements.class).getSqlLogger();

    try (var outer = new SqlQueryCounter(jdbi, "outer")) {
      try (var inner = new SqlQueryCounter(jdbi, "inner")) {
        assertSame(inner, jdbi.getConfig(SqlStatements.class).getSqlLogger());
      }
      assertSame(outer, jdbi.getConfig(SqlStatements.class).getSqlLogger());
    }

    assertSame(original, jdbi.getConfig(SqlStatements.class).getSqlLogger());
  }
}
