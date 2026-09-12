package org.openmetadata.mcp.tools;

import static org.mockito.Mockito.lenient;

import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityCreates;
import org.openmetadata.service.util.RestUtil.PutResponse;

public final class EntityCreationFixture<T extends EntityInterface> implements EntityCreates<T> {

  public record Creation<T>(UriInfo uri, T entity, EntityCommandActor actor, boolean withHref) {}

  public record Upsert<T>(UriInfo uri, T entity, EntityCommandActor actor, boolean importMode) {}

  private boolean prepared;

  private final List<Creation<T>> creations = new ArrayList<>();

  private final List<Upsert<T>> upserts = new ArrayList<>();

  private Function<Creation<T>, T> create = request -> null;

  private Consumer<Creation<T>> beforeCreate = request -> {};

  private Function<Upsert<T>, PutResponse<T>> upsert = request -> null;

  public static <T extends EntityInterface> EntityCreationFixture<T> attach(
      final EntityPolicy<T> repository) {
    final EntityCreationFixture<T> fixture = new EntityCreationFixture<>();
    lenient().when(repository.creates()).thenReturn(fixture);
    lenient()
        .when(repository.preparation())
        .thenReturn((entity, update) -> fixture.prepared = true);
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

  public EntityCreationFixture<T> beforeCreate(Consumer<Creation<T>> observer) {
    beforeCreate = observer;
    return this;
  }

  private T create(final Creation<T> request) {
    beforeCreate.accept(request);
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

  public boolean prepared() {
    return prepared;
  }

  public List<Creation<T>> creations() {
    return List.copyOf(creations);
  }

  public List<Upsert<T>> upserts() {
    return List.copyOf(upserts);
  }
}
