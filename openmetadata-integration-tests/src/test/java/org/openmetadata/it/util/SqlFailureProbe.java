package org.openmetadata.it.util;

import java.sql.SQLException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
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
  private final Predicate<StatementContext> inScope;

  /**
   * Exactly-once is a contract, not an optimisation: a probe that fires twice fails an operation the
   * test never intended to fail, and the resulting assertion error points at the wrong place.
   * Claiming it with {@code compareAndSet} keeps that true no matter which thread runs the
   * statement, and makes the flag visible to the thread that reads {@link #injected()}.
   */
  private final AtomicBoolean injected = new AtomicBoolean();

  /** Fails the first matching statement issued on the calling thread. */
  public SqlFailureProbe(
      final Jdbi jdbi, final String fragment, final Supplier<RuntimeException> failure) {
    this(jdbi, fragment, failure, callingThread());
  }

  /**
   * Fails the first matching statement issued while serving an HTTP request, for tests that drive
   * the server over REST and so cannot use the calling thread as the scope.
   *
   * <p>The caller supplies {@code statement} to identify the request under test. {@link
   * RequestLatencyContext} carries no test identity, so scoping on "some request is in flight"
   * alone would let a concurrent request consume the injection and leave the target request
   * succeeding — pass a predicate that inspects the statement's SQL, bindings or attributes.
   */
  public static SqlFailureProbe forRequests(
      final Jdbi jdbi,
      final String fragment,
      final Supplier<RuntimeException> failure,
      final Predicate<StatementContext> statement) {
    return new SqlFailureProbe(
        jdbi,
        fragment,
        failure,
        context -> RequestLatencyContext.getContext() != null && statement.test(context));
  }

  /**
   * The failure shape {@code DeadlockRetry} replays — SQLSTATE 40001, vendor code 1213 — for use as
   * the {@code failure} argument of any constructor here.
   *
   * <p>Deliberately a supplier rather than a pre-built probe. A {@code deadlockOnce(jdbi, fragment)}
   * convenience would have to pick a scope, and picking the wrong one fails silently: a
   * calling-thread probe never fires for a statement a REST call runs on a Jetty worker, so the test
   * passes without ever exercising the replay. Composing the failure with an explicit scope makes
   * that mistake impossible to make by accident:
   *
   * <pre>{@code
   * // statement issued on this thread
   * new SqlFailureProbe(jdbi, "update chart_entity", deadlock())
   *
   * // statement issued while serving a request the caller identifies
   * SqlFailureProbe.forRequests(jdbi, "update chart_entity", deadlock(), mine::matches)
   * }</pre>
   *
   * <p>To both count statements and inject, nest a {@link SqlQueryCounter} around the probe — each
   * decorator delegates to the logger it replaced, so the two compose.
   */
  public static Supplier<RuntimeException> deadlock() {
    return () ->
        new RuntimeException(
            "Injected deadlock after SQL write", new SQLException("Deadlock", "40001", 1213));
  }

  SqlFailureProbe(
      final Jdbi jdbi,
      final String fragment,
      final Supplier<RuntimeException> failure,
      final Predicate<StatementContext> inScope) {
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
  boolean claimInjection(final StatementContext context, final String renderedSql) {
    return inScope.test(context)
        && renderedSql.toLowerCase(Locale.ROOT).contains(fragment)
        && injected.compareAndSet(false, true);
  }

  /**
   * The failure this probe would raise for a statement, or {@code null} when it declines to claim
   * it. Lets a test assert on the configured failure without a database to trigger it.
   */
  RuntimeException failureFor(final StatementContext context, final String renderedSql) {
    return claimInjection(context, renderedSql) ? failure.get() : null;
  }

  private static Predicate<StatementContext> callingThread() {
    final Thread owner = Thread.currentThread();
    return ignored -> Thread.currentThread() == owner;
  }

  @Override
  public void logBeforeExecution(final StatementContext context) {
    delegate.logBeforeExecution(context);
  }

  @Override
  public void logAfterExecution(final StatementContext context) {
    delegate.logAfterExecution(context);
    final RuntimeException injectedFailure = failureFor(context, context.getRenderedSql());
    if (injectedFailure != null) {
      throw injectedFailure;
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
