package org.openmetadata.sdk.services.domains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;

/**
 * Exercises {@link DataProductService.InputPortsAPI#list} and {@link
 * DataProductService.OutputPortsAPI#list} against a real embedded HTTP server returning flattened
 * heterogeneous {@code EntityWithType} payloads.
 */
class DataProductServiceTest {

  private static final UUID DATA_PRODUCT_ID =
      UUID.fromString("00000000-0000-0000-0000-000000000401");
  private static final UUID TABLE_ID = UUID.fromString("00000000-0000-0000-0000-000000000402");
  private static final UUID TOPIC_ID = UUID.fromString("00000000-0000-0000-0000-000000000403");

  private static final String HETEROGENEOUS_PORTS_JSON =
      """
      {
        "data": [
          {
            "entityType": "table",
            "id": "%s",
            "name": "orders",
            "fullyQualifiedName": "svc.db.schema.orders",
            "columns": [
              {"name": "order_id", "dataType": "BIGINT"}
            ]
          },
          {
            "entityType": "topic",
            "id": "%s",
            "name": "orders_events",
            "fullyQualifiedName": "kafka.orders_events",
            "partitions": 12
          }
        ],
        "paging": {
          "total": 2,
          "offset": 0
        }
      }
      """
          .formatted(TABLE_ID, TOPIC_ID);

  private HttpServer server;
  private final List<ReceivedRequest> received = new CopyOnWriteArrayList<>();
  private volatile Function<ReceivedRequest, StubResponse> responder =
      req -> StubResponse.json(200, HETEROGENEOUS_PORTS_JSON);

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/v1/dataProducts", this::handle);
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void inputPortsListDeserializesHeterogeneousEntitiesAndPaging() {
    ResultList<?> byId = newService().inputPorts(DATA_PRODUCT_ID).list("columns,owners", 25, 10);

    assertEquals(1, received.size());
    ReceivedRequest byIdRequest = received.getFirst();
    assertEquals("GET", byIdRequest.method());
    assertEquals("/api/v1/dataProducts/" + DATA_PRODUCT_ID + "/inputPorts", byIdRequest.rawPath());
    assertEquals(
        Map.of("fields", "columns,owners", "limit", "25", "offset", "10"),
        parseQuery(byIdRequest.rawQuery()));
    assertHeterogeneousPorts(byId);

    ResultList<?> byName = newService().inputPorts("sales_dp").list();
    assertEquals("/api/v1/dataProducts/name/sales_dp/inputPorts", received.get(1).rawPath());
    assertEquals(Map.of("limit", "50", "offset", "0"), parseQuery(received.get(1).rawQuery()));
    assertHeterogeneousPorts(byName);
  }

  @Test
  void outputPortsListDeserializesHeterogeneousEntitiesAndPropagatesErrors() {
    ResultList<?> byId = newService().outputPorts(DATA_PRODUCT_ID).list(20, 5);

    assertEquals(1, received.size());
    assertEquals(
        "/api/v1/dataProducts/" + DATA_PRODUCT_ID + "/outputPorts", received.getFirst().rawPath());
    assertEquals(Map.of("limit", "20", "offset", "5"), parseQuery(received.getFirst().rawQuery()));
    assertHeterogeneousPorts(byId);

    ResultList<?> byName = newService().outputPorts("sales_dp").list("owners", 10, 0);
    assertEquals("/api/v1/dataProducts/name/sales_dp/outputPorts", received.get(1).rawPath());
    assertEquals(
        Map.of("fields", "owners", "limit", "10", "offset", "0"),
        parseQuery(received.get(1).rawQuery()));
    assertHeterogeneousPorts(byName);

    responder = req -> StubResponse.json(404, "{\"code\":404,\"message\":\"Not found\"}");
    ApiException notFound =
        assertThrows(ApiException.class, () -> newService().outputPorts(DATA_PRODUCT_ID).list());
    assertEquals(404, notFound.getStatusCode());
  }

  @Test
  void inputAndOutputPortsRejectNonObjectElements() {
    responder =
        req -> StubResponse.json(200, "{\"data\":[\"not-an-object\"],\"paging\":{\"total\":1}}");

    assertThrows(
        OpenMetadataException.class,
        () -> newService().inputPorts(DATA_PRODUCT_ID).list("columns", 10, 0));
    assertThrows(
        OpenMetadataException.class,
        () -> newService().outputPorts(DATA_PRODUCT_ID).list("columns", 10, 0));
  }

  @SuppressWarnings("unchecked")
  private static void assertHeterogeneousPorts(ResultList<?> result) {
    assertNotNull(result);
    assertNotNull(result.getData());
    assertEquals(2, result.getData().size());
    assertNotNull(result.getPaging());
    assertEquals(2, result.getPaging().getTotal());

    Map<String, Object> tablePort = assertInstanceOf(Map.class, result.getData().get(0));
    assertEquals("table", tablePort.get("entityType"));
    assertEquals(TABLE_ID.toString(), tablePort.get("id"));
    assertEquals("orders", tablePort.get("name"));
    List<Map<String, Object>> columns = assertInstanceOf(List.class, tablePort.get("columns"));
    assertEquals(1, columns.size());
    assertEquals("order_id", columns.getFirst().get("name"));

    Map<String, Object> topicPort = assertInstanceOf(Map.class, result.getData().get(1));
    assertEquals("topic", topicPort.get("entityType"));
    assertEquals(TOPIC_ID.toString(), topicPort.get("id"));
    assertEquals(12, topicPort.get("partitions"));
  }

  private DataProductService newService() {
    return new DataProductService(
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
    byte[] bytes = response.body().getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(response.status(), bytes.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(bytes);
    }
  }

  private static Map<String, String> parseQuery(String rawQuery) {
    Map<String, String> result = new LinkedHashMap<>();
    if (rawQuery == null || rawQuery.isEmpty()) {
      return result;
    }
    for (String pair : rawQuery.split("&")) {
      int idx = pair.indexOf('=');
      if (idx >= 0) {
        result.put(
            URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8),
            URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8));
      }
    }
    return result;
  }

  private record ReceivedRequest(String method, String rawPath, String rawQuery) {}

  private record StubResponse(int status, String body) {
    static StubResponse json(int status, String body) {
      return new StubResponse(status, body);
    }
  }
}
