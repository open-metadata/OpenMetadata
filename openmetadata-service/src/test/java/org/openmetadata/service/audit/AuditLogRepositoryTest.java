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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.slf4j.LoggerFactory;
import org.slf4j.Marker;

/**
 * Verifies that {@link AuditLogRepository#write(ChangeEvent)} re-emits each persisted audit entry
 * through the AUDIT-marked logger so the dedicated {@code audit.log} appender is fed, that the file
 * emission is gated on an actual DB insert (so the publisher + consumer dual-write path and
 * multi-server replays do not produce duplicate lines).
 */
class AuditLogRepositoryTest {

  private static final String AUDIT_MARKER_NAME = "AUDIT";
  private static final String BOT_USER = "ingestion-bot";

  private CollectionDAO.AuditLogDAO auditLogDAO;
  private AuditLogRepository repository;
  private Logger auditLogger;
  private ListAppender<ILoggingEvent> appender;

  @BeforeEach
  void setUp() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    auditLogDAO = mock(CollectionDAO.AuditLogDAO.class);
    when(collectionDAO.auditLogDAO()).thenReturn(auditLogDAO);
    repository = new AuditLogRepository(collectionDAO);

    auditLogger = (Logger) LoggerFactory.getLogger(AuditLogRepository.class);
    appender = new ListAppender<>();
    appender.start();
    auditLogger.addAppender(appender);
  }

  @AfterEach
  void tearDown() {
    auditLogger.detachAppender(appender);
  }

  @Test
  void writeEmitsAuditMarkerWhenRowInserted() {
    when(auditLogDAO.insert(any())).thenReturn(1);

    repository.write(changeEvent());

    List<ILoggingEvent> auditEvents = auditEvents();
    assertEquals(1, auditEvents.size());
    String message = auditEvents.getFirst().getFormattedMessage();
    assertTrue(message.contains("user=" + BOT_USER), message);
    assertTrue(message.contains("eventType=" + EventType.ENTITY_CREATED.value()), message);
  }

  @Test
  void writeSkipsAuditMarkerWhenRowDeduplicated() {
    when(auditLogDAO.insert(any())).thenReturn(0);

    repository.write(changeEvent());

    assertEquals(0, auditEvents().size());
  }

  private List<ILoggingEvent> auditEvents() {
    return appender.list.stream().filter(this::hasAuditMarker).toList();
  }

  private boolean hasAuditMarker(ILoggingEvent event) {
    Marker marker = event.getMarker();
    return marker != null && AUDIT_MARKER_NAME.equals(marker.getName());
  }

  private ChangeEvent changeEvent() {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_CREATED)
        .withEntityType(Entity.TABLE)
        .withEntityId(UUID.randomUUID())
        .withUserName(BOT_USER)
        .withTimestamp(System.currentTimeMillis());
  }
}
