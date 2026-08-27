/*
 *  Copyright 2024 Collate.
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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
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
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Regression test for GitHub Issue #28923: after a domain is HARD deleted and a new domain is
 * created with the same name (same FQN, new UUID), assets that belonged to the deleted domain must
 * NOT reappear under the new domain.
 *
 * <p>The domain-assets listing filters by {@code domains.fullyQualifiedName} (see {@code
 * InheritedFieldEntitySearch.forDomain}). Before the fix, the domain hard-delete search cleanup in
 * {@code SearchRepository.deleteOrUpdateChildren} matched the singular {@code domain.id} and ran
 * {@code ctx._source.remove('domain')} — but assets store the plural {@code domains} array, so the
 * stale domain entry was never stripped from their search documents and a recreated same-FQN domain
 * matched those stale docs.
 *
 * <p>The activity-history half of #28923 is covered deterministically by {@code
 * ActivityStreamPublisherTest} (the activity write path is an async change-event consumer, so an
 * end-to-end assertion here would be timing-dependent).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DomainRecreateSameNameIT {

  @Test
  void test_recreatedDomainDoesNotInheritDeletedDomainAssets(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String domainName = ns.shortPrefix() + "_recreate";

    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);

    Domain domainV1 = createDomain(adminClient, domainName);
    String domainFqn = domainV1.getFullyQualifiedName();

    Table table =
        createTableInDomain(
            adminClient, ns.shortPrefix() + "_asset", schema.getFullyQualifiedName(), domainFqn);

    Awaitility.await("asset indexed under original domain")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () ->
                assertTrue(
                    domainAssetsContain(adminClient, domainV1.getId().toString(), table.getId()),
                    "Sanity: asset should be listed under the original domain before deletion"));

    Map<String, String> hardDelete = new HashMap<>();
    hardDelete.put("hardDelete", "true");
    hardDelete.put("recursive", "true");
    adminClient.domains().delete(domainV1.getId().toString(), hardDelete);

    Domain domainV2 = createDomain(adminClient, domainName);
    assertNotEquals(
        domainV1.getId(), domainV2.getId(), "Recreated domain must be a new entity with a new id");

    Awaitility.await("recreated domain must not inherit the deleted domain's assets")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () ->
                assertFalse(
                    domainAssetsContain(adminClient, domainV2.getId().toString(), table.getId()),
                    "Issue #28923: asset from the hard-deleted domain reappeared under the "
                        + "recreated same-named domain"));
  }

  @Test
  void test_recreatedSubdomainDoesNotInheritDeletedSubdomainAssets(TestNamespace ns)
      throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String parentName = ns.shortPrefix() + "_parent";
    String childName = "child";

    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);

    Domain parentV1 = createDomain(adminClient, parentName);
    Domain childV1 = createSubdomain(adminClient, childName, parentV1.getFullyQualifiedName());

    Table table =
        createTableInDomain(
            adminClient,
            ns.shortPrefix() + "_asset",
            schema.getFullyQualifiedName(),
            childV1.getFullyQualifiedName());

    Awaitility.await("asset indexed under original subdomain")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () ->
                assertTrue(
                    domainAssetsContain(adminClient, childV1.getId().toString(), table.getId()),
                    "Sanity: asset should be listed under the original subdomain before deletion"));

    Map<String, String> hardDelete = new HashMap<>();
    hardDelete.put("hardDelete", "true");
    hardDelete.put("recursive", "true");
    adminClient.domains().delete(parentV1.getId().toString(), hardDelete);

    // The subdomain strip is an async update-by-query; wait until it settles before recreating so
    // the assertion is deterministic rather than racing the in-flight reindex.
    Awaitility.await("deleted subdomain stripped from asset search doc")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .until(() -> !assetSearchDocReferencesDomain(adminClient, table.getId(), childV1.getId()));

    Domain parentV2 = createDomain(adminClient, parentName);
    Domain childV2 = createSubdomain(adminClient, childName, parentV2.getFullyQualifiedName());
    assertNotEquals(
        childV1.getId(), childV2.getId(), "Recreated subdomain must be a new entity with a new id");

    Awaitility.await("recreated subdomain must not inherit the deleted subdomain's assets")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () ->
                assertFalse(
                    domainAssetsContain(adminClient, childV2.getId().toString(), table.getId()),
                    "Issue #28923: asset from the hard-deleted subdomain reappeared under the "
                        + "recreated same-named subdomain (parent recursive hard delete)"));
  }

  private boolean assetSearchDocReferencesDomain(
      OpenMetadataClient client, Object assetId, Object domainId) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/search/query?q=id:" + assetId + "&index=table_search_index&from=0&size=1",
                null,
                RequestOptions.builder().build());
    return response.contains("\"" + domainId + "\"");
  }

  private boolean domainAssetsContain(OpenMetadataClient client, String domainId, Object assetId)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/domains/" + domainId + "/assets?limit=100&offset=0",
                null,
                RequestOptions.builder().build());
    return response.contains("\"id\":\"" + assetId + "\"");
  }

  private Domain createDomain(OpenMetadataClient client, String name) {
    CreateDomain createDomain =
        new CreateDomain()
            .withName(name)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Domain for issue #28923 recreate-same-name regression test");
    return client.domains().create(createDomain);
  }

  private Domain createSubdomain(OpenMetadataClient client, String name, String parentFqn) {
    CreateDomain createDomain =
        new CreateDomain()
            .withName(name)
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withParent(parentFqn)
            .withDescription("Subdomain for issue #28923 recreate-same-name regression test");
    return client.domains().create(createDomain);
  }

  private Table createTableInDomain(
      OpenMetadataClient client, String name, String schemaFqn, String domainFqn) {
    Column column = new Column().withName("id").withDataType(ColumnDataType.INT);
    CreateTable createTable =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schemaFqn)
            .withColumns(List.of(column))
            .withDomains(List.of(domainFqn));
    return client.tables().create(createTable);
  }
}
