package org.openmetadata.sdk.services.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.type.IncidentGroupBy;
import org.openmetadata.schema.tests.type.IncidentStatusCount;
import org.openmetadata.schema.tests.type.IncidentTrendDirection;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseIncidentGroup;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;

/**
 * Exercises {@link TestCaseResolutionStatusService} list endpoints through a real {@link
 * OpenMetadataHttpClient} against an embedded HTTP server.
 */
class TestCaseResolutionStatusServiceTest {

  private static final UUID STATUS_ID = UUID.fromString("00000000-0000-0000-0000-000000000201");
  private static final UUID STATE_ID = UUID.fromString("00000000-0000-0000-0000-000000000202");
  private static final UUID TEST_CASE_ID = UUID.fromString("00000000-0000-0000-0000-000000000203");
  private static final UUID ASSIGNEE_ID = UUID.fromString("00000000-0000-0000-0000-000000000204");
  private static final UUID TABLE_ID = UUID.fromString("00000000-0000-0000-0000-000000000205");

  private HttpServer server;
  private final List<ReceivedRequest> received = new CopyOnWriteArrayList<>();
  private volatile Function<ReceivedRequest, StubResponse> responder =
      req -> StubResponse.json(200, "{\"data\":[],\"paging\":{\"total\":0}}");

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/v1/dataQuality/testCases/testCaseIncidentStatus", this::handle);
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void listAndListWithParamsReturnTypedResolutionStatuses() {
    responder = req -> StubResponse.json(200, resolutionStatusListJson());

    ListResponse<TestCaseResolutionStatus> noParamsResponse = newService().list();
    assertEquals(1, noParamsResponse.getData().size());
    assertResolutionStatus(noParamsResponse);
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseIncidentStatus", received.getFirst().rawPath());

    ListParams params =
        new ListParams()
            .withLimit(10)
            .withLatest(true)
            .addFilter("testCaseFQN", "svc.db.\"orders & returns\"=1");
    ListResponse<TestCaseResolutionStatus> withParamsResponse = newService().list(params);

    assertEquals(1, withParamsResponse.getData().size());
    assertResolutionStatus(withParamsResponse);
    ReceivedRequest secondRequest = received.get(1);
    assertTrue(
        secondRequest.rawQuery().contains("svc.db.") && !secondRequest.rawQuery().contains(" "),
        "Query parameters must be URL-encoded on the wire: " + secondRequest.rawQuery());
    Map<String, String> decodedQuery = parseDecodedQuery(secondRequest.rawQuery());
    assertEquals("10", decodedQuery.get("limit"));
    assertEquals("true", decodedQuery.get("latest"));
    assertEquals("svc.db.\"orders & returns\"=1", decodedQuery.get("testCaseFQN"));
  }

  @Test
  void searchListReturnsTypedResolutionStatusesAndEncodesSpecialChars() {
    responder = req -> StubResponse.json(200, resolutionStatusListJson());

    ListParams params =
        new ListParams()
            .withLimit(25)
            .addFilter("q", "row count & null + check")
            .addFilter("testCaseFQN", "svc.db.tbl.tc#1");
    ListResponse<TestCaseResolutionStatus> response = newService().searchList(params);

    assertEquals(1, received.size());
    ReceivedRequest request = received.getFirst();
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list", request.rawPath());
    Map<String, String> decodedQuery = parseDecodedQuery(request.rawQuery());
    assertEquals("25", decodedQuery.get("limit"));
    assertEquals("row count & null + check", decodedQuery.get("q"));
    assertEquals("svc.db.tbl.tc#1", decodedQuery.get("testCaseFQN"));
    assertResolutionStatus(response);
  }

  @Test
  void listIncidentGroupsReturnsTypedIncidentGroups() {
    String body =
        """
        {
          "data": [
            {
              "groupBy": "table",
              "id": "%s",
              "name": "orders",
              "displayName": "Orders",
              "fullyQualifiedName": "svc.db.schema.orders",
              "incidentCount": 4,
              "severity": "Severity1",
              "status": "Assigned",
              "statusCounts": [
                {"status": "Assigned", "count": 3},
                {"status": "New", "count": 1}
              ],
              "assignees": ["alice"],
              "assigneeReferences": [
                {"id": "%s", "type": "user", "name": "alice"}
              ],
              "assigneeCount": 1,
              "trend": [1, 1, 2, 2, 3, 3, 3, 4, 4],
              "trendDirection": "Rising",
              "unknownGroupField": "ignored"
            }
          ],
          "paging": {"total": 1, "after": "next-cursor"}
        }
        """
            .formatted(TABLE_ID, ASSIGNEE_ID);
    responder = req -> StubResponse.json(200, body);

    Map<String, String> params = new LinkedHashMap<>();
    params.put("groupBy", "table");
    params.put("q", "orders & sales");
    params.put("ignoredNull", null);

    ListResponse<TestCaseIncidentGroup> response = newService().listIncidentGroups(params);

    assertEquals(1, received.size());
    ReceivedRequest request = received.getFirst();
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseIncidentStatus/incidentGroups", request.rawPath());
    Map<String, String> decodedQuery = parseDecodedQuery(request.rawQuery());
    assertEquals("table", decodedQuery.get("groupBy"));
    assertEquals("orders & sales", decodedQuery.get("q"));
    assertTrue(!decodedQuery.containsKey("ignoredNull"));

    assertEquals(1, response.getData().size());
    assertEquals(1, response.getTotal());
    assertEquals("next-cursor", response.getPaging().getAfter());
    for (TestCaseIncidentGroup group : response.getData()) {
      assertEquals(IncidentGroupBy.Table, group.getGroupBy());
      assertEquals(TABLE_ID, group.getId());
      assertEquals("svc.db.schema.orders", group.getFullyQualifiedName());
      assertEquals(4, group.getIncidentCount());
      assertEquals(Severity.Severity1, group.getSeverity());
      assertEquals(TestCaseResolutionStatusTypes.Assigned, group.getStatus());
      assertEquals(2, group.getStatusCounts().size());
      IncidentStatusCount assignedCount = group.getStatusCounts().getFirst();
      assertEquals(TestCaseResolutionStatusTypes.Assigned, assignedCount.getStatus());
      assertEquals(3, assignedCount.getCount());
      assertEquals(1, group.getAssigneeReferences().size());
      EntityReference assigneeRef = group.getAssigneeReferences().getFirst();
      assertEquals(ASSIGNEE_ID, assigneeRef.getId());
      assertEquals("alice", assigneeRef.getName());
      assertEquals(List.of(1, 1, 2, 2, 3, 3, 3, 4, 4), group.getTrend());
      assertEquals(IncidentTrendDirection.Rising, group.getTrendDirection());
    }
  }

  @Test
  void handlesEmptyResponsesNoContentAndErrors() {
    responder = req -> StubResponse.json(200, "{\"data\":[],\"paging\":{\"total\":0}}");
    ListResponse<TestCaseResolutionStatus> emptyList = newService().list();
    assertTrue(emptyList.getData().isEmpty());
    assertEquals(0, emptyList.getTotal());

    responder = req -> StubResponse.empty(204);
    ListResponse<TestCaseIncidentGroup> emptyGroups =
        newService().listIncidentGroups(Map.of("groupBy", "table"));
    assertNotNull(emptyGroups.getData());
    assertTrue(emptyGroups.getData().isEmpty());
    assertEquals(0, emptyGroups.getTotal());

    responder = req -> StubResponse.json(403, "{\"code\":403,\"message\":\"Forbidden\"}");
    assertThrows(ForbiddenException.class, () -> newService().searchList(new ListParams()));

    responder = req -> StubResponse.json(500, "{\"code\":500,\"message\":\"Internal error\"}");
    ApiException apiException =
        assertThrows(ApiException.class, () -> newService().listIncidentGroups(null));
    assertEquals(500, apiException.getStatusCode());

    responder = req -> StubResponse.json(200, "not-json");
    assertThrows(OpenMetadataException.class, () -> newService().list());
  }

  private static void assertResolutionStatus(ListResponse<TestCaseResolutionStatus> response) {
    assertEquals(1, response.getTotal());
    assertEquals("cursor-after", response.getPaging().getAfter());
    assertEquals("cursor-before", response.getPaging().getBefore());
    for (TestCaseResolutionStatus status : response.getData()) {
      assertEquals(STATUS_ID, status.getId());
      assertEquals(STATE_ID, status.getStateId());
      assertEquals(
          TestCaseResolutionStatusTypes.Assigned, status.getTestCaseResolutionStatusType());
      assertEquals(Severity.Severity2, status.getSeverity());
      assertNotNull(status.getTestCaseReference());
      assertEquals(TEST_CASE_ID, status.getTestCaseReference().getId());
      assertEquals(
          "svc.db.schema.orders.row_count", status.getTestCaseReference().getFullyQualifiedName());
      assertNotNull(status.getTestCaseResolutionStatusDetails());
    }
  }

  private static String resolutionStatusListJson() {
    return """
        {
          "data": [
            {
              "id": "%s",
              "stateId": "%s",
              "timestamp": 1700000100000,
              "testCaseResolutionStatusType": "Assigned",
              "severity": "Severity2",
              "testCaseReference": {
                "id": "%s",
                "type": "testCase",
                "name": "row_count",
                "fullyQualifiedName": "svc.db.schema.orders.row_count"
              },
              "testCaseResolutionStatusDetails": {
                "assignee": {
                  "id": "%s",
                  "type": "user",
                  "name": "alice"
                }
              },
              "unknownFutureField": true
            }
          ],
          "paging": {
            "total": 1,
            "before": "cursor-before",
            "after": "cursor-after"
          }
        }
        """
        .formatted(STATUS_ID, STATE_ID, TEST_CASE_ID, ASSIGNEE_ID);
  }

  private TestCaseResolutionStatusService newService() {
    return new TestCaseResolutionStatusService(
        new OpenMetadataHttpClient(OpenMetadataConfig.builder().baseUrl(baseUrl()).build()));
  }

  private String baseUrl() {
    return "http://127.0.0.1:" + server.getAddress().getPort() + "/api";
  }

  private void handle(HttpExchange exchange) throws IOException {
    ReceivedRequest request =
        new ReceivedRequest(
            exchange.getRequestMethod(),
            exchange.getRequestURI().getRawPath(),
            exchange.getRequestURI().getRawQuery());
    received.add(request);
    StubResponse response = responder.apply(request);
    if (response.status() == 204 || response.body() == null) {
      exchange.sendResponseHeaders(response.status(), -1);
      exchange.close();
      return;
    }
    byte[] bytes = response.body().getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(response.status(), bytes.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(bytes);
    }
  }

  private static Map<String, String> parseDecodedQuery(String rawQuery) {
    Map<String, String> result = new LinkedHashMap<>();
    if (rawQuery == null || rawQuery.isEmpty()) {
      return result;
    }
    for (String pair : rawQuery.split("&")) {
      int idx = pair.indexOf('=');
      if (idx >= 0) {
        String key = URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8);
        String value = URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8);
        result.put(key, value);
      }
    }
    return result;
  }

  private record ReceivedRequest(String method, String rawPath, String rawQuery) {}

  private record StubResponse(int status, String body) {
    static StubResponse json(int status, String body) {
      return new StubResponse(status, body);
    }

    static StubResponse empty(int status) {
      return new StubResponse(status, null);
    }
  }
}
