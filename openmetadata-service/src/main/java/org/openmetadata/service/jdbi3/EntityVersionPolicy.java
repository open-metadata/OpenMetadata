package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.service.jdbi3.EntityRepository.Operation;
import org.openmetadata.service.util.EntityUtil;

final class EntityVersionPolicy {
  private EntityVersionPolicy() {}

  static Double next(
      final Double current, final ChangeDescription changes, final boolean majorChange) {
    return majorChange
        ? EntityUtil.nextMajorVersion(current)
        : hasChanges(changes) ? EntityUtil.nextVersion(current) : current;
  }

  static boolean hasChanges(final ChangeDescription changes) {
    return changes != null
        && (!changes.getFieldsAdded().isEmpty()
            || !changes.getFieldsUpdated().isEmpty()
            || !changes.getFieldsDeleted().isEmpty());
  }

  static boolean consolidates(
      EntityInterface original,
      EntityInterface updated,
      String entityType,
      Operation operation,
      ChangeSource source,
      boolean optimisticLocking,
      long sessionTimeoutMillis) {
    final var changes = original.getChangeDescription();
    // A previous FQN cannot be replayed after its relationships have already been repointed.
    return !optimisticLocking
        && original.getName().equals(updated.getName())
        && !affectsFqn(changes, entityType)
        && !affectsFqn(original.getIncrementalChangeDescription(), entityType)
        && changes != null
        && changes.getPreviousVersion() != null
        && original.getVersion() > 0.1
        && operation == Operation.PATCH
        && !Boolean.TRUE.equals(original.getDeleted())
        && original.getUpdatedBy().equals(updated.getUpdatedBy())
        && updated.getUpdatedAt() - original.getUpdatedAt() <= sessionTimeoutMillis
        && differentSource(changes, source);
  }

  private static boolean affectsFqn(ChangeDescription changes, String entityType) {
    return changes != null
        && Stream.of(
                listOrEmpty(changes.getFieldsAdded()),
                listOrEmpty(changes.getFieldsUpdated()),
                listOrEmpty(changes.getFieldsDeleted()))
            .flatMap(List::stream)
            .anyMatch(
                field ->
                    "name".equals(field.getName())
                        || (GLOSSARY_TERM.equals(entityType)
                            && ("parent".equals(field.getName())
                                || "glossary".equals(field.getName()))));
  }

  private static boolean differentSource(ChangeDescription changes, ChangeSource source) {
    final var summary = changes.getChangeSummary();
    ChangeSummary latest = null;
    if (summary != null && summary.getAdditionalProperties() != null) {
      for (var change : summary.getAdditionalProperties().values()) {
        if (latest == null || latest.getChangedAt() <= change.getChangedAt()) {
          latest = change;
        }
      }
    }
    // Preserve the existing rule: a missing source or a different latest source may consolidate.
    return latest == null
        || latest.getChangeSource() == null
        || !Objects.equals(latest.getChangeSource(), source);
  }
}
