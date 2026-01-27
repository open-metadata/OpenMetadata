package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationTest;

/**
 * Test class for CollectionDAO batch insert functionality, specifically testing the
 * batchUpsertSuccessfulChangeEvents method to ensure batch inserts work correctly for both MySQL
 * and PostgreSQL databases.
 */
class CollectionDAOBatchInsertTest extends OpenMetadataApplicationTest {

  private static final String POSTGRESQL = "PostgreSQL";
  private static final String MYSQL = "MySQL";

  private CollectionDAO.EventSubscriptionDAO eventSubscriptionDAO;
  private Handle handle;
  private String testSubscriptionId;

  @BeforeEach
  void setUp() {
    handle = jdbi.open();
    CollectionDAO collectionDAO = handle.attach(CollectionDAO.class);
    eventSubscriptionDAO = collectionDAO.eventSubscriptionDAO();
    testSubscriptionId = UUID.randomUUID().toString();
  }

  @AfterEach
  void tearDown() {
    if (handle != null && testSubscriptionId != null) {
      try {
        handle.execute(
            "DELETE FROM successful_sent_change_events WHERE event_subscription_id = ?",
            testSubscriptionId);
      } catch (Exception e) {
        System.err.println("Warning: Failed to clean up test data: " + e.getMessage());
      } finally {
        handle.close();
      }
    }
  }

  @Test
  void testBatchInsertSuccessfulEvents_SingleEvent() {
    String changeEventId = UUID.randomUUID().toString();
    String json = createEventJson(changeEventId, "table", "test.table1");
    long timestamp = System.currentTimeMillis();

    eventSubscriptionDAO.batchUpsertSuccessfulChangeEvents(
        List.of(changeEventId), List.of(testSubscriptionId), List.of(json), List.of(timestamp));

    List<String> results =
        handle
            .createQuery(
                "SELECT json FROM successful_sent_change_events WHERE event_subscription_id = ?")
            .bind(0, testSubscriptionId)
            .mapTo(String.class)
            .list();

    assertEquals(1, results.size(), "Should insert one event");
    assertTrue(results.get(0).contains("test.table1"), "JSON should contain entity name");
  }

  @Test
  void testBatchInsertSuccessfulEvents_MultipleEvents() {
    List<String> changeEventIds = new ArrayList<>();
    List<String> subscriptionIds = new ArrayList<>();
    List<String> jsonList = new ArrayList<>();
    List<Long> timestamps = new ArrayList<>();

    long baseTimestamp = System.currentTimeMillis();

    for (int i = 0; i < 10; i++) {
      String eventId = UUID.randomUUID().toString();
      changeEventIds.add(eventId);
      subscriptionIds.add(testSubscriptionId);
      jsonList.add(createEventJson(eventId, "table", "test.table" + i));
      timestamps.add(baseTimestamp + i);
    }

    eventSubscriptionDAO.batchUpsertSuccessfulChangeEvents(
        changeEventIds, subscriptionIds, jsonList, timestamps);

    Long count =
        handle
            .createQuery(
                "SELECT COUNT(*) FROM successful_sent_change_events WHERE event_subscription_id = ?")
            .bind(0, testSubscriptionId)
            .mapTo(Long.class)
            .one();

    assertEquals(10, count, "Should insert all 10 events");
  }

  @Test
  void testBatchInsertSuccessfulEvents_UpsertBehavior() {
    String changeEventId = UUID.randomUUID().toString();
    String initialJson = createEventJson(changeEventId, "table", "test.initial");
    String updatedJson = createEventJson(changeEventId, "table", "test.updated");
    long initialTimestamp = System.currentTimeMillis();
    long updatedTimestamp = initialTimestamp + 1000;

    eventSubscriptionDAO.batchUpsertSuccessfulChangeEvents(
        List.of(changeEventId),
        List.of(testSubscriptionId),
        List.of(initialJson),
        List.of(initialTimestamp));

    List<String> initialResults =
        handle
            .createQuery(
                "SELECT json FROM successful_sent_change_events WHERE change_event_id = ? AND event_subscription_id = ?")
            .bind(0, changeEventId)
            .bind(1, testSubscriptionId)
            .mapTo(String.class)
            .list();

    assertEquals(1, initialResults.size());
    assertTrue(initialResults.get(0).contains("test.initial"));

    eventSubscriptionDAO.batchUpsertSuccessfulChangeEvents(
        List.of(changeEventId),
        List.of(testSubscriptionId),
        List.of(updatedJson),
        List.of(updatedTimestamp));

    List<String> updatedResults =
        handle
            .createQuery(
                "SELECT json FROM successful_sent_change_events WHERE change_event_id = ? AND event_subscription_id = ?")
            .bind(0, changeEventId)
            .bind(1, testSubscriptionId)
            .mapTo(String.class)
            .list();

    assertEquals(1, updatedResults.size(), "Should still be only one record after upsert");
    assertTrue(updatedResults.get(0).contains("test.updated"), "JSON should be updated");
  }

  @Test
  void testBatchInsertSuccessfulEvents_LargeBatch() {
    List<String> changeEventIds = new ArrayList<>();
    List<String> subscriptionIds = new ArrayList<>();
    List<String> jsonList = new ArrayList<>();
    List<Long> timestamps = new ArrayList<>();

    long baseTimestamp = System.currentTimeMillis();
    int batchSize = 100;

    for (int i = 0; i < batchSize; i++) {
      String eventId = UUID.randomUUID().toString();
      changeEventIds.add(eventId);
      subscriptionIds.add(testSubscriptionId);
      jsonList.add(createEventJson(eventId, "table", "test.largebatch.table" + i));
      timestamps.add(baseTimestamp + i);
    }

    long startTime = System.currentTimeMillis();
    eventSubscriptionDAO.batchUpsertSuccessfulChangeEvents(
        changeEventIds, subscriptionIds, jsonList, timestamps);
    long endTime = System.currentTimeMillis();

    Long count =
        handle
            .createQuery(
                "SELECT COUNT(*) FROM successful_sent_change_events WHERE event_subscription_id = ?")
            .bind(0, testSubscriptionId)
            .mapTo(Long.class)
            .one();

    assertEquals(batchSize, count, "Should insert all events in large batch");
    System.out.println(
        "Batch insert of " + batchSize + " events took " + (endTime - startTime) + "ms");
  }

  @Test
  void testBatchInsertSuccessfulEvents_DifferentSubscriptions() {
    String subscriptionId2 = UUID.randomUUID().toString();

    List<String> changeEventIds = new ArrayList<>();
    List<String> subscriptionIds = new ArrayList<>();
    List<String> jsonList = new ArrayList<>();
    List<Long> timestamps = new ArrayList<>();

    long timestamp = System.currentTimeMillis();

    String eventId1 = UUID.randomUUID().toString();
    changeEventIds.add(eventId1);
    subscriptionIds.add(testSubscriptionId);
    jsonList.add(createEventJson(eventId1, "table", "test.sub1.table"));
    timestamps.add(timestamp);

    String eventId2 = UUID.randomUUID().toString();
    changeEventIds.add(eventId2);
    subscriptionIds.add(subscriptionId2);
    jsonList.add(createEventJson(eventId2, "table", "test.sub2.table"));
    timestamps.add(timestamp + 1);

    try {
      eventSubscriptionDAO.batchUpsertSuccessfulChangeEvents(
          changeEventIds, subscriptionIds, jsonList, timestamps);

      Long count1 =
          handle
              .createQuery(
                  "SELECT COUNT(*) FROM successful_sent_change_events WHERE event_subscription_id = ?")
              .bind(0, testSubscriptionId)
              .mapTo(Long.class)
              .one();

      Long count2 =
          handle
              .createQuery(
                  "SELECT COUNT(*) FROM successful_sent_change_events WHERE event_subscription_id = ?")
              .bind(0, subscriptionId2)
              .mapTo(Long.class)
              .one();

      assertEquals(1, count1, "Should insert one event for first subscription");
      assertEquals(1, count2, "Should insert one event for second subscription");
    } finally {
      handle.execute(
          "DELETE FROM successful_sent_change_events WHERE event_subscription_id = ?",
          subscriptionId2);
    }
  }

  private String createEventJson(String eventId, String entityType, String entityFqn) {
    return String.format(
        "{\"id\": \"%s\", \"entityType\": \"%s\", \"entityFullyQualifiedName\": \"%s\", \"timestamp\": %d}",
        eventId, entityType, entityFqn, System.currentTimeMillis());
  }
}
