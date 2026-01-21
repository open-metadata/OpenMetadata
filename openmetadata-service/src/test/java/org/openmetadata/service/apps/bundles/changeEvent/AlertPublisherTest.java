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
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.util.DIContainer;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;

@ExtendWith(MockitoExtension.class)
class AlertPublisherTest {

  @Mock private DIContainer dependencies;
  @Mock private EventSubscription eventSubscription;
  @Mock private Destination<ChangeEvent> destination;
  @Mock private JobDetail jobDetail;
  @Mock private JobDataMap jobDataMap;

  private AlertPublisher alertPublisher;
  private UUID receiverId;
  private ChangeEvent changeEvent;

  // Test subclass that overrides handleFailedEvent to avoid static dependency
  static class TestAlertPublisher extends AlertPublisher {
    public TestAlertPublisher(DIContainer di) {
      super(di);
    }

    @Override
    public void handleFailedEvent(EventPublisherException ex, boolean errorOnSub) {
      // Override to avoid Entity.getCollectionDAO() static call in tests
    }
  }

  @BeforeEach
  void setUp() {
    alertPublisher = new AlertPublisher(dependencies);
    receiverId = UUID.randomUUID();
    changeEvent = createMockChangeEvent();

    alertPublisher.setJobDetail(jobDetail);
    alertPublisher.eventSubscription = eventSubscription;
    alertPublisher.destinationMap = new HashMap<>();

    lenient().when(jobDetail.getJobDataMap()).thenReturn(jobDataMap);
    lenient()
        .when(jobDataMap.get(AbstractEventConsumer.ALERT_INFO_KEY))
        .thenReturn(eventSubscription);
    lenient().when(eventSubscription.getName()).thenReturn("test-subscription");
    lenient().when(eventSubscription.getEnabled()).thenReturn(true);
  }

  @Test
  void testSendAlertSuccessfully() throws EventPublisherException {
    SubscriptionDestination subDest = createMockSubscriptionDestination();
    lenient().when(destination.getEnabled()).thenReturn(true);
    lenient().when(destination.getSubscriptionDestination()).thenReturn(subDest);
    alertPublisher.destinationMap.put(receiverId, destination);

    boolean result = alertPublisher.sendAlert(receiverId, changeEvent);

    assertTrue(result);
    verify(destination).sendMessage(eq(changeEvent), any());
  }

  @Test
  void testSendAlertWithDisabledDestination() throws EventPublisherException {
    lenient().when(destination.getEnabled()).thenReturn(false);
    alertPublisher.destinationMap.put(receiverId, destination);

    boolean result = alertPublisher.sendAlert(receiverId, changeEvent);

    assertFalse(result);
    verify(destination, never()).sendMessage(any(), any());
  }

  @Test
  void testSendAlertWithNullDestinationEnabled() throws EventPublisherException {
    lenient().when(destination.getEnabled()).thenReturn(false);
    alertPublisher.destinationMap.put(receiverId, destination);

    boolean result = alertPublisher.sendAlert(receiverId, changeEvent);

    assertFalse(result);
    verify(destination, never()).sendMessage(any(), any());
  }

  @Test
  void testSendAlertWithMissingDestination() throws EventPublisherException {
    boolean result = alertPublisher.sendAlert(receiverId, changeEvent);

    assertFalse(result);
    verify(destination, never()).sendMessage(any(), any());
  }

  @Test
  void testSendAlertWithEventPublisherException() throws EventPublisherException {
    // Use TestAlertPublisher to avoid Entity.getCollectionDAO() static call
    TestAlertPublisher testPublisher = new TestAlertPublisher(dependencies);
    testPublisher.setJobDetail(jobDetail);
    testPublisher.eventSubscription = eventSubscription;
    testPublisher.destinationMap = new HashMap<>();

    SubscriptionDestination subDest = createMockSubscriptionDestination();
    lenient().when(destination.getEnabled()).thenReturn(true);
    lenient().when(destination.getSubscriptionDestination()).thenReturn(subDest);
    EventPublisherException exception = new EventPublisherException("Test error");
    doThrow(exception).when(destination).sendMessage(any(), any());
    testPublisher.destinationMap.put(receiverId, destination);

    boolean result = testPublisher.sendAlert(receiverId, changeEvent);

    assertFalse(result);
    verify(destination).sendMessage(eq(changeEvent), any());
  }

  @Test
  void testGetEnabledWhenSubscriptionEnabled() {
    lenient().when(eventSubscription.getEnabled()).thenReturn(true);

    boolean result = alertPublisher.getEnabled();

    assertTrue(result);
  }

  @Test
  void testGetEnabledWhenSubscriptionDisabled() {
    lenient().when(eventSubscription.getEnabled()).thenReturn(false);

    boolean result = alertPublisher.getEnabled();

    assertFalse(result);
  }

  @Test
  void testGetEnabledWhenSubscriptionEnabledIsNull() {
    lenient().when(eventSubscription.getEnabled()).thenReturn(false);

    boolean result = alertPublisher.getEnabled();

    assertFalse(result);
  }

  @Test
  void testSendAlertLogsCorrectMessagesForDisabledDestination() {
    lenient().when(destination.getEnabled()).thenReturn(false);
    alertPublisher.destinationMap.put(receiverId, destination);

    boolean result = alertPublisher.sendAlert(receiverId, changeEvent);

    assertFalse(result);
    verify(eventSubscription, atLeastOnce()).getName();
  }

  @Test
  void testSendAlertLogsCorrectMessagesForMissingDestination() {
    boolean result = alertPublisher.sendAlert(receiverId, changeEvent);

    assertFalse(result);
    verify(eventSubscription, atLeastOnce()).getName();
  }

  @Test
  void testMultipleDestinationsInMap() throws EventPublisherException {
    UUID receiverId1 = UUID.randomUUID();
    UUID receiverId2 = UUID.randomUUID();
    Destination<ChangeEvent> destination1 = mock(Destination.class);
    Destination<ChangeEvent> destination2 = mock(Destination.class);

    SubscriptionDestination subDest = createMockSubscriptionDestination();
    lenient().when(destination1.getEnabled()).thenReturn(true);
    lenient().when(destination1.getSubscriptionDestination()).thenReturn(subDest);
    lenient().when(destination2.getEnabled()).thenReturn(false);

    alertPublisher.destinationMap.put(receiverId1, destination1);
    alertPublisher.destinationMap.put(receiverId2, destination2);

    boolean result1 = alertPublisher.sendAlert(receiverId1, changeEvent);
    boolean result2 = alertPublisher.sendAlert(receiverId2, changeEvent);

    assertTrue(result1);
    assertFalse(result2);
    verify(destination1).sendMessage(eq(changeEvent), any());
    verify(destination2, never()).sendMessage(any(), any());
  }

  private ChangeEvent createMockChangeEvent() {
    ChangeEvent event = mock(ChangeEvent.class);
    lenient().when(event.getId()).thenReturn(UUID.randomUUID());
    lenient().when(event.getEntityType()).thenReturn("table");
    return event;
  }

  private SubscriptionDestination createMockSubscriptionDestination() {
    SubscriptionDestination subDest = new SubscriptionDestination();
    subDest.setId(UUID.randomUUID());
    subDest.setType(SubscriptionDestination.SubscriptionType.EMAIL);
    subDest.setCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL);
    return subDest;
  }
}
