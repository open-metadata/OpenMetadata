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
 *   <li>Advances the offset only across the contiguous run of committed offsets, pausing at gaps so a
 *       lower {@code change_event.offset} that commits AFTER a higher one (AUTO_INCREMENT/SERIAL
 *       values are visible only at commit) is never skipped; a gap unfilled past {@link
 *       #GAP_RESOLVE_TIMEOUT_MS} is treated as a permanent hole and skipped
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

  /**
   * How long a gap in the {@code change_event.offset} sequence may stay unfilled before the consumer
   * treats it as a permanent hole (e.g. a rolled-back insert that consumed an AUTO_INCREMENT value)
   * and skips past it.
   *
   * <p>Correctness depends on this exceeding the longest time any write path can hold a {@code
   * change_event} row in an uncommitted transaction; a row that commits later than this could have
   * its offset skipped and its audit event dropped. All known inserters satisfy that with large
   * margin: the REST response filter ({@code ChangeEventHandler}) inserts as a standalone auto-commit
   * AFTER the entity transaction has already committed; CSV import inserts on an async executor thread
   * (auto-commit); per-request repository inserts ride the single entity transaction (bounded by
   * request processing, p99 a few seconds); and bulk operations commit per {@code
   * BULK_CREATE_TXN_CHUNK_SIZE} (100) chunk with the change-event batch insert at the end of the
   * chunk transaction. 30s leaves roughly 10x headroom over the slowest of these while keeping a
   * genuine hole from stalling the consumer for long. Raise it if a longer-running single transaction
   * ever inserts {@code change_event} rows.
   */
  private static final long GAP_RESOLVE_TIMEOUT_MS = 30_000;

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
    AuditLogOffset stored = loadOffsetFromDatabase(collectionDAO);
    List<ChangeEventRecord> records =
        collectionDAO.changeEventDAO().listWithOffset(BATCH_SIZE, stored.currentOffset());
    int advanced = 0;
    if (!records.isEmpty()) {
      advanced = consumeBatch(collectionDAO, auditLogRepository, stored, records);
    }
    return advanced;
  }

  /**
   * Writes the contiguous run of change events starting at {@code currentOffset + 1} and advances the
   * durable offset only across what is provably settled. {@code change_event.offset} is an
   * AUTO_INCREMENT/SERIAL value assigned at insert but made visible only at commit, so under
   * concurrent writes a lower offset can become visible AFTER a higher one. Advancing blindly to the
   * max visible offset would step over the not-yet-committed lower offset and drop that audit event
   * permanently, which is the audit-log gap-skip flake. We therefore stop at the first gap and
   * re-check it on the next run; a gap that stays unfilled for {@link #GAP_RESOLVE_TIMEOUT_MS} is
   * treated as a permanent hole (e.g. a rolled-back insert) and skipped so the consumer never stalls.
   */
  private int consumeBatch(
      CollectionDAO collectionDAO,
      AuditLogRepository auditLogRepository,
      AuditLogOffset stored,
      List<ChangeEventRecord> records) {
    long currentOffset = stored.currentOffset();
    int contiguousCount = countContiguousPrefix(currentOffset, records);
    int advanced = writeContiguousRecords(auditLogRepository, records, contiguousCount);
    OffsetUpdate update =
        planAdvance(stored, records, contiguousCount, advanced, System.currentTimeMillis());
    logGapSkipIfNeeded(currentOffset, advanced, update);
    persistIfChanged(collectionDAO, stored, update);
    return advanced;
  }

  /**
   * Writes the leading {@code contiguousCount} records (offsets contiguous from {@code
   * currentOffset + 1}). Corrupt-JSON events are logged and skipped over (retrying never helps); a
   * genuine write/DB error stops the run so the failed offset is retried on the next pass. Returns
   * the number of records consumed (written or corrupt-skipped) — fewer than {@code contiguousCount}
   * only when a write error halted the run.
   */
  private int writeContiguousRecords(
      AuditLogRepository auditLogRepository, List<ChangeEventRecord> records, int contiguousCount) {
    int advanced = 0;
    boolean writeFailed = false;
    while (advanced < contiguousCount && !writeFailed) {
      ChangeEventRecord record = records.get(advanced);
      try {
        ChangeEvent changeEvent = JsonUtils.readValue(record.json(), ChangeEvent.class);
        auditLogRepository.write(changeEvent);
      } catch (JsonParsingException ex) {
        LOG.error(
            "Skipping corrupt change event at offset {} - JSON parsing failed. "
                + "Event data: [truncated to 500 chars] {}. Error: {}",
            record.offset(),
            truncateForLogging(record.json(), 500),
            ex.getMessage());
      } catch (Exception ex) {
        LOG.error(
            "Failed to write audit log for event at offset {}: {}",
            record.offset(),
            ex.getMessage());
        writeFailed = true;
      }
      if (!writeFailed) {
        advanced++;
      }
    }
    return advanced;
  }

  /** Number of leading records whose offsets are contiguous from {@code currentOffset + 1}. */
  static int countContiguousPrefix(long currentOffset, List<ChangeEventRecord> records) {
    int count = 0;
    long expected = currentOffset + 1;
    while (count < records.size() && records.get(count).offset() == expected) {
      count++;
      expected++;
    }
    return count;
  }

  /**
   * Decides the new durable offset and gap-wait timestamp after consuming the contiguous prefix. A
   * write error or a fully-consumed batch advances cleanly with no gap; otherwise a real offset gap
   * follows the prefix and the gap-wait/skip policy applies.
   */
  static OffsetUpdate planAdvance(
      AuditLogOffset stored,
      List<ChangeEventRecord> records,
      int contiguousCount,
      int advanced,
      long now) {
    boolean stoppedOnWriteError = advanced < contiguousCount;
    boolean gapAfterPrefix = !stoppedOnWriteError && contiguousCount < records.size();
    OffsetUpdate result;
    if (gapAfterPrefix) {
      result = planGapAdvance(stored, records, advanced, now);
    } else {
      result = new OffsetUpdate(stored.currentOffset() + advanced, 0L);
    }
    return result;
  }

  /**
   * Gap policy when the contiguous prefix is followed by an offset gap. Making forward progress this
   * pass resets the wait clock (the gap is freshly at the new head). Stuck exactly at the head gap, we
   * start/keep a wait clock and only skip the hole once it has stayed unfilled past {@link
   * #GAP_RESOLVE_TIMEOUT_MS}.
   */
  static OffsetUpdate planGapAdvance(
      AuditLogOffset stored, List<ChangeEventRecord> records, int advanced, long now) {
    long currentOffset = stored.currentOffset();
    long pendingGapSince = stored.pendingGapSince();
    OffsetUpdate result;
    if (advanced > 0) {
      result = new OffsetUpdate(currentOffset + advanced, 0L);
    } else if (pendingGapSince == 0L) {
      result = new OffsetUpdate(currentOffset, now);
    } else if (now - pendingGapSince >= GAP_RESOLVE_TIMEOUT_MS) {
      result = new OffsetUpdate(records.getFirst().offset() - 1, 0L);
    } else {
      result = new OffsetUpdate(currentOffset, pendingGapSince);
    }
    return result;
  }

  private void logGapSkipIfNeeded(long currentOffset, int advanced, OffsetUpdate update) {
    boolean skippedHole = advanced == 0 && update.offset() > currentOffset;
    if (skippedHole) {
      LOG.warn(
          "Audit log skipping unfilled change_event gap [{} .. {}] after {}ms; treating it as a "
              + "permanent hole (e.g. a rolled-back insert that consumed an auto-increment value)",
          currentOffset + 1,
          update.offset(),
          GAP_RESOLVE_TIMEOUT_MS);
    }
  }

  private void persistIfChanged(
      CollectionDAO collectionDAO, AuditLogOffset stored, OffsetUpdate update) {
    boolean changed =
        update.offset() != stored.currentOffset()
            || update.pendingGapSince() != stored.pendingGapSince();
    if (changed) {
      saveOffsetToDatabase(collectionDAO, update.offset(), update.pendingGapSince());
    }
  }

  private String truncateForLogging(String value, int maxLength) {
    if (value == null) {
      return "null";
    }
    if (value.length() <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength) + "...";
  }

  /**
   * Load offset from database. Always reads from DB to ensure consistency in multi-server
   * deployments where each server has its own in-memory state.
   */
  private AuditLogOffset loadOffsetFromDatabase(CollectionDAO collectionDAO) {
    AuditLogOffset result = new AuditLogOffset(0L, 0L, 0L);
    try {
      String storedJson =
          collectionDAO
              .eventSubscriptionDAO()
              .getSubscriberExtension(CONSUMER_ID, OFFSET_EXTENSION);
      if (storedJson != null) {
        result = JsonUtils.readValue(storedJson, AuditLogOffset.class);
      }
    } catch (Exception ex) {
      LOG.warn("Failed to load audit log offset from database: {}", ex.getMessage());
    }
    return result;
  }

  /** Persist offset to database for durability across restarts and server coordination. */
  private void saveOffsetToDatabase(
      CollectionDAO collectionDAO, long offset, long pendingGapSince) {
    try {
      AuditLogOffset offsetData =
          new AuditLogOffset(System.currentTimeMillis(), offset, pendingGapSince);
      String json = JsonUtils.pojoToJson(offsetData);
      collectionDAO
          .eventSubscriptionDAO()
          .upsertSubscriberExtension(CONSUMER_ID, OFFSET_EXTENSION, "auditLogOffset", json);
    } catch (Exception ex) {
      LOG.error("Failed to persist audit log offset {} to database: {}", offset, ex.getMessage());
    }
  }

  /**
   * Audit log consumer progress for the {@code change_event_consumers} table: the durable read offset
   * plus the wall-clock time a head gap was first observed ({@code 0} when the consumer is not
   * waiting on a gap). The trailing field defaults to {@code 0} when absent so offsets persisted by
   * an older build deserialize unchanged.
   */
  record AuditLogOffset(long timestamp, long currentOffset, long pendingGapSince) {}

  /** Outcome of a batch advance: the new durable offset and gap-wait timestamp to persist. */
  record OffsetUpdate(long offset, long pendingGapSince) {}
}
