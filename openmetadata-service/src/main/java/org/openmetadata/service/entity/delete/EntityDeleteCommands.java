package org.openmetadata.service.entity.delete;

import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;

import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.function.UnaryOperator;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.RestUtil.DeleteResponse;

/** Coordinates deletion lookup and synchronous completion using startup-bound policies. */
public final class EntityDeleteCommands<T extends EntityInterface> implements EntityDeletes<T> {
  public record Readers<T>(
      Function<UUID, T> byId, Function<String, T> byName, Function<String, T> byNameOrNull) {}

  public record Completion<T>(BiConsumer<T, Boolean> postDelete, BiConsumer<T, Boolean> publish) {}

  private final Readers<T> readers;
  private final UnaryOperator<String> normalize;
  private final EntityDeletionService<T> deletion;
  private final Completion<T> completion;

  public EntityDeleteCommands(
      final Readers<T> readers,
      final UnaryOperator<String> normalize,
      final EntityDeletionService<T> deletion,
      final Completion<T> completion) {
    this.readers = readers;
    this.normalize = normalize;
    this.deletion = deletion;
    this.completion = completion;
  }

  @Override
  @Transaction
  public DeleteResponse<T> byId(
      final String actor, final UUID id, final boolean recursive, final boolean hardDelete) {
    return complete(internalById(actor, id, recursive, hardDelete), hardDelete);
  }

  @Override
  @Transaction
  public DeleteResponse<T> byName(
      final String actor, final String name, final boolean recursive, final boolean hardDelete) {
    return complete(
        internalByName(actor, normalize.apply(name), recursive, hardDelete), hardDelete);
  }

  @Override
  @Transaction
  public DeleteResponse<T> byNameIfExists(
      final String actor, final String name, final boolean recursive, final boolean hardDelete) {
    final String normalized = normalize.apply(name);
    final T entity = readers.byNameOrNull().apply(normalized);
    return entity == null
        ? new DeleteResponse<>(null, ENTITY_DELETED)
        : complete(internalByName(actor, normalized, recursive, hardDelete), hardDelete);
  }

  @Override
  @Transaction
  public DeleteResponse<T> internalById(
      final String actor, final UUID id, final boolean recursive, final boolean hardDelete) {
    return deletion.delete(
        readers.byId().apply(id), new EntityDeletionService.Request(actor, recursive, hardDelete));
  }

  @Override
  @Transaction
  public DeleteResponse<T> internalByName(
      final String actor, final String name, final boolean recursive, final boolean hardDelete) {
    return deletion.delete(
        readers.byName().apply(name),
        new EntityDeletionService.Request(actor, recursive, hardDelete));
  }

  private DeleteResponse<T> complete(final DeleteResponse<T> response, final boolean hardDelete) {
    completion.postDelete().accept(response.entity(), hardDelete);
    completion.publish().accept(response.entity(), hardDelete);
    return response;
  }
}
