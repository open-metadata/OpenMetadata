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
import java.util.Optional;
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

  private static final int DEFAULT_MAX_RETRIES = 3;
  private static final int DEFAULT_RETRY_DELAY_SECONDS = 2;

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
      return executeWithRetry(
          () -> {
            try (Response response = sendRequest(payload)) {
              int statusCode = response.getStatus();
              boolean success = statusCode >= 200 && statusCode < 300;

              if (success) {
                return SinkResult.builder()
                    .success(true)
                    .syncedCount(1)
                    .failedCount(0)
                    .syncedEntities(List.of(entity.getFullyQualifiedName()))
                    .metadata(Map.of("statusCode", statusCode))
                    .build();
              } else {
                String responseBody = response.readEntity(String.class);
                return SinkResult.builder()
                    .success(false)
                    .syncedCount(0)
                    .failedCount(1)
                    .errors(
                        List.of(
                            SinkResult.SinkError.builder()
                                .entityFqn(entity.getFullyQualifiedName())
                                .errorMessage("HTTP " + statusCode + ": " + responseBody)
                                .errorCode(String.valueOf(statusCode))
                                .build()))
                    .metadata(Map.of("statusCode", statusCode))
                    .build();
              }
            }
          },
          entity.getFullyQualifiedName());

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
        SinkResult result =
            executeWithRetry(
                () -> {
                  try (Response response = sendRequest(payload)) {
                    int statusCode = response.getStatus();
                    if (statusCode >= 200 && statusCode < 300) {
                      return SinkResult.builder().success(true).syncedCount(1).build();
                    } else {
                      return SinkResult.builder()
                          .success(false)
                          .errors(
                              List.of(
                                  SinkResult.SinkError.builder()
                                      .entityFqn(entity.getFullyQualifiedName())
                                      .errorMessage("HTTP " + statusCode)
                                      .errorCode(String.valueOf(statusCode))
                                      .build()))
                          .build();
                    }
                  }
                },
                entity.getFullyQualifiedName());

        if (result.isSuccess()) {
          synced.add(entity.getFullyQualifiedName());
        } else if (result.getErrors() != null) {
          errors.addAll(result.getErrors());
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
        .errors(errors.isEmpty() ? null : errors)
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

    // Validate authentication configuration
    Authentication auth = webhookConfig.getAuthentication();
    if (auth != null && auth.getType() != null) {
      switch (auth.getType()) {
        case BASIC -> {
          if (auth.getUsername() == null || auth.getPassword() == null) {
            throw new IllegalArgumentException("Basic auth requires both username and password");
          }
        }
        case BEARER -> {
          if (auth.getToken() == null) {
            throw new IllegalArgumentException("Bearer auth requires a token");
          }
        }
        case API_KEY -> {
          if (auth.getApiKey() == null) {
            throw new IllegalArgumentException("API key auth requires an apiKey");
          }
        }
        default -> {
          // NONE - no validation needed
        }
      }
    }
  }

  /**
   * Execute an operation with retry and exponential backoff.
   *
   * @param operation The operation to execute
   * @param entityFqn Entity FQN for logging
   * @return The result of the operation
   */
  private SinkResult executeWithRetry(
      java.util.function.Supplier<SinkResult> operation, String entityFqn) {
    int maxRetries =
        Optional.ofNullable(config.getRetryConfig())
            .map(r -> r.getMaxRetries())
            .orElse(DEFAULT_MAX_RETRIES);
    int baseDelaySeconds =
        Optional.ofNullable(config.getRetryConfig())
            .map(r -> r.getRetryDelaySeconds())
            .orElse(DEFAULT_RETRY_DELAY_SECONDS);
    int maxDelaySeconds = baseDelaySeconds * 8; // Cap at 8x base delay

    Exception lastException = null;
    for (int attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        SinkResult result = operation.get();
        if (result.isSuccess() || attempt == maxRetries) {
          return result;
        }
        // Non-success result, retry if attempts remain
        LOG.warn(
            "Webhook request failed for {}, attempt {}/{}", entityFqn, attempt + 1, maxRetries + 1);
      } catch (Exception e) {
        lastException = e;
        if (attempt == maxRetries) {
          throw new RuntimeException("Max retries exceeded for " + entityFqn, e);
        }
        LOG.warn(
            "Webhook request error for {}, attempt {}/{}: {}",
            entityFqn,
            attempt + 1,
            maxRetries + 1,
            e.getMessage());
      }

      // Exponential backoff: delay * 2^attempt, capped at maxDelay
      int delaySeconds = Math.min(baseDelaySeconds * (1 << attempt), maxDelaySeconds);
      try {
        LOG.debug("Retrying in {} seconds...", delaySeconds);
        Thread.sleep(delaySeconds * 1000L);
      } catch (InterruptedException ie) {
        Thread.currentThread().interrupt();
        throw new RuntimeException("Interrupted during retry backoff", ie);
      }
    }

    // Should not reach here, but handle gracefully
    throw new RuntimeException("Unexpected retry loop exit", lastException);
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
