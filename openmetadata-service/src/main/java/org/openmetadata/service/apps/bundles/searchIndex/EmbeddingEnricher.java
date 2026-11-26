package org.openmetadata.service.apps.bundles.searchIndex;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
import org.openmetadata.service.search.vector.client.EmbeddingModel;
import org.openmetadata.service.search.vector.utils.EmbeddedEntityTypes;

/**
 * The embedding step of a reindex bulk sink, the same on Elasticsearch and OpenSearch: it splices
 * an entity's embedding into its staged search document and writes the entity's chunk documents.
 * An embedding or chunks it cannot write are retried once when their partition ends, then counted;
 * see {@link MissedChunks}.
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
    /** The provider failed or its circuit was open: no embedding and no chunks, until the retry. */
    EMBEDDING_MISSED,
    /** There is no embedding client, so nothing can be embedded or retried. */
    NONE
  }

  EmbeddingEnricher(SearchRepository searchRepository) {
    this.searchRepository = searchRepository;
  }

  boolean isEnabledFor(String entityType) {
    return searchRepository.isVectorEmbeddingEnabled()
        && searchRepository.getVectorIndexService() != null
        && EmbeddedEntityTypes.isEmbedded(entityType)
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
   * documents to {@code targets}. A miss returns {@code json} without them, so the entity is still
   * indexed, and the retry at the end of its partition writes what was missed.
   */
  String enrich(
      EntityInterface<?> entity,
      String json,
      Map<String, JsonNode> reusableById,
      StageStatsTracker tracker,
      EmbeddingTargets targets) {
    String enriched = json;
    try {
      VectorIndexService vectorService = searchRepository.getVectorIndexService();
      Optional<ObjectNode> doc = embeddableDoc(entity, json, vectorService);
      if (doc.isPresent()) {
        JsonNode stored = reusableById.get(entity.getId().toString());
        Embedded embedded =
            embed(entity, doc.get(), stored, vectorService, targets.stagedChunkTarget());
        enriched = MAPPER.writeValueAsString(doc.get());
        record(embedded, entity, tracker, targets);
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

  // A miss is counted once the retry decides it; the other outcomes are final now.
  private void record(
      Embedded embedded,
      EntityInterface<?> entity,
      StageStatsTracker tracker,
      EmbeddingTargets targets) {
    switch (embedded) {
      case COMPLETE -> count(succeeded, tracker, StatsResult.SUCCESS);
      case CHUNKS_MISSED -> missedChunks.addChunks(entity, tracker, targets);
      case EMBEDDING_MISSED -> missedChunks.addEmbedding(entity, tracker, targets);
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
    Embedded embedded = Embedded.NONE;
    if (embeddingClient == null) {
      LOG.debug("No embedding client; indexing entity {} without an embedding", entity.getId());
    } else if (StoredEmbeddingReuse.isSpliceable(stored, EmbeddingModel.of(embeddingClient))) {
      // The stored chunkIndex, chunkCount and parentId are spliced too. That is safe because the
      // fingerprint that admitted this entry covers the body text that decides the chunk count.
      doc.setAll((ObjectNode) stored);
      // Catalogs embedded before the chunk index existed have an embedding but no chunk
      // documents. The backfill checks the fingerprint and the model, so it is a no-op once they
      // exist. Chunk documents describe committed entity state, so writing them is safe even when
      // this run's staged entity index is never promoted.
      embedded = chunksOutcome(vectorService.backfillEntityChunks(entity, stagedChunkTarget));
    } else {
      embedded = embedAfresh(entity, doc, vectorService, stagedChunkTarget);
    }
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
    return embedChunks(entity, vectorService.getEmbeddingClient())
        .map(
            chunkDocs ->
                spliceAndWriteChunks(entity, doc, chunkDocs, vectorService, stagedChunkTarget))
        .orElse(Embedded.EMBEDDING_MISSED);
  }

  // A provider error, or a circuit open so no call is made, is a miss: the node's summary warning
  // reports it, so each entity is logged at debug only.
  private static Optional<List<Map<String, Object>>> embedChunks(
      EntityInterface<?> entity, EmbeddingClient embeddingClient) {
    Optional<List<Map<String, Object>>> chunkDocs;
    try {
      chunkDocs = Optional.of(VectorDocBuilder.fromEntity(entity, embeddingClient));
    } catch (RuntimeException e) {
      LOG.debug(
          "Could not embed {}; retrying it before the partition ends: {}",
          entity.getId(),
          e.getMessage());
      chunkDocs = Optional.empty();
    }
    return chunkDocs;
  }

  private static Embedded spliceAndWriteChunks(
      EntityInterface<?> entity,
      ObjectNode doc,
      List<Map<String, Object>> chunkDocs,
      VectorIndexService vectorService,
      String stagedChunkTarget) {
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
   * Retries once what the partition tracked by {@code partition} missed, once its writes are
   * flushed, and counts each entity: a success when its embedding and chunks are now written, a
   * failure when they are still missing. Other partitions of the same type sharing this sink keep
   * their misses, because their entity documents may not be written yet.
   */
  void retryMissedChunks(StageStatsTracker partition) {
    VectorIndexService vectorService = searchRepository.getVectorIndexService();
    if (vectorService != null) {
      List<MissedChunks.Retried> retried = missedChunks.retry(partition, vectorService);
      for (MissedChunks.Retried entity : retried) {
        count(
            entity.written() ? succeeded : failed,
            partition,
            entity.written() ? StatsResult.SUCCESS : StatsResult.FAILED);
      }
      if (partition != null && !retried.isEmpty()) {
        partition.flush();
      }
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
