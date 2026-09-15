package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.compareTagLabel;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/** Reconciles tag metadata while keeping PUT merge and import replacement semantics distinct. */
public final class EntityTagUpdates {
  public interface Session extends EntityTagWriter.DeferredEffects {
    boolean isPut();

    boolean isOverrideMetadata();

    String updatingUserName();

    void recordTagChanges(String field, List<TagLabel> original, List<TagLabel> updated);
  }

  private record Changes(
      List<TagLabel> original,
      List<TagLabel> updated,
      List<TagLabel> added,
      List<TagLabel> deleted) {
    private Changes(final List<TagLabel> original, final List<TagLabel> updated) {
      this(
          listOrEmpty(original),
          updated == null ? new ArrayList<>() : updated,
          new ArrayList<>(),
          new ArrayList<>());
    }
  }

  private final EntityTagWriter writer;
  private final Consumer<List<TagLabel>> validate;
  private final Supplier<String> certification;

  public EntityTagUpdates(
      final EntityTagWriter writer,
      final Consumer<List<TagLabel>> validate,
      final Supplier<String> certification) {
    this.writer = writer;
    this.validate = validate;
    this.certification = certification;
  }

  public void update(
      final Session session,
      final String fqn,
      final String field,
      final List<TagLabel> original,
      final List<TagLabel> updated) {
    if (!nullOrEmpty(original) || !nullOrEmpty(updated)) {
      final Changes changes = new Changes(original, updated);
      collectChanges(
          changes, session.isPut() && (!session.isOverrideMetadata() || nullOrEmpty(updated)));
      validate.accept(changes.updated());
      excludeCertification(changes);
      persistChanges(session, fqn, changes);
      session.recordTagChanges(field, changes.original(), changes.updated());
      changes.updated().sort(compareTagLabel);
    }
  }

  private void collectChanges(final Changes changes, final boolean merge) {
    final Set<String> originalKeys = keys(changes.original());
    if (!merge) {
      collectMissing(changes.original(), keys(changes.updated()), changes.deleted());
    }
    collectMissing(changes.updated(), originalKeys, changes.added());
    if (merge) {
      EntityUtil.mergeTags(changes.updated(), changes.original());
    }
  }

  private void collectMissing(
      final List<TagLabel> values, final Set<String> present, final List<TagLabel> missing) {
    for (final TagLabel tag : values) {
      if (!present.contains(key(tag))) {
        missing.add(tag);
      }
    }
  }

  private void excludeCertification(final Changes changes) {
    final String classification = certification.get();
    if (classification != null) {
      changes.added().removeIf(tag -> isCertification(tag, classification));
      changes.deleted().removeIf(tag -> isCertification(tag, classification));
    }
  }

  private boolean isCertification(final TagLabel tag, final String classification) {
    return classification.equals(FullyQualifiedName.getParentFQN(tag.getTagFQN()));
  }

  private void persistChanges(final Session session, final String fqn, final Changes changes) {
    if (!changes.deleted().isEmpty()) {
      writer.deleteInFlush(session, changes.deleted(), fqn);
    }
    if (!changes.added().isEmpty()) {
      writer.addInFlush(
          session,
          changes.added().stream()
              .map(tag -> tag.withAppliedBy(session.updatingUserName()))
              .toList(),
          fqn);
    }
  }

  public void updateForImport(
      final Session session,
      final String fqn,
      final String field,
      final List<TagLabel> original,
      final List<TagLabel> updated) {
    if (!nullOrEmpty(original) || !nullOrEmpty(updated)) {
      final Changes changes = new Changes(original, updated);
      writer.deleteByTarget(fqn);
      session.recordTagChanges(field, changes.original(), changes.updated());
      changes.updated().sort(compareTagLabel);
      writer.replaceInFlush(session, changes.original(), changes.updated(), fqn);
    }
  }

  private String key(final TagLabel tag) {
    return tag.getTagFQN() + ":" + tag.getSource();
  }

  private Set<String> keys(final List<TagLabel> tags) {
    return tags.stream().map(this::key).collect(Collectors.toSet());
  }
}
