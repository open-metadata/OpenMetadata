package org.openmetadata.service.rdf;

import java.lang.reflect.Proxy;
import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/**
 * About 5,000 column-lineage mappings in exactly the shape {@code RdfIndexApp} projects.
 *
 * <p>Column resources come from {@link JsonLdTranslator} and lineage from {@code
 * RdfRepository#buildLineageModel}, the two production writers, so a query that works here works
 * on a reindexed catalog. The expected results are computed by walking the recorded edge list in
 * Java, never by SPARQL, so they stay an independent oracle for the query under test.
 *
 * <p>Shapes: a fan-out of one column into {@value #FAN_WIDTH}, a six-hop chain with a rename hop, a
 * mapping with several source columns, a cycle, a hop into a dashboard data model, a nested child
 * column, and unrelated noise chains.
 *
 * <p>Table names within the schema are fixed ({@code src}, {@code fan}, {@code h1}..{@code h5},
 * {@code other}, {@code joined}, {@code nested}, {@code cyc}, {@code cyc2}, {@code dm}, {@code
 * n0}..); the schema prefix and base URI are the caller's, so an integration test can keep its
 * assets apart from everything else in a shared graph.
 */
public final class ColumnLineageFixture {
  public static final int FAN_WIDTH = 450;
  public static final int NOISE_TABLES = 24;
  public static final int NOISE_WIDTH = 100;
  public static final String TABLE_TYPE = "table";
  private static final String DATA_MODEL_TYPE = "dashboardDataModel";

  private final String baseUri;
  private final String schemaPrefix;
  private final Model model = ModelFactory.createDefaultModel();
  private final RdfRepository repository;
  private final JsonLdTranslator translator;
  private final Map<String, Set<String>> downstreamOf = new HashMap<>();
  private final Map<String, Set<String>> upstreamOf = new HashMap<>();
  private final Map<String, String> assetTypeByColumn = new HashMap<>();
  private final Map<String, String> assetIriByColumn = new HashMap<>();
  private final Map<String, Table> tables = new HashMap<>();
  private int columnLineageNodes;

  private ColumnLineageFixture(final String baseUri, final String schemaPrefix) {
    this.baseUri = baseUri;
    this.schemaPrefix = schemaPrefix;
    this.repository =
        new RdfRepository(
            new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(baseUri)),
            unusedStorage(),
            null);
    this.translator = new JsonLdTranslator(JsonUtils.getObjectMapper(), baseUri);
  }

  /**
   * @param schemaPrefix the FQN prefix every table sits under, including the trailing dot, for
   *     example {@code svc.db.s.}
   */
  public static ColumnLineageFixture build(final String baseUri, final String schemaPrefix) {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(TABLE_TYPE, Entity.TABLE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(
        "dashboarddatamodel", Entity.DASHBOARD_DATA_MODEL);
    final ColumnLineageFixture fixture = new ColumnLineageFixture(baseUri, schemaPrefix);
    fixture.addFanOutAndChain();
    fixture.addSpecialShapes();
    fixture.addNoiseChains();
    return fixture;
  }

  /** Every table, column and lineage triple; the caller may add its own before querying. */
  public Model model() {
    return model;
  }

  public int columnLineageNodes() {
    return columnLineageNodes;
  }

  public String columnFqn(final String tableName, final String columnName) {
    return schemaPrefix + tableName + "." + columnName;
  }

  /** The column whose downstream set spans several pages and every special shape. */
  public String sourceColumn() {
    return columnFqn("src", "col");
  }

  /** The nested child column, whose asset sits two levels above it. */
  public String nestedColumn() {
    return schemaPrefix + "nested.payload.id";
  }

  public Set<String> downstreamOf(final String columnFqn) {
    return reachable(downstreamOf, columnFqn);
  }

  public Set<String> upstreamOf(final String columnFqn) {
    return reachable(upstreamOf, columnFqn);
  }

  public Set<String> onlyTableColumns(final Set<String> columnFqns) {
    final Set<String> filtered = new HashSet<>(columnFqns);
    filtered.removeIf(fqn -> !TABLE_TYPE.equals(assetTypeByColumn.get(fqn)));
    return filtered;
  }

  public String assetIriOf(final String columnFqn) {
    return assetIriByColumn.get(columnFqn);
  }

  private void addFanOutAndChain() {
    final Table src = table("src", List.of("col", "col_b"));
    final Table fan = table("fan", numbered("f"));
    final Table h1 = table("h1", numbered("f"));
    final Table h2 = table("h2", numbered("f"));
    final Table h3 = table("h3", numbered("g"));
    final Table h4 = table("h4", numbered("g"));
    final Table h5 = table("h5", numbered("g"));

    addEdge(src, fan, fanOut(src, fan));
    addEdge(fan, h1, identity(fan, h1, "f", "f", FAN_WIDTH));
    addEdge(h1, h2, identity(h1, h2, "f", "f", FAN_WIDTH));
    addEdge(h2, h3, identity(h2, h3, "f", "g", FAN_WIDTH));
    addEdge(h3, h4, identity(h3, h4, "g", "g", FAN_WIDTH));
    addEdge(h4, h5, identity(h4, h5, "g", "g", FAN_WIDTH));
  }

  private void addSpecialShapes() {
    final Table h1 = tables.get("h1");
    final Table other = table("other", List.of("x"));
    final Table joined = table("joined", List.of("combined"));
    final Table nested = nestedTable("nested");
    final Table cyc = table("cyc", List.of("a"));
    final Table cyc2 = table("cyc2", List.of("b"));

    addEdge(
        h1,
        joined,
        List.of(
            lineage(
                List.of(columnFqn(h1, "f000"), columnFqn(other, "x")),
                columnFqn(joined, "combined"))));
    addEdge(h1, nested, List.of(lineage(columnFqn(h1, "f002"), nestedColumn())));
    addEdge(
        tables.get("h5"),
        cyc,
        List.of(lineage(columnFqn(tables.get("h5"), "g001"), columnFqn(cyc, "a"))));
    addEdge(cyc, cyc2, List.of(lineage(columnFqn(cyc, "a"), columnFqn(cyc2, "b"))));
    addEdge(cyc2, cyc, List.of(lineage(columnFqn(cyc2, "b"), columnFqn(cyc, "a"))));
    addDataModelEdge(tables.get("h2"), dataModel("dm", List.of("metric")));
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
    return numbered("f").stream()
        .map(column -> lineage(columnFqn(from, "col"), columnFqn(to, column)))
        .toList();
  }

  private List<ColumnLineage> identity(
      final Table from,
      final Table to,
      final String fromPrefix,
      final String toPrefix,
      final int width) {
    final List<ColumnLineage> lineage = new ArrayList<>();
    for (int i = 0; i < width; i++) {
      lineage.add(
          lineage(
              columnFqn(from, "%s%03d".formatted(fromPrefix, i)),
              columnFqn(to, "%s%03d".formatted(toPrefix, i))));
    }
    return lineage;
  }

  private static List<String> numbered(final String prefix) {
    return numbered(prefix, FAN_WIDTH);
  }

  private static List<String> numbered(final String prefix, final int width) {
    return IntStream.range(0, width).mapToObj(i -> "%s%03d".formatted(prefix, i)).toList();
  }

  private Table table(final String name, final List<String> columnNames) {
    final String fqn = schemaPrefix + name;
    return register(
        new Table()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(fqn)
            .withColumns(columnNames.stream().map(c -> column(fqn, c)).toList()));
  }

  private Table nestedTable(final String name) {
    final String fqn = schemaPrefix + name;
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
    final String fqn = schemaPrefix + name;
    final DashboardDataModel dataModel =
        new DashboardDataModel()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(fqn)
            .withColumns(columnNames.stream().map(c -> column(fqn, c)).toList());
    model.add(translator.toRdf(dataModel));
    columnNames.forEach(c -> indexColumn(fqn + "." + c, DATA_MODEL_TYPE, dataModel.getId()));
    return dataModel;
  }

  private Table register(final Table table) {
    model.add(translator.toRdf(table));
    tables.put(table.getName(), table);
    table.getColumns().forEach(column -> indexColumnTree(column, table.getId()));
    return table;
  }

  private void indexColumnTree(final Column column, final UUID tableId) {
    indexColumn(column.getFullyQualifiedName(), TABLE_TYPE, tableId);
    if (column.getChildren() != null) {
      column.getChildren().forEach(child -> indexColumnTree(child, tableId));
    }
  }

  private void indexColumn(final String fqn, final String type, final UUID assetId) {
    assetTypeByColumn.put(fqn, type);
    assetIriByColumn.put(fqn, baseUri + "entity/" + type + "/" + assetId);
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
    writeEdge(TABLE_TYPE, from.getId(), TABLE_TYPE, to.getId(), lineage);
  }

  private void addDataModelEdge(final Table from, final DashboardDataModel to) {
    final ColumnLineage lineage =
        lineage(columnFqn(from, "f000"), to.getFullyQualifiedName() + ".metric");
    writeEdge(TABLE_TYPE, from.getId(), DATA_MODEL_TYPE, to.getId(), List.of(lineage));
  }

  private void writeEdge(
      final String fromType,
      final UUID fromId,
      final String toType,
      final UUID toId,
      final List<ColumnLineage> lineage) {
    final LineageDetails details = new LineageDetails().withColumnsLineage(lineage);
    model.add(repository.buildLineageModel(fromType, fromId, toType, toId, details));
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

  /** Building lineage triples never touches storage; a stub avoids a Mockito dependency. */
  private static RdfStorageInterface unusedStorage() {
    return (RdfStorageInterface)
        Proxy.newProxyInstance(
            ColumnLineageFixture.class.getClassLoader(),
            new Class<?>[] {RdfStorageInterface.class},
            (proxy, method, arguments) -> {
              throw new UnsupportedOperationException(method.getName());
            });
  }
}
