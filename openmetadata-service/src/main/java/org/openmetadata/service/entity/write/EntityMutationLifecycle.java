package org.openmetadata.service.entity.write;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.function.BiConsumer;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;

/** Coordinates update replay and publication around the repository's owning transaction. */
public final class EntityMutationLifecycle<T extends EntityInterface> {
  public enum Mode {
    NORMAL("entityUpdateFlush"),
    OPTIMISTIC("entityUpdateFlushOptimistic"),
    IMPORT("entityUpdateFlushImport");

    private final String flushPhase;

    Mode(final String flushPhase) {
      this.flushPhase = flushPhase;
    }
  }

  public interface Session<T extends EntityInterface> extends EntityUpdateWorkflow.Session<T> {
    void resetMutationAttempt();

    void publishStoredEntity();

    void runDeferredReactOperations();
  }

  @FunctionalInterface
  public interface Flush<T extends EntityInterface> {
    void run(Session<T> session, boolean optimistic, boolean importing);
  }

  public record Execution<T extends EntityInterface>(
      Consumer<Runnable> transaction, Flush<T> flush, Runnable clearStoredJson) {}

  private final Class<T> entityClass;
  private final Execution<T> execution;
  private final BiConsumer<T, T> postUpdate;

  public EntityMutationLifecycle(
      final Class<T> entityClass, final Execution<T> execution, final BiConsumer<T, T> postUpdate) {
    this.entityClass = entityClass;
    this.execution = execution;
    this.postUpdate = postUpdate;
  }

  public void update(final Session<T> session, final Mode mode) {
    try (var ignored = phase(mode.flushPhase)) {
      flush(session, mode);
    }
    try (var ignored = phase("entityUpdateReact")) {
      react(session);
    }
  }

  private void flush(final Session<T> session, final Mode mode) {
    final Attempt attempt = new Attempt(session, mode);
    try {
      execution.transaction().accept(attempt);
      if (session.isEntityStored()) {
        try (var ignored = phase("entityUpdateCacheWriteThrough")) {
          session.publishStoredEntity();
        }
      }
    } finally {
      execution.clearStoredJson().run();
    }
  }

  private void react(final Session<T> session) {
    // A consolidated version can stay unchanged while this request still needs search
    // reconciliation.
    if (!session.isVersionChanged()
        && !session.isEntityChanged()
        && !EntityChangeRecorder.hasChanges(session.getIncrementalChangeDescription())) {
      return;
    }
    try (var ignored = phase("entityUpdatePostUpdate")) {
      postUpdate.accept(session.getOriginal(), session.getUpdated());
    }
    try (var ignored = phase("entityUpdateDeferredReact")) {
      session.runDeferredReactOperations();
    }
  }

  private final class Attempt implements Runnable {
    private final Session<T> session;
    private final Mode mode;
    private final EntityUpdateSnapshot<T> snapshot;
    private boolean first = true;

    private Attempt(final Session<T> session, final Mode mode) {
      this.session = session;
      this.mode = mode;
      snapshot = new EntityUpdateSnapshot<>(session, entityClass);
    }

    @Override
    public void run() {
      // Restore caller identities on replay; the first attempt keeps its prepared entity contents.
      snapshot.restore(session, !first);
      session.resetMutationAttempt();
      first = false;
      execution.flush().run(session, mode == Mode.OPTIMISTIC, mode == Mode.IMPORT);
    }
  }
}
