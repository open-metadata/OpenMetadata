package org.openmetadata.sdk.services.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.type.TestCaseIncidentGroup;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;

/**
 * Verifies that the list-shaped endpoints of {@link TestCaseResolutionStatusService} (list,
 * searchList, listIncidentGroups) deserialize their responses into real typed elements rather than
 * {@code LinkedHashMap}s.
 *
 * <p>Previously {@code list} and {@code searchList} passed a raw {@code ResultList.class} token
 * (via {@code getResultListType()}) and {@code listIncidentGroups} did the same via {@code
 * getIncidentGroupResultListType()}, erasing the element generic so Jackson bound each {@code
 * data} entry to {@code LinkedHashMap}. With the fix they use {@code executeForString} + a {@link
 * com.fasterxml.jackson.core.type.TypeReference}, so elements are genuine typed objects.
 */
class TestCaseResolutionStatusServiceDeserializationTest {

  private static final String RESOLUTION_STATUS_JSON =
      "{\"data\":["
          + "{\"timestamp\":1000,\"testCaseResolutionStatusType\":\"New\"},"
          + "{\"timestamp\":2000,\"testCaseResolutionStatusType\":\"Resolved\"}"
          + "],\"paging\":{\"total\":2}}";

  private static final String INCIDENT_GROUP_JSON =
      "{\"data\":["
          + "{\"groupBy\":\"table\",\"name\":\"db.schema.table1\",\"incidentCount\":3},"
          + "{\"groupBy\":\"table\",\"name\":\"db.schema.table2\",\"incidentCount\":1}"
          + "],\"paging\":{\"total\":2}}";

  private static final String MALFORMED_JSON = "{not valid json";

  private HttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/api/v1/dataQuality/testCases/testCaseIncidentStatus",
        exchange -> {
          String query = exchange.getRequestURI().getQuery();
          if (query != null && query.contains("malformed=true")) {
            respond(exchange, 200, MALFORMED_JSON);
          } else {
            String path = exchange.getRequestURI().getPath();
            if (path != null && path.endsWith("/incidentGroups")) {
              respond(exchange, 200, INCIDENT_GROUP_JSON);
            } else {
              respond(exchange, 200, RESOLUTION_STATUS_JSON);
            }
          }
        });
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void listReturnsTypedTestCaseResolutionStatusElements() throws Exception {
    TestCaseResolutionStatusService service = newService();

    ListResponse<TestCaseResolutionStatus> resp = service.list();

    assertNotNull(resp);
    assertEquals(2, resp.getData().size());

    // Typed element access must not throw ClassCastException (the bug).
    TestCaseResolutionStatus first = resp.getData().get(0);
    assertNotNull(first);
    assertEquals(1000L, first.getTimestamp());
    assertEquals(TestCaseResolutionStatusTypes.New, first.getTestCaseResolutionStatusType());

    TestCaseResolutionStatus second = resp.getData().get(1);
    assertEquals(TestCaseResolutionStatusTypes.Resolved, second.getTestCaseResolutionStatusType());
  }

  @Test
  void listWithParamsReturnsTypedTestCaseResolutionStatusElements() throws Exception {
    TestCaseResolutionStatusService service = newService();

    ListParams params = new ListParams().setLimit(5);
    ListResponse<TestCaseResolutionStatus> resp = service.list(params);

    assertNotNull(resp);
    assertEquals(2, resp.getData().size());
    for (TestCaseResolutionStatus status : resp.getData()) {
      assertNotNull(status);
      assertNotNull(status.getTimestamp());
      assertNotNull(status.getTestCaseResolutionStatusType());
    }
  }

  @Test
  void searchListReturnsTypedTestCaseResolutionStatusElements() throws Exception {
    TestCaseResolutionStatusService service = newService();

    ListResponse<TestCaseResolutionStatus> resp = service.searchList(null);

    assertNotNull(resp);
    assertEquals(2, resp.getData().size());

    // Iteration over the typed list exercises the per-element compiler-inserted cast that
    // crashed before the fix.
    for (TestCaseResolutionStatus status : resp.getData()) {
      assertNotNull(status);
      assertNotNull(status.getTestCaseResolutionStatusType());
    }
    assertEquals(
        TestCaseResolutionStatusTypes.New, resp.getData().get(0).getTestCaseResolutionStatusType());
  }

  @Test
  void listIncidentGroupsReturnsTypedTestCaseIncidentGroupElements() throws Exception {
    TestCaseResolutionStatusService service = newService();

    ListResponse<TestCaseIncidentGroup> resp =
        service.listIncidentGroups(Map.of("groupBy", "table"));

    assertNotNull(resp);
    assertEquals(2, resp.getData().size());

    // The incidentGroups endpoint used a separate raw-class helper (getIncidentGroupResultListType)
    // and had the same LinkedHashMap bug. Elements must be TestCaseIncidentGroup here.
    TestCaseIncidentGroup first = resp.getData().get(0);
    assertNotNull(first);
    assertEquals("db.schema.table1", first.getName());
    assertEquals(3, first.getIncidentCount());

    TestCaseIncidentGroup second = resp.getData().get(1);
    assertEquals("db.schema.table2", second.getName());
    assertEquals(1, second.getIncidentCount());
  }

  @Test
  void iteratingIncidentGroupsAsTypedElementsDoesNotThrowClassCast() throws Exception {
    TestCaseResolutionStatusService service = newService();

    ListResponse<TestCaseIncidentGroup> resp =
        service.listIncidentGroups(Map.of("groupBy", "table"));

    for (TestCaseIncidentGroup group : resp.getData()) {
      assertNotNull(group);
      assertNotNull(group.getName());
      assertNotNull(group.getGroupBy());
      assertNotNull(group.getIncidentCount());
    }
  }

  @Test
  void pagingIsPreservedFromTheResultList() throws Exception {
    TestCaseResolutionStatusService service = newService();

    ListResponse<TestCaseResolutionStatus> resp = service.list();

    assertNotNull(resp.getPaging());
    assertEquals(2, resp.getTotal());
  }

  @Test
  void malformedJsonThrowsOpenMetadataExceptionNotClassCast() {
    TestCaseResolutionStatusService service = newService();

    // G6: a malformed response must surface as OpenMetadataException (wrapping the parse error),
    // not a raw IOException and not a silently-corrupted list of LinkedHashMaps. Routed via
    // listIncidentGroups with a "malformed=true" query param so the server returns bad JSON.
    assertThrows(
        OpenMetadataException.class, () -> service.listIncidentGroups(Map.of("malformed", "true")));
  }

  private TestCaseResolutionStatusService newService() {
    OpenMetadataConfig config =
        OpenMetadataConfig.builder()
            .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/api")
            .build();
    return new TestCaseResolutionStatusService(new OpenMetadataHttpClient(config));
  }

  private static void respond(HttpExchange exchange, int status, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(bytes);
    }
  }
}
