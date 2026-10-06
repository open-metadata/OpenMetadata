/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.StringWriter;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.ColumnLineageFixture;
import org.openmetadata.service.rdf.SparqlQueryLimits;

/**
 * The RDF knowledge-graph MCP tools for callers who are not administrators.
 *
 * <p>Covers who may call which tool, and the use case behind the change: fetching every downstream
 * (or upstream) column of one column on a graph of thousands of column-lineage mappings by paging
 * {@code sparql_query}. The paged query is the template published in the tool description, read
 * back from {@code tools/list}, so the description and the behavior cannot drift apart.
 *
 * <p>The scale data is written in exactly the shape {@code RdfIndexApp} projects (see {@link
 * ColumnLineageFixture}) into a dedicated named graph, which reads see through the union default
 * graph, as production entity writes do. A final test builds the same shape through the real
 * lineage API and a real reindex to show the synthetic data matches real output; it runs last
 * because a reindex clears the shared dataset.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class RdfMcpKnowledgeGraphIT extends McpTestBase {
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final int INSERT_BATCH_CHARS = 60_000;
  private static final int PAGE_SIZE = 250;
  private static final String FORBIDDEN_STATUS = "403";
  private static final String APP_NAME = "RdfIndexApp";
  private static final Pattern COLUMN_LINEAGE_TEMPLATE =
      Pattern.compile("SELECT DISTINCT \\?column.*?LIMIT 250 OFFSET 0");
  private static final String TEMPLATE_START_COLUMN = "svc.db.schema.table.col";
  private static final String DOWNSTREAM_PATH = "^om:fromColumn/om:toColumn";
  private static final String UPSTREAM_PATH = "^om:toColumn/om:fromColumn";

  /** {@code executeMcpRequest} is an instance method of the base class; helpers here are static. */
  private static final McpTestBase MCP_CLIENT = new McpTestBase() {};

  private static RdfAccessFixtures access;
  private static ColumnLineageFixture fixture;
  private static String fixtureGraph;
  private static String queryTemplate;
  private static String adminToken;
  private static String grantedToken;
  private static String ungrantedToken;
  private static String wildcardToken;
  private static String grantedAndDeniedToken;
  private static String grantedBotToken;
  private static String ungrantedBotToken;

  @BeforeAll
  static void setUp() throws Exception {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Requires the RDF integration-test profile");
    initAuth();
    access = new RdfAccessFixtures("rdfmcp");
    access.markProjectionReady();
    createCallers();
    fixtureGraph = "urn:rdf-mcp-it:" + access.suffix() + ":graph";
    fixture =
        ColumnLineageFixture.build(
            BASE_URI, "kgit" + access.suffix() + "_snowflake_prod.analytics.public.");
    loadFixture();
    queryTemplate = readPublishedTemplate();
  }

  @AfterAll
  static void tearDown() throws Exception {
    if (fixtureGraph != null) {
      adminUpdate("DELETE WHERE { GRAPH <" + fixtureGraph + "> { ?s ?p ?o } }");
    }
    if (access != null) {
      access.close();
    }
  }

  @Test
  void anAdministratorMayCallEveryKnowledgeGraphTool() throws Exception {
    assertSparqlToolsAllowed(adminToken);
    assertThat(call(adminToken, "shacl_validate", shaclScope()).error()).isFalse();
  }

  @Test
  void aUserWithTheExplicitGrantMayCallTheGraphReadingTools() throws Exception {
    assertSparqlToolsAllowed(grantedToken);
  }

  @Test
  void aUserWithoutTheGrantIsForbiddenFromGraphReadingTools() throws Exception {
    access.withoutDefaultSparqlGrant(() -> assertSparqlToolsForbidden(ungrantedToken));
  }

  @Test
  void aWildcardAllPolicyDoesNotGrantTheTools() throws Exception {
    access.withoutDefaultSparqlGrant(() -> assertSparqlToolsForbidden(wildcardToken));
  }

  @Test
  void aGrantPlusADenyIsForbidden() throws Exception {
    assertSparqlToolsForbidden(grantedAndDeniedToken);
  }

  @Test
  void aBotWithTheGrantOnItsOwnPoliciesIsAllowed() throws Exception {
    assertSparqlToolsAllowed(grantedBotToken);
  }

  @Test
  void aBotWithoutTheGrantIsForbidden() throws Exception {
    access.withoutDefaultSparqlGrant(() -> assertSparqlToolsForbidden(ungrantedBotToken));
  }

  @Test
  void validationStaysAdminOnlyEvenForAGrantedUser() throws Exception {
    final ToolOutcome outcome = call(grantedToken, "shacl_validate", shaclScope());

    assertThat(outcome.error()).isTrue();
    assertThat(outcome.statusCode()).isEqualTo(403);
  }

  @Test
  void theWholeOntologyNeedsNoGrant() throws Exception {
    access.withoutDefaultSparqlGrant(
        () -> {
          final ToolOutcome outcome =
              call(ungrantedToken, "ontology_describe", Map.of("maxBytes", 2048));

          assertThat(outcome.error()).isFalse();
          assertThat(outcome.payload().path("scope").asText()).isEqualTo("full-ontology");
        });
  }

  @Test
  void aGrantedUserPagesThroughEveryDownstreamColumnOfOneColumn() throws Exception {
    final Set<String> expected = fixture.downstreamOf(fixture.sourceColumn());

    final Paged paged = page(grantedToken, fixture.sourceColumn(), DOWNSTREAM_PATH, "", PAGE_SIZE);

    assertThat(expected.size()).as("fixture must need several pages").isGreaterThan(2 * PAGE_SIZE);
    assertThat(paged.columns()).hasSize(expected.size());
    assertThat(new HashSet<>(paged.columns())).isEqualTo(expected);
    paged.logTimings("downstream", fixture.columnLineageNodes());
  }

  @Test
  void aGrantedUserPagesThroughEveryUpstreamColumn() throws Exception {
    final String start = fixture.columnFqn("h5", "g001");

    final Paged paged = page(grantedToken, start, UPSTREAM_PATH, "", 2);

    assertThat(new HashSet<>(paged.columns())).isEqualTo(fixture.upstreamOf(start));
    assertThat(paged.columns()).doesNotHaveDuplicates();
  }

  @Test
  void theAssetTypeFilterDropsTheDashboardDataModelHop() throws Exception {
    final Set<String> tableColumns =
        fixture.onlyTableColumns(fixture.downstreamOf(fixture.sourceColumn()));

    final Paged paged =
        page(grantedToken, fixture.sourceColumn(), DOWNSTREAM_PATH, "?asset a om:Table", PAGE_SIZE);

    assertThat(new HashSet<>(paged.columns())).isEqualTo(tableColumns);
    assertThat(paged.columns()).doesNotContain(fixture.columnFqn("dm", "metric"));
    assertThat(paged.columns()).contains(fixture.nestedColumn());
  }

  @Test
  void anOversizedPageIsFlaggedTruncatedAndALowerLimitRecovers() throws Exception {
    final ToolOutcome oversized =
        call(
            grantedToken,
            "sparql_query",
            Map.of("query", pageQuery(fixture.sourceColumn(), DOWNSTREAM_PATH, "", 3_000, 0)));

    assertThat(oversized.error()).isFalse();
    assertThat(oversized.payload().path("truncated").asBoolean()).isTrue();
    assertThat(oversized.payload().path("completeness").path("status").asText())
        .isEqualTo("COMPLETE");

    final ToolOutcome smaller =
        call(
            grantedToken,
            "sparql_query",
            Map.of("query", pageQuery(fixture.sourceColumn(), DOWNSTREAM_PATH, "", 100, 0)));
    assertThat(smaller.payload().path("truncated").asBoolean()).isFalse();
  }

  @Test
  void aServerCappedSelectReportsTruncatedCompleteness() throws Exception {
    final ToolOutcome outcome =
        call(
            grantedToken,
            "sparql_query",
            Map.of(
                "query",
                "SELECT ?c WHERE { ?c <" + BASE_URI + "ontology/fullyQualifiedName> ?fqn }"));

    assertThat(outcome.error()).isFalse();
    assertThat(outcome.payload().path("completeness").path("status").asText())
        .isEqualTo("TRUNCATED");
    assertThat(outcome.payload().path("completeness").path("reason").asText())
        .isEqualTo("SERVER_ROW_LIMIT");
  }

  @Test
  void queryFormsOutsideTheNonAdminProfileAreRejectedWithTheirCode() throws Exception {
    final Map<String, String> expectedFragmentByQuery =
        Map.of(
            "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1", "QUERY_FORM_NOT_ALLOWED",
            "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } } LIMIT 1", "GRAPH_SELECTION_NOT_ALLOWED",
            "SELECT * WHERE { SERVICE <https://x.example/sparql> { ?s ?p ?o } }",
                "FEDERATION_NOT_ALLOWED");

    for (final Map.Entry<String, String> rejected : expectedFragmentByQuery.entrySet()) {
      final ToolOutcome outcome =
          call(grantedToken, "sparql_query", Map.of("query", rejected.getKey()));

      assertThat(outcome.error()).as(rejected.getKey()).isTrue();
      assertThat(outcome.payload().path("error").asText()).contains(rejected.getValue());
    }
  }

  @Test
  void inferenceIsRefusedForANonAdministrator() throws Exception {
    final ToolOutcome outcome =
        call(
            grantedToken,
            "sparql_query",
            Map.of("query", "SELECT ?s WHERE { ?s ?p ?o } LIMIT 1", "inferenceLevel", "rdfs"));

    assertThat(outcome.error()).isTrue();
    assertThat(outcome.statusCode()).isEqualTo(400);
    assertThat(outcome.payload().path("error").asText())
        .contains("'inferenceLevel' must be 'none'");
  }

  @Test
  void anAdministratorKeepsConstructAndGraphQueries() throws Exception {
    final ToolOutcome construct =
        call(
            adminToken,
            "sparql_query",
            Map.of(
                "query", "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1", "format", "turtle"));
    final ToolOutcome graph =
        call(
            adminToken,
            "sparql_query",
            Map.of(
                "query", "SELECT * WHERE { GRAPH <" + fixtureGraph + "> { ?s ?p ?o } } LIMIT 1"));

    assertThat(construct.error()).isFalse();
    assertThat(construct.payload().path("queryType").asText()).isEqualTo("CONSTRUCT");
    assertThat(graph.error()).isFalse();
    assertThat(graph.payload().path("completeness").isMissingNode()).isTrue();
  }

  /**
   * A real lineage edge with column mappings, projected by a real reindex, is found by the same
   * published query. Last, because the reindex clears the shared dataset and the synthetic scale
   * graph with it.
   */
  @Test
  @Order(Integer.MAX_VALUE)
  void columnLineageProjectedByARealReindexIsFoundByThePublishedQuery(TestNamespace namespace)
      throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger is not compatible with K8s pipelines");
    final OpenMetadataClient client = SdkClients.adminClient();
    final DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);
    final Table source = createTable(namespace, schema, "kgSource");
    final Table target = createTable(namespace, schema, "kgTarget", nestedColumn());
    final String sourceColumn = source.getColumns().getFirst().getFullyQualifiedName();
    final String targetColumn = target.getColumns().getFirst().getFullyQualifiedName();
    addColumnLineage(client, source, target, sourceColumn, targetColumn);

    triggerReindexAndWait(client.getHttpClient());
    access.markProjectionReady();

    final Paged paged = page(grantedToken, sourceColumn, DOWNSTREAM_PATH, "", PAGE_SIZE);
    assertThat(paged.columns()).containsExactly(targetColumn);
    assertThat(paged.assets()).containsExactly(BASE_URI + "entity/table/" + target.getId());
    assertThat(childColumnsProjectedFor(target.getFullyQualifiedName() + ".payload"))
        .containsExactly(target.getFullyQualifiedName() + ".payload.kind");
  }

  /** Reads the child columns the live projection holds for one parent column, through MCP. */
  private static List<String> childColumnsProjectedFor(final String parentColumnFqn)
      throws Exception {
    final String query =
        "PREFIX om: <"
            + BASE_URI
            + "ontology/> SELECT ?childFqn WHERE { "
            + "?parent om:fullyQualifiedName \""
            + parentColumnFqn
            + "\" . "
            + "?parent om:hasChildColumn ?child . ?child om:fullyQualifiedName ?childFqn } ORDER BY ?childFqn";
    final ToolOutcome outcome = call(grantedToken, "sparql_query", Map.of("query", query));
    assertThat(outcome.error()).as(outcome.payload().toString()).isFalse();
    final List<String> children = new ArrayList<>();
    OBJECT_MAPPER
        .readTree(outcome.payload().path("body").asText())
        .path("results")
        .path("bindings")
        .forEach(row -> children.add(row.path("childFqn").path("value").asText()));
    return children;
  }

  private static void assertSparqlToolsAllowed(final String token) throws Exception {
    for (final ToolCall toolCall : sparqlToolCalls()) {
      final ToolOutcome outcome = call(token, toolCall.tool(), toolCall.arguments());

      assertThat(outcome.error()).as("%s: %s", toolCall.tool(), outcome.payload()).isFalse();
    }
  }

  private static void assertSparqlToolsForbidden(final String token) throws Exception {
    for (final ToolCall toolCall : sparqlToolCalls()) {
      final ToolOutcome outcome = call(token, toolCall.tool(), toolCall.arguments());

      assertThat(outcome.error()).as("%s: %s", toolCall.tool(), outcome.payload()).isTrue();
      assertThat(outcome.statusCode())
          .as("%s: %s", toolCall.tool(), outcome.payload())
          .isEqualTo(Integer.parseInt(FORBIDDEN_STATUS));
    }
  }

  private static List<ToolCall> sparqlToolCalls() {
    final String assetIri = fixture.assetIriOf(fixture.sourceColumn());
    final String assetId = assetIri.substring(assetIri.lastIndexOf('/') + 1);
    return List.of(
        new ToolCall("sparql_query", Map.of("query", "SELECT ?s WHERE { ?s ?p ?o } LIMIT 1")),
        new ToolCall(
            "entity_neighborhood",
            Map.of("entityId", assetId, "entityType", "table", "depth", 1, "limit", 5)),
        new ToolCall("ontology_describe", Map.of("resource", assetIri, "maxBytes", 2048)));
  }

  private static Map<String, Object> shaclScope() {
    final String assetIri = fixture.assetIriOf(fixture.sourceColumn());
    return Map.of("entityUri", assetIri, "maxBytes", 2048);
  }

  private static ToolOutcome call(
      final String bearerToken, final String tool, final Map<String, Object> arguments)
      throws Exception {
    final JsonNode response =
        MCP_CLIENT.executeMcpRequest(
            McpTestUtils.createToolCallRequest(tool, arguments), bearerToken);
    final JsonNode result = response.path("result");
    return new ToolOutcome(result.path("isError").asBoolean(false), payloadOf(result));
  }

  private static JsonNode payloadOf(final JsonNode result) throws Exception {
    final String text = result.path("content").path(0).path("text").asText("");
    return text.isBlank() ? result.path("structuredContent") : OBJECT_MAPPER.readTree(text);
  }

  private static Paged page(
      final String bearerToken,
      final String startColumn,
      final String path,
      final String filter,
      final int pageSize)
      throws Exception {
    final Paged paged = new Paged();
    int offset = 0;
    int rows;
    do {
      final long started = System.nanoTime();
      final ToolOutcome outcome =
          call(
              bearerToken,
              "sparql_query",
              Map.of("query", pageQuery(startColumn, path, filter, pageSize, offset)));
      final long millis = (System.nanoTime() - started) / 1_000_000;
      rows = paged.add(outcome, millis);
      offset += pageSize;
    } while (rows == pageSize);
    return paged;
  }

  /** The published template with the start column, direction, filter and page substituted in. */
  private static String pageQuery(
      final String startColumn,
      final String path,
      final String filter,
      final int limit,
      final int offset) {
    final String filtered =
        filter.isEmpty()
            ? queryTemplate
            : queryTemplate.replace(" } ORDER BY", " . " + filter + " } ORDER BY");
    return "PREFIX om: <"
        + BASE_URI
        + "ontology/> "
        + filtered
            .replace(TEMPLATE_START_COLUMN, startColumn)
            .replace(DOWNSTREAM_PATH, path)
            .replace("LIMIT 250 OFFSET 0", "LIMIT " + limit + " OFFSET " + offset);
  }

  /** Reads the description a client sees, so the test exercises exactly what it advertises. */
  private static String readPublishedTemplate() throws Exception {
    final JsonNode list =
        MCP_CLIENT.executeMcpRequest(
            McpTestUtils.createJsonRpcRequest("tools/list", Map.of()), grantedToken);
    for (final JsonNode tool : list.path("result").path("tools")) {
      if ("sparql_query".equals(tool.path("name").asText())) {
        final Matcher matcher = COLUMN_LINEAGE_TEMPLATE.matcher(tool.path("description").asText());
        assertTrue(matcher.find(), "sparql_query must publish the column lineage template");
        return matcher.group();
      }
    }
    throw new AssertionError("sparql_query is not offered to a granted non-admin");
  }

  private static void createCallers() {
    final var grant = access.allowRole(MetadataOperation.EXECUTE_SPARQL_QUERY, Entity.RDF);
    final var wildcard = access.allowRole(MetadataOperation.ALL, "All");
    final var deny = access.denyRole(MetadataOperation.EXECUTE_SPARQL_QUERY, Entity.RDF);
    adminToken = authToken;
    grantedToken = "Bearer " + access.userToken("granted", List.of(grant.getId()));
    ungrantedToken = "Bearer " + access.userToken("plain", List.of());
    wildcardToken = "Bearer " + access.userToken("wildcard", List.of(wildcard.getId()));
    grantedAndDeniedToken =
        "Bearer " + access.userToken("denied", List.of(grant.getId(), deny.getId()));
    grantedBotToken = "Bearer " + access.botToken("grantedbot", List.of(grant.getId()));
    ungrantedBotToken = "Bearer " + access.botToken("plainbot", List.of());
  }

  /** Batched by size so each update stays under the 100,000-character query ceiling. */
  private static void loadFixture() throws Exception {
    final StringWriter ntriples = new StringWriter();
    RDFDataMgr.write(ntriples, fixture.model(), Lang.NTRIPLES);
    assertFalse(ntriples.toString().contains("_:"), "INSERT DATA cannot carry blank nodes");
    final StringBuilder batch = new StringBuilder();
    for (final String triple : ntriples.toString().split("\n")) {
      if (batch.length() + triple.length() > INSERT_BATCH_CHARS) {
        insert(batch);
      }
      batch.append(triple).append('\n');
    }
    insert(batch);
  }

  private static void insert(final StringBuilder batch) throws Exception {
    if (!batch.isEmpty()) {
      adminUpdate("INSERT DATA { GRAPH <" + fixtureGraph + "> { " + batch + "} }");
      batch.setLength(0);
    }
  }

  private static void adminUpdate(final String sparql) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/rdf/sparql/update", Map.of("query", sparql), Void.class);
  }

  private static Table createTable(
      final TestNamespace namespace, final DatabaseSchema schema, final String name) {
    return createTable(namespace, schema, name, null);
  }

  private static Table createTable(
      final TestNamespace namespace,
      final DatabaseSchema schema,
      final String name,
      final Column extraColumn) {
    final List<Column> columns = new ArrayList<>();
    columns.add(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build());
    if (extraColumn != null) {
      columns.add(extraColumn);
    }
    return Tables.create(
        new CreateTable()
            .withName(namespace.prefix(name))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("RDF MCP knowledge graph integration fixture")
            .withColumns(columns));
  }

  /** A struct column with one child, to see whether a real reindex projects {@code om:hasChildColumn}. */
  private static Column nestedColumn() {
    return new Column()
        .withName("payload")
        .withDataType(ColumnDataType.STRUCT)
        .withChildren(List.of(new Column().withName("kind").withDataType(ColumnDataType.STRING)));
  }

  private static void addColumnLineage(
      final OpenMetadataClient client,
      final Table source,
      final Table target,
      final String sourceColumn,
      final String targetColumn) {
    final ColumnLineage mapping =
        new ColumnLineage().withFromColumns(List.of(sourceColumn)).withToColumn(targetColumn);
    final EntitiesEdge edge =
        new EntitiesEdge()
            .withFromEntity(source.getEntityReference())
            .withToEntity(target.getEntityReference())
            .withLineageDetails(new LineageDetails().withColumnsLineage(List.of(mapping)));
    assertThat(client.lineage().addLineage(new AddLineage().withEdge(edge))).isNotNull();
  }

  private static void triggerReindexAndWait(final HttpClient httpClient) {
    final Long previousStart = latestRunStart(httpClient);
    final Map<String, Object> config = new HashMap<>();
    config.put("entities", List.of("all"));
    config.put("recreateIndex", true);
    config.put("batchSize", 100);
    config.put("producerThreads", 2);
    Awaitility.await("Trigger " + APP_NAME)
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptionsMatching(
            error -> error.getMessage() != null && error.getMessage().contains("already running"))
        .until(
            () -> {
              httpClient.execute(
                  HttpMethod.POST, "/v1/apps/trigger/" + APP_NAME, config, Void.class);
              return true;
            });
    Awaitility.await("RDF reindex completion")
        .atMost(Duration.ofMinutes(10))
        .pollDelay(Duration.ofSeconds(2))
        .pollInterval(Duration.ofSeconds(5))
        .ignoreExceptions()
        .until(() -> isNewSuccessfulRun(httpClient, previousStart));
  }

  private static boolean isNewSuccessfulRun(final HttpClient httpClient, final Long previousStart) {
    final AppRunRecord run =
        httpClient.execute(
            HttpMethod.GET, "/v1/apps/name/" + APP_NAME + "/runs/latest", null, AppRunRecord.class);
    final boolean isNew = previousStart == null || run.getStartTime() > previousStart;
    final String status = run.getStatus().value();
    if (isNew && ("failed".equalsIgnoreCase(status) || "activeError".equalsIgnoreCase(status))) {
      throw new AssertionError("RDF reindex failed: " + run);
    }
    return isNew && ("completed".equalsIgnoreCase(status) || "success".equalsIgnoreCase(status));
  }

  private static Long latestRunStart(final HttpClient httpClient) {
    try {
      final AppRunRecord latest =
          httpClient.execute(
              HttpMethod.GET,
              "/v1/apps/name/" + APP_NAME + "/runs/latest",
              null,
              AppRunRecord.class);
      return latest == null ? null : latest.getStartTime();
    } catch (RuntimeException noRunYet) {
      return null;
    }
  }

  private record ToolCall(String tool, Map<String, Object> arguments) {}

  private record ToolOutcome(boolean error, JsonNode payload) {
    int statusCode() {
      return payload.path("statusCode").asInt(0);
    }
  }

  /** The rows of every page, with what each page cost, for the timing the docs quote. */
  private static final class Paged {
    private final List<String> columns = new ArrayList<>();
    private final List<String> assets = new ArrayList<>();
    private final List<String> timings = new ArrayList<>();

    int add(final ToolOutcome outcome, final long millis) throws Exception {
      assertThat(outcome.error()).as("page %d: %s", timings.size(), outcome.payload()).isFalse();
      assertThat(outcome.payload().path("truncated").asBoolean())
          .as(
              "page %d was cut by the body budget at %d bytes",
              timings.size(), outcome.payload().path("byteCount").asInt())
          .isFalse();
      assertThat(outcome.payload().path("completeness").path("status").asText())
          .isEqualTo("COMPLETE");
      assertThat(millis).isLessThan(SparqlQueryLimits.TIMEOUT_MILLIS);
      final JsonNode bindings =
          OBJECT_MAPPER
              .readTree(outcome.payload().path("body").asText())
              .path("results")
              .path("bindings");
      bindings.forEach(
          row -> {
            columns.add(row.path("column").path("value").asText());
            assets.add(row.path("asset").path("value").asText());
          });
      timings.add(
          "%d ms / %d bytes".formatted(millis, outcome.payload().path("byteCount").asInt()));
      return bindings.size();
    }

    List<String> columns() {
      return columns;
    }

    List<String> assets() {
      return assets;
    }

    void logTimings(final String direction, final int lineageNodes) {
      System.out.printf(
          "[rdf-mcp-it-timing] %s over %d column-lineage nodes: %d rows in %d pages: %s%n",
          direction, lineageNodes, columns.size(), timings.size(), timings);
    }
  }
}
