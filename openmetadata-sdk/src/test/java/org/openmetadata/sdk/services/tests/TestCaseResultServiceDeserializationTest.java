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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;

/**
 * Verifies that the list-shaped endpoints of {@link TestCaseResultService} (get, searchList,
 * searchLatest) deserialize their responses into real {@link TestCaseResult} elements rather than
 * {@code LinkedHashMap}s.
 *
 * <p>Previously these methods passed a raw {@code ResultList.class} token (via {@code
 * getResultListType()}) to {@code httpClient.execute(...)}, erasing the {@code TestCaseResult}
 * generic so Jackson bound each {@code data} entry to {@code LinkedHashMap}. With the fix they use
 * {@code executeForString} + a {@link com.fasterxml.jackson.core.type.TypeReference}, so elements
 * are genuine {@link TestCaseResult} objects.
 */
class TestCaseResultServiceDeserializationTest {

  private static final String RESULTS_JSON =
      "{\"data\":["
          + "{\"timestamp\":1000,\"testCaseStatus\":\"Success\",\"result\":\"All good\"},"
          + "{\"timestamp\":2000,\"testCaseStatus\":\"Failed\",\"result\":\"Some values failed\"}"
          + "],\"paging\":{\"total\":2}}";

  private static final String MALFORMED_JSON = "{not valid json";

  private HttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/api/v1/dataQuality/testCases/testCaseResults",
        exchange -> {
          String path = exchange.getRequestURI().getPath();
          if (path != null && path.contains("/malformed")) {
            respond(exchange, 200, MALFORMED_JSON);
          } else {
            respond(exchange, 200, RESULTS_JSON);
          }
        });
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void getReturnsTypedTestCaseResultElements() throws Exception {
    TestCaseResultService service = newService();

    ListResponse<TestCaseResult> resp = service.get("test_case");

    assertNotNull(resp);
    assertEquals(2, resp.getData().size());

    // Typed element access must not throw ClassCastException (the bug).
    TestCaseResult first = resp.getData().get(0);
    assertNotNull(first);
    assertEquals(1000L, first.getTimestamp());
    assertEquals(TestCaseStatus.Success, first.getTestCaseStatus());
    assertEquals("All good", first.getResult());

    TestCaseResult second = resp.getData().get(1);
    assertEquals(TestCaseStatus.Failed, second.getTestCaseStatus());
    assertEquals("Some values failed", second.getResult());
  }

  @Test
  void getWithParamsReturnsTypedTestCaseResultElements() throws Exception {
    TestCaseResultService service = newService();

    ListParams params = new ListParams().setLimit(10);
    ListResponse<TestCaseResult> resp = service.get("test_case", params);

    assertNotNull(resp);
    assertEquals(2, resp.getData().size());
    for (TestCaseResult result : resp.getData()) {
      assertNotNull(result);
      assertNotNull(result.getTimestamp());
      assertNotNull(result.getTestCaseStatus());
    }
  }

  @Test
  void searchListReturnsTypedTestCaseResultElements() throws Exception {
    TestCaseResultService service = newService();

    ListResponse<TestCaseResult> resp = service.searchList(null);

    assertNotNull(resp);
    assertEquals(2, resp.getData().size());

    // Iteration over the typed list exercises the per-element cast that crashed before the fix.
    for (TestCaseResult result : resp.getData()) {
      assertNotNull(result);
      assertNotNull(result.getTestCaseStatus());
    }
    assertEquals(TestCaseStatus.Success, resp.getData().get(0).getTestCaseStatus());
    assertEquals(TestCaseStatus.Failed, resp.getData().get(1).getTestCaseStatus());
  }

  @Test
  void searchLatestReturnsTypedTestCaseResultElements() throws Exception {
    TestCaseResultService service = newService();

    ListResponse<TestCaseResult> resp = service.searchLatest(null);

    assertNotNull(resp);
    assertEquals(2, resp.getData().size());

    TestCaseResult first = resp.getData().get(0);
    assertNotNull(first);
    assertEquals(1000L, first.getTimestamp());
    assertEquals(TestCaseStatus.Success, first.getTestCaseStatus());
  }

  @Test
  void pagingIsPreservedFromTheResultList() throws Exception {
    TestCaseResultService service = newService();

    ListResponse<TestCaseResult> resp = service.get("test_case");

    assertNotNull(resp.getPaging());
    assertEquals(2, resp.getTotal());
  }

  @Test
  void malformedJsonThrowsOpenMetadataExceptionNotClassCast() {
    TestCaseResultService service = newService();

    // G6: a malformed response must surface as OpenMetadataException (wrapping the parse error),
    // not a raw IOException and not a silently-corrupted list of LinkedHashMaps.
    assertThrows(OpenMetadataException.class, () -> service.get("malformed"));
  }

  private TestCaseResultService newService() {
    OpenMetadataConfig config =
        OpenMetadataConfig.builder()
            .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/api")
            .build();
    return new TestCaseResultService(new OpenMetadataHttpClient(config));
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
