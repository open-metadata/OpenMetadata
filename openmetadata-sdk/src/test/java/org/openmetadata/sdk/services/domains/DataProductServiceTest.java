package org.openmetadata.sdk.services.domains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.testing.EmbeddedHttpServer;
import org.openmetadata.sdk.testing.EmbeddedHttpServer.ReceivedRequest;

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

  private EmbeddedHttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = EmbeddedHttpServer.start("/v1/dataProducts");
    server.respond(200, HETEROGENEOUS_PORTS_JSON);
  }

  @AfterEach
  void stopServer() {
    server.close();
  }

  @Test
  void inputPortsListDeserializesHeterogeneousEntitiesAndPaging() {
    ResultList<?> byId = newService().inputPorts(DATA_PRODUCT_ID).list("columns,owners", 25, 10);

    assertEquals(1, server.requests().size());
    ReceivedRequest byIdRequest = server.requests().getFirst();
    assertEquals("GET", byIdRequest.method());
    assertEquals("/api/v1/dataProducts/" + DATA_PRODUCT_ID + "/inputPorts", byIdRequest.rawPath());
    assertEquals(
        Map.of("fields", "columns,owners", "limit", "25", "offset", "10"), byIdRequest.query());
    assertHeterogeneousPorts(byId);

    ResultList<?> byName = newService().inputPorts("sales_dp").list();
    ReceivedRequest byNameRequest = server.requests().get(1);
    assertEquals("/api/v1/dataProducts/name/sales_dp/inputPorts", byNameRequest.rawPath());
    assertEquals(Map.of("limit", "50", "offset", "0"), byNameRequest.query());
    assertHeterogeneousPorts(byName);
  }

  @Test
  void outputPortsListDeserializesHeterogeneousEntitiesAndPropagatesErrors() {
    ResultList<?> byId = newService().outputPorts(DATA_PRODUCT_ID).list(20, 5);

    assertEquals(1, server.requests().size());
    ReceivedRequest byIdRequest = server.requests().getFirst();
    assertEquals("/api/v1/dataProducts/" + DATA_PRODUCT_ID + "/outputPorts", byIdRequest.rawPath());
    assertEquals(Map.of("limit", "20", "offset", "5"), byIdRequest.query());
    assertHeterogeneousPorts(byId);

    ResultList<?> byName = newService().outputPorts("sales_dp").list("owners", 10, 0);
    ReceivedRequest byNameRequest = server.requests().get(1);
    assertEquals("/api/v1/dataProducts/name/sales_dp/outputPorts", byNameRequest.rawPath());
    assertEquals(Map.of("fields", "owners", "limit", "10", "offset", "0"), byNameRequest.query());
    assertHeterogeneousPorts(byName);

    server.respond(404, "{\"code\":404,\"message\":\"Not found\"}");
    ApiException notFound =
        assertThrows(ApiException.class, () -> newService().outputPorts(DATA_PRODUCT_ID).list());
    assertEquals(404, notFound.getStatusCode());
  }

  @Test
  void inputAndOutputPortsRejectNonObjectElements() {
    server.respond(200, "{\"data\":[\"not-an-object\"],\"paging\":{\"total\":1}}");

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
    return new DataProductService(server.httpClient());
  }
}
