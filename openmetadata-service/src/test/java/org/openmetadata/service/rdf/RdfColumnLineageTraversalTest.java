package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.rdf.model.Model;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/**
 * Proves that the column-lineage shape written by {@code RdfIndexApp} can be traversed and paged
 * with plain SPARQL. The data comes from {@link ColumnLineageFixture}, which is built by the two
 * production writers, and every expected set is the fixture's independent walk of its own edge
 * list.
 */
class RdfColumnLineageTraversalTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String PREFIXES = "PREFIX om: <" + BASE + "ontology/>\n";
  private static final String SCHEMA_FQN = "svc.db.s.";
  private static final int PAGE_SIZE = 250;
  private static final String DOWNSTREAM_PATH = "^om:fromColumn/om:toColumn";
  private static final String UPSTREAM_PATH = "^om:toColumn/om:fromColumn";

  private ColumnLineageFixture fixture;
  private Model graph;
  private String sourceColumn;

  @BeforeEach
  void buildFixture() {
    fixture = ColumnLineageFixture.build(BASE, SCHEMA_FQN);
    graph = fixture.model();
    sourceColumn = fixture.sourceColumn();
  }

  @Test
  void fixtureIsRealisticallyLarge() {
    assertTrue(
        fixture.columnLineageNodes() >= 5_000,
        "column lineage nodes: " + fixture.columnLineageNodes());
    assertEquals(fixture.columnLineageNodes(), count("?c a om:ColumnLineage"));
  }

  @Test
  void downstreamTraversalMatchesTheIndependentWalkOfTheEdgeList() {
    final Set<String> expected = fixture.downstreamOf(sourceColumn);

    final List<String> actual = pagedColumns(sourceColumn, DOWNSTREAM_PATH, "", PAGE_SIZE);

    assertTrue(expected.size() > 2 * PAGE_SIZE, "fixture must need several pages");
    assertEquals(expected, new HashSet<>(actual));
    assertEquals(expected.size(), actual.size(), "paged union must not repeat rows");
  }

  @Test
  void upstreamTraversalCrossesRenameHopsAndMultiSourceNodes() {
    for (final String start :
        List.of(
            fixture.columnFqn("h5", "g001"),
            fixture.columnFqn("joined", "combined"),
            fixture.columnFqn("cyc", "a"))) {
      final List<String> actual = pagedColumns(start, UPSTREAM_PATH, "", 3);

      assertEquals(fixture.upstreamOf(start), new HashSet<>(actual), start);
      assertEquals(new HashSet<>(actual).size(), actual.size(), start);
    }
  }

  @Test
  void cycleTerminatesAndReachesItself() {
    final String start = fixture.columnFqn("cyc", "a");

    final List<String> actual = pagedColumns(start, DOWNSTREAM_PATH, "", PAGE_SIZE);

    assertEquals(Set.of(fixture.columnFqn("cyc2", "b"), start), new HashSet<>(actual));
  }

  @Test
  void pagesAreOrderedAndStableAcrossPageSizes() {
    final List<String> full = pagedColumns(sourceColumn, DOWNSTREAM_PATH, "", PAGE_SIZE);

    assertEquals(full, pagedColumns(sourceColumn, DOWNSTREAM_PATH, "", 97));
    assertEquals(full.stream().sorted().toList(), full);
  }

  @Test
  void typeFilterDropsTheDataModelHopAndKeepsNestedColumnsOnTheirTable() {
    final Set<String> tableColumns = fixture.onlyTableColumns(fixture.downstreamOf(sourceColumn));

    final List<String> actual =
        pagedColumns(sourceColumn, DOWNSTREAM_PATH, "?asset a om:Table .", PAGE_SIZE);

    assertEquals(tableColumns, new HashSet<>(actual));
    assertFalse(actual.contains(fixture.columnFqn("dm", "metric")));
    assertTrue(actual.contains(fixture.nestedColumn()));
  }

  @Test
  void assetColumnJoinResolvesEveryReachableColumnToItsOwningAsset() {
    final Set<String> reachable = fixture.downstreamOf(sourceColumn);
    final Map<String, String> assetByColumn = new TreeMap<>();

    pagedRows(sourceColumn, DOWNSTREAM_PATH, "", PAGE_SIZE)
        .forEach(row -> assetByColumn.put(row.column(), row.asset()));

    assertEquals(reachable, assetByColumn.keySet());
    reachable.forEach(fqn -> assertEquals(fixture.assetIriOf(fqn), assetByColumn.get(fqn), fqn));
  }

  @Test
  void fullDownstreamWalkStaysFarInsideTheGuardTimeout() {
    final long started = System.nanoTime();
    final List<String> rows = pagedColumns(sourceColumn, DOWNSTREAM_PATH, "", PAGE_SIZE);
    final long totalMillis = (System.nanoTime() - started) / 1_000_000;

    System.out.printf(
        "[column-lineage-timing] downstream of %s: %d rows in %d ms over %d columnLineage nodes%n",
        sourceColumn, rows.size(), totalMillis, fixture.columnLineageNodes());
    assertTrue(totalMillis < SparqlQueryLimits.TIMEOUT_MILLIS, "took " + totalMillis + " ms");
  }

  /**
   * The sparql_query tool description tells clients to narrow the asset join with these patterns,
   * so each one is pinned against what the production translator writes for an asset.
   */
  @Test
  void assetFilterPatternsAdvertisedToClientsMatchTheProjection() {
    final Table orders = projectedOrdersTable();
    graph.add(new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE).toRdf(orders));
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
    return table.withColumns(
        List.of(
            new Column()
                .withName("id")
                .withFullyQualifiedName(table.getFullyQualifiedName() + ".id")
                .withDataType(ColumnDataType.STRING)));
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
