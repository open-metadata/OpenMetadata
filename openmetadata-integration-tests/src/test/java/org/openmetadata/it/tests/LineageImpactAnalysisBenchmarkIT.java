package org.openmetadata.it.tests;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Tag("benchmark")
@Disabled("Manual benchmark - run explicitly against a local mysql+elasticsearch stack")
class LineageImpactAnalysisBenchmarkIT {

  private static final Logger LOG = LoggerFactory.getLogger(LineageImpactAnalysisBenchmarkIT.class);
  private static final int DEFAULT_WARMUP_RUNS = 1;
  private static final int DEFAULT_MEASURED_RUNS = 5;

  @Test
  void benchmarkImpactAnalysisTopologyScenarios() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    List<BenchmarkScenario> scenarios =
        List.of(
            new BenchmarkScenario("depth12-width120", 12, 120),
            new BenchmarkScenario("depth12-width240", 12, 240),
            new BenchmarkScenario("depth12-width600", 12, 600),
            new BenchmarkScenario("depth24-width120", 24, 120));

    scenarios = filterRequestedScenarios(scenarios);
    LOG.info(
        "Running benchmark scenarios: {} (warmupRuns={}, measuredRuns={})",
        scenarios.stream().map(BenchmarkScenario::name).collect(Collectors.joining(", ")),
        warmupRuns(),
        measuredRuns());

    for (BenchmarkScenario scenario : scenarios) {
      runScenario(client, shared, scenario);
    }
  }

  private void runScenario(
      OpenMetadataClient client, SharedEntities shared, BenchmarkScenario scenario)
      throws Exception {
    LOG.info("=== Running lineage impact benchmark scenario: {} ===", scenario.name);
    LOG.info(
        "Preparing topology with depth={} width={} (~{} reachable nodes)",
        scenario.depth,
        scenario.width,
        scenario.expectedNodeCount());

    TestNamespace namespace = new TestNamespace("LineageImpactBenchmark" + scenario.name);
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);

    BenchmarkTopology topology = createTopology(client, schema, shared, namespace, scenario);
    try {
      waitForIndexing(
          client,
          topology.root.getFullyQualifiedName(),
          scenario.depth,
          scenario.expectedNodeCount());

      LOG.info("Docker stats before scenario {}:\n{}", scenario.name, captureDockerStats());

      benchmarkInteraction(
          scenario,
          "table-no-filter",
          () ->
              runTableInteraction(
                  client, topology.root.getFullyQualifiedName(), scenario.depth, null));
      benchmarkInteraction(
          scenario,
          "table-structural-filter",
          () ->
              runTableInteraction(
                  client,
                  topology.root.getFullyQualifiedName(),
                  scenario.depth,
                  structuralFilter()));
      benchmarkInteraction(
          scenario,
          "table-node-filter",
          () ->
              runTableInteraction(
                  client,
                  topology.root.getFullyQualifiedName(),
                  scenario.depth,
                  nodeFilterForLayer(scenario.depth)));
      benchmarkInteraction(
          scenario,
          "column-name-filter",
          () ->
              runColumnInteraction(
                  client,
                  topology.root.getFullyQualifiedName(),
                  scenario.depth,
                  null,
                  "columnName:customer_id"));
      benchmarkInteraction(
          scenario,
          "column-tag-glossary-filter",
          () ->
              runColumnInteraction(
                  client,
                  topology.root.getFullyQualifiedName(),
                  scenario.depth,
                  null,
                  "tag:PII.Sensitive,glossary:" + shared.GLOSSARY1_TERM1.getFullyQualifiedName()));

      LOG.info("Docker stats after scenario {}:\n{}", scenario.name, captureDockerStats());
    } finally {
      cleanupTables(client, topology.tables);
    }
  }

  private BenchmarkTopology createTopology(
      OpenMetadataClient client,
      DatabaseSchema schema,
      SharedEntities shared,
      TestNamespace namespace,
      BenchmarkScenario scenario)
      throws Exception {
    List<Table> createdTables = new ArrayList<>();
    String schemaFqn = schema.getFullyQualifiedName();
    TagLabel glossaryLabel = shared.GLOSSARY1_TERM1_LABEL;

    Table root =
        createBenchmarkTable(client, schemaFqn, namespace, scenario.name + "_root", glossaryLabel);
    createdTables.add(root);

    List<Table> previousLayer = List.of(root);
    List<Table> firstLayer = new ArrayList<>();

    for (int depth = 1; depth <= scenario.depth; depth++) {
      List<Table> currentLayer = new ArrayList<>(scenario.width);
      for (int index = 0; index < scenario.width; index++) {
        String name = String.format("%s_layer_%02d_node_%03d", scenario.name, depth, index);
        Table node = createBenchmarkTable(client, schemaFqn, namespace, name, glossaryLabel);
        createdTables.add(node);
        currentLayer.add(node);
      }

      if (depth == 1) {
        firstLayer = currentLayer;
      } else {
        for (int index = 0; index < scenario.width; index++) {
          addLineageWithColumns(client, previousLayer.get(index), currentLayer.get(index));
        }
      }
      previousLayer = currentLayer;
    }

    for (Table firstLayerNode : firstLayer) {
      addLineageWithColumns(client, root, firstLayerNode);
    }

    return new BenchmarkTopology(root, createdTables);
  }

  private Table createBenchmarkTable(
      OpenMetadataClient client,
      String schemaFqn,
      TestNamespace namespace,
      String name,
      TagLabel glossaryLabel)
      throws Exception {
    Column customerId = ColumnBuilder.of("customer_id", "INT").build();
    customerId.setTags(List.of(classificationTag("PII.Sensitive"), glossaryLabel));

    Column benchmarkValue = ColumnBuilder.of("benchmark_value", "VARCHAR").dataLength(128).build();
    Column benchmarkMetric = ColumnBuilder.of("benchmark_metric", "DECIMAL").build();

    return client
        .tables()
        .create(
            new CreateTable()
                .withName(namespace.prefix(name))
                .withDatabaseSchema(schemaFqn)
                .withColumns(List.of(customerId, benchmarkValue, benchmarkMetric)));
  }

  private void addLineageWithColumns(OpenMetadataClient client, Table from, Table to)
      throws Exception {
    LineageDetails details =
        new LineageDetails()
            .withColumnsLineage(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of(from.getFullyQualifiedName() + ".customer_id"))
                        .withToColumn(to.getFullyQualifiedName() + ".customer_id"),
                    new ColumnLineage()
                        .withFromColumns(
                            List.of(from.getFullyQualifiedName() + ".benchmark_metric"))
                        .withToColumn(to.getFullyQualifiedName() + ".benchmark_metric")))
            .withSource(LineageDetails.Source.MANUAL);

    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())
                        .withLineageDetails(details)));
  }

  private void waitForIndexing(
      OpenMetadataClient client, String rootFqn, int depth, int expectedNodeCount) {
    Awaitility.await("lineage impact benchmark indexing")
        .atMost(Duration.ofMinutes(10))
        .pollInterval(Duration.ofSeconds(5))
        .ignoreExceptions()
        .until(
            () -> {
              JsonNode pagingInfo = getPaginationInfo(client, rootFqn, depth);
              return sumDepthCounts(pagingInfo.path("downstreamDepthInfo")) >= expectedNodeCount;
            });
  }

  private void benchmarkInteraction(
      BenchmarkScenario scenario,
      String interactionName,
      Callable<BenchmarkObservation> interaction)
      throws Exception {
    for (int run = 0; run < warmupRuns(); run++) {
      interaction.call();
    }

    long[] samples = new long[measuredRuns()];
    int returnedCount = 0;
    int duplicateCount = 0;

    for (int run = 0; run < measuredRuns(); run++) {
      long start = System.nanoTime();
      BenchmarkObservation observation = interaction.call();
      samples[run] = System.nanoTime() - start;
      returnedCount = observation.returnedCount;
      duplicateCount = observation.duplicateCount;
    }

    Arrays.sort(samples);
    double meanMs = Arrays.stream(samples).average().orElse(0D) / 1_000_000D;
    long p50Ms = samples[samples.length / 2] / 1_000_000;
    long p95Ms = samples[(int) Math.ceil(samples.length * 0.95D) - 1] / 1_000_000;

    LOG.info(
        "Scenario={} interaction={} mean={}ms p50={}ms p95={}ms returnedCount={} duplicateCount={}",
        scenario.name,
        interactionName,
        String.format("%.2f", meanMs),
        p50Ms,
        p95Ms,
        returnedCount,
        duplicateCount);
  }

  private BenchmarkObservation runTableInteraction(
      OpenMetadataClient client, String rootFqn, int depth, String queryFilter) throws Exception {
    int pageSize = Math.max(100, depth * 700);
    String response =
        client
            .lineage()
            .getLineageByEntityCount(
                rootFqn,
                "Downstream",
                0,
                pageSize,
                depth,
                depth,
                false,
                queryFilter,
                null,
                "table");
    JsonNode result = JsonUtils.readTree(response);
    JsonNode nodes = result.path("nodes");
    int returnedCount = Math.max(0, nodes.size() - 1);

    JsonNode pagingInfo = getPaginationInfo(client, rootFqn, depth, queryFilter);
    int duplicateCount =
        Math.max(0, sumDepthCounts(pagingInfo.path("downstreamDepthInfo")) - returnedCount);

    return new BenchmarkObservation(returnedCount, duplicateCount);
  }

  private BenchmarkObservation runColumnInteraction(
      OpenMetadataClient client, String rootFqn, int depth, String queryFilter, String columnFilter)
      throws Exception {
    String response =
        client
            .lineage()
            .searchLineageWithDirection(
                rootFqn, "Downstream", 0, depth, false, queryFilter, columnFilter);
    JsonNode result = JsonUtils.readTree(response);
    Set<String> uniquePairs = extractColumnPairs(result);
    int totalPairs = countColumnPairs(result);

    return new BenchmarkObservation(
        uniquePairs.size(), Math.max(0, totalPairs - uniquePairs.size()));
  }

  private JsonNode getPaginationInfo(OpenMetadataClient client, String rootFqn, int depth)
      throws Exception {
    return getPaginationInfo(client, rootFqn, depth, null);
  }

  private JsonNode getPaginationInfo(
      OpenMetadataClient client, String rootFqn, int depth, String queryFilter) throws Exception {
    RequestOptions.Builder optionsBuilder =
        RequestOptions.builder()
            .queryParam("fqn", rootFqn)
            .queryParam("entityType", "table")
            .queryParam("upstreamDepth", "0")
            .queryParam("downstreamDepth", String.valueOf(depth))
            .queryParam("includeDeleted", "false");
    if (queryFilter != null) {
      optionsBuilder.queryParam("query_filter", queryFilter);
    }

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/lineage/getPaginationInfo", null, optionsBuilder.build());
    return JsonUtils.readTree(response);
  }

  private int sumDepthCounts(JsonNode depthInfo) {
    int total = 0;
    if (depthInfo == null || !depthInfo.isArray()) {
      return total;
    }

    for (JsonNode entry : depthInfo) {
      total += entry.path("entityCount").asInt(0);
    }
    return total;
  }

  private int countColumnPairs(JsonNode result) {
    int total = 0;
    for (String edgeType : List.of("upstreamEdges", "downstreamEdges")) {
      JsonNode edges = result.path(edgeType);
      if (!edges.isObject()) {
        continue;
      }
      for (JsonNode edge : (Iterable<JsonNode>) edges::elements) {
        JsonNode columns = edge.path("columns");
        if (!columns.isArray()) {
          continue;
        }
        for (JsonNode columnLineage : columns) {
          total += columnLineage.path("fromColumns").size();
        }
      }
    }
    return total;
  }

  private Set<String> extractColumnPairs(JsonNode result) {
    Set<String> pairs = new HashSet<>();
    for (String edgeType : List.of("upstreamEdges", "downstreamEdges")) {
      JsonNode edges = result.path(edgeType);
      if (!edges.isObject()) {
        continue;
      }
      for (JsonNode edge : (Iterable<JsonNode>) edges::elements) {
        JsonNode columns = edge.path("columns");
        if (!columns.isArray()) {
          continue;
        }
        for (JsonNode columnLineage : columns) {
          String toColumn = columnLineage.path("toColumn").asText();
          for (JsonNode fromColumn : columnLineage.path("fromColumns")) {
            pairs.add(fromColumn.asText() + "->" + toColumn);
          }
        }
      }
    }
    return pairs;
  }

  private String structuralFilter() {
    return "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";
  }

  private String nodeFilterForLayer(int depth) {
    String suffix = String.format("layer_%02d", depth);
    return String.format(
        "{\"query\":{\"bool\":{\"must\":[{\"wildcard\":{\"name.keyword\":{\"value\":\"*%s*\"}}}]}}}",
        suffix);
  }

  private TagLabel classificationTag(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private void cleanupTables(OpenMetadataClient client, List<Table> tables) {
    for (Table table : tables) {
      try {
        client.tables().delete(table.getId().toString());
      } catch (Exception ignored) {
      }
    }
  }

  private String captureDockerStats() {
    try {
      Process process =
          new ProcessBuilder(
                  "docker",
                  "stats",
                  "--no-stream",
                  "--format",
                  "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}")
              .start();

      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(process.getInputStream()))) {
        String snapshot =
            reader
                .lines()
                .filter(
                    line -> {
                      String lowered = line.toLowerCase();
                      return lowered.contains("openmetadata") || lowered.contains("elastic");
                    })
                .collect(Collectors.joining("\n"));
        process.waitFor();
        return snapshot.isEmpty()
            ? "docker stats returned no openmetadata/elasticsearch containers"
            : snapshot;
      }
    } catch (Exception exception) {
      return "docker stats unavailable: " + exception.getMessage();
    }
  }

  private int warmupRuns() {
    return Integer.getInteger("lineage.benchmark.warmupRuns", DEFAULT_WARMUP_RUNS);
  }

  private int measuredRuns() {
    return Integer.getInteger("lineage.benchmark.measuredRuns", DEFAULT_MEASURED_RUNS);
  }

  private List<BenchmarkScenario> filterRequestedScenarios(List<BenchmarkScenario> scenarios) {
    String requested = System.getProperty("lineage.benchmark.scenarios");
    if (requested == null || requested.isBlank()) {
      return scenarios;
    }

    Set<String> requestedNames =
        Stream.of(requested.split(","))
            .map(String::trim)
            .filter(name -> !name.isEmpty())
            .collect(Collectors.toSet());

    List<BenchmarkScenario> filtered =
        scenarios.stream()
            .filter(scenario -> requestedNames.contains(scenario.name()))
            .collect(Collectors.toList());

    if (filtered.isEmpty()) {
      throw new IllegalArgumentException(
          "No benchmark scenarios matched property lineage.benchmark.scenarios=" + requested);
    }

    return filtered;
  }

  private static final class BenchmarkScenario {
    private final String name;
    private final int depth;
    private final int width;

    private BenchmarkScenario(String name, int depth, int width) {
      this.name = name;
      this.depth = depth;
      this.width = width;
    }

    private int expectedNodeCount() {
      return depth * width;
    }

    private String name() {
      return name;
    }
  }

  private static final class BenchmarkTopology {
    private final Table root;
    private final List<Table> tables;

    private BenchmarkTopology(Table root, List<Table> tables) {
      this.root = root;
      this.tables = tables;
    }
  }

  private static final class BenchmarkObservation {
    private final int returnedCount;
    private final int duplicateCount;

    private BenchmarkObservation(int returnedCount, int duplicateCount) {
      this.returnedCount = returnedCount;
      this.duplicateCount = duplicateCount;
    }
  }
}
