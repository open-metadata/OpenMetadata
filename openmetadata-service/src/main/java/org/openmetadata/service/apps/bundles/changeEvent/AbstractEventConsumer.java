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

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.consumer.ConsumerJob;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.scheduled.AlertJobs;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.util.DIContainer;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.quartz.SchedulerException;

/**
 * The runtime of every change-event consumer: one tick reads the alert's events after its position,
 * hands them to the consumer, and commits how far it got. What a consumer does with the events, and
 * what it needs around them, it says through four hooks: {@link #beginTick}, {@link #handle}, {@link
 * #beforeCommit} and {@link #endTick}.
 */
@Slf4j
@DisallowConcurrentExecution
public abstract class AbstractEventConsumer implements Job {
  public static final String DESTINATION_MAP_KEY = "SubscriptionMapKey";
  public static final String OFFSET_EXTENSION = LedgerKeys.POSITION;
  public static final String METRICS_EXTENSION = LedgerKeys.COUNTERS;
  public static final String FAILED_EVENT_EXTENSION = "eventSubscription.failedEvent";
  static final long GAP_RESOLVE_TIMEOUT_MS = 30_000;
  private static final int COMMIT_AFTER_EVERY_EVENT_AT = 3;
  private static final int SET_ASIDE_FIRST_EVENT_AT = 6;
  protected final DIContainer dependencies;
  protected AlertLedger ledger;
  // Offsets of the events the last poll returned, in the same order.
  private List<Long> polledOffsets = List.of();
  private TickStopSignal stopSignal;
  private boolean stoppedEarly;

  protected EventSubscription eventSubscription;

  protected AbstractEventConsumer(DIContainer dependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Which kind of consumer this is, as its class declares. The kind decides what a tick reads and
   * guarantees.
   */
  protected final ConsumerKind kind() {
    return ConsumerKind.of(getClass());
  }

  /**
   * Runs when the tick starts, before {@link #doInit} and outside the tick's error handling: what
   * the consumer needs for the whole tick is made here. {@link #endTick} runs however the tick
   * ends.
   */
  protected void beginTick() {
    // Nothing to make by default.
  }

  protected void doInit(JobExecutionContext context) {
    // To be implemented by the Subclass if needed
  }

  /**
   * The change events this tick read, in the order they happened: one at a time, or the whole batch
   * at once for a batch consumer that is not being careful, or for a consumer that reads its events
   * its own way. Each event reaches the consumer once.
   */
  protected abstract void handle(List<ChangeEvent> events);

  /** Runs when the tick commits at its end, before the commit and as part of it. */
  protected void beforeCommit() {
    // Nothing to add to the commit by default.
  }

  /** Runs however the tick ended, after its commit. */
  protected void endTick() {
    // Nothing to release by default.
  }

  public enum FailureTowards {
    SUBSCRIBER,
    PUBLISHER
  }

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

  public void commit(JobExecutionContext jobExecutionContext) {
    ledger.commit();
  }

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

  /**
   * A job stored under a consumer's class before alerts were scheduled with {@link ConsumerJob}
   * still runs, as that job.
   *
   * @deprecated the alert scheduler stores {@link ConsumerJob}. A consumer stays a {@link Job} only
   *     until 2.3, so that a job a previous release stored under a consumer's class, which still
   *     loads, never names a class that is not a job: one such row stops the whole scheduler.
   */
  @Deprecated(since = "2.2", forRemoval = true)
  @Override
  public void execute(JobExecutionContext jobExecutionContext) throws JobExecutionException {
    new ConsumerJob(dependencies).execute(jobExecutionContext);
  }

  /** One tick of this consumer for an alert whose row was just read and whose ledger is open. */
  final void tick(EventSubscription alert, AlertLedger openLedger, JobExecutionContext context) {
    this.eventSubscription = alert;
    this.ledger = openLedger;
    openTick();
    beginTick();
    TickMemory.begin(stopSignal);
    try {
      doInit(context);
      if (kind().readsChangeEvents()) {
        readAndPublish(context);
      }
    } catch (Exception e) {
      LOG.error("Tick of alert {} failed at position {}", alert.getName(), ledger.position(), e);
    } finally {
      TickMemory.end();
      finishTick(context);
    }
  }

  // What one tick works with, made fresh when it starts. Unit tests open a tick the same way.
  void openTick() {
    this.stopSignal = TickStopSignal.startingNow(AlertingSettings.current());
    this.stoppedEarly = false;
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

  // Each event once, in the order they were read, which is the order the changes happened.
  private void publish(List<ChangeEvent> events) {
    List<ChangeEvent> distinct = List.copyOf(new LinkedHashSet<>(events));
    if (!distinct.isEmpty()) {
      ledger.eventsRead(distinct.size());
      handle(distinct);
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
      commitThisTick(context);
      restartTimetableIfBehind(context);
      runAgainAtOnceIfStoppedForTime(context);
    } finally {
      endTick();
    }
  }

  // A tick that ended past its alert's next slot restarts the timetable, so the next run comes one
  // poll interval after this one ended rather than once per slot it missed.
  private void restartTimetableIfBehind(JobExecutionContext context) {
    if (context != null) {
      try {
        AlertJobs.restartIfBehind(context);
      } catch (SchedulerException | RuntimeException e) {
        LOG.warn(
            "Alert {} could not restart its timetable; the misfire scan fires it",
            eventSubscription.getName(),
            e);
      }
    }
  }

  // However the commit ends, this tick came back: only one that never does was interrupted.
  private void commitThisTick(JobExecutionContext context) {
    try {
      beforeCommit();
      commit(context);
    } finally {
      ledger.clearOpeningNote();
    }
  }

  // A one-off trigger for the same job. Quartz holds it until this tick is over, and it then
  // competes with every other alert's due trigger by fire time, so an alert that has been waiting
  // goes first and the stopped alert loses no poll interval. A stopping server starts nothing.
  private void runAgainAtOnceIfStoppedForTime(JobExecutionContext context) {
    if (stoppedEarly && !ServerStopping.isSet()) {
      AlertTelemetry.tickStoppedByBudget();
      try {
        AlertJobs.runAgainNow(context);
        AlertTelemetry.ranAgainAtOnce();
      } catch (SchedulerException e) {
        LOG.warn(
            "Alert {} could not run again at once; the rest waits for its next poll",
            eventSubscription.getName(),
            e);
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
}
