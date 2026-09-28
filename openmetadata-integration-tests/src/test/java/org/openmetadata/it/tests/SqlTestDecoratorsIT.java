package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.transaction.TransactionHandler;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TransactionCounter;
import org.openmetadata.service.Entity;

/**
 * Self-test for the JDBI decorators the atomicity and SQL-count tests are built on (#33358).
 *
 * <p>These three classes are the measuring instruments: if the counter miscounts or the probe fires
 * twice, every assertion made with them is quietly wrong. Each decorator installs itself into the
 * application's live Jdbi, so this class is {@code @Isolated} and every use is try-with-resources.
 */
@Isolated("Temporarily decorates the application's SQL logger and transaction handler")
class SqlTestDecoratorsIT {

  /** Distinctive enough that no application statement matches it. */
  private static final String PROBE_SQL = "select 1 as sqldecoratorsprobe";

  private static final String PROBE_FRAGMENT = "sqldecoratorsprobe";

  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @Test
  void counterCountsOnlyMatchingStatements() {
    final Jdbi jdbi = Entity.getJdbi();
    try (var counter = new SqlQueryCounter(jdbi, PROBE_FRAGMENT)) {
      runProbeQuery(jdbi);
      runProbeQuery(jdbi);
      runUnrelatedQuery(jdbi);

      assertEquals(2, counter.count(), "only the two matching statements should be counted");
    }
  }

  @Test
  void counterRestoresTheSqlLoggerOnClose() {
    final Jdbi jdbi = Entity.getJdbi();
    final SqlLogger original = jdbi.getConfig(SqlStatements.class).getSqlLogger();

    try (var counter = new SqlQueryCounter(jdbi, PROBE_FRAGMENT)) {
      assertEquals(0, counter.count());
    }

    assertSame(
        original,
        jdbi.getConfig(SqlStatements.class).getSqlLogger(),
        "closing the counter must hand the application's logger back");
  }

  @Test
  void probeFailsTheMatchingStatementExactlyOnce() {
    final Jdbi jdbi = Entity.getJdbi();
    try (var probe =
        new SqlFailureProbe(jdbi, PROBE_FRAGMENT, () -> new IllegalStateException("injected"))) {
      assertFalse(probe.injected(), "nothing has run yet");

      final var thrown = assertThrows(IllegalStateException.class, () -> runProbeQuery(jdbi));
      assertEquals("injected", thrown.getMessage());
      assertTrue(probe.injected());

      // The statement really executed before the failure was raised, and the probe is spent, so a
      // second attempt must now succeed - that is what makes it usable for rollback assertions.
      assertEquals(1, runProbeQuery(jdbi));
    }
  }

  @Test
  void probeIgnoresStatementsThatDoNotMatch() {
    final Jdbi jdbi = Entity.getJdbi();
    try (var probe =
        new SqlFailureProbe(jdbi, PROBE_FRAGMENT, () -> new IllegalStateException("injected"))) {
      assertEquals(2, runUnrelatedQuery(jdbi));
      assertFalse(probe.injected(), "a non-matching statement must not spend the probe");
    }
  }

  @Test
  void aCounterAndAProbeComposeOnTheSameJdbi() {
    // The migration for a call site that both counts and injects, now that no single factory does
    // both. Asserted on what one real statement does to both decorators rather than on the logger
    // chain: a chain assertion passes even if delegation stops invoking the inner decorator, which
    // is precisely the failure this needs to catch.
    final Jdbi jdbi = Entity.getJdbi();
    try (var counter = new SqlQueryCounter(jdbi, PROBE_FRAGMENT);
        var probe =
            new SqlFailureProbe(
                jdbi, PROBE_FRAGMENT, () -> new IllegalStateException("injected"))) {

      final var thrown = assertThrows(IllegalStateException.class, () -> runProbeQuery(jdbi));
      assertEquals("injected", thrown.getMessage(), "the outer probe fired");
      assertEquals(1, counter.count(), "and the inner counter still saw the same statement");

      // The probe is spent; the counter keeps counting through it.
      assertEquals(1, runProbeQuery(jdbi));
      assertEquals(2, counter.count());
    }
  }

  @Test
  void transactionCounterSeparatesCommitsFromRollbacks() {
    final Jdbi jdbi = Entity.getJdbi();
    final TransactionHandler original = jdbi.getTransactionHandler();

    try (var transactions = new TransactionCounter(jdbi)) {
      jdbi.useTransaction(handle -> handle.createQuery(PROBE_SQL).mapTo(Integer.class).one());
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());

      assertThrows(
          IllegalStateException.class,
          () ->
              jdbi.useTransaction(
                  handle -> {
                    handle.createQuery(PROBE_SQL).mapTo(Integer.class).one();
                    throw new IllegalStateException("rollback");
                  }));

      assertEquals(1, transactions.commits(), "the failed unit must not be counted as a commit");
      assertEquals(1, transactions.rollbacks());
    }

    assertSame(
        original,
        jdbi.getTransactionHandler(),
        "closing the counter must hand the application's handler back");
  }

  private static int runProbeQuery(final Jdbi jdbi) {
    return query(jdbi, PROBE_SQL);
  }

  private static int runUnrelatedQuery(final Jdbi jdbi) {
    return query(jdbi, "select 2");
  }

  private static int query(final Jdbi jdbi, final String sql) {
    final Integer value =
        jdbi.withHandle(handle -> handle.createQuery(sql).mapTo(Integer.class).one());
    return value;
  }
}
