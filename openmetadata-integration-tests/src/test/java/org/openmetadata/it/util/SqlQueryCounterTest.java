package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.monitoring.RequestLatencyContext;

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
      assertTrue(counter.record(null, "SELECT * FROM entity_relationship WHERE fromId = ?"));
      assertTrue(counter.record(null, "delete from entity_relationship"));
      assertFalse(counter.record(null, "select * from table_entity"));

      assertEquals(2, counter.count());
    }
  }

  @Test
  void matchesTheFragmentWithoutRegardToCase() {
    Jdbi jdbi = unconnectedJdbi();
    try (var counter = new SqlQueryCounter(jdbi, "FROM Entity_Relationship")) {
      assertTrue(counter.record(null, "select 1 from entity_relationship"));
      assertEquals(1, counter.count());
    }
  }

  @Test
  void ignoresStatementsFromOtherThreads() throws Exception {
    Jdbi jdbi = unconnectedJdbi();
    try (var counter = new SqlQueryCounter(jdbi, "entity_relationship")) {
      Thread background =
          new Thread(() -> counter.record(null, "select * from entity_relationship"));
      background.start();
      background.join();

      assertEquals(
          0,
          counter.count(),
          "a background job running the same statement must not pollute the count");

      counter.record(null, "select * from entity_relationship");
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

    try (var counter = new SqlQueryCounter(jdbi, "entity_relationship", ignored -> true)) {
      for (int i = 0; i < threads; i++) {
        new Thread(
                () -> {
                  try {
                    start.await();
                    for (int n = 0; n < perThread; n++) {
                      counter.record(null, "select * from entity_relationship");
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

  @Test
  void theScopePredicateIsConsultedPerStatement() {
    // The reason the scope is a Predicate<StatementContext> rather than a plain boolean: a fragment
    // alone cannot tell the request under test apart from a concurrent one running the same SQL, so
    // the caller has to get a look at each candidate statement.
    Jdbi jdbi = unconnectedJdbi();
    AtomicInteger consulted = new AtomicInteger();
    AtomicBoolean admit = new AtomicBoolean(true);

    try (var counter =
        new SqlQueryCounter(
            jdbi,
            "entity_relationship",
            context -> {
              consulted.incrementAndGet();
              return admit.get();
            })) {
      assertTrue(counter.record(null, "select * from entity_relationship"));

      admit.set(false);
      assertFalse(
          counter.record(null, "select * from entity_relationship"),
          "a matching statement the predicate rejects must not be counted");

      assertEquals(1, counter.count());
      assertEquals(2, consulted.get(), "every matching candidate is offered to the predicate");
    }
  }

  @Test
  void forRequestsCountsNothingOutsideARequest() {
    // The composed scope is `a request is in flight AND the caller's predicate accepts`. Tested
    // through forRequests rather than by injecting a predicate, because the composition itself is
    // the part that can regress: get it wrong and every REST-driven statement is rejected, or
    // every one is accepted, and no test that supplies its own predicate would notice.
    Jdbi jdbi = unconnectedJdbi();
    try (var counter = SqlQueryCounter.forRequests(jdbi, "entity_relationship")) {
      assertFalse(
          counter.record(null, "select * from entity_relationship"),
          "no request in flight, so there is nothing to attribute the statement to");
      assertEquals(0, counter.count());

      RequestLatencyContext.startRequest("/v1/test", "GET");
      try {
        assertTrue(counter.record(null, "select * from entity_relationship"));
      } finally {
        RequestLatencyContext.clearContext();
      }
      assertEquals(1, counter.count());

      assertFalse(
          counter.record(null, "select * from entity_relationship"),
          "the request ended, so later statements fall back out of scope");
      assertEquals(1, counter.count());
    }
  }

  @Test
  void forRequestsStillHonoursTheCallerPredicate() {
    Jdbi jdbi = unconnectedJdbi();
    try (var counter = SqlQueryCounter.forRequests(jdbi, "entity_relationship", ignored -> false)) {
      RequestLatencyContext.startRequest("/v1/test", "GET");
      try {
        assertFalse(
            counter.record(null, "select * from entity_relationship"),
            "a request is in flight but the caller's predicate rejects this statement");
      } finally {
        RequestLatencyContext.clearContext();
      }
      assertEquals(0, counter.count());
    }
  }
}
