package org.openmetadata.sdk.services.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;
import org.openmetadata.sdk.testing.EmbeddedHttpServer;
import org.openmetadata.sdk.testing.EmbeddedHttpServer.ReceivedRequest;

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

  private EmbeddedHttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = EmbeddedHttpServer.start("/v1/dataQuality/testCases/testCaseIncidentStatus");
  }

  @AfterEach
  void stopServer() {
    server.close();
  }

  @Test
  void listAndListWithParamsReturnTypedResolutionStatuses() {
    server.respond(200, resolutionStatusListJson());

    ListResponse<TestCaseResolutionStatus> noParamsResponse = newService().list();
    assertEquals(1, noParamsResponse.getData().size());
    assertResolutionStatus(noParamsResponse);
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseIncidentStatus",
        server.requests().getFirst().rawPath());

    ListParams params =
        new ListParams()
            .withLimit(10)
            .withLatest(true)
            .addFilter("testCaseFQN", "svc.db.\"orders & returns\"=1");
    ListResponse<TestCaseResolutionStatus> withParamsResponse = newService().list(params);

    assertEquals(1, withParamsResponse.getData().size());
    assertResolutionStatus(withParamsResponse);
    ReceivedRequest secondRequest = server.requests().get(1);
    assertTrue(
        secondRequest.rawQuery().contains("svc.db.") && !secondRequest.rawQuery().contains(" "),
        "Query parameters must be URL-encoded on the wire: " + secondRequest.rawQuery());
    Map<String, String> decodedQuery = secondRequest.query();
    assertEquals("10", decodedQuery.get("limit"));
    assertEquals("true", decodedQuery.get("latest"));
    assertEquals("svc.db.\"orders & returns\"=1", decodedQuery.get("testCaseFQN"));
  }

  @Test
  void searchListReturnsTypedResolutionStatusesAndEncodesSpecialChars() {
    server.respond(200, resolutionStatusListJson());

    ListParams params =
        new ListParams()
            .withLimit(25)
            .addFilter("q", "row count & null + check")
            .addFilter("testCaseFQN", "svc.db.tbl.tc#1");
    ListResponse<TestCaseResolutionStatus> response = newService().searchList(params);

    assertEquals(1, server.requests().size());
    ReceivedRequest request = server.requests().getFirst();
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list", request.rawPath());
    Map<String, String> decodedQuery = request.query();
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
    server.respond(200, body);

    Map<String, String> params = new LinkedHashMap<>();
    params.put("groupBy", "table");
    params.put("q", "orders & sales");
    params.put("ignoredNull", null);

    ListResponse<TestCaseIncidentGroup> response = newService().listIncidentGroups(params);

    assertEquals(1, server.requests().size());
    ReceivedRequest request = server.requests().getFirst();
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseIncidentStatus/incidentGroups", request.rawPath());
    Map<String, String> decodedQuery = request.query();
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
    server.respond(200, "{\"data\":[],\"paging\":{\"total\":0}}");
    ListResponse<TestCaseResolutionStatus> emptyList = newService().list();
    assertTrue(emptyList.getData().isEmpty());
    assertEquals(0, emptyList.getTotal());

    server.respondNoContent();
    ListResponse<TestCaseIncidentGroup> emptyGroups =
        newService().listIncidentGroups(Map.of("groupBy", "table"));
    assertNotNull(emptyGroups.getData());
    assertTrue(emptyGroups.getData().isEmpty());
    assertEquals(0, emptyGroups.getTotal());

    server.respond(403, "{\"code\":403,\"message\":\"Forbidden\"}");
    assertThrows(ForbiddenException.class, () -> newService().searchList(new ListParams()));

    server.respond(500, "{\"code\":500,\"message\":\"Internal error\"}");
    ApiException apiException =
        assertThrows(ApiException.class, () -> newService().listIncidentGroups(null));
    assertEquals(500, apiException.getStatusCode());

    server.respond(200, "not-json");
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
    return new TestCaseResolutionStatusService(server.httpClient());
  }
}
