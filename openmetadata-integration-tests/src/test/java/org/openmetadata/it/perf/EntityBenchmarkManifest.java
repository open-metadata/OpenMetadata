package org.openmetadata.it.perf;

import java.util.List;
import java.util.Map;

/** Local benchmark input; never expose the generated test token in reports. */
public record EntityBenchmarkManifest(String baseUrl, String token, List<Workload> workloads) {
  public record Workload(String name, List<Request> setup, Request request, Checks checks) {
    public Workload {
      setup = List.copyOf(setup);
      checks = checks == null ? Checks.NONE : checks;
    }

    public Workload(String name, List<Request> setup, Request request) {
      this(name, setup, request, Checks.NONE);
    }
  }

  public record Checks(
      Integer bulkItems, boolean entityIdFromSetup, Completion completion, Integer csvRows) {
    public static final Checks NONE = new Checks(null, false);

    public Checks(final Integer bulkItems, final boolean entityIdFromSetup) {
      this(bulkItems, entityIdFromSetup, null, null);
    }

    public Checks(
        final Integer bulkItems, final boolean entityIdFromSetup, final Completion completion) {
      this(bulkItems, entityIdFromSetup, completion, null);
    }

    public static Checks forCsv(final int rows) {
      return new Checks(null, false, null, rows);
    }

    public Checks {
      if (bulkItems != null && (bulkItems < 1 || bulkItems > 1000)) {
        throw new IllegalArgumentException("Bulk workload size must be between 1 and 1000");
      }
      if (completion != null && bulkItems == null) {
        throw new IllegalArgumentException(
            "Asynchronous bulk checks require an accepted row count");
      }
      if (csvRows != null && (csvRows < 1 || csvRows > 1000 || bulkItems != null)) {
        throw new IllegalArgumentException("Invalid CSV row checks");
      }
    }
  }

  public record Completion(
      List<String> paths, Map<String, String> expectedFields, boolean measure, long timeoutMillis) {
    public Completion {
      paths = List.copyOf(paths);
      expectedFields = Map.copyOf(expectedFields);
      if (paths.isEmpty()
          || paths.size() > 1000
          || expectedFields.size() > 100
          || timeoutMillis < 1
          || timeoutMillis > 60_000) {
        throw new IllegalArgumentException("Invalid completion bounds");
      }
    }
  }

  public record Request(
      String method, String path, Map<String, String> headers, String body, int expectedStatus) {
    public static Request json(String method, String path, String body, int status) {
      final String contentType =
          "PATCH".equals(method) ? "application/json-patch+json" : "application/json";
      return new Request(method, path, Map.of("Content-Type", contentType), body, status);
    }
  }
}
