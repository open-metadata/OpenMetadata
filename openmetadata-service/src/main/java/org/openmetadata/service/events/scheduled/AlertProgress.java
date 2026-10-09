package org.openmetadata.service.events.scheduled;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.ConsumerKind;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.util.ChangeEventJsonUtils;

/**
 * What an alert has handled and what it has still to read, answered the way its consumer works. A
 * consumer that reads change events is counted by the rows its events leave, and the events after
 * its position are still to read. One that makes its own work is counted by what it reported, and
 * reads no change event: none is still to read, and it stands at the latest offset whatever its
 * position row says.
 */
public sealed interface AlertProgress {

  /** Each event or piece of work once, so a partly delivered one is in both counts but handled once. */
  record Counts(long handled, long delivered, long failed) {}

  /** Which change events the alert lets through, given when it started alerting. */
  @FunctionalInterface
  interface Relevance {
    Predicate<ChangeEvent> since(EventSubscription alert, Long startingTimestamp);
  }

  static AlertProgress of(EventSubscription alert) {
    // The position first, so the latest offset, read after it, is never behind it.
    EventSubscriptionOffset position = AlertRecord.positionOrLatest(alert.getId());
    long latest = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    return ConsumerKind.of(alert).readsChangeEvents()
        ? new ReadsChangeEvents(alert, position, latest)
        : new MakesItsOwnWork(alert.getId(), position, latest);
  }

  Counts counts();

  long currentOffset();

  long startingOffset();

  long latestOffset();

  /** The unread change events the alert lets through. */
  long relevantUnreadCount(Relevance relevance);

  List<ChangeEvent> relevantUnread(int limit, int pageOffset, Relevance relevance);

  List<ChangeEvent> allUnread(int limit, int pageOffset);

  default long unread() {
    return Math.max(0, latestOffset() - currentOffset());
  }

  default boolean caughtUp() {
    return currentOffset() == latestOffset();
  }

  record ReadsChangeEvents(EventSubscription alert, EventSubscriptionOffset position, long latest)
      implements AlertProgress {

    @Override
    public Counts counts() {
      String id = alert.getId().toString();
      long delivered =
          Entity.getCollectionDAO().eventSubscriptionDAO().getSuccessfulRecordCount(id);
      long failed = Entity.getCollectionDAO().changeEventDAO().countFailedEvents(id);
      long countedTwice =
          Entity.getCollectionDAO().eventSubscriptionDAO().countEventsBothDeliveredAndFailed(id);
      return new Counts(delivered + failed - countedTwice, delivered, failed);
    }

    @Override
    public long currentOffset() {
      return position.getCurrentOffset();
    }

    @Override
    public long startingOffset() {
      return position.getStartingOffset();
    }

    @Override
    public long latestOffset() {
      return latest;
    }

    @Override
    public long relevantUnreadCount(Relevance relevance) {
      return UnprocessedEvents.countMatching(currentOffset(), relevant(relevance));
    }

    @Override
    public List<ChangeEvent> relevantUnread(int limit, int pageOffset, Relevance relevance) {
      return UnprocessedEvents.matching(unreadRows(limit, pageOffset), relevant(relevance));
    }

    @Override
    public List<ChangeEvent> allUnread(int limit, int pageOffset) {
      return unreadRows(limit, pageOffset).parallelStream()
          .map(json -> ChangeEventJsonUtils.readOrNull(json, ChangeEvent.class))
          .filter(Objects::nonNull)
          .toList();
    }

    private List<String> unreadRows(int limit, int pageOffset) {
      return Entity.getCollectionDAO()
          .changeEventDAO()
          .listUnprocessedEvents(currentOffset(), limit, pageOffset);
    }

    private Predicate<ChangeEvent> relevant(Relevance relevance) {
      return relevance.since(alert, position.getStartingTimestamp());
    }
  }

  record MakesItsOwnWork(UUID alertId, EventSubscriptionOffset position, long latest)
      implements AlertProgress {

    @Override
    public Counts counts() {
      AlertMetrics counters = AlertRecord.counters(alertId);
      return new Counts(
          counters.getTotalEvents(), counters.getSuccessEvents(), counters.getFailedEvents());
    }

    @Override
    public long currentOffset() {
      return latest;
    }

    @Override
    public long startingOffset() {
      return position.getStartingOffset();
    }

    @Override
    public long latestOffset() {
      return latest;
    }

    @Override
    public long relevantUnreadCount(Relevance relevance) {
      return 0;
    }

    @Override
    public List<ChangeEvent> relevantUnread(int limit, int pageOffset, Relevance relevance) {
      return List.of();
    }

    @Override
    public List<ChangeEvent> allUnread(int limit, int pageOffset) {
      return List.of();
    }
  }
}
