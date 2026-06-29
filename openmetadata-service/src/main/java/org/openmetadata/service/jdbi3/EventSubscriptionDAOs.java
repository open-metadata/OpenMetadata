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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatch;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

public interface EventSubscriptionDAOs {
  @CreateSqlObject
  EventSubscriptionDAO eventSubscriptionDAO();

  @CreateSqlObject
  NotificationTemplateDAO notificationTemplateDAO();

  interface EventSubscriptionDAO extends EntityDAO<EventSubscription> {
    @Override
    default String getTableName() {
      return "event_subscription_entity";
    }

    @Override
    default Class<EventSubscription> getEntityClass() {
      return EventSubscription.class;
    }

    @SqlQuery("SELECT json FROM event_subscription_entity")
    List<String> listAllEventsSubscriptions();

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }

    @SqlQuery("SELECT json FROM change_event_consumers where id = :id AND extension = :extension")
    String getSubscriberExtension(@Bind("id") String id, @Bind("extension") String extension);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_event_consumers(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, :json)"
                + "ON DUPLICATE KEY UPDATE json = :json, jsonSchema = :jsonSchema",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO change_event_consumers(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :jsonSchema, (:json :: jsonb)) ON CONFLICT (id, extension) "
                + "DO UPDATE SET json = EXCLUDED.json, jsonSchema = EXCLUDED.jsonSchema",
        connectionType = POSTGRES)
    void upsertSubscriberExtension(
        @Bind("id") String id,
        @Bind("extension") String extension,
        @Bind("jsonSchema") String jsonSchema,
        @Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO consumers_dlq(id, extension, json, source) "
                + "VALUES (:id, :extension, :json, :source) "
                + "ON DUPLICATE KEY UPDATE json = :json, source = :source",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO consumers_dlq(id, extension, json, source) "
                + "VALUES (:id, :extension, (:json :: jsonb), :source) "
                + "ON CONFLICT (id, extension) "
                + "DO UPDATE SET json = EXCLUDED.json, source = EXCLUDED.source",
        connectionType = POSTGRES)
    void upsertFailedEvent(
        @Bind("id") String id,
        @Bind("extension") String extension,
        @Bind("json") String json,
        @Bind("source") String source);

    // Batch insert for successful events - reduces connection pool contention
    // from N connections to 1 when processing multiple events.
    // Deduplicates by (change_event_id, event_subscription_id) first: the primary key has no
    // destination dimension, and Postgres rejects a rewritten multi-row INSERT whose own rows
    // conflict on the arbiter key ("ON CONFLICT DO UPDATE command cannot affect row a second
    // time").
    default void batchUpsertSuccessfulChangeEvents(
        List<String> changeEventIds,
        List<String> eventSubscriptionIds,
        List<String> jsonList,
        List<Long> timestamps) {
      List<Integer> keep = distinctLastIndexes(changeEventIds, eventSubscriptionIds);
      if (keep.size() == changeEventIds.size()) {
        batchUpsertSuccessfulChangeEventsInternal(
            changeEventIds, eventSubscriptionIds, jsonList, timestamps);
      } else {
        batchUpsertSuccessfulChangeEventsInternal(
            pickByIndex(changeEventIds, keep),
            pickByIndex(eventSubscriptionIds, keep),
            pickByIndex(jsonList, keep),
            pickByIndex(timestamps, keep));
      }
    }

    static List<Integer> distinctLastIndexes(
        List<String> changeEventIds, List<String> eventSubscriptionIds) {
      LinkedHashMap<String, Integer> lastIndexByKey = new LinkedHashMap<>();
      for (int i = 0; i < changeEventIds.size(); i++) {
        lastIndexByKey.put(changeEventIds.get(i) + "|" + eventSubscriptionIds.get(i), i);
      }
      return new ArrayList<>(lastIndexByKey.values());
    }

    static <T> List<T> pickByIndex(List<T> source, List<Integer> indexes) {
      List<T> result = new ArrayList<>(indexes.size());
      for (int index : indexes) {
        result.add(source.get(index));
      }
      return result;
    }

    // Batch insert for successful events - reduces connection pool contention
    // from N connections to 1 when processing multiple events
    @Transaction
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO successful_sent_change_events (change_event_id, event_subscription_id, json, timestamp) "
                + "VALUES (:change_event_id, :event_subscription_id, :json, :timestamp) "
                + "ON DUPLICATE KEY UPDATE json = VALUES(json), timestamp = VALUES(timestamp)",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value =
            "INSERT INTO successful_sent_change_events (change_event_id, event_subscription_id, json, timestamp) "
                + "VALUES (:change_event_id, :event_subscription_id, CAST(:json AS jsonb), :timestamp) "
                + "ON CONFLICT (change_event_id, event_subscription_id) "
                + "DO UPDATE SET json = EXCLUDED.json, timestamp = EXCLUDED.timestamp",
        connectionType = POSTGRES)
    void batchUpsertSuccessfulChangeEventsInternal(
        @Bind("change_event_id") List<String> changeEventIds,
        @Bind("event_subscription_id") List<String> eventSubscriptionIds,
        @Bind("json") List<String> jsonList,
        @Bind("timestamp") List<Long> timestamps);

    @SqlQuery(
        "SELECT COUNT(*) FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId")
    long getSuccessfulRecordCount(@Bind("eventSubscriptionId") String eventSubscriptionId);

    @SqlQuery(
        "SELECT event_subscription_id FROM successful_sent_change_events "
            + "GROUP BY event_subscription_id "
            + "HAVING COUNT(*) >= :threshold")
    List<String> findSubscriptionsAboveThreshold(@Bind("threshold") int threshold);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId ORDER BY timestamp ASC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM successful_sent_change_events WHERE ctid IN (SELECT ctid FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId ORDER BY timestamp ASC LIMIT :limit)",
        connectionType = POSTGRES)
    void deleteOldRecords(
        @Bind("eventSubscriptionId") String eventSubscriptionId, @Bind("limit") long limit);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM successful_sent_change_events "
                + "WHERE timestamp < :cutoff ORDER BY timestamp LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM successful_sent_change_events "
                + "WHERE ctid IN ( "
                + "  SELECT ctid FROM successful_sent_change_events "
                + "  WHERE timestamp < :cutoff ORDER BY timestamp LIMIT :limit "
                + ")",
        connectionType = POSTGRES)
    int deleteSuccessfulSentChangeEventsInBatches(
        @Bind("cutoff") long cutoff, @Bind("limit") int limit);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM change_event "
                + "WHERE eventTime < :cutoff ORDER BY eventTime LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM change_event "
                + "WHERE ctid IN ( "
                + "  SELECT ctid FROM change_event "
                + "  WHERE eventTime < :cutoff ORDER BY eventTime LIMIT :limit "
                + ")",
        connectionType = POSTGRES)
    int deleteChangeEventsInBatches(@Bind("cutoff") long cutoff, @Bind("limit") int limit);

    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM consumers_dlq "
                + "WHERE timestamp < :cutoff ORDER BY timestamp LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "DELETE FROM consumers_dlq "
                + "WHERE ctid IN ( "
                + "  SELECT ctid FROM consumers_dlq "
                + "  WHERE timestamp < :cutoff ORDER BY timestamp LIMIT :limit "
                + ")",
        connectionType = POSTGRES)
    int deleteConsumersDlqInBatches(@Bind("cutoff") long cutoff, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT json FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    List<String> getSuccessfulChangeEventBySubscriptionId(
        @Bind("eventSubscriptionId") String eventSubscriptionId,
        @Bind("limit") int limit,
        @Bind("paginationOffset") long paginationOffset);

    @SqlUpdate(
        "DELETE FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId")
    void deleteSuccessfulChangeEventBySubscriptionId(
        @Bind("eventSubscriptionId") String eventSubscriptionId);

    @SqlUpdate("DELETE FROM consumers_dlq WHERE id = :eventSubscriptionId")
    void deleteFailedRecordsBySubscriptionId(
        @Bind("eventSubscriptionId") String eventSubscriptionId);

    @SqlUpdate("DELETE from change_event_consumers cec where id = :eventSubscriptionId;")
    void deleteAlertMetrics(@Bind("eventSubscriptionId") String eventSubscriptionId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM ( "
                + "    SELECT json, 'FAILED' AS status, timestamp "
                + "    FROM consumers_dlq WHERE id = :id "
                + "    UNION ALL "
                + "    SELECT json, 'SUCCESSFUL' AS status, timestamp "
                + "    FROM successful_sent_change_events WHERE event_subscription_id = :id "
                + ") AS combined_events",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT COUNT(*) FROM ( "
                + "    SELECT json, 'failed' AS status, timestamp "
                + "    FROM consumers_dlq WHERE id = :id "
                + "    UNION ALL "
                + "    SELECT json, 'successful' AS status, timestamp "
                + "    FROM successful_sent_change_events WHERE event_subscription_id = :id "
                + ") AS combined_events",
        connectionType = POSTGRES)
    int countAllEventsWithStatuses(@Bind("id") String id);

    @SqlQuery("SELECT COUNT(*) FROM consumers_dlq WHERE id = :id")
    int countFailedEventsById(@Bind("id") String id);

    @SqlQuery(
        "SELECT COUNT(*) FROM successful_sent_change_events WHERE event_subscription_id = :eventSubscriptionId")
    int countSuccessfulEventsBySubscriptionId(
        @Bind("eventSubscriptionId") String eventSubscriptionId);
  }

  interface NotificationTemplateDAO extends EntityDAO<NotificationTemplate> {
    @Override
    default String getTableName() {
      return "notification_template_entity";
    }

    @Override
    default Class<NotificationTemplate> getEntityClass() {
      return NotificationTemplate.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }
}
