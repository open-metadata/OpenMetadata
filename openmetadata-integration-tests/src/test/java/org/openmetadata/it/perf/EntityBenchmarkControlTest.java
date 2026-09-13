package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.it.perf.EntityBenchmarkControl.Endpoint;
import org.openmetadata.it.perf.EntityBenchmarkControl.Heap;
import org.openmetadata.schema.utils.JsonUtils;

class EntityBenchmarkControlTest {
  @TempDir Path directory;

  @Test
  void boundedBurstOfControlConnectionsReceivesCompleteAcknowledgements() throws Exception {
    final Path endpointFile = directory.resolve("control.json");
    try (final var control = new EntityBenchmarkControl(endpointFile);
        final var client = HttpClient.newHttpClient()) {
      final Endpoint endpoint = JsonUtils.readValue(Files.readString(endpointFile), Endpoint.class);
      final var replies = new ArrayList<CompletableFuture<HttpResponse<String>>>();
      for (int index = 0; index < 16; index++) {
        replies.add(
            client.sendAsync(
                request(endpoint, endpoint.token()), HttpResponse.BodyHandlers.ofString()));
      }
      CompletableFuture.allOf(replies.toArray(CompletableFuture[]::new)).join();
      for (final var pending : replies) {
        final var response = pending.join();
        assertEquals(200, response.statusCode());
        assertTrue(JsonUtils.readValue(response.body(), Heap.class).max() > 0);
      }
    }
  }

  @Test
  void controlsRequireTheirPrivateBearerToken() throws Exception {
    final Path endpointFile = directory.resolve("control.json");
    try (final var control = new EntityBenchmarkControl(endpointFile);
        final var client = HttpClient.newHttpClient()) {
      final Endpoint endpoint = JsonUtils.readValue(Files.readString(endpointFile), Endpoint.class);
      final var response =
          client.send(request(endpoint, "wrong-token"), HttpResponse.BodyHandlers.ofString());
      assertEquals(403, response.statusCode());
      assertEquals("Forbidden", response.body());
    }
  }

  private static HttpRequest request(final Endpoint endpoint, final String token) {
    return HttpRequest.newBuilder(endpoint.uri().resolve("/heap"))
        .header("Authorization", "Bearer " + token)
        .timeout(Duration.ofSeconds(10))
        .POST(HttpRequest.BodyPublishers.noBody())
        .build();
  }
}
