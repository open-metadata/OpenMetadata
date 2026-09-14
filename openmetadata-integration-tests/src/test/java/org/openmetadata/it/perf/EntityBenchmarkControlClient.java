package org.openmetadata.it.perf;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Set;
import org.openmetadata.it.perf.EntityBenchmarkControl.Endpoint;
import org.openmetadata.schema.utils.JsonUtils;

/** Runs local benchmark controls from the server's network namespace without exposing tokens. */
public final class EntityBenchmarkControlClient {
  private static final Set<String> COMMANDS =
      Set.of(
          "heap",
          "environment",
          "cache-state",
          "cold",
          "l1-cold",
          "redis-pause",
          "redis-resume",
          "sql-start",
          "sql-stop");

  private EntityBenchmarkControlClient() {}

  public static void main(final String[] args) throws IOException, InterruptedException {
    if (args.length != 3 || !COMMANDS.contains(args[1])) {
      throw new IllegalArgumentException("Expected endpoint.json command output.json");
    }
    final var endpoint = JsonUtils.readValue(Files.readString(Path.of(args[0])), Endpoint.class);
    requireLocalEndpoint(endpoint.uri());
    try (final var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()) {
      Files.writeString(Path.of(args[2]), send(client, endpoint, args[1]));
    }
  }

  private static void requireLocalEndpoint(final URI uri) {
    if (!"http".equals(uri.getScheme())
        || !"127.0.0.1".equals(uri.getHost())
        || uri.getPort() <= 0
        || uri.getUserInfo() != null
        || uri.getQuery() != null
        || uri.getFragment() != null) {
      throw new IllegalArgumentException("Benchmark controls require a loopback HTTP endpoint");
    }
  }

  static String send(final HttpClient client, final Endpoint endpoint, final String command)
      throws IOException, InterruptedException {
    requireLocalEndpoint(endpoint.uri());
    if (!COMMANDS.contains(command)) {
      throw new IllegalArgumentException("Unknown benchmark control command");
    }
    final var request =
        HttpRequest.newBuilder(endpoint.uri().resolve("/" + command))
            .header("Authorization", "Bearer " + endpoint.token())
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();
    final var response = client.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) {
      throw new IOException("Benchmark control failed with HTTP " + response.statusCode());
    }
    return response.body();
  }
}
