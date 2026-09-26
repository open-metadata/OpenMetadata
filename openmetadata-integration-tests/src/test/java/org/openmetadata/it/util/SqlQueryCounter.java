package org.openmetadata.it.util;

import java.sql.SQLException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;
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
  private final Predicate<StatementContext> inScope;
  private final AtomicInteger count = new AtomicInteger();

  /** Counts statements issued on the calling thread, so background jobs cannot contribute. */
  public SqlQueryCounter(Jdbi jdbi, String fragment) {
    this(jdbi, fragment, callingThread());
  }

  /**
   * Counts statements issued while serving an HTTP request, for tests that drive the server over
   * REST and so cannot use the calling thread as the scope.
   *
   * <p>This matches <em>any</em> in-flight request. {@link RequestLatencyContext} carries no test
   * identity, so if another request can run a statement matching {@code fragment} concurrently, use
   * {@link #forRequests(Jdbi, String, Predicate)} and discriminate on the statement itself.
   */
  public static SqlQueryCounter forRequests(final Jdbi jdbi, final String fragment) {
    return forRequests(jdbi, fragment, ignored -> true);
  }

  /**
   * As {@link #forRequests(Jdbi, String)}, but the caller narrows the scope further by inspecting
   * the statement — its rendered SQL, bindings or attributes — so a concurrent request cannot be
   * counted as if it were the one under test.
   */
  public static SqlQueryCounter forRequests(
      final Jdbi jdbi, final String fragment, final Predicate<StatementContext> statement) {
    return new SqlQueryCounter(
        jdbi,
        fragment,
        context -> RequestLatencyContext.getContext() != null && statement.test(context));
  }

  SqlQueryCounter(Jdbi jdbi, String fragment, Predicate<StatementContext> inScope) {
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
  boolean record(final StatementContext context, final String renderedSql) {
    if (inScope.test(context) && renderedSql.toLowerCase(Locale.ROOT).contains(fragment)) {
      count.incrementAndGet();
      return true;
    }
    return false;
  }

  private static Predicate<StatementContext> callingThread() {
    final Thread owner = Thread.currentThread();
    return ignored -> Thread.currentThread() == owner;
  }

  @Override
  public void logBeforeExecution(StatementContext context) {
    record(context, context.getRenderedSql());
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
