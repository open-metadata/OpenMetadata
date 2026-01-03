package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
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
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for Data Product domain migration functionality.
 *
 * <p>When a data product's domain is changed, all assets linked to that data product should be
 * automatically migrated to the new domain. This ensures the invariant that a data product can
 * only contain assets from the same domain.
 *
 * <p>These tests verify that:
 * <ul>
 *   <li>Assets are correctly migrated when data product domain changes</li>
 *   <li>Assets appear in the new domain's assets search after migration</li>
 *   <li>Assets no longer appear in the old domain's assets search after migration</li>
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DataProductDomainMigrationIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  // Shared entities for efficient table creation
  private DatabaseService sharedDbService;
  private Database sharedDatabase;
  private DatabaseSchema sharedSchema;

  @Test
  void testDataProductDomainMigrationUpdatesAssetDomains(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.shortPrefix();

    // Step 1: Create two domains - source and target
    Domain sourceDomain = createDomain(client, "source_domain_" + shortId);
    Domain targetDomain = createDomain(client, "target_domain_" + shortId);

    // Step 2: Create a data product in the source domain
    CreateDataProduct createDp = new CreateDataProduct();
    createDp.setName("test_dp_" + shortId);
    createDp.setDescription("Test data product for domain migration");
    createDp.setDomains(List.of(sourceDomain.getFullyQualifiedName()));

    DataProduct dataProduct = client.dataProducts().create(createDp);
    assertNotNull(dataProduct);
    assertEquals(1, dataProduct.getDomains().size());
    assertEquals(
        sourceDomain.getFullyQualifiedName(),
        dataProduct.getDomains().get(0).getFullyQualifiedName());

    // Step 3: Create tables and add them as assets to the data product
    List<Table> tables = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      Table table = createTestTable(ns, "migration_test_table_" + i);
      tables.add(table);
    }

    // Add tables as assets to the data product
    List<EntityReference> assetRefs = new ArrayList<>();
    for (Table table : tables) {
      assetRefs.add(
          new EntityReference()
              .withId(table.getId())
              .withType("table")
              .withFullyQualifiedName(table.getFullyQualifiedName()));
    }
    BulkAssets bulkRequest = new BulkAssets().withAssets(assetRefs);
    BulkOperationResult result =
        client.dataProducts().bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkRequest);
    assertNotNull(result);

    // Wait for search index to update after adding assets
    waitForSearchIndexUpdate();

    // Verify assets are searchable in source domain
    verifyAssetsInDomainSearch(client, sourceDomain.getFullyQualifiedName(), tables, true);

    // Step 4: Change the data product's domain from source to target
    DataProduct dpToUpdate = client.dataProducts().get(dataProduct.getId().toString(), "domains");
    dpToUpdate.setDomains(
        List.of(
            new EntityReference()
                .withId(targetDomain.getId())
                .withType("domain")
                .withFullyQualifiedName(targetDomain.getFullyQualifiedName())));

    DataProduct updatedDp =
        client.dataProducts().update(dataProduct.getId().toString(), dpToUpdate);
    assertNotNull(updatedDp);
    assertEquals(1, updatedDp.getDomains().size());
    assertEquals(
        targetDomain.getFullyQualifiedName(),
        updatedDp.getDomains().get(0).getFullyQualifiedName());

    // Wait for search index to update after domain migration
    waitForSearchIndexUpdate();

    // Step 5: Verify assets now appear in target domain's search
    verifyAssetsInDomainSearch(client, targetDomain.getFullyQualifiedName(), tables, true);

    // Step 6: Verify assets no longer appear in source domain's search
    verifyAssetsInDomainSearch(client, sourceDomain.getFullyQualifiedName(), tables, false);
  }

  @Test
  void testDataProductDomainMigrationWithInputOutputPorts(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.shortPrefix();

    // Create two domains
    Domain sourceDomain = createDomain(client, "port_source_" + shortId);
    Domain targetDomain = createDomain(client, "port_target_" + shortId);

    // Create data product in source domain
    CreateDataProduct createDp = new CreateDataProduct();
    createDp.setName("port_test_dp_" + shortId);
    createDp.setDescription("Test data product with ports");
    createDp.setDomains(List.of(sourceDomain.getFullyQualifiedName()));

    DataProduct dataProduct = client.dataProducts().create(createDp);
    assertNotNull(dataProduct);

    // Create tables for input/output ports
    Table inputTable = createTestTable(ns, "input_port_table");
    Table outputTable = createTestTable(ns, "output_port_table");

    // Add input port
    List<EntityReference> inputPorts =
        List.of(
            new EntityReference()
                .withId(inputTable.getId())
                .withType("table")
                .withFullyQualifiedName(inputTable.getFullyQualifiedName()));
    BulkAssets inputRequest = new BulkAssets().withAssets(inputPorts);
    client.dataProducts().bulkAddInputPorts(dataProduct.getFullyQualifiedName(), inputRequest);

    // Add output port
    List<EntityReference> outputPorts =
        List.of(
            new EntityReference()
                .withId(outputTable.getId())
                .withType("table")
                .withFullyQualifiedName(outputTable.getFullyQualifiedName()));
    BulkAssets outputRequest = new BulkAssets().withAssets(outputPorts);
    client.dataProducts().bulkAddOutputPorts(dataProduct.getFullyQualifiedName(), outputRequest);

    waitForSearchIndexUpdate();

    // Verify ports are in source domain
    verifyAssetsInDomainSearch(
        client, sourceDomain.getFullyQualifiedName(), List.of(inputTable, outputTable), true);

    // Change domain
    DataProduct dpToUpdate =
        client.dataProducts().get(dataProduct.getId().toString(), "domains,inputPorts,outputPorts");
    dpToUpdate.setDomains(
        List.of(
            new EntityReference()
                .withId(targetDomain.getId())
                .withType("domain")
                .withFullyQualifiedName(targetDomain.getFullyQualifiedName())));

    DataProduct updatedDp =
        client.dataProducts().update(dataProduct.getId().toString(), dpToUpdate);
    assertNotNull(updatedDp);

    waitForSearchIndexUpdate();

    // Verify ports are now in target domain
    verifyAssetsInDomainSearch(
        client, targetDomain.getFullyQualifiedName(), List.of(inputTable, outputTable), true);

    // Verify ports are no longer in source domain
    verifyAssetsInDomainSearch(
        client, sourceDomain.getFullyQualifiedName(), List.of(inputTable, outputTable), false);
  }

  @Test
  void testDataProductDomainMigrationToMultipleDomains(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.shortPrefix();

    // Create three domains
    Domain sourceDomain = createDomain(client, "multi_source_" + shortId);
    Domain targetDomain1 = createDomain(client, "multi_target1_" + shortId);
    Domain targetDomain2 = createDomain(client, "multi_target2_" + shortId);

    // Create data product in source domain
    CreateDataProduct createDp = new CreateDataProduct();
    createDp.setName("multi_domain_dp_" + shortId);
    createDp.setDescription("Test data product for multi-domain migration");
    createDp.setDomains(List.of(sourceDomain.getFullyQualifiedName()));

    DataProduct dataProduct = client.dataProducts().create(createDp);

    // Create and add assets
    Table table = createTestTable(ns, "multi_domain_table");
    List<EntityReference> assetRefs =
        List.of(
            new EntityReference()
                .withId(table.getId())
                .withType("table")
                .withFullyQualifiedName(table.getFullyQualifiedName()));
    BulkAssets bulkRequest = new BulkAssets().withAssets(assetRefs);
    client.dataProducts().bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkRequest);

    waitForSearchIndexUpdate();

    // Change to multiple domains
    DataProduct dpToUpdate = client.dataProducts().get(dataProduct.getId().toString(), "domains");
    dpToUpdate.setDomains(
        List.of(
            new EntityReference()
                .withId(targetDomain1.getId())
                .withType("domain")
                .withFullyQualifiedName(targetDomain1.getFullyQualifiedName()),
            new EntityReference()
                .withId(targetDomain2.getId())
                .withType("domain")
                .withFullyQualifiedName(targetDomain2.getFullyQualifiedName())));

    DataProduct updatedDp =
        client.dataProducts().update(dataProduct.getId().toString(), dpToUpdate);
    assertNotNull(updatedDp);
    assertEquals(2, updatedDp.getDomains().size());

    waitForSearchIndexUpdate();

    // Verify assets appear in both target domains
    verifyAssetsInDomainSearch(client, targetDomain1.getFullyQualifiedName(), List.of(table), true);
    verifyAssetsInDomainSearch(client, targetDomain2.getFullyQualifiedName(), List.of(table), true);

    // Verify assets no longer appear in source domain
    verifyAssetsInDomainSearch(client, sourceDomain.getFullyQualifiedName(), List.of(table), false);
  }

  // ==================== Helper Methods ====================

  private Domain createDomain(OpenMetadataClient client, String name) {
    CreateDomain request = new CreateDomain();
    request.setName(name);
    request.setDescription("Test domain for data product migration tests");
    request.setDomainType(CreateDomain.DomainType.AGGREGATE);
    return client.domains().create(request);
  }

  private Table createTestTable(TestNamespace ns, String baseName) {
    initializeSharedDbEntities(ns);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(sharedSchema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private synchronized void initializeSharedDbEntities(TestNamespace ns) {
    if (sharedDbService != null) {
      return;
    }
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    sharedDbService =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("dp_migration_svc_" + shortId)
            .connection(conn)
            .description("Test service for data product migration")
            .create();

    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("dp_migration_db_" + shortId);
    dbReq.setService(sharedDbService.getFullyQualifiedName());
    sharedDatabase = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("dp_migration_schema_" + shortId);
    schemaReq.setDatabase(sharedDatabase.getFullyQualifiedName());
    sharedSchema = SdkClients.adminClient().databaseSchemas().create(schemaReq);
  }

  private void waitForSearchIndexUpdate() {
    // Give time for the search index to be updated asynchronously
    // In a real scenario, we might want to use a more sophisticated polling mechanism
    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private void verifyAssetsInDomainSearch(
      OpenMetadataClient client, String domainFqn, List<Table> expectedTables, boolean shouldExist)
      throws Exception {
    // Build query filter for domain
    String queryFilter =
        String.format(
            "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"domains.fullyQualifiedName\":\"%s\"}}]}}}",
            domainFqn);

    // Use Awaitility to poll for the expected state
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .untilAsserted(
            () -> {
              String response =
                  client
                      .search()
                      .query("*")
                      .index("table_search_index")
                      .queryFilter(queryFilter)
                      .size(100)
                      .execute();

              assertNotNull(response);
              JsonNode root = OBJECT_MAPPER.readTree(response);
              assertTrue(root.has("hits"), "Response should have hits");

              JsonNode hits = root.get("hits").get("hits");
              List<String> foundFqns = new ArrayList<>();
              for (JsonNode hit : hits) {
                if (hit.has("_source") && hit.get("_source").has("fullyQualifiedName")) {
                  foundFqns.add(hit.get("_source").get("fullyQualifiedName").asText());
                }
              }

              for (Table table : expectedTables) {
                boolean found = foundFqns.contains(table.getFullyQualifiedName());
                if (shouldExist) {
                  assertTrue(
                      found,
                      String.format(
                          "Table %s should be found in domain %s. Found FQNs: %s",
                          table.getFullyQualifiedName(), domainFqn, foundFqns));
                } else {
                  assertFalse(
                      found,
                      String.format(
                          "Table %s should NOT be found in domain %s. Found FQNs: %s",
                          table.getFullyQualifiedName(), domainFqn, foundFqns));
                }
              }
            });
  }
}
