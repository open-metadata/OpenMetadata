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
import org.openmetadata.schema.tests.type.TestCaseDimensionResult;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestResultValue;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;

/**
 * Exercises {@link TestCaseResultService} read endpoints through a real {@link
 * OpenMetadataHttpClient} against an embedded HTTP server.
 */
class TestCaseResultServiceTest {

  private static final UUID RESULT_ID = UUID.fromString("00000000-0000-0000-0000-000000000301");
  private static final UUID DIM_RESULT_ID = UUID.fromString("00000000-0000-0000-0000-000000000302");
  private static final String TEST_CASE_FQN = "svc.db.schema.orders.row_count";

  private HttpServer server;
  private final List<ReceivedRequest> received = new CopyOnWriteArrayList<>();
  private volatile Function<ReceivedRequest, StubResponse> responder =
      req -> StubResponse.json(200, "{\"data\":[],\"paging\":{\"total\":0}}");

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/v1/dataQuality/testCases/testCaseResults", this::handle);
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void getAndGetWithParamsReturnTypedTestCaseResults() {
    responder = req -> StubResponse.json(200, wrappedResultListJson());

    ListResponse<TestCaseResult> noParams = newService().get(TEST_CASE_FQN);
    assertEquals(1, noParams.getData().size());
    assertTypedResult(noParams.getData().getFirst());
    assertEquals(1, noParams.getTotal());
    assertEquals("next-page", noParams.getPaging().getAfter());

    ListParams params =
        new ListParams()
            .withLimit(50)
            .addQueryParam("startTs", "1700000000000")
            .addQueryParam("endTs", "1700000999000");
    ListResponse<TestCaseResult> withParams = newService().get(TEST_CASE_FQN, params);

    assertEquals(1, withParams.getData().size());
    for (TestCaseResult result : withParams.getData()) {
      assertTypedResult(result);
    }
    ReceivedRequest second = received.get(1);
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseResults/" + TEST_CASE_FQN, second.rawPath());
    Map<String, String> query = parseDecodedQuery(second.rawQuery());
    assertEquals("50", query.get("limit"));
    assertEquals("1700000000000", query.get("startTs"));
    assertEquals("1700000999000", query.get("endTs"));
  }

  @Test
  void searchListReturnsTypedTestCaseResultsAndEncodesQueryParams() {
    responder = req -> StubResponse.json(200, wrappedResultListJson());

    ListParams params =
        new ListParams()
            .withLimit(10)
            .addFilter("testCaseFQN", "svc.db.\"orders & returns\".tc")
            .addFilter("q", "failed > 0 & region=US");
    ListResponse<TestCaseResult> response = newService().searchList(params);

    assertEquals(1, received.size());
    ReceivedRequest request = received.getFirst();
    assertEquals("/api/v1/dataQuality/testCases/testCaseResults/search/list", request.rawPath());
    Map<String, String> query = parseDecodedQuery(request.rawQuery());
    assertEquals("10", query.get("limit"));
    assertEquals("svc.db.\"orders & returns\".tc", query.get("testCaseFQN"));
    assertEquals("failed > 0 & region=US", query.get("q"));
    assertEquals(1, response.getData().size());
    for (TestCaseResult result : response.getData()) {
      assertTypedResult(result);
    }
  }

  @Test
  void searchLatestUnwrapsSingleTestCaseResultWireShape() {
    responder = req -> StubResponse.json(200, singleTestCaseResultJson());

    ListParams params =
        new ListParams().addFilter("testCaseFQN", TEST_CASE_FQN).setFields("testCase");
    ListResponse<TestCaseResult> response = newService().searchLatest(params);

    assertEquals(1, received.size());
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseResults/search/latest",
        received.getFirst().rawPath());
    Map<String, String> query = parseDecodedQuery(received.getFirst().rawQuery());
    assertEquals(TEST_CASE_FQN, query.get("testCaseFQN"));
    assertEquals("testCase", query.get("fields"));

    assertEquals(1, response.getData().size());
    assertEquals(1, response.getTotal());
    assertNotNull(response.getPaging());
    assertEquals(1, response.getPaging().getTotal());
    for (TestCaseResult result : response.getData()) {
      assertTypedResult(result);
    }
  }

  @Test
  void searchLatestHandlesWrappedResultListWireShape() {
    responder = req -> StubResponse.json(200, wrappedResultListJson());

    ListResponse<TestCaseResult> response =
        newService().searchLatest(new ListParams().addFilter("testCaseFQN", TEST_CASE_FQN));

    assertEquals(1, response.getData().size());
    assertEquals(1, response.getTotal());
    assertEquals("next-page", response.getPaging().getAfter());
    for (TestCaseResult result : response.getData()) {
      assertTypedResult(result);
    }
  }

  @Test
  void searchLatestHandlesEmptyBodyJsonNullDataLessResultListAndUnexpectedPayloads() {
    responder = req -> StubResponse.empty(204);
    ListResponse<TestCaseResult> noContent = newService().searchLatest(null);
    assertTrue(noContent.getData().isEmpty());
    assertEquals(0, noContent.getTotal());

    responder = req -> StubResponse.json(200, "null");
    ListResponse<TestCaseResult> jsonNull = newService().searchLatest(new ListParams());
    assertTrue(jsonNull.getData().isEmpty());
    assertEquals(0, jsonNull.getTotal());

    responder = req -> StubResponse.json(200, "{\"paging\":{\"total\":0}}");
    ListResponse<TestCaseResult> dataLessResultList = newService().searchLatest(new ListParams());
    assertTrue(dataLessResultList.getData().isEmpty());
    assertNotNull(dataLessResultList.getPaging());
    assertEquals(0, dataLessResultList.getPaging().getTotal());
    assertEquals(0, dataLessResultList.getTotal());

    responder = req -> StubResponse.json(200, "{}");
    ListResponse<TestCaseResult> emptyObject = newService().searchLatest(new ListParams());
    assertTrue(emptyObject.getData().isEmpty());
    assertEquals(0, emptyObject.getTotal());

    responder = req -> StubResponse.json(200, "{\"unexpected\":true}");
    assertThrows(OpenMetadataException.class, () -> newService().searchLatest(new ListParams()));

    responder = req -> StubResponse.json(200, "[{}]");
    assertThrows(OpenMetadataException.class, () -> newService().searchLatest(new ListParams()));

    responder = req -> StubResponse.json(200, "{broken-json");
    assertThrows(OpenMetadataException.class, () -> newService().searchLatest(new ListParams()));
  }

  @Test
  void handlesEmptyResponsesNoContentAndHttpErrors() {
    responder = req -> StubResponse.json(200, "{\"data\":[],\"paging\":{\"total\":0}}");
    ListResponse<TestCaseResult> empty = newService().get(TEST_CASE_FQN);
    assertTrue(empty.getData().isEmpty());
    assertEquals(0, empty.getTotal());

    responder = req -> StubResponse.empty(204);
    ListResponse<TestCaseResult> noContent = newService().searchList(new ListParams());
    assertNotNull(noContent.getData());
    assertTrue(noContent.getData().isEmpty());
    assertEquals(0, noContent.getTotal());

    responder = req -> StubResponse.json(403, "{\"code\":403,\"message\":\"Forbidden\"}");
    assertThrows(ForbiddenException.class, () -> newService().get(TEST_CASE_FQN));

    responder = req -> StubResponse.json(404, "{\"code\":404,\"message\":\"Not found\"}");
    ApiException notFound =
        assertThrows(ApiException.class, () -> newService().searchList(new ListParams()));
    assertEquals(404, notFound.getStatusCode());

    responder = req -> StubResponse.json(500, "{\"code\":500,\"message\":\"Server error\"}");
    ApiException serverError =
        assertThrows(ApiException.class, () -> newService().searchLatest(new ListParams()));
    assertEquals(500, serverError.getStatusCode());

    responder = req -> StubResponse.json(200, "not-json");
    assertThrows(OpenMetadataException.class, () -> newService().get(TEST_CASE_FQN));
  }

  private static void assertTypedResult(TestCaseResult result) {
    assertEquals(RESULT_ID, result.getId());
    assertEquals(TEST_CASE_FQN, result.getTestCaseFQN());
    assertEquals(1700000200000L, result.getTimestamp());
    assertEquals(TestCaseStatus.Failed, result.getTestCaseStatus());
    assertEquals(95L, result.getPassedRows());
    assertEquals(5L, result.getFailedRows());
    assertNotNull(result.getTestResultValue());
    assertEquals(1, result.getTestResultValue().size());
    TestResultValue metric = result.getTestResultValue().getFirst();
    assertEquals("rowCount", metric.getName());
    assertEquals("100", metric.getValue());
    assertNotNull(result.getDimensionResults());
    assertEquals(1, result.getDimensionResults().size());
    TestCaseDimensionResult dimension = result.getDimensionResults().getFirst();
    assertEquals(DIM_RESULT_ID, dimension.getId());
    assertEquals("region=US", dimension.getDimensionKey());
    assertEquals(TestCaseStatus.Failed, dimension.getTestCaseStatus());
  }

  private static String singleTestCaseResultJson() {
    return """
        {
          "id": "%s",
          "testCaseFQN": "%s",
          "timestamp": 1700000200000,
          "testCaseStatus": "Failed",
          "result": "Found 5 failing rows",
          "passedRows": 95,
          "failedRows": 5,
          "testResultValue": [
            {"name": "rowCount", "value": "100"}
          ],
          "dimensionResults": [
            {
              "id": "%s",
              "testCaseResultId": "%s",
              "timestamp": 1700000200000,
              "dimensionValues": [{"name": "region", "value": "US"}],
              "dimensionKey": "region=US",
              "testCaseStatus": "Failed"
            }
          ],
          "unknownServerField": "tolerated"
        }
        """
        .formatted(RESULT_ID, TEST_CASE_FQN, DIM_RESULT_ID, RESULT_ID);
  }

  private static String wrappedResultListJson() {
    return """
        {
          "data": [%s],
          "paging": {"total": 1, "after": "next-page"}
        }
        """
        .formatted(singleTestCaseResultJson());
  }

  private TestCaseResultService newService() {
    return new TestCaseResultService(
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
