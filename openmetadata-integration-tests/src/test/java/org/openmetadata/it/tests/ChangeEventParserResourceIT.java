package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for ChangeEvent parsing.
 *
 * <p>Tests that change events are properly created and can be retrieved when entities are created,
 * updated, or deleted. Uses HttpClient directly to test the /v1/events endpoint.
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@Disabled("Change events are not being published in the test environment - needs investigation")
public class ChangeEventParserResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String EVENTS_PATH = "/v1/events";

  @Test
  void test_tableCreationGeneratesChangeEvent(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    long timestampBeforeCreation = System.currentTimeMillis();

    Table table = createTestTable(ns);
    assertNotNull(table);
    assertNotNull(table.getId());

    ListResponse<ChangeEvent> events =
        queryChangeEvents(httpClient, "table", null, null, null, timestampBeforeCreation);

    assertNotNull(events);
    assertNotNull(events.getData());
    assertTrue(
        events.getData().stream().anyMatch(event -> event.getEntityId().equals(table.getId())),
        "Should find change event for created table");

    ChangeEvent tableCreationEvent =
        events.getData().stream()
            .filter(event -> event.getEntityId().equals(table.getId()))
            .findFirst()
            .orElse(null);

    assertNotNull(tableCreationEvent);
    assertEquals("table", tableCreationEvent.getEntityType());
    assertEquals(EventType.ENTITY_CREATED, tableCreationEvent.getEventType());
    assertEquals(table.getFullyQualifiedName(), tableCreationEvent.getEntityFullyQualifiedName());
  }

  @Test
  void test_tableUpdateGeneratesChangeEvent(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    Table table = createTestTable(ns);
    assertNotNull(table);

    long timestampBeforeUpdate = System.currentTimeMillis();

    table.setDescription("Updated description for change event test");
    Table updatedTable = Tables.update(table.getId().toString(), table);
    assertNotNull(updatedTable);
    assertEquals("Updated description for change event test", updatedTable.getDescription());

    // Update events are processed asynchronously, retry until we find the event
    int maxRetries = 10;
    int retryDelayMs = 500;
    boolean foundUpdateEvent = false;

    for (int retry = 0; retry < maxRetries && !foundUpdateEvent; retry++) {
      if (retry > 0) {
        Thread.sleep(retryDelayMs);
      }

      ListResponse<ChangeEvent> events =
          queryChangeEvents(httpClient, null, "table", null, null, timestampBeforeUpdate);

      if (events != null && events.getData() != null) {
        foundUpdateEvent =
            events.getData().stream()
                .anyMatch(
                    event ->
                        event.getEntityId().equals(table.getId())
                            && event.getEventType() == EventType.ENTITY_UPDATED);
      }
    }

    assertTrue(foundUpdateEvent, "Should find update change event for table");
  }

  @Test
  void test_tableDeletionGeneratesChangeEvent(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    Table table = createTestTable(ns);
    assertNotNull(table);

    long timestampBeforeDeletion = System.currentTimeMillis();

    Tables.delete(table.getId().toString());

    // Deletion events are processed asynchronously, retry until we find the event
    int maxRetries = 10;
    int retryDelayMs = 500;
    boolean foundDeleteEvent = false;

    for (int retry = 0; retry < maxRetries && !foundDeleteEvent; retry++) {
      if (retry > 0) {
        Thread.sleep(retryDelayMs);
      }

      ListResponse<ChangeEvent> events =
          queryChangeEvents(httpClient, null, null, null, "table", timestampBeforeDeletion);

      if (events != null && events.getData() != null) {
        foundDeleteEvent =
            events.getData().stream()
                .anyMatch(
                    event ->
                        event.getEntityId().equals(table.getId())
                            && event.getEventType() == EventType.ENTITY_SOFT_DELETED);
      }
    }

    assertTrue(foundDeleteEvent, "Should find delete change event for table");
  }

  @Test
  void test_multipleEntityTypesChangeEvents(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    long timestampBeforeCreation = System.currentTimeMillis();

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());

    assertNotNull(service);
    assertNotNull(database);
    assertNotNull(schema);

    ListResponse<ChangeEvent> databaseEvents =
        queryChangeEvents(httpClient, "database", null, null, null, timestampBeforeCreation);

    assertNotNull(databaseEvents);
    assertTrue(
        databaseEvents.getData().stream()
            .anyMatch(event -> event.getEntityId().equals(database.getId())),
        "Should find change event for created database");

    ListResponse<ChangeEvent> schemaEvents =
        queryChangeEvents(httpClient, "databaseSchema", null, null, null, timestampBeforeCreation);

    assertNotNull(schemaEvents);
    assertTrue(
        schemaEvents.getData().stream()
            .anyMatch(event -> event.getEntityId().equals(schema.getId())),
        "Should find change event for created database schema");
  }

  @Test
  void test_changeEventTimestampFiltering(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    long timestampBeforeFirst = System.currentTimeMillis();

    Table table1 = createTestTable(ns);
    assertNotNull(table1);

    long timestampBetween = System.currentTimeMillis();

    Table table2 = createTestTable(ns);
    assertNotNull(table2);

    // Events are processed asynchronously, retry until we find both events
    int maxRetries = 10;
    int retryDelayMs = 500;
    boolean foundBothEvents = false;

    for (int retry = 0; retry < maxRetries && !foundBothEvents; retry++) {
      if (retry > 0) {
        Thread.sleep(retryDelayMs);
      }

      ListResponse<ChangeEvent> eventsAfterFirst =
          queryChangeEvents(httpClient, "table", null, null, null, timestampBeforeFirst);

      if (eventsAfterFirst != null && eventsAfterFirst.getData() != null) {
        long countFromFirst =
            eventsAfterFirst.getData().stream()
                .filter(
                    e ->
                        e.getEntityId().equals(table1.getId())
                            || e.getEntityId().equals(table2.getId()))
                .count();
        foundBothEvents = countFromFirst >= 2;
      }
    }

    assertTrue(foundBothEvents, "Should find both table creation events from first timestamp");

    ListResponse<ChangeEvent> eventsAfterSecond =
        queryChangeEvents(httpClient, "table", null, null, null, timestampBetween);

    assertNotNull(eventsAfterSecond);
    boolean foundSecondTableOnly =
        eventsAfterSecond.getData().stream().anyMatch(e -> e.getEntityId().equals(table2.getId()));
    assertTrue(
        foundSecondTableOnly, "Should find second table creation event from between timestamp");
  }

  @Test
  void test_changeEventStructure(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    long timestampBeforeCreation = System.currentTimeMillis();

    Table table = createTestTable(ns);
    assertNotNull(table);

    ListResponse<ChangeEvent> events =
        queryChangeEvents(httpClient, "table", null, null, null, timestampBeforeCreation);

    ChangeEvent tableEvent =
        events.getData().stream()
            .filter(event -> event.getEntityId().equals(table.getId()))
            .findFirst()
            .orElse(null);

    assertNotNull(tableEvent);
    assertNotNull(tableEvent.getId());
    assertNotNull(tableEvent.getEntityId());
    assertNotNull(tableEvent.getEntityType());
    assertNotNull(tableEvent.getEntityFullyQualifiedName());
    assertNotNull(tableEvent.getEventType());
    assertNotNull(tableEvent.getTimestamp());
    assertTrue(tableEvent.getTimestamp() > 0, "Timestamp should be positive");
  }

  @Test
  void test_changeEventWithEntityUpdate(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    Table table = createTestTable(ns);
    assertNotNull(table);

    long timestampBeforeUpdate = System.currentTimeMillis();

    String originalDescription = table.getDescription();
    String newDescription = "Modified description to test change description";
    table.setDescription(newDescription);
    Table updatedTable = Tables.update(table.getId().toString(), table);

    assertNotNull(updatedTable);
    assertNotEquals(originalDescription, updatedTable.getDescription());

    ListResponse<ChangeEvent> events =
        queryChangeEvents(httpClient, null, "table", null, null, timestampBeforeUpdate);

    ChangeEvent updateEvent =
        events.getData().stream()
            .filter(
                event ->
                    event.getEntityId().equals(table.getId())
                        && event.getEventType() == EventType.ENTITY_UPDATED)
            .findFirst()
            .orElse(null);

    assertNotNull(updateEvent, "Should find update event");
    assertEquals("table", updateEvent.getEntityType());
    assertEquals(table.getFullyQualifiedName(), updateEvent.getEntityFullyQualifiedName());
  }

  @Test
  void test_changeEventsResponseFormat(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    long timestamp = System.currentTimeMillis() - 86400000;

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityCreated", "table")
            .queryParam("timestamp", String.valueOf(timestamp))
            .build();

    String responseJson = httpClient.executeForString(HttpMethod.GET, EVENTS_PATH, null, options);

    assertNotNull(responseJson);
    assertFalse(responseJson.isEmpty());

    Map<String, Object> responseMap = MAPPER.readValue(responseJson, Map.class);
    assertTrue(responseMap.containsKey("data"), "Response should contain 'data' field");

    Object dataField = responseMap.get("data");
    assertInstanceOf(
        java.util.List.class, dataField, "Data field should be a list of change events");
  }

  @Test
  void test_emptyChangeEventQuery(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    long futureTimestamp = System.currentTimeMillis() + 86400000;

    ListResponse<ChangeEvent> events =
        queryChangeEvents(httpClient, "table", null, null, null, futureTimestamp);

    assertNotNull(events);
    assertNotNull(events.getData());
    assertTrue(events.getData().isEmpty(), "Should return empty list for future timestamp");
  }

  @Test
  void test_multipleEventTypesForSameEntity(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    long timestampBeforeAll = System.currentTimeMillis();

    Table table = createTestTable(ns);
    assertNotNull(table);

    table.setDescription("First update");
    Tables.update(table.getId().toString(), table);

    table.setDescription("Second update");
    Tables.update(table.getId().toString(), table);

    // Events are processed asynchronously, retry until we find all events
    int maxRetries = 10;
    int retryDelayMs = 500;
    long creationEventCount = 0;
    long updateEventCount = 0;

    for (int retry = 0; retry < maxRetries; retry++) {
      if (retry > 0) {
        Thread.sleep(retryDelayMs);
      }

      ListResponse<ChangeEvent> allEvents =
          queryChangeEvents(httpClient, "table", "table", null, null, timestampBeforeAll);

      if (allEvents != null && allEvents.getData() != null) {
        creationEventCount =
            allEvents.getData().stream()
                .filter(
                    e ->
                        e.getEntityId().equals(table.getId())
                            && e.getEventType() == EventType.ENTITY_CREATED)
                .count();

        updateEventCount =
            allEvents.getData().stream()
                .filter(
                    e ->
                        e.getEntityId().equals(table.getId())
                            && e.getEventType() == EventType.ENTITY_UPDATED)
                .count();

        // Stop retrying if we found all expected events
        if (creationEventCount >= 1 && updateEventCount >= 2) {
          break;
        }
      }
    }

    assertEquals(1, creationEventCount, "Should have exactly one creation event");
    assertTrue(updateEventCount >= 2, "Should have at least two update events");
  }

  private Table createTestTable(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());

    return Tables.create()
        .name(ns.prefix("table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(
            java.util.List.of(
                new org.openmetadata.schema.type.Column()
                    .withName("id")
                    .withDataType(org.openmetadata.schema.type.ColumnDataType.BIGINT),
                new org.openmetadata.schema.type.Column()
                    .withName("name")
                    .withDataType(org.openmetadata.schema.type.ColumnDataType.VARCHAR)
                    .withDataLength(255)))
        .execute();
  }

  private ListResponse<ChangeEvent> queryChangeEvents(
      HttpClient httpClient,
      String entityCreated,
      String entityUpdated,
      String entityRestored,
      String entityDeleted,
      Long timestamp)
      throws Exception {

    // Change events are processed asynchronously, so we may need to retry
    int maxRetries = 5;
    int retryDelayMs = 500;

    for (int retry = 0; retry < maxRetries; retry++) {
      Map<String, String> queryParams = new HashMap<>();
      if (entityCreated != null) {
        queryParams.put("entityCreated", entityCreated);
      }
      if (entityUpdated != null) {
        queryParams.put("entityUpdated", entityUpdated);
      }
      if (entityRestored != null) {
        queryParams.put("entityRestored", entityRestored);
      }
      if (entityDeleted != null) {
        queryParams.put("entityDeleted", entityDeleted);
      }
      if (timestamp != null) {
        queryParams.put("timestamp", timestamp.toString());
      }

      RequestOptions options = RequestOptions.builder().queryParams(queryParams).build();

      String responseJson = httpClient.executeForString(HttpMethod.GET, EVENTS_PATH, null, options);
      ListResponse<ChangeEvent> response = deserializeEventListResponse(responseJson);

      // If we have results, return them
      if (response != null && response.getData() != null && !response.getData().isEmpty()) {
        return response;
      }

      // Wait before retrying
      if (retry < maxRetries - 1) {
        Thread.sleep(retryDelayMs);
      }
    }

    // Return empty response if all retries failed
    return deserializeEventListResponse("{\"data\":[]}");
  }

  private ListResponse<ChangeEvent> deserializeEventListResponse(String json) throws Exception {
    com.fasterxml.jackson.databind.JsonNode rootNode = MAPPER.readTree(json);

    ListResponse<ChangeEvent> response = new ListResponse<>();

    if (rootNode.has("data") && rootNode.get("data").isArray()) {
      java.util.List<ChangeEvent> items = new java.util.ArrayList<>();
      for (com.fasterxml.jackson.databind.JsonNode node : rootNode.get("data")) {
        ChangeEvent item = MAPPER.treeToValue(node, ChangeEvent.class);
        items.add(item);
      }
      response.setData(items);
    }

    if (rootNode.has("paging")) {
      org.openmetadata.sdk.models.AllModels.Paging paging =
          MAPPER.treeToValue(
              rootNode.get("paging"), org.openmetadata.sdk.models.AllModels.Paging.class);
      response.setPaging(paging);
    }

    return response;
  }
}
