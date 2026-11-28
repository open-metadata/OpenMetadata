package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.UnaryOperator;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * The lineage page filters (Service, Service Type, Database, Schema, Column, Domains, Owner, Tag,
 * Tier, Data Product, Glossary Term) and the Impact Analysis counts, run against the two endpoints
 * the UI calls.
 *
 * <p>The canvas calls {@code /getLineage}, which keeps the root and every node on the path to a
 * match (preserve_paths defaults to true). Impact Analysis calls {@code getLineageByEntityCount},
 * which returns only the matching nodes (preserve_paths defaults to false).
 *
 * <pre>
 *   root (postgres table) ─→ mid (postgres table, column mid_only)
 *                               ├─→ snowLeaf  (snowflake table, column snow_only, with a domain,
 *                               │              owner, data product, glossary term, tag and tier
 *                               │              nothing else has)
 *                               ├─→ pgLeaf    (postgres table)
 *                               └─→ topicLeaf (kafka topic)
 * </pre>
 */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class LineageFilterIT {

  private static final String GET_LINEAGE_PATH = "/v1/lineage/getLineage";
  private static final String ENTITY_COUNT_PATH = "/v1/lineage/getLineageByEntityCount";
  private static final String MID_ONLY_COLUMN = "mid_only";
  private static final String SNOW_ONLY_COLUMN = "snow_only";
  private static final String DOWNSTREAM = "Downstream";
  private static final String UPSTREAM = "Upstream";
  private static final String SNOW_TAG = "PII.Sensitive";
  private static final String SNOW_TIER = "Tier.Tier1";

  private final OpenMetadataClient client = SdkClients.adminClient();
  private Table root;
  private Table mid;
  private Table snowLeaf;
  private Table pgLeaf;
  private Topic topicLeaf;
  private User snowOwner;
  private Domain snowDomain;
  private DataProduct snowProduct;
  private GlossaryTerm snowTerm;

  @BeforeAll
  void setUp() {
    TestNamespace ns = new TestNamespace("LineageFilterIT");
    root = createTable(ns, DatabaseServiceTestFactory.createPostgres(ns), "root", "id");
    mid = createTable(ns, DatabaseServiceTestFactory.createPostgres(ns), "mid", MID_ONLY_COLUMN);
    snowOwner = UserTestFactory.createUser(ns, "lineage_owner");
    snowDomain = createDomain(ns);
    snowProduct = createDataProduct(ns, snowDomain);
    snowTerm = GlossaryTermTestFactory.createSimple(ns, GlossaryTestFactory.createSimple(ns));
    snowLeaf =
        createTable(
            ns,
            DatabaseServiceTestFactory.createSnowflake(ns),
            "snow",
            SNOW_ONLY_COLUMN,
            create ->
                create
                    .withOwners(List.of(snowOwner.getEntityReference()))
                    .withDomains(List.of(snowDomain.getFullyQualifiedName()))
                    .withDataProducts(List.of(snowProduct.getFullyQualifiedName()))
                    .withTags(
                        List.of(
                            glossaryLabel(snowTerm),
                            classificationLabel(SNOW_TAG),
                            classificationLabel(SNOW_TIER))));
    pgLeaf = createTable(ns, DatabaseServiceTestFactory.createPostgres(ns), "pg", "id");
    topicLeaf = TopicTestFactory.createSimple(ns);
    addEdge(root, mid);
    List.of(snowLeaf, pgLeaf, topicLeaf).forEach(leaf -> addEdge(mid, leaf));
    awaitIndexedGraph();
  }

  @Test
  void getLineage_serviceFilter_keepsPathToMatch() {
    String filter = termFilter("service.displayName.keyword", snowLeaf.getService().getName());
    assertEquals(fqns(root, mid, snowLeaf), canvasNodes(filter));
  }

  @Test
  void getLineage_serviceTypeFilter_keepsPathToMatch() {
    assertEquals(fqns(root, mid, snowLeaf), canvasNodes(termFilter("serviceType", "Snowflake")));
    assertEquals(fqns(root, mid, topicLeaf), canvasNodes(termFilter("serviceType", "Kafka")));
  }

  @Test
  void getLineage_hierarchyFilters_matchIntermediateNode() {
    Set<String> expected = fqns(root, mid);
    assertEquals(
        expected,
        canvasNodes(termFilter("database.displayName.keyword", mid.getDatabase().getName())),
        "Database filter");
    assertEquals(
        expected,
        canvasNodes(
            termFilter("databaseSchema.displayName.keyword", mid.getDatabaseSchema().getName())),
        "Schema filter");
    assertEquals(
        expected,
        canvasNodes(termFilter("columns.name.keyword", MID_ONLY_COLUMN)),
        "Column filter");
  }

  @Test
  void getLineage_leafOnlyFilters_keepPathToLeafBehindNonMatchingMid() {
    Set<String> expected = fqns(root, mid, snowLeaf);
    assertAll(
        leafOnlyFilters().entrySet().stream()
            .map(f -> () -> assertEquals(expected, canvasNodes(f.getValue()), f.getKey())));
  }

  @Test
  void impactAnalysis_leafOnlyFilters_returnLeafBehindNonMatchingMid() {
    Set<String> expected = fqns(snowLeaf);
    assertAll(
        leafOnlyFilters().entrySet().stream()
            .map(
                f ->
                    () ->
                        assertEquals(
                            expected, impactAnalysisNodes(root, f.getValue()), f.getKey())));
  }

  @Test
  void impactAnalysis_serviceFilter_returnsOnlyMatches() {
    String filter = termFilter("service.displayName.keyword", snowLeaf.getService().getName());
    assertEquals(fqns(snowLeaf), impactAnalysisNodes(root, filter));
  }

  @Test
  void impactAnalysis_serviceTypeFilter_returnsOnlyMatches() {
    assertEquals(fqns(snowLeaf), impactAnalysisNodes(root, termFilter("serviceType", "Snowflake")));
    assertEquals(fqns(topicLeaf), impactAnalysisNodes(root, termFilter("serviceType", "Kafka")));
  }

  @Test
  void entityCount_totalsForRootMidAndLeafOfMixedTypes() {
    assertEquals(Map.of(1, 1, 2, 3), depthCounts(root, DOWNSTREAM));
    assertEquals(Map.of(1, 3), depthCounts(mid, DOWNSTREAM));
    assertEquals(Map.of(1, 1), depthCounts(mid, UPSTREAM));
    assertEquals(Map.of(1, 1, 2, 1), depthCounts(topicLeaf, UPSTREAM));
    assertEquals(Map.of(), depthCounts(topicLeaf, DOWNSTREAM));
  }

  @Test
  void getLineage_metadataFilters_keepsPathToMatch() {
    Set<String> expected = fqns(root, mid, snowLeaf);
    assertAll(
        metadataFilters().entrySet().stream()
            .map(f -> () -> assertEquals(expected, canvasNodes(f.getValue()), f.getKey())));
  }

  @Test
  void impactAnalysis_metadataFilters_returnOnlyMatches() {
    Set<String> expected = fqns(snowLeaf);
    assertAll(
        metadataFilters().entrySet().stream()
            .map(
                f ->
                    () ->
                        assertEquals(
                            expected, impactAnalysisNodes(root, f.getValue()), f.getKey())));
  }

  /**
   * The lineage page's Domains, Owners, Tag and Tier filters (the "Verify metadata filters" group),
   * each matching snowLeaf and nothing on the path to it, keyed by the UI's filter label.
   */
  private Map<String, String> metadataFilters() {
    return Map.of(
        "Domains filter",
        termFilter("domains.displayName.keyword", snowDomain.getDisplayName()),
        "Owners filter",
        termFilter("ownerDisplayName", displayNameOrName(snowOwner)),
        "Tag filter",
        termFilter("tags.tagFQN", SNOW_TAG),
        "Tier filter",
        termFilter("tier.tagFQN", SNOW_TIER));
  }

  /**
   * The lineage page's Database, Schema, Column, Data Product and Glossary Term filters,
   * each matching snowLeaf and nothing on the path to it, keyed by the UI's filter label.
   */
  private Map<String, String> leafOnlyFilters() {
    return Map.of(
        "Database filter",
        termFilter("database.displayName.keyword", snowLeaf.getDatabase().getName()),
        "Schema filter",
        termFilter("databaseSchema.displayName.keyword", snowLeaf.getDatabaseSchema().getName()),
        "Column filter",
        termFilter("columns.name.keyword", SNOW_ONLY_COLUMN),
        "Data Product filter",
        termFilter("dataProducts.displayName.keyword", snowProduct.getDisplayName()),
        "Glossary Term filter",
        termFilter("glossaryTags", snowTerm.getFullyQualifiedName()));
  }

  private Domain createDomain(TestNamespace ns) {
    return client
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.shortPrefix("lineage_dom"))
                .withDisplayName(ns.shortPrefix("Lineage Domain"))
                .withDomainType(DomainType.AGGREGATE)
                .withDescription("Lineage filter"));
  }

  private DataProduct createDataProduct(TestNamespace ns, Domain domain) {
    return client
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.shortPrefix("lineage_dp"))
                .withDisplayName(ns.shortPrefix("Lineage DP"))
                .withDomains(List.of(domain.getFullyQualifiedName()))
                .withDescription("Lineage filter"));
  }

  /** The index falls back to the owner's name when it has no display name. */
  private static String displayNameOrName(User user) {
    String displayName = user.getDisplayName();
    return displayName == null || displayName.isBlank() ? user.getName() : displayName;
  }

  private static TagLabel glossaryLabel(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static TagLabel classificationLabel(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private Table createTable(TestNamespace ns, DatabaseService service, String name, String column) {
    return createTable(ns, service, name, column, UnaryOperator.identity());
  }

  private Table createTable(
      TestNamespace ns,
      DatabaseService service,
      String name,
      String column,
      UnaryOperator<CreateTable> extra) {
    Database database =
        DatabaseTestFactory.createWithName(
            service.getFullyQualifiedName(), ns.prefix(name + "_db"));
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.create(
            database.getFullyQualifiedName(), ns.prefix(name + "_sch"));
    return client
        .tables()
        .create(
            extra.apply(
                new CreateTable()
                    .withName(ns.prefix(name))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(List.of(ColumnBuilder.of(column, "BIGINT").build()))));
  }

  private void addEdge(EntityInterface<?> from, EntityInterface<?> to) {
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())));
  }

  private void awaitIndexedGraph() {
    Set<String> everyNode = fqns(root, mid, snowLeaf, pgLeaf, topicLeaf);
    Awaitility.await("lineage graph indexed")
        .atMost(Duration.ofSeconds(90))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(() -> everyNode.equals(canvasNodes(null)));
  }

  private Set<String> canvasNodes(String queryFilter) {
    RequestOptions.Builder options =
        RequestOptions.builder()
            .queryParam("fqn", root.getFullyQualifiedName())
            .queryParam("type", "table")
            .queryParam("upstreamDepth", "0")
            .queryParam("downstreamDepth", "2")
            .queryParam("includeDeleted", "false");
    if (queryFilter != null) {
      options.queryParam("query_filter", queryFilter);
    }
    return nodeFqns(get(GET_LINEAGE_PATH, options.build()));
  }

  private Set<String> impactAnalysisNodes(EntityInterface<?> entity, String queryFilter) {
    RequestOptions options =
        entityCountOptions(entity, DOWNSTREAM).queryParam("query_filter", queryFilter).build();
    Set<String> nodes = nodeFqns(get(ENTITY_COUNT_PATH, options));
    nodes.remove(entity.getFullyQualifiedName());
    return nodes;
  }

  private Map<Integer, Integer> depthCounts(EntityInterface<?> entity, String direction) {
    RequestOptions options =
        entityCountOptions(entity, direction).queryParam("include_pagination_info", "true").build();
    String depthInfoField =
        UPSTREAM.equals(direction) ? "upstreamDepthInfo" : "downstreamDepthInfo";
    Map<Integer, Integer> counts = new HashMap<>();
    get(ENTITY_COUNT_PATH, options)
        .path("paginationInfo")
        .path(depthInfoField)
        .forEach(info -> counts.put(info.path("depth").asInt(), info.path("entityCount").asInt()));
    counts.remove(0);
    return counts;
  }

  private RequestOptions.Builder entityCountOptions(EntityInterface<?> entity, String direction) {
    return RequestOptions.builder()
        .queryParam("fqn", entity.getFullyQualifiedName())
        .queryParam("direction", direction)
        .queryParam("nodeDepth", "3")
        .queryParam("maxDepth", "3")
        .queryParam("upstreamDepth", "3")
        .queryParam("downstreamDepth", "3")
        .queryParam("from", "0")
        .queryParam("size", "50");
  }

  private JsonNode get(String path, RequestOptions options) {
    String response = client.getHttpClient().executeForString(HttpMethod.GET, path, null, options);
    return JsonUtils.readTree(response);
  }

  private static Set<String> nodeFqns(JsonNode lineage) {
    Set<String> fqns = new HashSet<>();
    lineage.path("nodes").fieldNames().forEachRemaining(fqns::add);
    return fqns;
  }

  private static Set<String> fqns(EntityInterface<?>... entities) {
    Set<String> fqns = new HashSet<>();
    for (EntityInterface<?> entity : entities) {
      fqns.add(entity.getFullyQualifiedName());
    }
    return fqns;
  }

  private static String termFilter(String field, String value) {
    return String.format(
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"should\":[{\"term\":{\"%s\":\"%s\"}}]}}]}}}",
        field, value);
  }
}
