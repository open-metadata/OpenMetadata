package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_TAGS;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;
import org.openmetadata.service.entity.write.EntityChangeRecorder.Matches;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/** Applies column metadata changes inside the caller's retained flush transaction. */
public final class EntityColumnUpdates {
  public interface Session extends ColumnValueUpdater.Session {
    UUID entityId();

    String updatingUserName();

    ChangeDescription getChangeDescription();

    boolean compares(String field);

    void markMajorVersionChange();

    void updateDataLength(String field, Column original, Column updated);

    void updateColumnTags(
        String fqn, String field, List<TagLabel> original, List<TagLabel> updated);

    void addColumnTags(List<TagLabel> tags, String fqn);

    void updateColumns(
        String field,
        List<Column> original,
        List<Column> updated,
        BiPredicate<Column, Column> match);

    void updateColumnLineage(List<String> deleted, HashMap<String, String> renamed);
  }

  private record Level(
      UUID entityId,
      String field,
      ListChange<Column> columns,
      Matches<Column> matches,
      HashMap<String, String> renamed) {}

  private final ColumnValueUpdater values;
  private final EntityExtensionService extensions;
  private final Supplier<TagUsageDAO> tagUsage;
  private final Supplier<EntityExtensionDAO> extensionRows;

  public EntityColumnUpdates(
      final ColumnValueUpdater values,
      final EntityExtensionService extensions,
      final Supplier<TagUsageDAO> tagUsage,
      final Supplier<EntityExtensionDAO> extensionRows) {
    this.values = values;
    this.extensions = extensions;
    this.tagUsage = tagUsage;
    this.extensionRows = extensionRows;
  }

  public void update(
      final Session session,
      final String field,
      final List<Column> original,
      final List<Column> updated,
      final BiPredicate<Column, Column> match) {
    final UUID entityId = session.entityId();
    if (nullOrEmpty(original) && nullOrEmpty(updated)) {
      session.compares(field);
      session.updateColumnLineage(List.of(), new HashMap<>());
    } else {
      updateLevel(session, level(entityId, field, original, updated, match));
    }
  }

  private void updateLevel(final Session session, final Level level) {
    recordChanges(session, level);
    carryMetadata(level.columns());
    deleteColumns(level);
    addColumns(session, level);
    updateExisting(session, level);
    updateLineage(session, level);
  }

  private Level level(
      final UUID entityId,
      final String field,
      final List<Column> original,
      final List<Column> updated,
      final BiPredicate<Column, Column> match) {
    final ListChange<Column> columns =
        new ListChange<>(original, updated, new ArrayList<>(), new ArrayList<>(), match);
    return new Level(
        entityId, field, columns, ColumnMatchIndex.forChange(columns), new HashMap<>());
  }

  private void recordChanges(final Session session, final Level level) {
    if (session.compares(level.field())) {
      EntityChangeRecorder.recordList(
          session.getChangeDescription(), level.field(), level.columns(), level.matches());
    }
  }

  private void carryMetadata(final ListChange<Column> columns) {
    final Map<String, Column> addedByName =
        columns.added().stream().collect(Collectors.toMap(Column::getName, Function.identity()));
    for (final Column deleted : columns.deleted()) {
      final Column added = addedByName.get(deleted.getName());
      if (added != null) {
        carryMetadata(deleted, added);
      }
    }
  }

  private void carryMetadata(final Column deleted, final Column added) {
    if (nullOrEmpty(added.getDescription())) {
      added.setDescription(deleted.getDescription());
    }
    // A type change replaces the column but must preserve user tags when ingestion supplies none.
    if (nullOrEmpty(added.getTags()) && !nullOrEmpty(deleted.getTags())) {
      added.setTags(deleted.getTags());
    }
  }

  private void deleteColumns(final Level level) {
    for (final Column deleted : level.columns().deleted()) {
      tagUsage.get().deleteTagsByTarget(deleted.getFullyQualifiedName());
      extensionRows
          .get()
          .delete(level.entityId(), FullyQualifiedName.buildHash(deleted.getFullyQualifiedName()));
    }
  }

  private void addColumns(final Session session, final Level level) {
    for (final Column added : level.columns().added()) {
      session.addColumnTags(
          listOrEmpty(added.getTags()).stream()
              .map(tag -> tag.withAppliedBy(session.updatingUserName()))
              .toList(),
          added.getFullyQualifiedName());
    }
    extensions.storeColumns(level.entityId(), level.columns().added());
  }

  private void updateExisting(final Session session, final Level level) {
    for (final Column updated : level.columns().updated()) {
      final Column original = level.matches().findOriginal(updated);
      if (original != null) {
        updateColumn(session, level, original, updated);
      }
    }
  }

  private void updateColumn(
      final Session session, final Level level, final Column original, final Column updated) {
    recordRename(level, original, updated);
    final String prefix =
        EntityUtil.getFieldName(level.field(), FullyQualifiedName.quoteName(updated.getName()));
    updateScalars(session, prefix, original, updated);
    session.updateColumnTags(
        original.getFullyQualifiedName(),
        EntityUtil.getFieldName(prefix, FIELD_TAGS),
        original.getTags(),
        updated.getTags());
    values.updateConstraint(session, prefix, original, updated);
    updateExtension(level.entityId(), original, updated);
    updateChildren(session, prefix, original, updated, level.columns().match());
  }

  private void recordRename(final Level level, final Column original, final Column updated) {
    // Populating an absent legacy FQN repairs a column; it has no prior lineage edge to rename.
    if (original.getFullyQualifiedName() != null
        && !Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())) {
      level
          .renamed()
          .putIfAbsent(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
    }
  }

  private void updateScalars(
      final Session session, final String prefix, final Column original, final Column updated) {
    values.updateDescription(session, prefix, original, updated);
    values.updateDisplayName(session, prefix, original, updated);
    session.updateDataLength(prefix, original, updated);
    if (values.updatePrecision(session, prefix, original, updated)) {
      session.markMajorVersionChange();
    }
    if (values.updateScale(session, prefix, original, updated)) {
      session.markMajorVersionChange();
    }
  }

  private void updateExtension(final UUID entityId, final Column original, final Column updated) {
    if (!Objects.equals(original.getExtension(), updated.getExtension())) {
      extensions.storeColumn(entityId, updated);
    }
  }

  private void updateChildren(
      final Session session,
      final String prefix,
      final Column original,
      final Column updated,
      final BiPredicate<Column, Column> match) {
    if (updated.getChildren() != null && original.getChildren() != null) {
      session.updateColumns(prefix, original.getChildren(), updated.getChildren(), match);
    }
  }

  private void updateLineage(final Session session, final Level level) {
    if (!level.columns().deleted().isEmpty()) {
      session.markMajorVersionChange();
    }
    session.updateColumnLineage(
        level.columns().deleted().stream().map(Column::getFullyQualifiedName).toList(),
        level.renamed());
  }
}
