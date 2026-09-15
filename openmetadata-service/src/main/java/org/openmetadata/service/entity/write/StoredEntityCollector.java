package org.openmetadata.service.entity.write;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Collects write results only for the current operation; nested operations retain their own scope. */
final class StoredEntityCollector {
  private final ThreadLocal<Map<UUID, StoredEntity>> active = new ThreadLocal<>();

  boolean isActive() {
    return active.get() != null;
  }

  List<StoredEntity> collect(final Runnable operation) {
    final Map<UUID, StoredEntity> previous = active.get();
    final Map<UUID, StoredEntity> results = new LinkedHashMap<>();
    active.set(results);
    try {
      operation.run();
      return List.copyOf(results.values());
    } finally {
      restore(previous);
    }
  }

  void record(final StoredEntity entity) {
    final Map<UUID, StoredEntity> results = active.get();
    if (results != null) {
      results.put(entity.id(), entity);
    }
  }

  private void restore(final Map<UUID, StoredEntity> previous) {
    if (previous == null) {
      active.remove();
    } else {
      active.set(previous);
    }
  }
}
