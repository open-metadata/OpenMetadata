package org.openmetadata.service.entity.read;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Resolves inheritance parents in batches while preserving each entity module's fallback policy. */
@Slf4j
public final class EntityInheritanceLoader<T extends EntityInterface> {
  @FunctionalInterface
  public interface Application<T> {
    void apply(T entity, Fields fields, EntityInterface parent);
  }

  public record Policy<T>(
      BiPredicate<T, Fields> required,
      Function<T, EntityReference> reference,
      Function<String, String> parentFields,
      Application<T> application) {}

  public record Parents<T>(
      BiFunction<T, String, EntityInterface> single,
      BiFunction<List<EntityReference>, String, List<? extends EntityInterface>> many) {}

  private final Policy<T> policy;
  private final Parents<T> parents;
  private final BiConsumer<T, Fields> fallback;

  public EntityInheritanceLoader(
      final Policy<T> policy, final Parents<T> parents, final BiConsumer<T, Fields> fallback) {
    this.policy = policy;
    this.parents = parents;
    this.fallback = fallback;
  }

  public void load(final T entity, final Fields fields) {
    if (policy.required().test(entity, fields)) {
      final EntityReference reference = policy.reference().apply(entity);
      final String parentFields =
          policy.parentFields().apply(reference == null ? null : reference.getType());
      final EntityInterface parent = loadLeniently(entity, parentFields);
      if (parent != null) {
        policy.application().apply(entity, fields, parent);
      }
    }
  }

  private EntityInterface loadLeniently(final T entity, final String fields) {
    EntityInterface parent;
    try {
      parent = parents.single().apply(entity, fields);
    } catch (EntityNotFoundException exception) {
      LOG.debug("Inheritance parent not found (concurrently deleted): {}", exception.getMessage());
      parent = null;
    }
    return parent;
  }

  public void load(
      final List<T> entities,
      final Fields fields,
      final Map<UUID, EntityReference> unhydratedParents) {
    if (!entities.isEmpty()) {
      final Map<UUID, EntityReference> references =
          collectParents(entities, fields, unhydratedParents);
      if (references.isEmpty()) {
        entities.forEach(entity -> fallback.accept(entity, fields));
      } else {
        final Map<UUID, EntityInterface> loaded = loadParents(references);
        entities.forEach(entity -> apply(entity, fields, unhydratedParents, loaded));
      }
    }
  }

  private Map<UUID, EntityReference> collectParents(
      final List<T> entities,
      final Fields fields,
      final Map<UUID, EntityReference> unhydratedParents) {
    final Map<UUID, EntityReference> references = new HashMap<>();
    for (final T entity : entities) {
      if (policy.required().test(entity, fields)) {
        final EntityReference reference = policy.reference().apply(entity);
        if (reference != null && reference.getId() != null) {
          references.putIfAbsent(reference.getId(), reference);
        }
      }
    }
    unhydratedParents
        .values()
        .forEach(reference -> references.putIfAbsent(reference.getId(), reference));
    return references;
  }

  private Map<UUID, EntityInterface> loadParents(final Map<UUID, EntityReference> references) {
    final var grouped =
        references.values().stream().collect(Collectors.groupingBy(EntityReference::getType));
    final Map<UUID, EntityInterface> loaded = new HashMap<>();
    for (final var entry : grouped.entrySet()) {
      final String fields = policy.parentFields().apply(entry.getKey());
      parents
          .many()
          .apply(entry.getValue(), fields)
          .forEach(parent -> loaded.put(parent.getId(), parent));
    }
    return loaded;
  }

  private void apply(
      final T entity,
      final Fields fields,
      final Map<UUID, EntityReference> unhydratedParents,
      final Map<UUID, EntityInterface> loaded) {
    if (policy.required().test(entity, fields)) {
      EntityReference reference = policy.reference().apply(entity);
      if (reference == null || reference.getId() == null) {
        reference = unhydratedParents.get(entity.getId());
      }
      final EntityInterface parent = reference == null ? null : loaded.get(reference.getId());
      if (parent != null) {
        policy.application().apply(entity, fields, parent);
      } else {
        fallback.accept(entity, fields);
      }
    }
  }
}
