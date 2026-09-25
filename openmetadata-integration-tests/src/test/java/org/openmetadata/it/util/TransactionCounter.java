package org.openmetadata.it.util;

import java.sql.SQLException;
import java.util.concurrent.atomic.AtomicInteger;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.DelegatingTransactionHandler;
import org.jdbi.v3.core.transaction.TransactionHandler;

/**
 * Counts the commits and rollbacks issued on the calling thread, so a test can assert that a write
 * is one transaction rather than several.
 *
 * <p>Counting commits is the only way to catch a write path that produces the right rows through
 * two autocommits: the final state is identical, but a failure between them leaves it torn.
 */
public final class TransactionCounter extends DelegatingTransactionHandler
    implements AutoCloseable {
  private final Jdbi jdbi;
  private final Thread owner = Thread.currentThread();
  private final AtomicInteger commits = new AtomicInteger();
  private final AtomicInteger rollbacks = new AtomicInteger();

  public TransactionCounter(final Jdbi jdbi) {
    super(jdbi.getTransactionHandler());
    this.jdbi = jdbi;
    jdbi.setTransactionHandler(this);
  }

  @Override
  public TransactionHandler specialize(final Handle handle) throws SQLException {
    return new DelegatingTransactionHandler(getDelegate().specialize(handle)) {
      @Override
      public void commit(final Handle committed) {
        super.commit(committed);
        recordCommit();
      }

      @Override
      public void rollback(final Handle rolledBack) {
        super.rollback(rolledBack);
        recordRollback();
      }
    };
  }

  /**
   * Counts a commit if it happened on the installing thread. Separated from {@link #specialize} so
   * the thread scoping can be exercised without a database connection.
   */
  void recordCommit() {
    if (Thread.currentThread() == owner) {
      commits.incrementAndGet();
    }
  }

  /** @see #recordCommit() */
  void recordRollback() {
    if (Thread.currentThread() == owner) {
      rollbacks.incrementAndGet();
    }
  }

  public int commits() {
    return commits.get();
  }

  public int rollbacks() {
    return rollbacks.get();
  }

  @Override
  public void close() {
    jdbi.setTransactionHandler(getDelegate());
  }
}
