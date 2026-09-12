package org.openmetadata.service.entity.read;

import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_TAGS;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.metadata.DerivedTagLoader.FailureMode;
import org.openmetadata.service.entity.metadata.EntityTagReader;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Runs shared bulk metadata before field policies registered during entity initialization. */
public final class EntityFieldLoading<T extends EntityInterface> {
  private final Map<String, BiConsumer<List<T>, Fields>> loaders = new HashMap<>();
  private final BiFunction<List<T>, Fields, Set<String>> relationships;
  private final BiConsumer<List<T>, EntityTagReader.Projection> tags;
  private final Supplier<FailureMode> failureMode;

  public EntityFieldLoading(
      final BiFunction<List<T>, Fields, Set<String>> relationships,
      final BiConsumer<List<T>, EntityTagReader.Projection> tags,
      final Supplier<FailureMode> failureMode) {
    this.relationships = relationships;
    this.tags = tags;
    this.failureMode = failureMode;
  }

  public void register(final String field, final BiConsumer<List<T>, Fields> loader) {
    loaders.put(field, loader);
  }

  public void populate(final List<T> entities, final Fields fields) {
    populate(entities, fields, Set.of());
  }

  public void populate(final List<T> entities, final Fields fields, final Set<String> excluded) {
    final Set<String> handled = relationships.apply(entities, fields);
    tags.accept(
        entities,
        new EntityTagReader.Projection(
            fields.contains(FIELD_TAGS) && !excluded.contains(FIELD_TAGS),
            fields.contains(FIELD_CERTIFICATION) && !excluded.contains(FIELD_CERTIFICATION),
            failureMode.get()));
    for (final var entry : loaders.entrySet()) {
      if (!excluded.contains(entry.getKey()) && !handled.contains(entry.getKey())) {
        entry.getValue().accept(entities, fields);
      }
    }
  }
}
