package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.FailedEventResponse;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.jdbi3.AccessControlDAOs.EventResponseMapper;
import org.openmetadata.service.jdbi3.AccessControlDAOs.FailedEventResponseMapper;
import org.openmetadata.service.resources.events.subscription.TypedEvent;

/**
 * A stored payload can name an EventType this build no longer declares (#29039). These mappers back
 * the listEvents, failedEvents and listAllFailedEvents endpoints, so one such row must not fail the
 * whole page.
 */
class AccessControlDAOsMapperTest {
  private static final String RETIRED_EVENT_TYPE = "taskResolved";

  private static String changeEventJson(String eventType) {
    return """
        {"id":"%s","eventType":"%s","entityType":"glossaryTerm","userName":"admin",\
"timestamp":1700000000000}"""
        .formatted(UUID.randomUUID(), eventType);
  }

  private static String failedEventJson(String eventType) {
    return """
        {"failingSubscriptionId":"%s","reason":"boom","timestamp":1700000000000,"changeEvent":%s}"""
        .formatted(UUID.randomUUID(), changeEventJson(eventType));
  }

  private static ResultSet failedEventRow(String json) throws SQLException {
    ResultSet rs = mock(ResultSet.class);
    when(rs.getString("json")).thenReturn(json);
    when(rs.getString("source")).thenReturn("webhook");
    return rs;
  }

  private static ResultSet typedEventRow(String json, String status) throws SQLException {
    ResultSet rs = mock(ResultSet.class);
    when(rs.getString("json")).thenReturn(json);
    when(rs.getString("status")).thenReturn(status);
    when(rs.getLong("timestamp")).thenReturn(1700000000000L);
    return rs;
  }

  @Test
  @DisplayName("A readable failed event keeps every field")
  void failedEventMapperReadsAValidRow() throws SQLException {
    FailedEventResponse response =
        new FailedEventResponseMapper().map(failedEventRow(failedEventJson("entityCreated")), null);

    assertEquals("webhook", response.getSource());
    assertEquals("boom", response.getReason());
    assertNotNull(response.getFailingSubscriptionId());
    assertNotNull(response.getChangeEvent());
  }

  @Test
  @DisplayName("A failed event naming a retired event type still yields a row")
  void failedEventMapperDegradesOnARetiredEventType() throws SQLException {
    FailedEventResponse response =
        new FailedEventResponseMapper()
            .map(failedEventRow(failedEventJson(RETIRED_EVENT_TYPE)), null);

    // the column survives, the unreadable payload does not
    assertEquals("webhook", response.getSource());
    assertNull(response.getChangeEvent());
    assertNull(response.getReason());
  }

  @Test
  @DisplayName("A readable successful event carries its change event")
  void typedEventMapperReadsAValidSuccessfulRow() throws SQLException {
    TypedEvent response =
        new EventResponseMapper()
            .map(typedEventRow(changeEventJson("entityCreated"), "successful"), null);

    assertEquals(TypedEvent.Status.SUCCESSFUL, response.getStatus());
    assertEquals(1, response.getData().size());
    assertTrue(response.getData().get(0) instanceof ChangeEvent);
  }

  @Test
  @DisplayName("A successful event naming a retired event type keeps its status and timestamp")
  void typedEventMapperDegradesOnARetiredEventType() throws SQLException {
    TypedEvent response =
        new EventResponseMapper()
            .map(typedEventRow(changeEventJson(RETIRED_EVENT_TYPE), "successful"), null);

    assertEquals(TypedEvent.Status.SUCCESSFUL, response.getStatus());
    assertEquals(1700000000000.0, response.getTimestamp());
    assertTrue(response.getData().isEmpty());
  }

  @Test
  @DisplayName("A failed event naming a retired event type keeps its status and timestamp")
  void typedEventMapperDegradesOnARetiredEventTypeInTheFailedBranch() throws SQLException {
    TypedEvent response =
        new EventResponseMapper()
            .map(typedEventRow(failedEventJson(RETIRED_EVENT_TYPE), "failed"), null);

    assertEquals(TypedEvent.Status.FAILED, response.getStatus());
    assertEquals(1700000000000.0, response.getTimestamp());
    assertTrue(response.getData().isEmpty());
  }
}
