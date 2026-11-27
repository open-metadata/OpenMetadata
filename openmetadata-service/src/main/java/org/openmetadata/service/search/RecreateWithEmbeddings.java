package org.openmetadata.service.search;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.utils.EmbeddedEntityTypes;

@Slf4j
public class RecreateWithEmbeddings extends DefaultRecreateHandler {

  // Entity types whose staged entity index replaced the live one during the current callback. A
  // type is finalized by one callback at a time, so the set never holds a type for two calls.
  private final Set<String> promotedEntityTypes = ConcurrentHashMap.newKeySet();

  @Override
  public ReindexContext reCreateIndexes(Set<String> entities) {
    SearchRepository searchRepository = Entity.getSearchRepository();
    searchRepository.initializeVectorSearchService();
    String stagedChunkIndex = recreateChunkIndexIfFullRun(entities);
    ReindexContext context;
    try {
      context = super.reCreateIndexes(entities);
    } catch (RuntimeException e) {
      // The run dies before any type can finalize — clear the JVM's staged state so a later,
      // unrelated run's callbacks can never complete and promote this dead generation. The bare
      // generation index itself is swept by the next staged recreate.
      clearStagedChunkStateQuietly(stagedChunkIndex);
      throw e;
    }
    context.setStagedChunkIndex(stagedChunkIndex);
    return context;
  }

  private static VectorIndexService vectorService() {
    return Entity.getSearchRepository().getVectorIndexService();
  }

  private void clearStagedChunkStateQuietly(String stagedChunkIndex) {
    VectorIndexService vectorService = vectorService();
    if (stagedChunkIndex != null && vectorService != null) {
      vectorService.clearStagedChunkState(stagedChunkIndex);
    }
  }

  /**
   * A recreate covering every type that writes to the data-asset chunk index also recreates the dedicated chunk
   * index, so chunks of entities that no longer exist (DB restore/wipe — no delete events) don't
   * survive the rebuild and keep surfacing in AI retrieval. The recreate is STAGED: the run writes
   * into a bare next-generation index (reusing the live generation's stored vectors for unchanged
   * entities, so the rebuild does not re-embed the whole catalog), and the generation goes live
   * with the entity indexes — one atomic alias swap, old data removed — once every data-asset
   * chunk type has finalized and its staged entity index was promoted (see {@link
   * #finalizeReindex}); a type whose entity index kept its live index keeps the old chunks live.
   * Guarded two ways (see {@link #shouldStageChunkRecreate}): the run must
   * be job-driven (the jobless ops-CLI createIndexes path must not stage), and it must cover every
   * vector-indexable entity type (a partial recreate must not stage a sweep of types it will not
   * re-embed).
   */
  private String recreateChunkIndexIfFullRun(Set<String> entities) {
    VectorIndexService vectorService = vectorService();
    String stagedGeneration = null;
    if (vectorService != null && entities != null && getJobData() != null) {
      if (shouldStageChunkRecreate(getJobData(), entities)) {
        stagedGeneration = vectorService.beginStagedChunkRecreate();
      } else {
        LOG.info(
            "Partial recreate ({} of {} vector-indexable types) — keeping the chunk index; "
                + "orphaned chunks, if any, are only swept by a full recreate",
            coveredVectorTypeCount(entities),
            EmbeddedEntityTypes.DATA_ASSETS.size());
      }
    }
    return stagedGeneration;
  }

  /**
   * Full-coverage, job-driven runs stage the chunk recreate. Deliberately independent of {@code
   * jobData.recreateIndex}: search reindexes always run in recreate mode, and
   * SearchIndexAppConfigSanitizer strips that removed flag from every persisted config, so it is
   * always null here and must not gate staging.
   */
  static boolean shouldStageChunkRecreate(EventPublisherJob jobData, Set<String> entities) {
    return jobData != null && entities != null && coversAllVectorTypes(entities);
  }

  /**
   * Whether the run covers every type that writes to the data-asset chunk index ({@link
   * EmbeddedEntityTypes#DATA_ASSETS}), compared case-insensitively so a job that names a type in
   * another casing still counts.
   */
  static boolean coversAllVectorTypes(Set<String> entities) {
    return coveredVectorTypeCount(entities) == EmbeddedEntityTypes.DATA_ASSETS.size();
  }

  static long coveredVectorTypeCount(Set<String> entities) {
    return entities.stream()
        .filter(EmbeddedEntityTypes::isDataAsset)
        .map(entity -> entity.toLowerCase(Locale.ROOT))
        .distinct()
        .count();
  }

  @Override
  public boolean promoteEntityIndex(EntityReindexContext context, boolean reindexSuccess) {
    // Distributed full recreates promote entity indexes through this per-entity path instead of
    // finalizeReindex — without this hook the staged chunk generation would never reach its
    // completion gate on distributed runs. markEntityTypeReindexed is idempotent, so runs that
    // invoke both callbacks for a type are harmless. A throwing promotion still reports the type
    // (as not promoted) — otherwise the staged chunk run would wait forever instead of reaching a
    // safe terminal state.
    boolean promoted = false;
    RuntimeException superFailure = null;
    try {
      promoted = super.promoteEntityIndex(context, reindexSuccess);
    } catch (RuntimeException e) {
      superFailure = e;
    }
    markChunkTypeOutcomeAndRethrow(context, superFailure);
    sweepOntologyChunksAfterPromotion(context, promoted, reindexSuccess);
    return promoted;
  }

  @Override
  protected void onStagedIndexPromoted(EntityReindexContext context) {
    promotedEntityTypes.add(context.getEntityType());
  }

  @Override
  public boolean finalizeReindex(EntityReindexContext context, boolean reindexSuccess) {
    // Same shape as promoteEntityIndex: a throwing finalize must still report the type.
    boolean promoted = false;
    RuntimeException superFailure = null;
    try {
      promoted = super.finalizeReindex(context, reindexSuccess);
    } catch (RuntimeException e) {
      superFailure = e;
    }
    markChunkTypeOutcomeAndRethrow(context, superFailure);
    sweepOntologyChunksAfterPromotion(context, promoted, reindexSuccess);

    if (reindexSuccess && Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      LOG.info(
          "Reindex finalized for entity type '{}' with vector embeddings enabled",
          context.getEntityType());
    }
    return promoted;
  }

  private void sweepOntologyChunksAfterPromotion(
      EntityReindexContext context, boolean promoted, boolean success) {
    if (promoted && success && OntologyTermSearch.isTerm(context.getEntityType())) {
      try {
        Entity.getSearchRepository().sweepOntologyChunks(context.getEntityType());
      } catch (IOException failure) {
        throw new UncheckedIOException(failure);
      }
    }
  }

  /**
   * Feeds the staged chunk recreate with whether the type's staged entity index replaced its live
   * one: the staged generation goes live once every vector-indexable type has finalized with its
   * entity index promoted, and a type whose entity index stayed live keeps the old chunks live.
   * Marks are bound to the callback's own run via the context's staged chunk generation, so a later
   * run's callbacks can never complete a stale generation. When the super callback itself failed,
   * a marking failure is logged rather than thrown so it cannot mask the original exception;
   * otherwise (e.g. the promotion swap failing) it propagates and fails the job loudly.
   */
  private void markChunkTypeOutcomeAndRethrow(
      EntityReindexContext context, RuntimeException superFailure) {
    boolean entityIndexPromoted =
        promotedEntityTypes.remove(context.getEntityType())
            && !context.isStagedChunkDeleteUnrecorded();
    try {
      VectorIndexService vectorService = vectorService();
      if (vectorService != null) {
        vectorService.markEntityTypeReindexed(
            context.getEntityType(), entityIndexPromoted, context.getStagedChunkIndex());
      }
    } catch (RuntimeException markFailure) {
      if (superFailure == null) {
        throw markFailure;
      }
      LOG.error(
          "Suppressed chunk-outcome failure while the callback for {} was already failing",
          context.getEntityType(),
          markFailure);
    }
    if (superFailure != null) {
      throw superFailure;
    }
  }
}
