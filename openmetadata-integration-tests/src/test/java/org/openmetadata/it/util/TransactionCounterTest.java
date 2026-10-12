package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.TransactionHandler;
import org.junit.jupiter.api.Test;

/**
 * Counting commits is how a write path that uses two autocommits is told apart from one that uses a
 * single transaction — the rows end up identical either way.
 */
class TransactionCounterTest {

  private static Jdbi unconnectedJdbi() {
    return Jdbi.create(
        () -> {
          throw new UnsupportedOperationException("unit test: no database");
        });
  }

  @Test
  void countsCommitsAndRollbacksSeparately() {
    Jdbi jdbi = unconnectedJdbi();
    try (var transactions = new TransactionCounter(jdbi)) {
      assertEquals(0, transactions.commits());
      assertEquals(0, transactions.rollbacks());

      transactions.recordCommit();
      transactions.recordCommit();
      transactions.recordRollback();

      assertEquals(2, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
  }

  @Test
  void ignoresTransactionsOnOtherThreads() throws Exception {
    Jdbi jdbi = unconnectedJdbi();
    try (var transactions = new TransactionCounter(jdbi)) {
      Thread background =
          new Thread(
              () -> {
                transactions.recordCommit();
                transactions.recordRollback();
              });
      background.start();
      background.join();

      assertEquals(
          0, transactions.commits(), "a background job's commit is not the unit under test");
      assertEquals(0, transactions.rollbacks());
    }
  }

  @Test
  void restoresTheApplicationTransactionHandlerOnClose() {
    Jdbi jdbi = unconnectedJdbi();
    TransactionHandler original = jdbi.getTransactionHandler();

    try (var transactions = new TransactionCounter(jdbi)) {
      assertSame(transactions, jdbi.getTransactionHandler());
    }

    assertSame(original, jdbi.getTransactionHandler());
  }
}
