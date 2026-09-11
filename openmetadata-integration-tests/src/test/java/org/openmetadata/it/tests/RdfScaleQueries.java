package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

final class RdfScaleQueries {
  static final String GRAPH = "https://open-metadata.org/graph/knowledge";
  private static final String OM = "https://open-metadata.org/ontology/";
  private final RdfScaleCatalog catalog;
  private final HttpClient client = SdkClients.adminClient().getHttpClient();

  record Snapshot(
      long tables,
      long upstream,
      long downstream,
      long provenance,
      long details,
      long extensionProperties,
      long triples) {}

  record Timing(
      String timestamp, String query, int sample, double millis, int rows, String error) {}

  record Latency(
      int samples,
      int failures,
      double firstMillis,
      double p50Millis,
      double p95Millis,
      double p99Millis,
      double maxMillis) {}

  RdfScaleQueries(final RdfScaleCatalog catalog) {
    this.catalog = catalog;
  }

  Snapshot snapshot() {
    return new Snapshot(
        count("?s a <" + OM + "Table>"),
        count("?s <" + OM + "upstream> ?o"),
        count("?s <" + OM + "downstream> ?o"),
        count("?s <http://www.w3.org/ns/prov#wasDerivedFrom> ?o"),
        count("?s <" + OM + "hasLineageDetails> ?o"),
        count("?s a <" + OM + "ExtensionProperty>"),
        count("?s ?p ?o"));
  }

  void saveSubjectCounts(final Path output) throws IOException {
    if (!Boolean.getBoolean("rdfScaleDiagnostics")) return;
    assertTrue(
        catalog.settings().tables() <= 2000, "Subject diagnostics are limited to pilot catalogs");
    saveDiagnosticQuery(
        output,
        "SELECT ?s (COUNT(*) AS ?count) WHERE { GRAPH <"
            + GRAPH
            + "> { ?s ?p ?o } } GROUP BY ?s ORDER BY ?s");
    saveDiagnosticQuery(
        output.resolveSibling(output.getFileName().toString().replace(".json", "-metadata.json")),
        "SELECT DISTINCT ?s ?p ?o WHERE { GRAPH <"
            + GRAPH
            + "> { VALUES ?type { <"
            + OM
            + "Role> <"
            + OM
            + "Team> <"
            + OM
            + "Type> <"
            + OM
            + "CustomProperty> } ?s a ?type . ?s ?p ?o } } ORDER BY ?s ?p ?o");
  }

  private void saveDiagnosticQuery(final Path output, final String query) throws IOException {
    final var subjects = JsonUtils.getObjectMapper().createArrayNode();
    for (int offset = 0; offset < 50000; offset += 10000) {
      final JsonNode page =
          execute(query + " LIMIT 10000 OFFSET " + offset).path("results").path("bindings");
      page.forEach(subjects::add);
      if (page.size() < 10000) break;
    }
    assertTrue(subjects.size() < 50000, "Subject diagnostics truncated");
    Files.writeString(output, JsonUtils.pojoToJson(subjects));
  }

  private long count(final String pattern) {
    final JsonNode result =
        execute("SELECT (COUNT(*) AS ?count) WHERE { GRAPH <" + GRAPH + "> { " + pattern + " } }");
    return result.path("results").path("bindings").get(0).path("count").path("value").asLong();
  }

  Map<String, Latency> measure(final Path output, final int samples)
      throws IOException, InterruptedException {
    if (samples < 1 || samples > 1000)
      throw new IllegalArgumentException("Query samples must be 1..1000");
    return measure(output, samples, new CountDownLatch(1), 0);
  }

  Map<String, Latency> measureDuringRebuild(final Path output, final CountDownLatch stop)
      throws IOException, InterruptedException {
    return measure(output, 2000, stop, 5);
  }

  private Map<String, Latency> measure(
      final Path output, final int samples, final CountDownLatch stop, final int intervalSeconds)
      throws IOException, InterruptedException {
    final Map<String, List<Timing>> timings = new LinkedHashMap<>();
    try (var writer = Files.newBufferedWriter(output)) {
      for (int sample = 0; sample < samples && stop.getCount() > 0; sample++) {
        for (var query : queries(sample).entrySet()) {
          final Timing timing = timed(query.getKey(), sample, query.getValue());
          timings.computeIfAbsent(query.getKey(), ignored -> new ArrayList<>()).add(timing);
          writer.write(JsonUtils.pojoToJson(timing));
          writer.newLine();
          writer.flush();
        }
        if (stop.await(intervalSeconds, TimeUnit.SECONDS)) break;
      }
    }
    final Map<String, Latency> results = new LinkedHashMap<>();
    timings.forEach((name, values) -> results.put(name, summarize(values)));
    return results;
  }

  private Timing timed(final String name, final int sample, final String query) {
    final String timestamp = Instant.now().toString();
    final long start = System.nanoTime();
    try {
      final JsonNode result = execute(query);
      final int rows = result.path("results").path("bindings").size();
      if (rows == 0) throw new IllegalStateException("Empty scale query: " + name);
      return new Timing(timestamp, name, sample, (System.nanoTime() - start) / 1e6, rows, null);
    } catch (RuntimeException exception) {
      return new Timing(
          timestamp,
          name,
          sample,
          (System.nanoTime() - start) / 1e6,
          0,
          exception.getClass().getSimpleName() + ": " + exception.getMessage());
    }
  }

  private Map<String, String> queries(final int sample) {
    final int index = 64 + (sample * 7919) % (catalog.settings().tables() - 256 + 1);
    final String entity = "<" + catalog.uri(index) + ">";
    return Map.of(
        "entity", "SELECT ?p ?o WHERE { GRAPH <" + GRAPH + "> { " + entity + " ?p ?o } } LIMIT 100",
        "lineageOneHop",
            "SELECT ?source WHERE { GRAPH <"
                + GRAPH
                + "> { "
                + entity
                + " <"
                + OM
                + "upstream> ?source } } LIMIT 100",
        "lineageThreeHops",
            "SELECT DISTINCT ?source WHERE { GRAPH <"
                + GRAPH
                + "> { "
                + entity
                + " <"
                + OM
                + "upstream>/<"
                + OM
                + "upstream>/<"
                + OM
                + "upstream> ?source } } LIMIT 100",
        "textSearch",
            "PREFIX text: <http://jena.apache.org/text#> SELECT DISTINCT ?entity WHERE { "
                + "?entity text:query (<http://purl.org/dc/terms/description> 'rdfscalevalidation' 20) . ?entity a <"
                + OM
                + "Table> } LIMIT 20");
  }

  private static Latency summarize(final List<Timing> timings) {
    final List<Double> sorted = timings.stream().map(Timing::millis).sorted().toList();
    return new Latency(
        timings.size(),
        (int) timings.stream().filter(value -> value.error() != null).count(),
        timings.getFirst().millis(),
        percentile(sorted, 0.5),
        percentile(sorted, 0.95),
        percentile(sorted, 0.99),
        sorted.getLast());
  }

  private static double percentile(final List<Double> sorted, final double fraction) {
    return sorted.get(Math.max(0, (int) Math.ceil(sorted.size() * fraction) - 1));
  }

  JsonNode execute(final String query) {
    return client.execute(
        HttpMethod.POST,
        "/v1/rdf/sparql",
        Map.of("query", query, "format", "json", "inference", "none"),
        JsonNode.class);
  }

  static void assertSuccessful(final Map<String, Latency> queries) {
    assertFalse(queries.isEmpty(), "No query samples were recorded");
    queries.forEach((name, latency) -> assertEquals(0, latency.failures(), name));
  }
}
