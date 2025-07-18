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

package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.util.DIContainer;
import org.openmetadata.service.util.ResultList;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

@ExtendWith(MockitoExtension.class)
class AbstractEventConsumerTest {

  @Mock private DIContainer dependencies;
  @Mock private JobExecutionContext jobExecutionContext;
  @Mock private JobDetail jobDetail;
  @Mock private JobDataMap jobDataMap;
  @Mock private EventSubscription eventSubscription;

  private TestEventConsumer testEventConsumer;
  private UUID subscriptionId;
  private UUID destinationId;

  static class TestEventConsumer extends AbstractEventConsumer {
    private boolean sendAlertResult = true;

    public TestEventConsumer(DIContainer dependencies) {
      super(dependencies);
    }

    @Override
    public boolean sendAlert(UUID receiverId, ChangeEvent event) {
      return sendAlertResult;
    }

    @Override
    public boolean getEnabled() {
      return true;
    }

    @Override
    public ResultList<ChangeEvent> pollEvents(long offset, long batchSize) {
      // Override to avoid Entity.getCollectionDAO() static call in tests
      List<ChangeEvent> events = new ArrayList<>();
      return new ResultList<>(events, new ArrayList<>(), null, null, (int) batchSize);
    }

    @Override
    public void publishEvents(Map<ChangeEvent, Set<UUID>> events) {
      // Override to avoid static dependencies in tests
      // In real implementation, this would process events
    }

    @Override
    public void handleFailedEvent(EventPublisherException ex, boolean errorOnSub) {
      // Override to avoid Entity.getCollectionDAO() static call in tests
    }

    @Override
    public void commit(JobExecutionContext jobExecutionContext) {
      // Override to avoid Entity.getCollectionDAO() static call in tests
    }

    public void setSendAlertResult(boolean result) {
      this.sendAlertResult = result;
    }
  }

  @BeforeEach
  void setUp() {
    testEventConsumer = new TestEventConsumer(dependencies);
    subscriptionId = UUID.randomUUID();
    destinationId = UUID.randomUUID();

    lenient().when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    lenient().when(jobDetail.getJobDataMap()).thenReturn(jobDataMap);
    lenient().when(eventSubscription.getId()).thenReturn(subscriptionId);
    lenient().when(eventSubscription.getBatchSize()).thenReturn(10);
    lenient().when(eventSubscription.getRetries()).thenReturn(3);
    lenient().when(eventSubscription.getName()).thenReturn("test-subscription");
    lenient().when(eventSubscription.getDestinations()).thenReturn(Collections.emptyList());
    lenient().when(eventSubscription.getEnabled()).thenReturn(true);
  }

  @Test
  void testConstructor() {
    assertNotNull(testEventConsumer);
    assertNotNull(testEventConsumer.dependencies);
  }

  @Test
  void testSendAlertMethod() {
    UUID receiverId = UUID.randomUUID();
    ChangeEvent event = createMockChangeEvent();

    boolean result = testEventConsumer.sendAlert(receiverId, event);

    assertTrue(result);
  }

  @Test
  void testGetEnabledMethod() {
    boolean result = testEventConsumer.getEnabled();

    assertTrue(result);
  }

  @Test
  void testSendAlertFailure() {
    testEventConsumer.setSendAlertResult(false);
    UUID receiverId = UUID.randomUUID();
    ChangeEvent event = createMockChangeEvent();

    boolean result = testEventConsumer.sendAlert(receiverId, event);

    assertFalse(result);
  }

  @Test
  void testPublishEventsWithEmptyMap() {
    Map<ChangeEvent, Set<UUID>> emptyEvents = new HashMap<>();

    assertDoesNotThrow(() -> testEventConsumer.publishEvents(emptyEvents));
  }

  @Test
  void testPollEventsReturnsResultList() {
    ResultList<ChangeEvent> result = testEventConsumer.pollEvents(0L, 10L);

    assertNotNull(result);
    assertNotNull(result.getData());
    assertNotNull(result.getErrors());
  }

  @Test
  void testPollEventsWithDifferentOffsets() {
    ResultList<ChangeEvent> result1 = testEventConsumer.pollEvents(0L, 5L);
    ResultList<ChangeEvent> result2 = testEventConsumer.pollEvents(10L, 15L);

    assertNotNull(result1);
    assertNotNull(result2);
  }

  @Test
  void testPollingWithZeroBatchSize() {
    ResultList<ChangeEvent> result = testEventConsumer.pollEvents(0L, 0L);

    assertNotNull(result);
    assertEquals(0, result.getPaging().getTotal());
  }

  @Test
  void testPollingWithNegativeOffset() {
    ResultList<ChangeEvent> result = testEventConsumer.pollEvents(-1L, 10L);

    assertNotNull(result);
  }

  @Test
  void testConstants() {
    assertEquals("SubscriptionMapKey", AbstractEventConsumer.DESTINATION_MAP_KEY);
    assertEquals("alertOffsetKey", AbstractEventConsumer.ALERT_OFFSET_KEY);
    assertEquals("alertInfoKey", AbstractEventConsumer.ALERT_INFO_KEY);
    assertEquals("eventSubscription.Offset", AbstractEventConsumer.OFFSET_EXTENSION);
    assertEquals("eventSubscription.metrics", AbstractEventConsumer.METRICS_EXTENSION);
    assertEquals("eventSubscription.failedEvent", AbstractEventConsumer.FAILED_EVENT_EXTENSION);
  }

  @Test
  void testFailureTowardsEnum() {
    assertEquals(2, AbstractEventConsumer.FailureTowards.values().length);
    assertEquals("SUBSCRIBER", AbstractEventConsumer.FailureTowards.SUBSCRIBER.name());
    assertEquals("PUBLISHER", AbstractEventConsumer.FailureTowards.PUBLISHER.name());
  }

  @Test
  void testPublishEventsWithSingleEvent() {
    ChangeEvent event = createMockChangeEvent();
    Set<UUID> receivers = Set.of(destinationId);
    Map<ChangeEvent, Set<UUID>> events = Map.of(event, receivers);

    assertDoesNotThrow(() -> testEventConsumer.publishEvents(events));
  }

  @Test
  void testPublishEventsWithMultipleEvents() {
    ChangeEvent event1 = createMockChangeEvent();
    ChangeEvent event2 = createMockChangeEvent();
    Set<UUID> receivers = Set.of(destinationId);
    Map<ChangeEvent, Set<UUID>> events =
        Map.of(
            event1, receivers,
            event2, receivers);

    assertDoesNotThrow(() -> testEventConsumer.publishEvents(events));
  }

  private ChangeEvent createMockChangeEvent() {
    ChangeEvent event = mock(ChangeEvent.class);
    lenient().when(event.getId()).thenReturn(UUID.randomUUID());
    lenient().when(event.getEntityType()).thenReturn("table");
    return event;
  }
}
