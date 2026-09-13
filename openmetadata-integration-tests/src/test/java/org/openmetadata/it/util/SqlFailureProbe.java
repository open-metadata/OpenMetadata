package org.openmetadata.it.util;

import java.sql.SQLException;
import java.util.Locale;
import java.util.function.Supplier;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;

/** Fails a real SQL operation after execution, once, without affecting background jobs. */
public final class SqlFailureProbe implements SqlLogger, AutoCloseable {
  private final Jdbi jdbi;
  private final SqlLogger delegate;
  private final String fragment;
  private final Supplier<RuntimeException> failure;
  private final Thread owner = Thread.currentThread();
  private boolean injected;

  public SqlFailureProbe(
      final Jdbi jdbi, final String fragment, final Supplier<RuntimeException> failure) {
    this.jdbi = jdbi;
    this.delegate = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    this.fragment = fragment.toLowerCase(Locale.ROOT);
    this.failure = failure;
    jdbi.setSqlLogger(this);
  }

  @Override
  public void logBeforeExecution(final StatementContext context) {
    delegate.logBeforeExecution(context);
  }

  @Override
  public void logAfterExecution(final StatementContext context) {
    delegate.logAfterExecution(context);
    if (!injected
        && Thread.currentThread() == owner
        && context.getRenderedSql().toLowerCase(Locale.ROOT).contains(fragment)) {
      injected = true;
      throw failure.get();
    }
  }

  @Override
  public void logException(final StatementContext context, final SQLException exception) {
    delegate.logException(context, exception);
  }

  @Override
  public void close() {
    jdbi.setSqlLogger(delegate);
  }
}
