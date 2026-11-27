package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.utils.v212.DataProductLineageRebuild;

/**
 * Released versions left data product lineage rollups wrong: edges from a product to itself, counts
 * lost on consolidated edits, and rollups CSV imports never followed. The 2.1.2 step recounts them
 * from the asset edges and keeps every edge an admin drew. Isolated, because the full walk rewrites
 * the rollups of every data product in the database.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class DataProductLineageRebuildMigrationIT {

  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();
  private static final String ROLLUP =
      "{\"source\":\"ChildAssets\",\"createdAt\":42,\"assetEdges\":%d}";
  private static final String DRAWN = "{\"source\":\"Manual\",\"description\":\"drawn\"%s}";

  @Test
  void recountsTheRollupsAndKeepsTheDrawnEdges(TestNamespace ns) {
    Domain domain = domain(ns);
    DataProduct a = dataProduct(ns, "a", domain);
    DataProduct b = dataProduct(ns, "b", domain);
    DataProduct c = dataProduct(ns, "c", domain);
    DataProduct d = dataProduct(ns, "d", domain);
    Metric a1 = metric(ns, "a1", domain, a);
    Metric a2 = metric(ns, "a2", domain, a);
    Metric b1 = metric(ns, "b1", domain, b);
    Metric b2 = metric(ns, "b2", domain, b);
    Metric c1 = metric(ns, "c1", domain, c);
    Metric d1 = metric(ns, "d1", domain, d);
    putEdge(a1, b1);
    putEdge(a2, b2);
    putEdge(a1, a2);
    putEdge(a1, c1);
    putEdge(d1, a1);
    store(a, b, String.format(ROLLUP, 5));
    dao()
        .relationshipDAO()
        .delete(a.getId(), Entity.DATA_PRODUCT, c.getId(), Entity.DATA_PRODUCT, UPSTREAM);
    store(a, a, String.format(ROLLUP, 2));
    store(b, c, String.format(ROLLUP, 1));
    store(c, d, String.format(DRAWN, ",\"assetEdges\":3"));
    store(d, a, String.format(DRAWN, ""));
    store(d, d, String.format(DRAWN, ""));
    String drawnSelf = stored(d, d).getJson();
    List<String> ids = Stream.of(a, b, c, d).map(product -> product.getId().toString()).toList();

    assertEquals(6, rebuild(ids));

    LineageDetails recounted = details(a, b);
    assertEquals(2, recounted.getAssetEdges(), "a1 -> b1 and a2 -> b2");
    assertEquals(42L, recounted.getCreatedAt(), "a recounted rollup keeps its creation");
    LineageDetails inserted = details(a, c);
    assertEquals(LineageDetails.Source.CHILD_ASSETS, inserted.getSource());
    assertEquals(1, inserted.getAssetEdges(), "the missing rollup of a1 -> c1 is written");
    assertNull(stored(a, a), "a product feeds itself no edge");
    assertNull(stored(b, c), "no asset edge connects b and c");
    LineageDetails released = details(c, d);
    assertNull(released.getAssetEdges(), "no asset edge connects c and d");
    assertEquals("drawn", released.getDescription(), "an edge an admin drew stays");
    LineageDetails counted = details(d, a);
    assertEquals(1, counted.getAssetEdges(), "d1 -> a1 runs under the drawn edge");
    assertEquals(LineageDetails.Source.MANUAL, counted.getSource());
    assertEquals(drawnSelf, stored(d, d).getJson(), "a self edge an admin drew is kept");
    assertEquals(0, rebuild(ids), "a rebuilt product needs nothing on a second run");
  }

  @Test
  void theStepReachesEveryDataProduct(TestNamespace ns) {
    DataProduct looped = dataProduct(ns, "looped", domain(ns));
    store(looped, looped, String.format(ROLLUP, 1));

    int changed =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    DataProductLineageRebuild.rebuildAll(
                        handle, TestSuiteBootstrap.getConnectionType()));

    assertTrue(changed >= 1, "the seeded self edge is one of the rows changed");
    assertNull(stored(looped, looped));
  }

  private static int rebuild(List<String> dataProductIds) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                DataProductLineageRebuild.rebuild(
                    handle, TestSuiteBootstrap.getConnectionType(), dataProductIds));
  }

  private static Domain domain(TestNamespace ns) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("domain"))
                    .withDescription("Data product lineage rebuild")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)));
  }

  private static DataProduct dataProduct(TestNamespace ns, String name, Domain domain) {
    return SdkClients.adminClient()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix(name))
                .withDescription("Data product lineage rebuild")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static Metric metric(TestNamespace ns, String name, Domain domain, DataProduct product) {
    return ns.trackRoot(
        Entity.METRIC,
        SdkClients.adminClient()
            .metrics()
            .create(
                new CreateMetric()
                    .withName(ns.prefix(name))
                    .withDescription("Data product lineage rebuild")
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withDataProducts(List.of(product.getFullyQualifiedName()))));
  }

  private static void putEdge(EntityInterface<?> from, EntityInterface<?> to) {
    SdkClients.adminClient()
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())
                        .withLineageDetails(new LineageDetails())));
  }

  private static void store(DataProduct from, DataProduct to, String lineageJson) {
    dao()
        .relationshipDAO()
        .insert(
            from.getId(),
            to.getId(),
            Entity.DATA_PRODUCT,
            Entity.DATA_PRODUCT,
            UPSTREAM,
            lineageJson);
  }

  private static CollectionDAO.EntityRelationshipObject stored(DataProduct from, DataProduct to) {
    return dao().relationshipDAO().getRecord(from.getId(), to.getId(), UPSTREAM);
  }

  private static LineageDetails details(DataProduct from, DataProduct to) {
    CollectionDAO.EntityRelationshipObject row = stored(from, to);
    assertNotNull(row, "a stored data product edge is expected");
    return JsonUtils.readValue(row.getJson(), LineageDetails.class);
  }

  private static CollectionDAO dao() {
    return Entity.getCollectionDAO();
  }
}
