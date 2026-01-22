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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
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

  private Map<String, Object> createValidConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("endpoint", "https://example.com/webhook");
    config.put("httpMethod", "POST");
    config.put("timeout", 30);
    return config;
  }
}
