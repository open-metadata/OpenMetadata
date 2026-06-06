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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.jdbi3.CollectionDAO;

class AuditLogRepositoryTest {

  @Test
  void writePersistsLineageChangeEvents() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.AuditLogDAO auditLogDAO = mock(CollectionDAO.AuditLogDAO.class);
    when(collectionDAO.auditLogDAO()).thenReturn(auditLogDAO);

    AuditLogRepository repository = new AuditLogRepository(collectionDAO);
    String lineageFqn = "service.db.schema.source--upstream-->service.db.schema.target";
    for (EventType eventType :
        List.of(
            EventType.ENTITY_LINEAGE_ADDED,
            EventType.ENTITY_LINEAGE_UPDATED,
            EventType.ENTITY_LINEAGE_DELETED)) {
      repository.write(
          new ChangeEvent()
              .withId(UUID.randomUUID())
              .withEventType(eventType)
              .withEntityType("lineage")
              .withEntityId(UUID.randomUUID())
              .withEntityFullyQualifiedName(lineageFqn)
              .withTimestamp(System.currentTimeMillis()));
    }

    ArgumentCaptor<AuditLogRecord> recordCaptor = ArgumentCaptor.forClass(AuditLogRecord.class);
    verify(auditLogDAO, times(3)).insert(recordCaptor.capture());
    assertEquals(
        List.of("entityLineageAdded", "entityLineageUpdated", "entityLineageDeleted"),
        recordCaptor.getAllValues().stream().map(AuditLogRecord::getEventType).toList());
    recordCaptor
        .getAllValues()
        .forEach(
            record -> {
              assertEquals("lineage", record.getEntityType());
              assertEquals(lineageFqn, record.getEntityFQN());
            });
  }
}
