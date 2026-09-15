package org.openmetadata.service.entity.write;

import java.util.Objects;
import java.util.UUID;
import java.util.function.BiConsumer;
import org.openmetadata.schema.EntityInterface;

/** Holds at most one canonical row per thread between a successful write and cache publication. */
public final class StoredEntityCapture {
  private record Captured(UUID id, String json) {}

  private final ThreadLocal<Captured> pending = new ThreadLocal<>();

  public void capture(final EntityInterface entity, final Runnable operation) {
    pending.set(new Captured(entity.getId(), null));
    boolean completed = false;
    try {
      operation.run();
      completed = true;
    } finally {
      final Captured captured = pending.get();
      if (!completed
          || captured == null
          || captured.json() == null
          || !Objects.equals(entity.getId(), captured.id())) {
        clear();
      }
    }
  }

  public void record(final EntityInterface entity, final String json) {
    final Captured captured = pending.get();
    if (captured != null
        && captured.json() == null
        && Objects.equals(entity.getId(), captured.id())) {
      pending.set(new Captured(entity.getId(), json));
    }
  }

  public <T extends EntityInterface> void publish(
      final T entity, final BiConsumer<T, String> writer) {
    final Captured captured = pending.get();
    try {
      final String json =
          captured != null && entity != null && Objects.equals(entity.getId(), captured.id())
              ? captured.json()
              : null;
      writer.accept(entity, json);
    } finally {
      clear();
    }
  }

  public void clear() {
    pending.remove();
  }
}
