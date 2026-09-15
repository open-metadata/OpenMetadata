package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Supplier;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;

/** Persists tag rows through the retained DAO and preserves the caller's RDF publication scope. */
public final class EntityTagWriter {
  public record Target(String fqn, String type, UUID id) {
    public Target(final String fqn) {
      this(fqn, null, null);
    }
  }

  public record Rdf(BiConsumer<TagLabel, Target> add, BiConsumer<TagLabel, Target> delete) {}

  public interface DeferredEffects {
    void deferTagEffect(Runnable effect);
  }

  private final Supplier<TagUsageDAO> tags;
  private final Rdf rdf;

  public EntityTagWriter(final Supplier<TagUsageDAO> tags, final Rdf rdf) {
    this.tags = tags;
    this.rdf = rdf;
  }

  @Transaction
  public void apply(final List<TagLabel> labels, final Target target) {
    for (final TagLabel label : listOrEmpty(labels)) {
      if (isNonDerived(label)) {
        apply(label, target);
      }
    }
  }

  private void apply(final TagLabel label, final Target target) {
    tags.get()
        .applyTag(
            label.getSource().ordinal(),
            label.getTagFQN(),
            label.getTagFQN(),
            target.fqn(),
            label.getLabelType().ordinal(),
            label.getState().ordinal(),
            label.getReason(),
            label.getAppliedBy(),
            label.getMetadata());
    rdf.add().accept(label, target);
  }

  @Transaction
  public void add(final List<TagLabel> labels, final Target target) {
    final List<TagLabel> stored = nonDerived(labels);
    if (!stored.isEmpty()) {
      tags.get().applyTagsBatch(stored, target.fqn());
      stored.forEach(label -> rdf.add().accept(label, target));
    }
  }

  @Transaction
  public void delete(final List<TagLabel> labels, final Target target) {
    final List<TagLabel> stored = nonDerived(labels);
    if (!stored.isEmpty()) {
      tags.get().deleteTagsBatch(stored, target.fqn());
      stored.forEach(label -> rdf.delete().accept(label, target));
    }
  }

  public void addMany(final Map<String, List<TagLabel>> byTarget) {
    if (!nullOrEmpty(byTarget)) {
      tags.get().applyTagsBatchMultiTarget(byTarget);
      byTarget.forEach(this::publishAdded);
    }
  }

  public void addEntities(final List<? extends EntityInterface> entities) {
    final Map<String, List<TagLabel>> byTarget = new LinkedHashMap<>();
    for (final EntityInterface entity : entities) {
      final List<TagLabel> labels = nonDerived(entity.getTags());
      if (!labels.isEmpty()) {
        byTarget
            .computeIfAbsent(entity.getFullyQualifiedName(), ignored -> new ArrayList<>())
            .addAll(labels);
      }
    }
    addMany(byTarget);
  }

  public void addColumns(final List<Column> columns) {
    if (nullOrEmpty(columns)) {
      return;
    }
    final Map<String, List<TagLabel>> byTarget = new LinkedHashMap<>();
    collectColumnTags(columns, byTarget);
    addMany(byTarget);
  }

  public static void collectColumnTags(
      final List<Column> columns, final Map<String, List<TagLabel>> byTarget) {
    if (nullOrEmpty(columns)) {
      return;
    }
    for (final Column column : columns) {
      if (!nullOrEmpty(column.getTags())) {
        byTarget.put(column.getFullyQualifiedName(), new ArrayList<>(column.getTags()));
      }
      if (column.getChildren() != null) {
        collectColumnTags(column.getChildren(), byTarget);
      }
    }
  }

  private void publishAdded(final String fqn, final List<TagLabel> labels) {
    final Target target = new Target(fqn, null, null);
    for (final TagLabel label : labels) {
      if (isNonDerived(label)) {
        rdf.add().accept(label, target);
      }
    }
  }

  public void deleteByTarget(final String fqn) {
    tags.get().deleteTagsByTarget(fqn);
  }

  public void addInFlush(
      final DeferredEffects effects, final List<TagLabel> labels, final String fqn) {
    final List<TagLabel> stored = nonDerived(labels);
    if (!stored.isEmpty()) {
      tags.get().applyTagsBatch(stored, fqn);
      defer(effects, stored, fqn, rdf.add());
    }
  }

  public void deleteInFlush(
      final DeferredEffects effects, final List<TagLabel> labels, final String fqn) {
    final List<TagLabel> stored = nonDerived(labels);
    if (!stored.isEmpty()) {
      tags.get().deleteTagsBatch(stored, fqn);
      defer(effects, stored, fqn, rdf.delete());
    }
  }

  public void replaceInFlush(
      final DeferredEffects effects,
      final List<TagLabel> original,
      final List<TagLabel> updated,
      final String fqn) {
    final List<TagLabel> removed = nonDerived(original);
    if (!removed.isEmpty()) {
      defer(effects, removed, fqn, rdf.delete());
    }
    addInFlush(effects, updated, fqn);
  }

  private void defer(
      final DeferredEffects effects,
      final List<TagLabel> labels,
      final String fqn,
      final BiConsumer<TagLabel, Target> publication) {
    final List<TagLabel> snapshot = List.copyOf(labels);
    final Target target = new Target(fqn, null, null);
    effects.deferTagEffect(() -> snapshot.forEach(label -> publication.accept(label, target)));
  }

  private List<TagLabel> nonDerived(final List<TagLabel> labels) {
    return nullOrEmpty(labels) ? List.of() : labels.stream().filter(this::isNonDerived).toList();
  }

  private boolean isNonDerived(final TagLabel label) {
    return !label.getLabelType().equals(TagLabel.LabelType.DERIVED);
  }
}
