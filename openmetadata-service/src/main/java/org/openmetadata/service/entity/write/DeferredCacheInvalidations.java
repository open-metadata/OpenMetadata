package org.openmetadata.service.entity.write;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Transaction-local invalidations, deduplicated by entity identity and published after commit. */
public final class DeferredCacheInvalidations {
  private final ThreadLocal<Map<Identity, Invalidation>> pending = new ThreadLocal<>();
  private final Invalidator immediate;
  private final Invalidator invalidator;

  public DeferredCacheInvalidations(final Invalidator invalidator) {
    this(invalidator, invalidator);
  }

  public DeferredCacheInvalidations(final Invalidator immediate, final Invalidator invalidator) {
    this.immediate = immediate;
    this.invalidator = invalidator;
  }

  @FunctionalInterface
  public interface Invalidator {
    void invalidate(String entityType, UUID id, String fqn);
  }

  public boolean begin() {
    final boolean owner = pending.get() == null;
    if (owner) {
      pending.set(new LinkedHashMap<>());
    }
    return owner;
  }

  public void deferOrRun(final String entityType, final UUID id, final String fqn) {
    final Map<Identity, Invalidation> deferred = pending.get();
    if (deferred == null) {
      immediate.invalidate(entityType, id, fqn);
    } else {
      final Identity identity = new Identity(entityType, id);
      final Invalidation invalidation = new Invalidation(identity, fqn);
      final Invalidation existing = deferred.putIfAbsent(identity, invalidation);
      if (existing != null && existing.fqn() == null && fqn != null) {
        deferred.put(identity, invalidation);
      }
    }
  }

  public void drain() {
    final Map<Identity, Invalidation> deferred = pending.get();
    pending.remove();
    if (deferred != null) {
      publish(deferred.values());
    }
  }

  private void publish(final Collection<Invalidation> invalidations) {
    RuntimeException failure = null;
    for (final Invalidation invalidation : invalidations) {
      try {
        invalidator.invalidate(
            invalidation.identity().entityType(), invalidation.identity().id(), invalidation.fqn());
      } catch (RuntimeException exception) {
        failure = accumulate(failure, exception);
      }
    }
    if (failure != null) {
      throw failure;
    }
  }

  private static RuntimeException accumulate(
      final RuntimeException previous, final RuntimeException current) {
    if (previous != null && previous != current) {
      previous.addSuppressed(current);
    }
    return previous == null ? current : previous;
  }

  public void clear() {
    pending.remove();
  }

  private record Identity(String entityType, UUID id) {}

  private record Invalidation(Identity identity, String fqn) {}
}
