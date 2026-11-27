package org.openmetadata.service.events.consumer.ledger;

import com.google.common.collect.Lists;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.AlertHealth;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO.AlertExtension;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO.SubscriberExtension;

/**
 * The record plane's entry point: everything an alert's runs leave behind lives in rows, and this
 * is where those rows are created, opened for a tick, and removed with their alert.
 */
@Slf4j
public final class AlertRecord {
  private static final int HEALTH_READ_BATCH = 500;

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
    insertIfAbsent(alertId, LedgerKeys.HEALTH, LedgerKeys.HEALTH_SCHEMA, initialHealth(now));
  }

  /**
   * The destination health of each alert, by alert id, read in one query per few hundred alerts.
   * An alert with no position row reads as having none, as {@link #open} does.
   */
  public static Map<UUID, Map<String, DestinationHealth>> healthOf(List<UUID> alertIds) {
    Map<UUID, Map<String, DestinationHealth>> health = new HashMap<>();
    for (List<UUID> chunk : Lists.partition(alertIds, HEALTH_READ_BATCH)) {
      List<AlertExtension> rows =
          dao()
              .listAlertsExtensions(
                  chunk.stream().map(UUID::toString).toList(),
                  List.of(LedgerKeys.POSITION, LedgerKeys.HEALTH));
      Map<String, Map<String, String>> byAlert = new HashMap<>();
      rows.forEach(
          row ->
              byAlert
                  .computeIfAbsent(row.id(), id -> new HashMap<>())
                  .put(row.extension(), row.json()));
      byAlert.entrySet().stream()
          .filter(alert -> isScheduled(alert.getValue()))
          .filter(alert -> alert.getValue().containsKey(LedgerKeys.HEALTH))
          .forEach(
              alert ->
                  health.put(
                      UUID.fromString(alert.getKey()),
                      destinationsOf(alert.getValue().get(LedgerKeys.HEALTH))));
    }
    return health;
  }

  private static Map<String, DestinationHealth> destinationsOf(String healthJson) {
    Map<String, DestinationHealth> destinations =
        JsonUtils.readValue(healthJson, AlertHealth.class).getDestinations();
    return destinations == null ? Map.of() : destinations;
  }

  /** Empty when the alert has no position row, which means it was never scheduled or is gone. */
  public static Optional<AlertLedger> open(EventSubscription alert) {
    Map<String, String> rows = new LinkedHashMap<>();
    for (SubscriberExtension row : dao().listSubscriberExtensions(alert.getId().toString())) {
      rows.put(row.extension(), row.json());
    }
    return isScheduled(rows) ? Optional.of(new AlertLedger(alert, rows)) : Optional.empty();
  }

  // An alert with no position row was never scheduled, or is gone: nothing it holds speaks.
  private static boolean isScheduled(Map<String, String> rows) {
    return rows.containsKey(LedgerKeys.POSITION);
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

  /** Read only. What the alert's ticks counted, zero while none has counted anything. */
  public static AlertMetrics counters(UUID alertId) {
    return countersIn(dao().getSubscriberExtension(alertId.toString(), LedgerKeys.COUNTERS));
  }

  static AlertMetrics countersIn(String stored) {
    return stored == null
        ? new AlertMetrics().withTotalEvents(0).withSuccessEvents(0).withFailedEvents(0)
        : JsonUtils.readValue(stored, AlertMetrics.class);
  }

  /** Every id with rows under the ledger's own keys, as stored, including any that name no alert. */
  public static List<String> alertIdsWithRows() {
    return dao().listIdsHavingExtensions(LedgerKeys.all());
  }

  public static boolean hasRows(UUID alertId) {
    return dao().listSubscriberExtensions(alertId.toString()).stream()
        .anyMatch(row -> LedgerKeys.all().contains(row.extension()));
  }

  // Health holds only what ticks reported: nothing before the first one.
  static AlertHealth initialHealth(long now) {
    return new AlertHealth().withDestinations(new LinkedHashMap<>()).withTimestamp(now);
  }

  private static void insertIfAbsent(String alertId, String key, String schema, Object document) {
    dao().insertSubscriberExtensionIfAbsent(alertId, key, schema, JsonUtils.pojoToJson(document));
  }

  private static EventSubscriptionDAO dao() {
    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    return collectionDAO.eventSubscriptionDAO();
  }
}
