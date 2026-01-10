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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.providers;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.Authentication;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.WebhookSinkConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.SinkContext;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.SinkProvider;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.SinkResult;

/**
 * Sink provider that sends entity data to HTTP webhook endpoints.
 *
 * <p>Supports various authentication methods (bearer, basic, API key) and HTTP methods (POST, PUT,
 * PATCH).
 */
@Slf4j
public class WebhookSinkProvider implements SinkProvider {

  private final WebhookSinkConfig config;
  private final Client client;

  public WebhookSinkProvider(Object rawConfig) {
    this.config = JsonUtils.convertValue(rawConfig, WebhookSinkConfig.class);
    this.client = ClientBuilder.newClient();
  }

  @Override
  public String getSinkType() {
    return "webhook";
  }

  @Override
  public SinkResult write(SinkContext context, EntityInterface entity) {
    try {
      String payload = serializeEntity(entity, context.getOutputFormat());

      Response response = sendRequest(payload);

      boolean success = response.getStatus() >= 200 && response.getStatus() < 300;

      if (success) {
        return SinkResult.builder()
            .success(true)
            .syncedCount(1)
            .failedCount(0)
            .syncedEntities(List.of(entity.getFullyQualifiedName()))
            .metadata(Map.of("statusCode", response.getStatus()))
            .build();
      } else {
        return SinkResult.builder()
            .success(false)
            .syncedCount(0)
            .failedCount(1)
            .errors(
                List.of(
                    SinkResult.SinkError.builder()
                        .entityFqn(entity.getFullyQualifiedName())
                        .errorMessage(
                            "HTTP "
                                + response.getStatus()
                                + ": "
                                + response.readEntity(String.class))
                        .errorCode(String.valueOf(response.getStatus()))
                        .build()))
            .metadata(Map.of("statusCode", response.getStatus()))
            .build();
      }

    } catch (Exception e) {
      LOG.error("Failed to send entity to webhook: {}", entity.getFullyQualifiedName(), e);
      return SinkResult.failure(entity.getFullyQualifiedName(), e);
    }
  }

  @Override
  public SinkResult writeBatch(SinkContext context, List<EntityInterface> entities) {
    List<String> synced = new ArrayList<>();
    List<SinkResult.SinkError> errors = new ArrayList<>();

    for (EntityInterface entity : entities) {
      try {
        String payload = serializeEntity(entity, context.getOutputFormat());
        Response response = sendRequest(payload);

        if (response.getStatus() >= 200 && response.getStatus() < 300) {
          synced.add(entity.getFullyQualifiedName());
        } else {
          errors.add(
              SinkResult.SinkError.builder()
                  .entityFqn(entity.getFullyQualifiedName())
                  .errorMessage("HTTP " + response.getStatus())
                  .errorCode(String.valueOf(response.getStatus()))
                  .build());
        }
      } catch (Exception e) {
        errors.add(
            SinkResult.SinkError.builder()
                .entityFqn(entity.getFullyQualifiedName())
                .errorMessage(e.getMessage())
                .cause(e)
                .build());
      }
    }

    return SinkResult.builder()
        .success(errors.isEmpty())
        .syncedCount(synced.size())
        .failedCount(errors.size())
        .syncedEntities(synced)
        .errors(errors)
        .build();
  }

  @Override
  public boolean supportsBatch() {
    return true;
  }

  @Override
  public void validate(Object config) {
    WebhookSinkConfig webhookConfig = JsonUtils.convertValue(config, WebhookSinkConfig.class);
    if (webhookConfig.getEndpoint() == null || webhookConfig.getEndpoint().toString().isEmpty()) {
      throw new IllegalArgumentException("Webhook endpoint is required");
    }
  }

  @Override
  public void close() {
    if (client != null) {
      client.close();
    }
  }

  private String serializeEntity(EntityInterface entity, String format) {
    return JsonUtils.pojoToJson(entity);
  }

  private Response sendRequest(String payload) {
    WebTarget target = client.target(config.getEndpoint());
    Invocation.Builder request = target.request(MediaType.APPLICATION_JSON);

    // Add custom headers
    if (config.getHeaders() != null && config.getHeaders().getAdditionalProperties() != null) {
      for (Map.Entry<String, String> header :
          config.getHeaders().getAdditionalProperties().entrySet()) {
        request.header(header.getKey(), header.getValue());
      }
    }

    // Add authentication
    if (config.getAuthentication() != null) {
      addAuthentication(request, config.getAuthentication());
    }

    // Send request based on HTTP method
    String method = config.getHttpMethod() != null ? config.getHttpMethod().value() : "POST";

    return switch (method) {
      case "PUT" -> request.put(Entity.json(payload));
      case "PATCH" -> request.method("PATCH", Entity.json(payload));
      default -> request.post(Entity.json(payload));
    };
  }

  private void addAuthentication(Invocation.Builder request, Authentication auth) {
    if (auth.getType() == null) {
      return;
    }

    switch (auth.getType()) {
      case BEARER -> {
        if (auth.getToken() != null) {
          request.header("Authorization", "Bearer " + auth.getToken());
        }
      }
      case BASIC -> {
        if (auth.getUsername() != null && auth.getPassword() != null) {
          String credentials = auth.getUsername() + ":" + auth.getPassword();
          String encoded = Base64.getEncoder().encodeToString(credentials.getBytes());
          request.header("Authorization", "Basic " + encoded);
        }
      }
      case API_KEY -> {
        if (auth.getApiKey() != null) {
          String headerName = auth.getHeaderName() != null ? auth.getHeaderName() : "X-API-Key";
          request.header(headerName, auth.getApiKey());
        }
      }
      default -> {
        // No authentication (NONE)
      }
    }
  }
}
