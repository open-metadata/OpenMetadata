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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

/** Unit tests for AuditLogRepository actor type detection and record building logic. */
@Execution(ExecutionMode.CONCURRENT)
class AuditLogRepositoryTest {

  private CollectionDAO.AuditLogDAO mockAuditLogDAO;
  private AuditLogRepository repository;

  @BeforeEach
  void setUp() {
    CollectionDAO mockCollectionDAO = mock(CollectionDAO.class);
    mockAuditLogDAO = mock(CollectionDAO.AuditLogDAO.class);
    org.mockito.Mockito.when(mockCollectionDAO.auditLogDAO()).thenReturn(mockAuditLogDAO);
    repository = new AuditLogRepository(mockCollectionDAO);
  }

  @Test
  void testDetermineActorType_regularUser() {
    ChangeEvent event = createChangeEvent("john.doe@example.com");
    repository.write(event);

    verify(mockAuditLogDAO).insert(any(AuditLogRecord.class));
  }

  @Test
  void testDetermineActorType_botUser() {
    ChangeEvent event = createChangeEvent("ingestion-bot");
    repository.write(event);

    verify(mockAuditLogDAO).insert(any(AuditLogRecord.class));
  }

  @Test
  void testDetermineActorType_agentUser() {
    ChangeEvent event = createChangeEvent("documentation-agent");
    repository.write(event);

    verify(mockAuditLogDAO).insert(any(AuditLogRecord.class));
  }

  @Test
  void testDetermineActorType_automatorAgent() {
    ChangeEvent event = createChangeEvent("auto-classification");
    repository.write(event);

    verify(mockAuditLogDAO).insert(any(AuditLogRecord.class));
  }

  @Test
  void testSkipUnsupportedEventType() {
    ChangeEvent event = createChangeEvent("admin", EventType.THREAD_CREATED);
    repository.write(event);

    verify(mockAuditLogDAO, never()).insert(any(AuditLogRecord.class));
  }

  @Test
  void testSkipNullEventId() {
    ChangeEvent event = new ChangeEvent();
    event.setId(null);
    event.setEventType(EventType.ENTITY_CREATED);
    event.setEntityType(Entity.TABLE);
    event.setUserName("admin");

    repository.write(event);

    verify(mockAuditLogDAO, never()).insert(any(AuditLogRecord.class));
  }

  @Test
  void testSupportedEventTypes() {
    // ENTITY_CREATED should be written
    ChangeEvent created = createChangeEvent("admin", EventType.ENTITY_CREATED);
    repository.write(created);
    verify(mockAuditLogDAO).insert(any(AuditLogRecord.class));
  }

  @Test
  void testExtractServiceName_validFqn() {
    ChangeEvent event = createChangeEvent("admin");
    event.setEntityFullyQualifiedName("mysql_prod.database.schema.table");
    repository.write(event);

    verify(mockAuditLogDAO).insert(any(AuditLogRecord.class));
  }

  @Test
  void testExtractServiceName_nullFqn() {
    ChangeEvent event = createChangeEvent("admin");
    event.setEntityFullyQualifiedName(null);
    repository.write(event);

    verify(mockAuditLogDAO).insert(any(AuditLogRecord.class));
  }

  @Test
  void testActorTypeEnum_values() {
    assertEquals("USER", AuditLogRecord.ActorType.USER.name());
    assertEquals("BOT", AuditLogRecord.ActorType.BOT.name());
    assertEquals("AGENT", AuditLogRecord.ActorType.AGENT.name());
  }

  @Test
  void testAuditLogRecordBuilder() {
    AuditLogRecord record =
        AuditLogRecord.builder()
            .changeEventId(UUID.randomUUID().toString())
            .eventTs(System.currentTimeMillis())
            .eventType("entityCreated")
            .userName("admin")
            .actorType("USER")
            .entityType(Entity.TABLE)
            .entityId(UUID.randomUUID().toString())
            .entityFQN("mysql.db.schema.table")
            .createdAt(System.currentTimeMillis())
            .build();

    assertNotNull(record.getChangeEventId());
    assertEquals("entityCreated", record.getEventType());
    assertEquals("admin", record.getUserName());
    assertEquals("USER", record.getActorType());
  }

  @Test
  void testAuditLogEntry_builder() {
    UUID id = UUID.randomUUID();
    UUID entityId = UUID.randomUUID();
    long now = System.currentTimeMillis();

    AuditLogEntry entry =
        AuditLogEntry.builder()
            .id(1L)
            .changeEventId(id)
            .eventTs(now)
            .eventType("entityCreated")
            .userName("admin")
            .actorType("USER")
            .entityType(Entity.TABLE)
            .entityId(entityId)
            .entityFQN("mysql.db.schema.table")
            .createdAt(now)
            .build();

    assertEquals(1L, entry.getId());
    assertEquals(id, entry.getChangeEventId());
    assertEquals("entityCreated", entry.getEventType());
    assertEquals("admin", entry.getUserName());
    assertEquals("USER", entry.getActorType());
    assertEquals(entityId, entry.getEntityId());
    assertNull(entry.getChangeEvent());
  }

  private ChangeEvent createChangeEvent(String userName) {
    return createChangeEvent(userName, EventType.ENTITY_CREATED);
  }

  private ChangeEvent createChangeEvent(String userName, EventType eventType) {
    ChangeEvent event = new ChangeEvent();
    event.setId(UUID.randomUUID());
    event.setEventType(eventType);
    event.setEntityType(Entity.TABLE);
    event.setEntityId(UUID.randomUUID());
    event.setUserName(userName);
    event.setTimestamp(System.currentTimeMillis());
    return event;
  }
}
