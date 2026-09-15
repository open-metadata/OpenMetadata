package org.openmetadata.service.entity.write;

import static org.mockito.Mockito.lenient;

import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.util.RestUtil.PutResponse;

public final class EntityCreationFixture<T extends EntityInterface> implements EntityCreates<T> {

  public record Creation<T>(UriInfo uri, T entity, EntityCommandActor actor, boolean withHref) {}

  public record Upsert<T>(UriInfo uri, T entity, EntityCommandActor actor, boolean importMode) {}

  private final List<Creation<T>> creations = new ArrayList<>();

  private final List<Upsert<T>> upserts = new ArrayList<>();

  private Function<Creation<T>, T> create = request -> null;

  private Function<Upsert<T>, PutResponse<T>> upsert = request -> null;

  public static <T extends EntityInterface> EntityCreationFixture<T> attach(
      final EntityPolicy<T> repository) {
    final EntityCreationFixture<T> fixture = new EntityCreationFixture<>();
    lenient().when(repository.creates()).thenReturn(fixture);
    return fixture;
  }

  public EntityCreationFixture<T> onCreate(final Function<Creation<T>, T> operation) {
    create = operation;
    return this;
  }

  public EntityCreationFixture<T> onUpsert(final Function<Upsert<T>, PutResponse<T>> operation) {
    upsert = operation;
    return this;
  }

  @Override
  public T create(final T entity, final EntityCommandActor actor) {
    return create(new Creation<>(null, entity, actor, false));
  }

  @Override
  public T create(final UriInfo uri, final T entity, final EntityCommandActor actor) {
    return create(new Creation<>(uri, entity, actor, true));
  }

  private T create(final Creation<T> request) {
    creations.add(request);
    return create.apply(request);
  }

  @Override
  public PutResponse<T> upsert(
      final UriInfo uri, final T entity, final EntityCommandActor actor, final boolean importMode) {
    final Upsert<T> request = new Upsert<>(uri, entity, actor, importMode);
    upserts.add(request);
    return upsert.apply(request);
  }

  public List<Creation<T>> creations() {
    return List.copyOf(creations);
  }

  public List<Upsert<T>> upserts() {
    return List.copyOf(upserts);
  }
}
