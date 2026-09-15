package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.cache.CachedTagUsageDao;
import org.openmetadata.service.entity.read.ReadBundle;
import org.openmetadata.service.entity.read.ReadBundleContext;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TagLabelWithFQNHash;
import org.openmetadata.service.util.FullyQualifiedName;

/** Shares tag usage rows across requested metadata projections and retains the detail cache path. */
public final class EntityTagReader<T extends EntityInterface> {
  public record Projection(
      boolean tags, boolean certification, DerivedTagLoader.FailureMode failureMode) {}

  public record Hydration<T>(
      Function<List<TagLabelWithFQNHash>, Map<String, List<TagLabel>>> populate,
      DerivedTagLoader derived,
      Function<T, AssetCertification> certificationFallback) {}

  public record Options(String entityType, boolean supportsTags, Consumer<String> recordFallback) {}

  private final Supplier<TagUsageDAO> usages;
  private final Supplier<CachedTagUsageDao> cache;
  private final EntityCertificationService<T> certifications;
  private final Hydration<T> hydration;
  private final Options options;

  public EntityTagReader(
      final Supplier<TagUsageDAO> usages,
      final Supplier<CachedTagUsageDao> cache,
      final EntityCertificationService<T> certifications,
      final Hydration<T> hydration,
      final Options options) {
    this.usages = usages;
    this.cache = cache;
    this.certifications = certifications;
    this.hydration = hydration;
    this.options = options;
  }

  public List<TagLabel> read(final T entity) {
    if (!options.supportsTags()) {
      return null;
    }
    final Optional<List<TagLabel>> bundled = fromBundle(entity);
    if (bundled.isPresent()) {
      return bundled.get();
    }
    final CachedTagUsageDao cached = cache.get();
    final List<TagLabel> tags =
        cached == null ? null : cached.getTags(options.entityType(), entity.getId());
    return tags == null ? readAndCache(entity, cached) : tags;
  }

  private Optional<List<TagLabel>> fromBundle(final T entity) {
    if (entity == null || entity.getId() == null) {
      return Optional.empty();
    }
    final ReadBundle bundle = ReadBundleContext.getCurrent();
    final Optional<List<TagLabel>> tags =
        bundle == null ? Optional.empty() : bundle.getTags(entity.getId());
    if (tags.isEmpty()) {
      options.recordFallback().accept(bundle == null ? "no_bundle" : "not_loaded");
    }
    return tags;
  }

  private List<TagLabel> readAndCache(final T entity, final CachedTagUsageDao cached) {
    final List<TagLabel> tags = read(entity.getFullyQualifiedName());
    if (cached != null && tags != null) {
      cached.putTags(options.entityType(), entity.getId(), JsonUtils.pojoToJson(tags));
    }
    return tags;
  }

  public List<TagLabel> read(final String fqn) {
    if (!options.supportsTags()) {
      return null;
    }
    final List<TagLabel> tags = hydration.derived().loadSingle(usages.get().getTags(fqn));
    final String classification = certifications.classificationName();
    return classification == null || tags == null
        ? tags
        : certifications.withoutCertification(tags, classification);
  }

  public Map<String, List<TagLabel>> readByPrefix(final String prefix, final String postfix) {
    if (!options.supportsTags()) {
      return null;
    }
    final Map<String, List<TagLabel>> result = usages.get().getTagsByPrefix(prefix, postfix, true);
    final String classification = certifications.classificationName();
    if (classification != null && result != null) {
      result
          .values()
          .forEach(
              tags ->
                  tags.removeIf(
                      tag ->
                          classification.equals(FullyQualifiedName.getParentFQN(tag.getTagFQN()))));
    }
    return result;
  }

  public Map<String, List<TagLabel>> readMany(final List<String> fqns) {
    return nullOrEmpty(fqns) ? Map.of() : projectTags(fqns, readRows(fqns));
  }

  private List<TagLabelWithFQNHash> readRows(final List<String> fqns) {
    return listOrEmpty(usages.get().getTagsInternalBatch(fqns));
  }

  private Map<String, List<TagLabel>> projectTags(
      final List<String> fqns, final List<TagLabelWithFQNHash> rows) {
    final Map<String, List<TagLabel>> byHash = hydration.populate().apply(rows);
    final String classification = certifications.classificationName();
    final Map<String, List<TagLabel>> result = new HashMap<>();
    fqns.forEach(
        fqn ->
            result.computeIfAbsent(
                fqn,
                key ->
                    certifications.withoutCertification(
                        byHash.getOrDefault(FullyQualifiedName.buildHash(key), List.of()),
                        classification)));
    return result;
  }

  public void populate(final List<T> entities, final Projection projection) {
    if (nullOrEmpty(entities)) {
      return;
    }
    if (projection.tags() && options.supportsTags()) {
      populateTags(entities, projection);
    } else if (projection.certification() && certifications.isSupported()) {
      assignCertifications(
          entities, certifications.readMany(entities, hydration.certificationFallback()));
    }
  }

  private void populateTags(final List<T> entities, final Projection projection) {
    final List<String> fqns =
        entities.stream().map(EntityInterface::getFullyQualifiedName).toList();
    final List<TagLabelWithFQNHash> rows = readRows(fqns);
    final Map<Integer, List<TagLabel>> tags =
        hydration
            .derived()
            .load(tagsByOccurrence(entities, projectTags(fqns, rows)), projection.failureMode());
    for (int index = 0; index < entities.size(); index++) {
      entities.get(index).setTags(tags.get(index));
    }
    if (projection.certification() && certifications.isSupported()) {
      assignCertifications(entities, certifications.fromRows(entities, rows));
    }
  }

  private Map<Integer, List<TagLabel>> tagsByOccurrence(
      final List<T> entities, final Map<String, List<TagLabel>> tags) {
    final Map<Integer, List<TagLabel>> result = new LinkedHashMap<>();
    for (int index = 0; index < entities.size(); index++) {
      result.put(index, tags.get(entities.get(index).getFullyQualifiedName()));
    }
    return result;
  }

  private void assignCertifications(
      final List<T> entities, final Map<UUID, AssetCertification> values) {
    entities.forEach(entity -> entity.setCertification(values.get(entity.getId())));
  }

  public void loadBundle(final EntityInterface entity, final ReadBundle bundle) {
    final String fqn = entity.getFullyQualifiedName();
    final List<TagLabel> tags =
        hydration
            .populate()
            .apply(readRows(List.of(fqn)))
            .getOrDefault(FullyQualifiedName.buildHash(fqn), List.of());
    final String classification = certifications.classificationName();
    final AssetCertification certification = extractBundleCertification(tags, classification);
    final List<TagLabel> normal = new ArrayList<>(tags);
    if (certification != null) {
      normal.remove(certification.getTagLabel());
    }
    bundle.putTags(entity.getId(), normal);
    if (certifications.isSupported()) {
      bundle.putCertification(entity.getId(), certification);
    }
  }

  private AssetCertification extractBundleCertification(
      final List<TagLabel> tags, final String classification) {
    return classification == null
        ? null
        : tags.stream()
            .filter(tag -> classification.equals(FullyQualifiedName.getParentFQN(tag.getTagFQN())))
            .findFirst()
            .map(certifications::fromLabel)
            .orElse(null);
  }
}
