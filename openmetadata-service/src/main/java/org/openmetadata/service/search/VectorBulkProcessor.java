package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch.core.BulkRequest;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;
import os.org.opensearch.client.opensearch.core.bulk.BulkResponseItem;

@Slf4j
public class VectorBulkProcessor implements AutoCloseable {
  private static final int DEFAULT_MAX_BULK_ACTIONS = 500;
  private static final long DEFAULT_MAX_PAYLOAD_BYTES = 50L * 1024 * 1024;

  private final OpenSearchClient client;
  private final String targetIndex;
  private final int maxBulkActions;
  private final long maxPayloadBytes;

  private final List<VectorChunk> buffer = new ArrayList<>();
  private final AtomicLong payloadSize = new AtomicLong(0);
  private final AtomicLong totalSuccess = new AtomicLong(0);
  private final AtomicLong totalFailed = new AtomicLong(0);
  private StageStatsTracker statsTracker;

  public record VectorChunk(String chunkId, Map<String, Object> document, long estimatedSize) {}

  public VectorBulkProcessor(OpenSearchClient client, String targetIndex) {
    this(client, targetIndex, DEFAULT_MAX_BULK_ACTIONS, DEFAULT_MAX_PAYLOAD_BYTES);
  }

  public VectorBulkProcessor(
      OpenSearchClient client, String targetIndex, int maxBulkActions, long maxPayloadBytes) {
    this.client = client;
    this.targetIndex = targetIndex;
    this.maxBulkActions = maxBulkActions;
    this.maxPayloadBytes = maxPayloadBytes;
  }

  public void setStatsTracker(StageStatsTracker tracker) {
    this.statsTracker = tracker;
  }

  public synchronized void addChunk(String chunkId, Map<String, Object> chunkDoc) {
    long estimated = estimateChunkSize(chunkDoc);
    if (shouldFlush(estimated)) {
      flush();
    }
    buffer.add(new VectorChunk(chunkId, chunkDoc, estimated));
    payloadSize.addAndGet(estimated);
  }

  public synchronized void flush() {
    if (buffer.isEmpty()) {
      return;
    }

    List<VectorChunk> toFlush = new ArrayList<>(buffer);
    buffer.clear();
    payloadSize.set(0);

    try {
      List<BulkOperation> operations = new ArrayList<>(toFlush.size());
      for (VectorChunk chunk : toFlush) {
        operations.add(
            BulkOperation.of(
                op ->
                    op.index(
                        idx ->
                            idx.index(targetIndex)
                                .id(chunk.chunkId())
                                .document(chunk.document()))));
      }

      BulkRequest bulkRequest =
          BulkRequest.of(b -> b.operations(operations).refresh(Refresh.False));
      BulkResponse response = client.bulk(bulkRequest);

      int success = 0;
      int failed = 0;
      for (BulkResponseItem item : response.items()) {
        if (item.error() != null) {
          failed++;
        } else {
          success++;
        }
      }

      totalSuccess.addAndGet(success);
      totalFailed.addAndGet(failed);

      if (statsTracker != null) {
        for (int i = 0; i < success; i++) {
          statsTracker.recordVector(StatsResult.SUCCESS);
        }
        for (int i = 0; i < failed; i++) {
          statsTracker.recordVector(StatsResult.FAILED);
        }
      }

      if (failed > 0) {
        LOG.warn(
            "Vector bulk flush: {} success, {} failed out of {} in {}",
            success,
            failed,
            toFlush.size(),
            targetIndex);
      } else {
        LOG.debug("Vector bulk flush: {} documents indexed in {}", success, targetIndex);
      }
    } catch (Exception e) {
      totalFailed.addAndGet(toFlush.size());
      if (statsTracker != null) {
        for (int i = 0; i < toFlush.size(); i++) {
          statsTracker.recordVector(StatsResult.FAILED);
        }
      }
      LOG.error(
          "Vector bulk flush failed for {} documents in {}: {}",
          toFlush.size(),
          targetIndex,
          e.getMessage(),
          e);
    }
  }

  private boolean shouldFlush(long additionalSize) {
    return buffer.size() >= maxBulkActions || payloadSize.get() + additionalSize > maxPayloadBytes;
  }

  private long estimateChunkSize(Map<String, Object> doc) {
    long size = 0;
    Object embedding = doc.get("embedding");
    if (embedding instanceof float[] arr) {
      size += (long) arr.length * 4;
    }
    for (Map.Entry<String, Object> entry : doc.entrySet()) {
      if ("embedding".equals(entry.getKey())) continue;
      Object value = entry.getValue();
      if (value instanceof String s) {
        size += s.length() * 2L;
      } else if (value instanceof List<?> list) {
        size += list.size() * 50L;
      }
    }
    return (long) (size * 1.2);
  }

  public long getTotalSuccess() {
    return totalSuccess.get();
  }

  public long getTotalFailed() {
    return totalFailed.get();
  }

  @Override
  public void close() {
    flush();
  }
}
