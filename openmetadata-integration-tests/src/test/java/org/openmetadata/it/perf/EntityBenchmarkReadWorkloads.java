package org.openmetadata.it.perf;

import static org.openmetadata.it.perf.EntityBenchmarkManifest.Request.json;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.schema.entity.data.Table;

/** Deterministic read projections and principals shared by both benchmark revisions. */
final class EntityBenchmarkReadWorkloads {
  private static final String EXPANDED_FIELDS =
      "columns,customMetrics,extension,owners,followers,domains,tags";

  private EntityBenchmarkReadWorkloads() {}

  static List<Workload> create(final Table table, final int columnCount, final String readerToken) {
    final List<Workload> workloads = new ArrayList<>();
    final String path = "/v1/tables/" + table.getId();
    add(workloads, "get.columns." + columnCount, path + "?fields=columns");
    add(workloads, "get.metrics." + columnCount, path + "?fields=columns,customMetrics");
    add(workloads, "get.extensions." + columnCount, path + "?fields=columns,extension");
    add(
        workloads,
        "get.relationships." + columnCount,
        path + "?fields=owners,followers,domains,tags");
    add(
        workloads,
        "list.metrics." + columnCount,
        "/v1/tables?fields=columns,customMetrics&databaseSchema="
            + table.getDatabaseSchema().getFullyQualifiedName());
    add(workloads, "get.history." + columnCount, path + "/versions");
    addDetails(workloads, table, columnCount, readerToken);
    return List.copyOf(workloads);
  }

  private static void addDetails(
      final List<Workload> workloads,
      final Table table,
      final int columnCount,
      final String readerToken) {
    final String name =
        URLEncoder.encode(table.getFullyQualifiedName(), StandardCharsets.UTF_8)
            .replace("+", "%20");
    for (final var lookup :
        List.of(
            new Lookup("id", "/v1/tables/" + table.getId()),
            new Lookup("name", "/v1/tables/name/" + name))) {
      addDetails(workloads, lookup, columnCount, Map.of(), "get.");
      addDetails(
          workloads,
          lookup,
          columnCount,
          Map.of("Authorization", "Bearer " + readerToken),
          "get.reader.");
    }
  }

  private static void addDetails(
      final List<Workload> workloads,
      final Lookup lookup,
      final int columnCount,
      final Map<String, String> headers,
      final String prefix) {
    final String suffix = "." + lookup.name() + "." + columnCount;
    workloads.add(
        new Workload(
            prefix + "minimal" + suffix,
            List.of(),
            new Request("GET", lookup.path(), headers, null, 200)));
    workloads.add(
        new Workload(
            prefix + "expanded" + suffix,
            List.of(),
            new Request("GET", lookup.path() + "?fields=" + EXPANDED_FIELDS, headers, null, 200)));
  }

  private static void add(final List<Workload> workloads, final String name, final String path) {
    workloads.add(new Workload(name, List.of(), json("GET", path, null, 200)));
  }

  private record Lookup(String name, String path) {}
}
