package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.analytics.PageViewData;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.api.tests.CreateWebAnalyticEvent;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for WebAnalyticEvent resource operations.
 *
 * <p>Tests web analytics event creation, data collection, and retrieval operations including: -
 * Creating web analytic event definitions - Submitting web analytics event data - Retrieving event
 * data with time range filters - Testing different event types
 *
 * <p>Migrated from: org.openmetadata.service.resources.analytics.WebAnalyticEventResourceTest
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class WebAnalyticEventResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String EVENTS_PATH = "/v1/analytics/web/events";
  private static final String COLLECT_PATH = EVENTS_PATH + "/collect";

  @Test
  void testCreateWebAnalyticEvent(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateWebAnalyticEvent createRequest =
        new CreateWebAnalyticEvent()
            .withName("event_" + ns.shortPrefix())
            .withDescription("Test web analytic event")
            .withEventType(WebAnalyticEventType.PAGE_VIEW);

    WebAnalyticEvent createdEvent =
        client
            .getHttpClient()
            .execute(HttpMethod.POST, EVENTS_PATH, createRequest, WebAnalyticEvent.class);

    assertNotNull(createdEvent.getId(), "Created event should have an ID");
    assertEquals(createRequest.getName(), createdEvent.getName(), "Event name should match");
    assertEquals(
        createRequest.getDescription(),
        createdEvent.getDescription(),
        "Event description should match");
    assertEquals(
        createRequest.getEventType(), createdEvent.getEventType(), "Event type should match");
  }

  @Test
  void testGetWebAnalyticEventById(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateWebAnalyticEvent createRequest =
        new CreateWebAnalyticEvent()
            .withName("event_get_" + ns.shortPrefix())
            .withDescription("Test event for retrieval")
            .withEventType(WebAnalyticEventType.PAGE_VIEW);

    WebAnalyticEvent createdEvent =
        client
            .getHttpClient()
            .execute(HttpMethod.POST, EVENTS_PATH, createRequest, WebAnalyticEvent.class);

    WebAnalyticEvent retrievedEvent =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                EVENTS_PATH + "/" + createdEvent.getId(),
                null,
                WebAnalyticEvent.class);

    assertEquals(createdEvent.getId(), retrievedEvent.getId(), "Event IDs should match");
    assertEquals(createdEvent.getName(), retrievedEvent.getName(), "Event names should match");
    assertEquals(
        createdEvent.getEventType(), retrievedEvent.getEventType(), "Event types should match");
  }

  @Test
  void testSubmitWebAnalyticEventData(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long timestamp = System.currentTimeMillis();

    WebAnalyticEventData eventData =
        new WebAnalyticEventData()
            .withTimestamp(timestamp)
            .withEventType(WebAnalyticEventType.PAGE_VIEW)
            .withEventData(
                new PageViewData()
                    .withHostname("http://localhost:8585")
                    .withUserId(UUID.randomUUID())
                    .withSessionId(UUID.randomUUID())
                    .withFullUrl(
                        "http://localhost:8585/table/sample_data.ecommerce_db.shopify.dim_customer")
                    .withUrl("/table/sample_data.ecommerce_db.shopify.dim_customer"));

    WebAnalyticEventData submittedData =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, COLLECT_PATH, eventData, WebAnalyticEventData.class);

    assertNotNull(submittedData, "Submitted data should not be null");
    assertEquals(eventData.getTimestamp(), submittedData.getTimestamp(), "Timestamps should match");
    assertEquals(
        eventData.getEventType(), submittedData.getEventType(), "Event types should match");
  }

  @Test
  void testRetrieveWebAnalyticEventData(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long currentTime = System.currentTimeMillis();
    long startTime = currentTime - 1000;
    long endTime = currentTime + 1000;

    WebAnalyticEventData eventData =
        new WebAnalyticEventData()
            .withTimestamp(currentTime)
            .withEventType(WebAnalyticEventType.PAGE_VIEW)
            .withEventData(
                new PageViewData()
                    .withHostname("http://localhost:8585")
                    .withUserId(UUID.randomUUID())
                    .withSessionId(UUID.randomUUID())
                    .withFullUrl("http://localhost:8585/dashboard/test_" + ns.shortPrefix())
                    .withUrl("/dashboard/test_" + ns.shortPrefix()));

    client
        .getHttpClient()
        .execute(HttpMethod.PUT, COLLECT_PATH, eventData, WebAnalyticEventData.class);

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("eventType", WebAnalyticEventType.PAGE_VIEW.value())
            .queryParam("startTs", String.valueOf(startTime))
            .queryParam("endTs", String.valueOf(endTime))
            .build();

    String retrieveResponseJson =
        client.getHttpClient().executeForString(HttpMethod.GET, COLLECT_PATH, null, options);

    assertNotNull(retrieveResponseJson, "Retrieve response should not be null");

    ResultList<?> resultList = OBJECT_MAPPER.readValue(retrieveResponseJson, ResultList.class);

    assertNotNull(resultList, "Result list should not be null");
    assertNotNull(resultList.getData(), "Result data should not be null");
    assertTrue(resultList.getData().size() >= 1, "Should retrieve at least one event");
  }

  @Test
  void testRetrieveMultipleWebAnalyticEvents(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long baseTime = System.currentTimeMillis();
    long startTime = baseTime - 5000;
    long endTime = baseTime + 5000;

    for (int i = 0; i < 3; i++) {
      WebAnalyticEventData eventData =
          new WebAnalyticEventData()
              .withTimestamp(baseTime + (i * 100))
              .withEventType(WebAnalyticEventType.PAGE_VIEW)
              .withEventData(
                  new PageViewData()
                      .withHostname("http://localhost:8585")
                      .withUserId(UUID.randomUUID())
                      .withSessionId(UUID.randomUUID())
                      .withFullUrl("http://localhost:8585/page_" + ns.shortPrefix() + "_" + i)
                      .withUrl("/page_" + ns.shortPrefix() + "_" + i));

      client
          .getHttpClient()
          .execute(HttpMethod.PUT, COLLECT_PATH, eventData, WebAnalyticEventData.class);
    }

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("eventType", WebAnalyticEventType.PAGE_VIEW.value())
            .queryParam("startTs", String.valueOf(startTime))
            .queryParam("endTs", String.valueOf(endTime))
            .build();

    String retrieveResponseJson =
        client.getHttpClient().executeForString(HttpMethod.GET, COLLECT_PATH, null, options);

    assertNotNull(retrieveResponseJson, "Retrieve response should not be null");

    ResultList<?> resultList = OBJECT_MAPPER.readValue(retrieveResponseJson, ResultList.class);

    assertNotNull(resultList, "Result list should not be null");
    assertNotNull(resultList.getData(), "Result data should not be null");
    assertTrue(
        resultList.getData().size() >= 3, "Should retrieve at least three events that were posted");
  }

  @Test
  void testWebAnalyticEventDataTimeRangeFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long currentTime = System.currentTimeMillis();

    WebAnalyticEventData oldEventData =
        new WebAnalyticEventData()
            .withTimestamp(currentTime - 10000)
            .withEventType(WebAnalyticEventType.PAGE_VIEW)
            .withEventData(
                new PageViewData()
                    .withHostname("http://localhost:8585")
                    .withUserId(UUID.randomUUID())
                    .withSessionId(UUID.randomUUID())
                    .withFullUrl("http://localhost:8585/old_" + ns.shortPrefix())
                    .withUrl("/old_" + ns.shortPrefix()));

    WebAnalyticEventData newEventData =
        new WebAnalyticEventData()
            .withTimestamp(currentTime)
            .withEventType(WebAnalyticEventType.PAGE_VIEW)
            .withEventData(
                new PageViewData()
                    .withHostname("http://localhost:8585")
                    .withUserId(UUID.randomUUID())
                    .withSessionId(UUID.randomUUID())
                    .withFullUrl("http://localhost:8585/new_" + ns.shortPrefix())
                    .withUrl("/new_" + ns.shortPrefix()));

    client
        .getHttpClient()
        .execute(HttpMethod.PUT, COLLECT_PATH, oldEventData, WebAnalyticEventData.class);
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, COLLECT_PATH, newEventData, WebAnalyticEventData.class);

    RequestOptions recentOptions =
        RequestOptions.builder()
            .queryParam("eventType", WebAnalyticEventType.PAGE_VIEW.value())
            .queryParam("startTs", String.valueOf(currentTime - 1000))
            .queryParam("endTs", String.valueOf(currentTime + 1000))
            .build();

    String recentResponseJson =
        client.getHttpClient().executeForString(HttpMethod.GET, COLLECT_PATH, null, recentOptions);

    ResultList<?> recentResultList = OBJECT_MAPPER.readValue(recentResponseJson, ResultList.class);

    assertNotNull(recentResultList, "Recent result list should not be null");
    assertTrue(recentResultList.getData().size() >= 1, "Should retrieve at least the recent event");

    RequestOptions allOptions =
        RequestOptions.builder()
            .queryParam("eventType", WebAnalyticEventType.PAGE_VIEW.value())
            .queryParam("startTs", String.valueOf(currentTime - 15000))
            .queryParam("endTs", String.valueOf(currentTime + 1000))
            .build();

    String allResponseJson =
        client.getHttpClient().executeForString(HttpMethod.GET, COLLECT_PATH, null, allOptions);

    ResultList<?> allResultList = OBJECT_MAPPER.readValue(allResponseJson, ResultList.class);

    assertNotNull(allResultList, "All result list should not be null");
    assertTrue(
        allResultList.getData().size() >= 2,
        "Should retrieve at least both events with wide range");
  }

  @Test
  void testListWebAnalyticEvents(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateWebAnalyticEvent createRequest1 =
        new CreateWebAnalyticEvent()
            .withName("list_event_1_" + ns.shortPrefix())
            .withDescription("First list test event")
            .withEventType(WebAnalyticEventType.PAGE_VIEW);

    CreateWebAnalyticEvent createRequest2 =
        new CreateWebAnalyticEvent()
            .withName("list_event_2_" + ns.shortPrefix())
            .withDescription("Second list test event")
            .withEventType(WebAnalyticEventType.PAGE_VIEW);

    client
        .getHttpClient()
        .execute(HttpMethod.POST, EVENTS_PATH, createRequest1, WebAnalyticEvent.class);
    client
        .getHttpClient()
        .execute(HttpMethod.POST, EVENTS_PATH, createRequest2, WebAnalyticEvent.class);

    RequestOptions listOptions = RequestOptions.builder().queryParam("limit", "100").build();

    String listResponseJson =
        client.getHttpClient().executeForString(HttpMethod.GET, EVENTS_PATH, null, listOptions);

    assertNotNull(listResponseJson, "List response should not be null");

    ResultList<?> resultList = OBJECT_MAPPER.readValue(listResponseJson, ResultList.class);

    assertNotNull(resultList, "Result list should not be null");
    assertNotNull(resultList.getData(), "Result data should not be null");
    assertTrue(resultList.getData().size() >= 2, "Should list at least two created events");
  }
}
