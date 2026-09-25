package org.openmetadata.service.events.subscription.ledger;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.AlertHealth;
import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO.SubscriberExtension;

/**
 * The record plane's entry point: everything an alert's runs leave behind lives in rows, and this
 * is where those rows are created, opened for a tick, and removed with their alert.
 */
@Slf4j
public final class AlertRecord {

  private AlertRecord() {}

  /** Creates the position and health rows of an alert that is being scheduled, if absent. */
  public static void start(EventSubscription alert) {
    long now = System.currentTimeMillis();
    String alertId = alert.getId().toString();
    long latestOffset = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    EventSubscriptionOffset position =
        new EventSubscriptionOffset()
            .withCurrentOffset(latestOffset)
            .withStartingOffset(latestOffset)
            .withStartingTimestamp(now)
            .withTimestamp(now);
    insertIfAbsent(alertId, LedgerKeys.POSITION, LedgerKeys.POSITION_SCHEMA, position);
    insertIfAbsent(alertId, LedgerKeys.HEALTH, LedgerKeys.HEALTH_SCHEMA, initialHealth(alert, now));
  }

  /** Empty when the alert has no position row, which means it was never scheduled or is gone. */
  public static Optional<AlertLedger> open(EventSubscription alert) {
    Map<String, String> rows = new LinkedHashMap<>();
    for (SubscriberExtension row : dao().listSubscriberExtensions(alert.getId().toString())) {
      rows.put(row.extension(), row.json());
    }
    return rows.containsKey(LedgerKeys.POSITION)
        ? Optional.of(new AlertLedger(alert, rows))
        : Optional.empty();
  }

  /**
   * Moves the position and the watermark to now, unconditionally. A tick running at this moment
   * loses its compare-and-set and keeps the skip.
   */
  public static EventSubscriptionOffset skipBacklog(UUID alertId) {
    long now = System.currentTimeMillis();
    long latestOffset = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    EventSubscriptionOffset skipped =
        new EventSubscriptionOffset()
            .withCurrentOffset(latestOffset)
            .withStartingOffset(latestOffset)
            .withStartingTimestamp(now)
            .withTimestamp(now);
    dao()
        .upsertSubscriberExtension(
            alertId.toString(),
            LedgerKeys.POSITION,
            LedgerKeys.POSITION_SCHEMA,
            JsonUtils.pojoToJson(skipped));
    dao().deleteSubscriberExtension(alertId.toString(), LedgerKeys.GAP_WAIT);
    return skipped;
  }

  /** Removes every row of a deleted alert, whatever path the delete took. */
  public static void forget(UUID alertId) {
    String id = alertId.toString();
    dao().deleteAlertMetrics(id);
    dao().deleteSuccessfulChangeEventBySubscriptionId(id);
    dao().deleteFailedRecordsBySubscriptionId(id);
  }

  /** Read only. An alert that has never been scheduled reads as standing at the latest offset. */
  public static EventSubscriptionOffset positionOrLatest(UUID alertId) {
    String stored = dao().getSubscriberExtension(alertId.toString(), LedgerKeys.POSITION);
    long latest = stored == null ? Entity.getCollectionDAO().changeEventDAO().getLatestOffset() : 0;
    return stored != null
        ? JsonUtils.readValue(stored, EventSubscriptionOffset.class)
        : new EventSubscriptionOffset().withCurrentOffset(latest).withStartingOffset(latest);
  }

  public static List<String> alertIdsWithRows() {
    return dao().listIdsHavingExtensions(LedgerKeys.all());
  }

  static AlertHealth initialHealth(EventSubscription alert, long now) {
    Map<String, DestinationHealth> destinations = new LinkedHashMap<>();
    for (SubscriptionDestination destination : listOrEmpty(alert.getDestinations())) {
      destinations.put(destination.getId().toString(), healthWithoutHistory(destination, now));
    }
    return new AlertHealth().withDestinations(destinations).withTimestamp(now);
  }

  /** What a destination reads before any tick has reported on it. */
  public static DestinationHealth healthWithoutHistory(
      SubscriptionDestination destination, long now) {
    SubscriptionStatus.Status status =
        Boolean.FALSE.equals(destination.getEnabled())
            ? SubscriptionStatus.Status.DISABLED
            : SubscriptionStatus.Status.ACTIVE;
    return new DestinationHealth()
        .withStatus(new SubscriptionStatus().withStatus(status).withTimestamp(now))
        .withConsecutiveFailedTicks(0);
  }

  private static void insertIfAbsent(String alertId, String key, String schema, Object document) {
    dao().insertSubscriberExtensionIfAbsent(alertId, key, schema, JsonUtils.pojoToJson(document));
  }

  private static EventSubscriptionDAO dao() {
    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    return collectionDAO.eventSubscriptionDAO();
  }
}
