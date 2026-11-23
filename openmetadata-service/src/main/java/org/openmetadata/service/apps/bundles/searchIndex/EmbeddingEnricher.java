package org.openmetadata.service.apps.bundles.searchIndex;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.StoredEmbeddingReuse;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;

/**
 * The embedding step of a reindex bulk sink, the same on Elasticsearch and OpenSearch: it splices
 * an entity's embedding into its staged search document and writes the entity's chunk documents.
 * Chunks it cannot write are retried once when their partition ends, then counted; see {@link
 * MissedChunks}.
 */
@Slf4j
final class EmbeddingEnricher {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final SearchRepository searchRepository;
  private final AtomicLong succeeded = new AtomicLong();
  private final AtomicLong failed = new AtomicLong();
  private final MissedChunks missedChunks = new MissedChunks();

  /** What enriching one entity did with its embedding and its chunk documents. */
  private enum Embedded {
    /** The entity document has its embedding and the chunks are written, or need no write. */
    COMPLETE,
    /** The entity document has its embedding; its chunks were missed and wait for the retry. */
    CHUNKS_MISSED,
    /** The provider was unavailable, so the entity document has no embedding either. */
    NONE
  }

  EmbeddingEnricher(SearchRepository searchRepository) {
    this.searchRepository = searchRepository;
  }

  boolean isEnabledFor(String entityType) {
    return searchRepository.isVectorEmbeddingEnabled()
        && searchRepository.getVectorIndexService() != null
        && AvailableEntityTypes.isVectorIndexable(entityType)
        && searchRepository.getIndexMapping(entityType) != null;
  }

  /**
   * The stored embeddings of {@code entities} that are still current, keyed by entity id. {@link
   * #enrich} splices these instead of calling the embedding provider.
   */
  Map<String, JsonNode> reusableEmbeddings(
      List<EntityInterface<?>> entities, String indexName, ReindexContext reindexContext) {
    Map<String, JsonNode> reusable = Collections.emptyMap();
    VectorIndexService vectorService = searchRepository.getVectorIndexService();
    if (vectorService != null && !entities.isEmpty()) {
      try {
        reusable =
            vectorService.getExistingEmbeddingsBatch(
                storedEmbeddingsIndex(entities, indexName, reindexContext),
                currentFingerprints(entities));
      } catch (RuntimeException e) {
        LOG.warn("Failed to fetch existing embeddings (canonical index={})", indexName, e);
      }
    }
    return reusable;
  }

  // A recreate stages an empty index, so its stored embeddings are in the index it replaces.
  private static String storedEmbeddingsIndex(
      List<EntityInterface<?>> entities, String indexName, ReindexContext reindexContext) {
    String entityType = entities.getFirst().getEntityReference().getType();
    return reindexContext == null
        ? indexName
        : reindexContext.getOriginalIndex(entityType).orElse(indexName);
  }

  private static Map<String, Supplier<String>> currentFingerprints(
      List<EntityInterface<?>> entities) {
    Map<String, Supplier<String>> currentById = new HashMap<>(entities.size());
    for (EntityInterface<?> entity : entities) {
      currentById.put(
          entity.getId().toString(), () -> VectorDocBuilder.computeFingerprintForEntity(entity));
    }
    return currentById;
  }

  /**
   * Returns {@code json} with the entity's embedding fields added, after writing its chunk
   * documents to the generation {@code reindexContext} staged, or to the live chunk index when it
   * staged none. A failure is counted and returns {@code json} unchanged, so the entity is still
   * indexed.
   */
  String enrich(
      EntityInterface<?> entity,
      String json,
      Map<String, JsonNode> reusableById,
      StageStatsTracker tracker,
      ReindexContext reindexContext) {
    String enriched = json;
    try {
      VectorIndexService vectorService = searchRepository.getVectorIndexService();
      Optional<ObjectNode> doc = embeddableDoc(entity, json, vectorService);
      if (doc.isPresent()) {
        JsonNode stored = reusableById.get(entity.getId().toString());
        String stagedChunkTarget = stagedChunkTarget(reindexContext);
        Embedded embedded = embed(entity, doc.get(), stored, vectorService, stagedChunkTarget);
        record(embedded, entity, tracker, stagedChunkTarget);
        enriched = MAPPER.writeValueAsString(doc.get());
      }
    } catch (JsonProcessingException | RuntimeException e) {
      LOG.warn(
          "Failed to generate embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
      count(failed, tracker, StatsResult.FAILED);
    }
    return enriched;
  }

  /** The search document as a tree, or empty when this entity gets no embedding. */
  private static Optional<ObjectNode> embeddableDoc(
      EntityInterface<?> entity, String json, VectorIndexService vectorService)
      throws JsonProcessingException {
    Optional<ObjectNode> doc = Optional.empty();
    // The entity-type gate cannot see one instance opting out (a restricted context memory), so
    // each entity is asked, as VectorEmbeddingHandler does for live updates.
    if (vectorService != null && Entity.isVectorEmbeddable(entity)) {
      if (MAPPER.readTree(json) instanceof ObjectNode object) {
        doc = Optional.of(object);
      } else {
        LOG.warn(
            "Skipping embedding enrichment for entity {}: index doc is not a JSON object",
            entity.getId());
      }
    }
    return doc;
  }

  // Only a full recreate stages a chunk generation. Every other run carries none, and null
  // sends its chunk documents to the live chunk index.
  private static String stagedChunkTarget(ReindexContext reindexContext) {
    return reindexContext == null ? null : reindexContext.getStagedChunkIndex().orElse(null);
  }

  // A missed chunk write is counted once the retry decides it; the other outcomes are final now.
  private void record(
      Embedded embedded,
      EntityInterface<?> entity,
      StageStatsTracker tracker,
      String stagedChunkTarget) {
    switch (embedded) {
      case COMPLETE -> count(succeeded, tracker, StatsResult.SUCCESS);
      case CHUNKS_MISSED -> missedChunks.add(entity, tracker, stagedChunkTarget);
      case NONE -> count(failed, tracker, StatsResult.FAILED);
    }
  }

  private static Embedded embed(
      EntityInterface<?> entity,
      ObjectNode doc,
      JsonNode stored,
      VectorIndexService vectorService,
      String stagedChunkTarget) {
    EmbeddingClient embeddingClient = vectorService.getEmbeddingClient();
    int dimension = embeddingClient == null ? -1 : embeddingClient.getDimension();
    Embedded embedded = Embedded.NONE;
    if (StoredEmbeddingReuse.isSpliceable(stored, dimension)) {
      // The stored chunkIndex, chunkCount and parentId are spliced too. That is safe because the
      // fingerprint that admitted this entry covers the body text that decides the chunk count.
      doc.setAll((ObjectNode) stored);
      // Catalogs embedded before the chunk index existed have an embedding but no chunk
      // documents. The backfill is fingerprint-guarded, so it is a no-op once they exist. Chunk
      // documents describe committed entity state, so writing them is safe even when this run's
      // staged entity index is never promoted.
      embedded = chunksOutcome(vectorService.backfillEntityChunks(entity, stagedChunkTarget));
    } else if (embeddingClient != null && embeddingClient.isAvailable()) {
      embedded = embedAfresh(entity, doc, vectorService, stagedChunkTarget);
    }
    // Otherwise the provider is out: the entity is indexed without an embedding, which the next
    // reindex adds, instead of every entity in the run failing.
    return embedded;
  }

  private static Embedded chunksOutcome(boolean chunksWritten) {
    return chunksWritten ? Embedded.COMPLETE : Embedded.CHUNKS_MISSED;
  }

  /** One provider call per chunk: chunk 0 also gives the entity document its embedding. */
  private static Embedded embedAfresh(
      EntityInterface<?> entity,
      ObjectNode doc,
      VectorIndexService vectorService,
      String stagedChunkTarget) {
    List<Map<String, Object>> chunkDocs =
        VectorDocBuilder.fromEntity(entity, vectorService.getEmbeddingClient());
    boolean chunksWritten = true;
    if (!chunkDocs.isEmpty()) {
      Map<String, Object> entityFields =
          VectorDocBuilder.legacyEmbeddingFields(chunkDocs.getFirst());
      doc.setAll((ObjectNode) MAPPER.valueToTree(entityFields));
      chunksWritten =
          vectorService.writeEntityChunks(entity.getId().toString(), chunkDocs, stagedChunkTarget);
    }
    return chunksOutcome(chunksWritten);
  }

  /**
   * Retries once the chunks missed for {@code entityType} on this node and counts each: a success
   * when its chunks are now written, a failure when they are still missing.
   */
  void retryMissedChunks(String entityType) {
    VectorIndexService vectorService = searchRepository.getVectorIndexService();
    if (vectorService != null) {
      Set<StageStatsTracker> trackers = new HashSet<>();
      for (MissedChunks.Retried retried : missedChunks.retry(entityType, vectorService)) {
        StageStatsTracker tracker = retried.miss().tracker();
        count(
            retried.written() ? succeeded : failed,
            tracker,
            retried.written() ? StatsResult.SUCCESS : StatsResult.FAILED);
        if (tracker != null) {
          trackers.add(tracker);
        }
      }
      trackers.forEach(StageStatsTracker::flush);
    }
  }

  void logMissedChunksSummary() {
    missedChunks.logSummary();
  }

  private static void count(AtomicLong counter, StageStatsTracker tracker, StatsResult result) {
    counter.incrementAndGet();
    if (tracker != null) {
      tracker.recordVector(result);
    }
  }

  StepStats stats() {
    return new StepStats()
        .withTotalRecords((int) (succeeded.get() + failed.get()))
        .withSuccessRecords((int) succeeded.get())
        .withFailedRecords((int) failed.get());
  }
}
