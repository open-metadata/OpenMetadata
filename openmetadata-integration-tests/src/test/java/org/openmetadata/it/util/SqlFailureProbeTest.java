package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.monitoring.RequestLatencyContext;

/** Exactly-once is the probe's whole contract; these pin it, including under concurrency. */
class SqlFailureProbeTest {

  private static Jdbi unconnectedJdbi() {
    return Jdbi.create(
        () -> {
          throw new UnsupportedOperationException("unit test: no database");
        });
  }

  private static SqlFailureProbe probe(Jdbi jdbi, String fragment) {
    return new SqlFailureProbe(jdbi, fragment, () -> new IllegalStateException("injected"));
  }

  @Test
  void claimsTheInjectionOnceForAMatchingStatement() {
    Jdbi jdbi = unconnectedJdbi();
    try (var probe = probe(jdbi, "insert into chart_entity")) {
      assertFalse(probe.injected());

      assertTrue(probe.claimInjection(null, "INSERT INTO chart_entity (id, json) VALUES (?, ?)"));
      assertTrue(probe.injected());

      assertFalse(
          probe.claimInjection(null, "insert into chart_entity (id, json) values (?, ?)"),
          "a spent probe must let the retry through, or the replay can never succeed");
    }
  }

  @Test
  void doesNotSpendItselfOnAStatementThatDoesNotMatch() {
    Jdbi jdbi = unconnectedJdbi();
    try (var probe = probe(jdbi, "insert into chart_entity")) {
      assertFalse(probe.claimInjection(null, "insert into table_entity (id) values (?)"));
      assertFalse(probe.injected());

      assertTrue(probe.claimInjection(null, "insert into chart_entity (id) values (?)"));
    }
  }

  @Test
  void ignoresStatementsFromOtherThreads() throws Exception {
    Jdbi jdbi = unconnectedJdbi();
    try (var probe = probe(jdbi, "insert into chart_entity")) {
      AtomicInteger claimed = new AtomicInteger();
      Thread background =
          new Thread(
              () -> {
                if (probe.claimInjection(null, "insert into chart_entity (id) values (?)")) {
                  claimed.incrementAndGet();
                }
              });
      background.start();
      background.join();

      assertEquals(0, claimed.get(), "a background job must not consume the injection");
      assertFalse(probe.injected());
    }
  }

  @Test
  void exactlyOneOfTwoThreadsInsideTheWindowClaimsTheInjection() throws Exception {
    Jdbi jdbi = unconnectedJdbi();
    // Racing threads and hoping for a collision does not work here: the check-then-set window is
    // two
    // adjacent field accesses, so an unsynchronised version passes that test almost every run. Hold
    // both threads *inside* the window instead - the scope predicate is evaluated as part of the
    // claim, so a barrier there puts both callers past the guard before either can set the flag.
    CyclicBarrier bothInsideTheWindow = new CyclicBarrier(2);
    AtomicInteger claims = new AtomicInteger();
    CountDownLatch done = new CountDownLatch(2);

    try (var probe =
        new SqlFailureProbe(
            jdbi,
            "insert into chart_entity",
            () -> new IllegalStateException("injected"),
            ignored -> {
              try {
                bothInsideTheWindow.await(30, TimeUnit.SECONDS);
              } catch (Exception e) {
                throw new IllegalStateException("barrier", e);
              }
              return true;
            })) {

      for (int i = 0; i < 2; i++) {
        new Thread(
                () -> {
                  try {
                    if (probe.claimInjection(null, "insert into chart_entity (id) values (?)")) {
                      claims.incrementAndGet();
                    }
                  } finally {
                    done.countDown();
                  }
                })
            .start();
      }
      assertTrue(done.await(30, TimeUnit.SECONDS));

      assertEquals(
          1,
          claims.get(),
          "both threads were past the guard at once; only an atomic claim keeps that to one"
              + " injection, and a second injection fails an operation the test never meant to"
              + " touch");
      assertTrue(probe.injected());
    }
  }

  @Test
  void restoresTheApplicationSqlLoggerOnClose() {
    Jdbi jdbi = unconnectedJdbi();
    SqlLogger original = jdbi.getConfig(SqlStatements.class).getSqlLogger();

    try (var probe = probe(jdbi, "insert into chart_entity")) {
      assertSame(probe, jdbi.getConfig(SqlStatements.class).getSqlLogger());
    }

    assertSame(original, jdbi.getConfig(SqlStatements.class).getSqlLogger());
  }

  @Test
  void deadlockRaisesTheShapeDeadlockRetryReplays() {
    Jdbi jdbi = unconnectedJdbi();
    try (var probe = new SqlFailureProbe(jdbi, "update chart_entity", SqlFailureProbe.deadlock())) {
      RuntimeException raised = probe.failureFor(null, "update chart_entity set json = ?");

      assertNotNull(raised, "the probe must claim a matching statement");
      SQLException cause = assertInstanceOf(SQLException.class, raised.getCause());
      assertEquals("40001", cause.getSQLState(), "DeadlockRetry keys off SQLSTATE 40001");
      assertEquals(1213, cause.getErrorCode(), "and off MySQL error code 1213");

      assertNull(
          probe.failureFor(null, "update chart_entity set json = ?"),
          "a spent probe must let the replay through");
    }
  }

  @Test
  void forRequestsClaimsNothingOutsideARequest() {
    Jdbi jdbi = unconnectedJdbi();
    try (var probe =
        SqlFailureProbe.forRequests(
            jdbi,
            "insert into chart_entity",
            () -> new IllegalStateException("injected"),
            ignored -> true)) {
      assertFalse(
          probe.claimInjection(null, "insert into chart_entity (id) values (?)"),
          "no request in flight, so the probe must not spend itself");
      assertFalse(probe.injected());

      RequestLatencyContext.startRequest("/v1/test", "POST");
      try {
        assertTrue(probe.claimInjection(null, "insert into chart_entity (id) values (?)"));
      } finally {
        RequestLatencyContext.clearContext();
      }
      assertTrue(probe.injected());
    }
  }

  @Test
  void forRequestsStillHonoursTheCallerPredicate() {
    Jdbi jdbi = unconnectedJdbi();
    try (var probe =
        SqlFailureProbe.forRequests(
            jdbi,
            "insert into chart_entity",
            () -> new IllegalStateException("injected"),
            ignored -> false)) {
      RequestLatencyContext.startRequest("/v1/test", "POST");
      try {
        assertFalse(
            probe.claimInjection(null, "insert into chart_entity (id) values (?)"),
            "a request is in flight but the caller's predicate rejects this statement — the point"
                + " of the overload is that a concurrent request cannot consume the injection");
      } finally {
        RequestLatencyContext.clearContext();
      }
      assertFalse(probe.injected());
    }
  }
}
