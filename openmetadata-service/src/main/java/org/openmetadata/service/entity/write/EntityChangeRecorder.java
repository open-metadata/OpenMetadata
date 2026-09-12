package org.openmetadata.service.entity.write;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.metadata.ColumnMatchIndex;
import org.openmetadata.service.entity.metadata.EntityReferenceMatchIndex;

/** Records field deltas without serializing values that do not appear in a change description. */
public final class EntityChangeRecorder {
  private EntityChangeRecorder() {}

  public static <A, B, R, ID> List<R> difference(
      final List<A> requested,
      final List<B> existing,
      final Function<A, ID> requestedId,
      final Function<B, ID> existingId,
      final Function<A, R> result) {
    final Set<ID> existingIds = existing.stream().map(existingId).collect(Collectors.toSet());
    return requested.stream()
        .filter(value -> !existingIds.contains(requestedId.apply(value)))
        .map(result)
        .collect(Collectors.toList());
  }

  public static <K> boolean differs(
      final K original, final K updated, final BiPredicate<K, K> match) {
    return original != updated
        && (original == null || updated == null || !match.test(original, updated));
  }

  public static void recordValue(
      final ChangeDescription changes,
      final String field,
      final Object original,
      final Object updated,
      final boolean jsonValue) {
    if (original == null) {
      fieldAdded(changes, field, represent(updated, jsonValue));
    } else if (updated == null) {
      fieldDeleted(changes, field, represent(original, jsonValue));
    } else {
      fieldUpdated(changes, field, represent(original, jsonValue), represent(updated, jsonValue));
    }
  }

  private static Object represent(final Object value, final boolean jsonValue) {
    return jsonValue ? JsonUtils.pojoToJson(value) : value;
  }

  public static boolean hasChanges(final ChangeDescription changes) {
    return changes != null
        && (!changes.getFieldsAdded().isEmpty()
            || !changes.getFieldsUpdated().isEmpty()
            || !changes.getFieldsDeleted().isEmpty());
  }

  public interface Matches<K> {
    K findOriginal(K updated);

    K findUpdated(K original);
  }

  public record ListChange<K>(
      List<K> original, List<K> updated, List<K> added, List<K> deleted, BiPredicate<K, K> match)
      implements Matches<K> {
    public ListChange {
      original = listOrEmpty(original);
      updated = listOrEmpty(updated);
    }

    @Override
    public K findOriginal(final K item) {
      return find(original, item, match);
    }

    @Override
    public K findUpdated(final K item) {
      return find(updated, item, match);
    }
  }

  public static <K> boolean recordList(
      final ChangeDescription changes, final String field, final ListChange<K> values) {
    final Matches<K> references = EntityReferenceMatchIndex.forChange(values);
    return recordList(
        changes,
        field,
        values,
        references == values ? ColumnMatchIndex.forChange(values) : references);
  }

  public static <K> boolean recordList(
      final ChangeDescription changes,
      final String field,
      final ListChange<K> values,
      final Matches<K> matches) {
    final List<K> updatedItems = new ArrayList<>();
    collectDeleted(values, matches);
    collectAddedAndUpdated(values, updatedItems, matches);
    recordListValues(changes, field, values, updatedItems);
    return !values.added().isEmpty() || !values.deleted().isEmpty();
  }

  private static <K> void collectDeleted(final ListChange<K> values, final Matches<K> matches) {
    for (final K stored : values.original()) {
      if (matches.findUpdated(stored) == null) {
        values.deleted().add(stored);
      }
    }
  }

  private static <K> void collectAddedAndUpdated(
      final ListChange<K> values, final List<K> changed, final Matches<K> matches) {
    for (final K updated : values.updated()) {
      final K stored = matches.findOriginal(updated);
      if (stored == null) {
        values.added().add(updated);
      } else if (!values.match().test(stored, updated)) {
        changed.add(updated);
      }
    }
  }

  private static <K> K find(final List<K> candidates, final K item, final BiPredicate<K, K> match) {
    return candidates.stream()
        .filter(candidate -> match.test(candidate, item))
        .findAny()
        .orElse(null);
  }

  private static <K> void recordListValues(
      final ChangeDescription changes,
      final String field,
      final ListChange<K> values,
      final List<K> updatedItems) {
    if (!values.added().isEmpty()) {
      fieldAdded(changes, field, JsonUtils.pojoToJson(values.added()));
    }
    if (!updatedItems.isEmpty()) {
      fieldUpdated(
          changes,
          field,
          JsonUtils.pojoToJson(values.original()),
          JsonUtils.pojoToJson(updatedItems));
    }
    if (!values.deleted().isEmpty()) {
      fieldDeleted(changes, field, JsonUtils.pojoToJson(values.deleted()));
    }
  }
}
