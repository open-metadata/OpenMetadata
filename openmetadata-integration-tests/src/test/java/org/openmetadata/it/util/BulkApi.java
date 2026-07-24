package org.openmetadata.it.util;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.schema.type.api.BulkOperationResult;

/**
 * Helpers for driving the bulk create/update ({@code PUT /v1/{collection}/bulk}) and scope-level
 * stale-deletion ({@code PUT /v1/{collection}/deleteStale}) endpoints over raw HTTP. The SDK fluent
 * clients do not expose these endpoints, so the integration tests call them directly.
 */
public final class BulkApi {
  private static final ObjectMapper MAPPER =
      new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  private BulkApi() {}

  /** Mints a JWT for the default ingestion bot so bot-only update rules can be exercised. */
  public static String botToken() {
    return JwtAuthProvider.tokenFor(
        "ingestion-bot@open-metadata.org",
        "ingestion-bot@open-metadata.org",
        new String[] {"bot"},
        86400);
  }

  public static BulkOperationResult upsert(String collection, List<?> createRequests)
      throws Exception {
    return upsert(collection, createRequests, false, SdkClients.getAdminToken());
  }

  public static BulkOperationResult upsert(
      String collection, List<?> createRequests, boolean overrideMetadata, String token)
      throws Exception {
    String url =
        SdkClients.getServerUrl()
            + "/v1/"
            + collection
            + "/bulk?overrideMetadata="
            + overrideMetadata;
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(createRequests)))
            .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) {
      throw new IllegalStateException(
          "Bulk upsert failed: " + response.statusCode() + " " + response.body());
    }
    return MAPPER.readValue(response.body(), BulkOperationResult.class);
  }

  public static HttpResponse<String> deleteStaleRaw(
      String collection, BulkDeleteStaleRequest request, String token) throws Exception {
    HttpRequest httpRequest =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/" + collection + "/deleteStale"))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(request)))
            .build();
    return HTTP.send(httpRequest, HttpResponse.BodyHandlers.ofString());
  }

  public static BulkOperationResult deleteStale(String collection, BulkDeleteStaleRequest request)
      throws Exception {
    HttpResponse<String> response = deleteStaleRaw(collection, request, SdkClients.getAdminToken());
    if (response.statusCode() != 200) {
      throw new IllegalStateException(
          "deleteStale failed: " + response.statusCode() + " " + response.body());
    }
    return MAPPER.readValue(response.body(), BulkOperationResult.class);
  }
}
