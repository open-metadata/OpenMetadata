/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Slf4j
public class RdfPartitionWorker {
  private static final long MAX_CURSOR_INITIALIZATION_OFFSET = (long) Integer.MAX_VALUE + 1L;
  private static final int PROGRESS_UPDATE_INTERVAL = 100;

  private final DistributedRdfIndexCoordinator coordinator;
  private final RdfBatchProcessor batchProcessor;
  private final int batchSize;
  private final AtomicBoolean stopped = new AtomicBoolean(false);

  public RdfPartitionWorker(
      DistributedRdfIndexCoordinator coordinator, RdfBatchProcessor batchProcessor, int batchSize) {
    this.coordinator = coordinator;
    this.batchProcessor = batchProcessor;
    this.batchSize = batchSize;
  }

  public PartitionResult processPartition(RdfIndexPartition partition) {
    String entityType = partition.getEntityType();
    long currentOffset = Math.max(partition.getCursor(), partition.getRangeStart());
    long processedCount = partition.getProcessedCount();
    long successCount = partition.getSuccessCount();
    long failedCount = partition.getFailedCount();

    try {
      String keysetCursor = initializeKeysetCursor(entityType, currentOffset);
      while (currentOffset < partition.getRangeEnd()
          && !stopped.get()
          && !Thread.currentThread().isInterrupted()) {
        int currentBatchSize = (int) Math.min(batchSize, partition.getRangeEnd() - currentOffset);
        ResultList<? extends EntityInterface> resultList =
            readEntitiesKeyset(entityType, keysetCursor, currentBatchSize);

        if (resultList == null || listOrEmpty(resultList.getData()).isEmpty()) {
          break;
        }

        RdfBatchProcessor.BatchProcessingResult batchResult =
            batchProcessor.processEntities(entityType, resultList.getData(), stopped::get);
        int readerErrors = listOrEmpty(resultList.getErrors()).size();
        long batchProcessed = resultList.getData().size() + readerErrors;

        processedCount += batchProcessed;
        successCount += batchResult.successCount();
        failedCount += batchResult.failedCount() + readerErrors;
        currentOffset += batchProcessed;

        if (processedCount % PROGRESS_UPDATE_INTERVAL < batchProcessed) {
          coordinator.updatePartitionProgress(
              partition.toBuilder()
                  .cursor(currentOffset)
                  .processedCount(processedCount)
                  .successCount(successCount)
                  .failedCount(failedCount)
                  .build());
        }

        keysetCursor = resultList.getPaging() != null ? resultList.getPaging().getAfter() : null;
        if (keysetCursor == null && currentOffset < partition.getRangeEnd()) {
          keysetCursor = initializeKeysetCursor(entityType, currentOffset);
          if (keysetCursor == null) {
            break;
          }
        }
      }

      if (stopped.get() || Thread.currentThread().isInterrupted()) {
        return new PartitionResult(processedCount, successCount, failedCount, true, null);
      }

      coordinator.completePartition(
          partition.getId(), currentOffset, processedCount, successCount, failedCount);
      return new PartitionResult(processedCount, successCount, failedCount, false, null);
    } catch (Exception e) {
      LOG.error("Failed to process RDF partition {}", partition.getId(), e);
      coordinator.failPartition(
          partition.getId(),
          currentOffset,
          processedCount,
          successCount,
          failedCount,
          e.getMessage());
      return new PartitionResult(processedCount, successCount, failedCount, false, e.getMessage());
    }
  }

  public void stop() {
    stopped.set(true);
  }

  private ResultList<? extends EntityInterface> readEntitiesKeyset(
      String entityType, String keysetCursor, int limit) throws SearchIndexException {
    PaginatedEntitiesSource source =
        new PaginatedEntitiesSource(entityType, limit, List.of("*"), 0);
    return source.readNextKeyset(keysetCursor);
  }

  private String initializeKeysetCursor(String entityType, long offset) {
    if (offset <= 0) {
      return null;
    }
    int cursorOffset = toCursorOffset(entityType, offset);
    return Entity.getEntityRepository(entityType)
        .getCursorAtOffset(new ListFilter(Include.ALL), cursorOffset);
  }

  private int toCursorOffset(String entityType, long offset) {
    long cursorOffset = offset - 1L;
    if (cursorOffset > Integer.MAX_VALUE) {
      throw new IllegalArgumentException(
          String.format(
              "Keyset cursor initialization for entityType %s does not support offsets above %d",
              entityType, MAX_CURSOR_INITIALIZATION_OFFSET));
    }
    return Math.toIntExact(cursorOffset);
  }

  public record PartitionResult(
      long processedCount,
      long successCount,
      long failedCount,
      boolean stopped,
      String errorMessage) {}
}
