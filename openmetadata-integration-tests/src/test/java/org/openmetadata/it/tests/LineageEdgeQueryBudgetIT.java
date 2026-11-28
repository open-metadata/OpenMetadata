package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import java.time.Duration;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Predicate;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Real statement counts for the lineage edge endpoints. The dbt sink reads and then writes one edge
 * per model, so a statement repeated within one request is paid once per model on every run.
 */
@Isolated("Temporarily decorates the application's SQL logger")
@ExtendWith(TestNamespaceExtension.class)
class LineageEdgeQueryBudgetIT {

  private static final Logger LOG = LoggerFactory.getLogger(LineageEdgeQueryBudgetIT.class);
  private static final String LINEAGE_PATH = "/v1/lineage";
  private static final String STORED_EDGE_READ =
      "from entity_relationship where fromid = :fromid and toid = :toid and relation = :relation";
  private static final String TABLE_REFERENCE_BY_NAME = "from table_entity where fqnhash in (";
  private static final String TABLE_ROW_BY_NAME = "from table_entity where fqnhash = :name";
  private static final String TAGS_BY_PREFIX =
      "where tu.targetfqnhash_lower like lower(:targetfqnhash)";
  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();
  private static final String DESCRIPTION_PATCH =
      "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"budget\"}]";

  /**
   * Each named end is resolved by one query. An admin is never evaluated against an end, so the end
   * is resolved as a reference. Every other caller loads the end's row by name for its policies,
   * from the database rather than the entity cache, and that copy also answers the name.
   */
  enum Caller {
    INGESTION_BOT(0, 1),
    ADMIN(1, 0);

    private final int referenceQueriesPerNamedEnd;
    private final int rowReadsPerNamedEnd;

    Caller(int referenceQueriesPerNamedEnd, int rowReadsPerNamedEnd) {
      this.referenceQueriesPerNamedEnd = referenceQueriesPerNamedEnd;
      this.rowReadsPerNamedEnd = rowReadsPerNamedEnd;
    }

    OpenMetadataClient client() {
      return this == ADMIN ? SdkClients.adminClient() : SdkClients.ingestionBotClient();
    }
  }

  private record EdgeTables(Table from, Table to) {}

  private record Budget(
      int storedEdgeReads,
      int fromReferences,
      int toReferences,
      int fromRowReads,
      int toRowReads,
      int columnTagReads,
      int statements) {}

  @ParameterizedTest
  @EnumSource(Caller.class)
  void getById_readsTheStoredEdgeOnce(Caller caller, TestNamespace ns) {
    EdgeTables edge = createEdge(ns, caller);

    Budget budget =
        steadyState(
            "GET by id",
            caller,
            edge,
            client -> assertEdgeBody(send(client, HttpMethod.GET, edgeReadByIdPath(edge), null)));

    assertEquals(1, budget.storedEdgeReads());
  }

  @ParameterizedTest
  @EnumSource(Caller.class)
  void getByName_resolvesEachEndOnceAndReadsTheEdgeOnce(Caller caller, TestNamespace ns) {
    EdgeTables edge = createEdge(ns, caller);

    Budget budget =
        steadyState(
            "GET by name",
            caller,
            edge,
            client -> assertEdgeBody(send(client, HttpMethod.GET, edgeReadByNamePath(edge), null)));

    assertNamedEndsResolvedOnce(caller, budget);
    assertEquals(1, budget.storedEdgeReads());
  }

  @ParameterizedTest
  @EnumSource(Caller.class)
  void putById_readsTheStoredEdgeOnce(Caller caller, TestNamespace ns) {
    EdgeTables edge = createEdge(ns, caller);
    AddLineage rewrite = addLineage(edge, new LineageDetails().withSqlQuery("select 1"));

    Budget budget =
        steadyState(
            "PUT by id",
            caller,
            edge,
            client -> send(client, HttpMethod.PUT, LINEAGE_PATH, rewrite));

    assertEquals(1, budget.storedEdgeReads());
  }

  @ParameterizedTest
  @EnumSource(Caller.class)
  void putByName_resolvesEachEndOnceAndReadsTheEdgeOnce(Caller caller, TestNamespace ns) {
    EdgeTables edge = createEdge(ns, caller);
    LineageDetails rewrite = new LineageDetails().withSqlQuery("select 1");

    Budget budget =
        steadyState(
            "PUT by name",
            caller,
            edge,
            client -> send(client, HttpMethod.PUT, LINEAGE_PATH + byNamePath(edge), rewrite));

    assertNamedEndsResolvedOnce(caller, budget);
    assertEquals(1, budget.storedEdgeReads());
  }

  @ParameterizedTest
  @EnumSource(Caller.class)
  void patchByName_resolvesEachEndOnce(Caller caller, TestNamespace ns) {
    EdgeTables edge = createEdge(ns, caller);

    Budget budget =
        steadyState(
            "PATCH by name",
            caller,
            edge,
            client -> patch(client, LINEAGE_PATH + byNamePath(edge), DESCRIPTION_PATCH));

    assertNamedEndsResolvedOnce(caller, budget);
    assertEquals(1, budget.storedEdgeReads());
  }

  @ParameterizedTest
  @EnumSource(Caller.class)
  void deleteByName_resolvesEachEndOnce(Caller caller, TestNamespace ns) {
    EdgeTables edge = createEdge(ns, caller);

    Budget budget =
        measure(
            "DELETE by name",
            caller,
            edge,
            client -> send(client, HttpMethod.DELETE, LINEAGE_PATH + byNamePath(edge), null));

    assertNamedEndsResolvedOnce(caller, budget);
    assertEquals(1, budget.storedEdgeReads());
  }

  @ParameterizedTest
  @EnumSource(Caller.class)
  void deleteBySourceByName_resolvesTheEndOnce(Caller caller, TestNamespace ns) {
    EdgeTables edge = createEdge(ns, caller);
    String path =
        LINEAGE_PATH
            + "/source/name/table/"
            + encodeURIComponent(edge.to().getFullyQualifiedName())
            + "/type/"
            + LineageDetails.Source.MANUAL.value();

    Budget budget =
        measure(
            "DELETE by source by name",
            caller,
            edge,
            client -> send(client, HttpMethod.DELETE, path, null));

    assertEquals(caller.referenceQueriesPerNamedEnd, budget.toReferences(), budget.toString());
    assertEquals(caller.rowReadsPerNamedEnd, budget.toRowReads(), budget.toString());
  }

  /**
   * Column lineage checks each column against the ends' child names. Reading those names must not
   * load the columns' tags, which a column write never uses.
   */
  @ParameterizedTest
  @EnumSource(Caller.class)
  void columnLineageWrite_readsNoColumnTags(Caller caller, TestNamespace ns) {
    EdgeTables edge = createEdge(ns, caller);
    AddLineage columnWrite = addLineage(edge, columnLineage(edge, "id", "id"));
    String columnPatch =
        """
        [{"op":"add","path":"/columnsLineage/0/toColumn","value":"%s"}]
        """
            .formatted(edge.to().getFullyQualifiedName() + ".name");
    String patchPath =
        LINEAGE_PATH + "/table/" + edge.from().getId() + "/table/" + edge.to().getId();

    Budget put =
        steadyState(
            "PUT by id, column lineage",
            caller,
            edge,
            client -> send(client, HttpMethod.PUT, LINEAGE_PATH, columnWrite));
    Budget patch =
        steadyState(
            "PATCH by id, column lineage",
            caller,
            edge,
            client -> patch(client, patchPath, columnPatch));

    assertEquals(0, put.columnTagReads());
    assertEquals(0, patch.columnTagReads());
  }

  private static void assertNamedEndsResolvedOnce(Caller caller, Budget budget) {
    assertEquals(caller.referenceQueriesPerNamedEnd, budget.fromReferences(), budget.toString());
    assertEquals(caller.referenceQueriesPerNamedEnd, budget.toReferences(), budget.toString());
    assertEquals(caller.rowReadsPerNamedEnd, budget.fromRowReads(), budget.toString());
    assertEquals(caller.rowReadsPerNamedEnd, budget.toRowReads(), budget.toString());
  }

  private static void assertEdgeBody(String response) {
    assertTrue(JsonUtils.readTree(response).has("edge"), response);
  }

  /** Sends the request once to settle the caches, then counts a second, identical one. */
  private static Budget steadyState(
      String endpoint, Caller caller, EdgeTables edge, Consumer<OpenMetadataClient> request) {
    request.accept(caller.client());
    return measure(endpoint, caller, edge, request);
  }

  private static Budget measure(
      String endpoint, Caller caller, EdgeTables edge, Consumer<OpenMetadataClient> request) {
    OpenMetadataClient client = caller.client();
    String fromHash = FullyQualifiedName.buildHash(edge.from().getFullyQualifiedName());
    String toHash = FullyQualifiedName.buildHash(edge.to().getFullyQualifiedName());
    Budget budget;
    try (SqlQueryCounter statements = SqlQueryCounter.forRequests(Entity.getJdbi(), "");
        SqlQueryCounter edgeReads =
            SqlQueryCounter.forRequests(
                Entity.getJdbi(), STORED_EDGE_READ, bound(edge.from().getId().toString()));
        SqlQueryCounter fromReferences =
            SqlQueryCounter.forRequests(
                Entity.getJdbi(), TABLE_REFERENCE_BY_NAME, bound(fromHash));
        SqlQueryCounter toReferences =
            SqlQueryCounter.forRequests(Entity.getJdbi(), TABLE_REFERENCE_BY_NAME, bound(toHash));
        SqlQueryCounter fromRows =
            SqlQueryCounter.forRequests(Entity.getJdbi(), TABLE_ROW_BY_NAME, bound(fromHash));
        SqlQueryCounter toRows =
            SqlQueryCounter.forRequests(Entity.getJdbi(), TABLE_ROW_BY_NAME, bound(toHash));
        SqlQueryCounter columnTags =
            SqlQueryCounter.forRequests(
                Entity.getJdbi(), TAGS_BY_PREFIX, bound(fromHash).or(bound(toHash)))) {
      request.accept(client);
      budget =
          new Budget(
              edgeReads.count(),
              fromReferences.count(),
              toReferences.count(),
              fromRows.count(),
              toRows.count(),
              columnTags.count(),
              statements.count());
    }
    LOG.info("Lineage edge statement budget: {} as {}: {}", endpoint, caller, budget);
    return budget;
  }

  private static Predicate<StatementContext> bound(String value) {
    return context -> context.getBinding().toString().contains(value);
  }

  private static String send(
      OpenMetadataClient client, HttpMethod method, String path, Object body) {
    return client.getHttpClient().executeForString(method, path, body);
  }

  private static void patch(OpenMetadataClient client, String path, String jsonPatch) {
    client
        .getHttpClient()
        .executeForString(HttpMethod.PATCH, path, JsonUtils.readTree(jsonPatch), JSON_PATCH);
  }

  private static EdgeTables createEdge(TestNamespace ns, Caller caller) {
    String schemaFqn = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    EdgeTables edge =
        new EdgeTables(
            TableTestFactory.createWithName(ns, schemaFqn, "budget_src_" + caller),
            TableTestFactory.createWithName(ns, schemaFqn, "budget_tgt_" + caller));
    AddLineage initial =
        addLineage(edge, new LineageDetails().withSource(LineageDetails.Source.MANUAL));
    Awaitility.await("lineage edge between freshly created tables")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              SdkClients.adminClient().lineage().addLineage(initial);
              return true;
            });
    return edge;
  }

  private static AddLineage addLineage(EdgeTables edge, LineageDetails details) {
    return new AddLineage()
        .withEdge(
            new EntitiesEdge()
                .withFromEntity(edge.from().getEntityReference())
                .withToEntity(edge.to().getEntityReference())
                .withLineageDetails(details.withSource(LineageDetails.Source.MANUAL)));
  }

  private static LineageDetails columnLineage(EdgeTables edge, String fromColumn, String toColumn) {
    return new LineageDetails()
        .withColumnsLineage(
            List.of(
                new ColumnLineage()
                    .withFromColumns(
                        List.of(edge.from().getFullyQualifiedName() + "." + fromColumn))
                    .withToColumn(edge.to().getFullyQualifiedName() + "." + toColumn)));
  }

  private static String edgeReadByIdPath(EdgeTables edge) {
    return LINEAGE_PATH + "/getLineageEdge/" + edge.from().getId() + "/" + edge.to().getId();
  }

  private static String edgeReadByNamePath(EdgeTables edge) {
    return LINEAGE_PATH + "/getLineageEdge" + byNamePath(edge);
  }

  private static String byNamePath(EdgeTables edge) {
    return "/table/name/"
        + encodeURIComponent(edge.from().getFullyQualifiedName())
        + "/table/name/"
        + encodeURIComponent(edge.to().getFullyQualifiedName());
  }
}
