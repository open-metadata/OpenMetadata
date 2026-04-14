/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.providers.WebhookSinkProvider;

class WebhookSinkProviderTest {

  @Test
  void testGetSinkType() {
    Map<String, Object> config = createValidConfig();
    WebhookSinkProvider provider = new WebhookSinkProvider(config);
    assertEquals("webhook", provider.getSinkType());
    provider.close();
  }

  @Test
  void testSupportsBatch() {
    Map<String, Object> config = createValidConfig();
    WebhookSinkProvider provider = new WebhookSinkProvider(config);
    assertTrue(provider.supportsBatch());
    provider.close();
  }

  @Test
  void testValidateWithValidConfig() {
    Map<String, Object> config = createValidConfig();
    WebhookSinkProvider provider = new WebhookSinkProvider(config);
    // Should not throw
    provider.validate(config);
    provider.close();
  }

  @Test
  void testValidateWithMissingEndpoint() {
    Map<String, Object> config = new HashMap<>();
    // No endpoint set
    WebhookSinkProvider provider = new WebhookSinkProvider(createValidConfig());

    assertThrows(IllegalArgumentException.class, () -> provider.validate(config));
    provider.close();
  }

  @Test
  void testValidateWithEmptyEndpoint() {
    Map<String, Object> config = new HashMap<>();
    config.put("endpoint", "");
    WebhookSinkProvider provider = new WebhookSinkProvider(createValidConfig());

    assertThrows(IllegalArgumentException.class, () -> provider.validate(config));
    provider.close();
  }

  @Test
  void testConfigWithHeaders() {
    Map<String, Object> config = createValidConfig();
    Map<String, String> headers = new HashMap<>();
    headers.put("X-Custom-Header", "custom-value");
    headers.put("Content-Type", "application/json");
    config.put("headers", headers);

    WebhookSinkProvider provider = new WebhookSinkProvider(config);
    provider.validate(config);
    provider.close();
  }

  @Test
  void testConfigWithQueryParams() {
    Map<String, Object> config = createValidConfig();
    List<Map<String, String>> queryParams = new ArrayList<>();
    queryParams.add(Map.of("key", "tenant", "value", "acme"));
    queryParams.add(Map.of("key", "region", "value", "us-east-1"));
    config.put("queryParams", queryParams);

    WebhookSinkProvider provider = new WebhookSinkProvider(config);
    provider.validate(config);
    provider.close();
  }

  @Test
  void testConfigWithBearerAuth() {
    Map<String, Object> config = createValidConfig();
    Map<String, Object> auth = new HashMap<>();
    auth.put("type", "bearer");
    auth.put("token", "my-secret-token");
    config.put("authentication", auth);

    WebhookSinkProvider provider = new WebhookSinkProvider(config);
    provider.validate(config);
    provider.close();
  }

  @Test
  void testConfigWithBasicAuth() {
    Map<String, Object> config = createValidConfig();
    Map<String, Object> auth = new HashMap<>();
    auth.put("type", "basic");
    auth.put("username", "user");
    auth.put("password", "pass");
    config.put("authentication", auth);

    WebhookSinkProvider provider = new WebhookSinkProvider(config);
    provider.validate(config);
    provider.close();
  }

  @Test
  void testConfigWithApiKeyAuth() {
    Map<String, Object> config = createValidConfig();
    Map<String, Object> auth = new HashMap<>();
    auth.put("type", "apiKey");
    auth.put("headerName", "X-API-Key");
    auth.put("apiKey", "my-api-key");
    config.put("authentication", auth);

    WebhookSinkProvider provider = new WebhookSinkProvider(config);
    provider.validate(config);
    provider.close();
  }

  @Test
  void testConfigWithHttpMethods() {
    // Test POST (default)
    Map<String, Object> configPost = createValidConfig();
    WebhookSinkProvider providerPost = new WebhookSinkProvider(configPost);
    providerPost.validate(configPost);
    providerPost.close();

    // Test PUT
    Map<String, Object> configPut = createValidConfig();
    configPut.put("httpMethod", "PUT");
    WebhookSinkProvider providerPut = new WebhookSinkProvider(configPut);
    providerPut.validate(configPut);
    providerPut.close();

    // Test PATCH
    Map<String, Object> configPatch = createValidConfig();
    configPatch.put("httpMethod", "PATCH");
    WebhookSinkProvider providerPatch = new WebhookSinkProvider(configPatch);
    providerPatch.validate(configPatch);
    providerPatch.close();
  }

  @Test
  void testClose() {
    Map<String, Object> config = createValidConfig();
    WebhookSinkProvider provider = new WebhookSinkProvider(config);
    // Should not throw
    provider.close();
    // Calling close again should be safe
    provider.close();
  }

  @Test
  void testSinkContextBuilder() {
    SinkContext context =
        SinkContext.builder()
            .sinkConfig(createValidConfig())
            .syncMode("overwrite")
            .outputFormat("json")
            .batchMode(true)
            .workflowExecutionId("exec-123")
            .workflowName("TestWorkflow")
            .build();

    assertEquals("overwrite", context.getSyncMode());
    assertEquals("json", context.getOutputFormat());
    assertTrue(context.isBatchMode());
    assertEquals("exec-123", context.getWorkflowExecutionId());
    assertEquals("TestWorkflow", context.getWorkflowName());
  }

  @Test
  void testWriteAppendsConfiguredQueryParamsToEndpoint() throws IOException {
    AtomicReference<String> requestMethod = new AtomicReference<>();
    AtomicReference<String> rawQuery = new AtomicReference<>();
    HttpServer server = startWebhookServer(requestMethod, rawQuery);

    try {
      Map<String, Object> config = createValidConfig();
      config.put(
          "endpoint",
          "http://localhost:%d/webhook?existing=true".formatted(server.getAddress().getPort()));

      List<Map<String, String>> queryParams = new ArrayList<>();
      queryParams.add(Map.of("key", "tenant", "value", "acme"));
      queryParams.add(Map.of("key", "region", "value", "us-east-1"));
      config.put("queryParams", queryParams);

      WebhookSinkProvider provider = new WebhookSinkProvider(config);
      try {
        SinkResult result =
            provider.write(
                SinkContext.builder().sinkConfig(config).outputFormat("json").build(),
                new TestEntity("sampleEntity"));

        assertTrue(result.isSuccess());
        assertEquals("POST", requestMethod.get());
        assertNotNull(rawQuery.get());
        assertTrue(rawQuery.get().contains("existing=true"));
        assertTrue(rawQuery.get().contains("tenant=acme"));
        assertTrue(rawQuery.get().contains("region=us-east-1"));
      } finally {
        provider.close();
      }
    } finally {
      server.stop(0);
    }
  }

  private Map<String, Object> createValidConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("endpoint", "https://example.com/webhook");
    config.put("httpMethod", "POST");
    config.put("timeout", 30);
    return config;
  }

  private HttpServer startWebhookServer(
      AtomicReference<String> requestMethod, AtomicReference<String> rawQuery) throws IOException {
    HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
    server.createContext(
        "/webhook",
        exchange -> {
          captureRequest(exchange, requestMethod, rawQuery);
          byte[] responseBody = "ok".getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(200, responseBody.length);
          try (OutputStream outputStream = exchange.getResponseBody()) {
            outputStream.write(responseBody);
          }
        });
    server.start();
    return server;
  }

  private void captureRequest(
      HttpExchange exchange,
      AtomicReference<String> requestMethod,
      AtomicReference<String> rawQuery)
      throws IOException {
    requestMethod.set(exchange.getRequestMethod());
    rawQuery.set(exchange.getRequestURI().getRawQuery());
    try (InputStream requestBody = exchange.getRequestBody()) {
      requestBody.readAllBytes();
    }
  }

  private static class TestEntity implements EntityInterface {
    private final UUID id = UUID.randomUUID();
    private final String name;

    private TestEntity(String name) {
      this.name = name;
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(id).withType("table").withName(name);
    }

    @Override
    public UUID getId() {
      return id;
    }

    @Override
    public String getDescription() {
      return "test entity";
    }

    @Override
    public String getDisplayName() {
      return name;
    }

    @Override
    public String getName() {
      return name;
    }

    @Override
    public Double getVersion() {
      return 1.0;
    }

    @Override
    public String getUpdatedBy() {
      return "test";
    }

    @Override
    public Long getUpdatedAt() {
      return System.currentTimeMillis();
    }

    @Override
    public URI getHref() {
      return null;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return null;
    }

    @Override
    public ChangeDescription getIncrementalChangeDescription() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return "test.table." + name;
    }

    @Override
    public void setId(UUID id) {}

    @Override
    public void setDescription(String description) {}

    @Override
    public void setDisplayName(String displayName) {}

    @Override
    public void setName(String name) {}

    @Override
    public void setVersion(Double newVersion) {}

    @Override
    public void setChangeDescription(ChangeDescription changeDescription) {}

    @Override
    public void setIncrementalChangeDescription(ChangeDescription incrementalChangeDescription) {}

    @Override
    public void setFullyQualifiedName(String fullyQualifiedName) {}

    @Override
    public void setUpdatedBy(String admin) {}

    @Override
    public void setUpdatedAt(Long updatedAt) {}

    @Override
    public void setHref(URI href) {}

    @Override
    @SuppressWarnings("unchecked")
    public <T extends EntityInterface> T withHref(URI href) {
      return (T) this;
    }
  }
}
