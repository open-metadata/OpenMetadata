package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.DomainLineageSteps.MAPPER;
import static org.openmetadata.it.tests.DomainLineageSteps.assertEdgeAbsent;
import static org.openmetadata.it.tests.DomainLineageSteps.assetEdges;
import static org.openmetadata.it.tests.DomainLineageSteps.client;
import static org.openmetadata.it.tests.DomainLineageSteps.deleteEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.domain;
import static org.openmetadata.it.tests.DomainLineageSteps.edge;
import static org.openmetadata.it.tests.DomainLineageSteps.newSchema;
import static org.openmetadata.it.tests.DomainLineageSteps.patchAdd;
import static org.openmetadata.it.tests.DomainLineageSteps.putEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.setDomains;
import static org.openmetadata.it.tests.DomainLineageSteps.setTableDomains;
import static org.openmetadata.it.tests.DomainLineageSteps.table;
import static org.openmetadata.it.tests.DomainLineageSteps.tableRequest;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * A domain lineage edge counts, in {@code assetEdges}, the asset edges between the two domains'
 * assets. Domains are usually assigned after lineage is ingested, so these assign them afterwards
 * and check the count on every way an asset's domains are written (#33961).
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class DomainLineageRefcountIT {

  private static final String SCHEMA_CSV_HEADER =
      "name*,displayName,description,owner,tags,glossaryTerms,tiers,certification,"
          + "retentionPeriod,sourceUrl,domains,extension";

  @Test
  void domainsGivenAfterLineageCountEveryAssetEdge(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    Table t3 = table(ns, schema, "t3");
    putEdge(t1, t2);
    putEdge(t3, t2);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");

    setTableDomains(t1, d1);
    setTableDomains(t3, d1);
    setTableDomains(t2, d2);

    assertEquals(2, assetEdges(d1, d2));
    assertEquals(LineageDetails.Source.CHILD_ASSETS, edge(d1, d2).getSource());
    awaitPlatformLineage(d1, d2, true);
  }

  @Test
  void deletingOneAssetEdgeKeepsTheDomainEdge(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    Table t3 = table(ns, schema, "t3");
    putEdge(t1, t2);
    putEdge(t3, t2);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    setTableDomains(t1, d1);
    setTableDomains(t3, d1);
    setTableDomains(t2, d2);

    deleteEdge(t1, t2);
    assertEquals(1, assetEdges(d1, d2));

    deleteEdge(t3, t2);
    assertEdgeAbsent(d1, d2);
  }

  @Test
  void anInheritedNeighbourDomainIsCounted(TestNamespace ns) {
    Table t1 = table(ns, newSchema(ns), "t1");
    DatabaseService serviceB = DatabaseServiceTestFactory.createPostgres(ns);
    Table t2 = table(ns, DatabaseSchemaTestFactory.createSimple(ns, serviceB), "t2");
    putEdge(t1, t2);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    setDomains(client().databaseServices(), serviceB.getId(), d2);

    setTableDomains(t1, d1);

    assertEquals(1, assetEdges(d1, d2));
  }

  @Test
  void movingAnAssetMovesItsContribution(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    Domain d3 = domain(ns, "d3");
    setTableDomains(t1, d1);
    setTableDomains(t2, d2);
    putEdge(t1, t2);
    assertEquals(1, assetEdges(d1, d2));

    setTableDomains(t1, d3);

    assertEdgeAbsent(d1, d2);
    assertEquals(1, assetEdges(d3, d2));
  }

  @Test
  void removingTheDomainReleasesTheDomainEdge(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    putEdge(t1, t2);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    setTableDomains(t1, d1);
    setTableDomains(t2, d2);
    assertEquals(1, assetEdges(d1, d2));
    awaitPlatformLineage(d1, d2, true);

    setTableDomains(t1);

    assertEdgeAbsent(d1, d2);
    awaitPlatformLineage(d1, d2, false);
  }

  @Test
  void sameDomainOnBothEndsMakesNoSelfEdge(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    Table t3 = table(ns, schema, "t3");
    putEdge(t1, t2);
    putEdge(t1, t3);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");

    setTableDomains(t2, d1);
    setTableDomains(t3, d2);
    setTableDomains(t1, d1);

    assertEdgeAbsent(d1, d1);
    assertEquals(1, assetEdges(d1, d2));
  }

  @Test
  void reassigningTheSameDomainChangesNothing(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    putEdge(t1, t2);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    setTableDomains(t2, d2);
    setTableDomains(t1, d1);
    assertEquals(1, assetEdges(d1, d2));

    setTableDomains(t1, d1);
    client()
        .tables()
        .createOrUpdate(
            tableRequest(schema, t1.getName()).withDomains(List.of(d1.getFullyQualifiedName())));

    assertEquals(1, assetEdges(d1, d2));
  }

  @Test
  void aSessionEditCountsTheDomainMoveOnce(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    putEdge(t1, t2);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    setTableDomains(t2, d2);
    Table described = client().tables().patch(t1.getId(), replace("/description", "edited"));

    Table moved = setTableDomains(t1, d1);

    assertEquals(
        described.getVersion(),
        moved.getVersion(),
        "the second edit in the session must consolidate into the first one's version");
    assertEquals(1, assetEdges(d1, d2));
  }

  @Test
  void edgesAddedAfterTheDomainsCountTheSame(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    Table t3 = table(ns, schema, "t3");
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    setTableDomains(t1, d1);
    setTableDomains(t3, d1);
    setTableDomains(t2, d2);

    putEdge(t1, t2);
    putEdge(t3, t2);

    assertEquals(2, assetEdges(d1, d2));
  }

  /** Both ends of the edge move in one batch, so each must see the other's move, not the DB. */
  @Test
  void csvImportMovingBothEndsMovesTheirEdgeOnce(TestNamespace ns) throws Exception {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    Domain d3 = domain(ns, "d3");
    Domain d4 = domain(ns, "d4");
    setTableDomains(t1, d1);
    setTableDomains(t2, d2);
    putEdge(t1, t2);
    assertEquals(1, assetEdges(d1, d2));
    String csv = String.join("\n", SCHEMA_CSV_HEADER, csvRow(t1, d3), csvRow(t2, d4));

    String result =
        client().databaseSchemas().importCsv(schema.getFullyQualifiedName(), csv, false, false);

    assertEquals(0, MAPPER.readTree(result).path("numberOfRowsFailed").asInt(), result);
    assertEdgeAbsent(d1, d2);
    assertEquals(1, assetEdges(d3, d4));
  }

  @Test
  void bulkPutMovingBothEndsMovesTheirEdgeOnce(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    Domain d3 = domain(ns, "d3");
    Domain d4 = domain(ns, "d4");
    setTableDomains(t1, d1);
    setTableDomains(t2, d2);
    putEdge(t1, t2);
    assertEquals(1, assetEdges(d1, d2));

    BulkOperationResult result =
        client()
            .tables()
            .bulkCreateOrUpdate(
                List.of(
                    tableRequest(schema, t1.getName())
                        .withDomains(List.of(d3.getFullyQualifiedName())),
                    tableRequest(schema, t2.getName())
                        .withDomains(List.of(d4.getFullyQualifiedName()))));

    assertSucceeded(result);
    assertEdgeAbsent(d1, d2);
    assertEdgeAbsent(d3, d2);
    assertEquals(1, assetEdges(d3, d4));
  }

  @Test
  void addingAssetsToADomainCountsTheirLineage(TestNamespace ns) throws Exception {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    putEdge(t1, t2);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    setTableDomains(t2, d2);

    client()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/domains/" + d1.getFullyQualifiedName() + "/assets/add",
            new BulkAssets().withAssets(List.of(t1.getEntityReference())).withDryRun(false),
            BulkOperationResult.class);

    assertEquals(1, assetEdges(d1, d2));
  }

  @Test
  void movingADataProductMovesItsAssetsDomainEdges(TestNamespace ns) {
    DatabaseSchema schema = newSchema(ns);
    Table t1 = table(ns, schema, "t1");
    Table t2 = table(ns, schema, "t2");
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    Domain d3 = domain(ns, "d3");
    setTableDomains(t1, d1);
    setTableDomains(t2, d2);
    DataProduct product = dataProduct(ns, d1);
    assertSucceeded(
        client()
            .dataProducts()
            .bulkAddAssets(
                product.getFullyQualifiedName(),
                new BulkAssets().withAssets(List.of(t1.getEntityReference()))));
    putEdge(t1, t2);
    assertEquals(1, assetEdges(d1, d2));

    setDomains(client().dataProducts(), product.getId(), d3);

    assertEquals(1, assetEdges(d3, d2));
    assertEdgeAbsent(d1, d2);
  }

  @Test
  void aPortThatInheritedItsDomainMovesWithTheDataProduct(TestNamespace ns) {
    DatabaseService portService = DatabaseServiceTestFactory.createPostgres(ns);
    Table port = table(ns, DatabaseSchemaTestFactory.createSimple(ns, portService), "port");
    Table downstream = table(ns, newSchema(ns), "downstream");
    Domain d1 = domain(ns, "d1");
    Domain d3 = domain(ns, "d3");
    Domain d9 = domain(ns, "d9");
    Domain dy = domain(ns, "dy");
    setDomains(client().databaseServices(), portService.getId(), d9);
    setTableDomains(downstream, dy);
    putEdge(port, downstream);
    assertEquals(1, assetEdges(d9, dy));
    DataProduct product = dataProduct(ns, d1);
    assertSucceeded(
        client()
            .dataProducts()
            .bulkAddInputPorts(
                product.getFullyQualifiedName(),
                new BulkAssets().withAssets(List.of(port.getEntityReference()))));

    setDomains(client().dataProducts(), product.getId(), d3);

    assertEquals(1, assetEdges(d3, dy));
    assertEdgeAbsent(d9, dy);
  }

  @Test
  void aDataProductLeavingEveryDomainLeavesItsAssetsTheirInheritedOne(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Table asset = table(ns, DatabaseSchemaTestFactory.createSimple(ns, service), "asset");
    Table downstream = table(ns, newSchema(ns), "downstream");
    Domain d1 = domain(ns, "d1");
    Domain d9 = domain(ns, "d9");
    Domain dy = domain(ns, "dy");
    setDomains(client().databaseServices(), service.getId(), d9);
    setTableDomains(asset, d1);
    setTableDomains(downstream, dy);
    DataProduct product = dataProduct(ns, d1);
    assertSucceeded(
        client()
            .dataProducts()
            .bulkAddAssets(
                product.getFullyQualifiedName(),
                new BulkAssets().withAssets(List.of(asset.getEntityReference()))));
    putEdge(asset, downstream);
    assertEquals(1, assetEdges(d1, dy));

    setDomains(client().dataProducts(), product.getId());

    assertEdgeAbsent(d1, dy);
    assertEquals(1, assetEdges(d9, dy));
  }

  @Test
  void aContainerAssetIsCountedLikeATable(TestNamespace ns) {
    StorageService storage = StorageServiceTestFactory.createS3(ns);
    Container container =
        client()
            .containers()
            .create(
                new CreateContainer()
                    .withName(ns.prefix("container"))
                    .withService(storage.getFullyQualifiedName()));
    Table table = table(ns, newSchema(ns), "t1");
    putEdge(container, table);
    Domain dc = domain(ns, "dc");
    Domain dt = domain(ns, "dt");

    setDomains(client().containers(), container.getId(), dc);
    setTableDomains(table, dt);

    assertEquals(1, assetEdges(dc, dt));
  }

  private static DataProduct dataProduct(TestNamespace ns, Domain domain) {
    return client()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix("product"))
                .withDescription("Domain lineage refcount")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static String csvRow(Table table, Domain domain) {
    return table.getName() + ",,,,,,,,,," + domain.getFullyQualifiedName() + ",";
  }

  private static JsonNode replace(String path, String value) {
    return patchAdd(path, MAPPER.getNodeFactory().textNode(value));
  }

  private static void assertSucceeded(BulkOperationResult result) {
    assertEquals(ApiStatus.SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
  }

  /** The domain view reads search, where the edge lives on the downstream domain's document. */
  private static void awaitPlatformLineage(Domain from, Domain to, boolean shown) {
    Awaitility.await("domain view shows " + shown)
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(() -> assertEquals(shown, platformLineageShows(from, to)));
  }

  private static boolean platformLineageShows(Domain from, Domain to) throws Exception {
    String filter =
        "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"id.keyword\":\"" + to.getId() + "\"}}]}}}";
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("view", Entity.DOMAIN)
            .queryParam("query_filter", filter)
            .build();
    JsonNode result =
        MAPPER.readTree(
            client()
                .getHttpClient()
                .executeForString(HttpMethod.GET, "/v1/lineage/getPlatformLineage", null, options));
    assertTrue(result.path("nodes").has(to.getFullyQualifiedName()), result.toString());
    boolean shown = false;
    for (JsonNode edge : result.path("upstreamEdges")) {
      shown |=
          from.getId().toString().equals(edge.path("fromEntity").path("id").asText())
              && to.getId().toString().equals(edge.path("toEntity").path("id").asText());
    }
    assertFalse(result.path("upstreamEdges").isMissingNode(), result.toString());
    return shown;
  }
}
