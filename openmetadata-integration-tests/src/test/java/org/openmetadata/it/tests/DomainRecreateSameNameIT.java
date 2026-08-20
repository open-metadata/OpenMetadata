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
 * created with the same name (same FQN, new UUID), neither the deleted domain's assets nor its
 * activity history may reappear under the new domain.
 *
 * <p>Assets: the domain-assets listing filters by {@code domains.fullyQualifiedName} (see {@code
 * InheritedFieldEntitySearch.forDomain}). Before the fix, the domain hard-delete search cleanup in
 * {@code SearchRepository.deleteOrUpdateChildren} matched the singular {@code domain.id} and ran
 * {@code ctx._source.remove('domain')} — but assets store the plural {@code domains} array, so the
 * stale domain entry was never stripped from their search documents and a recreated same-FQN domain
 * matched those stale docs.
 *
 * <p>Activity: the activity stream is queried by {@code aboutFqnHash} (FQN based). Before the fix,
 * nothing purged {@code activity_stream} on hard delete, so a recreated same-FQN domain inherited
 * the dead domain's events. The fix purges the entity's activity by id when the hard-delete event
 * is consumed ({@code ActivityStreamPublisher}).
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
  void test_recreatedDomainDoesNotInheritDeletedDomainActivityFeed(TestNamespace ns)
      throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String domainName = ns.shortPrefix() + "_feed";

    Domain domainV1 = createDomain(adminClient, domainName);
    String oldDomainId = domainV1.getId().toString();
    String entityLink = "<#E::domain::" + domainV1.getFullyQualifiedName() + ">";

    Awaitility.await("original domain's creation activity is recorded")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () ->
                assertTrue(
                    feedContains(adminClient, entityLink, oldDomainId),
                    "Sanity: original domain should have activity referencing its own id"));

    Map<String, String> hardDelete = new HashMap<>();
    hardDelete.put("hardDelete", "true");
    hardDelete.put("recursive", "true");
    adminClient.domains().delete(oldDomainId, hardDelete);

    Domain domainV2 = createDomain(adminClient, domainName);
    assertNotEquals(
        domainV1.getId(), domainV2.getId(), "Recreated domain must be a new entity with a new id");

    Awaitility.await("recreated domain must not inherit the deleted domain's activity feed")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () ->
                assertFalse(
                    feedContains(adminClient, entityLink, oldDomainId),
                    "Issue #28923: activity history of the hard-deleted domain (id "
                        + oldDomainId
                        + ") reappeared under the recreated same-named domain"));
  }

  private boolean feedContains(OpenMetadataClient client, String entityLink, String entityId)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/activity/about",
                null,
                RequestOptions.builder()
                    .queryParam("entityLink", entityLink)
                    .queryParam("limit", "50")
                    .queryParam("days", "30")
                    .build());
    return response.contains("\"id\":\"" + entityId + "\"");
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
