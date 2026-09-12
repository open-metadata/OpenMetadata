package org.openmetadata.service.entity.read;

import java.util.UUID;
import java.util.function.BiFunction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.read.EntityReadService.Query;

/** Supplies detail results at the query boundary for consumer tests. */
public record EntityReadFixture<T extends EntityInterface>(
    BiFunction<UUID, Query, T> idReader, BiFunction<String, Query, T> nameReader)
    implements EntityReader<T> {
  public static <T extends EntityInterface> EntityReader<T> byId(
      final BiFunction<UUID, Query, T> reader) {
    return new EntityReadFixture<>(
        reader,
        (name, query) -> {
          throw new AssertionError("Unexpected name read: " + name);
        });
  }

  public static <T extends EntityInterface> EntityReader<T> byName(
      final BiFunction<String, Query, T> reader) {
    return new EntityReadFixture<>(
        (id, query) -> {
          throw new AssertionError("Unexpected ID read: " + id);
        },
        reader);
  }

  @Override
  public T byId(final UUID id, final Query query) {
    return idReader.apply(id, query);
  }

  @Override
  public T byName(final String name, final Query query) {
    return nameReader.apply(name, query);
  }
}
