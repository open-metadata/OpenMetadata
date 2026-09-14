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
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;
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

  @Test
  void allocationCounterIncludesCompletedVirtualThreads() throws Exception {
    final Path endpointFile = directory.resolve("allocation-control.json");
    try (final var control = new EntityBenchmarkControl(endpointFile);
        final var client = HttpClient.newHttpClient()) {
      final Endpoint endpoint = JsonUtils.readValue(Files.readString(endpointFile), Endpoint.class);
      snapshot(client, endpoint);
      final Heap before = snapshot(client, endpoint);
      final List<byte[]> arrays = allocateOnVirtualThreads();
      final Heap after = snapshot(client, endpoint);
      final long retainedBytes = arrays.stream().mapToLong(array -> array.length).sum();
      assertTrue(before.allocatedBytes() > 0);
      assertTrue(after.allocatedBytes() - before.allocatedBytes() >= retainedBytes);
    }
  }

  private static List<byte[]> allocateOnVirtualThreads() throws Exception {
    final Callable<byte[]> allocate =
        () -> {
          assertTrue(Thread.currentThread().isVirtual());
          return new byte[8 * 1024 * 1024];
        };
    try (final var workers = Executors.newVirtualThreadPerTaskExecutor()) {
      final var arrays = new ArrayList<byte[]>();
      for (final var result :
          workers.invokeAll(IntStream.range(0, 8).mapToObj(ignored -> allocate).toList())) {
        arrays.add(result.get());
      }
      return List.copyOf(arrays);
    }
  }

  private static Heap snapshot(final HttpClient client, final Endpoint endpoint) throws Exception {
    final var response =
        client.send(request(endpoint, endpoint.token()), HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode());
    return JsonUtils.readValue(response.body(), Heap.class);
  }

  private static HttpRequest request(final Endpoint endpoint, final String token) {
    return HttpRequest.newBuilder(endpoint.uri().resolve("/heap"))
        .header("Authorization", "Bearer " + token)
        .timeout(Duration.ofSeconds(10))
        .POST(HttpRequest.BodyPublishers.noBody())
        .build();
  }
}
