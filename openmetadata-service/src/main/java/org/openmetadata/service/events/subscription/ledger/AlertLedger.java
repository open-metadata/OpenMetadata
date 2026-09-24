package org.openmetadata.service.events.subscription.ledger;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.AlertEventInProgress;
import org.openmetadata.schema.entity.events.AlertGapWait;
import org.openmetadata.schema.entity.events.AlertHealth;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

/**
 * Everything one tick of one alert leaves behind. The tick reports to it while it runs and the
 * ledger writes once, at commit: the position first, by compare-and-set against the document it
 * opened with, then the counters, then the rest as best effort.
 *
 * <p>Not thread-safe. Quartz never runs two ticks of one alert at once on one scheduler, and a
 * second run on another node after a false failover has a ledger of its own.
 */
@Slf4j
public final class AlertLedger {

  /** What the position write found in the row. */
  public enum Commit {
    NOTHING_TO_WRITE,
    WRITTEN,
    POSITION_MOVED_BY_SOMEONE_ELSE,
    ALERT_DELETED
  }

  private final String alertId;
  private final EventSubscriptionOffset position;
  private final AlertGapWait gapWaitAtOpen;
  private final AlertHealth health;
  private final AlertEventInProgress interrupted;
  private String positionExpected;

  private long readUpTo;
  private long gapSince;
  private int totalEvents;
  private boolean noted;
  private int successEvents;
  private int failedEvents;
  private final Map<String, SubscriptionStatus> statusThisTick = new LinkedHashMap<>();
  private final List<ChangeEvent> delivered = new ArrayList<>();
  private final List<FailureRow> failures = new ArrayList<>();

  private record FailureRow(String key, String json, String source) {}

  public AlertLedger(EventSubscription alert, Map<String, String> rows) {
    this.alertId = alert.getId().toString();
    this.positionExpected = rows.get(LedgerKeys.POSITION);
    this.position = JsonUtils.readValue(positionExpected, EventSubscriptionOffset.class);
    this.gapWaitAtOpen = read(rows, LedgerKeys.GAP_WAIT, AlertGapWait.class);
    this.interrupted = read(rows, LedgerKeys.IN_PROGRESS, AlertEventInProgress.class);
    AlertHealth stored = read(rows, LedgerKeys.HEALTH, AlertHealth.class);
    this.health =
        stored != null ? stored : AlertRecord.initialHealth(alert, System.currentTimeMillis());
    this.readUpTo = position.getCurrentOffset();
    this.gapSince = gapWaitSince();
  }

  public long position() {
    return position.getCurrentOffset();
  }

  public long startingOffset() {
    return position.getStartingOffset();
  }

  public Long watermark() {
    return position.getStartingTimestamp();
  }

  /** Zero unless a wait was stored at exactly this position: a wait belongs to where it began. */
  public long gapWaitSince() {
    boolean measuredHere =
        gapWaitAtOpen != null && gapWaitAtOpen.getAtOffset().equals(position.getCurrentOffset());
    return measuredHere ? gapWaitAtOpen.getSince() : 0L;
  }

  /** Ticks in a row that opened at this position and never committed, before this one. */
  public int interruptedAttempts() {
    boolean sameplace =
        interrupted != null && interrupted.getOffset().equals(position.getCurrentOffset());
    return sameplace ? interrupted.getAttempts() : 0;
  }

  /** What this tick has reported so far and not yet written. */
  public record Pending(
      int totalEvents, int successEvents, int failedEvents, List<ChangeEvent> delivered) {}

  public Pending pending() {
    return new Pending(totalEvents, successEvents, failedEvents, List.copyOf(delivered));
  }

  public Map<String, DestinationHealth> health() {
    return health.getDestinations();
  }

  /** Written before events are read, so a tick that never comes back is still counted. */
  public void noteOpening() {
    AlertEventInProgress note =
        new AlertEventInProgress()
            .withOffset(position.getCurrentOffset())
            .withAttempts(interruptedAttempts() + 1)
            .withTimestamp(System.currentTimeMillis());
    dao()
        .upsertSubscriberExtension(
            alertId,
            LedgerKeys.IN_PROGRESS,
            LedgerKeys.IN_PROGRESS_SCHEMA,
            JsonUtils.pojoToJson(note));
    noted = true;
  }

  public long readUpTo() {
    return readUpTo;
  }

  public long pendingGapSince() {
    return gapSince;
  }

  /** A tick that ends, however it ends, was not interrupted. */
  public void clearOpeningNote() {
    if (noted) {
      dao().deleteSubscriberExtension(alertId, LedgerKeys.IN_PROGRESS);
      noted = false;
    }
  }

  public void readUpTo(long offset, long pendingGapSince) {
    this.readUpTo = offset;
    this.gapSince = pendingGapSince;
  }

  public void eventsRead(int count) {
    totalEvents += count;
  }

  public void channelOutcomes(int succeeded, int failed) {
    successEvents += succeeded;
    failedEvents += failed;
    AlertTelemetry.channelOutcomes(succeeded, failed);
  }

  public void delivered(ChangeEvent event) {
    delivered.add(event);
  }

  /** Written at commit with the other rows, so a tick that outlives its alert leaves nothing. */
  public void failure(String key, String json, String source) {
    failures.add(new FailureRow(key, json, source));
  }

  /** A delivery a consumer made on its own, with no change event behind it. */
  public void selfReportedDelivery(int succeeded, int failed) {
    totalEvents += succeeded + failed;
    channelOutcomes(succeeded, failed);
  }

  /** A failure stays for the rest of the tick: a later success must not hide it. */
  public void destinationStatus(UUID destinationId, SubscriptionStatus status) {
    SubscriptionStatus soFar = statusThisTick.get(destinationId.toString());
    if (soFar == null || !HealthStreak.isFailing(soFar)) {
      statusThisTick.put(destinationId.toString(), status);
    }
  }

  public Commit commit() {
    Commit result = Commit.NOTHING_TO_WRITE;
    if (somethingChanged()) {
      result = commitPosition();
      if (result != Commit.ALERT_DELETED) {
        commitCounters();
        writeBestEffort(result == Commit.WRITTEN);
      }
      forgetWhatWasWritten();
    }
    return result;
  }

  private boolean somethingChanged() {
    boolean positionMoved = readUpTo > position.getCurrentOffset();
    boolean countersMoved = totalEvents + successEvents + failedEvents > 0;
    boolean gapChanged = gapSince != gapWaitSince();
    return positionMoved
        || countersMoved
        || gapChanged
        || !statusThisTick.isEmpty()
        || !delivered.isEmpty()
        || !failures.isEmpty();
  }

  private Commit commitPosition() {
    Commit result = Commit.WRITTEN;
    if (readUpTo > position.getCurrentOffset()) {
      String moved = JsonUtils.pojoToJson(positionAt(readUpTo));
      int rows =
          dao()
              .compareAndSetSubscriberExtension(
                  alertId, LedgerKeys.POSITION, moved, positionExpected);
      result = rows == 1 ? positionWritten(moved) : whyThePositionWasNotWritten();
    } else if (dao().getSubscriberExtension(alertId, LedgerKeys.POSITION) == null) {
      result = Commit.ALERT_DELETED;
    }
    return result;
  }

  private Commit positionWritten(String moved) {
    positionExpected = moved;
    position.withCurrentOffset(readUpTo);
    return Commit.WRITTEN;
  }

  private Commit whyThePositionWasNotWritten() {
    String current = dao().getSubscriberExtension(alertId, LedgerKeys.POSITION);
    LOG.warn("Alert {} did not move its position: {}", alertId, current == null ? "gone" : "moved");
    AlertTelemetry.absorbed(
        current == null
            ? AlertTelemetry.ALERT_DELETED_DURING_TICK
            : AlertTelemetry.POSITION_MOVED_BY_SOMEONE_ELSE);
    return current == null ? Commit.ALERT_DELETED : Commit.POSITION_MOVED_BY_SOMEONE_ELSE;
  }

  private EventSubscriptionOffset positionAt(long offset) {
    return new EventSubscriptionOffset()
        .withCurrentOffset(offset)
        .withStartingOffset(position.getStartingOffset())
        .withStartingTimestamp(position.getStartingTimestamp())
        .withTimestamp(System.currentTimeMillis());
  }

  private void commitCounters() {
    boolean written = totalEvents + successEvents + failedEvents == 0 || addToCounters();
    if (!written && !addToCounters()) {
      LOG.warn("Alert {} gave up adding this tick to its counters after a retry", alertId);
      AlertTelemetry.absorbed(AlertTelemetry.COUNTERS_GIVEN_UP);
    }
  }

  private boolean addToCounters() {
    String stored = dao().getSubscriberExtension(alertId, LedgerKeys.COUNTERS);
    AlertMetrics before =
        stored == null
            ? new AlertMetrics().withTotalEvents(0).withSuccessEvents(0).withFailedEvents(0)
            : JsonUtils.readValue(stored, AlertMetrics.class);
    String after =
        JsonUtils.pojoToJson(
            new AlertMetrics()
                .withTotalEvents(before.getTotalEvents() + totalEvents)
                .withSuccessEvents(before.getSuccessEvents() + successEvents)
                .withFailedEvents(before.getFailedEvents() + failedEvents)
                .withTimestamp(System.currentTimeMillis()));
    int rows =
        stored == null
            ? dao()
                .insertSubscriberExtensionIfAbsent(
                    alertId, LedgerKeys.COUNTERS, LedgerKeys.COUNTERS_SCHEMA, after)
            : dao().compareAndSetSubscriberExtension(alertId, LedgerKeys.COUNTERS, after, stored);
    return rows == 1;
  }

  // The messages already went out. Losing a diagnostic row is better than sending them again.
  private void writeBestEffort(boolean positionIsOurs) {
    attempt("delivered rows", this::writeDelivered);
    attempt("failure rows", this::writeFailures);
    attempt("health", this::writeHealth);
    attempt("gap wait", () -> writeGapWait(positionIsOurs));
  }

  private void attempt(String what, Runnable write) {
    try {
      write.run();
    } catch (RuntimeException e) {
      LOG.error("Alert {} could not record its {}", alertId, what, e);
      AlertTelemetry.absorbed(AlertTelemetry.DIAGNOSTIC_WRITE_FAILED);
    }
  }

  private void writeDelivered() {
    if (!delivered.isEmpty()) {
      long now = System.currentTimeMillis();
      List<String> eventIds = delivered.stream().map(e -> e.getId().toString()).toList();
      List<String> alertIds = delivered.stream().map(e -> alertId).toList();
      List<String> json = delivered.stream().map(JsonUtils::pojoToJson).toList();
      List<Long> times = delivered.stream().map(e -> now).toList();
      dao().batchUpsertSuccessfulChangeEvents(eventIds, alertIds, json, times);
    }
  }

  private void writeFailures() {
    failures.forEach(row -> dao().upsertFailedEvent(alertId, row.key(), row.json(), row.source()));
  }

  private void writeHealth() {
    if (!statusThisTick.isEmpty()) {
      statusThisTick.forEach(
          (destinationId, status) ->
              health
                  .getDestinations()
                  .put(
                      destinationId,
                      HealthStreak.after(health.getDestinations().get(destinationId), status)));
      health.withTimestamp(System.currentTimeMillis());
      dao()
          .upsertSubscriberExtension(
              alertId, LedgerKeys.HEALTH, LedgerKeys.HEALTH_SCHEMA, JsonUtils.pojoToJson(health));
    }
  }

  // A position someone else moved has a gap of its own to measure, if any.
  private void writeGapWait(boolean positionIsOurs) {
    if (gapSince == 0L || !positionIsOurs) {
      if (gapWaitAtOpen != null) {
        dao().deleteSubscriberExtension(alertId, LedgerKeys.GAP_WAIT);
      }
    } else if (gapSince != gapWaitSince()) {
      AlertGapWait wait =
          new AlertGapWait()
              .withAtOffset(position.getCurrentOffset())
              .withSince(gapSince)
              .withTimestamp(System.currentTimeMillis());
      dao()
          .upsertSubscriberExtension(
              alertId, LedgerKeys.GAP_WAIT, LedgerKeys.GAP_WAIT_SCHEMA, JsonUtils.pojoToJson(wait));
    }
  }

  private void forgetWhatWasWritten() {
    totalEvents = 0;
    successEvents = 0;
    failedEvents = 0;
    statusThisTick.clear();
    delivered.clear();
    failures.clear();
  }

  private static <T> T read(Map<String, String> rows, String key, Class<T> type) {
    String json = rows.get(key);
    return json == null ? null : JsonUtils.readValue(json, type);
  }

  private static EventSubscriptionDAO dao() {
    return Entity.getCollectionDAO().eventSubscriptionDAO();
  }

  /** For tests and diagnostics: the rows of an alert, keyed as they are stored. */
  static Map<String, String> rowsOf(String alertId) {
    Map<String, String> rows = new LinkedHashMap<>();
    dao().listSubscriberExtensions(alertId).forEach(row -> rows.put(row.extension(), row.json()));
    return rows;
  }
}
