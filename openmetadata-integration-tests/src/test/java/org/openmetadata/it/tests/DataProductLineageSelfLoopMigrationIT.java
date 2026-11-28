package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.utils.v212.DataProductLineageSelfLoopRepair;

/**
 * Released versions wrote data product lineage edges from a product to itself. The 2.1.2 step
 * deletes those rollup rows and keeps every other data product edge.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
public class DataProductLineageSelfLoopMigrationIT {

  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();
  private static final String ROLLUP = "{\"source\":\"ChildAssets\",\"assetEdges\":%d}";

  @Test
  void deletesOnlyTheRollupEdgesFromAProductToItself(TestNamespace ns) {
    Domain domain = domain(ns);
    DataProduct looped = dataProduct(ns, "looped", domain);
    DataProduct loopedAgain = dataProduct(ns, "looped_again", domain);
    DataProduct drawn = dataProduct(ns, "drawn", domain);
    seed(looped, looped, String.format(ROLLUP, 2));
    seed(loopedAgain, loopedAgain, String.format(ROLLUP, 1));
    seed(drawn, drawn, "{\"source\":\"Manual\",\"createdBy\":\"admin\"}");
    seed(looped, drawn, String.format(ROLLUP, 1));
    String drawnBefore = storedJson(drawn, drawn);
    String crossBefore = storedJson(looped, drawn);
    List<String> ids =
        Stream.of(looped, loopedAgain, drawn).map(product -> product.getId().toString()).toList();

    assertEquals(2, deleteSelfLoops(ids));

    assertNull(stored(looped, looped));
    assertNull(stored(loopedAgain, loopedAgain));
    assertEquals(drawnBefore, storedJson(drawn, drawn), "an edge an admin drew is kept");
    assertEquals(crossBefore, storedJson(looped, drawn), "an edge between two products is kept");
    assertEquals(0, deleteSelfLoops(ids), "a repaired product needs nothing on a second run");
  }

  @Test
  void theStepReachesEveryDataProduct(TestNamespace ns) {
    DataProduct looped = dataProduct(ns, "looped", domain(ns));
    seed(looped, looped, String.format(ROLLUP, 1));

    int deleted =
        TestSuiteBootstrap.getJdbi().withHandle(DataProductLineageSelfLoopRepair::deleteAll);

    assertTrue(deleted >= 1, "the seeded edge is one of those deleted");
    assertNull(stored(looped, looped));
  }

  private static int deleteSelfLoops(List<String> dataProductIds) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(handle -> DataProductLineageSelfLoopRepair.delete(handle, dataProductIds));
  }

  private static Domain domain(TestNamespace ns) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("domain"))
                    .withDescription("Data product lineage self-loop repair")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)));
  }

  private static DataProduct dataProduct(TestNamespace ns, String name, Domain domain) {
    return SdkClients.adminClient()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix(name))
                .withDescription("Data product lineage self-loop repair")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static void seed(DataProduct from, DataProduct to, String lineageJson) {
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

  private static String storedJson(DataProduct from, DataProduct to) {
    CollectionDAO.EntityRelationshipObject row = stored(from, to);
    assertNotNull(row, "a stored data product edge is expected");
    return row.getJson();
  }

  private static CollectionDAO dao() {
    return Entity.getCollectionDAO();
  }
}
