package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.resources.events.subscription.TypedEvent;
import org.openmetadata.service.OpenMetadataApplicationTest;

/**
 * Test class for CollectionDAO event ordering functionality, specifically testing the
 * listAllEventsWithStatuses method to ensure events are returned in correct chronological order
 * (newest first) for both MySQL and PostgreSQL databases.
 */
class CollectionDAOEventOrderingTest extends OpenMetadataApplicationTest {

  private CollectionDAO collectionDAO;
  private Handle handle;
  private String testSubscriptionId;

  @BeforeEach
  void setUp() {
    handle = jdbi.open();
    collectionDAO = handle.attach(CollectionDAO.class);
    testSubscriptionId = UUID.randomUUID().toString();
  }

  @AfterEach
  void tearDown() {
    // Clean up test data
    if (handle != null && testSubscriptionId != null) {
      try {
        // Clean up consumers_dlq table
        handle.execute("DELETE FROM consumers_dlq WHERE id = ?", testSubscriptionId);
        // Clean up successful_sent_change_events table
        handle.execute("DELETE FROM successful_sent_change_events WHERE event_subscription_id = ?", testSubscriptionId);
      } catch (Exception e) {
        // Log but don't fail test on cleanup issues
        System.err.println("Warning: Failed to clean up test data: " + e.getMessage());
      } finally {
        handle.close();
      }
    }
  }

  @Test
  void testListAllEventsWithStatuses_EventOrderingDescending() {
    // Setup: Insert test events with different timestamps
    long baseTimestamp = System.currentTimeMillis();
    
    // Insert failed events in consumers_dlq (older events)
    String failedEvent1Json = createFailedEventJson("test-entity-1", baseTimestamp - 3000);
    String failedEvent2Json = createFailedEventJson("test-entity-2", baseTimestamp - 2000);
    
    // Insert successful events (newer events)
    String successEvent1Json = createSuccessfulEventJson("test-entity-3", baseTimestamp - 1000);
    String successEvent2Json = createSuccessfulEventJson("test-entity-4", baseTimestamp);
    
    insertFailedEvent(testSubscriptionId, failedEvent1Json, baseTimestamp - 3000);
    insertFailedEvent(testSubscriptionId, failedEvent2Json, baseTimestamp - 2000);
    insertSuccessfulEvent(testSubscriptionId, successEvent1Json, baseTimestamp - 1000);
    insertSuccessfulEvent(testSubscriptionId, successEvent2Json, baseTimestamp);

    // Test: Get events and verify ordering
    List<TypedEvent> events = collectionDAO.listAllEventsWithStatuses(testSubscriptionId, 10, 0);

    // Assertions: Events should be in descending timestamp order (newest first)
    assertNotNull(events, "Events list should not be null");
    assertEquals(4, events.size(), "Should return all 4 events");
    
    // Verify chronological order (newest to oldest)
    assertTrue(events.get(0).getTimestamp() >= events.get(1).getTimestamp(), 
        "First event should be newest");
    assertTrue(events.get(1).getTimestamp() >= events.get(2).getTimestamp(), 
        "Second event should be newer than third");
    assertTrue(events.get(2).getTimestamp() >= events.get(3).getTimestamp(), 
        "Third event should be newer than fourth");
    
    // Verify newest event is the success event we just inserted
    assertEquals((double) baseTimestamp, events.get(0).getTimestamp(), 
        "Newest event should have latest timestamp");
    assertEquals(TypedEvent.Status.SUCCESSFUL, events.get(0).getStatus(), 
        "Newest event should be successful");
    
    // Verify oldest event is the first failed event
    assertEquals((double) (baseTimestamp - 3000), events.get(3).getTimestamp(), 
        "Oldest event should have earliest timestamp");
    assertEquals(TypedEvent.Status.FAILED, events.get(3).getStatus(), 
        "Oldest event should be failed");
  }

  @Test
  void testListAllEventsWithStatuses_PaginationWithOrdering() {
    // Setup: Insert 5 events with incrementing timestamps
    long baseTimestamp = System.currentTimeMillis();
    
    for (int i = 0; i < 5; i++) {
      String eventJson = createSuccessfulEventJson("entity-" + i, baseTimestamp + (i * 1000));
      insertSuccessfulEvent(testSubscriptionId, eventJson, baseTimestamp + (i * 1000));
    }

    // Test: Get first 3 events
    List<TypedEvent> firstPage = collectionDAO.listAllEventsWithStatuses(testSubscriptionId, 3, 0);
    
    // Test: Get next 2 events
    List<TypedEvent> secondPage = collectionDAO.listAllEventsWithStatuses(testSubscriptionId, 3, 3);

    // Assertions
    assertEquals(3, firstPage.size(), "First page should have 3 events");
    assertEquals(2, secondPage.size(), "Second page should have 2 events");
    
    // Verify first page has newest events
    assertEquals((double) (baseTimestamp + 4000), firstPage.get(0).getTimestamp(), 
        "First page should start with newest event");
    assertEquals((double) (baseTimestamp + 2000), firstPage.get(2).getTimestamp(), 
        "First page should end with third newest event");
    
    // Verify second page has older events
    assertEquals((double) (baseTimestamp + 1000), secondPage.get(0).getTimestamp(), 
        "Second page should start with fourth newest event");
    assertEquals((double) baseTimestamp, secondPage.get(1).getTimestamp(), 
        "Second page should end with oldest event");
  }

  @Test
  void testListAllEventsWithStatuses_EmptyResult() {
    // Test with non-existent subscription ID
    String nonExistentId = UUID.randomUUID().toString();
    
    List<TypedEvent> events = collectionDAO.listAllEventsWithStatuses(nonExistentId, 10, 0);
    
    assertNotNull(events, "Events list should not be null even for non-existent subscription");
    assertTrue(events.isEmpty(), "Should return empty list for non-existent subscription");
  }

  @Test
  void testListAllEventsWithStatuses_MySQLPostgreSQLConsistency() {
    // This test verifies that both MySQL and PostgreSQL return events in the same order
    // The fix ensures both use ORDER BY timestamp DESC
    
    long baseTimestamp = System.currentTimeMillis();
    
    // Insert events with specific timestamps
    insertFailedEvent(testSubscriptionId, createFailedEventJson("mysql-test", baseTimestamp - 1000), baseTimestamp - 1000);
    insertSuccessfulEvent(testSubscriptionId, createSuccessfulEventJson("postgres-test", baseTimestamp), baseTimestamp);

    List<TypedEvent> events = collectionDAO.listAllEventsWithStatuses(testSubscriptionId, 10, 0);

    assertEquals(2, events.size(), "Should return both events");
    // Newest first - success event should come first
    assertEquals(TypedEvent.Status.SUCCESSFUL, events.get(0).getStatus(), "Newest event should be success");
    assertEquals(TypedEvent.Status.FAILED, events.get(1).getStatus(), "Older event should be failed");
    assertEquals((double) baseTimestamp, events.get(0).getTimestamp(), "Success event should have newer timestamp");
    assertEquals((double) (baseTimestamp - 1000), events.get(1).getTimestamp(), "Failed event should have older timestamp");
  }

  private String createFailedEventJson(String entityName, long timestamp) {
    return String.format(
        "{\\"failingSubscriptionId\\": \\"%s\\", \\"timestamp\\": %d, \\"reason\\": \\"Test failure for %s\\", \\"changeEvent\\": {\\"id\\": \\"%s\\", \\"entityType\\": \\"table\\", \\"entityFullyQualifiedName\\": \\"%s\\", \\"timestamp\\": %d}}",
        testSubscriptionId, timestamp, entityName, UUID.randomUUID().toString(), entityName, timestamp);
  }

  private String createSuccessfulEventJson(String entityName, long timestamp) {
    return String.format(
        "{\\"id\\": \\"%s\\", \\"entityType\\": \\"table\\", \\"entityFullyQualifiedName\\": \\"%s\\", \\"timestamp\\": %d}",
        UUID.randomUUID().toString(), entityName, timestamp);
  }

  private void insertFailedEvent(String subscriptionId, String json, long timestamp) {
    handle.execute(
        "INSERT INTO consumers_dlq (id, extension, json, source) VALUES (?, ?, ?, ?)",
        subscriptionId, "failed-event", json, "test-source");
  }

  private void insertSuccessfulEvent(String subscriptionId, String json, long timestamp) {
    String changeEventId = UUID.randomUUID().toString();
    handle.execute(
        "INSERT INTO successful_sent_change_events (change_event_id, event_subscription_id, json, timestamp) VALUES (?, ?, ?, ?)",
        changeEventId, subscriptionId, json, timestamp);
  }
}