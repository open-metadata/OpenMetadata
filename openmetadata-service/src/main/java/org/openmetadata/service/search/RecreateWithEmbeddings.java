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
    recreateChunkIndexIfFullRun(entities);
    return super.reCreateIndexes(entities);
  }

  /**
   * A recreate covering every vector-indexable entity type also recreates the dedicated chunk
   * index, so chunks of entities that no longer exist (DB restore/wipe — no delete events) don't
   * survive the rebuild and keep surfacing in AI retrieval. Guarded three ways: the driving job
   * must explicitly request recreateIndex (this handler is also invoked by non-recreate distributed
   * runs and by the jobless ops-CLI createIndexes path — neither may drop chunks); the run must
   * cover every vector-indexable entity type (a partial recreate would destroy chunks of types it
   * will not re-embed); and after the drop, the chunk-header fingerprint lookup misses for every
   * entity, so the reindex fully re-chunks and re-embeds — nothing is silently skipped.
   */
  private void recreateChunkIndexIfFullRun(Set<String> entities) {
    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (vectorService == null
        || entities == null
        || getJobData() == null
        || !Boolean.TRUE.equals(getJobData().getRecreateIndex())) {
      return;
    }
    if (coversAllVectorTypes(entities)) {
      vectorService.recreateChunkIndex();
    } else {
      LOG.info(
          "Partial recreate ({} of {} vector-indexable types) — keeping the chunk index; orphaned "
              + "chunks, if any, are only swept by a full recreate",
          coveredVectorTypeCount(entities),
          AvailableEntityTypes.SET.size());
    }
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
  public void finalizeReindex(EntityReindexContext context, boolean reindexSuccess) {
    super.finalizeReindex(context, reindexSuccess);

    if (reindexSuccess) {
      SearchRepository searchRepository = Entity.getSearchRepository();
      if (searchRepository.isVectorEmbeddingEnabled()) {
        LOG.info(
            "Reindex finalized for entity type '{}' with vector embeddings enabled",
            context.getEntityType());
      }
    }
  }
}
