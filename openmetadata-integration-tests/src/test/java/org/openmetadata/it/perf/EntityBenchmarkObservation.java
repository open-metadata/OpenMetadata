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

/** Separates SQL diagnostics from fixture preparation, warmup and uninstrumented timings. */
final class EntityBenchmarkObservation implements AutoCloseable {
  private final Path output;
  private final Endpoint endpoint;
  private final HttpClient client;

  private EntityBenchmarkObservation(Path output, Endpoint endpoint) {
    this.output = output;
    this.endpoint = endpoint;
    client = endpoint == null ? null : HttpClient.newHttpClient();
  }

  static EntityBenchmarkObservation open(Path output) throws IOException, InterruptedException {
    final boolean enabled = Boolean.getBoolean("entityBenchmark.sql");
    final Endpoint endpoint = enabled ? EntityBenchmarkGate.configuredEndpoint() : null;
    if (enabled && endpoint == null)
      throw new IllegalArgumentException("SQL diagnostics need a control endpoint");
    final var observation = new EntityBenchmarkObservation(output, endpoint);
    if (enabled && !observation.send("sql-start").equals("ok")) {
      throw new IOException("SQL diagnostic window was not acknowledged");
    }
    return observation;
  }

  private String send(String command) throws IOException, InterruptedException {
    final var request =
        HttpRequest.newBuilder(endpoint.uri().resolve("/" + command))
            .header("Authorization", "Bearer " + endpoint.token())
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();
    final var response = client.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) throw new IOException("SQL diagnostic control failed");
    return response.body();
  }

  @Override
  public void close() throws IOException, InterruptedException {
    if (endpoint != null) {
      try {
        final String response = send("sql-stop");
        JsonUtils.readValue(response, EntityBenchmarkSqlProbe.Counts.class);
        Files.writeString(output, response);
      } finally {
        client.close();
      }
    }
  }
}
