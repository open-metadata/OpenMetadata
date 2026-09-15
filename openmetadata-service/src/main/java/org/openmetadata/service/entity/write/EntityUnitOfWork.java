package org.openmetadata.service.entity.write;

import java.util.function.Supplier;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DeadlockRetry;

/** Owns the existing single-transaction flush and its retry and post-commit lifecycle. */
public final class EntityUnitOfWork {
  private static final ThreadLocal<Boolean> ACTIVE = new ThreadLocal<>();
  private final TransactionBoundary flushBoundary;
  private final TransactionBoundary retainedBoundary;
  private final EntityPostCommitEffects effects;

  public EntityUnitOfWork(
      final Jdbi jdbi,
      final CollectionDAO daos,
      final String entityType,
      final DeferredCacheInvalidations cacheInvalidations) {
    flushBoundary = new JdbiBoundary(jdbi);
    retainedBoundary = new RetainedDaoBoundary(daos);
    effects = new EntityPostCommitEffects(entityType, cacheInvalidations);
  }

  public <R> R flush(final Supplier<R> work) {
    return execute(flushBoundary, work);
  }

  /** Multi-repository commands must bind every child DAO through the retained SQL-object root. */
  public <R> R execute(final Supplier<R> work) {
    return execute(retainedBoundary, work);
  }

  public static boolean isActive() {
    return Boolean.TRUE.equals(ACTIVE.get());
  }

  private <R> R execute(final TransactionBoundary boundary, final Supplier<R> work) {
    final EntityPostCommitEffects.Scope scope = effects.newScope();
    final boolean enclosing = isActive();
    boolean committed = false;
    ACTIVE.set(true);
    try {
      final Supplier<R> attempt =
          () ->
              boundary.execute(
                  () -> {
                    scope.reopenForAttempt();
                    return work.get();
                  });
      // A deadlock invalidates the owning transaction, including work before this nested scope.
      final R result = enclosing ? attempt.get() : DeadlockRetry.execute(attempt);
      committed = true;
      return result;
    } finally {
      if (!enclosing) {
        ACTIVE.remove();
      }
      scope.finish(committed);
    }
  }

  private interface TransactionBoundary {
    <R> R execute(Supplier<R> work);
  }

  private record JdbiBoundary(Jdbi jdbi) implements TransactionBoundary {
    @Override
    public <R> R execute(final Supplier<R> work) {
      return jdbi.inTransaction(handle -> work.get());
    }
  }

  private record RetainedDaoBoundary(CollectionDAO daos) implements TransactionBoundary {
    @Override
    public <R> R execute(final Supplier<R> work) {
      return daos.inTransaction(ignored -> work.get());
    }
  }
}
