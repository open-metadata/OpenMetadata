/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.util;

import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.core.Configuration;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Future;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.client.ClientRequest;
import org.glassfish.jersey.client.ClientResponse;
import org.glassfish.jersey.client.spi.AsyncConnectorCallback;
import org.glassfish.jersey.client.spi.Connector;
import org.glassfish.jersey.client.spi.ConnectorProvider;
import org.glassfish.jersey.message.internal.Statuses;

/**
 * Custom Jersey Connector using Java's built-in HttpClient. This connector:
 *
 * <ul>
 *   <li>Supports all HTTP methods including PATCH
 *   <li>Handles empty request bodies gracefully (unlike jersey-jnh-connector)
 *   <li>Has proper timeout support
 *   <li>Has no external dependencies or Jetty version conflicts
 * </ul>
 */
public class JdkHttpClientConnector implements Connector {

  private final HttpClient httpClient;
  private final int connectTimeout;
  private final int readTimeout;

  public JdkHttpClientConnector(Configuration config) {
    this.connectTimeout = getTimeout(config, ClientProperties.CONNECT_TIMEOUT, 30_000);
    this.readTimeout = getTimeout(config, ClientProperties.READ_TIMEOUT, 120_000);

    this.httpClient =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(connectTimeout))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
  }

  private int getTimeout(Configuration config, String property, int defaultValue) {
    Object value = config.getProperty(property);
    if (value instanceof Integer) {
      return (Integer) value;
    }
    if (value instanceof String) {
      return Integer.parseInt((String) value);
    }
    return defaultValue;
  }

  @Override
  public ClientResponse apply(ClientRequest request) {
    try {
      HttpRequest httpRequest = buildRequest(request);
      HttpResponse<InputStream> response =
          httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofInputStream());
      return buildResponse(request, response);
    } catch (IOException e) {
      throw new ProcessingException("I/O error during HTTP request", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ProcessingException("HTTP request interrupted", e);
    }
  }

  @Override
  public Future<?> apply(ClientRequest request, AsyncConnectorCallback callback) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            ClientResponse response = apply(request);
            callback.response(response);
            return response;
          } catch (Throwable t) {
            callback.failure(t);
            throw t;
          }
        });
  }

  private HttpRequest buildRequest(ClientRequest request) throws IOException {
    URI uri = request.getUri();
    String method = request.getMethod();

    HttpRequest.Builder builder =
        HttpRequest.newBuilder().uri(uri).timeout(Duration.ofMillis(readTimeout));

    // Add headers
    for (Map.Entry<String, List<Object>> header : request.getHeaders().entrySet()) {
      String headerName = header.getKey();
      for (Object value : header.getValue()) {
        if (value != null) {
          builder.header(headerName, value.toString());
        }
      }
    }

    // Handle request body
    if (request.hasEntity()) {
      byte[] body = serializeEntity(request);
      builder.method(method, HttpRequest.BodyPublishers.ofByteArray(body));
    } else {
      // For methods that typically have a body (PUT, POST, PATCH), send empty body
      // This is more lenient than jersey-jnh-connector which rejects null entities
      if ("PUT".equalsIgnoreCase(method)
          || "POST".equalsIgnoreCase(method)
          || "PATCH".equalsIgnoreCase(method)) {
        builder.method(method, HttpRequest.BodyPublishers.ofByteArray(new byte[0]));
      } else {
        builder.method(method, HttpRequest.BodyPublishers.noBody());
      }
    }

    return builder.build();
  }

  private byte[] serializeEntity(ClientRequest request) throws IOException {
    java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
    request.setStreamProvider(
        contentLength ->
            new OutputStream() {
              @Override
              public void write(int b) throws IOException {
                baos.write(b);
              }

              @Override
              public void write(byte[] b, int off, int len) throws IOException {
                baos.write(b, off, len);
              }
            });
    request.writeEntity();
    return baos.toByteArray();
  }

  private ClientResponse buildResponse(
      ClientRequest request, HttpResponse<InputStream> httpResponse) {
    Response.StatusType status = Statuses.from(httpResponse.statusCode());
    ClientResponse clientResponse = new ClientResponse(status, request);

    // Copy response headers
    httpResponse
        .headers()
        .map()
        .forEach(
            (name, values) -> {
              for (String value : values) {
                clientResponse.header(name, value);
              }
            });

    // Set response body
    InputStream body = httpResponse.body();
    if (body != null) {
      clientResponse.setEntityStream(body);
    } else {
      clientResponse.setEntityStream(new ByteArrayInputStream(new byte[0]));
    }

    return clientResponse;
  }

  @Override
  public String getName() {
    return "JDK HttpClient Connector";
  }

  @Override
  public void close() {
    // HttpClient doesn't need explicit closing in Java 11+
  }

  /** ConnectorProvider for creating JdkHttpClientConnector instances. */
  public static class Provider implements ConnectorProvider {
    @Override
    public Connector getConnector(Client client, Configuration config) {
      return new JdkHttpClientConnector(config);
    }
  }
}
