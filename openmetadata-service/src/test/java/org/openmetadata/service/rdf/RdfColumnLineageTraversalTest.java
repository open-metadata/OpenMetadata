package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.IntStream;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.rdf.model.Model;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/**
 * Proves that the column-lineage shape written by {@code RdfIndexApp} can be traversed and paged
 * with plain SPARQL. Column resources come from {@link JsonLdTranslator} and lineage from {@code
 * RdfRepository#buildLineageModel}, the two production writers, so the fixture cannot drift from
 * what a reindex projects.
 */
class RdfColumnLineageTraversalTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String PREFIXES = "PREFIX om: <" + BASE + "ontology/>\n";
  private static final String SCHEMA_FQN = "svc.db.s.";
  private static final int FAN_WIDTH = 450;
  private static final int NOISE_TABLES = 24;
  private static final int NOISE_WIDTH = 100;
  private static final int PAGE_SIZE = 400;
  private static final String SOURCE_COLUMN = SCHEMA_FQN + "src.col";

  private static final String DOWNSTREAM_PATH = "^om:fromColumn/om:toColumn";
  private static final String UPSTREAM_PATH = "^om:toColumn/om:fromColumn";

  private final Dataset dataset = DatasetFactory.create();
  private final Model graph = dataset.getNamedModel(GRAPH);
  private final RdfRepository repository =
      new RdfRepository(
          new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
          mock(RdfStorageInterface.class),
          null);
  private final JsonLdTranslator translator =
      new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE);
  private final Map<String, Set<String>> downstreamOf = new HashMap<>();
  private final Map<String, Set<String>> upstreamOf = new HashMap<>();
  private final Map<String, String> assetTypeByColumn = new HashMap<>();
  private final Map<String, String> assetIriByColumn = new HashMap<>();
  private final Map<String, Table> tables = new HashMap<>();
  private int columnLineageNodes;

  @BeforeEach
  void buildFixture() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(
        "dashboarddatamodel", Entity.DASHBOARD_DATA_MODEL);
    addFanOutAndChain();
    addSpecialShapes();
    addNoiseChains();
  }

  @AfterEach
  void close() {
    dataset.close();
  }

  @Test
  void fixtureIsRealisticallyLarge() {
    assertTrue(columnLineageNodes >= 5_000, "column lineage nodes: " + columnLineageNodes);
    assertEquals(columnLineageNodes, count("?c a om:ColumnLineage"));
  }

  @Test
  void downstreamTraversalMatchesTheIndependentWalkOfTheEdgeList() {
    final Set<String> expected = reachable(downstreamOf, SOURCE_COLUMN);

    final List<String> actual = pagedColumns(SOURCE_COLUMN, DOWNSTREAM_PATH, "", PAGE_SIZE);

    assertTrue(expected.size() > 2 * PAGE_SIZE, "fixture must need several pages");
    assertEquals(expected, new HashSet<>(actual));
    assertEquals(expected.size(), actual.size(), "paged union must not repeat rows");
  }

  @Test
  void upstreamTraversalCrossesRenameHopsAndMultiSourceNodes() {
    for (final String start :
        List.of(SCHEMA_FQN + "h5.g001", SCHEMA_FQN + "joined.combined", SCHEMA_FQN + "cyc.a")) {
      final List<String> actual = pagedColumns(start, UPSTREAM_PATH, "", 3);

      assertEquals(reachable(upstreamOf, start), new HashSet<>(actual), start);
      assertEquals(new HashSet<>(actual).size(), actual.size(), start);
    }
  }

  @Test
  void cycleTerminatesAndReachesItself() {
    final List<String> actual = pagedColumns(SCHEMA_FQN + "cyc.a", DOWNSTREAM_PATH, "", PAGE_SIZE);

    assertEquals(Set.of(SCHEMA_FQN + "cyc2.b", SCHEMA_FQN + "cyc.a"), new HashSet<>(actual));
  }

  @Test
  void pagesAreOrderedAndStableAcrossPageSizes() {
    final List<String> full = pagedColumns(SOURCE_COLUMN, DOWNSTREAM_PATH, "", PAGE_SIZE);

    assertEquals(full, pagedColumns(SOURCE_COLUMN, DOWNSTREAM_PATH, "", 97));
    assertEquals(full.stream().sorted().toList(), full);
  }

  @Test
  void typeFilterDropsTheDataModelHopAndKeepsNestedColumnsOnTheirTable() {
    final Set<String> allTables = tableColumnsOnly(reachable(downstreamOf, SOURCE_COLUMN));

    final List<String> actual =
        pagedColumns(SOURCE_COLUMN, DOWNSTREAM_PATH, "?asset a om:Table .", PAGE_SIZE);

    assertEquals(allTables, new HashSet<>(actual));
    assertFalse(actual.contains(SCHEMA_FQN + "dm.metric"));
    assertTrue(actual.contains(SCHEMA_FQN + "nested.payload.id"));
  }

  @Test
  void assetColumnJoinResolvesEveryReachableColumnToItsOwningAsset() {
    final Set<String> reachable = reachable(downstreamOf, SOURCE_COLUMN);
    final Map<String, String> assetByColumn = new TreeMap<>();

    pagedRows(SOURCE_COLUMN, DOWNSTREAM_PATH, "", PAGE_SIZE)
        .forEach(row -> assetByColumn.put(row.column(), row.asset()));

    assertEquals(reachable, assetByColumn.keySet());
    reachable.forEach(fqn -> assertEquals(assetIriByColumn.get(fqn), assetByColumn.get(fqn), fqn));
  }

  @Test
  void fullDownstreamWalkStaysFarInsideTheGuardTimeout() {
    final long started = System.nanoTime();
    final List<String> rows = pagedColumns(SOURCE_COLUMN, DOWNSTREAM_PATH, "", PAGE_SIZE);
    final long totalMillis = (System.nanoTime() - started) / 1_000_000;

    System.out.printf(
        "[column-lineage-timing] downstream of %s: %d rows in %d ms over %d columnLineage nodes%n",
        SOURCE_COLUMN, rows.size(), totalMillis, columnLineageNodes);
    assertTrue(totalMillis < SparqlQueryLimits.TIMEOUT_MILLIS, "took " + totalMillis + " ms");
  }

  /**
   * The sparql_query tool description tells clients to narrow the asset join with these patterns,
   * so each one is pinned against what the production translator writes for an asset.
   */
  @Test
  void assetFilterPatternsAdvertisedToClientsMatchTheProjection() {
    final Table orders = projectedOrdersTable();
    graph.add(translator.toRdf(orders));
    final String assetFqn = orders.getFullyQualifiedName();

    assertTrue(ask("?a om:fullyQualifiedName \"%s\" . ?a a om:Table".formatted(assetFqn)));
    assertTrue(
        ask(
            "?a om:fullyQualifiedName \"%s\" . ?a om:belongsToService/om:fullyQualifiedName \"svc\""
                .formatted(assetFqn)));
    assertTrue(
        ask(
            "?a om:fullyQualifiedName \"%s\" . ?a om:hasOwner/rdfs:label \"growth\""
                .formatted(assetFqn)));
    assertTrue(
        ask(
            "?a om:fullyQualifiedName \"%s\" . ?a om:hasTier/om:tagFQN \"Tier.Tier1\""
                .formatted(assetFqn)));
    assertTrue(
        ask(
            "?a om:fullyQualifiedName \"%s\" . ?a om:hasTag/om:tagFQN \"Tier.Tier1\""
                .formatted(assetFqn)));
  }

  private static Table projectedOrdersTable() {
    final Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName(SCHEMA_FQN + "orders")
            .withService(reference("databaseService", "svc"))
            .withOwners(List.of(reference("team", "growth")))
            .withTags(
                List.of(
                    new TagLabel()
                        .withTagFQN("Tier.Tier1")
                        .withSource(TagLabel.TagSource.CLASSIFICATION)
                        .withLabelType(TagLabel.LabelType.MANUAL)
                        .withState(TagLabel.State.CONFIRMED)));
    return table.withColumns(List.of(column(table.getFullyQualifiedName(), "id")));
  }

  private static EntityReference reference(final String type, final String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(name)
        .withFullyQualifiedName(name);
  }

  private boolean ask(final String pattern) {
    final String query =
        PREFIXES + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nASK { " + pattern + " }";
    try (QueryExecution execution = QueryExecution.create(query, graph)) {
      return execution.execAsk();
    }
  }

  private void addFanOutAndChain() {
    final Table src = table("src", List.of("col", "col_b"));
    final Table fan = table("fan", numbered("f", FAN_WIDTH));
    final Table h1 = table("h1", numbered("f", FAN_WIDTH));
    final Table h2 = table("h2", numbered("f", FAN_WIDTH));
    final Table h3 = table("h3", numbered("g", FAN_WIDTH));
    final Table h4 = table("h4", numbered("g", FAN_WIDTH));
    final Table h5 = table("h5", numbered("g", FAN_WIDTH));

    addEdge(src, fan, fanOut(src, fan));
    addEdge(fan, h1, identity(fan, h1, "f", "f", FAN_WIDTH));
    addEdge(h1, h2, identity(h1, h2, "f", "f", FAN_WIDTH));
    addEdge(h2, h3, identity(h2, h3, "f", "g", FAN_WIDTH));
    addEdge(h3, h4, identity(h3, h4, "g", "g", FAN_WIDTH));
    addEdge(h4, h5, identity(h4, h5, "g", "g", FAN_WIDTH));
  }

  private void addSpecialShapes() {
    final Table h1 = tableNamed("h1");
    final Table h2 = tableNamed("h2");
    final Table h5 = tableNamed("h5");
    final Table other = table("other", List.of("x"));
    final Table joined = table("joined", List.of("combined"));
    final Table nested = nestedTable("nested");
    final Table cyc = table("cyc", List.of("a"));
    final Table cyc2 = table("cyc2", List.of("b"));
    final DashboardDataModel dataModel = dataModel("dm", List.of("metric"));

    addEdge(
        h1,
        joined,
        List.of(
            lineage(
                List.of(columnFqn(h1, "f000"), columnFqn(other, "x")),
                columnFqn(joined, "combined"))));
    addEdge(h1, nested, List.of(lineage(columnFqn(h1, "f002"), SCHEMA_FQN + "nested.payload.id")));
    addEdge(h5, cyc, List.of(lineage(columnFqn(h5, "g001"), columnFqn(cyc, "a"))));
    addEdge(cyc, cyc2, List.of(lineage(columnFqn(cyc, "a"), columnFqn(cyc2, "b"))));
    addEdge(cyc2, cyc, List.of(lineage(columnFqn(cyc2, "b"), columnFqn(cyc, "a"))));
    addDataModelEdge(h2, dataModel, lineage(columnFqn(h2, "f000"), SCHEMA_FQN + "dm.metric"));
  }

  private void addNoiseChains() {
    Table previous = table("n0", numbered("c", NOISE_WIDTH));
    for (int hop = 1; hop < NOISE_TABLES; hop++) {
      final Table next = table("n" + hop, numbered("c", NOISE_WIDTH));
      addEdge(previous, next, identity(previous, next, "c", "c", NOISE_WIDTH));
      previous = next;
    }
  }

  private List<ColumnLineage> fanOut(final Table from, final Table to) {
    return numbered("f", FAN_WIDTH).stream()
        .map(column -> lineage(columnFqn(from, "col"), columnFqn(to, column)))
        .toList();
  }

  private List<ColumnLineage> identity(
      final Table from, final Table to, final String fromPrefix, final String toPrefix, int width) {
    final List<ColumnLineage> lineage = new ArrayList<>();
    for (int i = 0; i < width; i++) {
      lineage.add(
          lineage(
              columnFqn(from, "%s%03d".formatted(fromPrefix, i)),
              columnFqn(to, "%s%03d".formatted(toPrefix, i))));
    }
    return lineage;
  }

  private static List<String> numbered(final String prefix, final int width) {
    return IntStream.range(0, width).mapToObj(i -> "%s%03d".formatted(prefix, i)).toList();
  }

  private Table table(final String name, final List<String> columnNames) {
    final String fqn = SCHEMA_FQN + name;
    final Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(fqn)
            .withColumns(columnNames.stream().map(c -> column(fqn, c)).toList());
    return register(table);
  }

  private Table nestedTable(final String name) {
    final String fqn = SCHEMA_FQN + name;
    final Column child = column(fqn + ".payload", "id");
    final Column parent = column(fqn, "payload").withChildren(List.of(child));
    return register(
        new Table()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(fqn)
            .withColumns(List.of(parent)));
  }

  private DashboardDataModel dataModel(final String name, final List<String> columnNames) {
    final String fqn = SCHEMA_FQN + name;
    final DashboardDataModel model =
        new DashboardDataModel()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(fqn)
            .withColumns(columnNames.stream().map(c -> column(fqn, c)).toList());
    graph.add(translator.toRdf(model));
    columnNames.forEach(c -> indexColumn(fqn + "." + c, "dashboardDataModel", model.getId()));
    return model;
  }

  private Table register(final Table table) {
    graph.add(translator.toRdf(table));
    tables.put(table.getName(), table);
    table
        .getColumns()
        .forEach(
            column -> {
              indexColumn(column.getFullyQualifiedName(), "table", table.getId());
              if (column.getChildren() != null) {
                column
                    .getChildren()
                    .forEach(
                        child ->
                            indexColumn(child.getFullyQualifiedName(), "table", table.getId()));
              }
            });
    return table;
  }

  private Table tableNamed(final String name) {
    return tables.get(name);
  }

  private void indexColumn(final String fqn, final String type, final UUID assetId) {
    assetTypeByColumn.put(fqn, type);
    assetIriByColumn.put(fqn, BASE + "entity/" + type + "/" + assetId);
  }

  private static Column column(final String parentFqn, final String name) {
    return new Column()
        .withName(name)
        .withFullyQualifiedName(parentFqn + "." + name)
        .withDataType(ColumnDataType.STRING);
  }

  private static String columnFqn(final Table table, final String name) {
    return table.getFullyQualifiedName() + "." + name;
  }

  private static ColumnLineage lineage(final String fromColumn, final String toColumn) {
    return lineage(List.of(fromColumn), toColumn);
  }

  private static ColumnLineage lineage(final List<String> fromColumns, final String toColumn) {
    return new ColumnLineage().withFromColumns(fromColumns).withToColumn(toColumn);
  }

  private void addEdge(final Table from, final Table to, final List<ColumnLineage> lineage) {
    writeEdge("table", from.getId(), "table", to.getId(), lineage);
  }

  private void addDataModelEdge(
      final Table from, final DashboardDataModel to, final ColumnLineage lineage) {
    writeEdge("table", from.getId(), "dashboardDataModel", to.getId(), List.of(lineage));
  }

  private void writeEdge(
      final String fromType,
      final UUID fromId,
      final String toType,
      final UUID toId,
      final List<ColumnLineage> lineage) {
    final LineageDetails details = new LineageDetails().withColumnsLineage(lineage);
    graph.add(repository.buildLineageModel(fromType, fromId, toType, toId, details));
    lineage.forEach(this::recordInOracle);
    columnLineageNodes += lineage.size();
  }

  private void recordInOracle(final ColumnLineage lineage) {
    for (final String from : lineage.getFromColumns()) {
      downstreamOf.computeIfAbsent(from, key -> new HashSet<>()).add(lineage.getToColumn());
      upstreamOf.computeIfAbsent(lineage.getToColumn(), key -> new HashSet<>()).add(from);
    }
  }

  private static Set<String> reachable(final Map<String, Set<String>> edges, final String start) {
    final Set<String> seen = new HashSet<>();
    final Deque<String> frontier = new ArrayDeque<>(edges.getOrDefault(start, Set.of()));
    while (!frontier.isEmpty()) {
      final String next = frontier.poll();
      if (seen.add(next)) {
        frontier.addAll(edges.getOrDefault(next, Set.of()));
      }
    }
    return seen;
  }

  private Set<String> tableColumnsOnly(final Set<String> columns) {
    final Set<String> filtered = new HashSet<>(columns);
    filtered.removeIf(fqn -> !"table".equals(assetTypeByColumn.get(fqn)));
    return filtered;
  }

  private int count(final String pattern) {
    return countRows("SELECT (COUNT(*) AS ?n) WHERE { " + pattern + " }");
  }

  private int countRows(final String select) {
    try (QueryExecution execution = QueryExecution.create(PREFIXES + select, graph)) {
      return execution.execSelect().next().getLiteral("n").getInt();
    }
  }

  private List<String> pagedColumns(
      final String start, final String path, final String filter, final int pageSize) {
    return pagedRows(start, path, filter, pageSize).stream().map(Row::column).toList();
  }

  private List<Row> pagedRows(
      final String start, final String path, final String filter, final int pageSize) {
    final List<Row> rows = new ArrayList<>();
    int offset = 0;
    List<Row> page;
    do {
      page = runPage(start, path, filter, pageSize, offset);
      rows.addAll(page);
      offset += pageSize;
    } while (page.size() == pageSize);
    return rows;
  }

  private List<Row> runPage(
      final String start,
      final String path,
      final String filter,
      final int pageSize,
      final int offset) {
    final String query = columnQuery(start, path, filter, pageSize, offset);
    final long started = System.nanoTime();
    final List<Row> page = new ArrayList<>();
    try (QueryExecution execution = QueryExecution.create(query, graph)) {
      execution.execSelect().forEachRemaining(solution -> page.add(Row.from(solution)));
    }
    final long millis = (System.nanoTime() - started) / 1_000_000;
    assertTrue(millis < SparqlQueryLimits.TIMEOUT_MILLIS, "page took " + millis + " ms");
    return page;
  }

  // The asset join walks up from the already-bound column. The forward form
  // `?asset om:hasColumn/om:hasChildColumn* ?c` made ARQ enumerate every node as a zero-length
  // start and took ~6.6 s per page on this fixture versus ~50 ms for the inverse form.
  private static String columnQuery(
      final String start,
      final String path,
      final String filter,
      final int pageSize,
      final int offset) {
    return PREFIXES
        + """
        SELECT DISTINCT ?column ?asset WHERE {
          "%s" (%s)+ ?column .
          ?c om:fullyQualifiedName ?column .
          ?c (^om:hasChildColumn)*/^om:hasColumn ?asset .
          %s
        } ORDER BY ?column ?asset LIMIT %d OFFSET %d
        """
            .formatted(start, path, filter, pageSize, offset);
  }

  private record Row(String column, String asset) {
    static Row from(final QuerySolution solution) {
      return new Row(
          solution.getLiteral("column").getString(), solution.getResource("asset").getURI());
    }
  }
}
