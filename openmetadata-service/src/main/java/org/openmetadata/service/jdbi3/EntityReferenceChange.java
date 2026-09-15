package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.EntityUtil;

record EntityReferenceChange(
    List<EntityReference> original,
    List<EntityReference> updated,
    List<EntityReference> added,
    List<EntityReference> deleted) {
  enum Mode {
    RETAIN,
    REPLACE,
    REPLACE_IF_NONEMPTY,
    IMPORT_OWNERS
  }

  static EntityReferenceChange reconcile(
      final List<EntityReference> original,
      final List<EntityReference> requested,
      final Mode mode,
      final boolean selected) {
    final var stored = explicitReferences(original);
    final var unchanged = mode == Mode.IMPORT_OWNERS ? stored : original;
    if (mode == Mode.RETAIN || !selected) {
      return new EntityReferenceChange(stored, unchanged, List.of(), List.of());
    }
    final var updated = explicitReferences(requested);
    if (mode == Mode.REPLACE_IF_NONEMPTY && updated.isEmpty()) {
      return new EntityReferenceChange(stored, unchanged, List.of(), List.of());
    }
    final var added = difference(updated, stored);
    final var deleted = difference(stored, updated);
    return new EntityReferenceChange(
        stored, added.isEmpty() && deleted.isEmpty() ? unchanged : updated, added, deleted);
  }

  boolean changed() {
    return !added.isEmpty() || !deleted.isEmpty();
  }

  void recordIn(final ChangeDescription description, final String field) {
    EntityDiff.recordItems(description, field, added, deleted);
  }

  static List<EntityReference> explicitReferences(final List<EntityReference> references) {
    return listOrEmpty(references).stream()
        .filter(reference -> !Boolean.TRUE.equals(reference.getInherited()))
        .collect(Collectors.toList());
  }

  private static List<EntityReference> difference(
      final List<EntityReference> references, final List<EntityReference> other) {
    return references.stream()
        .filter(
            reference ->
                other.stream()
                    .noneMatch(
                        candidate -> EntityUtil.entityReferenceMatch.test(candidate, reference)))
        .toList();
  }
}
