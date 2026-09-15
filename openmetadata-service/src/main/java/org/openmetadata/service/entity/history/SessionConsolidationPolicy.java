package org.openmetadata.service.entity.history;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.LongSupplier;
import java.util.stream.Stream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;

/** Decides whether a PATCH may reuse the current version without reverting a renamed entity. */
public final class SessionConsolidationPolicy {
  private static final Set<String> GLOSSARY_TERM_MOVE_FIELDS = Set.of("parent", "glossary");
  private final String entityType;
  private final LongSupplier sessionTimeout;

  public SessionConsolidationPolicy(final String entityType, final LongSupplier sessionTimeout) {
    this.entityType = entityType;
    this.sessionTimeout = sessionTimeout;
  }

  public boolean canConsolidate(
      final EntityInterface original,
      final EntityInterface updated,
      final boolean patch,
      final boolean optimisticLocking) {
    return !optimisticLocking
        && original.getName().equals(updated.getName())
        && !wasRenamed(original)
        && hasPreviousVersion(original)
        && original.getVersion() > 0.1
        && patch
        && !Boolean.TRUE.equals(original.getDeleted())
        && original.getUpdatedBy().equals(updated.getUpdatedBy())
        && updated.getUpdatedAt() - original.getUpdatedAt() <= sessionTimeout.getAsLong();
  }

  private boolean hasPreviousVersion(final EntityInterface original) {
    return original.getChangeDescription() != null
        && original.getChangeDescription().getPreviousVersion() != null;
  }

  private boolean wasRenamed(final EntityInterface original) {
    return affectsFullyQualifiedName(original.getChangeDescription())
        || affectsFullyQualifiedName(original.getIncrementalChangeDescription());
  }

  private boolean affectsFullyQualifiedName(final ChangeDescription change) {
    return change != null
        && Stream.of(
                listOrEmpty(change.getFieldsAdded()),
                listOrEmpty(change.getFieldsUpdated()),
                listOrEmpty(change.getFieldsDeleted()))
            .flatMap(List::stream)
            .anyMatch(
                field ->
                    FIELD_NAME.equals(field.getName())
                        || (GLOSSARY_TERM.equals(entityType)
                            && GLOSSARY_TERM_MOVE_FIELDS.contains(field.getName())));
  }

  public boolean hasDifferentChangeSource(
      final EntityInterface original, final ChangeSource source) {
    return Optional.ofNullable(original.getChangeDescription())
        .map(ChangeDescription::getChangeSummary)
        .map(ChangeSummaryMap::getAdditionalProperties)
        .flatMap(
            summary ->
                summary.values().stream()
                    .reduce(
                        (first, second) ->
                            first.getChangedAt() > second.getChangedAt() ? first : second))
        .map(ChangeSummary::getChangeSource)
        .map(latest -> !Objects.equals(latest, source))
        .orElse(true);
  }
}
