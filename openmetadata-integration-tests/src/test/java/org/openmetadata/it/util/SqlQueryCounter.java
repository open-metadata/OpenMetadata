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
  private boolean deadlockAfterFirst;
  private Runnable afterFirst;

  public SqlQueryCounter(Jdbi jdbi, String fragment) {
    this(jdbi, fragment, callingThread());
  }

  public static SqlQueryCounter forRequests(final Jdbi jdbi, final String fragment) {
    return forRequests(jdbi, fragment, ignored -> true);
  }

  public static SqlQueryCounter forRequests(
      final Jdbi jdbi, final String fragment, Predicate<StatementContext> statement) {
    return new SqlQueryCounter(
        jdbi,
        fragment,
        context -> RequestLatencyContext.getContext() != null && statement.test(context));
  }

  public static SqlQueryCounter deadlockOnce(final Jdbi jdbi, final String fragment) {
    final var counter = forRequests(jdbi, fragment);
    counter.deadlockAfterFirst = true;
    return counter;
  }

  public static SqlQueryCounter afterFirst(
      final Jdbi jdbi, final String fragment, final Runnable action) {
    final var counter = new SqlQueryCounter(jdbi, fragment);
    counter.afterFirst = action;
    return counter;
  }

  private SqlQueryCounter(Jdbi jdbi, String fragment, Predicate<StatementContext> inScope) {
    this.jdbi = jdbi;
    this.inScope = inScope;
    this.delegate = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    this.fragment = fragment.toLowerCase(Locale.ROOT);
    jdbi.setSqlLogger(this);
  }

  public int count() {
    return count.get();
  }

  private static Predicate<StatementContext> callingThread() {
    final Thread owner = Thread.currentThread();
    return ignored -> Thread.currentThread() == owner;
  }

  @Override
  public void logBeforeExecution(StatementContext context) {
    if (inScope.test(context)
        && context.getRenderedSql().toLowerCase(Locale.ROOT).contains(fragment)) {
      count.incrementAndGet();
    }
    delegate.logBeforeExecution(context);
  }

  @Override
  public void logAfterExecution(StatementContext context) {
    delegate.logAfterExecution(context);
    if (afterFirst != null
        && count.get() == 1
        && inScope.test(context)
        && context.getRenderedSql().toLowerCase(Locale.ROOT).contains(fragment)) {
      final var action = afterFirst;
      afterFirst = null;
      action.run();
    }
    if (deadlockAfterFirst
        && count.get() == 1
        && inScope.test(context)
        && context.getRenderedSql().toLowerCase(Locale.ROOT).contains(fragment)) {
      deadlockAfterFirst = false;
      throw new RuntimeException(
          "Injected deadlock after SQL write", new SQLException("Deadlock", "40001", 1213));
    }
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
