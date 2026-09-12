package org.openmetadata.service.entity.read;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiConsumer;
import org.openmetadata.schema.EntityInterface;

/** Projects row identities and assigns loaded fields without changing the source order. */
public final class EntityBatchFields {
  private EntityBatchFields() {}

  public static <T extends EntityInterface, V> void assign(
      final boolean included,
      final List<T> entities,
      final Map<UUID, V> values,
      final BiConsumer<T, V> setter) {
    if (!included || entities.isEmpty()) return;
    for (final T entity : entities) {
      setter.accept(entity, values.get(entity.getId()));
    }
  }

  public static List<UUID> ids(final List<? extends EntityInterface> entities) {
    return entities.stream().map(EntityInterface::getId).toList();
  }
}
