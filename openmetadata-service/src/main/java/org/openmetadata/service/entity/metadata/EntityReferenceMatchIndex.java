package org.openmetadata.service.entity.metadata;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiPredicate;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;
import org.openmetadata.service.entity.write.EntityChangeRecorder.Matches;
import org.openmetadata.service.util.EntityUtil;

/** Operation-local identity indexes preserve the first matching reference and duplicate deltas. */
public final class EntityReferenceMatchIndex<K> implements Matches<K> {
  private record Identity(UUID id, String type) {}

  private final ListChange<K> values;
  private final Map<Identity, K> original;
  private final Map<Identity, K> updated;

  private EntityReferenceMatchIndex(final ListChange<K> values) {
    this.values = values;
    original = index(values.original());
    updated = index(values.updated());
  }

  public static <K> Matches<K> forChange(final ListChange<K> values) {
    return !values.original().isEmpty() && !values.updated().isEmpty() && supported(values.match())
        ? new EntityReferenceMatchIndex<>(values)
        : values;
  }

  private static boolean supported(final BiPredicate<?, ?> match) {
    return match == EntityUtil.entityReferenceMatch;
  }

  @Override
  public K findOriginal(final K item) {
    final Identity identity = identity(item);
    return original == null || identity == null
        ? values.findOriginal(item)
        : original.get(identity);
  }

  @Override
  public K findUpdated(final K item) {
    final Identity identity = identity(item);
    return updated == null || identity == null ? values.findUpdated(item) : updated.get(identity);
  }

  private Map<Identity, K> index(final List<K> references) {
    final Map<Identity, K> index = new HashMap<>();
    for (final K item : references) {
      final Identity identity = identity(item);
      if (identity == null) {
        return null;
      }
      index.putIfAbsent(identity, item);
    }
    return index;
  }

  private Identity identity(final K item) {
    if (item instanceof EntityReference reference) {
      final UUID id = reference.getId();
      final String type = reference.getType();
      return id == null || type == null ? null : new Identity(id, type);
    }
    return null;
  }
}
