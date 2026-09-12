package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.service.entity.read.ReadBundle;
import org.openmetadata.service.entity.read.ReadBundleContext;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TagLabelWithFQNHash;
import org.openmetadata.service.util.FullyQualifiedName;

/** Certification shares tag storage while retaining its own projection and replacement rules. */
@Slf4j
public final class EntityCertificationService<T extends EntityInterface> {
  private final Supplier<TagUsageDAO> usages;
  private final Supplier<String> classification;
  private final boolean supported;
  private final Consumer<TagLabel> enrich;

  public EntityCertificationService(
      final Supplier<TagUsageDAO> usages,
      final Supplier<String> classification,
      final boolean supported,
      final Consumer<TagLabel> enrich) {
    this.usages = usages;
    this.classification = classification;
    this.supported = supported;
    this.enrich = enrich;
  }

  public boolean isSupported() {
    return supported;
  }

  public String classificationName() {
    return supported ? classification.get() : null;
  }

  public AssetCertification read(final T entity) {
    if (!supported) {
      return null;
    }
    final ReadBundle bundle = ReadBundleContext.getCurrent();
    if (bundle != null && bundle.hasCertification(entity.getId())) {
      return bundle.getCertificationOrNull(entity.getId());
    }
    final String name = classificationName();
    final List<TagLabelWithFQNHash> rows =
        name == null ? List.of() : readRows(List.of(entity.getFullyQualifiedName()), name);
    return nullOrEmpty(rows) ? null : fromLabel(rows.getFirst().toTagLabel());
  }

  public Map<UUID, AssetCertification> readMany(
      final List<T> entities, final Function<T, AssetCertification> fallback) {
    if (nullOrEmpty(entities) || !supported) {
      return new HashMap<>();
    }
    final String name = classificationName();
    if (name == null) {
      return new HashMap<>();
    }
    final List<TagLabelWithFQNHash> rows;
    try {
      rows = readRows(entities.stream().map(EntityInterface::getFullyQualifiedName).toList(), name);
    } catch (RuntimeException exception) {
      LOG.warn("Certification batch read failed; falling back to individual reads", exception);
      final Map<UUID, AssetCertification> result = new HashMap<>();
      entities.forEach(entity -> result.put(entity.getId(), fallback.apply(entity)));
      return result;
    }
    return project(entities, rows);
  }

  public Map<UUID, AssetCertification> fromRows(
      final List<T> entities, final List<TagLabelWithFQNHash> rows) {
    final String name = classificationName();
    if (name == null || nullOrEmpty(entities) || nullOrEmpty(rows)) {
      return new HashMap<>();
    }
    // Match the certification-only SQL prefix, including nested classification tags.
    final String prefix = FullyQualifiedName.buildHash(name) + ".";
    final Set<String> certificationFqns =
        rows.stream()
            .filter(row -> row.getSource() == TagLabel.TagSource.CLASSIFICATION.ordinal())
            .map(TagLabelWithFQNHash::getTagFQN)
            .distinct()
            .filter(fqn -> FullyQualifiedName.buildHash(fqn).startsWith(prefix))
            .collect(Collectors.toSet());
    return project(
        entities,
        rows.stream()
            .filter(row -> row.getSource() == TagLabel.TagSource.CLASSIFICATION.ordinal())
            .filter(row -> certificationFqns.contains(row.getTagFQN()))
            .toList());
  }

  private List<TagLabelWithFQNHash> readRows(final List<String> fqns, final String name) {
    return usages
        .get()
        .getCertTagsInternalBatch(
            TagLabel.TagSource.CLASSIFICATION.ordinal(),
            fqns,
            FullyQualifiedName.buildHash(name) + ".%");
  }

  private Map<UUID, AssetCertification> project(
      final List<T> entities, final List<TagLabelWithFQNHash> rows) {
    final Map<String, UUID> ids = new HashMap<>();
    entities.forEach(
        entity ->
            ids.put(FullyQualifiedName.buildHash(entity.getFullyQualifiedName()), entity.getId()));
    final Map<UUID, AssetCertification> result = new HashMap<>();
    for (final TagLabelWithFQNHash row : rows) {
      final UUID id = ids.get(row.getTargetFQNHash());
      if (id != null && !result.containsKey(id)) {
        result.put(id, fromLabel(row.toTagLabel()));
      }
    }
    return result;
  }

  public AssetCertification fromLabel(final TagLabel label) {
    enrich.accept(label);
    return new AssetCertification()
        .withTagLabel(label)
        .withAppliedDate(label.getAppliedAt() == null ? null : label.getAppliedAt().getTime())
        .withExpiryDate(label.getMetadata() == null ? null : label.getMetadata().getExpiryDate());
  }

  public void apply(final T entity) {
    apply(entity, this::read);
  }

  public void apply(final T entity, final Function<T, AssetCertification> current) {
    if (!supported || !hasCertification(entity)) {
      return;
    }
    final AssetCertification incoming = entity.getCertification();
    if (!isUnchanged(current.apply(entity), incoming)) {
      delete(entity.getFullyQualifiedName());
      final String tagFqn = incoming.getTagLabel().getTagFQN();
      usages
          .get()
          .applyTag(
              TagLabel.TagSource.CLASSIFICATION.ordinal(),
              tagFqn,
              tagFqn,
              entity.getFullyQualifiedName(),
              TagLabel.LabelType.AUTOMATED.ordinal(),
              TagLabel.State.CONFIRMED.ordinal(),
              null,
              entity.getUpdatedBy(),
              new TagLabelMetadata().withExpiryDate(incoming.getExpiryDate()));
    }
  }

  private boolean isUnchanged(
      final AssetCertification existing, final AssetCertification incoming) {
    return existing != null
        && existing.getTagLabel() != null
        && existing.getTagLabel().getTagFQN().equals(incoming.getTagLabel().getTagFQN())
        && Objects.equals(existing.getExpiryDate(), incoming.getExpiryDate());
  }

  public void applyMany(final List<T> entities) {
    final String name = classificationName();
    if (name == null) {
      return;
    }
    final List<T> certified = entities.stream().filter(this::hasCertification).toList();
    if (!certified.isEmpty()) {
      usages
          .get()
          .deleteTagsByPrefixAndTargets(
              TagLabel.TagSource.CLASSIFICATION.ordinal(),
              name + ".%",
              certified.stream().map(EntityInterface::getFullyQualifiedName).toList());
      final Map<String, List<TagLabel>> tags = new LinkedHashMap<>();
      certified.forEach(
          entity -> tags.put(entity.getFullyQualifiedName(), List.of(storedLabel(entity))));
      usages.get().applyTagsBatchMultiTarget(tags);
    }
  }

  private boolean hasCertification(final T entity) {
    return entity.getCertification() != null
        && entity.getCertification().getTagLabel() != null
        && entity.getCertification().getTagLabel().getTagFQN() != null;
  }

  private TagLabel storedLabel(final T entity) {
    final AssetCertification certification = entity.getCertification();
    return new TagLabel()
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withTagFQN(certification.getTagLabel().getTagFQN())
        .withLabelType(TagLabel.LabelType.AUTOMATED)
        .withState(TagLabel.State.CONFIRMED)
        .withAppliedBy(entity.getUpdatedBy())
        .withMetadata(new TagLabelMetadata().withExpiryDate(certification.getExpiryDate()));
  }

  public void delete(final String fqn) {
    final String name = classificationName();
    if (name != null) {
      usages
          .get()
          .deleteTagsByPrefixAndTarget(
              TagLabel.TagSource.CLASSIFICATION.ordinal(), name + ".%", fqn);
    }
  }

  public void deleteOtherTags(final String fqn) {
    final String name = classificationName();
    if (name == null) {
      usages.get().deleteTagsByTarget(fqn);
    } else {
      usages
          .get()
          .deleteTagsByTargetExcludingPrefix(
              TagLabel.TagSource.CLASSIFICATION.ordinal(), name + ".%", fqn);
    }
  }

  public List<TagLabel> withoutCertification(final List<TagLabel> tags, final String name) {
    final List<TagLabel> result = new ArrayList<>(tags);
    if (name != null) {
      result.removeIf(tag -> name.equals(FullyQualifiedName.getParentFQN(tag.getTagFQN())));
    }
    return result;
  }
}
