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

import static org.openmetadata.service.events.subscription.AlertUtil.getFilteredEvents;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.events.subscription.matching.AlertMatching;
import org.openmetadata.service.events.subscription.matching.ShadowReports;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.notifications.recipients.RecipientResolver;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.util.DIContainer;
import org.openmetadata.service.util.PerRequestContextCleaner;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.SchedulerException;

@Slf4j
@DisallowConcurrentExecution
public abstract class AbstractEventConsumer
    implements Alert<ChangeEvent>, Consumer<ChangeEvent>, Job {
  public static final String DESTINATION_MAP_KEY = "SubscriptionMapKey";
  public static final String ALERT_OFFSET_KEY = "alertOffsetKey";
  public static final String ALERT_PENDING_GAP_SINCE_KEY = "alertPendingGapSinceKey";
  public static final String ALERT_INFO_KEY = "alertInfoKey";
  public static final String OFFSET_EXTENSION = LedgerKeys.POSITION;
  public static final String METRICS_EXTENSION = LedgerKeys.COUNTERS;
  public static final String FAILED_EVENT_EXTENSION = "eventSubscription.failedEvent";
  static final long GAP_RESOLVE_TIMEOUT_MS = 30_000;
  private static final int MAX_FAILURE_REASON_LENGTH = 2000;
  private static final int COMMIT_AFTER_EVERY_EVENT_AT = 3;
  private static final int SET_ASIDE_FIRST_EVENT_AT = 6;
  protected final DIContainer dependencies;
  protected AlertLedger ledger;
  // Offsets of the events the last poll returned, in the same order.
  private List<Long> polledOffsets = List.of();
  private TickStopSignal stopSignal;
  private AlertMatching matching;
  private boolean stoppedEarly;

  @Getter @Setter private JobDetail jobDetail;
  protected EventSubscription eventSubscription;
  protected Map<UUID, Destination<ChangeEvent>> destinationMap;

  protected AbstractEventConsumer(DIContainer dependencies) {
    this.dependencies = dependencies;
  }

  /** Which kind of consumer this is. The kind decides what a tick reads and guarantees. */
  protected abstract ConsumerKind kind();

  protected void doInit(JobExecutionContext context) {
    // To be implemented by the Subclass if needed
  }

  public enum FailureTowards {
    SUBSCRIBER,
    PUBLISHER
  }

  @Override
  public void handleFailedEvent(EventPublisherException ex, boolean errorOnSub) {
    if (ex.getChangeEventWithSubscription() == null) {
      LOG.error(
          "Change Event with Subscription is null in EventPublisherException: {}", ex.getMessage());
      return;
    }

    UUID failingSubscriptionId = ex.getChangeEventWithSubscription().getLeft();
    ChangeEvent changeEvent = ex.getChangeEventWithSubscription().getRight();
    LOG.debug(
        "Change Event Failed for Event Subscription: {} ,  for Subscription : {} , Change Event : {} ",
        eventSubscription.getName(),
        failingSubscriptionId,
        changeEvent);

    FailureTowards source = errorOnSub ? FailureTowards.SUBSCRIBER : FailureTowards.PUBLISHER;

    ledger.failure(
        String.format("%s-%s", FAILED_EVENT_EXTENSION, changeEvent.getId()),
        JsonUtils.pojoToJson(
            new FailedEvent()
                .withFailingSubscriptionId(failingSubscriptionId)
                .withChangeEvent(changeEvent)
                .withRetriesLeft(eventSubscription.getRetries())
                .withReason(ex.getMessage())
                .withTimestamp(System.currentTimeMillis())),
        source.toString());
  }

  private Map<UUID, Destination<ChangeEvent>> loadDestinationsMap() {
    // In the order the alert declares them: that order decides which destination sends first and
    // which one supplies the configuration when several share a type.
    Map<UUID, Destination<ChangeEvent>> dMap = new LinkedHashMap<>();
    if (eventSubscription.getDestinations() == null) {
      return dMap;
    }
    for (SubscriptionDestination subscriptionDest : eventSubscription.getDestinations()) {
      subscriptionDest.setStatusDetails(null);
      dMap.put(
          subscriptionDest.getId(), AlertFactory.getAlert(eventSubscription, subscriptionDest));
    }
    return dMap;
  }

  @Override
  public void publishEvents(Map<ChangeEvent, Set<UUID>> events) {
    if (events.isEmpty()) {
      return;
    }
    Map<ChangeEvent, Set<UUID>> filteredEvents =
        getFilteredEvents(matchingOfThisTick(), events, this::deadLetterEvent);
    RecipientResolver resolver = new RecipientResolver();
    int successDeliveries = 0;
    int failedDeliveries = 0;
    for (Map.Entry<ChangeEvent, Set<UUID>> eventWithReceivers : filteredEvents.entrySet()) {
      EventDeliveryResult result =
          publishEvent(eventWithReceivers.getKey(), eventWithReceivers.getValue(), resolver);
      // Record once per (event, subscription): the table has no destination dimension, so
      // recording per type would duplicate rows and break Postgres ON CONFLICT.
      if (result.delivered()) {
        ledger.delivered(eventWithReceivers.getKey());
      }
      successDeliveries += result.successCount();
      failedDeliveries += result.failedCount();
    }
    ledger.channelOutcomes(successDeliveries, failedDeliveries);
  }

  /** An event we could not even filter is a publisher-side failure, so record it as one. */
  private void deadLetterEvent(ChangeEvent event, Exception error) {
    LOG.error(
        "Event Subscription: {} could not evaluate filters for change event {}",
        eventSubscription.getName(),
        event.getId(),
        error);
    handleFailedEvent(
        new EventPublisherException(
            String.format("Failed to evaluate alert filters: %s", error.getMessage()),
            Pair.of(eventSubscription.getId(), event)),
        false);
  }

  private EventDeliveryResult publishEvent(
      ChangeEvent event, Set<UUID> destinationIds, RecipientResolver resolver) {
    // Group destinations by type to enable cross-destination recipient deduplication
    Map<SubscriptionType, List<Destination<ChangeEvent>>> destinationsByType =
        groupDestinationsByType(destinationIds);
    List<EventPublisherException> failures = new ArrayList<>();
    for (List<Destination<ChangeEvent>> sameType : destinationsByType.values()) {
      sendToDestinationType(event, sameType, resolver).ifPresent(failures::add);
    }
    recordSendFailures(event, failures);
    int successCount = destinationsByType.size() - failures.size();
    return new EventDeliveryResult(successCount > 0, successCount, failures.size());
  }

  private record EventDeliveryResult(boolean delivered, int successCount, int failedCount) {}

  private Optional<EventPublisherException> sendToDestinationType(
      ChangeEvent event, List<Destination<ChangeEvent>> destinations, RecipientResolver resolver) {
    Destination<ChangeEvent> publisher = destinations.getFirst();
    EventPublisherException failure = null;
    try {
      sendThroughPrimary(event, destinations, publisher, resolver);
    } catch (EventPublisherException e) {
      LOG.error("Failed to send alert: {}", e.getMessage());
      failure = e;
    } catch (RuntimeException e) {
      // Anything unexpected costs this channel for this event, never the rest of the batch.
      LOG.error("Unexpected error sending alert for change event {}", event.getId(), e);
      failure = unexpectedSendFailure(publisher, event, e);
    }
    return Optional.ofNullable(failure);
  }

  // One failure row per event and alert. It names the first failing destination and lists every
  // one, so a second failure on the same event adds detail and never overwrites the first.
  private void recordSendFailures(ChangeEvent event, List<EventPublisherException> failures) {
    if (failures.size() == 1) {
      recordSendFailure(failures.getFirst());
    } else if (failures.size() > 1) {
      String everyReason =
          failures.stream().map(Throwable::getMessage).collect(Collectors.joining("; "));
      UUID firstFailing = failures.getFirst().getChangeEventWithSubscription().getLeft();
      recordSendFailure(
          new EventPublisherException(
              StringUtils.abbreviate(everyReason, MAX_FAILURE_REASON_LENGTH),
              Pair.of(firstFailing, event)));
    }
  }

  // Send via primary destination only, with deduplicated recipients (one send per type).
  // Empty recipients is treated as successful (no-op send).
  private void sendThroughPrimary(
      ChangeEvent event,
      List<Destination<ChangeEvent>> destinations,
      Destination<ChangeEvent> publisher,
      RecipientResolver resolver)
      throws EventPublisherException {
    Set<Recipient> recipients = Set.of();
    if (publisher.requiresRecipients()) {
      List<SubscriptionDestination> subDestinations =
          destinations.stream().map(Destination::getSubscriptionDestination).toList();
      recipients = resolver.resolveRecipients(event, subDestinations);
    }
    if (!publisher.requiresRecipients() || !recipients.isEmpty()) {
      publisher.sendMessage(event, recipients);
    }
  }

  private static EventPublisherException unexpectedSendFailure(
      Destination<ChangeEvent> publisher, ChangeEvent event, RuntimeException cause) {
    return new EventPublisherException(
        String.format("Unexpected error while sending: %s", cause.getMessage()),
        Pair.of(publisher.getSubscriptionDestination().getId(), event));
  }

  private void recordSendFailure(EventPublisherException failure) {
    try {
      handleFailedEvent(failure, true);
    } catch (RuntimeException recordingError) {
      LOG.error("Failed to record a send failure: {}", failure.getMessage(), recordingError);
    }
  }

  private Map<SubscriptionType, List<Destination<ChangeEvent>>> groupDestinationsByType(
      Set<UUID> destinationIds) {
    return destinationMap.entrySet().stream()
        .filter(entry -> destinationIds.contains(entry.getKey()))
        .map(Map.Entry::getValue)
        .filter(Destination::getEnabled)
        .collect(
            Collectors.groupingBy(
                dest -> dest.getSubscriptionDestination().getType(),
                LinkedHashMap::new,
                Collectors.toList()));
  }

  @Override
  public void commit(JobExecutionContext jobExecutionContext) {
    ledger.commit();
  }

  @Override
  public ResultList<ChangeEvent> pollEvents(long offset, long batchSize) {
    var records =
        Entity.getCollectionDAO().changeEventDAO().listWithOffset((int) batchSize, offset);
    CursorPlan cursorPlan =
        planCursor(offset, ledger.gapWaitSince(), records, System.currentTimeMillis());
    ledger.readUpTo(cursorPlan.offset(), cursorPlan.pendingGapSince());

    if (cursorPlan.skippedGap()) {
      AlertTelemetry.absorbed(AlertTelemetry.GAP_STEPPED_OVER);
      LOG.warn(
          "Event subscription {} skipping unfilled change_event gap [{} .. {}] after {}ms",
          eventSubscription.getId(),
          offset + 1,
          cursorPlan.offset(),
          GAP_RESOLVE_TIMEOUT_MS);
    }

    List<ChangeEvent> changeEvents = new ArrayList<>();
    List<EntityError> errorEvents = new ArrayList<>();
    List<Long> offsets = new ArrayList<>();
    for (int index = 0; index < cursorPlan.recordCount(); index++) {
      var eventRecord = records.get(index);
      try {
        ChangeEvent event = JsonUtils.readValue(eventRecord.json(), ChangeEvent.class);
        if (event == null) {
          // JsonUtils.readValue returns null (it does not throw) on a null/blank json column, which
          // would add a null ChangeEvent to the delivered batch and NPE downstream. Route it to
          // errorEvents like any other unparseable row instead of silently delivering null.
          throw new IllegalStateException(
              "Null or blank change_event.json at offset " + eventRecord.offset());
        }
        changeEvents.add(event);
        offsets.add(eventRecord.offset());
      } catch (Exception ex) {
        errorEvents.add(
            new EntityError().withMessage(ex.getMessage()).withEntity(eventRecord.json()));
        LOG.error(
            "Error in Parsing Change Event : {} , Message: {} ",
            eventRecord.json(),
            ex.getMessage(),
            ex);
      }
    }
    polledOffsets = offsets;
    return new ResultList<>(changeEvents, errorEvents, null, null, cursorPlan.recordCount());
  }

  /**
   * Advances only across a contiguous prefix of committed offsets. AUTO_INCREMENT values become
   * visible at commit, so a concurrent transaction can temporarily hide a lower offset while a
   * higher offset is already readable. Waiting at that gap prevents permanent event loss. A gap
   * that remains unfilled is eventually treated as a rolled-back insert so consumers cannot stall
   * forever.
   */
  static CursorPlan planCursor(
      long currentOffset, long pendingGapSince, List<ChangeEventRecord> records, long now) {
    if (records.isEmpty()) {
      return new CursorPlan(currentOffset, 0L, 0, false);
    }

    int contiguousCount = 0;
    long expectedOffset = currentOffset + 1;
    while (contiguousCount < records.size()
        && records.get(contiguousCount).offset() == expectedOffset) {
      contiguousCount++;
      expectedOffset++;
    }

    if (contiguousCount > 0) {
      return new CursorPlan(currentOffset + contiguousCount, 0L, contiguousCount, false);
    }
    if (pendingGapSince == 0L) {
      return new CursorPlan(currentOffset, now, 0, false);
    }
    if (now - pendingGapSince >= GAP_RESOLVE_TIMEOUT_MS) {
      return new CursorPlan(records.getFirst().offset() - 1, 0L, 0, true);
    }
    return new CursorPlan(currentOffset, pendingGapSince, 0, false);
  }

  record CursorPlan(long offset, long pendingGapSince, int recordCount, boolean skippedGap) {}

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    // Quartz worker threads are long lived, shared with every other scheduled job, and never pass
    // through the JAX-RS response filter. Per-request ThreadLocal caches left behind here would be
    // served to whatever runs next on this thread — indefinitely stale. Destinations on this thread
    // read entities (governance workflows resolve inherited reviewers here), so bracket the whole
    // tick: start clean, and leave clean however this exits.
    PerRequestContextCleaner.clear();
    try {
      AlertTick.run(this, jobExecutionContext);
    } finally {
      PerRequestContextCleaner.clear();
    }
  }

  /** One tick of this consumer for an alert whose row was just read and whose ledger is open. */
  final void tick(EventSubscription alert, AlertLedger openLedger, JobExecutionContext context) {
    this.jobDetail = context.getJobDetail();
    this.eventSubscription = alert;
    this.ledger = openLedger;
    this.destinationMap = loadDestinationsMap();
    this.stopSignal = TickStopSignal.startingNow(AlertingSettings.current());
    this.stoppedEarly = false;
    this.matching = null;
    TickMemory.begin();
    try {
      doInit(context);
      if (kind() != ConsumerKind.SELF_DRIVEN) {
        readAndPublish(context);
      }
    } catch (Exception e) {
      LOG.error("Tick of alert {} failed at position {}", alert.getName(), ledger.position(), e);
    } finally {
      TickMemory.end();
      finishTick(context);
    }
  }

  /** Set when this tick should end after the event, or the batch, it is working on. */
  protected final TickStopSignal stopSignal() {
    return stopSignal;
  }

  private void readAndPublish(JobExecutionContext context) {
    int interruptedBefore = ledger.interruptedAttempts();
    long latestOffset = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    AlertTelemetry.lag(latestOffset - ledger.position());
    if (latestOffset > ledger.position()) {
      ledger.noteOpening();
    }
    ResultList<ChangeEvent> batch = pollEvents(ledger.position(), eventSubscription.getBatchSize());
    List<ChangeEvent> events = new ArrayList<>(batch.getData());
    if (interruptedBefore >= SET_ASIDE_FIRST_EVENT_AT && !events.isEmpty()) {
      setAside(events.removeFirst());
    }
    boolean careful = interruptedBefore >= COMMIT_AFTER_EVERY_EVENT_AT;
    // A consumer that reads its events its own way gives the tick no offset to stop at.
    boolean canStopBetweenEvents = polledOffsets.size() == batch.getData().size();
    boolean wholeBatchAtOnce = kind() == ConsumerKind.BATCH && !careful;
    if (wholeBatchAtOnce || !canStopBetweenEvents) {
      publish(events);
    } else {
      publishOneByOne(events, careful, context);
    }
  }

  private void publish(List<ChangeEvent> events) {
    Map<ChangeEvent, Set<UUID>> eventsWithReceivers = createEventsWithReceivers(events);
    if (!eventsWithReceivers.isEmpty()) {
      ledger.eventsRead(eventsWithReceivers.size());
      publishEvents(eventsWithReceivers);
    }
  }

  // A tick can only stop between two events. After ticks that never came back it also commits after
  // every
  // event: the event that stops the server then becomes the first one after the committed
  // position, where it can be found and set aside.
  private void publishOneByOne(
      List<ChangeEvent> events, boolean commitAfterEach, JobExecutionContext context) {
    long endOfBatch = ledger.readUpTo();
    long gapSince = ledger.pendingGapSince();
    int skipped = polledOffsets.size() - events.size();
    // The reader pointed the ledger at the end of the batch. Until an event is finished, the
    // position may only move past what was set aside.
    ledger.readUpTo(skipped > 0 ? polledOffsets.get(skipped - 1) : ledger.position(), 0L);
    int processed = 0;
    while (processed < events.size() && !mustStopBefore(processed)) {
      matchingOfThisTick().nextEventIsAt(polledOffsets.get(processed + skipped));
      publishIsolated(events.get(processed));
      ledger.readUpTo(polledOffsets.get(processed + skipped), 0L);
      processed++;
      if (commitAfterEach) {
        commit(context);
      }
    }
    stoppedEarly = processed < events.size();
    if (!stoppedEarly) {
      ledger.readUpTo(endOfBatch, gapSince);
    }
  }

  // The position now follows each event, so an event that cannot be processed at all is recorded
  // as a failure and passed, or the alert would come back to it on every tick and never get past.
  private void publishIsolated(ChangeEvent event) {
    try {
      publish(List.of(event));
    } catch (RuntimeException e) {
      LOG.error(
          "Alert {} could not process change event {}",
          eventSubscription.getName(),
          event.getId(),
          e);
      handleFailedEvent(
          new EventPublisherException(
              String.format("Failed to process the event: %s", e.getMessage()),
              Pair.of(eventSubscription.getId(), event)),
          false);
    }
  }

  // The budget never stops a tick before its first event, so an alert always moves forward.
  private boolean mustStopBefore(int processed) {
    return ServerStopping.isSet() || (processed > 0 && stopSignal.budgetHasPassed());
  }

  private void setAside(ChangeEvent event) {
    LOG.error(
        "Alert {} sets change event {} aside: the ticks that reached it never came back",
        eventSubscription.getName(),
        event.getId());
    ledger.eventsRead(1);
    AlertTelemetry.absorbed(AlertTelemetry.EVENT_SET_ASIDE_AS_INTERRUPTED);
    handleFailedEvent(
        new EventPublisherException(
            "Interrupted repeatedly while processing this event",
            Pair.of(eventSubscription.getId(), event)),
        false);
  }

  private void finishTick(JobExecutionContext context) {
    try {
      reportDestinationStatus();
      commit(context);
      ledger.clearOpeningNote();
      refreshCopyForOlderServers(context);
      runAgainAtOnceIfStoppedForTime(context);
    } finally {
      closeDestinations();
    }
  }

  // A one-off trigger for the same job. Quartz holds it until this tick is over, and it then
  // competes with every other alert's due trigger by fire time, so an alert that has been waiting
  // goes first and the stopped alert loses no poll interval. A stopping server starts nothing.
  private void runAgainAtOnceIfStoppedForTime(JobExecutionContext context) {
    if (stoppedEarly && !ServerStopping.isSet()) {
      AlertTelemetry.tickStoppedByBudget();
      try {
        context.getScheduler().triggerJob(context.getJobDetail().getKey());
        AlertTelemetry.ranAgainAtOnce();
      } catch (SchedulerException e) {
        LOG.warn(
            "Alert {} could not run again at once; the rest waits for its next poll",
            eventSubscription.getName(),
            e);
      }
    }
  }

  // From the row as it is now, never from the alert this tick started with: an edit made while
  // the tick ran has already written a fresher copy, and it must not be replaced by an older one.
  // What the comparison of the two matching engines showed is kept with it, and like everything
  // else of an alert, not for one that was deleted meanwhile.
  private void refreshCopyForOlderServers(JobExecutionContext context) {
    EventSubscription current = AlertRows.readOrNull(eventSubscription.getId());
    if (current != null && matching != null) {
      ShadowReports.add(current.getId(), matching.tally());
    }
    if (current != null && !Boolean.FALSE.equals(current.getEnabled())) {
      CopyForOlderServers.ensure(context.getScheduler(), current, ledger.health());
    }
  }

  // Built when the tick first needs it: the plan, and the mode that is in force for this tick.
  private AlertMatching matchingOfThisTick() {
    if (matching == null) {
      matching =
          AlertMatching.forTick(
              eventSubscription,
              AlertUtil.alertingWatermark(eventSubscription, ledger.watermark()));
    }
    return matching;
  }

  // Publishers leave their outcome on the destination they sent through. The alert was read from
  // its row a moment ago, so anything found here was set by this tick.
  private void reportDestinationStatus() {
    for (Map.Entry<UUID, Destination<ChangeEvent>> entry : destinationMap.entrySet()) {
      Object status = entry.getValue().getSubscriptionDestination().getStatusDetails();
      if (status instanceof SubscriptionStatus reported) {
        ledger.destinationStatus(entry.getKey(), reported);
      }
    }
  }

  private void closeDestinations() {
    for (Destination<ChangeEvent> destination : destinationMap.values()) {
      try {
        destination.close();
      } catch (RuntimeException e) {
        LOG.warn("Failed to close a destination of {}", eventSubscription.getName(), e);
      }
    }
  }

  /**
   * Records a delivery this consumer made itself, for a subclass that produces its own events
   * instead of polling change events.
   *
   * <p>Metrics otherwise reach the subscription only through the poll-and-publish path, and
   * a tick commits only when something changed. A consumer with nothing
   * to poll never moves it, so its total, success and failure counts stay at zero for the life of
   * the subscription however much it has delivered, and the status and diagnostics endpoints
   * report an alert that has never sent anything.
   */
  protected void recordDelivery(int successCount, int failedCount) {
    ledger.selfReportedDelivery(successCount, failedCount);
  }

  /**
   * Records a delivery failure that has no change event behind it.
   *
   * <p>{@link #handleFailedEvent} returns early unless the exception carries one, because it keys
   * the row by that event's id. A consumer producing its own events has none, so a bounced email or
   * a dead channel would leave nothing on the subscription for the UI to show, however often it
   * happened. The row written here is keyed by the subscription alone, so it holds the most recent
   * such failure rather than growing without bound.
   */
  protected void recordFailure(String reason) {
    FailedEvent failedEvent =
        new FailedEvent()
            .withFailingSubscriptionId(eventSubscription.getId())
            .withReason(reason)
            .withRetriesLeft(0)
            .withTimestamp(System.currentTimeMillis());
    ledger.failure(
        String.format("%s-self", FAILED_EVENT_EXTENSION),
        JsonUtils.pojoToJson(failedEvent),
        FailureTowards.SUBSCRIBER.toString());
  }

  public EventSubscription getEventSubscription() {
    return eventSubscription;
  }

  private Map<ChangeEvent, Set<UUID>> createEventsWithReceivers(List<ChangeEvent> events) {
    // In the order they were read, which is the order the changes happened.
    Map<ChangeEvent, Set<UUID>> eventsWithReceivers = new LinkedHashMap<>();
    for (ChangeEvent changeEvent : events) {
      eventsWithReceivers.put(changeEvent, new LinkedHashSet<>(destinationMap.keySet()));
    }
    return eventsWithReceivers;
  }
}
