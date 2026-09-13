package org.openmetadata.it.perf;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import org.openmetadata.it.perf.EntityBenchmarkControl.Endpoint;
import org.openmetadata.schema.utils.JsonUtils;

/** Performs an acknowledged cache reset before starting an individual cold-request timer. */
final class EntityBenchmarkGate {
  private final Endpoint endpoint;
  private final String operation;
  private final HttpClient client;

  EntityBenchmarkGate(Endpoint endpoint, String operation) {
    this.endpoint = endpoint;
    this.operation = operation;
    client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    if (!operation.equals("cold") && !operation.equals("l1-cold")) {
      throw new IllegalArgumentException("Unknown benchmark cache reset");
    }
  }

  static EntityBenchmarkGate configured() throws IOException {
    final Endpoint endpoint = configuredEndpoint();
    final String reset = System.getProperty("entityBenchmark.reset", "cold");
    return endpoint == null || reset.equals("none")
        ? null
        : new EntityBenchmarkGate(endpoint, reset);
  }

  static Endpoint configuredEndpoint() throws IOException {
    final String file = System.getProperty("entityBenchmark.control");
    return file == null
        ? null
        : JsonUtils.readValue(Files.readString(Path.of(file)), Endpoint.class);
  }

  String mode() {
    return operation;
  }

  long startRequest() throws IOException, InterruptedException {
    final var request =
        HttpRequest.newBuilder(endpoint.uri().resolve("/" + operation))
            .header("Authorization", "Bearer " + endpoint.token())
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();
    final var response = client.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200 || !response.body().equals("ok")) {
      throw new IOException("Benchmark cache reset was not acknowledged");
    }
    return System.nanoTime();
  }
}
