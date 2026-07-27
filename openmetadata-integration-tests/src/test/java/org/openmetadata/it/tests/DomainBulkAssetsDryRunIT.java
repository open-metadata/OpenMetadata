/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for dryRun support on domain bulk asset add/remove operations.
 *
 * <p>Covers:
 * - dryRun=true on assets/add returns impact without writing
 * - dryRun=true on assets/remove returns impact without writing
 * - dryRun=false (default) performs actual writes
 * - Warning messages include entity type and data product side effects
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DomainBulkAssetsDryRunIT {

  @Test
  void test_dryRunAdd_returnsImpactWithoutWriting(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Domain domainA = createDomain(ns, client, "domainA");
    Domain domainB = createDomain(ns, client, "domainB");
    Table table = createTable(ns);

    // Add table to domainA first
    BulkAssets addToDomainA =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String addPath = "/v1/domains/" + domainA.getFullyQualifiedName() + "/assets/add";
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, addPath, addToDomainA, BulkOperationResult.class);

    // dryRun=true: move table to domainB — should NOT actually move
    BulkAssets dryRunRequest =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(true);
    String addToBPath = "/v1/domains/" + domainB.getFullyQualifiedName() + "/assets/add";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, addToBPath, dryRunRequest, BulkOperationResult.class);

    assertNotNull(result);
    assertTrue(result.getDryRun(), "Result must have dryRun=true");
    assertEquals(1, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertFalse(result.getSuccessRequest().isEmpty());

    BulkResponse response = result.getSuccessRequest().get(0);
    assertTrue(response.getHasSideEffects(), "Cross-domain move must flag hasSideEffects");
    assertNotNull(response.getMessage());
    assertTrue(
        response.getMessage().contains(domainA.getFullyQualifiedName()),
        "Message should mention the original domain: " + response.getMessage());
    assertTrue(
        response.getMessage().contains("table"),
        "Message should mention the entity type: " + response.getMessage());

    // Verify the table is still in domainA (dryRun made no changes)
    Table refreshed =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/tables/" + table.getId() + "?fields=domains",
                null,
                Table.class);
    assertNotNull(refreshed.getDomains());
    assertFalse(refreshed.getDomains().isEmpty());
    assertTrue(
        refreshed.getDomains().stream().anyMatch(d -> domainA.getId().equals(d.getId())),
        "Table should still be in domainA after dryRun");
  }

  @Test
  void test_dryRunRemove_returnsImpactWithoutWriting(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Domain domain = createDomain(ns, client, "domain");
    Table table = createTable(ns);

    // Add table to domain
    BulkAssets addRequest =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String addPath = "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/add";
    client.getHttpClient().execute(HttpMethod.PUT, addPath, addRequest, BulkOperationResult.class);

    // dryRun=true: preview removing the table from domain
    BulkAssets dryRunRemove =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(true);
    String removePath = "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/remove";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, removePath, dryRunRemove, BulkOperationResult.class);

    assertNotNull(result);
    assertTrue(result.getDryRun(), "Result must have dryRun=true");
    assertEquals(1, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertFalse(result.getSuccessRequest().isEmpty());

    BulkResponse response = result.getSuccessRequest().get(0);
    assertFalse(
        Boolean.TRUE.equals(response.getHasSideEffects()),
        "Removing an asset with no data product links should not flag hasSideEffects");

    // Verify the table is still in the domain (dryRun made no changes)
    Table refreshed =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/tables/" + table.getId() + "?fields=domains",
                null,
                Table.class);
    assertNotNull(refreshed.getDomains());
    assertFalse(refreshed.getDomains().isEmpty());
    assertTrue(
        refreshed.getDomains().stream().anyMatch(d -> domain.getId().equals(d.getId())),
        "Table should still be in domain after dryRun remove");
  }

  @Test
  void test_dryRunAdd_includesDataProductWarning(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Domain domainA = createDomain(ns, client, "domainA");
    Domain domainB = createDomain(ns, client, "domainB");
    Table table = createTable(ns);

    // Add table to domainA
    BulkAssets addToDomainA =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String addPath = "/v1/domains/" + domainA.getFullyQualifiedName() + "/assets/add";
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, addPath, addToDomainA, BulkOperationResult.class);

    // Create a data product in domainA linked to the table
    DataProduct dataProduct =
        client
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(ns.prefix("dp"))
                    .withDomains(List.of(domainA.getFullyQualifiedName()))
                    .withDescription("Data product in domainA"));

    BulkAssets dpAddRequest =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String dpAddPath = "/v1/dataProducts/" + dataProduct.getFullyQualifiedName() + "/assets/add";
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, dpAddPath, dpAddRequest, BulkOperationResult.class);

    // dryRun=true: move table to domainB — should warn about data product relationship
    BulkAssets dryRunRequest =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(true);
    String addToBPath = "/v1/domains/" + domainB.getFullyQualifiedName() + "/assets/add";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, addToBPath, dryRunRequest, BulkOperationResult.class);

    assertNotNull(result);
    assertTrue(result.getDryRun());
    assertFalse(result.getSuccessRequest().isEmpty());

    BulkResponse response = result.getSuccessRequest().get(0);
    assertTrue(
        response.getHasSideEffects(),
        "Cross-domain move with affected data product must flag hasSideEffects");
    assertNotNull(response.getMessage());
    assertTrue(
        response.getMessage().contains("data product relationships will be removed"),
        "Message should warn about data product removal: " + response.getMessage());
    assertTrue(
        response.getMessage().contains(dataProduct.getFullyQualifiedName()),
        "Message should name the affected data product: " + response.getMessage());
  }

  @Test
  void test_actualAdd_withoutDryRun_movesAsset(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Domain domainA = createDomain(ns, client, "domainA");
    Domain domainB = createDomain(ns, client, "domainB");
    Table table = createTable(ns);

    // Add table to domainA
    BulkAssets addToDomainA =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String addAPath = "/v1/domains/" + domainA.getFullyQualifiedName() + "/assets/add";
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, addAPath, addToDomainA, BulkOperationResult.class);

    // Actual move (dryRun=false) to domainB
    BulkAssets moveToDomainB =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String addBPath = "/v1/domains/" + domainB.getFullyQualifiedName() + "/assets/add";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, addBPath, moveToDomainB, BulkOperationResult.class);

    assertNotNull(result);
    assertFalse(Boolean.TRUE.equals(result.getDryRun()), "dryRun should be false");
    assertEquals(1, result.getNumberOfRowsPassed());

    // Verify table is now in domainB
    Table refreshed =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/tables/" + table.getId() + "?fields=domains",
                null,
                Table.class);
    assertNotNull(refreshed.getDomains());
    assertFalse(refreshed.getDomains().isEmpty());
    assertTrue(
        refreshed.getDomains().stream().anyMatch(d -> domainB.getId().equals(d.getId())),
        "Table should be in domainB after actual move");
  }

  @Test
  void test_dryRunAdd_firstTimeAdd_doesNotFlagSideEffects(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Domain domain = createDomain(ns, client, "domain");
    Table table = createTable(ns);

    // dryRun=true: add table to domain for the first time (table has no current domain)
    BulkAssets dryRunRequest =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(true);
    String addPath = "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/add";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, addPath, dryRunRequest, BulkOperationResult.class);

    assertNotNull(result);
    assertTrue(result.getDryRun(), "Result must have dryRun=true");
    assertEquals(1, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertFalse(result.getSuccessRequest().isEmpty());

    BulkResponse response = result.getSuccessRequest().get(0);
    assertFalse(
        Boolean.TRUE.equals(response.getHasSideEffects()),
        "First-time add (no current domain, no data products) must not flag hasSideEffects");

    // Verify the table still has no domain (dryRun made no changes)
    Table refreshed =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/tables/" + table.getId() + "?fields=domains",
                null,
                Table.class);
    assertTrue(
        refreshed.getDomains() == null || refreshed.getDomains().isEmpty(),
        "Table should still have no domain after dryRun");
  }

  @Test
  void test_dryRunRemove_includesDataProductWarning(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Domain domain = createDomain(ns, client, "domain");
    Table table = createTable(ns);

    // Add table to domain
    BulkAssets addRequest =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String addPath = "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/add";
    client.getHttpClient().execute(HttpMethod.PUT, addPath, addRequest, BulkOperationResult.class);

    // Create a data product in domain linked to the table
    DataProduct dataProduct =
        client
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(ns.prefix("dp"))
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withDescription("Data product in domain"));

    BulkAssets dpAddRequest =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String dpAddPath = "/v1/dataProducts/" + dataProduct.getFullyQualifiedName() + "/assets/add";
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, dpAddPath, dpAddRequest, BulkOperationResult.class);

    // dryRun=true: preview removing table from domain — should warn about data product
    BulkAssets dryRunRemove =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(true);
    String removePath = "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/remove";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, removePath, dryRunRemove, BulkOperationResult.class);

    assertNotNull(result);
    assertTrue(result.getDryRun());
    assertFalse(result.getSuccessRequest().isEmpty());

    BulkResponse response = result.getSuccessRequest().get(0);
    assertTrue(
        response.getHasSideEffects(),
        "Removing an asset linked to a data product must flag hasSideEffects");
    assertNotNull(response.getMessage());
    assertTrue(
        response.getMessage().contains("data product relationships will also be removed"),
        "Message should warn about data product side effect: " + response.getMessage());
    assertTrue(
        response.getMessage().contains(dataProduct.getFullyQualifiedName()),
        "Message should name the affected data product: " + response.getMessage());
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private Domain createDomain(TestNamespace ns, OpenMetadataClient client, String suffix) {
    return client
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix(suffix))
                .withDomainType(DomainType.AGGREGATE)
                .withDescription("Domain " + suffix));
  }

  private Table createTable(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());

    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix("table"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDescription("ID column")));

    return SdkClients.adminClient().tables().create(createTable);
  }
}
