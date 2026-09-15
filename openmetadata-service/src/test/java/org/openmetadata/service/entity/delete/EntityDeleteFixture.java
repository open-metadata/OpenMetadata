package org.openmetadata.service.entity.delete;

import static org.mockito.Mockito.lenient;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.util.RestUtil.DeleteResponse;

public final class EntityDeleteFixture<T extends EntityInterface> implements EntityDeletes<T> {

  public record Deletion(String actor, UUID id, boolean recursive, boolean hardDelete) {}

  private final List<Deletion> deletions = new ArrayList<>();

  private Function<Deletion, DeleteResponse<T>> operation = request -> null;

  public static <T extends EntityInterface> EntityDeleteFixture<T> attach(
      final EntityPolicy<T> repository) {
    final EntityDeleteFixture<T> fixture = new EntityDeleteFixture<>();
    lenient().when(repository.deletes()).thenReturn(fixture);
    return fixture;
  }

  public EntityDeleteFixture<T> onDelete(final Function<Deletion, DeleteResponse<T>> operation) {
    this.operation = operation;
    return this;
  }

  public List<Deletion> deletions() {
    return List.copyOf(deletions);
  }

  @Override
  public DeleteResponse<T> byId(
      final String actor, final UUID id, final boolean recursive, final boolean hardDelete) {
    final Deletion deletion = new Deletion(actor, id, recursive, hardDelete);
    deletions.add(deletion);
    return operation.apply(deletion);
  }

  @Override
  public DeleteResponse<T> byName(
      final String actor, final String name, final boolean recursive, final boolean hardDelete) {
    throw new UnsupportedOperationException("Expected an ID deletion");
  }

  @Override
  public DeleteResponse<T> byNameIfExists(
      final String actor, final String name, final boolean recursive, final boolean hardDelete) {
    throw new UnsupportedOperationException("Expected an ID deletion");
  }

  @Override
  public DeleteResponse<T> internalById(
      final String actor, final UUID id, final boolean recursive, final boolean hardDelete) {
    throw new UnsupportedOperationException("Expected deletion with publication");
  }

  @Override
  public DeleteResponse<T> internalByName(
      final String actor, final String name, final boolean recursive, final boolean hardDelete) {
    throw new UnsupportedOperationException("Expected deletion with publication");
  }
}
