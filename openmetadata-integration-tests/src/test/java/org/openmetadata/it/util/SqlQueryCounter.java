package org.openmetadata.it.util;

import java.sql.SQLException;
import java.util.Locale;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;

/** Decorates the real SQL logger for isolated tests, excluding background-job statements. */
public final class SqlQueryCounter implements SqlLogger, AutoCloseable {
  private final Jdbi jdbi;
  private final SqlLogger delegate;
  private final String fragment;
  private final Thread owner = Thread.currentThread();
  private int count;

  public SqlQueryCounter(Jdbi jdbi, String fragment) {
    this.jdbi = jdbi;
    this.delegate = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    this.fragment = fragment.toLowerCase(Locale.ROOT);
    jdbi.setSqlLogger(this);
  }

  public int count() {
    return count;
  }

  @Override
  public void logBeforeExecution(StatementContext context) {
    if (Thread.currentThread() == owner
        && context.getRenderedSql().toLowerCase(Locale.ROOT).contains(fragment)) {
      count++;
    }
    delegate.logBeforeExecution(context);
  }

  @Override
  public void logAfterExecution(StatementContext context) {
    delegate.logAfterExecution(context);
  }

  @Override
  public void logException(StatementContext context, SQLException exception) {
    delegate.logException(context, exception);
  }

  @Override
  public void close() {
    jdbi.setSqlLogger(delegate);
  }
}
