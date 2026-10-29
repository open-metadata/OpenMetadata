package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.type.BulkCreateConflictPolicy;
import org.openmetadata.schema.type.BulkCreateItemResult;
import org.openmetadata.schema.type.BulkCreateItemResult.Reason;
import org.openmetadata.schema.type.BulkCreateItemResult.Status;
import org.openmetadata.schema.type.BulkCreateResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.request.BulkCreateRequest;

@Isolated("Fluent facades share default clients")
class BulkCreateFluentAPITest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final UUID CREATED_ID = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
  private final ArrayBlockingQueue<ReceivedRequest> received = new ArrayBlockingQueue<>(1);
  private HttpServer server;
  private int responseStatus = 200;
  private String responseBody;

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/v1/", this::respond);
    server.start();
    final OpenMetadataClient client =
        new OpenMetadataClient(
            OpenMetadataConfig.builder()
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/api")
                .build());
    TestCases.setDefaultClient(client);
    GlossaryTerms.setDefaultClient(client);
  }

  @AfterEach
  void stopServer() {
    TestCases.setDefaultClient(null);
    GlossaryTerms.setDefaultClient(null);
    server.stop(0);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void defaultsToSkipWithTypedOutcomes(final boolean testCases) throws IOException {
    responseBody = outcomes(BulkCreateConflictPolicy.SKIP);

    final BulkCreateResult result = request(testCases, false).execute();

    assertRequest(testCases, BulkCreateConflictPolicy.SKIP);
    assertOutcomes(result, BulkCreateConflictPolicy.SKIP);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void supportsExplicitFailWithTypedReasons(final boolean testCases) throws IOException {
    responseBody = outcomes(BulkCreateConflictPolicy.FAIL);

    final BulkCreateResult result =
        request(testCases, false).onConflict(BulkCreateConflictPolicy.FAIL).execute();

    assertRequest(testCases, BulkCreateConflictPolicy.FAIL);
    assertOutcomes(result, BulkCreateConflictPolicy.FAIL);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void sendsEmptyBatchAsAnArray(final boolean testCases) {
    responseBody =
        """
        {"onConflict":"skip","createdCount":0,"skippedCount":0,"failedCount":0,"results":[]}
        """;

    final BulkCreateResult result =
        request(testCases, true).onConflict(BulkCreateConflictPolicy.SKIP).execute();

    assertEquals("[]", received.remove().body());
    assertEquals(0, result.getCreatedCount());
    assertEquals(List.of(), result.getResults());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void propagatesHttpErrors(final boolean testCases) {
    responseStatus = 403;
    responseBody = """
        {"code":403,"message":"Permission denied"}
        """;

    final OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> request(testCases, false).execute());

    assertEquals(403, error.getStatusCode());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void rejectsNullPolicyBeforeSending(final boolean testCases) {
    assertThrows(NullPointerException.class, () -> request(testCases, false).onConflict(null));
    assertEquals(0, received.size());
  }

  private BulkCreateRequest request(final boolean testCases, final boolean empty) {
    if (testCases) {
      final CreateTestCase create =
          new CreateTestCase()
              .withName("row_count")
              .withEntityLink("<#E::table::service.db.schema.table>")
              .withTestDefinition("tableRowCountToEqual");
      return TestCases.createMany(empty ? List.of() : List.of(create, create, create, create));
    }
    final CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName("Revenue")
            .withDescription("Revenue in €")
            .withGlossary("Finance");
    return GlossaryTerms.createMany(empty ? List.of() : List.of(create, create, create, create));
  }

  private void assertRequest(final boolean testCases, final BulkCreateConflictPolicy policy)
      throws IOException {
    final ReceivedRequest sent = received.remove();
    assertEquals("POST", sent.method());
    assertEquals(
        "/api/v1/" + (testCases ? "dataQuality/testCases" : "glossaryTerms") + "/createMany",
        sent.path());
    assertEquals("onConflict=" + policy.value(), sent.query());
    final JsonNode body = MAPPER.readTree(sent.body());
    assertEquals(4, body.size());
    assertEquals(testCases ? "row_count" : "Revenue", body.get(0).get("name").asText());
    assertEquals(
        testCases ? "tableRowCountToEqual" : "Finance",
        body.get(0).get(testCases ? "testDefinition" : "glossary").asText());
    if (testCases) {
      assertEquals("<#E::table::service.db.schema.table>", body.get(0).get("entityLink").asText());
    } else {
      assertEquals("Revenue in €", body.get(0).get("description").asText());
    }
  }

  private void assertOutcomes(
      final BulkCreateResult result, final BulkCreateConflictPolicy policy) {
    assertEquals(policy, result.getOnConflict());
    assertEquals(1, result.getCreatedCount());
    assertEquals(policy == BulkCreateConflictPolicy.SKIP ? 2 : 0, result.getSkippedCount());
    assertEquals(policy == BulkCreateConflictPolicy.SKIP ? 1 : 3, result.getFailedCount());
    assertEquals(
        List.of(0, 1, 2, 3),
        result.getResults().stream().map(BulkCreateItemResult::getIndex).toList());
    final Status conflictStatus =
        policy == BulkCreateConflictPolicy.SKIP ? Status.SKIPPED : Status.FAILED;
    assertEquals(
        List.of(Status.CREATED, conflictStatus, conflictStatus, Status.FAILED),
        result.getResults().stream().map(BulkCreateItemResult::getStatus).toList());
    assertEquals(CREATED_ID, result.getResults().getFirst().getId());
    assertEquals("entity.created", result.getResults().getFirst().getFullyQualifiedName());
    final List<BulkCreateItemResult> conflicts = result.getResults().subList(1, 4);
    assertEquals(
        List.of(Reason.ALREADY_EXISTS, Reason.DUPLICATE_IN_REQUEST, Reason.VALIDATION_ERROR),
        conflicts.stream().map(BulkCreateItemResult::getReason).toList());
    assertEquals(
        List.of("Entity already exists", "Repeated input", "Invalid input"),
        conflicts.stream().map(BulkCreateItemResult::getMessage).toList());
    conflicts.forEach(item -> assertNull(item.getId()));
  }

  private String outcomes(final BulkCreateConflictPolicy policy) {
    final boolean skip = policy == BulkCreateConflictPolicy.SKIP;
    return """
        {"onConflict":"%s","createdCount":1,"skippedCount":%d,"failedCount":%d,"results":[
          {"index":0,"status":"created","id":"%s","fullyQualifiedName":"entity.created"},
          {"index":1,"status":"%s","reason":"ALREADY_EXISTS","message":"Entity already exists"},
          {"index":2,"status":"%s","reason":"DUPLICATE_IN_REQUEST","message":"Repeated input"},
          {"index":3,"status":"failed","reason":"VALIDATION_ERROR","message":"Invalid input"}]}
        """
        .formatted(
            policy.value(),
            skip ? 2 : 0,
            skip ? 1 : 3,
            CREATED_ID,
            skip ? "skipped" : "failed",
            skip ? "skipped" : "failed");
  }

  private void respond(final HttpExchange exchange) throws IOException {
    received.add(
        new ReceivedRequest(
            exchange.getRequestMethod(),
            exchange.getRequestURI().getPath(),
            exchange.getRequestURI().getQuery(),
            new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
    final byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(responseStatus, bytes.length);
    try (exchange) {
      exchange.getResponseBody().write(bytes);
    }
  }

  private record ReceivedRequest(String method, String path, String query, String body) {}
}
