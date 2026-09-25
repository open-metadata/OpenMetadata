package org.openmetadata.it.util;

import java.sql.SQLException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;

/**
 * Fails a real SQL operation after execution, once, without affecting background jobs.
 *
 * <p>The failure is thrown from {@code logAfterExecution}, so the statement really did run before
 * the caller sees the error — which is what makes it usable for atomicity tests: the rollback has
 * something to undo.
 *
 * <p>Scoped to the installing thread. The probe sits on the application-wide Jdbi, so without a
 * scope it would fire on whichever background job happened to run a matching statement first.
 */
public final class SqlFailureProbe implements SqlLogger, AutoCloseable {
  private final Jdbi jdbi;
  private final SqlLogger delegate;
  private final String fragment;
  private final Supplier<RuntimeException> failure;
  private final BooleanSupplier inScope;

  /**
   * Exactly-once is a contract, not an optimisation: a probe that fires twice fails an operation the
   * test never intended to fail, and the resulting assertion error points at the wrong place.
   * Claiming it with {@code compareAndSet} keeps that true no matter which thread runs the
   * statement, and makes the flag visible to the thread that reads {@link #injected()}.
   */
  private final AtomicBoolean injected = new AtomicBoolean();

  public SqlFailureProbe(
      final Jdbi jdbi, final String fragment, final Supplier<RuntimeException> failure) {
    this(jdbi, fragment, failure, callingThread());
  }

  SqlFailureProbe(
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
    return injected.get();
  }

  /**
   * Claims the single injection for a statement, or declines it. Separated from {@link
   * #logAfterExecution} so the match, the scope and the exactly-once claim can be exercised without
   * a database.
   */
  boolean claimInjection(final String renderedSql) {
    return inScope.getAsBoolean()
        && renderedSql.toLowerCase(Locale.ROOT).contains(fragment)
        && injected.compareAndSet(false, true);
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
    if (claimInjection(context.getRenderedSql())) {
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
