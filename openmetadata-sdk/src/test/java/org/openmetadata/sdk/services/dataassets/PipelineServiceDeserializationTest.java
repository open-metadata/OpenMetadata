package org.openmetadata.sdk.services.dataassets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;

/**
 * Verifies that {@link PipelineService#listPipelineStatuses(String, Long, Long)} deserializes the
 * response into real {@link PipelineStatus} elements rather than {@code LinkedHashMap}s.
 *
 * <p>The bug (and fix) lives in the service-layer deserialization: the service previously passed a
 * raw {@code ResultList.class} token to {@code httpClient.execute(...)}, which erased the {@code
 * PipelineStatus} generic so Jackson bound every {@code data} entry to {@code LinkedHashMap}. This
 * test wires a real {@link OpenMetadataHttpClient} to a local JDK {@link HttpServer} so the full
 * HTTP → string → Jackson/{@code TypeReference} path is exercised end-to-end, then asserts that
 * elements are genuine {@link PipelineStatus} objects (iteration / cast must not throw {@code
 * ClassCastException}).
 */
class PipelineServiceDeserializationTest {

  private static final String STATUS_JSON =
      "{\"data\":["
          + "{\"timestamp\":1000,\"executionStatus\":\"Successful\",\"executionId\":\"run-001\"},"
          + "{\"timestamp\":2000,\"executionStatus\":\"Failed\",\"executionId\":\"run-002\"}"
          + "],\"paging\":{\"total\":2}}";

  private static final String EMPTY_JSON = "{\"data\":[],\"paging\":{\"total\":0}}";

  private static final String MALFORMED_JSON = "{not valid json";

  private HttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/api/v1/pipelines",
        exchange -> {
          String path = exchange.getRequestURI().getPath();
          if (path != null && path.contains("/no_statuses/")) {
            respond(exchange, 200, EMPTY_JSON);
          } else if (path != null && path.contains("/malformed/")) {
            respond(exchange, 200, MALFORMED_JSON);
          } else {
            respond(exchange, 200, STATUS_JSON);
          }
        });
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void listPipelineStatusesReturnsTypedPipelineStatusElements() throws Exception {
    PipelineService service = newService();

    ListResponse<PipelineStatus> resp = service.listPipelineStatuses("test_pipeline", 0L, 10000L);

    assertNotNull(resp);
    assertEquals(2, resp.getData().size());

    // The headline bug: elements must be PipelineStatus, not LinkedHashMap. Touching an entry
    // via the typed API (get + field access) must not throw ClassCastException.
    PipelineStatus first = resp.getData().get(0);
    assertNotNull(first);
    assertEquals(1000L, first.getTimestamp());
    assertEquals(StatusType.Successful, first.getExecutionStatus());
    assertEquals("run-001", first.getExecutionId());

    PipelineStatus second = resp.getData().get(1);
    assertNotNull(second);
    assertEquals(2000L, second.getTimestamp());
    assertEquals(StatusType.Failed, second.getExecutionStatus());
    assertEquals("run-002", second.getExecutionId());
  }

  @Test
  void iteratingDataAsPipelineStatusDoesNotThrowClassCast() throws Exception {
    PipelineService service = newService();

    ListResponse<PipelineStatus> resp = service.listPipelineStatuses("test_pipeline", 0L, 10000L);

    // Enhanced-for over the typed list exercises the per-element cast the compiler inserts under
    // erasure — exactly the iteration pattern that crashes in the bug report.
    int count = 0;
    for (PipelineStatus status : resp.getData()) {
      assertNotNull(status);
      assertNotNull(status.getTimestamp());
      assertNotNull(status.getExecutionStatus());
      count++;
    }
    assertEquals(2, count);
  }

  @Test
  void pagingIsPreservedFromTheResultList() throws Exception {
    PipelineService service = newService();

    ListResponse<PipelineStatus> resp = service.listPipelineStatuses("test_pipeline", 0L, 10000L);

    assertNotNull(resp.getPaging());
    assertEquals(2, resp.getTotal());
  }

  @Test
  void emptyDataListDeserializesToEmptyTypedList() throws Exception {
    PipelineService service = newService();

    ListResponse<PipelineStatus> resp = service.listPipelineStatuses("no_statuses", 0L, 10000L);

    assertNotNull(resp);
    assertNotNull(resp.getData());
    assertEquals(0, resp.getData().size());
  }

  @Test
  void malformedJsonThrowsOpenMetadataExceptionNotClassCast() {
    PipelineService service = newService();

    // G6: a malformed response must surface as OpenMetadataException (wrapping the parse error),
    // not a raw IOException and not a silently-corrupted list of LinkedHashMaps.
    assertThrows(
        OpenMetadataException.class, () -> service.listPipelineStatuses("malformed", 0L, 10000L));
  }

  private PipelineService newService() {
    OpenMetadataConfig config =
        OpenMetadataConfig.builder()
            .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/api")
            .build();
    return new PipelineService(new OpenMetadataHttpClient(config));
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
