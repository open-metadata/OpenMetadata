package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

/**
 * The entities whose chunk documents this node's reindex sink could not write during one run,
 * including those it could not embed at all. Each is retried once when the partition that missed
 * it finishes, after that partition's writes are flushed, and only then counted, so a recovered entity is one vector success and an entity that
 * still misses is one vector failure. A miss never blocks the chunk generation; an entity left
 * without chunks gets them on its next edit or reindex.
 * ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service
 */
@Slf4j
final class MissedChunks {
  private static final String ALL_FIELDS = "*";

  /** What the first attempt left out of the run's targets. */
  enum Missing {
    /** The chunk documents only; the entity document has its embedding. */
    CHUNKS,
    /** The entity document's embedding and the chunk documents: the provider call failed. */
    EMBEDDING
  }

  /** One entity that missed, with the stats tracker of the partition that missed it. */
  record Miss(
      EntityReference entity,
      StageStatsTracker tracker,
      EmbeddingTargets targets,
      Missing missing) {}

  /** A retried miss and whether everything it missed is now written. */
  record Retried(Miss miss, boolean written) {}

  private final Map<String, Miss> pending = new ConcurrentHashMap<>();
  private final AtomicLong missed = new AtomicLong();
  private final AtomicLong missedEmbeddings = new AtomicLong();
  private final AtomicLong recovered = new AtomicLong();
  private final AtomicLong unrecovered = new AtomicLong();

  void addChunks(EntityInterface<?> entity, StageStatsTracker tracker, EmbeddingTargets targets) {
    add(new Miss(entity.getEntityReference(), tracker, targets, Missing.CHUNKS));
  }

  void addEmbedding(
      EntityInterface<?> entity, StageStatsTracker tracker, EmbeddingTargets targets) {
    missedEmbeddings.incrementAndGet();
    add(new Miss(entity.getEntityReference(), tracker, targets, Missing.EMBEDDING));
  }

  private void add(Miss miss) {
    pending.put(miss.entity().getId().toString(), miss);
    missed.incrementAndGet();
    LOG.debug(
        "Missed the {} of {}; retrying before the partition ends",
        miss.missing(),
        miss.entity().getId());
  }

  /**
   * Retries the pending misses of the partition tracked by {@code partition} once, one at a time so
   * the provider's own concurrency limit holds. While the provider's circuit is open nothing is
   * retried and every miss stays a failure.
   */
  List<Retried> retry(StageStatsTracker partition, VectorIndexService vectorService) {
    List<Miss> misses = drain(partition);
    boolean providerAvailable = providerAvailable(vectorService);
    List<Retried> retried = new ArrayList<>(misses.size());
    for (Miss miss : misses) {
      boolean written = providerAvailable && retryOnce(miss, vectorService);
      (written ? recovered : unrecovered).incrementAndGet();
      retried.add(new Retried(miss, written));
    }
    return retried;
  }

  // A partition's tracker is its own, so this takes only the misses whose documents that
  // partition has already flushed.
  private List<Miss> drain(StageStatsTracker partition) {
    List<Miss> drained = new ArrayList<>();
    pending
        .entrySet()
        .removeIf(
            entry -> {
              boolean ofPartition = entry.getValue().tracker() == partition;
              if (ofPartition) {
                drained.add(entry.getValue());
              }
              return ofPartition;
            });
    return drained;
  }

  private static boolean providerAvailable(VectorIndexService vectorService) {
    EmbeddingClient embeddingClient = vectorService.getEmbeddingClient();
    return embeddingClient != null && embeddingClient.isAvailable();
  }

  // An entity deleted since its miss needs no embedding, so it is not a failure.
  private static boolean retryOnce(Miss miss, VectorIndexService vectorService) {
    boolean written;
    try {
      EntityInterface<?> entity = Entity.getEntity(miss.entity(), ALL_FIELDS, Include.NON_DELETED);
      written =
          miss.missing() == Missing.EMBEDDING
              ? embedAfresh(entity, miss.targets(), vectorService)
              : vectorService.backfillEntityChunks(entity, miss.targets().stagedChunkTarget());
    } catch (EntityNotFoundException deleted) {
      written = true;
    } catch (RuntimeException e) {
      LOG.debug("Retry of {} failed: {}", miss.entity().getId(), e.getMessage());
      written = false;
    }
    return written;
  }

  /**
   * Writes what a first attempt that succeeded would have written: chunk 0's embedding fields on
   * the entity document, which the bulk has already indexed, and the chunk documents. Each write is
   * tried even when the other fails, so a chunk index that cannot be written never costs the
   * entity its document embedding.
   */
  private static boolean embedAfresh(
      EntityInterface<?> entity, EmbeddingTargets targets, VectorIndexService vectorService) {
    List<Map<String, Object>> chunkDocs =
        VectorDocBuilder.fromEntity(entity, vectorService.getEmbeddingClient());
    String entityId = entity.getId().toString();
    boolean embeddingWritten =
        chunkDocs.isEmpty()
            || vectorService.writeEntityEmbedding(
                targets.entityIndex(),
                entityId,
                VectorDocBuilder.legacyEmbeddingFields(chunkDocs.getFirst()));
    boolean chunksWritten =
        chunkDocs.isEmpty()
            || vectorService.writeEntityChunks(entityId, chunkDocs, targets.stagedChunkTarget());
    return embeddingWritten && chunksWritten;
  }

  /** One warning per run on this node when anything was missed, with how the rest heal. */
  void logSummary() {
    long missedCount = missed.get();
    if (missedCount > 0) {
      LOG.warn(
          "Search Indexing missed the chunk documents of {} entities on this node, {} of them "
              + "with their entity embedding too; the retry recovered {}. {} count as vector "
              + "failures and get their embeddings on their next edit or the next reindex",
          missedCount,
          missedEmbeddings.get(),
          recovered.get(),
          unrecovered.get());
    }
  }
}
