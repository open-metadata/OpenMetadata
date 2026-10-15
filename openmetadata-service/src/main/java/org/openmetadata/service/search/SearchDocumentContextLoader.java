package org.openmetadata.service.search;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.SearchIndex;

/** Batch dependency reads shared by every search producer. */
@Slf4j
public final class SearchDocumentContextLoader {
  private final BiFunction<
          String, List<? extends EntityInterface<?>>, Map<UUID, List<EsLineageData>>>
      lineage;
  private final BiFunction<String, List<? extends EntityInterface<?>>, Map<UUID, Optional<Style>>>
      serviceStyles;
  private final BiFunction<String, List<UUID>, Map<UUID, Long>> relationshipRevisions;

  public SearchDocumentContextLoader(
      BiFunction<String, List<? extends EntityInterface<?>>, Map<UUID, List<EsLineageData>>>
          lineage,
      BiFunction<String, List<? extends EntityInterface<?>>, Map<UUID, Optional<Style>>>
          serviceStyles,
      BiFunction<String, List<UUID>, Map<UUID, Long>> relationshipRevisions) {
    this.lineage = lineage;
    this.serviceStyles = serviceStyles;
    this.relationshipRevisions = relationshipRevisions;
  }

  public static SearchDocumentContextLoader forCatalog() {
    return new SearchDocumentContextLoader(
        SearchIndex::prefetchLineageIfSupported,
        SearchIndex::prefetchServiceStylesIfSupported,
        (type, ids) ->
            Entity.TEST_CASE.equals(type)
                ? TestCaseRepository.getTestSuiteRelationshipRevisions(ids)
                : TestSuiteRepository.getTestsRelationshipRevisions(ids));
  }

  public Map<UUID, DocBuildContext> load(
      final String entityType,
      final List<? extends EntityInterface<?>> entities,
      final Map<UUID, Long> suppliedRevisions) {
    final PrefetchedData prefetched =
        new PrefetchedData(
            prefetch(entityType, "lineage", () -> lineage.apply(entityType, entities)),
            prefetch(entityType, "service styles", () -> serviceStyles.apply(entityType, entities)),
            prefetch(
                entityType,
                "relationship revisions",
                () -> loadRevisions(entityType, entities, suppliedRevisions)));
    final Map<UUID, DocBuildContext> contexts = new HashMap<>();
    entities.stream()
        .map(EntityInterface::getId)
        .filter(Objects::nonNull)
        .forEach(
            id -> {
              final DocBuildContext context = prefetched.forEntity(id);
              if (!DocBuildContext.empty().equals(context)) {
                contexts.put(id, context);
              }
            });
    return Map.copyOf(contexts);
  }

  private Map<UUID, Long> loadRevisions(
      final String entityType,
      final List<? extends EntityInterface<?>> entities,
      final Map<UUID, Long> suppliedRevisions) {
    final List<UUID> ids =
        entities.stream()
            .filter(entity -> hasRelationshipRevision(entityType, entity))
            .map(EntityInterface::getId)
            .filter(Objects::nonNull)
            .toList();
    final List<UUID> missing =
        ids.stream().filter(id -> !suppliedRevisions.containsKey(id)).toList();
    final Map<UUID, Long> stored =
        missing.isEmpty() ? Map.of() : relationshipRevisions.apply(entityType, missing);
    final Map<UUID, Long> revisions = new HashMap<>();
    ids.forEach(
        id -> revisions.put(id, suppliedRevisions.getOrDefault(id, stored.getOrDefault(id, 0L))));
    return revisions;
  }

  private static boolean hasRelationshipRevision(
      final String entityType, final EntityInterface<?> entity) {
    return Entity.TEST_CASE.equals(entityType)
        || Entity.TEST_SUITE.equals(entityType)
            && entity instanceof TestSuite suite
            && Boolean.FALSE.equals(suite.getBasic());
  }

  private static <T> T prefetch(
      final String entityType, final String dependency, final Supplier<T> read) {
    try {
      return read.get();
    } catch (RuntimeException | LinkageError failure) {
      // Missing prefetches retain the mapper's per-entity reads; empty results suppress those
      // reads.
      LOG.warn(
          "Could not prefetch {} for {}; retaining per-entity lookup",
          dependency,
          entityType,
          failure);
      return null;
    }
  }

  private record PrefetchedData(
      Map<UUID, List<EsLineageData>> lineage,
      Map<UUID, Optional<Style>> serviceStyles,
      Map<UUID, Long> revisions) {
    DocBuildContext forEntity(final UUID id) {
      final boolean hasStyle = serviceStyles != null && serviceStyles.containsKey(id);
      return DocBuildContext.of(
          lineage == null ? null : lineage.get(id),
          hasStyle
              ? DocBuildContext.ServiceStylePrefetch.prefetched(serviceStyles.get(id))
              : DocBuildContext.ServiceStylePrefetch.notPrefetched(),
          revisions == null ? null : revisions.get(id));
    }
  }
}
