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
import static org.mockito.Mockito.*;

import java.lang.reflect.Field;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.notifications.recipients.RecipientResolver;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.util.DIContainer;
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
    private final List<ChangeEvent> collectedSuccessfulEvents = new ArrayList<>();
    private int batchWriteCallCount = 0;

    public TestEventConsumer(DIContainer dependencies) {
      super(dependencies);
    }

    @Override
    public boolean sendAlert(UUID receiverId, ChangeEvent event) {
      if (sendAlertResult) {
        collectedSuccessfulEvents.add(event);
      }
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
      // Simulate batch write by incrementing counter
      if (!collectedSuccessfulEvents.isEmpty()) {
        batchWriteCallCount++;
        collectedSuccessfulEvents.clear();
      }
    }

    public void setSendAlertResult(boolean result) {
      this.sendAlertResult = result;
    }

    public List<ChangeEvent> getCollectedSuccessfulEvents() {
      return collectedSuccessfulEvents;
    }

    public int getBatchWriteCallCount() {
      return batchWriteCallCount;
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

  @Test
  void testBatchCollectionOnSuccessfulSend() {
    ChangeEvent event1 = createMockChangeEvent();
    ChangeEvent event2 = createMockChangeEvent();
    ChangeEvent event3 = createMockChangeEvent();

    testEventConsumer.sendAlert(destinationId, event1);
    testEventConsumer.sendAlert(destinationId, event2);
    testEventConsumer.sendAlert(destinationId, event3);

    assertEquals(
        3,
        testEventConsumer.getCollectedSuccessfulEvents().size(),
        "All successful events should be collected");
    assertEquals(
        0, testEventConsumer.getBatchWriteCallCount(), "Batch write should not occur until commit");
  }

  @Test
  void testBatchCollectionNotOccurringOnFailedSend() {
    testEventConsumer.setSendAlertResult(false);

    ChangeEvent event1 = createMockChangeEvent();
    ChangeEvent event2 = createMockChangeEvent();

    testEventConsumer.sendAlert(destinationId, event1);
    testEventConsumer.sendAlert(destinationId, event2);

    assertTrue(
        testEventConsumer.getCollectedSuccessfulEvents().isEmpty(),
        "Failed events should not be collected");
  }

  @Test
  void testBatchWriteOccursOnCommit() {
    ChangeEvent event1 = createMockChangeEvent();
    ChangeEvent event2 = createMockChangeEvent();

    testEventConsumer.sendAlert(destinationId, event1);
    testEventConsumer.sendAlert(destinationId, event2);

    assertEquals(2, testEventConsumer.getCollectedSuccessfulEvents().size());
    assertEquals(0, testEventConsumer.getBatchWriteCallCount());

    testEventConsumer.commit(jobExecutionContext);

    assertEquals(1, testEventConsumer.getBatchWriteCallCount(), "Single batch write should occur");
    assertTrue(
        testEventConsumer.getCollectedSuccessfulEvents().isEmpty(),
        "Events should be cleared after commit");
  }

  @Test
  void testEmptyCommitDoesNotTriggerBatchWrite() {
    assertEquals(0, testEventConsumer.getCollectedSuccessfulEvents().size());

    testEventConsumer.commit(jobExecutionContext);

    assertEquals(
        0, testEventConsumer.getBatchWriteCallCount(), "No batch write for empty collection");
  }

  @Test
  void testMultipleBatchesWithSeparateCommits() {
    ChangeEvent event1 = createMockChangeEvent();
    ChangeEvent event2 = createMockChangeEvent();
    ChangeEvent event3 = createMockChangeEvent();

    testEventConsumer.sendAlert(destinationId, event1);
    testEventConsumer.sendAlert(destinationId, event2);
    testEventConsumer.commit(jobExecutionContext);

    assertEquals(1, testEventConsumer.getBatchWriteCallCount());

    testEventConsumer.sendAlert(destinationId, event3);
    testEventConsumer.commit(jobExecutionContext);

    assertEquals(
        2, testEventConsumer.getBatchWriteCallCount(), "Second batch should trigger write");
  }

  @Test
  void testMixedSuccessAndFailureResults() {
    ChangeEvent successEvent = createMockChangeEvent();
    ChangeEvent failEvent = createMockChangeEvent();

    testEventConsumer.setSendAlertResult(true);
    testEventConsumer.sendAlert(destinationId, successEvent);

    assertEquals(1, testEventConsumer.getCollectedSuccessfulEvents().size());

    testEventConsumer.setSendAlertResult(false);
    testEventConsumer.sendAlert(destinationId, failEvent);

    assertEquals(
        1,
        testEventConsumer.getCollectedSuccessfulEvents().size(),
        "Only successful events should be collected");
  }

  @Test
  void testEventRecordedOncePerSubscriptionAcrossDestinationTypes() throws Exception {
    RealPublishConsumer consumer = new RealPublishConsumer(dependencies);
    consumer.eventSubscription = eventSubscription;

    UUID webhookId = UUID.randomUUID();
    UUID emailId = UUID.randomUUID();
    Map<UUID, Destination<ChangeEvent>> destinations = new HashMap<>();
    destinations.put(webhookId, mockDestination(SubscriptionType.WEBHOOK));
    destinations.put(emailId, mockDestination(SubscriptionType.EMAIL));
    consumer.destinationMap = destinations;
    setField(
        consumer,
        "alertMetrics",
        new AlertMetrics().withTotalEvents(0).withFailedEvents(0).withSuccessEvents(0));

    ChangeEvent event = createMockChangeEvent();
    Map<ChangeEvent, Set<UUID>> events = Map.of(event, Set.of(webhookId, emailId));

    try (MockedStatic<AlertUtil> alertUtil = mockStatic(AlertUtil.class)) {
      alertUtil.when(() -> AlertUtil.getFilteredEvents(any(), any())).thenReturn(events);
      consumer.publishEvents(events);
    }

    List<?> recorded = (List<?>) getField(consumer, "successfulEvents");
    assertEquals(
        1,
        recorded.size(),
        "Event delivered to two destination types must be recorded once: "
            + "successful_sent_change_events is keyed by (change_event_id, event_subscription_id)");
    assertSame(event, recorded.getFirst());

    AlertMetrics metrics = (AlertMetrics) getField(consumer, "alertMetrics");
    assertEquals(
        2,
        metrics.getSuccessEvents(),
        "Per-destination-type success metric is intentionally preserved");
  }

  // #25312: same-type destinations get one send via the primary, recipients unioned across them.
  @Test
  @SuppressWarnings("unchecked")
  void testRecipientsUnionedAndSentOncePerSameTypeDestinations() throws Exception {
    RealPublishConsumer consumer = newRealConsumerWithMetrics();

    Destination<ChangeEvent> emailA = mockDestination(SubscriptionType.EMAIL, true);
    Destination<ChangeEvent> emailB = mockDestination(SubscriptionType.EMAIL, true);
    SubscriptionDestination subA = emailA.getSubscriptionDestination();
    SubscriptionDestination subB = emailB.getSubscriptionDestination();
    UUID idA = UUID.randomUUID();
    UUID idB = UUID.randomUUID();
    Map<UUID, Destination<ChangeEvent>> destinations = new HashMap<>();
    destinations.put(idA, emailA);
    destinations.put(idB, emailB);
    consumer.destinationMap = destinations;

    ChangeEvent event = createMockChangeEvent();
    Map<ChangeEvent, Set<UUID>> events = Map.of(event, Set.of(idA, idB));

    Recipient r1 = new EmailRecipient("a@example.com");
    Recipient r2 = new EmailRecipient("b@example.com");
    Set<Recipient> union = Set.of(r1, r2);

    List<Set<Recipient>> sent = new ArrayList<>();
    // Only the primary is sent to (Set order picks which), so record both and assert the total.
    lenient()
        .doAnswer(
            inv -> {
              sent.add(inv.getArgument(1));
              return null;
            })
        .when(emailA)
        .sendMessage(any(), any());
    lenient()
        .doAnswer(
            inv -> {
              sent.add(inv.getArgument(1));
              return null;
            })
        .when(emailB)
        .sendMessage(any(), any());

    try (MockedStatic<AlertUtil> alertUtil = mockStatic(AlertUtil.class);
        MockedConstruction<RecipientResolver> resolverCtor =
            mockConstruction(
                RecipientResolver.class,
                (mock, ctx) -> when(mock.resolveRecipients(any(), anyList())).thenReturn(union))) {
      alertUtil.when(() -> AlertUtil.getFilteredEvents(any(), any())).thenReturn(events);

      consumer.publishEvents(events);

      assertEquals(1, sent.size(), "One send per SubscriptionType, via the primary destination");
      assertEquals(union, sent.getFirst(), "Recipients unioned across same-type destinations");

      RecipientResolver resolver = resolverCtor.constructed().getFirst();
      ArgumentCaptor<List<SubscriptionDestination>> captor = ArgumentCaptor.forClass(List.class);
      verify(resolver).resolveRecipients(eq(event), captor.capture());
      assertEquals(2, captor.getValue().size());
      assertTrue(
          captor.getValue().containsAll(List.of(subA, subB)),
          "Resolver receives every same-type destination so recipients dedup across them");
    }

    assertEquals(
        1,
        ((List<?>) getField(consumer, "successfulEvents")).size(),
        "Event recorded once for the (event, subscription)");
  }

  // #25312: empty recipients (destination requires them, none resolved) is a successful no-op send.
  @Test
  void testEmptyRecipientsIsNoOpSuccessAndRecorded() throws Exception {
    RealPublishConsumer consumer = newRealConsumerWithMetrics();
    Destination<ChangeEvent> email = mockDestination(SubscriptionType.EMAIL, true);
    UUID id = UUID.randomUUID();
    consumer.destinationMap = Map.of(id, email);

    ChangeEvent event = createMockChangeEvent();
    Map<ChangeEvent, Set<UUID>> events = Map.of(event, Set.of(id));

    try (MockedStatic<AlertUtil> alertUtil = mockStatic(AlertUtil.class);
        MockedConstruction<RecipientResolver> resolverCtor =
            mockConstruction(
                RecipientResolver.class,
                (mock, ctx) ->
                    when(mock.resolveRecipients(any(), anyList())).thenReturn(Set.of()))) {
      alertUtil.when(() -> AlertUtil.getFilteredEvents(any(), any())).thenReturn(events);
      consumer.publishEvents(events);
    }

    verify(email, never()).sendMessage(any(), any());
    assertEquals(
        1,
        ((List<?>) getField(consumer, "successfulEvents")).size(),
        "Empty recipients is a no-op success and still recorded");
    assertEquals(1, ((AlertMetrics) getField(consumer, "alertMetrics")).getSuccessEvents());
  }

  // #25312: destinations that don't require recipients always send.
  @Test
  void testRequiresRecipientsFalseSendsWithoutResolving() throws Exception {
    RealPublishConsumer consumer = newRealConsumerWithMetrics();
    Destination<ChangeEvent> destination = mockDestination(SubscriptionType.WEBHOOK, false);
    UUID id = UUID.randomUUID();
    consumer.destinationMap = Map.of(id, destination);

    ChangeEvent event = createMockChangeEvent();
    Map<ChangeEvent, Set<UUID>> events = Map.of(event, Set.of(id));

    try (MockedStatic<AlertUtil> alertUtil = mockStatic(AlertUtil.class);
        MockedConstruction<RecipientResolver> resolverCtor =
            mockConstruction(RecipientResolver.class)) {
      alertUtil.when(() -> AlertUtil.getFilteredEvents(any(), any())).thenReturn(events);
      consumer.publishEvents(events);

      RecipientResolver resolver = resolverCtor.constructed().getFirst();
      verify(resolver, never()).resolveRecipients(any(), any());
    }

    verify(destination).sendMessage(eq(event), eq(Set.of()));
    assertEquals(1, ((List<?>) getField(consumer, "successfulEvents")).size());
  }

  // #28827: delivered-on-one-type/failed-on-another is recorded once; failing type still reported.
  @Test
  void testMixedDeliveryRecordsOnceAndReportsTypeFailure() throws Exception {
    RealPublishConsumer consumer = newRealConsumerWithMetrics();
    Destination<ChangeEvent> ok = mockDestination(SubscriptionType.WEBHOOK, false);
    Destination<ChangeEvent> failing = mockDestination(SubscriptionType.EMAIL, false);
    doThrow(mock(EventPublisherException.class)).when(failing).sendMessage(any(), any());

    UUID okId = UUID.randomUUID();
    UUID failId = UUID.randomUUID();
    Map<UUID, Destination<ChangeEvent>> destinations = new HashMap<>();
    destinations.put(okId, ok);
    destinations.put(failId, failing);
    consumer.destinationMap = destinations;

    ChangeEvent event = createMockChangeEvent();
    Map<ChangeEvent, Set<UUID>> events = Map.of(event, Set.of(okId, failId));

    try (MockedStatic<AlertUtil> alertUtil = mockStatic(AlertUtil.class);
        MockedConstruction<RecipientResolver> resolverCtor =
            mockConstruction(RecipientResolver.class)) {
      alertUtil.when(() -> AlertUtil.getFilteredEvents(any(), any())).thenReturn(events);
      consumer.publishEvents(events);
    }

    assertEquals(
        1,
        ((List<?>) getField(consumer, "successfulEvents")).size(),
        "Delivered to at least one type, so recorded exactly once");
    AlertMetrics metrics = (AlertMetrics) getField(consumer, "alertMetrics");
    assertEquals(1, metrics.getSuccessEvents());
    assertEquals(1, metrics.getFailedEvents());
    assertEquals(
        1, consumer.capturedFailures.size(), "handleFailedEvent invoked for the failing type");
  }

  private Destination<ChangeEvent> mockDestination(SubscriptionType type) {
    return mockDestination(type, false);
  }

  @SuppressWarnings("unchecked")
  private Destination<ChangeEvent> mockDestination(
      SubscriptionType type, boolean requiresRecipients) {
    Destination<ChangeEvent> destination = mock(Destination.class);
    SubscriptionDestination subscriptionDestination = mock(SubscriptionDestination.class);
    lenient().when(subscriptionDestination.getType()).thenReturn(type);
    lenient().when(destination.getEnabled()).thenReturn(true);
    lenient().when(destination.getSubscriptionDestination()).thenReturn(subscriptionDestination);
    lenient().when(destination.requiresRecipients()).thenReturn(requiresRecipients);
    return destination;
  }

  private RealPublishConsumer newRealConsumerWithMetrics() throws Exception {
    RealPublishConsumer consumer = new RealPublishConsumer(dependencies);
    consumer.eventSubscription = eventSubscription;
    setField(
        consumer,
        "alertMetrics",
        new AlertMetrics().withTotalEvents(0).withFailedEvents(0).withSuccessEvents(0));
    return consumer;
  }

  private static void setField(Object target, String name, Object value) throws Exception {
    Field field = AbstractEventConsumer.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }

  private static Object getField(Object target, String name) throws Exception {
    Field field = AbstractEventConsumer.class.getDeclaredField(name);
    field.setAccessible(true);
    return field.get(target);
  }

  static class RealPublishConsumer extends AbstractEventConsumer {
    final List<EventPublisherException> capturedFailures = new ArrayList<>();

    RealPublishConsumer(DIContainer dependencies) {
      super(dependencies);
    }

    @Override
    public boolean sendAlert(UUID receiverId, ChangeEvent event) {
      return true;
    }

    @Override
    public boolean getEnabled() {
      return true;
    }

    @Override
    public void handleFailedEvent(EventPublisherException ex, boolean errorOnSub) {
      // Capture instead of writing via the DAO, so the real publishEvents runs without one.
      capturedFailures.add(ex);
    }
  }

  private ChangeEvent createMockChangeEvent() {
    ChangeEvent event = mock(ChangeEvent.class);
    lenient().when(event.getId()).thenReturn(UUID.randomUUID());
    lenient().when(event.getEntityType()).thenReturn("table");
    return event;
  }
}
