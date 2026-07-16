package org.openmetadata.service.search;

import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;

@Slf4j
public class RecreateWithEmbeddings extends DefaultRecreateHandler {

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

  private void clearStagedChunkStateQuietly(String stagedChunkIndex) {
    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (stagedChunkIndex != null && vectorService != null) {
      vectorService.clearStagedChunkState(stagedChunkIndex);
    }
  }

  /**
   * A recreate covering every vector-indexable entity type also recreates the dedicated chunk
   * index, so chunks of entities that no longer exist (DB restore/wipe — no delete events) don't
   * survive the rebuild and keep surfacing in AI retrieval. The recreate is STAGED: the run writes
   * into a bare next-generation index (whose empty fingerprint lookups force a full re-embed), and
   * the generation is only promoted — one atomic alias swap, old data removed — after every
   * vector-indexable type finalizes successfully (see {@link #finalizeReindex}); any failure
   * before promotion leaves the old chunks fully live. Guarded two ways: the driving job must
   * explicitly request recreateIndex (this handler is also invoked by non-recreate distributed
   * runs and by the jobless ops-CLI createIndexes path), and the run must cover every
   * vector-indexable entity type (a partial recreate must not stage a sweep of types it will not
   * re-embed).
   */
  private String recreateChunkIndexIfFullRun(Set<String> entities) {
    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (vectorService == null
        || entities == null
        || getJobData() == null
        || !Boolean.TRUE.equals(getJobData().getRecreateIndex())) {
      return null;
    }
    if (coversAllVectorTypes(entities)) {
      return vectorService.beginStagedChunkRecreate();
    } else {
      LOG.info(
          "Partial recreate ({} of {} vector-indexable types) — keeping the chunk index; orphaned "
              + "chunks, if any, are only swept by a full recreate",
          coveredVectorTypeCount(entities),
          AvailableEntityTypes.SET.size());
    }
    return null;
  }

  /**
   * Whether the run covers every vector-indexable entity type, compared case-insensitively: the
   * reindex job carries canonical camelCase names ("glossaryTerm") while {@link
   * AvailableEntityTypes#SET} is lowercased ("glossaryterm") — a case-sensitive containsAll would
   * never match and the chunk recreate would silently never fire.
   */
  static boolean coversAllVectorTypes(Set<String> entities) {
    return coveredVectorTypeCount(entities) == AvailableEntityTypes.SET.size();
  }

  static long coveredVectorTypeCount(Set<String> entities) {
    Set<String> normalized =
        entities.stream().map(e -> e.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
    return AvailableEntityTypes.SET.stream().filter(normalized::contains).count();
  }

  @Override
  public void promoteEntityIndex(EntityReindexContext context, boolean reindexSuccess) {
    // Distributed full recreates promote entity indexes through this per-entity path instead of
    // finalizeReindex — without this hook the staged chunk generation would never reach its
    // completion gate on distributed runs. markEntityTypeReindexed is idempotent, so runs that
    // invoke both callbacks for a type are harmless. The mark lives in a finally so a throwing
    // promotion still reports the type (as failed) — otherwise the staged chunk run would wait
    // forever instead of reaching a safe terminal state.
    RuntimeException superFailure = null;
    try {
      super.promoteEntityIndex(context, reindexSuccess);
    } catch (RuntimeException e) {
      superFailure = e;
    }
    markChunkTypeOutcomeAndRethrow(context, reindexSuccess, superFailure);
  }

  @Override
  public void finalizeReindex(EntityReindexContext context, boolean reindexSuccess) {
    // Same shape as promoteEntityIndex: a throwing finalize must still report the type.
    RuntimeException superFailure = null;
    try {
      super.finalizeReindex(context, reindexSuccess);
    } catch (RuntimeException e) {
      superFailure = e;
    }
    markChunkTypeOutcomeAndRethrow(context, reindexSuccess, superFailure);

    if (reindexSuccess && Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      LOG.info(
          "Reindex finalized for entity type '{}' with vector embeddings enabled",
          context.getEntityType());
    }
  }

  /**
   * Feeds the staged chunk recreate: promotes the staged generation once every vector-indexable
   * type has completed successfully; a failed type (including a throwing super callback) keeps the
   * old chunks live. Marks are bound to the callback's own run via the context's staged chunk
   * generation, so a later run's callbacks can never complete a stale generation. When the super
   * callback itself failed, a marking failure is logged rather than thrown so it cannot mask the
   * original exception; otherwise (e.g. the promotion swap failing) it propagates and fails the
   * job loudly.
   */
  private void markChunkTypeOutcomeAndRethrow(
      EntityReindexContext context, boolean reindexSuccess, RuntimeException superFailure) {
    try {
      OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
      if (vectorService != null) {
        vectorService.markEntityTypeReindexed(
            context.getEntityType(),
            reindexSuccess && superFailure == null,
            context.getStagedChunkIndex());
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
