package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatcher;
import org.mockito.InOrder;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;
import org.openmetadata.service.notifications.recipients.RecipientResolver;
import org.openmetadata.service.notifications.recipients.Recipients;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.util.DIContainer;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.Scheduler;

/** The order a tick works in, and where it may stop. The ledger of these tests stands at 7. */
class DispatchOrderTest {
  private static final Recipient SHARED = new EmailRecipient("shared@example.com");

  // Sorted by id these read third, second, first: the opposite of the order they happened in.
  private static final ChangeEvent FIRST = eventWithId("00000000-0000-0000-0000-000000000003");
  private static final ChangeEvent SECOND = eventWithId("00000000-0000-0000-0000-000000000002");
  private static final ChangeEvent THIRD = eventWithId("00000000-0000-0000-0000-000000000001");
  private static final JobKey JOB = new JobKey("alert", "OMAlertJobGroup");

  @AfterEach
  void restoreDefaults() {
    AlertingSettings.use(new AlertingSettings(Duration.ofSeconds(60), false));
    ServerStopping.set(false);
  }

  @Test
  void eventsAreSentInOffsetOrder() throws Exception {
    EventSubscription alert = alertWithDestinations(1);
    Destination<ChangeEvent> channel = channelOf(alert, 0);

    tick(alert, List.of(channel), mock(Scheduler.class));

    InOrder order = inOrder(channel);
    order.verify(channel).sendMessage(argThat(is(FIRST)), any());
    order.verify(channel).sendMessage(argThat(is(SECOND)), any());
    order.verify(channel).sendMessage(argThat(is(THIRD)), any());
  }

  // Which of two destinations of one type sends was decided by a hash of their ids.
  @Test
  void sharedEndpointUsesFirstDestinationConfig() throws Exception {
    for (int attempt = 0; attempt < 20; attempt++) {
      EventSubscription alert = alertWithDestinations(2);
      Destination<ChangeEvent> declaredFirst = channelOf(alert, 0);
      Destination<ChangeEvent> declaredSecond = channelOf(alert, 1);
      when(declaredFirst.requiresRecipients()).thenReturn(true);

      tick(alert, List.of(declaredFirst, declaredSecond), mock(Scheduler.class));

      verify(declaredFirst, times(3)).sendTo(any(), eq(SHARED));
      verify(declaredSecond, never()).sendTo(any(), any());
    }
  }

  @Test
  void budgetStopsAfterTheEventInProgressAndRunsAgainAtOnce() throws Exception {
    AlertingSettings.use(new AlertingSettings(Duration.ofNanos(1), false));
    EventSubscription alert = alertWithDestinations(1);
    Destination<ChangeEvent> channel = channelOf(alert, 0);
    Scheduler scheduler = mock(Scheduler.class);

    AlertLedger ledger = tick(alert, List.of(channel), scheduler);

    verify(channel, times(1)).sendMessage(any(), any());
    assertEquals(8, ledger.readUpTo(), "the position follows the last event that was finished");
    assertEquals(1, ledger.pending().totalEvents(), "only processed events are counted");
    verify(scheduler).triggerJob(JOB);
  }

  @Test
  void budgetOfZeroNeverStopsATick() throws Exception {
    AlertingSettings.use(new AlertingSettings(Duration.ZERO, false));
    EventSubscription alert = alertWithDestinations(1);
    Destination<ChangeEvent> channel = channelOf(alert, 0);
    Scheduler scheduler = mock(Scheduler.class);

    AlertLedger ledger = tick(alert, List.of(channel), scheduler);

    verify(channel, times(3)).sendMessage(any(), any());
    assertEquals(10, ledger.readUpTo());
    verify(scheduler, never()).triggerJob(any());
  }

  @Test
  void stoppingServerSendsNothingMoreAndStartsNothing() throws Exception {
    ServerStopping.set(true);
    EventSubscription alert = alertWithDestinations(1);
    Destination<ChangeEvent> channel = channelOf(alert, 0);
    Scheduler scheduler = mock(Scheduler.class);

    AlertLedger ledger = tick(alert, List.of(channel), scheduler);

    verify(channel, never()).sendMessage(any(), any());
    assertEquals(7, ledger.readUpTo(), "events nobody processed are still ahead of the position");
    verify(scheduler, never()).triggerJob(any());
  }

  @Test
  void eventThatCannotBeProcessedIsRecordedAndPassed() throws Exception {
    EventSubscription alert = alertWithDestinations(1);
    Destination<ChangeEvent> channel = channelOf(alert, 0);
    when(channel.getEnabled())
        .thenThrow(new IllegalStateException("broken before anything is sent"))
        .thenReturn(true);
    RecordingTick consumer = new RecordingTick();

    AlertLedger ledger = tick(consumer, alert, List.of(channel), mock(Scheduler.class));

    assertEquals(10, ledger.readUpTo(), "one bad event must not hold the alert");
    assertEquals(1, consumer.failures.size());
    verify(channel, times(2)).sendMessage(any(), any());
  }

  private static AlertLedger tick(
      EventSubscription alert, List<Destination<ChangeEvent>> channels, Scheduler scheduler)
      throws Exception {
    return tick(new RecordingTick(), alert, channels, scheduler);
  }

  private static AlertLedger tick(
      RecordingTick consumer,
      EventSubscription alert,
      List<Destination<ChangeEvent>> channels,
      Scheduler scheduler)
      throws Exception {
    AlertLedger ledger = TestLedgers.fresh(alert.getId());
    CollectionDAO dao = daoWithThreeEventsAfterSeven();
    JobExecutionContext context = contextOf(scheduler);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<AlertRows> rows = mockStatic(AlertRows.class);
        MockedStatic<AlertUtil> alertUtil = mockStatic(AlertUtil.class);
        MockedStatic<AlertFactory> factory = mockStatic(AlertFactory.class);
        MockedConstruction<RecipientResolver> ignored =
            mockConstruction(
                RecipientResolver.class,
                (resolver, construction) ->
                    when(resolver.recipientsOf(any(), any())).thenReturn(Recipients.of(SHARED)))) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      rows.when(() -> AlertRows.readOrNull(alert.getId())).thenReturn(alert);
      alertUtil
          .when(() -> AlertUtil.getFilteredEvents(any(), any(), any(), any()))
          .thenAnswer(invocation -> invocation.getArgument(1));
      for (int position = 0; position < channels.size(); position++) {
        Destination<ChangeEvent> channel = channels.get(position);
        factory
            .when(
                () ->
                    AlertFactory.getAlert(any(), argThat(hasId(alert, channels.indexOf(channel)))))
            .thenReturn(channel);
      }
      consumer.tick(alert, ledger, context);
    }
    return ledger;
  }

  private static CollectionDAO daoWithThreeEventsAfterSeven() {
    ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
    when(changeEvents.getLatestOffset()).thenReturn(10L);
    when(changeEvents.listWithOffset(anyInt(), anyLong()))
        .thenReturn(
            List.of(
                new ChangeEventRecord(8L, JsonUtils.pojoToJson(FIRST)),
                new ChangeEventRecord(9L, JsonUtils.pojoToJson(SECOND)),
                new ChangeEventRecord(10L, JsonUtils.pojoToJson(THIRD))));
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.changeEventDAO()).thenReturn(changeEvents);
    lenient().when(dao.eventSubscriptionDAO()).thenReturn(mock(EventSubscriptionDAO.class));
    return dao;
  }

  private static JobExecutionContext contextOf(Scheduler scheduler) {
    JobDetail job = mock(JobDetail.class);
    lenient().when(job.getKey()).thenReturn(JOB);
    JobExecutionContext context = mock(JobExecutionContext.class);
    when(context.getJobDetail()).thenReturn(job);
    when(context.getScheduler()).thenReturn(scheduler);
    return context;
  }

  private static EventSubscription alertWithDestinations(int count) {
    List<SubscriptionDestination> destinations = new ArrayList<>();
    for (int position = 0; position < count; position++) {
      destinations.add(new SubscriptionDestination().withId(UUID.randomUUID()).withType(WEBHOOK));
    }
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("alert")
        .withBatchSize(10)
        .withDestinations(destinations);
  }

  @SuppressWarnings("unchecked")
  private static Destination<ChangeEvent> channelOf(EventSubscription alert, int position)
      throws Exception {
    Destination<ChangeEvent> channel = mock(Destination.class);
    lenient().when(channel.getEnabled()).thenReturn(true);
    lenient()
        .when(channel.getSubscriptionDestination())
        .thenReturn(alert.getDestinations().get(position));
    lenient().when(channel.requiresRecipients()).thenReturn(false);
    lenient().when(channel.prepare(any())).thenCallRealMethod();
    lenient().when(channel.prepare(any(), any())).thenCallRealMethod();
    lenient().doCallRealMethod().when(channel).sendTo(any(), any());
    lenient().when(channel.notAttemptedBecause()).thenCallRealMethod();
    return channel;
  }

  private static ArgumentMatcher<SubscriptionDestination> hasId(
      EventSubscription alert, int position) {
    UUID id = alert.getDestinations().get(position).getId();
    return destination -> destination != null && id.equals(destination.getId());
  }

  private static ArgumentMatcher<ChangeEvent> is(ChangeEvent expected) {
    return event -> event != null && expected.getId().equals(event.getId());
  }

  private static ChangeEvent eventWithId(String id) {
    return new ChangeEvent().withId(UUID.fromString(id)).withEntityType("table");
  }

  /** The real tick and the real reader; failures stay in memory and nothing is committed. */
  private static class RecordingTick extends AbstractEventConsumer {
    final List<EventPublisherException> failures = new ArrayList<>();

    RecordingTick() {
      super(mock(DIContainer.class));
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
