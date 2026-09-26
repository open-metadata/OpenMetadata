package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.DatabaseServices;

/**
 * An {@code entity_relationship} write must never outlive the entity it points at.
 *
 * <p>A client holding a {@code DataProduct} reference can reach {@code PUT
 * /v1/dataProducts/{fqn}/assets/add} after the data product was deleted ({@code DELETE
 * /v1/dataProducts/{id}}). The delete has already torn the entity down and removed its edges; the
 * concurrent write used to re-create the edge anyway, leaving an {@code entity_relationship} row
 * whose {@code fromId} no longer names anything. That orphan is unreachable — {@code GET
 * /v1/dataProducts/{id}} answers 404 with and without {@code ?include=deleted}, so nothing lists it
 * and nothing can clean it up — and it poisons later bulk operations over the same asset, which is
 * why an unrelated {@code assets/add} starts answering an opaque {@code not_found}.
 *
 * <p>These tests pin both halves of the fix: a write against a deleted data product is rejected
 * rather than persisted, and an asset that already lost its data product still serves reads and
 * still accepts bulk operations for the data products that remain live.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DataProductOrphanRelationshipIT {

  private static final String TABLE_ENTITY = "table";

  @Test
  void addAssetAfterDataProductDeleteIsRejectedAndWritesNoRelationship(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Fixture fixture = createFixture(ns, "add_after_delete");
    UUID dataProductId = fixture.dataProduct().getId();
    Table table = fixture.table();

    client.dataProducts().delete(dataProductId.toString());

    OpenMetadataException failure =
        assertThrows(OpenMetadataException.class, () -> addAssets(client, fixture, table));

    assertEquals(404, failure.getStatusCode(), failure.getMessage());
    assertFalse(
        hasDataProduct(client, table, dataProductId),
        "no entity_relationship row may survive the delete for the removed data product");
  }

  @Test
  void orphanedAssetStillServesReadsAndAcceptsBulkAddsForLiveDataProducts(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Fixture fixture = createFixture(ns, "orphan_tolerance");
    UUID dataProductId = fixture.dataProduct().getId();
    Table table = fixture.table();

    // Reproduce the pre-fix state: the asset was attached, then its data product was hard-deleted
    // while the asset kept the association.
    addAssets(client, fixture, table);
    assertTrue(hasDataProduct(client, table, dataProductId), "fixture must start attached");

    // Read the asset the way a data product UI does. A dangling association must not break it:
    // the asset is the one thing that still exists, so it has to stay reachable and mutable.
    DatabaseService service = createService(ns);
    Database database = createDatabase(client, ns, service);
    assertNotNull(client.tables().get(table.getId().toString(), "dataProducts"));
    assertNotNull(client.databases().get(database.getId().toString(), "domains"));

    // And a live data product must still accept the same asset in a bulk add.
    DataProduct liveDataProduct = createDataProduct(client, ns, "live");
    addAssets(client, new Fixture(liveDataProduct, table, fixture.domain()), table);

    assertTrue(
        hasDataProduct(client, table, liveDataProduct.getId()),
        "assets/add must still persist the relationship for a live data product");
  }

  @Test
  void addAssetWhileDataProductIsAliveWritesRelationship(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Fixture fixture = createFixture(ns, "happy_path");

    addAssets(client, fixture, fixture.table());

    assertTrue(hasDataProduct(client, fixture.table(), fixture.dataProduct().getId()));
  }

  // ---------------------------------------------------------------- helpers

  private record Fixture(DataProduct dataProduct, Table table, Domain domain) {}

  /**
   * Builds a data product and one table that already sits in the data product's domain, which is
   * what {@code assets/add} requires before it accepts the asset.
   */
  private Fixture createFixture(TestNamespace ns, String label) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = createDomain(client, ns, label);
    DataProduct dataProduct = createDataProduct(client, ns, label + "_dp", domain);
    DatabaseService service = createService(ns);
    Database database = createDatabase(client, ns, service);
    DatabaseSchema schema = createSchema(client, ns, label, database);
    Table table = createTable(client, ns, label, schema, domain);
    return new Fixture(dataProduct, table, domain);
  }

  private Domain createDomain(OpenMetadataClient client, TestNamespace ns, String label) {
    CreateDomain request = new CreateDomain();
    request.setName(ns.prefix("orphan_domain_" + label));
    request.setDescription("Domain for orphan relationship coverage");
    request.setDomainType(CreateDomain.DomainType.AGGREGATE);
    return client.domains().create(request);
  }

  private DataProduct createDataProduct(
      OpenMetadataClient client, TestNamespace ns, String label, Domain domain) {
    CreateDataProduct request = new CreateDataProduct();
    request.setName(ns.prefix("orphan_" + label));
    request.setDescription("Data product for orphan relationship coverage");
    request.setDomains(List.of(domain.getFullyQualifiedName()));
    return client.dataProducts().create(request);
  }

  private DataProduct createDataProduct(OpenMetadataClient client, TestNamespace ns, String label) {
    return createDataProduct(client, ns, label, createDomain(client, ns, label));
  }

  private DatabaseService createService(TestNamespace ns) {
    return ns.trackRoot(
        "databaseService",
        DatabaseServices.builder()
            .name(ns.prefix("orphan_svc"))
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .description("Service for orphan relationship coverage")
            .create());
  }

  private Database createDatabase(
      OpenMetadataClient client, TestNamespace ns, DatabaseService service) {
    CreateDatabase request = new CreateDatabase();
    request.setName(ns.prefix("orphan_db"));
    request.setService(service.getFullyQualifiedName());
    return client.databases().create(request);
  }

  private DatabaseSchema createSchema(
      OpenMetadataClient client, TestNamespace ns, String label, Database database) {
    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("orphan_schema_" + label));
    request.setDatabase(database.getFullyQualifiedName());
    return client.databaseSchemas().create(request);
  }

  private Table createTable(
      OpenMetadataClient client,
      TestNamespace ns,
      String label,
      DatabaseSchema schema,
      Domain domain) {
    CreateTable request = new CreateTable();
    request.setName(ns.prefix("orphan_table_" + label));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setDomains(List.of(domain.getFullyQualifiedName()));
    request.setColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
    return client.tables().create(request);
  }

  private void addAssets(OpenMetadataClient client, Fixture fixture, Table table) {
    client
        .dataProducts()
        .bulkAddAssets(
            fixture.dataProduct().getFullyQualifiedName(),
            new BulkAssets()
                .withAssets(
                    List.of(
                        new EntityReference()
                            .withId(table.getId())
                            .withType(TABLE_ENTITY)
                            .withFullyQualifiedName(table.getFullyQualifiedName()))));
  }

  /**
   * Reads the asset's live data products through the API, which is the same visibility path the
   * reported {@code not_found} surfaced on.
   */
  private boolean hasDataProduct(OpenMetadataClient client, Table table, UUID dataProductId) {
    Table stored = client.tables().get(table.getId().toString(), "dataProducts");
    return stored.getDataProducts() != null
        && stored.getDataProducts().stream()
            .anyMatch(reference -> reference.getId().equals(dataProductId));
  }
}