package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.function.BiPredicate;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.EntityUtil;

/** Field decisions over supplied snapshots; authorization and persistence stay with the caller. */
final class EntityDiff {
  private EntityDiff() {}

  static <V> boolean value(
      ChangeDescription changes,
      String field,
      V original,
      V updated,
      boolean jsonValue,
      BiPredicate<V, V> match,
      boolean versioned) {
    if (original == updated
        || (original != null && updated != null && match.test(original, updated))) {
      return false;
    }
    if (versioned) {
      final Object before = jsonValue ? JsonUtils.pojoToJson(original) : original;
      final Object after = jsonValue ? JsonUtils.pojoToJson(updated) : updated;
      if (original == null) {
        EntityUtil.fieldAdded(changes, field, after);
      } else if (updated == null) {
        EntityUtil.fieldDeleted(changes, field, before);
      } else {
        EntityUtil.fieldUpdated(changes, field, before, after);
      }
    }
    return true;
  }

  static <V> boolean list(
      ChangeDescription changes,
      String field,
      List<V> original,
      List<V> updated,
      List<V> added,
      List<V> deleted,
      BiPredicate<V, V> match) {
    final var before = listOrEmpty(original);
    final var after = listOrEmpty(updated);
    before.stream()
        .filter(value -> after.stream().noneMatch(other -> match.test(other, value)))
        .forEach(deleted::add);
    after.stream()
        .filter(value -> before.stream().noneMatch(other -> match.test(other, value)))
        .forEach(added::add);
    return recordItems(changes, field, added, deleted);
  }

  static boolean recordItems(
      ChangeDescription changes, String field, List<?> added, List<?> deleted) {
    if (!added.isEmpty()) {
      EntityUtil.fieldAdded(changes, field, JsonUtils.pojoToJson(added));
    }
    if (!deleted.isEmpty()) {
      EntityUtil.fieldDeleted(changes, field, JsonUtils.pojoToJson(deleted));
    }
    return !added.isEmpty() || !deleted.isEmpty();
  }

  static LifeCycle lifeCycle(LifeCycle original, LifeCycle requested, boolean retainEmpty) {
    if (requested == null) {
      return retainEmpty ? original : null;
    }
    if (original == null || original == requested) {
      return requested;
    }
    return new LifeCycle()
        .withCreated(latest(original.getCreated(), requested.getCreated()))
        .withAccessed(latest(original.getAccessed(), requested.getAccessed()))
        .withUpdated(latest(original.getUpdated(), requested.getUpdated()));
  }

  private static AccessDetails latest(AccessDetails original, AccessDetails requested) {
    return original != null
            && (requested == null || requested.getTimestamp() < original.getTimestamp())
        ? original
        : requested;
  }
}
