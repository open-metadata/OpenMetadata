package org.openmetadata.it.perf;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.concurrent.atomic.LongAdder;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.transaction.DelegatingTransactionHandler;
import org.jdbi.v3.core.transaction.TransactionHandler;
import org.openmetadata.service.monitoring.RequestLatencyContext;

/** Explicitly enabled diagnostic windows; never installed during latency comparisons. */
final class EntityBenchmarkSqlProbe implements SqlLogger, AutoCloseable {
  record Counts(long statements, long commits, long rollbacks, long emptyCommits) {}

  private final Jdbi jdbi;
  private final SqlLogger logger;
  private final TransactionHandler transactions;
  private final LongAdder statements = new LongAdder();
  private final LongAdder commits = new LongAdder();
  private final LongAdder rollbacks = new LongAdder();
  private final LongAdder emptyCommits = new LongAdder();
  private final Cache<Connection, LongAdder> activeTransactions =
      CacheBuilder.newBuilder().maximumSize(1024).weakKeys().build();
  private volatile boolean active = true;

  EntityBenchmarkSqlProbe(Jdbi jdbi) {
    this.jdbi = jdbi;
    logger = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    transactions = jdbi.getTransactionHandler();
    jdbi.setSqlLogger(this);
    jdbi.setTransactionHandler(new Transactions(transactions));
  }

  Counts counts() {
    return new Counts(statements.sum(), commits.sum(), rollbacks.sum(), emptyCommits.sum());
  }

  private void record(LongAdder counter) {
    if (active && RequestLatencyContext.getContext() != null) {
      counter.increment();
    }
  }

  @Override
  public void logBeforeExecution(StatementContext context) {
    record(statements);
    final LongAdder transactionStatements =
        activeTransactions.getIfPresent(context.getConnection());
    if (transactionStatements != null) {
      transactionStatements.increment();
    }
    logger.logBeforeExecution(context);
  }

  @Override
  public void logAfterExecution(StatementContext context) {
    logger.logAfterExecution(context);
  }

  @Override
  public void logException(StatementContext context, SQLException exception) {
    logger.logException(context, exception);
  }

  @Override
  public void close() {
    active = false;
    jdbi.setSqlLogger(logger);
    jdbi.setTransactionHandler(transactions);
    activeTransactions.invalidateAll();
  }

  private final class Transactions extends DelegatingTransactionHandler {
    private Transactions(TransactionHandler delegate) {
      super(delegate);
    }

    @Override
    public TransactionHandler specialize(Handle handle) throws SQLException {
      return new DelegatingTransactionHandler(getDelegate().specialize(handle)) {
        @Override
        public void begin(Handle handle) {
          super.begin(handle);
          activeTransactions.put(handle.getConnection(), new LongAdder());
        }

        @Override
        public void commit(Handle handle) {
          super.commit(handle);
          record(commits);
          final LongAdder queries = activeTransactions.getIfPresent(handle.getConnection());
          if (queries != null && queries.sum() == 0) {
            record(emptyCommits);
          }
          activeTransactions.invalidate(handle.getConnection());
        }

        @Override
        public void rollback(Handle handle) {
          super.rollback(handle);
          record(rollbacks);
          activeTransactions.invalidate(handle.getConnection());
        }
      };
    }
  }
}
