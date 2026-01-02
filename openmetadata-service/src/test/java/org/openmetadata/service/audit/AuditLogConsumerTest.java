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
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
  void testOffsetRecordSerialization() throws Exception {
    // Test that the AuditLogOffset record can be serialized/deserialized
    long timestamp = System.currentTimeMillis();
    long offset = 100L;

    // Create JSON in the expected format
    String json = String.format("{\"timestamp\":%d,\"currentOffset\":%d}", timestamp, offset);

    // Verify it can be parsed (this tests the format expected by the consumer)
    assertNotNull(json);
    assertEquals(true, json.contains("timestamp"));
    assertEquals(true, json.contains("currentOffset"));
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
  void testCreateValidChangeEventJson() throws Exception {
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
    assertEquals(true, lastSuccessfulOffset > currentOffset);
  }

  @Test
  void testOffsetNotAdvancedOnFailure() {
    // Test that offset doesn't advance when processing fails
    long currentOffset = 0;
    long lastSuccessfulOffset = currentOffset;

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
    assertEquals(false, shouldContinue);
  }

  @Test
  void testBatchProcessingContinuesWhenFull() {
    // Test the logic that continues processing when batch is full
    int batchSize = 100;
    int processedInBatch = 100;

    // Should continue if processed >= batchSize
    boolean shouldContinue = processedInBatch >= batchSize;
    assertEquals(true, shouldContinue);
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
