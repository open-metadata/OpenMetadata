package org.openmetadata.sdk.fluent.builders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
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
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;

/**
 * Regression coverage for the bug where {@link TestDefinitionBuilder#create()} and
 * {@link TestDefinitionBuilder#createOrUpdate()} converted the built {@code CreateTestDefinition}
 * request into a bare {@code TestDefinition} entity (carrying only name/displayName/description)
 * and POSTed/PUT that entity. The server validates {@code @Valid CreateTestDefinition} whose
 * schema requires {@code entityType} and {@code testPlatforms}, so every call failed with HTTP
 * 400. The fix sends the {@code CreateTestDefinition} request directly to the typed
 * {@code TestDefinitionService.create/upsert(CreateTestDefinition)} overloads, matching
 * {@code TestCaseBuilder}/{@code TestCaseService}.
 */
class TestDefinitionBuilderTest {

  private static final TestDefinitionEntityType TABLE = TestDefinitionEntityType.TABLE;
  private static final TestPlatform OPEN_METADATA = TestPlatform.OPEN_METADATA;

  // ===================================================================================
  // build() validation and field propagation
  // ===================================================================================

  @Test
  void buildValidatesNameIsRequired() {
    final TestDefinitionBuilder builder =
        new TestDefinitionBuilder(null).entityType(TABLE).testPlatforms(List.of(OPEN_METADATA));
    final IllegalStateException ex = assertThrows(IllegalStateException.class, builder::build);
    assertEquals("TestDefinition name is required", ex.getMessage());
  }

  @Test
  void buildValidatesEntityTypeIsRequired() {
    final TestDefinitionBuilder builder =
        new TestDefinitionBuilder(null).name("x").testPlatforms(List.of(OPEN_METADATA));
    final IllegalStateException ex = assertThrows(IllegalStateException.class, builder::build);
    assertEquals("TestDefinition entityType is required", ex.getMessage());
  }

  @Test
  void buildValidatesTestPlatformsIsRequiredAndNonEmpty() {
    final IllegalStateException missingEx =
        assertThrows(
            IllegalStateException.class,
            () -> new TestDefinitionBuilder(null).name("x").entityType(TABLE).build());
    assertEquals(
        "TestDefinition testPlatforms is required and must not be empty", missingEx.getMessage());

    // testPlatforms defaults to an empty list in CreateTestDefinition; build() must reject it.
    final CreateTestDefinition req = new CreateTestDefinition();
    req.setName("x");
    req.setEntityType(TABLE);
    assertNotNull(req.getTestPlatforms());
    assertEquals(0, req.getTestPlatforms().size());
    final IllegalStateException emptyEx =
        assertThrows(
            IllegalStateException.class,
            () ->
                new TestDefinitionBuilder(null)
                    .name("x")
                    .entityType(TABLE)
                    .testPlatforms(List.of())
                    .build());
    assertEquals(
        "TestDefinition testPlatforms is required and must not be empty", emptyEx.getMessage());
  }

  @Test
  void buildPropagatesAllFieldsToTheCreateRequest() {
    final EntityReference owner = new EntityReference().withId(UUID.randomUUID()).withType("user");
    final CreateTestDefinition request =
        new TestDefinitionBuilder(null)
            .name("table_column_value_to_be_not_null")
            .displayName("Column Not Null")
            .description("Test that column values are not null")
            .entityType(TestDefinitionEntityType.COLUMN)
            .testPlatforms(List.of(OPEN_METADATA, TestPlatform.GREAT_EXPECTATIONS))
            .owner(owner)
            .supportedDataTypes(List.of(ColumnDataType.STRING))
            .provider(ProviderType.USER)
            .dataQualityDimension("Validity")
            .supportedServices(List.of("mysql"))
            .domains(List.of("Marketing"))
            .sqlExpression("SELECT 1")
            .validatorClass("ruleLibrarySqlExpressionValidator")
            .build();

    assertEquals("table_column_value_to_be_not_null", request.getName());
    assertEquals("Column Not Null", request.getDisplayName());
    assertEquals("Test that column values are not null", request.getDescription());
    assertEquals(TestDefinitionEntityType.COLUMN, request.getEntityType());
    assertEquals(
        List.of(OPEN_METADATA, TestPlatform.GREAT_EXPECTATIONS), request.getTestPlatforms());
    assertEquals(List.of(owner), request.getOwners());
    assertEquals(List.of(ColumnDataType.STRING), request.getSupportedDataTypes());
    assertEquals(ProviderType.USER, request.getProvider());
    assertEquals("Validity", request.getDataQualityDimension());
    assertEquals(List.of("mysql"), request.getSupportedServices());
    assertEquals(List.of("Marketing"), request.getDomains());
    assertEquals("SELECT 1", request.getSqlExpression());
    assertEquals("ruleLibrarySqlExpressionValidator", request.getValidatorClass());
  }

  @Test
  void testPlatformAppendsToTheBuilderOwnedList() {
    final CreateTestDefinition request =
        new TestDefinitionBuilder(null)
            .name("x")
            .entityType(TABLE)
            .testPlatform(OPEN_METADATA)
            .testPlatform(TestPlatform.DBT)
            .build();
    assertEquals(List.of(OPEN_METADATA, TestPlatform.DBT), request.getTestPlatforms());
  }

  @Test
  void testPlatformAppendsAfterTestPlatformsReceivesAnImmutableList() {
    // testPlatforms() must copy its argument into a builder-owned mutable list, otherwise
    // chaining .testPlatform(...) after .testPlatforms(List.of(...)) throws
    // UnsupportedOperationException because List.of(...) is unmodifiable.
    final CreateTestDefinition request =
        new TestDefinitionBuilder(null)
            .name("x")
            .entityType(TABLE)
            .testPlatforms(List.of(OPEN_METADATA))
            .testPlatform(TestPlatform.DBT)
            .build();
    assertEquals(List.of(OPEN_METADATA, TestPlatform.DBT), request.getTestPlatforms());
  }

  @Test
  void buildReturnsTheSameRequestInstanceAndDoesNotMutateAfterBuild() {
    final TestDefinitionBuilder builder =
        new TestDefinitionBuilder(null)
            .name("x")
            .entityType(TABLE)
            .testPlatforms(List.of(OPEN_METADATA));
    final CreateTestDefinition first = builder.build();
    final CreateTestDefinition second = builder.build();
    assertSame(first, second);
  }

  // ===================================================================================
  // Wire-level tests: the actual JSON sent to the server preserves required fields
  // ===================================================================================

  private static final String TEST_DEFINITION_RESPONSE =
      "{\"id\":\"550e8400-e29b-41d4-a716-446655440000\","
          + "\"name\":\"table_row_count_to_equal\","
          + "\"fullyQualifiedName\":\"table_row_count_to_equal\","
          + "\"entityType\":\"TABLE\","
          + "\"testPlatforms\":[\"OpenMetadata\"]}";

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private record ReceivedRequest(String method, String path, String body) {}

  private ReceivedRequest captureRequest(String responseBody, Consumer<OpenMetadataClient> action)
      throws IOException {
    final AtomicReference<ReceivedRequest> received = new AtomicReference<>();
    final HttpServer server = newCaptureServer(responseBody, received);
    server.start();
    try {
      action.accept(newClient(server));
    } finally {
      server.stop(0);
    }
    return received.get();
  }

  private HttpServer newCaptureServer(
      String responseBody, AtomicReference<ReceivedRequest> received) throws IOException {
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/v1/", ex -> handleCapture(ex, responseBody, received));
    return server;
  }

  private void handleCapture(
      HttpExchange ex, String responseBody, AtomicReference<ReceivedRequest> received)
      throws IOException {
    final String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    received.set(new ReceivedRequest(ex.getRequestMethod(), ex.getRequestURI().getPath(), body));
    final byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
    ex.getResponseHeaders().add("Content-Type", "application/json");
    ex.sendResponseHeaders(200, bytes.length);
    try (ex) {
      ex.getResponseBody().write(bytes);
    }
  }

  private OpenMetadataClient newClient(HttpServer server) {
    return new OpenMetadataClient(
        OpenMetadataConfig.builder()
            .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/api")
            .build());
  }

  @Test
  void createPostsCreateTestDefinitionWithRequiredFieldsOverTheWire() throws IOException {
    final ReceivedRequest sent =
        captureRequest(
            TEST_DEFINITION_RESPONSE,
            client ->
                new TestDefinitionBuilder(client)
                    .name("table_row_count_to_equal")
                    .description("Counts table rows")
                    .entityType(TABLE)
                    .testPlatforms(List.of(OPEN_METADATA))
                    .create());

    assertEquals("POST", sent.method());
    assertEquals("/api/v1/dataQuality/testDefinitions", sent.path());

    final JsonNode body = MAPPER.readTree(sent.body());
    assertEquals("table_row_count_to_equal", body.get("name").asText());
    assertEquals("Counts table rows", body.get("description").asText());
    assertEquals("TABLE", body.get("entityType").asText());
    assertEquals(1, body.get("testPlatforms").size());
    assertEquals("OpenMetadata", body.get("testPlatforms").get(0).asText());
    // The buggy path serialized a bare TestDefinition entity that lacked entityType entirely;
    // assert the field is present so the server-side @NotNull validation can pass.
    assertNotNull(body.get("entityType"));
  }

  @Test
  void createOrUpdatePutsCreateTestDefinitionWithRequiredFieldsOverTheWire() throws IOException {
    final ReceivedRequest sent =
        captureRequest(
            TEST_DEFINITION_RESPONSE,
            client ->
                new TestDefinitionBuilder(client)
                    .name("table_row_count_to_equal")
                    .entityType(TABLE)
                    .testPlatforms(List.of(OPEN_METADATA))
                    .createOrUpdate());

    assertEquals("PUT", sent.method());
    assertEquals("/api/v1/dataQuality/testDefinitions", sent.path());

    final JsonNode body = MAPPER.readTree(sent.body());
    assertEquals("table_row_count_to_equal", body.get("name").asText());
    assertEquals("TABLE", body.get("entityType").asText());
    assertEquals(1, body.get("testPlatforms").size());
    assertEquals("OpenMetadata", body.get("testPlatforms").get(0).asText());
    assertNotNull(body.get("entityType"));
  }

  @Test
  void createDeserializesTheResponseIntoATestDefinition() throws IOException {
    final TestDefinition[] holder = new TestDefinition[1];
    captureRequest(
        TEST_DEFINITION_RESPONSE,
        client ->
            holder[0] =
                new TestDefinitionBuilder(client)
                    .name("table_row_count_to_equal")
                    .entityType(TABLE)
                    .testPlatforms(List.of(OPEN_METADATA))
                    .create());
    assertNotNull(holder[0]);
    assertEquals("table_row_count_to_equal", holder[0].getName());
    assertEquals(TABLE, holder[0].getEntityType());
    assertEquals(List.of(OPEN_METADATA), holder[0].getTestPlatforms());
  }
}
