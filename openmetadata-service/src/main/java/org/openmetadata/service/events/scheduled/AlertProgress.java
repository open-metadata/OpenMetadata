package org.openmetadata.service.events.scheduled;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.ConsumerKind;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.util.ChangeEventJsonUtils;

/**
 * What an alert has handled and what it has still to read, answered the way its consumer works. A
 * consumer that reads change events is counted by the rows its events leave, and the events after
 * its position are still to read. One that makes its own work is counted by what it reported, and
 * reads no change event: none is still to read, and it stands at the latest offset whatever its
 * position row says.
 */
sealed interface AlertProgress {

  /** Each event or piece of work once, so a partly delivered one is in both counts but handled once. */
  record Counts(long handled, long delivered, long failed) {}

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

  /** The unread change events the alert's rules let through. */
  long relevantUnreadCount();

  List<ChangeEvent> relevantUnread(int limit, int pageOffset);

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
    public long relevantUnreadCount() {
      return UnprocessedEvents.countMatching(currentOffset(), matchesRules());
    }

    @Override
    public List<ChangeEvent> relevantUnread(int limit, int pageOffset) {
      return UnprocessedEvents.matching(unreadRows(limit, pageOffset), matchesRules());
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

    private Predicate<ChangeEvent> matchesRules() {
      FilteringRules rules = alert.getFilteringRules();
      Long since = AlertUtil.alertingWatermark(alert, position.getStartingTimestamp());
      return event ->
          AlertUtil.isChangeEventAllowed(event, rules, since, AlertUtil.LOG_EVALUATION_ERROR);
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
    public long relevantUnreadCount() {
      return 0;
    }

    @Override
    public List<ChangeEvent> relevantUnread(int limit, int pageOffset) {
      return List.of();
    }

    @Override
    public List<ChangeEvent> allUnread(int limit, int pageOffset) {
      return List.of();
    }
  }
}
