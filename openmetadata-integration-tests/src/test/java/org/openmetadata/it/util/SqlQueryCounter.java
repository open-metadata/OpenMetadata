package org.openmetadata.it.util;

import java.sql.SQLException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.service.monitoring.RequestLatencyContext;

/** Decorates the real SQL logger for isolated tests, excluding background-job statements. */
public final class SqlQueryCounter implements SqlLogger, AutoCloseable {
  private final Jdbi jdbi;
  private final SqlLogger delegate;
  private final String fragment;
  private final BooleanSupplier inScope;
  private final AtomicInteger count = new AtomicInteger();

  public SqlQueryCounter(Jdbi jdbi, String fragment) {
    this(jdbi, fragment, callingThread());
  }

  /**
   * Counts statements issued while serving an HTTP request, for tests that drive the server over
   * REST and so cannot use the calling thread as the scope.
   *
   * <p>This matches <em>any</em> in-flight request, not the one under test — the probe is installed
   * on the application-wide Jdbi and {@link RequestLatencyContext} carries no test identity. Use it
   * only from an {@code @Isolated} test, and pick a fragment specific enough that a background app
   * cannot contribute to the count.
   */
  public static SqlQueryCounter forRequests(final Jdbi jdbi, final String fragment) {
    return new SqlQueryCounter(jdbi, fragment, () -> RequestLatencyContext.getContext() != null);
  }

  SqlQueryCounter(Jdbi jdbi, String fragment, BooleanSupplier inScope) {
    this.jdbi = jdbi;
    this.inScope = inScope;
    this.delegate = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    this.fragment = fragment.toLowerCase(Locale.ROOT);
    jdbi.setSqlLogger(this);
  }

  public int count() {
    return count.get();
  }

  /**
   * Counts a statement if it is in scope and matches. Separated from {@link #logBeforeExecution} so
   * the match and the scope can be exercised without a database.
   */
  boolean record(final String renderedSql) {
    if (inScope.getAsBoolean() && renderedSql.toLowerCase(Locale.ROOT).contains(fragment)) {
      count.incrementAndGet();
      return true;
    }
    return false;
  }

  private static BooleanSupplier callingThread() {
    final Thread owner = Thread.currentThread();
    return () -> Thread.currentThread() == owner;
  }

  @Override
  public void logBeforeExecution(StatementContext context) {
    record(context.getRenderedSql());
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
