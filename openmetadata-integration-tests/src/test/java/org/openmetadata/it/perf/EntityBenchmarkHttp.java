package org.openmetadata.it.perf;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.apache.commons.csv.CSVFormat;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Checks;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Completion;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;

/** Captures HTTP completion before validating application results in the load generator. */
final class EntityBenchmarkHttp {
  record Context(String sequence, UUID entityId) {
    String expand(final String value) {
      if (value == null) return "";
      if (entityId == null && value.contains("${entityId}")) {
        throw new IllegalStateException("The benchmark setup did not capture an entity ID");
      }
      return value
          .replace("${sequence}", sequence)
          .replace("${entityId}", entityId == null ? "" : entityId.toString());
    }
  }

  record Reply(int status, long completed, String body) {
    boolean succeeds(final Request request, final Checks checks) {
      if (checks.completion() != null) return accepted(request, checks.bulkItems());
      if (checks.csvRows() != null) {
        return status == request.expectedStatus() && validCsv(request, checks.csvRows());
      }
      return succeeds(request, checks.bulkItems());
    }

    boolean succeeds(final Request request, final Integer bulkItems) {
      return status == request.expectedStatus() && (bulkItems == null || allRowsPassed(bulkItems));
    }

    private boolean allRowsPassed(final int expected) {
      try {
        final BulkOperationResult result = JsonUtils.readValue(body, BulkOperationResult.class);
        return successfulCounts(result, expected, expected);
      } catch (JsonParsingException invalidResult) {
        return false;
      }
    }

    private boolean validCsv(final Request request, final int expected) {
      try {
        return "GET".equals(request.method())
            ? validCsvExport(expected)
            : validCsvImport(request, expected);
      } catch (IOException | RuntimeException invalidResult) {
        return false;
      }
    }

    private boolean validCsvExport(final int expected) throws IOException {
      try (var parser = CSVFormat.RFC4180.parse(new StringReader(body))) {
        final var records = parser.getRecords();
        return records.size() == expected + 1
            && records.getFirst().size() > 1
            && records.stream().allMatch(row -> row.size() == records.getFirst().size());
      }
    }

    private boolean validCsvImport(final Request request, final int expected) {
      final var result = JsonUtils.readTree(body);
      return ApiStatus.SUCCESS.value().equals(result.path("status").asText())
          && countMatches(result, "numberOfRowsProcessed", expected)
          && countMatches(result, "numberOfRowsPassed", expected)
          && countMatches(result, "numberOfRowsFailed", 0)
          && result.path("dryRun").isBoolean()
          && result.path("dryRun").asBoolean() == request.path().contains("dryRun=true");
    }

    private static boolean countMatches(
        final JsonNode result, final String field, final int expected) {
      return result.path(field).isIntegralNumber() && result.path(field).asLong() == expected;
    }

    private static boolean successfulCounts(
        final BulkOperationResult result, final int processed, final int passed) {
      return result != null
          && result.getStatus() == ApiStatus.SUCCESS
          && Integer.valueOf(processed).equals(result.getNumberOfRowsProcessed())
          && Integer.valueOf(passed).equals(result.getNumberOfRowsPassed())
          && Integer.valueOf(0).equals(result.getNumberOfRowsFailed());
    }

    boolean accepted(final Request request, final int expected) {
      if (status != request.expectedStatus()) return false;
      try {
        final BulkOperationResult result = JsonUtils.readValue(body, BulkOperationResult.class);
        return successfulCounts(result, expected, 0)
            && result.getSuccessRequest() != null
            && result.getSuccessRequest().size() == expected
            && result.getSuccessRequest().stream()
                .allMatch(row -> Integer.valueOf(202).equals(row.getStatus()));
      } catch (JsonParsingException invalidResult) {
        return false;
      }
    }

    boolean contains(final Map<String, String> expected) {
      if (status != 200) return false;
      try {
        final var entity = JsonUtils.readTree(body);
        return entity.isObject()
            && expected.entrySet().stream()
                .allMatch(
                    field ->
                        entity.path(field.getKey()).isTextual()
                            && field.getValue().equals(entity.path(field.getKey()).asText()));
      } catch (JsonParsingException invalidResult) {
        return false;
      }
    }

    UUID entityId() {
      final var id = JsonUtils.readTree(body).path("id");
      if (!id.isTextual())
        throw new IllegalStateException("Setup response did not contain an entity ID");
      return UUID.fromString(id.asText());
    }
  }

  private final HttpClient client =
      HttpClient.newBuilder()
          .version(HttpClient.Version.HTTP_1_1)
          .connectTimeout(Duration.ofSeconds(10))
          .build();
  private final EntityBenchmarkManifest manifest;

  EntityBenchmarkHttp(final EntityBenchmarkManifest manifest) {
    this.manifest = manifest;
  }

  long await(final Completion completion, final Context context)
      throws IOException, InterruptedException {
    final long deadline =
        System.nanoTime() + Duration.ofMillis(completion.timeoutMillis()).toNanos();
    final var pending = new ArrayList<>(completion.paths());
    long completed = 0;
    while (!pending.isEmpty() && System.nanoTime() < deadline) {
      completed = poll(completion, context, pending, deadline);
      if (!pending.isEmpty()) pause(deadline);
    }
    if (!pending.isEmpty()) throw new IOException("Asynchronous bulk completion deadline expired");
    return completed;
  }

  private long poll(
      final Completion completion,
      final Context context,
      final List<String> pending,
      final long deadline)
      throws IOException, InterruptedException {
    long completed = 0;
    final var paths = pending.iterator();
    while (paths.hasNext() && System.nanoTime() < deadline) {
      final var reply =
          send(
              Request.json("GET", paths.next(), null, 200),
              context,
              true,
              Duration.ofNanos(Math.max(1, deadline - System.nanoTime())));
      if (reply.completed() <= deadline && reply.contains(completion.expectedFields())) {
        paths.remove();
        completed = reply.completed();
      }
    }
    return completed;
  }

  private static void pause(final long deadline) throws InterruptedException {
    final long remaining = deadline - System.nanoTime();
    if (remaining > 0) TimeUnit.NANOSECONDS.sleep(Math.min(20_000_000L, remaining));
  }

  Reply send(final Request request, final Context context, final boolean readBody)
      throws IOException, InterruptedException {
    return send(request, context, readBody, Duration.ofSeconds(60));
  }

  private Reply send(
      final Request request, final Context context, final boolean readBody, final Duration timeout)
      throws IOException, InterruptedException {
    final HttpRequest built = build(request, context, timeout);
    if (readBody) {
      final var response = client.send(built, HttpResponse.BodyHandlers.ofString());
      return new Reply(response.statusCode(), System.nanoTime(), response.body());
    }
    final var response = client.send(built, HttpResponse.BodyHandlers.discarding());
    return new Reply(response.statusCode(), System.nanoTime(), null);
  }

  private HttpRequest build(final Request request, final Context context, final Duration timeout) {
    final String body = context.expand(request.body());
    final var builder =
        HttpRequest.newBuilder(URI.create(manifest.baseUrl() + context.expand(request.path())))
            .timeout(timeout)
            .header("Authorization", "Bearer " + manifest.token());
    request.headers().forEach(builder::setHeader);
    return builder
        .method(
            request.method(),
            body.isEmpty()
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body))
        .build();
  }
}
