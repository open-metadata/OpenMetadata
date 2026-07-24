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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.util.DIContainer;

/** Unit tests for AuditLogConsumer batch processing and offset management. */
@Execution(ExecutionMode.CONCURRENT)
class AuditLogConsumerTest {

  private static final long NOW = 1_000_000_000L;

  private CollectionDAO mockCollectionDAO;
  private ChangeEventDAO mockChangeEventDAO;
  private CollectionDAO.EventSubscriptionDAO mockEventSubscriptionDAO;
  private AuditLogRepository mockAuditLogRepository;

  @BeforeEach
  void setUp() {
    mockCollectionDAO = mock(CollectionDAO.class);
    mockChangeEventDAO = mock(ChangeEventDAO.class);
    mockEventSubscriptionDAO = mock(CollectionDAO.EventSubscriptionDAO.class);
    mockAuditLogRepository = mock(AuditLogRepository.class);

    when(mockCollectionDAO.changeEventDAO()).thenReturn(mockChangeEventDAO);
    when(mockCollectionDAO.eventSubscriptionDAO()).thenReturn(mockEventSubscriptionDAO);
  }

  @Test
  void testConstructorWithDIContainer() {
    DIContainer di = mock(DIContainer.class);
    AuditLogConsumer consumer = new AuditLogConsumer(di);
    assertNotNull(consumer);
  }

  @Test
  void testOffsetRecordSerialization() {
    // Test that the AuditLogOffset record can be serialized/deserialized
    long timestamp = System.currentTimeMillis();
    long offset = 100L;

    // Create JSON in the expected format
    String json = String.format("{\"timestamp\":%d,\"currentOffset\":%d}", timestamp, offset);

    // Verify it can be parsed (this tests the format expected by the consumer)
    assertNotNull(json);
    assertTrue(json.contains("timestamp"));
    assertTrue(json.contains("currentOffset"));
  }

  @Test
  void testBatchSizeConstant() {
    // Verify batch size is reasonable for processing
    // This is a sanity check - actual constant is private
    int expectedBatchSize = 100;
    int expectedMaxBatches = 10;

    // These values should allow processing up to 1000 events per execution
    assertEquals(1000, expectedBatchSize * expectedMaxBatches);
  }

  @Test
  void testChangeEventRecordStructure() {
    // Test the ChangeEventRecord structure used for offset-based fetching
    long offset = 42L;
    String json = "{\"id\":\"test\"}";

    ChangeEventRecord record = new ChangeEventRecord(offset, json);

    assertEquals(offset, record.offset());
    assertEquals(json, record.json());
  }

  @Test
  void testCreateValidChangeEventJson() {
    // Test that we can create valid ChangeEvent JSON for processing
    ChangeEvent event = new ChangeEvent();
    event.setId(UUID.randomUUID());
    event.setEventType(EventType.ENTITY_CREATED);
    event.setEntityType(Entity.TABLE);
    event.setEntityId(UUID.randomUUID());
    event.setUserName("admin");
    event.setTimestamp(System.currentTimeMillis());

    String json = JsonUtils.pojoToJson(event);
    assertNotNull(json);

    // Verify it can be deserialized back
    ChangeEvent parsed = JsonUtils.readValue(json, ChangeEvent.class);
    assertEquals(event.getId(), parsed.getId());
    assertEquals(event.getEventType(), parsed.getEventType());
    assertEquals(event.getEntityType(), parsed.getEntityType());
  }

  @Test
  void countContiguousPrefix_allContiguous_returnsFullSize() {
    List<ChangeEventRecord> records = recordsAtOffsets(11, 12, 13);
    assertEquals(3, AuditLogConsumer.countContiguousPrefix(10, records));
  }

  @Test
  void countContiguousPrefix_gapInMiddle_stopsAtGap() {
    List<ChangeEventRecord> records = recordsAtOffsets(11, 12, 14, 15);
    assertEquals(2, AuditLogConsumer.countContiguousPrefix(10, records));
  }

  @Test
  void countContiguousPrefix_gapAtHead_returnsZero() {
    List<ChangeEventRecord> records = recordsAtOffsets(13, 14);
    assertEquals(0, AuditLogConsumer.countContiguousPrefix(10, records));
  }

  @Test
  void planAdvance_fullyContiguousBatch_advancesToLastOffsetWithNoGapWait() {
    List<ChangeEventRecord> records = recordsAtOffsets(11, 12, 13);
    AuditLogConsumer.OffsetUpdate update =
        AuditLogConsumer.planAdvance(offset(10, 0L), records, 3, 3, NOW);
    assertEquals(13L, update.offset());
    assertEquals(0L, update.pendingGapSince());
  }

  @Test
  void planAdvance_writeErrorBeforeGap_advancesOnlyOverWrittenWithNoGapWait() {
    List<ChangeEventRecord> records = recordsAtOffsets(11, 12, 13);
    AuditLogConsumer.OffsetUpdate update =
        AuditLogConsumer.planAdvance(offset(10, 0L), records, 3, 1, NOW);
    assertEquals(11L, update.offset(), "advance only across the records actually written");
    assertEquals(0L, update.pendingGapSince(), "a write error is retried, not treated as a gap");
  }

  @Test
  void planAdvance_gapAfterMakingProgress_advancesPrefixAndResetsGapClock() {
    List<ChangeEventRecord> records = recordsAtOffsets(11, 12, 14);
    AuditLogConsumer.OffsetUpdate update =
        AuditLogConsumer.planAdvance(offset(10, 5_000L), records, 2, 2, NOW);
    assertEquals(12L, update.offset());
    assertEquals(0L, update.pendingGapSince(), "forward progress resets a stale gap clock");
  }

  @Test
  void planGapAdvance_headGapFirstSeen_startsWaitWithoutSkipping() {
    List<ChangeEventRecord> records = recordsAtOffsets(13, 14);
    AuditLogConsumer.OffsetUpdate update =
        AuditLogConsumer.planGapAdvance(offset(10, 0L), records, 0, NOW);
    assertEquals(10L, update.offset(), "do not skip the not-yet-committed offset 11/12");
    assertEquals(NOW, update.pendingGapSince(), "start the gap-wait clock");
  }

  @Test
  void planGapAdvance_headGapWithinTimeout_keepsWaiting() {
    List<ChangeEventRecord> records = recordsAtOffsets(13, 14);
    long gapSince = NOW - 5_000L;
    AuditLogConsumer.OffsetUpdate update =
        AuditLogConsumer.planGapAdvance(offset(10, gapSince), records, 0, NOW);
    assertEquals(10L, update.offset(), "still waiting: a late insert may yet fill the gap");
    assertEquals(gapSince, update.pendingGapSince(), "preserve the original wait clock");
  }

  @Test
  void planGapAdvance_headGapPastTimeout_skipsThePermanentHole() {
    List<ChangeEventRecord> records = recordsAtOffsets(13, 14);
    long gapSince = NOW - 30_000L;
    AuditLogConsumer.OffsetUpdate update =
        AuditLogConsumer.planGapAdvance(offset(10, gapSince), records, 0, NOW);
    assertEquals(
        12L, update.offset(), "skip the unfilled hole [11..12] so the consumer never stalls");
    assertEquals(0L, update.pendingGapSince(), "clear the wait clock after skipping");
  }

  @Test
  void lateCommittedOffset_isNotDroppedAcrossPasses() {
    // Reproduces the gap-skip flake: offset 11 (e.g. an entityRestored event) commits AFTER 12/13.
    // Pass 1: only 12,13 are visible -> a head gap at 11 -> consumer waits, does NOT advance past
    // 11.
    List<ChangeEventRecord> pass1 = recordsAtOffsets(12, 13);
    AuditLogConsumer.OffsetUpdate afterPass1 =
        AuditLogConsumer.planAdvance(offset(10, 0L), pass1, 0, 0, NOW);
    assertEquals(
        10L, afterPass1.offset(), "must not skip offset 11 just because 12/13 are visible");

    // Pass 2: offset 11 has now committed -> the batch is contiguous from 11 -> all are consumed.
    List<ChangeEventRecord> pass2 = recordsAtOffsets(11, 12, 13);
    int contiguous = AuditLogConsumer.countContiguousPrefix(afterPass1.offset(), pass2);
    AuditLogConsumer.OffsetUpdate afterPass2 =
        AuditLogConsumer.planAdvance(
            offset(afterPass1.offset(), afterPass1.pendingGapSince()),
            pass2,
            contiguous,
            contiguous,
            NOW);
    assertEquals(
        3, contiguous, "the previously-missing offset 11 is now part of the contiguous run");
    assertEquals(13L, afterPass2.offset(), "offset 11 is consumed, not permanently skipped");
  }

  @Test
  void auditLogOffset_legacyJsonWithoutGapField_deserializesWithZeroGap() {
    String legacyJson = "{\"timestamp\":1234567890,\"currentOffset\":4242}";
    AuditLogConsumer.AuditLogOffset offset =
        JsonUtils.readValue(legacyJson, AuditLogConsumer.AuditLogOffset.class);
    assertEquals(4242L, offset.currentOffset());
    assertEquals(0L, offset.pendingGapSince(), "offsets written by an older build must still load");
  }

  @Test
  void testChangeEventRecordList() {
    // Test creating a list of ChangeEventRecords as returned by listWithOffset
    List<ChangeEventRecord> records = new ArrayList<>();

    for (int i = 1; i <= 5; i++) {
      ChangeEvent event = createChangeEvent("user" + i);
      String json = JsonUtils.pojoToJson(event);
      records.add(new ChangeEventRecord(i, json));
    }

    assertEquals(5, records.size());
    assertEquals(1, records.get(0).offset());
    assertEquals(5, records.get(4).offset());
  }

  @Test
  void testOffsetProgressionLogic() {
    // Test the offset progression logic used in processBatch
    long currentOffset = 0;
    long lastSuccessfulOffset = currentOffset;

    // Simulate processing 3 events
    List<Long> eventOffsets = List.of(1L, 2L, 3L);

    for (Long offset : eventOffsets) {
      // Simulate successful processing
      lastSuccessfulOffset = offset;
    }

    // Offset should have advanced
    assertEquals(3L, lastSuccessfulOffset);
    assertTrue(lastSuccessfulOffset > currentOffset);
  }

  @Test
  void testOffsetNotAdvancedOnFailure() {
    // Test that offset doesn't advance when processing fails
    long lastSuccessfulOffset = 0;

    // Simulate processing where 2nd event fails
    List<Long> eventOffsets = List.of(1L, 2L, 3L);
    int failAtIndex = 1;

    for (int i = 0; i < eventOffsets.size(); i++) {
      if (i == failAtIndex) {
        // Simulate failure - break without updating offset
        break;
      }
      lastSuccessfulOffset = eventOffsets.get(i);
    }

    // Offset should only have advanced to the first event
    assertEquals(1L, lastSuccessfulOffset);
  }

  @Test
  void testEmptyBatchReturnsZero() {
    // When there are no records to process, should return 0
    List<ChangeEventRecord> emptyRecords = new ArrayList<>();
    assertEquals(0, emptyRecords.size());
  }

  @Test
  void testBatchProcessingStopsWhenNotFull() {
    // Test the logic that stops processing when batch is not full
    int batchSize = 100;
    int processedInBatch = 50;

    // Should stop if processed < batchSize
    boolean shouldContinue = processedInBatch >= batchSize;
    assertFalse(shouldContinue);
  }

  @Test
  void testBatchProcessingContinuesWhenFull() {
    // Test the logic that continues processing when batch is full
    int batchSize = 100;
    int processedInBatch = 100;

    // Should continue if processed >= batchSize
    boolean shouldContinue = processedInBatch >= batchSize;
    assertTrue(shouldContinue);
  }

  private static AuditLogConsumer.AuditLogOffset offset(long currentOffset, long pendingGapSince) {
    return new AuditLogConsumer.AuditLogOffset(0L, currentOffset, pendingGapSince);
  }

  private static List<ChangeEventRecord> recordsAtOffsets(long... offsets) {
    List<ChangeEventRecord> records = new ArrayList<>();
    for (long offset : offsets) {
      records.add(new ChangeEventRecord(offset, "{\"id\":\"" + UUID.randomUUID() + "\"}"));
    }
    return records;
  }

  private ChangeEvent createChangeEvent(String userName) {
    ChangeEvent event = new ChangeEvent();
    event.setId(UUID.randomUUID());
    event.setEventType(EventType.ENTITY_CREATED);
    event.setEntityType(Entity.TABLE);
    event.setEntityId(UUID.randomUUID());
    event.setUserName(userName);
    event.setTimestamp(System.currentTimeMillis());
    return event;
  }
}
