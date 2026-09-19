package org.openmetadata.it.util;

import java.sql.SQLException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
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
  // Set before the constructor publishes `this` as the global SQL logger, and atomic because
  // forRequests() admits any server request thread. Assigned after publication and read without
  // synchronisation, a request already in flight could be counted while still seeing the trigger
  // unset — the injection would be skipped, or fire inside an unrelated request.
  private final AtomicBoolean deadlockAfterFirst = new AtomicBoolean();
  private final AtomicReference<Runnable> afterFirst = new AtomicReference<>();

  public SqlQueryCounter(Jdbi jdbi, String fragment) {
    this(jdbi, fragment, callingThread());
  }

  public static SqlQueryCounter forRequests(final Jdbi jdbi, final String fragment) {
    return forRequests(jdbi, fragment, ignored -> true);
  }

  public static SqlQueryCounter forRequests(
      final Jdbi jdbi, final String fragment, Predicate<StatementContext> statement) {
    return forRequests(jdbi, fragment, statement, false, null);
  }

  private static SqlQueryCounter forRequests(
      final Jdbi jdbi,
      final String fragment,
      final Predicate<StatementContext> statement,
      final boolean deadlock,
      final Runnable action) {
    return new SqlQueryCounter(
        jdbi,
        fragment,
        context -> RequestLatencyContext.getContext() != null && statement.test(context),
        deadlock,
        action);
  }

  public static SqlQueryCounter deadlockOnce(final Jdbi jdbi, final String fragment) {
    return forRequests(jdbi, fragment, ignored -> true, true, null);
  }

  public static SqlQueryCounter afterFirst(
      final Jdbi jdbi, final String fragment, final Runnable action) {
    return new SqlQueryCounter(jdbi, fragment, callingThread(), false, action);
  }

  private SqlQueryCounter(Jdbi jdbi, String fragment, Predicate<StatementContext> inScope) {
    this(jdbi, fragment, inScope, false, null);
  }

  private SqlQueryCounter(
      Jdbi jdbi,
      String fragment,
      Predicate<StatementContext> inScope,
      boolean deadlock,
      Runnable action) {
    this.jdbi = jdbi;
    this.inScope = inScope;
    this.delegate = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    this.fragment = fragment.toLowerCase(Locale.ROOT);
    this.deadlockAfterFirst.set(deadlock);
    this.afterFirst.set(action);
    // Publication last: every trigger above is visible before any other thread can reach us.
    jdbi.setSqlLogger(this);
  }

  public int count() {
    return count.get();
  }

  private boolean firstMatch(final StatementContext context) {
    return count.get() == 1
        && inScope.test(context)
        && context.getRenderedSql().toLowerCase(Locale.ROOT).contains(fragment);
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
    if (!firstMatch(context)) {
      return;
    }
    // getAndSet / compareAndSet, not check-then-act: two in-scope statements can reach here at once
    // and the trigger must fire exactly once.
    final Runnable action = afterFirst.getAndSet(null);
    if (action != null) {
      action.run();
    }
    if (deadlockAfterFirst.compareAndSet(true, false)) {
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
