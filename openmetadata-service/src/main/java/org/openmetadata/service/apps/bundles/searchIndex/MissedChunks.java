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
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

/**
 * The entities whose chunk documents this node's reindex sink could not write during one run. Each
 * is retried once when a partition of its type finishes, and only then counted, so a recovered
 * entity is one vector success and an entity that still misses is one vector failure. A miss never
 * blocks the chunk generation; an entity left without chunks gets them on its next edit or reindex.
 * ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service
 */
@Slf4j
final class MissedChunks {
  private static final String ALL_FIELDS = "*";

  /** One entity whose chunks were missed, with the stats tracker of the partition that missed it. */
  record Miss(EntityReference entity, StageStatsTracker tracker, String stagedChunkTarget) {}

  /** A retried miss and whether its chunks are now written. */
  record Retried(Miss miss, boolean written) {}

  private final Map<String, Miss> pending = new ConcurrentHashMap<>();
  private final AtomicLong missed = new AtomicLong();
  private final AtomicLong recovered = new AtomicLong();

  void add(EntityInterface<?> entity, StageStatsTracker tracker, String stagedChunkTarget) {
    pending.put(
        entity.getId().toString(),
        new Miss(entity.getEntityReference(), tracker, stagedChunkTarget));
    missed.incrementAndGet();
    LOG.debug(
        "Missed the chunk documents of {}; retrying them before the partition ends",
        entity.getId());
  }

  /**
   * Retries the pending misses of {@code entityType} once, one at a time so the provider's own
   * concurrency limit holds. While the provider's circuit is open nothing is retried and every
   * miss stays a failure.
   */
  List<Retried> retry(String entityType, VectorIndexService vectorService) {
    List<Miss> misses = drain(entityType);
    boolean providerAvailable = providerAvailable(vectorService);
    List<Retried> retried = new ArrayList<>(misses.size());
    for (Miss miss : misses) {
      boolean written = providerAvailable && retryOnce(miss, vectorService);
      if (written) {
        recovered.incrementAndGet();
      }
      retried.add(new Retried(miss, written));
    }
    return retried;
  }

  private List<Miss> drain(String entityType) {
    List<Miss> drained = new ArrayList<>();
    pending
        .entrySet()
        .removeIf(
            entry -> {
              boolean ofType = entry.getValue().entity().getType().equalsIgnoreCase(entityType);
              if (ofType) {
                drained.add(entry.getValue());
              }
              return ofType;
            });
    return drained;
  }

  private static boolean providerAvailable(VectorIndexService vectorService) {
    EmbeddingClient embeddingClient = vectorService.getEmbeddingClient();
    return embeddingClient != null && embeddingClient.isAvailable();
  }

  // An entity deleted since its miss needs no chunks, so it is not a failure.
  private static boolean retryOnce(Miss miss, VectorIndexService vectorService) {
    boolean written;
    try {
      EntityInterface<?> entity = Entity.getEntity(miss.entity(), ALL_FIELDS, Include.NON_DELETED);
      written = vectorService.backfillEntityChunks(entity, miss.stagedChunkTarget());
    } catch (EntityNotFoundException deleted) {
      written = true;
    } catch (RuntimeException e) {
      LOG.debug("Retry of the chunks of {} failed: {}", miss.entity().getId(), e.getMessage());
      written = false;
    }
    return written;
  }

  /** One warning per run on this node when chunks were missed, with how the rest heal. */
  void logSummary() {
    long missedCount = missed.get();
    if (missedCount > 0) {
      long recoveredCount = recovered.get();
      LOG.warn(
          "Search Indexing missed the chunk documents of {} entities on this node; the retry "
              + "recovered {}. The other {} count as vector failures and get their chunks on their "
              + "next edit or the next reindex",
          missedCount,
          recoveredCount,
          missedCount - recoveredCount);
    }
  }
}
