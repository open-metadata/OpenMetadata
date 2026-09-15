package org.openmetadata.service.entity.write;

import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.BiPredicate;
import java.util.function.Consumer;
import java.util.function.Predicate;

/** Applies immutable, ordered field policies inside the caller's existing mutation flush. */
public final class EntityMutationPipeline<S> {
  public record Context(boolean importing, boolean consolidating) {}

  public record Step<S>(String field, BiConsumer<S, Context> apply) {}

  public record Preparation<S>(
      Predicate<S> deleting,
      Consumer<S> identity,
      Consumer<S> deleted,
      BiPredicate<S, String> selected) {}

  private final Preparation<S> preparation;
  private final List<Step<S>> steps;
  private final BiConsumer<S, Context> afterFields;

  public EntityMutationPipeline(
      final Preparation<S> preparation,
      final List<Step<S>> steps,
      final BiConsumer<S, Context> afterFields) {
    this.preparation = preparation;
    this.steps = List.copyOf(steps);
    this.afterFields = afterFields;
  }

  public void apply(final S session, final Context context) {
    if (preparation.deleting().test(session)) {
      preparation.deleted().accept(session);
      return;
    }
    preparation.identity().accept(session);
    preparation.deleted().accept(session);
    for (final Step<S> step : steps) {
      if (context.importing() || preparation.selected().test(session, step.field())) {
        step.apply().accept(session, context);
      }
    }
    afterFields.accept(session, context);
  }
}
