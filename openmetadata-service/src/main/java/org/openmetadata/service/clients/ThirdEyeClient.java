/*
 *  Copyright 2025 OpenMetadata
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

package org.openmetadata.service.clients;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.config.ThirdEyeConfiguration;
import org.openmetadata.service.exception.ThirdEyeServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * HTTP client for communicating with ThirdEye analytics service.
 * 
 * This client handles all HTTP communication with the ThirdEye Python service,
 * including authentication, retries, and error handling.
 */
@Slf4j
public class ThirdEyeClient {
  
  private static final Logger log = LoggerFactory.getLogger(ThirdEyeClient.class);
  
  private final ThirdEyeConfiguration config;
  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;
  private final String baseUrl;

  public ThirdEyeClient(ThirdEyeConfiguration config) {
    this.config = config;
    this.baseUrl = config.getBaseUrl();
    this.objectMapper = new ObjectMapper();
    
    // Build HTTP client with configuration
    HttpClient.Builder clientBuilder = HttpClient.newBuilder()
        .connectTimeout(Duration.ofMillis(config.getTimeout()))
        .followRedirects(HttpClient.Redirect.NORMAL);
    
    // Configure SSL if enabled
    if (config.getSsl().isEnabled()) {
      // TODO: Add SSL context configuration
      log.warn("SSL configuration for ThirdEye client not yet implemented");
    }
    
    this.httpClient = clientBuilder.build();
  }

  /**
   * Make a GET request to ThirdEye service
   */
  public CompletableFuture<JsonNode> get(String endpoint) {
    return get(endpoint, null);
  }

  /**
   * Make a GET request to ThirdEye service with query parameters
   */
  public CompletableFuture<JsonNode> get(String endpoint, Map<String, String> queryParams) {
    return makeRequest("GET", endpoint, null, queryParams);
  }

  /**
   * Make a POST request to ThirdEye service
   */
  public CompletableFuture<JsonNode> post(String endpoint, Object body) {
    return makeRequest("POST", endpoint, body, null);
  }

  /**
   * Make a POST request to ThirdEye service with query parameters
   */
  public CompletableFuture<JsonNode> post(String endpoint, Object body, Map<String, String> queryParams) {
    return makeRequest("POST", endpoint, body, queryParams);
  }

  /**
   * Make a PUT request to ThirdEye service
   */
  public CompletableFuture<JsonNode> put(String endpoint, Object body) {
    return makeRequest("PUT", endpoint, body, null);
  }

  /**
   * Make a DELETE request to ThirdEye service
   */
  public CompletableFuture<JsonNode> delete(String endpoint) {
    return makeRequest("DELETE", endpoint, null, null);
  }

  /**
   * Health check for ThirdEye service
   */
  public CompletableFuture<Boolean> healthCheck() {
    return get("/health")
        .thenApply(response -> {
          try {
            return response.has("status") && "ok".equals(response.get("status").asText());
          } catch (Exception e) {
            log.error("Failed to parse health check response", e);
            return false;
          }
        })
        .exceptionally(throwable -> {
          log.error("Health check failed", throwable);
          return false;
        });
  }

  /**
   * Core method to make HTTP requests with retry logic
   */
  private CompletableFuture<JsonNode> makeRequest(String method, String endpoint, Object body, Map<String, String> queryParams) {
    return CompletableFuture.supplyAsync(() -> {
      String url = buildUrl(endpoint, queryParams);
      HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
          .uri(URI.create(url))
          .timeout(Duration.ofMillis(config.getTimeout()))
          .header("Content-Type", "application/json")
          .header("Accept", "application/json");

      // Set request body for POST/PUT
      if (body != null && (method.equals("POST") || method.equals("PUT"))) {
        try {
          String jsonBody = objectMapper.writeValueAsString(body);
          requestBuilder.header("Content-Type", "application/json");
          switch (method) {
            case "POST":
              requestBuilder.POST(HttpRequest.BodyPublishers.ofString(jsonBody));
              break;
            case "PUT":
              requestBuilder.PUT(HttpRequest.BodyPublishers.ofString(jsonBody));
              break;
          }
        } catch (Exception e) {
          throw new ThirdEyeServiceException("Failed to serialize request body", e);
        }
      } else {
        switch (method) {
          case "GET":
            requestBuilder.GET();
            break;
          case "DELETE":
            requestBuilder.DELETE();
            break;
        }
      }

      HttpRequest request = requestBuilder.build();
      
      // Execute request with retry logic
      return executeWithRetry(request);
    });
  }

  /**
   * Execute HTTP request with retry logic
   */
  private JsonNode executeWithRetry(HttpRequest request) {
    Exception lastException = null;
    
    for (int attempt = 1; attempt <= config.getRetryAttempts(); attempt++) {
      try {
        log.debug("Making request to ThirdEye: {} {} (attempt {})", 
                 request.method(), request.uri(), attempt);
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
          return parseResponse(response.body());
        } else {
          throw new ThirdEyeServiceException(
              String.format("ThirdEye service returned error: %d %s", 
                           response.statusCode(), response.body()));
        }
        
      } catch (IOException | InterruptedException e) {
        lastException = e;
        log.warn("Request to ThirdEye failed (attempt {}): {}", attempt, e.getMessage());
        
        if (attempt < config.getRetryAttempts()) {
          try {
            Thread.sleep(config.getRetryDelay());
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new ThirdEyeServiceException("Request interrupted", ie);
          }
        }
      }
    }
    
    throw new ThirdEyeServiceException("All retry attempts failed", lastException);
  }

  /**
   * Build full URL with query parameters
   */
  private String buildUrl(String endpoint, Map<String, String> queryParams) {
    StringBuilder url = new StringBuilder(baseUrl);
    
    if (!endpoint.startsWith("/")) {
      url.append("/");
    }
    url.append(endpoint);
    
    if (queryParams != null && !queryParams.isEmpty()) {
      url.append("?");
      queryParams.forEach((key, value) -> 
          url.append(key).append("=").append(value).append("&"));
      // Remove trailing &
      if (url.charAt(url.length() - 1) == '&') {
        url.setLength(url.length() - 1);
      }
    }
    
    return url.toString();
  }

  /**
   * Parse JSON response
   */
  private JsonNode parseResponse(String responseBody) {
    try {
      return objectMapper.readTree(responseBody);
    } catch (Exception e) {
      throw new ThirdEyeServiceException("Failed to parse ThirdEye response", e);
    }
  }

  /**
   * Check if ThirdEye service is enabled and reachable
   */
  public boolean isAvailable() {
    if (!config.isEnabled()) {
      return false;
    }
    
    try {
      return healthCheck().get();
    } catch (Exception e) {
      log.debug("ThirdEye service not available: {}", e.getMessage());
      return false;
    }
  }
}
