package org.openmetadata.sdk.resources;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;

class BaseResourceTest {

  @Mock private HttpClient httpClient;

  private BaseResource<TestEntity> resource;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    resource =
        new BaseResource<TestEntity>(httpClient, "/v1/test-entities") {
          @Override
          protected Class<TestEntity> getEntityClass() {
            return TestEntity.class;
          }
        };
  }

  @Test
  void updateWithSnapshotCanEmitRemoveForClearedField() {
    String id = "entity-1";
    TestEntity original = new TestEntity(id, "table_a", List.of("PII.None"), "old");

    when(httpClient.execute(
            eq(HttpMethod.GET), eq("/v1/test-entities/" + id), isNull(), eq(TestEntity.class)))
        .thenReturn(original);

    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    TestEntity response = new TestEntity(id, "table_a", null, "old");
    when(httpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/test-entities/" + id),
            patchCaptor.capture(),
            eq(TestEntity.class),
            isNull()))
        .thenReturn(response);

    resource.get(id); // stores snapshot with tags populated

    TestEntity updated = new TestEntity(id, "table_a", null, "old");
    TestEntity result = resource.update(id, updated);

    assertNotNull(result);
    JsonNode patch = patchCaptor.getValue();
    assertTrue(hasPatchOp(patch, "remove", "/tags"));
    verify(httpClient, times(1))
        .execute(eq(HttpMethod.GET), eq("/v1/test-entities/" + id), isNull(), eq(TestEntity.class));
  }

  @Test
  void updateWithoutSnapshotDoesNotRemoveUnspecifiedFields() {
    String id = "entity-2";
    TestEntity original = new TestEntity(id, "table_b", List.of("PII.Sensitive"), "old");

    when(httpClient.execute(
            eq(HttpMethod.GET), eq("/v1/test-entities/" + id), isNull(), eq(TestEntity.class)))
        .thenReturn(original);

    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    TestEntity response = new TestEntity(id, "table_b", List.of("PII.Sensitive"), "new");
    when(httpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/test-entities/" + id),
            patchCaptor.capture(),
            eq(TestEntity.class),
            isNull()))
        .thenReturn(response);

    TestEntity updated = new TestEntity();
    updated.setId(id);
    updated.setDescription("new");
    TestEntity result = resource.update(id, updated);

    assertNotNull(result);
    JsonNode patch = patchCaptor.getValue();
    assertFalse(hasPatchOp(patch, "remove", "/tags"));
    assertFalse(hasPatchOp(patch, "remove", "/name"));
    assertTrue(hasPatchOp(patch, "replace", "/description"));
    verify(httpClient, times(1))
        .execute(eq(HttpMethod.GET), eq("/v1/test-entities/" + id), isNull(), eq(TestEntity.class));
  }

  @Test
  void listDeserializesConcreteSubclassElementsOverHttp() throws IOException {
    String body =
        """
        {
          "data": [
            {
              "id": "entity-10",
              "name": "orders",
              "tags": ["PII.Sensitive"],
              "description": "Orders table",
              "unknownFutureField": "ignored"
            },
            {
              "id": "entity-11",
              "name": "customers",
              "tags": [],
              "description": "Customers table"
            }
          ],
          "paging": {
            "total": 2,
            "after": "next-cursor"
          }
        }
        """;
    AtomicReference<String> capturedQuery = new AtomicReference<>();
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/api/v1/test-entities",
        exchange -> {
          capturedQuery.set(exchange.getRequestURI().getRawQuery());
          byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, bytes.length);
          try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
          }
        });
    server.start();
    try {
      OpenMetadataHttpClient realClient =
          new OpenMetadataHttpClient(
              OpenMetadataConfig.builder()
                  .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/api")
                  .build());
      BaseResource<TestEntity> realResource =
          new BaseResource<TestEntity>(realClient, "/v1/test-entities") {
            @Override
            protected Class<TestEntity> getEntityClass() {
              return TestEntity.class;
            }
          };

      ListResponse<TestEntity> response = realResource.list(new ListParams().setLimit(25));

      assertEquals("limit=25", capturedQuery.get());
      assertNotNull(response);
      assertEquals(2, response.getTotal());
      assertEquals("next-cursor", response.getPaging().getAfter());
      List<String> names = new ArrayList<>();
      for (TestEntity entity : response.getData()) {
        assertNotNull(entity.getId());
        names.add(entity.getName());
      }
      assertEquals(List.of("orders", "customers"), names);
      assertEquals(List.of("PII.Sensitive"), response.getData().getFirst().getTags());

      ListResponse<TestEntity> defaultListResponse = realResource.list();
      assertEquals(2, defaultListResponse.getData().size());
      assertEquals("entity-10", defaultListResponse.getData().getFirst().getId());

      ListResponse<TestEntity> nullParamsResponse = realResource.list(null);
      assertNull(capturedQuery.get());
      assertEquals("entity-11", nullParamsResponse.getData().getLast().getId());
    } finally {
      server.stop(0);
    }
  }

  private static boolean hasPatchOp(JsonNode patch, String op, String path) {
    if (patch == null || !patch.isArray()) {
      return false;
    }
    for (JsonNode operation : patch) {
      if (op.equals(operation.path("op").asText())
          && path.equals(operation.path("path").asText())) {
        return true;
      }
    }
    return false;
  }

  static class TestEntity {
    private String id;
    private String name;
    private List<String> tags;
    private String description;

    TestEntity() {}

    TestEntity(String id, String name, List<String> tags, String description) {
      this.id = id;
      this.name = name;
      this.tags = tags;
      this.description = description;
    }

    public String getId() {
      return id;
    }

    public void setId(String id) {
      this.id = id;
    }

    public String getName() {
      return name;
    }

    public void setName(String name) {
      this.name = name;
    }

    public List<String> getTags() {
      return tags;
    }

    public void setTags(List<String> tags) {
      this.tags = tags;
    }

    public String getDescription() {
      return description;
    }

    public void setDescription(String description) {
      this.description = description;
    }
  }
}
