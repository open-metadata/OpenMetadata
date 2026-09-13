package org.openmetadata.service.entity.write;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.entity.metadata.EntityColumnUpdates;

/** Column operations share their owning mutation's version, permissions and deferred effects. */
public final class EntityColumnUpdater<T extends EntityInterface>
    implements EntityColumnUpdates.Session {
  private final EntityUpdater<T> mutation;
  private final EntityColumnMutation<T> policy;
  private LineageChanges lineageChanges;

  private static final class LineageChanges {
    private final Set<String> deleted = new LinkedHashSet<>();
    private final HashMap<String, String> renamed = new HashMap<>();

    private void include(final List<String> deletions, final HashMap<String, String> renames) {
      deletions.stream().filter(Objects::nonNull).forEach(deleted::add);
      renamed.putAll(renames);
    }
  }

  public EntityColumnUpdater(EntityUpdater<T> mutation, EntityColumnMutation<T> policy) {
    this.mutation = mutation;
    this.policy = policy;
  }

  @Override
  public UUID entityId() {
    return mutation.getUpdated().getId();
  }

  @Override
  public boolean compares(String field) {
    return mutation.shouldCompare(field);
  }

  @Override
  public void markMajorVersionChange() {
    mutation.setMajorVersionChange(true);
  }

  @Override
  public void updateDataLength(String field, Column original, Column updated) {
    mutation.setMajorVersionChange(
        mutation.isMajorVersionChange()
            | mutation.context.columns().values().updateDataLength(this, field, original, updated));
  }

  @Override
  public void updateColumnTags(
      String fqn, String field, List<TagLabel> original, List<TagLabel> updated) {
    mutation.updateTags(fqn, field, original, updated);
  }

  @Override
  public void addColumnTags(List<TagLabel> tags, String fqn) {
    mutation.applyTagsAddInFlushAndDeferRdf(tags, fqn);
  }

  @Override
  public void updateColumnLineage(List<String> deleted, HashMap<String, String> renamed) {
    if (lineageChanges == null) {
      policy.lineage(mutation, deleted, renamed);
    } else {
      lineageChanges.include(deleted, renamed);
    }
  }

  @Override
  public void updateColumns(
      String field,
      List<Column> original,
      List<Column> updated,
      BiPredicate<Column, Column> match) {
    final boolean root = lineageChanges == null;
    if (root) {
      lineageChanges = new LineageChanges();
    }
    try {
      mutation.context.columns().updates().update(this, field, original, updated, match);
      if (root) {
        // Nested column levels form one lineage reconciliation against the persisted baseline.
        policy.lineage(
            mutation, List.copyOf(lineageChanges.deleted), new HashMap<>(lineageChanges.renamed));
      }
    } finally {
      if (root) {
        lineageChanges = null;
      }
    }
  }

  @Override
  public String updatingUserName() {
    return mutation.updatingUserName();
  }

  @Override
  public ChangeDescription getChangeDescription() {
    return mutation.getChangeDescription();
  }

  @Override
  public boolean isPut() {
    return mutation.isPut();
  }

  @Override
  public boolean updatedByBot() {
    return mutation.updatedByBot();
  }

  @Override
  public boolean isOverrideMetadata() {
    return mutation.isOverrideMetadata();
  }

  @Override
  public <K> boolean recordChange(String field, K original, K updated) {
    return mutation.recordChange(field, original, updated);
  }
}
