package org.openmetadata.service.entity.write;

import static org.mockito.Mockito.lenient;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiConsumer;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.policy.EntityPolicy;

public final class EntityPreparationFixture<T extends EntityInterface>
    implements EntityPrepares<T> {

  public record Preparation<T>(T entity, boolean update) {}

  private final List<Preparation<T>> preparations = new ArrayList<>();

  private BiConsumer<T, Boolean> operation = (entity, update) -> {};

  public static <T extends EntityInterface> EntityPreparationFixture<T> attach(
      final EntityPolicy<T> repository) {
    final EntityPreparationFixture<T> fixture = new EntityPreparationFixture<>();
    lenient().when(repository.preparation()).thenReturn(fixture);
    return fixture;
  }

  public EntityPreparationFixture<T> onPrepare(final BiConsumer<T, Boolean> prepare) {
    operation = prepare;
    return this;
  }

  @Override
  public void prepare(final T entity, final boolean update) {
    preparations.add(new Preparation<>(entity, update));
    operation.accept(entity, update);
  }

  public List<Preparation<T>> preparations() {
    return List.copyOf(preparations);
  }
}
