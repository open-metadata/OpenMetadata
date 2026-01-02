/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.audit;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.util.DIContainer;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

/**
 * Quartz job that consumes change events from the change_event table and writes them to the
 * audit_log table.
 *
 * <p>Key design decisions:
 *
 * <ul>
 *   <li>Uses @DisallowConcurrentExecution to prevent concurrent execution within same JVM
 *   <li>Always loads offset from database (not in-memory) to handle multi-server deployments
 *   <li>Tracks actual offset values from events (not count) to handle gaps in sequence
 *   <li>Uses idempotent inserts (ON CONFLICT DO NOTHING) as safety net for duplicates
 *   <li>Processes multiple batches per execution when behind, with limits to avoid busy loops
 * </ul>
 */
@Slf4j
@DisallowConcurrentExecution
public class AuditLogConsumer implements Job {

  private static final String CONSUMER_ID = "AUDIT_LOG_CONSUMER";
  private static final String OFFSET_EXTENSION = "offset";
  private static final int BATCH_SIZE = 100;
  private static final int MAX_BATCHES_PER_EXECUTION = 10;

  @SuppressWarnings("unused")
  public AuditLogConsumer(DIContainer di) {
    // Required by CustomJobFactory in EventSubscriptionScheduler
  }

  @Override
  public void execute(JobExecutionContext context) {
    try {
      CollectionDAO collectionDAO = Entity.getCollectionDAO();
      AuditLogRepository auditLogRepository = Entity.getAuditLogRepository();

      if (auditLogRepository == null) {
        LOG.warn("AuditLogRepository not initialized, skipping audit log consumer execution");
        return;
      }

      int totalProcessed = 0;
      int batchCount = 0;

      // Process multiple batches when behind, but limit to avoid busy loops
      // This allows catching up faster while still being fair to other consumers
      while (batchCount < MAX_BATCHES_PER_EXECUTION) {
        int processed = processBatch(collectionDAO, auditLogRepository);
        totalProcessed += processed;
        batchCount++;

        // If we processed less than a full batch, we're caught up
        if (processed < BATCH_SIZE) {
          break;
        }
      }

      if (totalProcessed > 0) {
        LOG.debug(
            "Audit log consumer processed {} events in {} batches", totalProcessed, batchCount);
      }
    } catch (Exception ex) {
      LOG.error("Error in audit log consumer execution: {}", ex.getMessage(), ex);
    }
  }

  /**
   * Process a single batch of change events.
   *
   * @return number of events successfully processed
   */
  private int processBatch(CollectionDAO collectionDAO, AuditLogRepository auditLogRepository) {
    // Always load offset from database to handle multi-server deployments correctly
    long currentOffset = loadOffsetFromDatabase(collectionDAO);

    List<ChangeEventRecord> records =
        collectionDAO.changeEventDAO().listWithOffset(BATCH_SIZE, currentOffset);

    if (records.isEmpty()) {
      return 0;
    }

    int processedCount = 0;
    long lastSuccessfulOffset = currentOffset;

    LOG.debug("Processing batch: currentOffset={}, recordCount={}", currentOffset, records.size());

    for (ChangeEventRecord record : records) {
      try {
        ChangeEvent changeEvent = JsonUtils.readValue(record.json(), ChangeEvent.class);
        LOG.debug(
            "Processing event at offset {}: id={}, type={}, entityType={}",
            record.offset(),
            changeEvent.getId(),
            changeEvent.getEventType(),
            changeEvent.getEntityType());
        auditLogRepository.write(changeEvent);
        lastSuccessfulOffset = record.offset();
        processedCount++;
      } catch (JsonParsingException ex) {
        // JSON parsing error - skip this event and continue
        // The event data is corrupt, retrying won't help
        LOG.warn(
            "Skipping change event at offset {} due to JSON parsing error: {}",
            record.offset(),
            ex.getMessage());
        lastSuccessfulOffset = record.offset();
      } catch (Exception ex) {
        // Database or other error - stop processing this batch
        // Don't advance offset past failed events so they'll be retried
        LOG.error(
            "Failed to write audit log for event at offset {}: {}",
            record.offset(),
            ex.getMessage());
        break;
      }
    }

    // Only save offset if we made progress
    if (lastSuccessfulOffset > currentOffset) {
      saveOffsetToDatabase(collectionDAO, lastSuccessfulOffset);
    }

    return processedCount;
  }

  /**
   * Load offset from database. Always reads from DB to ensure consistency in multi-server
   * deployments where each server has its own in-memory state.
   */
  private long loadOffsetFromDatabase(CollectionDAO collectionDAO) {
    try {
      String storedJson =
          collectionDAO
              .eventSubscriptionDAO()
              .getSubscriberExtension(CONSUMER_ID, OFFSET_EXTENSION);
      if (storedJson != null) {
        AuditLogOffset offsetData = JsonUtils.readValue(storedJson, AuditLogOffset.class);
        return offsetData.currentOffset();
      }
    } catch (Exception ex) {
      LOG.warn("Failed to load audit log offset from database: {}", ex.getMessage());
    }
    return 0L;
  }

  /** Persist offset to database for durability across restarts and server coordination. */
  private void saveOffsetToDatabase(CollectionDAO collectionDAO, long offset) {
    try {
      AuditLogOffset offsetData = new AuditLogOffset(System.currentTimeMillis(), offset);
      String json = JsonUtils.pojoToJson(offsetData);
      collectionDAO
          .eventSubscriptionDAO()
          .upsertSubscriberExtension(CONSUMER_ID, OFFSET_EXTENSION, "auditLogOffset", json);
    } catch (Exception ex) {
      LOG.error("Failed to persist audit log offset {} to database: {}", offset, ex.getMessage());
    }
  }

  /** Record for storing audit log consumer offset with timestamp for change_event_consumers table. */
  private record AuditLogOffset(long timestamp, long currentOffset) {}
}
