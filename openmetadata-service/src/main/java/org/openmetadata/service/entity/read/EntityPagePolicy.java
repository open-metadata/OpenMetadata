package org.openmetadata.service.entity.read;

import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.entity.read.EntityPageReader.Projection;
import org.openmetadata.service.jdbi3.ListFilter;

/** Composes directional page policies once when an entity module is initialized. */
public record EntityPagePolicy<T>(
    UnaryOperator<Query<T>> forward, UnaryOperator<Query<T>> backward) {
  @FunctionalInterface
  public interface Query<T> {
    ResultList<T> read(Projection projection, int limit, String cursor);
  }

  public static <T> EntityPagePolicy<T> standard() {
    return new EntityPagePolicy<>(UnaryOperator.identity(), UnaryOperator.identity());
  }

  public static <T> EntityPagePolicy<T> filtered(final Consumer<ListFilter> prepare) {
    final UnaryOperator<Query<T>> policy =
        query ->
            (projection, limit, cursor) -> {
              prepare.accept(projection.filter());
              return query.read(projection, limit, cursor);
            };
    return new EntityPagePolicy<>(policy, policy);
  }

  public static <T> EntityPagePolicy<T> ordered(
      final Predicate<ListFilter> selected, final Query<T> forward, final Query<T> backward) {
    return new EntityPagePolicy<>(ordering(selected, forward), ordering(selected, backward));
  }

  private static <T> UnaryOperator<Query<T>> ordering(
      final Predicate<ListFilter> selected, final Query<T> ordered) {
    return standard ->
        (projection, limit, cursor) ->
            (selected.test(projection.filter()) ? ordered : standard)
                .read(projection, limit, cursor);
  }
}
