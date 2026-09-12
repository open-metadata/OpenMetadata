package org.openmetadata.service.entity.write;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.jdbi3.EntityDAO;

/** Owns canonical row capture and publication around the module's existing transaction boundaries. */
public final class EntityPersistence<T extends EntityInterface> {
  public record Schema<T extends EntityInterface>(String type, EntityDAO<T> dao) {}

  @FunctionalInterface
  public interface Boundary {
    <R> R execute(Supplier<R> work);
  }

  public record Boundaries(Boundary flush, Boundary retained) {}

  public record Cache(Supplier<CachedEntityDao> provider, boolean cacheable) {}

  public record Policy<T>(Function<T, String> serialize, Consumer<T> invalidate) {}

  private final Boundaries boundaries;
  private final Cache cache;
  private final EntityStore<T> rows;
  private final EntityCacheWriter<T> cacheWriter;
  private final StoredEntityCapture stored = new StoredEntityCapture();

  public EntityPersistence(
      final Schema<T> schema,
      final Boundaries boundaries,
      final Cache cache,
      final Policy<T> policy) {
    this.boundaries = boundaries;
    this.cache = cache;
    rows = new EntityStore<>(schema.type(), schema.dao(), policy.serialize(), policy.invalidate());
    cacheWriter =
        new EntityCacheWriter<>(
            schema.type(), cache.provider(), policy.serialize(), cache.cacheable());
  }

  @Transaction
  public void store(final T entity, final boolean update) {
    store(entity, update, null);
  }

  public void store(final T entity, final boolean update, final Double expectedVersion) {
    final StoredEntity row = rows.store(entity, update, expectedVersion);
    stored.record(entity, row.json());
  }

  public void insertMany(final List<T> entities) {
    rows.insertMany(entities);
  }

  public void updateMany(final List<T> entities) {
    rows.updateMany(entities);
  }

  public void capture(final T entity, final Runnable operation) {
    stored.capture(entity, operation);
  }

  public List<StoredEntity> captureFlush(
      final Runnable operation, final Consumer<Runnable> uncapturedFlush) {
    final List<StoredEntity> result;
    if (cache.provider().get() == null || !cache.cacheable()) {
      uncapturedFlush.accept(operation);
      result = List.of();
    } else {
      result = flush(() -> rows.capture(operation));
    }
    return result;
  }

  public void publish(final T entity) {
    stored.publish(entity, cacheWriter::write);
  }

  public void publishMany(final List<T> entities, final List<StoredEntity> captured) {
    cacheWriter.writeMany(entities, captured);
  }

  public void clearStored() {
    stored.clear();
  }

  public void flush(final Runnable operation) {
    flush(
        () -> {
          operation.run();
          return null;
        });
  }

  public <R> R flush(final Supplier<R> operation) {
    return execute(boundaries.flush(), operation);
  }

  public <R> R execute(final Supplier<R> operation) {
    return execute(boundaries.retained(), operation);
  }

  private <R> R execute(final Boundary boundary, final Supplier<R> operation) {
    boolean committed = false;
    try {
      final R result = boundary.execute(operation);
      committed = true;
      return result;
    } finally {
      if (!committed) {
        stored.clear();
      }
    }
  }
}
