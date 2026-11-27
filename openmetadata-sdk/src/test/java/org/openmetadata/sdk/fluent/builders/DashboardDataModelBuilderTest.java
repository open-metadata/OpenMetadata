package org.openmetadata.sdk.fluent.builders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;

/**
 * Regression coverage for the bug introduced in commit {@code bb1395fc72} (PR #23239) where {@link
 * DashboardDataModelBuilder#create()} / {@link DashboardDataModelBuilder#createOrUpdate()}
 * hand-converted the {@link CreateDashboardDataModel} request into a stripped {@link
 * DashboardDataModel} entity and posted that, dropping the required {@code service}, {@code
 * dataModelType} and {@code columns} fields so every call failed with HTTP 400 bean validation.
 * The fix posts the {@code CreateDashboardDataModel} request directly and exposes setters for the
 * required fields, mirroring {@code TableBuilder}, {@code DatabaseBuilder}, {@code UserBuilder}
 * and the pure-fluent {@code DashboardDataModels.DashboardDataModelCreator}.
 *
 * <p>The builder is driven through a real {@link OpenMetadataClient} (and therefore a real {@link
 * org.openmetadata.sdk.services.dataassets.DashboardDataModelService}) pointed at a stub HTTP
 * server, so the assertions check the request that actually crosses the wire — the method, path
 * and body — rather than mock wiring against internal classes.
 */
class DashboardDataModelBuilderTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String NAME = "dm_test";
  private static final String SERVICE = "superset";
  private static final DataModelType MODEL_TYPE = DataModelType.SupersetDataModel;
  private static final List<Column> COLUMNS =
      List.of(new Column().withName("id").withDataType(ColumnDataType.INT));
  private static final String EXPECTED_PATH = "/api/v1/dashboard/datamodels";

  private HttpServer server;
  private OpenMetadataClient client;
  private final Deque<ReceivedRequest> received = new ArrayDeque<>();
  private String responseBody = "{}";

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/", this::respond);
    server.start();
    client =
        new OpenMetadataClient(
            OpenMetadataConfig.builder()
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/api")
                .build());
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void createPostsCreateDashboardDataModelRequestNotEntity() throws IOException {
    responseBody = "{\"name\":\"" + NAME + "\"}";

    DashboardDataModel result =
        new DashboardDataModelBuilder(client)
            .name(NAME)
            .displayName("Dm Test")
            .description("A test data model")
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(COLUMNS)
            .create();

    // The Create.Create* overload must be invoked (the old buggy code called the entity-level
    // create(DashboardDataModel) overload inherited from EntityServiceBase, dropping required
    // fields). The request that crosses the wire must carry every required field.
    assertEquals(NAME, result.getName());
    ReceivedRequest sent = received.remove();
    assertEquals("POST", sent.method());
    assertEquals(EXPECTED_PATH, sent.path());

    JsonNode body = MAPPER.readTree(sent.body());
    assertEquals(NAME, body.get("name").asText());
    assertEquals(SERVICE, body.get("service").asText());
    assertEquals(MODEL_TYPE.value(), body.get("dataModelType").asText());
    assertEquals(1, body.get("columns").size());
    assertEquals("id", body.get("columns").get(0).get("name").asText());
    assertEquals("A test data model", body.get("description").asText());
    assertEquals("Dm Test", body.get("displayName").asText());
  }

  @Test
  void createOrUpdateUpsertsCreateDashboardDataModelRequestNotEntity() throws IOException {
    responseBody = "{\"name\":\"" + NAME + "\"}";

    DashboardDataModel result =
        new DashboardDataModelBuilder(client)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(COLUMNS)
            .createOrUpdate();

    assertEquals(NAME, result.getName());
    ReceivedRequest sent = received.remove();
    assertEquals("PUT", sent.method());
    assertEquals(EXPECTED_PATH, sent.path());

    JsonNode body = MAPPER.readTree(sent.body());
    assertEquals(NAME, body.get("name").asText());
    assertEquals(SERVICE, body.get("service").asText());
    assertEquals(MODEL_TYPE.value(), body.get("dataModelType").asText());
    assertEquals(1, body.get("columns").size());
  }

  @Test
  void createPostsTheExactRequestReturnedByBuild() throws IOException {
    responseBody = "{}";

    DashboardDataModelBuilder builder =
        new DashboardDataModelBuilder(client)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(COLUMNS);

    CreateDashboardDataModel built = builder.build();
    builder.create();

    ReceivedRequest sent = received.remove();
    assertEquals("POST", sent.method());
    assertEquals(EXPECTED_PATH, sent.path());
    assertEquals(MAPPER.writeValueAsString(built), sent.body());
  }

  @Test
  void requiredSettersPropagateToBuildRequest() {
    CreateDashboardDataModel request =
        new DashboardDataModelBuilder(null)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(COLUMNS)
            .build();

    assertEquals(NAME, request.getName());
    assertEquals(SERVICE, request.getService());
    assertEquals(MODEL_TYPE, request.getDataModelType());
    assertEquals(COLUMNS, request.getColumns());
  }

  @Test
  void columnsVarargsPropagateToBuildRequest() {
    Column first = new Column().withName("id").withDataType(ColumnDataType.INT);
    Column second = new Column().withName("name").withDataType(ColumnDataType.VARCHAR);

    CreateDashboardDataModel request =
        new DashboardDataModelBuilder(null)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(first, second)
            .build();

    assertEquals(List.of(first, second), request.getColumns());
  }

  @Test
  void buildRequiresName() {
    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class, () -> new DashboardDataModelBuilder(null).build());
    assertEquals("DashboardDataModel name is required", ex.getMessage());
  }

  @Test
  void buildRequiresService() {
    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () ->
                new DashboardDataModelBuilder(null)
                    .name(NAME)
                    .dataModelType(MODEL_TYPE)
                    .columns(COLUMNS)
                    .build());
    assertEquals("DashboardDataModel service is required", ex.getMessage());
  }

  @Test
  void buildRequiresDataModelType() {
    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () ->
                new DashboardDataModelBuilder(null)
                    .name(NAME)
                    .service(SERVICE)
                    .columns(COLUMNS)
                    .build());
    assertEquals("DashboardDataModel dataModelType is required", ex.getMessage());
  }

  @Test
  void buildRequiresColumns() {
    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () ->
                new DashboardDataModelBuilder(null)
                    .name(NAME)
                    .service(SERVICE)
                    .dataModelType(MODEL_TYPE)
                    .build());
    assertEquals("DashboardDataModel columns is required", ex.getMessage());
  }

  @Test
  void createValidatesRequiredFieldsBeforeCallingTheService() {
    // build() must reject a missing required field before the request reaches the wire, so the
    // builder surfaces a clear error rather than a doomed HTTP call.
    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () -> new DashboardDataModelBuilder(client).name(NAME).create());
    assertEquals("DashboardDataModel service is required", ex.getMessage());
    assertTrue(received.isEmpty(), "no HTTP request should have been sent");
  }

  @Test
  void emptyColumnsListIsAcceptedAsRequiredField() {
    // The schema marks columns as required (present); an empty list must satisfy build().
    CreateDashboardDataModel request =
        new DashboardDataModelBuilder(null)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(List.of())
            .build();
    assertNotNull(request.getColumns());
    assertNull(request.getExtension());
  }

  private void respond(HttpExchange exchange) throws IOException {
    received.add(
        new ReceivedRequest(
            exchange.getRequestMethod(),
            exchange.getRequestURI().getPath(),
            new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
    byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(200, bytes.length);
    try (exchange) {
      exchange.getResponseBody().write(bytes);
    }
  }

  private record ReceivedRequest(String method, String path, String body) {}
}
