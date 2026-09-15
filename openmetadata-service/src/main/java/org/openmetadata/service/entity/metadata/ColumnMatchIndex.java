package org.openmetadata.service.entity.metadata;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.BiPredicate;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;
import org.openmetadata.service.entity.write.EntityChangeRecorder.Matches;
import org.openmetadata.service.util.EntityUtil;

/** Transient name buckets preserve first-match order and Java's Unicode case-insensitive rules. */
public final class ColumnMatchIndex<K> implements Matches<K> {
  private final ListChange<K> values;
  private final Map<String, List<K>> original;
  private final Map<String, List<K>> updated;

  private ColumnMatchIndex(final ListChange<K> values) {
    this.values = values;
    original = index(values.original());
    updated = index(values.updated());
  }

  public static <K> Matches<K> forChange(final ListChange<K> values) {
    return !values.original().isEmpty() && !values.updated().isEmpty() && supported(values.match())
        ? new ColumnMatchIndex<>(values)
        : values;
  }

  private static boolean supported(final BiPredicate<?, ?> match) {
    return match == EntityUtil.columnMatch || match == EntityUtil.columnNameMatch;
  }

  @Override
  public K findOriginal(final K item) {
    return find(original, values.original(), item);
  }

  @Override
  public K findUpdated(final K item) {
    return find(updated, values.updated(), item);
  }

  private Map<String, List<K>> index(final List<K> columns) {
    final Map<String, List<K>> index = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    for (final K item : columns) {
      final String name = name(item);
      if (name == null) {
        return null;
      }
      index.computeIfAbsent(name, ignored -> new ArrayList<>()).add(item);
    }
    return index;
  }

  private K find(final Map<String, List<K>> index, final List<K> fallback, final K item) {
    final String name = name(item);
    final List<K> candidates =
        index == null || name == null ? fallback : index.getOrDefault(name, List.of());
    return candidates.stream()
        .filter(candidate -> values.match().test(candidate, item))
        .findFirst()
        .orElse(null);
  }

  private String name(final K item) {
    return item instanceof Column column ? column.getName() : null;
  }
}
