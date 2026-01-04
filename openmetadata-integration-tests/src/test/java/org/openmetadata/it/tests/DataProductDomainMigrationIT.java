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

    // Step 3: Create tables with source domain and add them as assets to the data product
    List<Table> tables = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      Table table = createTestTableInDomain(ns, "migration_test_table_" + i, sourceDomain);
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

    // Verify assets are in source domain via API (database check)
    verifyAssetsHaveDomainViaAPI(client, tables, sourceDomain, true);

    // Verify assets are searchable in source domain (search index check)
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

    // Step 5: Verify assets now have target domain via API (database check - THE KEY TEST)
    verifyAssetsHaveDomainViaAPI(client, tables, targetDomain, true);
    verifyAssetsHaveDomainViaAPI(client, tables, sourceDomain, false);

    // Step 6: Verify assets appear in target domain's /assets endpoint (THE ACTUAL USER ENDPOINT)
    verifyAssetsInDomainAssetsEndpoint(client, targetDomain, tables, true);
    verifyAssetsInDomainAssetsEndpoint(client, sourceDomain, tables, false);

    // Step 7: Verify assets now appear in target domain's search (search index check)
    verifyAssetsInDomainSearch(client, targetDomain.getFullyQualifiedName(), tables, true);

    // Step 8: Verify assets no longer appear in source domain's search
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

    // Create tables for input/output ports with source domain
    Table inputTable = createTestTableInDomain(ns, "input_port_table", sourceDomain);
    Table outputTable = createTestTableInDomain(ns, "output_port_table", sourceDomain);

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

    // Verify ports are in source domain via API
    verifyAssetsHaveDomainViaAPI(client, List.of(inputTable, outputTable), sourceDomain, true);

    // Verify ports are in source domain via search
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

    // Verify ports are now in target domain via API (THE KEY TEST)
    verifyAssetsHaveDomainViaAPI(client, List.of(inputTable, outputTable), targetDomain, true);
    verifyAssetsHaveDomainViaAPI(client, List.of(inputTable, outputTable), sourceDomain, false);

    // Verify ports are now in target domain via search
    verifyAssetsInDomainSearch(
        client, targetDomain.getFullyQualifiedName(), List.of(inputTable, outputTable), true);

    // Verify ports are no longer in source domain via search
    verifyAssetsInDomainSearch(
        client, sourceDomain.getFullyQualifiedName(), List.of(inputTable, outputTable), false);
  }

  // Multi-domain test is disabled because the platform has a rule that only allows single domain
  // per entity (except for Users and Teams). This is a platform constraint, not a bug.
  // @Test
  // void testDataProductDomainMigrationToMultipleDomains(TestNamespace ns) throws Exception { ... }

  // ==================== Helper Methods ====================

  private Domain createDomain(OpenMetadataClient client, String name) {
    CreateDomain request = new CreateDomain();
    request.setName(name);
    request.setDescription("Test domain for data product migration tests");
    request.setDomainType(CreateDomain.DomainType.AGGREGATE);
    return client.domains().create(request);
  }

  private Table createTestTableInDomain(TestNamespace ns, String baseName, Domain domain) {
    initializeSharedDbEntities(ns);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(sharedSchema.getFullyQualifiedName());
    tableRequest.setDomains(List.of(domain.getFullyQualifiedName()));
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
    // Verification methods use Awaitility with polling, so no explicit wait needed
  }

  /**
   * Verify that tables have (or don't have) a specific domain via API call.
   * This checks the actual database state, not the search index.
   */
  private void verifyAssetsHaveDomainViaAPI(
      OpenMetadataClient client,
      List<Table> tables,
      Domain expectedDomain,
      boolean shouldHaveDomain) {
    for (Table table : tables) {
      // Fetch the table with domains field populated
      Table fetchedTable = client.tables().get(table.getId().toString(), "domains");
      assertNotNull(fetchedTable, "Table should exist: " + table.getFullyQualifiedName());

      List<EntityReference> domains = fetchedTable.getDomains();
      boolean hasDomain = false;
      if (domains != null) {
        hasDomain = domains.stream().anyMatch(d -> d.getId().equals(expectedDomain.getId()));
      }

      if (shouldHaveDomain) {
        assertTrue(
            hasDomain,
            String.format(
                "Table %s should have domain %s. Actual domains: %s",
                table.getFullyQualifiedName(),
                expectedDomain.getFullyQualifiedName(),
                domains != null
                    ? domains.stream().map(EntityReference::getFullyQualifiedName).toList()
                    : "null"));
      } else {
        assertFalse(
            hasDomain,
            String.format(
                "Table %s should NOT have domain %s. Actual domains: %s",
                table.getFullyQualifiedName(),
                expectedDomain.getFullyQualifiedName(),
                domains != null
                    ? domains.stream().map(EntityReference::getFullyQualifiedName).toList()
                    : "null"));
      }
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

  /**
   * Verify assets using the actual /api/v1/domains/{name}/assets endpoint.
   * This is the endpoint the user reported as returning empty results.
   */
  private void verifyAssetsInDomainAssetsEndpoint(
      OpenMetadataClient client, Domain domain, List<Table> expectedTables, boolean shouldExist)
      throws Exception {
    // Use Awaitility to poll for the expected state since search index updates are async
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .untilAsserted(
            () -> {
              // Call the actual /api/v1/domains/name/{fqn}/assets endpoint using raw HTTP
              // Note: SdkClients.getServerUrl() already includes /api suffix
              String url =
                  String.format(
                      "%s/v1/domains/name/%s/assets?limit=100",
                      SdkClients.getServerUrl(), domain.getFullyQualifiedName());

              java.net.http.HttpClient httpClient = java.net.http.HttpClient.newHttpClient();
              java.net.http.HttpRequest request =
                  java.net.http.HttpRequest.newBuilder()
                      .uri(java.net.URI.create(url))
                      .header("Authorization", "Bearer " + SdkClients.getAdminToken())
                      .header("Content-Type", "application/json")
                      .GET()
                      .build();

              java.net.http.HttpResponse<String> response =
                  httpClient.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());

              assertEquals(
                  200,
                  response.statusCode(),
                  "Domain assets endpoint should return 200. Response: " + response.body());

              JsonNode root = OBJECT_MAPPER.readTree(response.body());
              assertTrue(root.has("data"), "Response should have 'data' field");

              JsonNode dataArray = root.get("data");
              List<String> foundFqns = new ArrayList<>();
              for (JsonNode asset : dataArray) {
                if (asset.has("fullyQualifiedName")) {
                  foundFqns.add(asset.get("fullyQualifiedName").asText());
                }
              }

              int totalAssets =
                  root.has("paging") && root.get("paging").has("total")
                      ? root.get("paging").get("total").asInt()
                      : foundFqns.size();

              for (Table table : expectedTables) {
                boolean found = foundFqns.contains(table.getFullyQualifiedName());
                if (shouldExist) {
                  assertTrue(
                      found,
                      String.format(
                          "Table %s should be found in domain %s assets endpoint. "
                              + "Expected %d assets, found %d (total=%d). Found FQNs: %s",
                          table.getFullyQualifiedName(),
                          domain.getFullyQualifiedName(),
                          expectedTables.size(),
                          foundFqns.size(),
                          totalAssets,
                          foundFqns));
                } else {
                  assertFalse(
                      found,
                      String.format(
                          "Table %s should NOT be found in domain %s assets endpoint. Found FQNs: %s",
                          table.getFullyQualifiedName(),
                          domain.getFullyQualifiedName(),
                          foundFqns));
                }
              }
            });
  }

  /**
   * Test that verifies domain migration works correctly when moving back and forth between multiple
   * domains. This catches edge cases where:
   * - Removal of non-existent relationships causes issues
   * - Multiple consecutive moves don't work correctly
   * - Moving back to the original domain doesn't restore state
   */
  @Test
  void testDataProductDomainMigrationBackAndForth(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.shortPrefix();

    // Create 4 domains to move between
    Domain domainA = createDomain(client, "domain_a_" + shortId);
    Domain domainB = createDomain(client, "domain_b_" + shortId);
    Domain domainC = createDomain(client, "domain_c_" + shortId);
    Domain domainD = createDomain(client, "domain_d_" + shortId);

    // Create a data product in Domain A
    CreateDataProduct createDp = new CreateDataProduct();
    createDp.setName("backforth_dp_" + shortId);
    createDp.setDescription("Test data product for back-and-forth domain migration");
    createDp.setDomains(List.of(domainA.getFullyQualifiedName()));

    DataProduct dataProduct = client.dataProducts().create(createDp);
    assertNotNull(dataProduct);

    // Create tables with Domain A and add them as assets
    List<Table> tables = new ArrayList<>();
    for (int i = 0; i < 2; i++) {
      Table table = createTestTableInDomain(ns, "backforth_table_" + i, domainA);
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
    client.dataProducts().bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkRequest);
    waitForSearchIndexUpdate();

    // Verify initial state: assets in Domain A
    verifyAssetsHaveDomainViaAPI(client, tables, domainA, true);
    verifyAssetsInDomainAssetsEndpoint(client, domainA, tables, true);

    // Move 1: A → B
    moveDataProductToDomain(client, dataProduct, domainB);
    waitForSearchIndexUpdate();
    verifyAssetsHaveDomainViaAPI(client, tables, domainB, true);
    verifyAssetsHaveDomainViaAPI(client, tables, domainA, false);
    verifyAssetsInDomainAssetsEndpoint(client, domainB, tables, true);
    verifyAssetsInDomainAssetsEndpoint(client, domainA, tables, false);

    // Move 2: B → C
    moveDataProductToDomain(client, dataProduct, domainC);
    waitForSearchIndexUpdate();
    verifyAssetsHaveDomainViaAPI(client, tables, domainC, true);
    verifyAssetsHaveDomainViaAPI(client, tables, domainB, false);
    verifyAssetsInDomainAssetsEndpoint(client, domainC, tables, true);
    verifyAssetsInDomainAssetsEndpoint(client, domainB, tables, false);

    // Move 3: C → D
    moveDataProductToDomain(client, dataProduct, domainD);
    waitForSearchIndexUpdate();
    verifyAssetsHaveDomainViaAPI(client, tables, domainD, true);
    verifyAssetsHaveDomainViaAPI(client, tables, domainC, false);
    verifyAssetsInDomainAssetsEndpoint(client, domainD, tables, true);
    verifyAssetsInDomainAssetsEndpoint(client, domainC, tables, false);

    // Move 4: D → A (back to original)
    moveDataProductToDomain(client, dataProduct, domainA);
    waitForSearchIndexUpdate();
    verifyAssetsHaveDomainViaAPI(client, tables, domainA, true);
    verifyAssetsHaveDomainViaAPI(client, tables, domainD, false);
    verifyAssetsInDomainAssetsEndpoint(client, domainA, tables, true);
    verifyAssetsInDomainAssetsEndpoint(client, domainD, tables, false);

    // Final verification: only Domain A should have the assets
    verifyAssetsHaveDomainViaAPI(client, tables, domainB, false);
    verifyAssetsHaveDomainViaAPI(client, tables, domainC, false);
  }

  /**
   * Helper method to move a data product to a new domain.
   */
  private void moveDataProductToDomain(
      OpenMetadataClient client, DataProduct dataProduct, Domain targetDomain) {
    DataProduct dpToUpdate = client.dataProducts().get(dataProduct.getId().toString(), "domains");
    dpToUpdate.setDomains(
        List.of(
            new EntityReference()
                .withId(targetDomain.getId())
                .withType("domain")
                .withFullyQualifiedName(targetDomain.getFullyQualifiedName())));
    client.dataProducts().update(dataProduct.getId().toString(), dpToUpdate);
  }
}
