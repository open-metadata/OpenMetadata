package org.openmetadata.service.entity.write;

import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;

import jakarta.ws.rs.core.Response.Status;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Partitions prepared imports before executing their existing create and update flushes. */
public final class EntityImportBatch<T extends EntityInterface> {
  @FunctionalInterface
  public interface Update<T> {
    List<T> apply(List<T> originals, List<T> updates, String actor);
  }

  public record Writes<T>(Function<List<T>, List<T>> create, Update<T> update) {}

  private record Partition<T>(List<T> creates, List<T> originals, List<T> updates) {}

  private final Function<String, T> byName;
  private final Writes<T> writes;

  public EntityImportBatch(final Function<String, T> byName, final Writes<T> writes) {
    this.byName = byName;
    this.writes = writes;
  }

  public List<PutResponse<T>> upsert(final List<T> entities, final String actor) {
    final Partition<T> partition = partition(entities);
    final List<PutResponse<T>> responses = new ArrayList<>();
    appendCreated(partition.creates(), responses);
    appendUpdated(partition, actor, responses);
    return responses;
  }

  private Partition<T> partition(final List<T> entities) {
    final var partition = new Partition<T>(new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
    for (final T entity : entities) {
      final T original = byName.apply(entity.getFullyQualifiedName());
      if (original == null) {
        partition.creates().add(entity);
      } else {
        partition.updates().add(entity);
        partition.originals().add(original);
      }
    }
    return partition;
  }

  private void appendCreated(final List<T> creates, final List<PutResponse<T>> responses) {
    if (!creates.isEmpty()) {
      for (final T entity : writes.create().apply(creates)) {
        responses.add(new PutResponse<>(Status.CREATED, entity, ENTITY_CREATED));
      }
    }
  }

  private void appendUpdated(
      final Partition<T> partition, final String actor, final List<PutResponse<T>> responses) {
    if (!partition.updates().isEmpty()) {
      for (final T entity :
          writes.update().apply(partition.originals(), partition.updates(), actor)) {
        responses.add(new PutResponse<>(Status.OK, entity, ENTITY_UPDATED));
      }
    }
  }
}
