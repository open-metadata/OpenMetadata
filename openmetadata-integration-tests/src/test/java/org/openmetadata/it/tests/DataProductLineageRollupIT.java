package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * A data product lineage edge counts, in {@code assetEdges}, the asset edges between the two
 * products' assets. These change an asset's data products after its lineage exists, through each
 * write path that recounts the edge.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class DataProductLineageRollupIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final List<String> METRIC_CSV_HEADER =
      List.of(
          "name*",
          "displayName",
          "description",
          "metricType",
          "unitOfMeasurement",
          "customUnitOfMeasurement",
          "granularity",
          "expressionLanguage",
          "expressionCode",
          "relatedMetrics",
          "tags",
          "glossaryTerms",
          "tiers",
          "owners",
          "reviewers",
          "domains",
          "dataProducts",
          "entityStatus",
          "extension",
          "parent",
          "experts",
          "metricGroup");

  @Test
  void joiningTheNeighboursDataProductMakesNoSelfEdge(TestNamespace ns) {
    Domain domain = domain(ns, "d1");
    DataProduct dp1 = dataProduct(ns, "dp1", domain);
    DataProduct dp2 = dataProduct(ns, "dp2", domain);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table t1 = table(ns, schema, "t1", domain);
    Table t2 = table(ns, schema, "t2", domain, dp1);
    Table t3 = table(ns, schema, "t3", domain, dp2);
    putEdge(t1, t2);
    putEdge(t1, t3);

    client().tables().patch(t1.getId(), set("/dataProducts", refs(dp1)));

    assertEquals(1, assetEdges(dp1, dp2));
    assertEdgeAbsent(dp1, dp1);
  }

  @Test
  void aSessionEditRemovesTheDataProductOnce(TestNamespace ns) {
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    DataProduct dp1 = dataProduct(ns, "dp1", d1);
    DataProduct dp2 = dataProduct(ns, "dp2", d2);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table t1 = table(ns, schema, "t1", d1, dp1);
    Table t2 = table(ns, schema, "t2", d2, dp2);
    Table t3 = table(ns, schema, "t3", d1, dp1);
    Table t4 = table(ns, schema, "t4", d2, dp2);
    putEdge(t1, t2);
    putEdge(t3, t4);
    assertEquals(2, assetEdges(dp1, dp2));
    Table described = client().tables().patch(t1.getId(), set("/description", textNode("edited")));

    Table removed =
        client().tables().patch(t1.getId(), set("/dataProducts", MAPPER.createArrayNode()));

    assertEquals(
        described.getVersion(),
        removed.getVersion(),
        "the second edit in the session must consolidate into the first one's version");
    assertEquals(1, assetEdges(dp1, dp2), "t3 -> t4 still connects the two data products");
  }

  @Test
  void aPutKeepingTheDataProductsLeavesTheirEdgeAsItIs(TestNamespace ns) {
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    DataProduct dp1 = dataProduct(ns, "dp1", d1);
    DataProduct dp2 = dataProduct(ns, "dp2", d2);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table t1 = table(ns, schema, "t1", d1, dp1);
    Table t2 = table(ns, schema, "t2", d2, dp2);
    putEdge(t1, t2);
    LineageDetails before = edge(dp1, dp2);

    client()
        .tables()
        .createOrUpdate(
            tableRequest(schema, t1.getName(), d1, dp1).withDescription("edited by a PUT"));

    LineageDetails after = edge(dp1, dp2);
    assertEquals(1, after.getAssetEdges());
    assertEquals(
        before.getCreatedAt(),
        after.getCreatedAt(),
        "the PUT kept t1's data products, so their edge is not deleted and written again");
  }

  /** Both ends move in one batch, so the old pair must be released and the new one counted. */
  @Test
  void csvImportMovingBothEndsMovesTheirDataProductEdge(TestNamespace ns) throws Exception {
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    DataProduct dp1 = dataProduct(ns, "dp1", d1);
    DataProduct dp2 = dataProduct(ns, "dp2", d2);
    DataProduct dp3 = dataProduct(ns, "dp3", d1);
    DataProduct dp4 = dataProduct(ns, "dp4", d2);
    Metric m1 = metric(ns, "m1", d1, dp1);
    Metric m2 = metric(ns, "m2", d2, dp2);
    putEdge(m1, m2);
    assertEquals(1, assetEdges(dp1, dp2));

    importMetrics(metricRow(m1, d1, dp3), metricRow(m2, d2, dp4));

    assertEdgeAbsent(dp1, dp2);
    assertEquals(1, assetEdges(dp3, dp4));
  }

  /** Moving both ends adds cross pairs no asset edge connects; an edge drawn on one stays. */
  @Test
  void csvImportKeepsAnEdgeDrawnBetweenTheProducts(TestNamespace ns) throws Exception {
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    DataProduct dp1 = dataProduct(ns, "dp1", d1);
    DataProduct dp2 = dataProduct(ns, "dp2", d2);
    DataProduct dp3 = dataProduct(ns, "dp3", d1);
    DataProduct dp4 = dataProduct(ns, "dp4", d2);
    Metric m1 = metric(ns, "m1", d1, dp1);
    Metric m2 = metric(ns, "m2", d2, dp2);
    putEdge(m1, m2);
    putEdge(dp1, dp4);
    LineageDetails drawn = edge(dp1, dp4);
    assertNull(drawn.getAssetEdges(), "an edge drawn between products counts no asset edges");

    importMetrics(metricRow(m1, d1, dp3), metricRow(m2, d2, dp4));

    assertEquals(1, assetEdges(dp3, dp4));
    LineageDetails kept = edge(dp1, dp4);
    assertEquals(drawn.getSource(), kept.getSource(), "the drawn edge between the products stays");
    assertEquals(drawn.getCreatedAt(), kept.getCreatedAt());
  }

  /** An import that connects assets under a drawn edge counts them on it and keeps its details. */
  @Test
  void csvImportCountsAssetEdgesOnADrawnEdgeAndKeepsIt(TestNamespace ns) throws Exception {
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    DataProduct dp1 = dataProduct(ns, "dp1", d1);
    DataProduct dp2 = dataProduct(ns, "dp2", d2);
    DataProduct dp4 = dataProduct(ns, "dp4", d2);
    Metric m1 = metric(ns, "m1", d1, dp1);
    Metric m2 = metric(ns, "m2", d2, dp2);
    putEdge(m1, m2);
    putEdge(dp1, dp4, new LineageDetails().withDescription("drawn by an admin"));
    LineageDetails drawn = edge(dp1, dp4);

    importMetrics(metricRow(m2, d2, dp4));

    LineageDetails counted = edge(dp1, dp4);
    assertEquals(1, counted.getAssetEdges(), "m1 -> m2 now connects dp1 and dp4");
    assertEquals(drawn.getSource(), counted.getSource());
    assertEquals(drawn.getDescription(), counted.getDescription());
    assertEquals(drawn.getCreatedAt(), counted.getCreatedAt());

    importMetrics(metricRow(m2, d2, dp2));

    LineageDetails released = edge(dp1, dp4);
    assertNull(released.getAssetEdges(), "no asset edge connects dp1 and dp4 any more");
    assertEquals(drawn.getDescription(), released.getDescription(), "the drawn edge stays");
    assertEquals(1, assetEdges(dp1, dp2));
  }

  private static Domain domain(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DOMAIN,
        client()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(name))
                    .withDescription("Data product lineage")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)));
  }

  private static DataProduct dataProduct(TestNamespace ns, String name, Domain domain) {
    return client()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix(name))
                .withDescription("Data product lineage")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static Table table(
      TestNamespace ns,
      DatabaseSchema schema,
      String name,
      Domain domain,
      DataProduct... products) {
    return client().tables().create(tableRequest(schema, ns.prefix(name), domain, products));
  }

  private static CreateTable tableRequest(
      DatabaseSchema schema, String name, Domain domain, DataProduct... products) {
    return new CreateTable()
        .withName(name)
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new ColumnBuilder("id", "VARCHAR").dataLength(256).build()))
        .withDomains(List.of(domain.getFullyQualifiedName()))
        .withDataProducts(fqns(products));
  }

  private static Metric metric(TestNamespace ns, String name, Domain domain, DataProduct product) {
    return ns.trackRoot(
        Entity.METRIC,
        client()
            .metrics()
            .create(
                new CreateMetric()
                    .withName(ns.prefix(name))
                    .withDescription("Data product lineage")
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withDataProducts(List.of(product.getFullyQualifiedName()))));
  }

  private static void importMetrics(String... rows) throws Exception {
    String csv = String.join("\n", String.join(",", METRIC_CSV_HEADER), String.join("\n", rows));
    String result = client().metrics().importCsv("*", csv, false);
    assertEquals(0, MAPPER.readTree(result).path("numberOfRowsFailed").asInt(), result);
  }

  private static String metricRow(Metric metric, Domain domain, DataProduct product) {
    List<String> row = new ArrayList<>(Collections.nCopies(METRIC_CSV_HEADER.size(), ""));
    row.set(METRIC_CSV_HEADER.indexOf("name*"), metric.getName());
    row.set(METRIC_CSV_HEADER.indexOf("domains"), domain.getFullyQualifiedName());
    row.set(METRIC_CSV_HEADER.indexOf("dataProducts"), product.getFullyQualifiedName());
    return String.join(",", row);
  }

  private static List<String> fqns(DataProduct... products) {
    return List.of(products).stream().map(DataProduct::getFullyQualifiedName).toList();
  }

  private static ArrayNode refs(DataProduct... products) {
    ArrayNode refs = MAPPER.createArrayNode();
    for (DataProduct product : products) {
      refs.addObject().put("id", product.getId().toString()).put("type", Entity.DATA_PRODUCT);
    }
    return refs;
  }

  private static JsonNode textNode(String value) {
    return MAPPER.getNodeFactory().textNode(value);
  }

  private static JsonNode set(String path, JsonNode value) {
    ArrayNode patch = MAPPER.createArrayNode();
    patch.addObject().put("op", "add").put("path", path).set("value", value);
    return patch;
  }

  private static void putEdge(EntityInterface<?> from, EntityInterface<?> to) {
    putEdge(from, to, new LineageDetails());
  }

  private static void putEdge(
      EntityInterface<?> from, EntityInterface<?> to, LineageDetails details) {
    client()
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())
                        .withLineageDetails(details)));
  }

  private static Integer assetEdges(DataProduct from, DataProduct to) {
    return edge(from, to).getAssetEdges();
  }

  private static LineageDetails edge(DataProduct from, DataProduct to) {
    try {
      String response =
          client().getHttpClient().executeForString(HttpMethod.GET, edgePath(from, to), null);
      return JsonUtils.readValue(
          MAPPER.readTree(response).get("edge").toString(), LineageDetails.class);
    } catch (Exception e) {
      throw new AssertionError("No lineage edge between the data products", e);
    }
  }

  private static void assertEdgeAbsent(DataProduct from, DataProduct to) {
    OpenMetadataException notFound =
        assertThrows(
            OpenMetadataException.class,
            () ->
                client()
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, edgePath(from, to), null));
    assertEquals(404, notFound.getStatusCode());
  }

  private static String edgePath(DataProduct from, DataProduct to) {
    return "/v1/lineage/getLineageEdge/" + from.getId() + "/" + to.getId();
  }

  private static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }
}
