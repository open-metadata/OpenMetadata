package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatcher;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.generic.GenericPublisher;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.notifications.recipients.RecipientResolver;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;
import org.openmetadata.service.util.DIContainer;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.Scheduler;

class DispatchIsolationTest {

  @Test
  void oneDeadEndpointDoesNotSilenceTheRest() throws Exception {
    SubscriptionDestination destination = webhookDestination();
    GenericPublisher publisher =
        new GenericPublisher(new EventSubscription().withName("alert"), destination);
    Invocation.Builder dead = endpointAnswering(500, "Server Error");
    Invocation.Builder firstLive = endpointAnswering(200, "OK");
    Invocation.Builder secondLive = endpointAnswering(200, "OK");
    Set<Recipient> recipients = new LinkedHashSet<>();
    recipients.add(recipientOf(dead));
    recipients.add(recipientOf(firstLive));
    recipients.add(recipientOf(secondLive));
    ChangeEvent event = new ChangeEvent().withId(UUID.randomUUID()).withEntityType("table");

    EventPublisherException failure =
        assertThrows(EventPublisherException.class, () -> publisher.sendMessage(event, recipients));

    verify(firstLive, times(1)).post(any());
    verify(secondLive, times(1)).post(any());
    assertSame(event, failure.getChangeEventWithSubscription().getRight());
    SubscriptionStatus status = (SubscriptionStatus) destination.getStatusDetails();
    assertEquals(SubscriptionStatus.Status.AWAITING_RETRY, status.getStatus());
    assertEquals(500, status.getLastFailedStatusCode());
  }

  @Test
  void unexpectedChannelErrorKeepsTheBatch() throws Exception {
    RecordingConsumer consumer = new RecordingConsumer();
    Destination<ChangeEvent> channel = destinationOfType(WEBHOOK);
    UUID destinationId = UUID.randomUUID();
    consumer.destinationMap = Map.of(destinationId, channel);
    ChangeEvent broken = new ChangeEvent().withId(UUID.randomUUID()).withEntityType("table");
    ChangeEvent healthy = new ChangeEvent().withId(UUID.randomUUID()).withEntityType("table");
    doThrow(new IllegalStateException("template helper blew up"))
        .when(channel)
        .sendMessage(eq(broken), any());
    Map<ChangeEvent, Set<UUID>> events = new LinkedHashMap<>();
    events.put(broken, Set.of(destinationId));
    events.put(healthy, Set.of(destinationId));

    try (MockedStatic<AlertUtil> alertUtil = mockStatic(AlertUtil.class);
        MockedConstruction<RecipientResolver> ignored = mockConstruction(RecipientResolver.class)) {
      alertUtil
          .when(() -> AlertUtil.getFilteredEvents(any(), any(), any(), any()))
          .thenReturn(events);
      consumer.publishEvents(events);
    }

    verify(channel, times(1)).sendMessage(eq(healthy), any());
    assertEquals(1, consumer.ledger.pending().successEvents());
    assertEquals(1, consumer.ledger.pending().failedEvents());
    assertEquals(1, consumer.failures.size());
    assertSame(broken, consumer.failures.getFirst().getChangeEventWithSubscription().getRight());
  }

  @Test
  void publishersAreClosedAfterEachTick() throws Exception {
    Destination<ChangeEvent> first = destinationOfType(WEBHOOK);
    Destination<ChangeEvent> second = destinationOfType(WEBHOOK);
    doThrow(new IllegalStateException("already closed")).when(first).close();
    EventSubscription alert = alertWithTwoDestinations();
    RecordingConsumer consumer = new RecordingConsumer();
    CollectionDAO dao = daoWithNoNewEvents();
    JobExecutionContext context = contextOfAnUnscheduledJob();

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<AlertRows> rows = mockStatic(AlertRows.class);
        MockedStatic<AlertFactory> factory = mockStatic(AlertFactory.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      rows.when(() -> AlertRows.readOrNull(alert.getId())).thenReturn(alert);
      factory
          .when(() -> AlertFactory.getAlert(any(), argThat(hasId(alert, 0)), any()))
          .thenReturn(first);
      factory
          .when(() -> AlertFactory.getAlert(any(), argThat(hasId(alert, 1)), any()))
          .thenReturn(second);
      consumer.tick(alert, TestLedgers.fresh(), context);
    }

    verify(first, times(1)).close();
    verify(second, times(1)).close();
  }

  private static ArgumentMatcher<SubscriptionDestination> hasId(
      EventSubscription alert, int position) {
    UUID id = alert.getDestinations().get(position).getId();
    return destination -> destination != null && id.equals(destination.getId());
  }

  private static SubscriptionDestination webhookDestination() {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(WEBHOOK)
        .withTimeout(10)
        .withReadTimeout(12)
        .withEnabled(true)
        .withConfig(new Webhook().withEndpoint(URI.create("https://hooks.example.com/hook")));
  }

  private static Invocation.Builder endpointAnswering(int statusCode, String reason) {
    Response.StatusType statusInfo = mock(Response.StatusType.class);
    lenient().when(statusInfo.getReasonPhrase()).thenReturn(reason);
    Response response = mock(Response.class);
    when(response.getStatus()).thenReturn(statusCode);
    when(response.getStatusInfo()).thenReturn(statusInfo);
    when(response.getStringHeaders()).thenReturn(new MultivaluedHashMap<>());
    when(response.hasEntity()).thenReturn(false);
    Invocation.Builder builder = mock(Invocation.Builder.class);
    when(builder.post(any())).thenReturn(response);
    return builder;
  }

  private static WebhookRecipient recipientOf(Invocation.Builder builder) {
    WebhookRecipient recipient = mock(WebhookRecipient.class);
    when(recipient.getConfiguredRequest(any(), any())).thenReturn(builder);
    return recipient;
  }

  @SuppressWarnings("unchecked")
  private static Destination<ChangeEvent> destinationOfType(
      SubscriptionDestination.SubscriptionType type) throws Exception {
    Destination<ChangeEvent> destination = mock(Destination.class);
    SubscriptionDestination stored =
        new SubscriptionDestination().withId(UUID.randomUUID()).withType(type);
    lenient().when(destination.getEnabled()).thenReturn(true);
    lenient().when(destination.getSubscriptionDestination()).thenReturn(stored);
    lenient().when(destination.requiresRecipients()).thenReturn(false);
    lenient().when(destination.prepare(any())).thenCallRealMethod();
    lenient().when(destination.prepare(any(), any())).thenCallRealMethod();
    lenient().doCallRealMethod().when(destination).sendTo(any(), any());
    lenient().when(destination.notAttemptedBecause()).thenCallRealMethod();
    return destination;
  }

  private static EventSubscription alertWithTwoDestinations() {
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("alert")
        .withBatchSize(10)
        .withDestinations(List.of(webhookDestination(), webhookDestination()));
  }

  private static CollectionDAO daoWithNoNewEvents() {
    ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
    when(changeEvents.getLatestOffset()).thenReturn(0L);
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.changeEventDAO()).thenReturn(changeEvents);
    return dao;
  }

  private static JobExecutionContext contextOfAnUnscheduledJob() {
    JobExecutionContext context = mock(JobExecutionContext.class);
    when(context.getJobDetail()).thenReturn(mock(JobDetail.class));
    when(context.getScheduler()).thenReturn(mock(Scheduler.class));
    return context;
  }

  /** Runs the real publish and tick logic, keeping failures in memory and reading no events. */
  static class RecordingConsumer extends AbstractEventConsumer {
    final List<EventPublisherException> failures = new ArrayList<>();

    RecordingConsumer() {
      super(mock(DIContainer.class));
      this.eventSubscription = new EventSubscription().withId(UUID.randomUUID()).withName("a");
      this.ledger = TestLedgers.fresh();
    }

    @Override
    public ResultList<ChangeEvent> pollEvents(long offset, long batchSize) {
      return new ResultList<>(new ArrayList<>(), new ArrayList<>(), null, null, 0);
    }

    @Override
    public void handleFailedEvent(EventPublisherException ex, boolean errorOnSub) {
      failures.add(ex);
    }

    @Override
    public void commit(JobExecutionContext jobExecutionContext) {}

    @Override
    public boolean sendAlert(UUID receiverId, ChangeEvent event) {
      return true;
    }

    @Override
    public boolean getEnabled() {
      return true;
    }

    @Override
    protected ConsumerKind kind() {
      return ConsumerKind.EVENT;
    }
  }
}
