package org.openmetadata.it.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.openmetadata.it.server.ServerHandle;

/**
 * Thin JSON-over-HTTP client for the search engine (works against ES and OpenSearch).
 *
 * <p>Uses {@link java.net.http.HttpClient} so the harness has no dependency on a specific
 * ES/OpenSearch client version. Only covers the inspection surface used by assertions:
 * {@code _count}, {@code _alias}, {@code _cat/indices}.
 */
public final class SearchClient {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Duration TIMEOUT = Duration.ofSeconds(30);

  private final HttpClient http;
  private final URI base;

  public SearchClient(final ServerHandle server) {
    this.http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    this.base =
        URI.create(server.searchScheme() + "://" + server.searchHost() + ":" + server.searchPort());
  }

  public JsonNode get(final String path) {
    return execute(HttpRequest.newBuilder(base.resolve(path)).GET().build());
  }

  public JsonNode post(final String path, final String jsonBody) {
    return execute(
        HttpRequest.newBuilder(base.resolve(path))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build());
  }

  public JsonNode put(final String path, final String jsonBody) {
    return execute(
        HttpRequest.newBuilder(base.resolve(path))
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build());
  }

  public void delete(final String path) {
    try {
      final HttpResponse<String> response =
          http.send(
              HttpRequest.newBuilder(base.resolve(path)).DELETE().build(),
              HttpResponse.BodyHandlers.ofString());
      final int status = response.statusCode();
      final boolean success = (status >= 200 && status < 300) || status == 404;
      if (!success) {
        throw new SearchClientException(
            "HTTP " + status + " from DELETE " + path + ": " + response.body());
      }
    } catch (final InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new SearchClientException("DELETE " + path + " interrupted", e);
    } catch (final IOException e) {
      throw new SearchClientException("DELETE " + path + " failed", e);
    }
  }

  public boolean exists(final String path) {
    try {
      final HttpResponse<Void> response =
          http.send(
              HttpRequest.newBuilder(base.resolve(path))
                  .method("HEAD", HttpRequest.BodyPublishers.noBody())
                  .build(),
              HttpResponse.BodyHandlers.discarding());
      return response.statusCode() >= 200 && response.statusCode() < 300;
    } catch (final InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new SearchClientException("HEAD " + path + " interrupted", e);
    } catch (final IOException e) {
      throw new SearchClientException("HEAD " + path + " failed", e);
    }
  }

  private JsonNode execute(final HttpRequest request) {
    try {
      final HttpResponse<String> response =
          http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() >= 400) {
        throw new SearchClientException(
            "HTTP " + response.statusCode() + " from " + request.uri() + ": " + response.body());
      }
      return MAPPER.readTree(response.body());
    } catch (final InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new SearchClientException(request.method() + " " + request.uri() + " interrupted", e);
    } catch (final IOException e) {
      throw new SearchClientException(request.method() + " " + request.uri() + " failed", e);
    }
  }

  public static final class SearchClientException extends RuntimeException {
    public SearchClientException(final String message) {
      super(message);
    }

    public SearchClientException(final String message, final Throwable cause) {
      super(message, cause);
    }
  }
}
