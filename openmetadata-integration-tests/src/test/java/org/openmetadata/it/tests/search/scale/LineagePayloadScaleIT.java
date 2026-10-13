package org.openmetadata.it.tests.search.scale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Measures what each lineage read returns for one busy table: response size, latency, which node
 * fields carry the weight, whether paging reaches every node once, and whether requests asking for
 * different {@code fields} share a cache entry.
 *
 * <p>The graph is shaped like the one that broke AskCollate: one hub table feeding thousands of
 * tables, every column mapped on every edge, and SQL on each edge. The defaults mirror that case
 * (about 4,500 edges off the hub) and every size is a system property, so the same class measures
 * before and after a change.
 *
 * <p>It records numbers and asserts only that the graph was seeded and indexed. Behaviour is
 * judged from the report it writes to {@code target/benchmark/lineage-payload.txt}.
 */
@Tag("scale")
class LineagePayloadScaleIT {

  private static final Logger LOG = LoggerFactory.getLogger(LineagePayloadScaleIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static final int FANOUT = Integer.getInteger("jpw.lineagePayload.fanout", 4_500);
  private static final int SECOND_HOP = Integer.getInteger("jpw.lineagePayload.secondHop", 500);
  private static final int COLUMNS = Integer.getInteger("jpw.lineagePayload.columns", 50);
  private static final int SQL_CHARS = Integer.getInteger("jpw.lineagePayload.sqlChars", 2_000);
  private static final int PAGE_SIZE = Integer.getInteger("jpw.lineagePayload.pageSize", 50);
  private static final int WORKERS = Integer.getInteger("jpw.lineagePayload.workers", 16);
  private static final Duration INDEXING_TIMEOUT =
      Duration.ofMinutes(Integer.getInteger("jpw.lineagePayload.indexTimeoutMin", 30));

  private static final String UPSTREAM_ENTRY_FIELD =
      "upstreamLineage.fromEntity.fullyQualifiedName.keyword";
  private static final String SLIM_FIELDS = "fullyQualifiedName";
  private static final Path REPORT = Path.of("target", "benchmark", "lineage-payload.txt");

  private record Graph(Table hub, List<Table> consumers, List<Table> secondHop, String prefix) {}

  private record Measured(String body, long bytes, long millis) {
    JsonNode json() throws IOException {
      return MAPPER.readTree(body);
    }
  }

  private final Map<String, String> report = new LinkedHashMap<>();

  @Test
  void measureLineagePayloadsForABusyTable() throws Exception {
    TestNamespace namespace = new TestNamespace("LineagePayloadScaleIT");
    Graph graph = seed(namespace);
    awaitIndexed(graph);

    measureDatabaseLineage(graph);
    measureSearchLineage(graph);
    measureEntityCountFirstPage(graph);
    measureFieldsAndCache(graph);
    measureEntityCountPaging(graph);
    measureColumnFilter(graph);
    writeReport();
  }

  // ---------------- seeding ----------------

  private Graph seed(TestNamespace namespace) throws Exception {
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(
            namespace, DatabaseServiceTestFactory.createPostgres(namespace));
    long started = System.nanoTime();
    Table hub = createTable(schema, namespace.prefix("payload_hub"));
    List<Table> consumers = createTables(schema, namespace, "payload_c_", FANOUT);
    List<Table> secondHop = createTables(schema, namespace, "payload_d_", SECOND_HOP);
    runAll(IntStream.range(0, FANOUT).mapToObj(i -> edge(hub, consumers.get(i))).toList());
    runAll(
        IntStream.range(0, SECOND_HOP)
            .mapToObj(i -> edge(consumers.get(i), secondHop.get(i)))
            .toList());
    note(
        "seeded",
        "%d tables, %d edges, %d columns per table, %d SQL chars per edge, in %d s",
        1 + FANOUT + SECOND_HOP,
        FANOUT + SECOND_HOP,
        COLUMNS,
        SQL_CHARS,
        (System.nanoTime() - started) / 1_000_000_000);
    return new Graph(hub, consumers, secondHop, schema.getFullyQualifiedName());
  }

  private static List<Table> createTables(
      DatabaseSchema schema, TestNamespace namespace, String stem, int count) throws Exception {
    return runAll(
        IntStream.range(0, count)
            .mapToObj(
                i ->
                    (Callable<Table>)
                        () ->
                            createTable(
                                schema,
                                namespace.prefix(stem + String.format(Locale.ROOT, "%05d", i))))
            .toList());
  }

  private static Table createTable(DatabaseSchema schema, String name) {
    List<Column> columns =
        IntStream.range(0, COLUMNS)
            .mapToObj(i -> ColumnBuilder.of("c_" + i, "VARCHAR").dataLength(255).build())
            .toList();
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(columns));
  }

  /** Every column mapped, plus SQL: the two things that make a real edge heavy. */
  private static Callable<Void> edge(Table from, Table to) {
    List<ColumnLineage> mappings =
        IntStream.range(0, COLUMNS)
            .mapToObj(
                i ->
                    new ColumnLineage()
                        .withFromColumns(List.of(from.getFullyQualifiedName() + ".c_" + i))
                        .withToColumn(to.getFullyQualifiedName() + ".c_" + i))
            .toList();
    LineageDetails details =
        new LineageDetails()
            .withColumnsLineage(mappings)
            .withSqlQuery(sql(from, to))
            .withSource(LineageDetails.Source.QUERY_LINEAGE);
    EntitiesEdge edge =
        new EntitiesEdge()
            .withFromEntity(from.getEntityReference())
            .withToEntity(to.getEntityReference())
            .withLineageDetails(details);
    return () -> {
      SdkClients.adminClient().lineage().addLineage(new AddLineage().withEdge(edge));
      return null;
    };
  }

  private static String sql(Table from, Table to) {
    StringBuilder sql =
        new StringBuilder("INSERT INTO ")
            .append(to.getFullyQualifiedName())
            .append(" SELECT * FROM ")
            .append(from.getFullyQualifiedName())
            .append(" WHERE ");
    while (sql.length() < SQL_CHARS) {
      sql.append("c_0 IS NOT NULL AND ");
    }
    return sql.substring(0, SQL_CHARS);
  }

  private static <T> List<T> runAll(Collection<Callable<T>> tasks) throws Exception {
    ExecutorService executor = Executors.newFixedThreadPool(WORKERS);
    try {
      List<Future<T>> futures = executor.invokeAll(tasks);
      List<T> results = new ArrayList<>(futures.size());
      for (Future<T> future : futures) {
        results.add(resultOf(future));
      }
      return results;
    } finally {
      executor.shutdownNow();
    }
  }

  private static <T> T resultOf(Future<T> future) throws Exception {
    try {
      return future.get();
    } catch (ExecutionException e) {
      throw (Exception) e.getCause();
    }
  }

  // ---------------- waiting for the index ----------------

  /** One upstreamLineage entry per edge, on the edge's downstream table. */
  private void awaitIndexed(Graph graph) {
    SearchClient search = new SearchClient(OssTestServer.defaultHandle());
    String tableIndex =
        new IndexAliasInspector(OssTestServer.defaultHandle()).indexNameFor(Entity.TABLE);
    long started = System.nanoTime();
    Awaitility.await("lineage indexed")
        .atMost(INDEXING_TIMEOUT)
        .pollInterval(Duration.ofSeconds(5))
        .ignoreExceptions()
        .until(() -> upstreamEntries(search, tableIndex, graph.prefix()) >= FANOUT + SECOND_HOP);
    note("indexed", "after %d s", (System.nanoTime() - started) / 1_000_000_000);
  }

  private static long upstreamEntries(SearchClient search, String index, String prefix) {
    ObjectNode body = MAPPER.createObjectNode();
    body.put("size", 0);
    body.putObject("query")
        .putObject("prefix")
        .put("fullyQualifiedName", prefix.toLowerCase(Locale.ROOT));
    body.putObject("aggs")
        .putObject("entries")
        .putObject("value_count")
        .put("field", UPSTREAM_ENTRY_FIELD);
    return search
        .search(index, body.toString())
        .path("aggregations")
        .path("entries")
        .path("value")
        .asLong();
  }

  // ---------------- measurements ----------------

  /** The endpoint AskCollate calls today: the whole graph, every mapping and SQL. */
  private void measureDatabaseLineage(Graph graph) throws IOException {
    for (int depth : new int[] {1, 2}) {
      Measured response =
          get(
              "table/name/" + graph.hub().getFullyQualifiedName(),
              Map.of("upstreamDepth", "0", "downstreamDepth", String.valueOf(depth)));
      JsonNode json = response.json();
      note(
          "db /lineage/table/name depth " + depth,
          "%s in %d ms, %d nodes, %d edges",
          megabytes(response.bytes()),
          response.millis(),
          json.path("nodes").size(),
          json.path("downstreamEdges").size());
    }
  }

  /** What the UI lineage graph calls, one layer at a time. */
  private void measureSearchLineage(Graph graph) throws IOException {
    for (String size : List.of(String.valueOf(PAGE_SIZE), "1000")) {
      Measured response =
          get(
              "getLineage",
              Map.of(
                  "fqn",
                  graph.hub().getFullyQualifiedName(),
                  "type",
                  Entity.TABLE,
                  "upstreamDepth",
                  "0",
                  "downstreamDepth",
                  "1",
                  "size",
                  size));
      JsonNode json = response.json();
      note(
          "search /getLineage depth 1 size " + size,
          "%s in %d ms, %d nodes, %d edges",
          megabytes(response.bytes()),
          response.millis(),
          json.path("nodes").size(),
          json.path("downstreamEdges").size());
    }
  }

  /** What the UI lineage table (impact analysis) calls: one page and what is in it. */
  private void measureEntityCountFirstPage(Graph graph) throws IOException {
    Measured page = entityCountPage(graph, 1, 0, Map.of("include_pagination_info", "true"));
    JsonNode json = page.json();
    note(
        "entityCount page 1 (size " + PAGE_SIZE + ")",
        "%s in %d ms, %d nodes, %d edges, nodes %s, edges %s, pagination %s",
        megabytes(page.bytes()),
        page.millis(),
        json.path("nodes").size(),
        json.path("downstreamEdges").size(),
        megabytes(json.path("nodes").toString().length()),
        megabytes(json.path("downstreamEdges").toString().length()),
        json.path("paginationInfo").toString());
    note("entityCount page 1 node fields", "%s", nodeFieldShares(json.path("nodes")));
    for (String field : List.of("columns", "upstreamLineage")) {
      assertTrue(
          everyNodeBeyondTheHubHas(json.path("nodes"), graph, field),
          "page nodes are whole documents: every one has " + field);
    }
    note("entityCount page 1 edge fields", "%s", edgeFieldShares(json.path("downstreamEdges")));
  }

  /** Every page of depth 1 and depth 2: does paging reach each node exactly once, and at what cost. */
  /**
   * Every page at depth 1 and depth 2. Each page must hold exactly its slice of the server's order
   * (depth, then FQN), so the whole walk reaches every node once.
   */
  private void measureEntityCountPaging(Graph graph) throws IOException {
    List<String> depthOne = sorted(graph.consumers());
    List<String> depthTwo = new ArrayList<>(depthOne);
    depthTwo.addAll(sorted(graph.secondHop()));
    measureDepthPaging(graph, 1, depthOne);
    measureDepthPaging(graph, 2, depthTwo);
  }

  private void measureDepthPaging(Graph graph, int depth, List<String> expectedOrder)
      throws IOException {
    List<String> order = new ArrayList<>(List.of(graph.hub().getFullyQualifiedName()));
    order.addAll(expectedOrder);
    Set<String> seen = new HashSet<>();
    int duplicates = 0;
    int wrongPages = 0;
    int pages = 0;
    long bytes = 0;
    long millis = 0;
    long slowest = 0;
    for (int from = 0; from < order.size(); from += PAGE_SIZE) {
      Measured page = entityCountPage(graph, depth, from, Map.of());
      pages++;
      bytes += page.bytes();
      millis += page.millis();
      slowest = Math.max(slowest, page.millis());
      List<String> onPage = nodesAtOrBeyond(page.json().path("nodes"), graph);
      duplicates += (int) onPage.stream().filter(fqn -> !seen.add(fqn)).count();
      Set<String> slice =
          new HashSet<>(order.subList(from, Math.min(from + PAGE_SIZE, order.size())));
      slice.remove(graph.hub().getFullyQualifiedName());
      wrongPages += slice.equals(new HashSet<>(onPage)) ? 0 : 1;
    }
    Set<String> missing = new HashSet<>(expectedOrder);
    missing.removeAll(seen);
    note(
        "entityCount paging depth " + depth,
        "%d pages, %s total, %d ms total (slowest page %d ms), %d distinct nodes, %d duplicates,"
            + " %d of %d expected missing, %d pages not their exact slice",
        pages,
        megabytes(bytes),
        millis,
        slowest,
        seen.size(),
        duplicates,
        missing.size(),
        expectedOrder.size(),
        wrongPages);
    assertEquals(0, duplicates, "no node on two pages at depth " + depth);
    assertTrue(missing.isEmpty(), "every node reached at depth " + depth);
    assertEquals(0, wrongPages, "every page is its slice of (depth, FQN) order at depth " + depth);
  }

  private static List<String> sorted(List<Table> tables) {
    return tables.stream().map(Table::getFullyQualifiedName).sorted().toList();
  }

  /**
   * Slim {@code fields} against the default, and whether one poisons the other through the
   * lineage cache. Each order uses its own offset, off the paging grid, so neither starts from an
   * entry another measurement already cached.
   */
  private void measureFieldsAndCache(Graph graph) throws IOException {
    int slimFirstOffset = 7;
    Measured slim = entityCountPage(graph, 1, slimFirstOffset, Map.of("fields", SLIM_FIELDS));
    Measured fullAfterSlim = entityCountPage(graph, 1, slimFirstOffset, Map.of());
    int fullFirstOffset = 13;
    Measured full = entityCountPage(graph, 1, fullFirstOffset, Map.of());
    Measured slimAfterFull =
        entityCountPage(graph, 1, fullFirstOffset, Map.of("fields", SLIM_FIELDS));
    note(
        "entityCount fields=" + SLIM_FIELDS,
        "%s (default fields: %s)",
        megabytes(slim.bytes()),
        megabytes(full.bytes()));
    note(
        "cache: default after slim",
        "%s, node has columns: %s",
        megabytes(fullAfterSlim.bytes()),
        anyNodeHas(fullAfterSlim.json().path("nodes"), "columns"));
    note(
        "cache: slim after default",
        "%s, node has columns: %s",
        megabytes(slimAfterFull.bytes()),
        anyNodeHas(slimAfterFull.json().path("nodes"), "columns"));
  }

  /** The exact column FQN, as AskCollate would send it for a one-column question. */
  private void measureColumnFilter(Graph graph) throws IOException {
    String column = graph.hub().getFullyQualifiedName() + ".c_1";
    Measured page = entityCountPage(graph, 1, 0, Map.of("column_filter", "columnName:" + column));
    JsonNode edges = page.json().path("downstreamEdges");
    Map<String, Integer> targets = new TreeMap<>();
    edges.forEach(
        edge ->
            edge.path("columns")
                .forEach(
                    mapping -> {
                      String to = mapping.path("toColumn").asText();
                      targets.merge(to.substring(to.lastIndexOf('.') + 1), 1, Integer::sum);
                    }));
    note(
        "entityCount column_filter=columnName:<hub>.c_1",
        "%s in %d ms, %d edges, target columns %s",
        megabytes(page.bytes()),
        page.millis(),
        edges.size(),
        targets);
  }

  // ---------------- helpers ----------------

  private Measured entityCountPage(Graph graph, int depth, int from, Map<String, String> extra)
      throws IOException {
    Map<String, String> query = new LinkedHashMap<>();
    query.put("fqn", graph.hub().getFullyQualifiedName());
    query.put("entityType", Entity.TABLE);
    query.put("direction", "Downstream");
    query.put("nodeDepth", String.valueOf(depth));
    query.put("maxDepth", String.valueOf(depth));
    query.put("upstreamDepth", "0");
    query.put("downstreamDepth", String.valueOf(depth));
    query.put("from", String.valueOf(from));
    query.put("size", String.valueOf(PAGE_SIZE));
    query.putAll(extra);
    return get("getLineageByEntityCount", query);
  }

  private static Measured get(String path, Map<String, String> query) {
    RequestOptions.Builder options = RequestOptions.builder();
    query.forEach(options::queryParam);
    long started = System.nanoTime();
    String body =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/lineage/" + path, null, options.build());
    long millis = (System.nanoTime() - started) / 1_000_000;
    return new Measured(body, body.getBytes(StandardCharsets.UTF_8).length, millis);
  }

  private static List<String> nodesAtOrBeyond(JsonNode nodes, Graph graph) {
    List<String> fqns = new ArrayList<>();
    nodes.fieldNames().forEachRemaining(fqns::add);
    fqns.remove(graph.hub().getFullyQualifiedName());
    return fqns;
  }

  private static boolean everyNodeBeyondTheHubHas(JsonNode nodes, Graph graph, String field) {
    boolean allHave = true;
    for (Map.Entry<String, JsonNode> node : (Iterable<Map.Entry<String, JsonNode>>) nodes::fields) {
      boolean isHub = node.getKey().equals(graph.hub().getFullyQualifiedName());
      allHave &= isHub || node.getValue().path("entity").has(field);
    }
    return allHave;
  }

  private static boolean anyNodeHas(JsonNode nodes, String field) {
    for (JsonNode node : nodes) {
      if (node.path("entity").has(field)) {
        return true;
      }
    }
    return false;
  }

  /** Share of the node bytes each entity field takes, largest first. */
  private static String nodeFieldShares(JsonNode nodes) {
    Map<String, Long> sizes = new TreeMap<>();
    nodes.forEach(
        node ->
            node.path("entity")
                .fields()
                .forEachRemaining(
                    field ->
                        sizes.merge(
                            field.getKey(),
                            (long) field.getValue().toString().length(),
                            Long::sum)));
    return shares(sizes);
  }

  private static String edgeFieldShares(JsonNode edges) {
    Map<String, Long> sizes = new TreeMap<>();
    edges.forEach(
        edge ->
            edge.fields()
                .forEachRemaining(
                    field ->
                        sizes.merge(
                            field.getKey(),
                            (long) field.getValue().toString().length(),
                            Long::sum)));
    return shares(sizes);
  }

  private static String shares(Map<String, Long> sizes) {
    long total = sizes.values().stream().mapToLong(Long::longValue).sum();
    StringBuilder out = new StringBuilder(megabytes(total)).append(':');
    sizes.entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
        .limit(12)
        .forEach(
            entry ->
                out.append(
                    String.format(
                        Locale.ROOT,
                        " %s %.1f%%",
                        entry.getKey(),
                        total == 0 ? 0.0 : 100.0 * entry.getValue() / total)));
    return out.toString();
  }

  private static String megabytes(long bytes) {
    return String.format(Locale.ROOT, "%.2f MB", bytes / 1_048_576.0);
  }

  private void note(String what, String format, Object... args) {
    String value = String.format(Locale.ROOT, format, args);
    report.put(what, value);
    LOG.info("[lineage-payload] {}: {}", what, value);
  }

  private void writeReport() throws IOException {
    StringBuilder out = new StringBuilder();
    report.forEach((what, value) -> out.append(what).append(": ").append(value).append('\n'));
    Files.createDirectories(REPORT.getParent());
    Files.writeString(REPORT, out.toString());
    assertTrue(report.containsKey("indexed"), "the graph was seeded and indexed");
  }
}
