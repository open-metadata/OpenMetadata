package org.openmetadata.sdk.services.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.type.TestCaseDimensionResult;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestResultValue;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;
import org.openmetadata.sdk.testing.EmbeddedHttpServer;
import org.openmetadata.sdk.testing.EmbeddedHttpServer.ReceivedRequest;

/**
 * Exercises {@link TestCaseResultService} read endpoints through a real {@link
 * OpenMetadataHttpClient} against an embedded HTTP server.
 */
class TestCaseResultServiceTest {

  private static final UUID RESULT_ID = UUID.fromString("00000000-0000-0000-0000-000000000301");
  private static final UUID DIM_RESULT_ID = UUID.fromString("00000000-0000-0000-0000-000000000302");
  private static final String TEST_CASE_FQN = "svc.db.schema.orders.row_count";

  private EmbeddedHttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = EmbeddedHttpServer.start("/v1/dataQuality/testCases/testCaseResults");
  }

  @AfterEach
  void stopServer() {
    server.close();
  }

  @Test
  void getAndGetWithParamsReturnTypedTestCaseResults() {
    server.respond(200, wrappedResultListJson());

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
    ReceivedRequest second = server.requests().get(1);
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseResults/" + TEST_CASE_FQN, second.rawPath());
    Map<String, String> query = second.query();
    assertEquals("50", query.get("limit"));
    assertEquals("1700000000000", query.get("startTs"));
    assertEquals("1700000999000", query.get("endTs"));
  }

  @Test
  void searchListReturnsTypedTestCaseResultsAndEncodesQueryParams() {
    server.respond(200, wrappedResultListJson());

    ListParams params =
        new ListParams()
            .withLimit(10)
            .addFilter("testCaseFQN", "svc.db.\"orders & returns\".tc")
            .addFilter("q", "failed > 0 & region=US");
    ListResponse<TestCaseResult> response = newService().searchList(params);

    assertEquals(1, server.requests().size());
    ReceivedRequest request = server.requests().getFirst();
    assertEquals("/api/v1/dataQuality/testCases/testCaseResults/search/list", request.rawPath());
    Map<String, String> query = request.query();
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
    server.respond(200, singleTestCaseResultJson());

    ListParams params =
        new ListParams().addFilter("testCaseFQN", TEST_CASE_FQN).setFields("testCase");
    ListResponse<TestCaseResult> response = newService().searchLatest(params);

    assertEquals(1, server.requests().size());
    ReceivedRequest request = server.requests().getFirst();
    assertEquals("/api/v1/dataQuality/testCases/testCaseResults/search/latest", request.rawPath());
    Map<String, String> query = request.query();
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
  void searchLatestReturnsAnEmptyListWhenNothingMatches() {
    server.respondNoContent();

    ListResponse<TestCaseResult> noContent = newService().searchLatest(null);

    assertEquals(1, server.requests().size());
    assertEquals(
        "/api/v1/dataQuality/testCases/testCaseResults/search/latest",
        server.requests().getFirst().rawPath());
    assertNotNull(noContent.getData());
    assertTrue(noContent.getData().isEmpty());
    assertEquals(0, noContent.getTotal());
  }

  @Test
  void handlesEmptyResponsesNoContentAndHttpErrors() {
    server.respond(200, "{\"data\":[],\"paging\":{\"total\":0}}");
    ListResponse<TestCaseResult> empty = newService().get(TEST_CASE_FQN);
    assertTrue(empty.getData().isEmpty());
    assertEquals(0, empty.getTotal());

    server.respondNoContent();
    ListResponse<TestCaseResult> noContent = newService().searchList(new ListParams());
    assertNotNull(noContent.getData());
    assertTrue(noContent.getData().isEmpty());
    assertEquals(0, noContent.getTotal());

    server.respond(403, "{\"code\":403,\"message\":\"Forbidden\"}");
    assertThrows(ForbiddenException.class, () -> newService().get(TEST_CASE_FQN));

    server.respond(404, "{\"code\":404,\"message\":\"Not found\"}");
    ApiException notFound =
        assertThrows(ApiException.class, () -> newService().searchList(new ListParams()));
    assertEquals(404, notFound.getStatusCode());

    server.respond(500, "{\"code\":500,\"message\":\"Server error\"}");
    ApiException serverError =
        assertThrows(ApiException.class, () -> newService().searchLatest(new ListParams()));
    assertEquals(500, serverError.getStatusCode());

    server.respond(200, "not-json");
    assertThrows(OpenMetadataException.class, () -> newService().get(TEST_CASE_FQN));
    assertThrows(OpenMetadataException.class, () -> newService().searchLatest(new ListParams()));
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
    return new TestCaseResultService(server.httpClient());
  }
}
