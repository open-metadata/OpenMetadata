/*
 *  Copyright 2026 Collate
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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.awaitility.Awaitility;
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
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for the {@code marketplace} index alias.
 *
 * <p>The marketplace alias is defined in {@code openmetadata-spec/.../indexMapping.json} as a
 * parent alias on the {@code domain} and {@code dataProduct} indices. Querying
 * {@code /v1/search/query?index=marketplace} must return only those two entity types so the data
 * marketplace UI can scope its search results to discoverable assets.
 *
 * <p>See issue: open-metadata/ai-platform#578.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class MarketplaceSearchIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final Set<String> MARKETPLACE_ENTITY_TYPES = Set.of("domain", "dataProduct");

  @Test
  void marketplaceAliasReturnsOnlyDomainsAndDataProducts(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String uniqueTag = "mp" + ns.uniqueShortId();

    Domain domain = createDomain(client, uniqueTag + "_domain");
    DataProduct dataProduct = createDataProduct(client, uniqueTag + "_dp", domain);
    Table controlTable = createControlTable(client, ns, uniqueTag + "_table");

    Awaitility.await("marketplace alias returns the seeded domain and data product")
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String response =
                  client.search().query(uniqueTag).index("marketplace").size(50).execute();

              assertNotNull(response);
              JsonNode root = OBJECT_MAPPER.readTree(response);
              JsonNode shardFailures = root.path("_shards").path("failed");
              assertTrue(
                  shardFailures.isMissingNode() || shardFailures.asInt() == 0,
                  "marketplace alias query should not have shard failures: " + response);

              JsonNode hits = root.path("hits").path("hits");
              assertTrue(hits.isArray(), "Response should have hits array");

              Set<String> seenIds = new HashSet<>();
              Set<String> seenEntityTypes = new HashSet<>();
              for (JsonNode hit : hits) {
                seenIds.add(hit.path("_source").path("id").asText());
                seenEntityTypes.add(hit.path("_source").path("entityType").asText());
              }

              assertTrue(
                  seenIds.contains(domain.getId().toString()),
                  "marketplace alias should include the seeded domain");
              assertTrue(
                  seenIds.contains(dataProduct.getId().toString()),
                  "marketplace alias should include the seeded data product");
              assertFalse(
                  seenIds.contains(controlTable.getId().toString()),
                  "marketplace alias should not include tables");

              for (String entityType : seenEntityTypes) {
                assertTrue(
                    MARKETPLACE_ENTITY_TYPES.contains(entityType),
                    "marketplace alias returned unexpected entityType: " + entityType);
              }
            });
  }

  @Test
  void marketplaceAliasIsRoutableWithoutSeededData(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response = client.search().query("*").index("marketplace").size(0).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertFalse(
        root.has("error"), "marketplace alias should be routable to existing indices: " + response);
    assertTrue(root.has("hits"), "Response should have hits structure: " + response);
  }

  private Domain createDomain(OpenMetadataClient client, String name) {
    CreateDomain create =
        new CreateDomain()
            .withName(name)
            .withDescription("Marketplace alias test domain")
            .withDomainType(DomainType.AGGREGATE);
    return client.domains().create(create);
  }

  private DataProduct createDataProduct(OpenMetadataClient client, String name, Domain domain) {
    CreateDataProduct create =
        new CreateDataProduct()
            .withName(name)
            .withDescription("Marketplace alias test data product")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    return client.dataProducts().create(create);
  }

  private Table createControlTable(OpenMetadataClient client, TestNamespace ns, String name) {
    String shortId = ns.shortPrefix();

    MysqlConnection connection =
        new MysqlConnection()
            .withHostPort("localhost:3306")
            .withUsername("test")
            .withAuthType(new basicAuth().withPassword("test"));

    CreateDatabaseService svcReq =
        new CreateDatabaseService()
            .withName("mp_svc_" + shortId)
            .withServiceType(DatabaseServiceType.Mysql)
            .withConnection(new DatabaseConnection().withConfig(connection));
    DatabaseService service = client.databaseServices().create(svcReq);

    CreateDatabase dbReq =
        new CreateDatabase()
            .withName("mp_db_" + shortId)
            .withService(service.getFullyQualifiedName());
    Database database = client.databases().create(dbReq);

    CreateDatabaseSchema schemaReq =
        new CreateDatabaseSchema()
            .withName("mp_schema_" + shortId)
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(schemaReq);

    CreateTable tableReq =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));
    return client.tables().create(tableReq);
  }
}
