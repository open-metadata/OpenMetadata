package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.it.tests.DomainLineageSteps.MAPPER;
import static org.openmetadata.it.tests.DomainLineageSteps.assertEdgeAbsent;
import static org.openmetadata.it.tests.DomainLineageSteps.assertSucceeded;
import static org.openmetadata.it.tests.DomainLineageSteps.assetEdges;
import static org.openmetadata.it.tests.DomainLineageSteps.awaitPlatformLineage;
import static org.openmetadata.it.tests.DomainLineageSteps.client;
import static org.openmetadata.it.tests.DomainLineageSteps.dataProduct;
import static org.openmetadata.it.tests.DomainLineageSteps.deleteEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.domain;
import static org.openmetadata.it.tests.DomainLineageSteps.edge;
import static org.openmetadata.it.tests.DomainLineageSteps.putEdge;
import static org.openmetadata.it.tests.DomainLineageSteps.setDomains;
import static org.openmetadata.it.tests.DomainLineageSteps.setTableDomains;
import static org.openmetadata.it.tests.DomainLineageSteps.table;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.api.BulkAssets;

/**
 * Assets inherit their domains from their service, database, schema or other container, so a
 * container's domain change moves the domain lineage of every asset that inherits it (#33961).
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class DomainLineageInheritanceIT {

  private static final String DATABASE_CSV_HEADER =
      "name*,displayName,description,owner,tags,glossaryTerms,tiers,certification,"
          + "retentionPeriod,sourceUrl,domains,extension";

  /** The issue's reproduction, step by step, through the API. */
  @Test
  void servicesGivenDomainsAfterTheirTablesLineageCountEveryEdge(TestNamespace ns) {
    DatabaseService serviceA = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseService serviceB = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schemaA = DatabaseSchemaTestFactory.createSimple(ns, serviceA);
    DatabaseSchema schemaB = DatabaseSchemaTestFactory.createSimple(ns, serviceB);
    Table t1 = table(ns, schemaA, "t1");
    Table t3 = table(ns, schemaA, "t3");
    Table t5 = table(ns, schemaA, "t5");
    Table t2 = table(ns, schemaB, "t2");
    Table t4 = table(ns, schemaB, "t4");
    putEdge(t1, t2);
    putEdge(t3, t2);
    putEdge(t5, t4);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");

    setDomains(client().databaseServices(), serviceA.getId(), d1);
    setDomains(client().databaseServices(), serviceB.getId(), d2);

    LineageDetails domainEdge = edge(d1, d2);
    assertEquals(3, domainEdge.getAssetEdges());
    assertEquals(LineageDetails.Source.CHILD_ASSETS, domainEdge.getSource());
    awaitPlatformLineage(d1, d2, true);
    putEdge(t1, t2);
    putEdge(t3, t2);
    putEdge(t5, t4);
    assertEquals(3, assetEdges(d1, d2), "re-sending an edge does not count it again");
    deleteEdge(t5, t4);
    assertEquals(2, assetEdges(d1, d2), "the other two edges still connect the domains");
    deleteEdge(t1, t2);
    assertEquals(1, assetEdges(d1, d2));
    deleteEdge(t3, t2);
    assertEdgeAbsent(d1, d2);
  }

  @Test
  void databaseAndSchemaDomainsReachTheirTables(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database databaseA = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    Database databaseB =
        DatabaseTestFactory.createWithName(service.getFullyQualifiedName(), ns.prefix("db_b"));
    Table a1 =
        table(ns, DatabaseSchemaTestFactory.create(ns, databaseA.getFullyQualifiedName()), "a1");
    DatabaseSchema schemaB =
        DatabaseSchemaTestFactory.create(ns, databaseB.getFullyQualifiedName());
    Table b1 = table(ns, schemaB, "b1");
    putEdge(a1, b1);
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");

    setDomains(client().databases(), databaseA.getId(), d1);
    setDomains(client().databaseSchemas(), schemaB.getId(), d2);

    assertEquals(1, assetEdges(d1, d2));
  }

  @Test
  void movingAServiceToAnotherDomainMovesItsTablesEdges(TestNamespace ns) {
    DomainPair services = DomainPair.create(ns);
    Domain d3 = domain(ns, "d3");

    setDomains(client().databaseServices(), services.serviceA().getId(), d3);

    assertEdgeAbsent(services.d1(), services.d2());
    assertEquals(1, assetEdges(d3, services.d2()));
  }

  @Test
  void removingTheServiceDomainReleasesTheDomainEdge(TestNamespace ns) {
    DomainPair services = DomainPair.create(ns);
    awaitPlatformLineage(services.d1(), services.d2(), true);

    setDomains(client().databaseServices(), services.serviceA().getId());

    assertEdgeAbsent(services.d1(), services.d2());
    awaitPlatformLineage(services.d1(), services.d2(), false);
  }

  /** Only the tables that inherit the service's domain move: own domains, and a schema's, stay. */
  @Test
  void tablesWithTheirOwnOrTheirSchemasDomainStayWhenTheServiceMoves(TestNamespace ns) {
    DatabaseService serviceA = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, serviceA.getFullyQualifiedName());
    DatabaseSchema ownSchema =
        DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    DatabaseSchema plainSchema =
        DatabaseSchemaTestFactory.create(database.getFullyQualifiedName(), ns.prefix("plain"));
    Table underOwnSchema = table(ns, ownSchema, "under_own_schema");
    Table ownTable = table(ns, plainSchema, "own_table");
    Table inheriting = table(ns, plainSchema, "inheriting");
    Table target = table(ns, DatabaseSchemaTestFactory.createSimple(ns), "target");
    Domain ds = domain(ns, "ds");
    Domain dt = domain(ns, "dt");
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    setDomains(client().databaseSchemas(), ownSchema.getId(), ds);
    setTableDomains(ownTable, dt);
    setTableDomains(target, d2);
    putEdge(underOwnSchema, target);
    putEdge(ownTable, target);
    putEdge(inheriting, target);

    setDomains(client().databaseServices(), serviceA.getId(), d1);

    assertEquals(1, assetEdges(d1, d2));
    assertEquals(1, assetEdges(ds, d2));
    assertEquals(1, assetEdges(dt, d2));
  }

  /** A nested container inherits from its service, not from the container it sits in. */
  @Test
  void nestedContainersMoveWithTheirStorageService(TestNamespace ns) {
    StorageService storage = StorageServiceTestFactory.createS3(ns);
    Container parent = container(ns, storage, "parent", null);
    Container nested = container(ns, storage, "nested", parent);
    Table target = table(ns, DatabaseSchemaTestFactory.createSimple(ns), "target");
    Domain dp = domain(ns, "dp");
    Domain dc = domain(ns, "dc");
    Domain d2 = domain(ns, "d2");
    setDomains(client().containers(), parent.getId(), dp);
    setTableDomains(target, d2);
    putEdge(nested, target);

    setDomains(client().storageServices(), storage.getId(), dc);

    assertEquals(1, assetEdges(dc, d2));
    assertEdgeAbsent(dp, d2);
  }

  @Test
  void aDatabaseImportGivingASchemaItsDomainCountsItsTables(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    Table source = table(ns, schema, "source");
    Table target = table(ns, DatabaseSchemaTestFactory.createSimple(ns), "target");
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    setTableDomains(target, d2);
    putEdge(source, target);
    String csv =
        String.join(
            "\n",
            DATABASE_CSV_HEADER,
            schema.getName() + ",,,,,,,,,," + d1.getFullyQualifiedName() + ",");

    String result =
        client().databases().importCsv(database.getFullyQualifiedName(), csv, false, false);

    assertEquals(0, MAPPER.readTree(result).path("numberOfRowsFailed").asInt(), result);
    assertEquals(1, assetEdges(d1, d2));
  }

  @Test
  void aDataProductMovingItsSchemaMovesTheSchemasTables(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table source = table(ns, schema, "source");
    Table target = table(ns, DatabaseSchemaTestFactory.createSimple(ns), "target");
    Domain d1 = domain(ns, "d1");
    Domain d2 = domain(ns, "d2");
    Domain d3 = domain(ns, "d3");
    setDomains(client().databaseSchemas(), schema.getId(), d1);
    setTableDomains(target, d2);
    putEdge(source, target);
    assertEquals(1, assetEdges(d1, d2));
    DataProduct product = dataProduct(ns, d1);
    assertSucceeded(
        client()
            .dataProducts()
            .bulkAddAssets(
                product.getFullyQualifiedName(),
                new BulkAssets().withAssets(List.of(schema.getEntityReference()))));

    setDomains(client().dataProducts(), product.getId(), d3);

    assertEquals(1, assetEdges(d3, d2));
    assertEdgeAbsent(d1, d2);
  }

  private static Container container(
      TestNamespace ns, StorageService storage, String name, Container parent) {
    return client()
        .containers()
        .create(
            new CreateContainer()
                .withName(ns.prefix(name))
                .withService(storage.getFullyQualifiedName())
                .withParent(parent == null ? null : parent.getEntityReference()));
  }

  /** t1 in service A (D1) feeds t2 in service B (D2), with the domains set before the edge. */
  private record DomainPair(DatabaseService serviceA, Domain d1, Domain d2) {

    static DomainPair create(TestNamespace ns) {
      DatabaseService serviceA = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseService serviceB = DatabaseServiceTestFactory.createPostgres(ns);
      Domain d1 = domain(ns, "d1");
      Domain d2 = domain(ns, "d2");
      setDomains(client().databaseServices(), serviceA.getId(), d1);
      setDomains(client().databaseServices(), serviceB.getId(), d2);
      putEdge(
          table(ns, DatabaseSchemaTestFactory.createSimple(ns, serviceA), "t1"),
          table(ns, DatabaseSchemaTestFactory.createSimple(ns, serviceB), "t2"));
      assertEquals(1, assetEdges(d1, d2));
      return new DomainPair(serviceA, d1, d2);
    }
  }
}
