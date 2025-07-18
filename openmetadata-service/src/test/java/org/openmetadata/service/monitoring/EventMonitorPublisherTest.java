/*
 *  Copyright 2022 Collate
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

package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.events.EventResource.EventList;

@ExtendWith(MockitoExtension.class)
class EventMonitorPublisherTest {

  @Mock private EventMonitorConfiguration config;
  @Mock private EventMonitor eventMonitor;

  private EventMonitorPublisher eventMonitorPublisher;
  private static final int BATCH_SIZE = 10;

  @BeforeEach
  void setUp() {
    when(config.getBatchSize()).thenReturn(BATCH_SIZE);
    eventMonitorPublisher = new EventMonitorPublisher(config, eventMonitor);
  }

  @Test
  void testConstructor() {
    assertNotNull(eventMonitorPublisher);
    verify(config).getBatchSize();
  }

  @Test
  void testPublishWithIngestionPipelineEvent() {
    ChangeEvent ingestionEvent = createMockChangeEvent(Entity.INGESTION_PIPELINE);
    ChangeEvent otherEvent = createMockChangeEvent("table");

    List<ChangeEvent> events = Arrays.asList(ingestionEvent, otherEvent);
    EventList eventList = new EventList(events, null, null, events.size());

    eventMonitorPublisher.publish(eventList);

    verify(eventMonitor, times(1)).pushMetric(ingestionEvent);
    verify(eventMonitor, never()).pushMetric(otherEvent);
  }

  @Test
  void testPublishWithNoIngestionPipelineEvents() {
    ChangeEvent tableEvent = createMockChangeEvent("table");
    ChangeEvent databaseEvent = createMockChangeEvent("database");

    List<ChangeEvent> events = Arrays.asList(tableEvent, databaseEvent);
    EventList eventList = new EventList(events, null, null, events.size());

    eventMonitorPublisher.publish(eventList);

    verify(eventMonitor, never()).pushMetric(any());
  }

  @Test
  void testPublishWithEmptyEventList() {
    EventList eventList = new EventList(Arrays.asList(), null, null, 0);

    eventMonitorPublisher.publish(eventList);

    verify(eventMonitor, never()).pushMetric(any());
  }

  @Test
  void testPublishWithMultipleIngestionPipelineEvents() {
    ChangeEvent ingestionEvent1 = createMockChangeEvent(Entity.INGESTION_PIPELINE);
    ChangeEvent ingestionEvent2 = createMockChangeEvent(Entity.INGESTION_PIPELINE);
    ChangeEvent ingestionEvent3 = createMockChangeEvent(Entity.INGESTION_PIPELINE);

    List<ChangeEvent> events = Arrays.asList(ingestionEvent1, ingestionEvent2, ingestionEvent3);
    EventList eventList = new EventList(events, null, null, events.size());

    eventMonitorPublisher.publish(eventList);

    verify(eventMonitor, times(3)).pushMetric(any(ChangeEvent.class));
    verify(eventMonitor).pushMetric(ingestionEvent1);
    verify(eventMonitor).pushMetric(ingestionEvent2);
    verify(eventMonitor).pushMetric(ingestionEvent3);
  }

  @Test
  void testPublishWithMixedEventTypes() {
    ChangeEvent ingestionEvent1 = createMockChangeEvent(Entity.INGESTION_PIPELINE);
    ChangeEvent tableEvent = createMockChangeEvent("table");
    ChangeEvent ingestionEvent2 = createMockChangeEvent(Entity.INGESTION_PIPELINE);
    ChangeEvent databaseEvent = createMockChangeEvent("database");

    List<ChangeEvent> events =
        Arrays.asList(ingestionEvent1, tableEvent, ingestionEvent2, databaseEvent);
    EventList eventList = new EventList(events, null, null, events.size());

    eventMonitorPublisher.publish(eventList);

    verify(eventMonitor, times(2)).pushMetric(any(ChangeEvent.class));
    verify(eventMonitor).pushMetric(ingestionEvent1);
    verify(eventMonitor).pushMetric(ingestionEvent2);
    verify(eventMonitor, never()).pushMetric(tableEvent);
    verify(eventMonitor, never()).pushMetric(databaseEvent);
  }

  @Test
  void testOnStart() {
    assertDoesNotThrow(() -> eventMonitorPublisher.onStart());
  }

  @Test
  void testOnShutdown() {
    eventMonitorPublisher.onShutdown();

    verify(eventMonitor).close();
  }

  @Test
  void testPublishWithNullEventList() {
    assertThrows(
        NullPointerException.class,
        () -> {
          eventMonitorPublisher.publish(null);
        });
  }

  @Test
  void testPublishWithNullEventListData() {
    EventList eventList = new EventList(null, null, null, 0);

    assertThrows(
        NullPointerException.class,
        () -> {
          eventMonitorPublisher.publish(eventList);
        });
  }

  @Test
  void testPublishWithEventMonitorException() {
    ChangeEvent ingestionEvent = createMockChangeEvent(Entity.INGESTION_PIPELINE);
    List<ChangeEvent> events = Arrays.asList(ingestionEvent);
    EventList eventList = new EventList(events, null, null, events.size());

    doThrow(new RuntimeException("Test exception")).when(eventMonitor).pushMetric(any());

    assertThrows(
        RuntimeException.class,
        () -> {
          eventMonitorPublisher.publish(eventList);
        });
  }

  @Test
  void testEventTypeFiltering() {
    String[] nonIngestionTypes = {"table", "database", "topic", "dashboard", "pipeline"};

    for (String entityType : nonIngestionTypes) {
      ChangeEvent event = createMockChangeEvent(entityType);
      List<ChangeEvent> events = Arrays.asList(event);
      EventList eventList = new EventList(events, null, null, events.size());

      eventMonitorPublisher.publish(eventList);
    }

    verify(eventMonitor, never()).pushMetric(any());
  }

  private ChangeEvent createMockChangeEvent(String entityType) {
    ChangeEvent event = mock(ChangeEvent.class);
    lenient().when(event.getEntityType()).thenReturn(entityType);
    lenient().when(event.getId()).thenReturn(UUID.randomUUID());
    return event;
  }
}
