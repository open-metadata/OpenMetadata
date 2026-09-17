package org.openmetadata.it.util;

import java.sql.SQLException;
import java.util.Locale;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.service.monitoring.RequestLatencyContext;

/**
 * Fails a real SQL operation after execution, once, without affecting background jobs.
 *
 * <p>The failure is thrown from {@code logAfterExecution}, so the statement really did run before
 * the caller sees the error — which is what makes it usable for atomicity tests: the rollback has
 * something to undo.
 */
public final class SqlFailureProbe implements SqlLogger, AutoCloseable {
  private final Jdbi jdbi;
  private final SqlLogger delegate;
  private final String fragment;
  private final Supplier<RuntimeException> failure;
  private final BooleanSupplier inScope;
  private boolean injected;

  public SqlFailureProbe(
      final Jdbi jdbi, final String fragment, final Supplier<RuntimeException> failure) {
    this(jdbi, fragment, failure, callingThread());
  }

  /**
   * Scopes the injection to statements issued while serving an HTTP request rather than to the
   * calling thread, so a REST-driven test can fail a statement that runs on a Jetty worker.
   */
  public static SqlFailureProbe forRequests(
      final Jdbi jdbi, final String fragment, final Supplier<RuntimeException> failure) {
    return new SqlFailureProbe(
        jdbi, fragment, failure, () -> RequestLatencyContext.getContext() != null);
  }

  private SqlFailureProbe(
      final Jdbi jdbi,
      final String fragment,
      final Supplier<RuntimeException> failure,
      final BooleanSupplier inScope) {
    this.jdbi = jdbi;
    this.delegate = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    this.fragment = fragment.toLowerCase(Locale.ROOT);
    this.failure = failure;
    this.inScope = inScope;
    jdbi.setSqlLogger(this);
  }

  /** Whether the failure has already been injected. */
  public boolean injected() {
    return injected;
  }

  private static BooleanSupplier callingThread() {
    final Thread owner = Thread.currentThread();
    return () -> Thread.currentThread() == owner;
  }

  @Override
  public void logBeforeExecution(final StatementContext context) {
    delegate.logBeforeExecution(context);
  }

  @Override
  public void logAfterExecution(final StatementContext context) {
    delegate.logAfterExecution(context);
    if (!injected
        && inScope.getAsBoolean()
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
