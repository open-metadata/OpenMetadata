package org.openmetadata.service.entity.write;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.function.Function;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Binds import policies once while retaining the prepared row, metadata and history flushes. */
public final class EntityImportCommands<T extends EntityInterface> implements EntityImports<T> {
  @FunctionalInterface
  public interface Upsert<T> {
    PutResponse<T> apply(UriInfo uri, T entity, String actor);
  }

  @FunctionalInterface
  public interface ActorUpsert<T> {
    PutResponse<T> apply(UriInfo uri, T entity, EntityCommandActor actor);
  }

  public record Policy<T>(Function<T, T> match, Upsert<T> upsert) {}

  private final EntityImportService<T> prepared;
  private final EntityImportBatch<T> batch;
  private final Policy<T> policy;
  private final ActorUpsert<T> canonical;

  public EntityImportCommands(
      final EntityImportService<T> prepared,
      final EntityImportBatch<T> batch,
      final Policy<T> policy,
      final ActorUpsert<T> canonical) {
    this.prepared = prepared;
    this.batch = batch;
    this.policy = policy;
    this.canonical = canonical;
  }

  @Override
  public T match(final T entity) {
    return policy.match().apply(entity);
  }

  @Override
  public boolean identifyUpdate(final T entity) {
    final T original = match(entity);
    final boolean present = original != null;
    if (present) {
      entity.setId(original.getId());
    }
    return present;
  }

  @Override
  public PutResponse<T> upsert(final UriInfo uri, final T entity, final String actor) {
    return policy.upsert().apply(uri, entity, actor);
  }

  @Override
  public PutResponse<T> upsertAs(
      final UriInfo uri, final T entity, final EntityCommandActor actor) {
    return canonical.apply(uri, entity, actor);
  }

  @Override
  @Transaction
  public List<PutResponse<T>> upsert(final List<T> entities, final String actor) {
    return batch.upsert(entities, actor);
  }

  @Override
  @Transaction
  public List<T> create(final List<T> entities, final String impersonatedBy) {
    return prepared.create(entities, impersonatedBy);
  }

  @Override
  @Transaction
  public List<T> update(
      final List<T> originals, final List<T> updates, final EntityCommandActor actor) {
    return prepared.update(originals, updates, actor);
  }
}
