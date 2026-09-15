package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.EntityUtil;

/** Field decisions over supplied snapshots; authorization and persistence stay with the caller. */
final class EntityDiff {
  private EntityDiff() {}

  record Property(String name, JsonNode before, JsonNode after) {}

  static List<Property> properties(Object original, Object requested) {
    final JsonNode before = JsonUtils.valueToTree(original);
    final JsonNode after = JsonUtils.valueToTree(requested);
    final Set<String> names = new HashSet<>();
    before.fieldNames().forEachRemaining(names::add);
    after.fieldNames().forEachRemaining(names::add);
    return names.stream()
        .filter(name -> !Objects.equals(before.get(name), after.get(name)))
        .map(name -> new Property(name, before.get(name), after.get(name)))
        // Keep the existing validation order: additions are checked before edits to stored fields.
        .sorted(Comparator.comparing(change -> change.before() != null))
        .toList();
  }

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

  record Tags(List<TagLabel> updated, List<TagLabel> added, List<TagLabel> deleted) {}

  static Tags tags(List<TagLabel> original, List<TagLabel> requested, boolean merge) {
    return tags(original, requested, merge, TagKey::of);
  }

  static Tags tagRows(List<TagLabel> original, List<TagLabel> requested) {
    return tags(original, requested, false, TagRow::of);
  }

  private static <K> Tags tags(
      List<TagLabel> original, List<TagLabel> requested, boolean merge, Function<TagLabel, K> key) {
    final var before = listOrEmpty(original);
    final var after = new ArrayList<>(listOrEmpty(requested));
    final Set<K> beforeKeys = before.stream().map(key).collect(Collectors.toSet());
    final Set<K> afterKeys = after.stream().map(key).collect(Collectors.toSet());
    final var added = after.stream().filter(tag -> !beforeKeys.contains(key.apply(tag))).toList();
    final var deleted =
        merge
            ? List.<TagLabel>of()
            : before.stream().filter(tag -> !afterKeys.contains(key.apply(tag))).toList();
    if (merge) {
      before.stream().filter(tag -> afterKeys.add(key.apply(tag))).forEach(after::add);
    }
    return new Tags(after, added, deleted);
  }

  private record TagKey(String fqn, TagLabel.TagSource source) {
    static TagKey of(TagLabel tag) {
      return new TagKey(tag.getTagFQN(), tag.getSource());
    }
  }

  private record TagRow(
      TagKey key,
      TagLabel.LabelType labelType,
      TagLabel.State state,
      String reason,
      String appliedBy,
      TagLabelMetadata metadata) {
    static TagRow of(TagLabel tag) {
      return new TagRow(
          TagKey.of(tag),
          tag.getLabelType(),
          tag.getState(),
          tag.getReason(),
          tag.getAppliedBy(),
          tag.getMetadata());
    }
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
