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
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for dryRun support on synchronous bulk asset remove endpoints:
 *
 * <ul>
 *   <li>PUT /v1/glossaryTerms/{id}/assets/remove
 *   <li>PUT /v1/dataProducts/{name}/assets/remove
 *   <li>PUT /v1/teams/{name}/assets/remove
 * </ul>
 *
 * <p>All three previously hardcoded {@code dryRun=false} on the result and proceeded straight to
 * the destructive path, so a caller passing {@code dryRun=true} still had the relationship
 * removed. These tests pin the corrected behavior alongside the tag-side fix in
 * {@link TagBulkAssetsDryRunIT}.
 *
 * <p>The tag remove endpoint is async and is covered separately. The endpoints exercised here are
 * synchronous, so the tests can assert on the {@link BulkOperationResult} response and on a
 * follow-up read in the same test.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class BulkAssetsRemoveDryRunIT {

  // -----------------------------------------------------------------------
  // Glossary term remove (tag_usage path)
  // -----------------------------------------------------------------------

  @Test
  void test_glossaryRemove_dryRunTrue_doesNotRemoveTagFromAsset(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    GlossaryTerm term = createGlossaryTerm(ns, client, "dry_run");
    TagLabel termLabel = toGlossaryTagLabel(term);
    Table table = createTableWithTag(ns, termLabel);

    AddGlossaryToAssetsRequest dryRunRemove =
        new AddGlossaryToAssetsRequest()
            .withDryRun(true)
            .withAssets(List.of(table.getEntityReference()));
    String removePath = "/v1/glossaryTerms/" + term.getId() + "/assets/remove";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, removePath, dryRunRemove, BulkOperationResult.class);

    assertNotNull(result);
    assertTrue(result.getDryRun(), "Result must propagate dryRun=true");

    Table refreshed = client.tables().get(table.getId().toString(), "tags");
    assertTrue(
        hasTag(refreshed, term.getFullyQualifiedName()),
        "Glossary tag must still be on the table after a dryRun=true remove");
  }

  @Test
  void test_glossaryRemove_dryRunFalse_removesTagFromAsset(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    GlossaryTerm term = createGlossaryTerm(ns, client, "real_remove");
    TagLabel termLabel = toGlossaryTagLabel(term);
    Table table = createTableWithTag(ns, termLabel);

    AddGlossaryToAssetsRequest realRemove =
        new AddGlossaryToAssetsRequest()
            .withDryRun(false)
            .withAssets(List.of(table.getEntityReference()));
    String removePath = "/v1/glossaryTerms/" + term.getId() + "/assets/remove";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, removePath, realRemove, BulkOperationResult.class);

    assertNotNull(result);
    assertFalse(Boolean.TRUE.equals(result.getDryRun()));

    Table refreshed = client.tables().get(table.getId().toString(), "tags");
    assertFalse(
        hasTag(refreshed, term.getFullyQualifiedName()),
        "Glossary tag should be removed from the table when dryRun=false");
  }

  // -----------------------------------------------------------------------
  // DataProduct remove (entity_relationship path)
  // -----------------------------------------------------------------------

  @Test
  void test_dataProductRemove_dryRunTrue_doesNotDetachAsset(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Domain domain = createDomain(ns, client, "dp_dry_run");
    DataProduct dataProduct = createDataProduct(ns, client, "dp_dry_run", domain);
    Table table = createTable(ns);

    BulkAssets addRequest =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String addPath = "/v1/dataProducts/" + dataProduct.getFullyQualifiedName() + "/assets/add";
    client.getHttpClient().execute(HttpMethod.PUT, addPath, addRequest, BulkOperationResult.class);

    BulkAssets dryRunRemove =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(true);
    String removePath =
        "/v1/dataProducts/" + dataProduct.getFullyQualifiedName() + "/assets/remove";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, removePath, dryRunRemove, BulkOperationResult.class);

    assertNotNull(result);
    assertTrue(result.getDryRun(), "Result must propagate dryRun=true");
    assertEquals(1, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());

    Table refreshed = client.tables().get(table.getId().toString(), "dataProducts");
    assertNotNull(refreshed.getDataProducts(), "dataProducts field should be populated");
    assertTrue(
        refreshed.getDataProducts().stream().anyMatch(d -> dataProduct.getId().equals(d.getId())),
        "Table must still be attached to the data product after a dryRun=true remove");
  }

  @Test
  void test_dataProductRemove_dryRunFalse_detachesAsset(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Domain domain = createDomain(ns, client, "dp_real");
    DataProduct dataProduct = createDataProduct(ns, client, "dp_real", domain);
    Table table = createTable(ns);

    BulkAssets addRequest =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String addPath = "/v1/dataProducts/" + dataProduct.getFullyQualifiedName() + "/assets/add";
    client.getHttpClient().execute(HttpMethod.PUT, addPath, addRequest, BulkOperationResult.class);

    BulkAssets realRemove =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    String removePath =
        "/v1/dataProducts/" + dataProduct.getFullyQualifiedName() + "/assets/remove";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, removePath, realRemove, BulkOperationResult.class);

    assertNotNull(result);
    assertFalse(Boolean.TRUE.equals(result.getDryRun()));
    assertEquals(1, result.getNumberOfRowsPassed());

    Table refreshed = client.tables().get(table.getId().toString(), "dataProducts");
    assertTrue(
        refreshed.getDataProducts() == null
            || refreshed.getDataProducts().stream()
                .noneMatch(d -> dataProduct.getId().equals(d.getId())),
        "Table should no longer be attached to the data product when dryRun=false");
  }

  // -----------------------------------------------------------------------
  // Team remove (entity_relationship path through base bulkAssetsOperation)
  // -----------------------------------------------------------------------

  @Test
  void test_teamRemove_dryRunTrue_doesNotDetachUser(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Team team = createTeam(ns, client, "team_dry_run");
    User user = createUser(ns, client, "user_dry_run");

    BulkAssets addRequest =
        new BulkAssets().withAssets(List.of(user.getEntityReference())).withDryRun(false);
    String addPath = "/v1/teams/" + team.getName() + "/assets/add";
    client.getHttpClient().execute(HttpMethod.PUT, addPath, addRequest, BulkOperationResult.class);

    BulkAssets dryRunRemove =
        new BulkAssets().withAssets(List.of(user.getEntityReference())).withDryRun(true);
    String removePath = "/v1/teams/" + team.getName() + "/assets/remove";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, removePath, dryRunRemove, BulkOperationResult.class);

    assertNotNull(result);
    assertTrue(result.getDryRun(), "Result must propagate dryRun=true");
    assertEquals(1, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());

    User refreshed = client.users().get(user.getId().toString(), "teams");
    assertNotNull(refreshed.getTeams(), "User teams field must be populated");
    assertTrue(
        refreshed.getTeams().stream().anyMatch(t -> team.getId().equals(t.getId())),
        "User must still belong to the team after a dryRun=true remove");
  }

  @Test
  void test_teamRemove_dryRunFalse_detachesUser(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Team team = createTeam(ns, client, "team_real");
    User user = createUser(ns, client, "user_real");

    BulkAssets addRequest =
        new BulkAssets().withAssets(List.of(user.getEntityReference())).withDryRun(false);
    String addPath = "/v1/teams/" + team.getName() + "/assets/add";
    client.getHttpClient().execute(HttpMethod.PUT, addPath, addRequest, BulkOperationResult.class);

    BulkAssets realRemove =
        new BulkAssets().withAssets(List.of(user.getEntityReference())).withDryRun(false);
    String removePath = "/v1/teams/" + team.getName() + "/assets/remove";
    BulkOperationResult result =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, removePath, realRemove, BulkOperationResult.class);

    assertNotNull(result);
    assertFalse(Boolean.TRUE.equals(result.getDryRun()));
    assertEquals(1, result.getNumberOfRowsPassed());

    User refreshed = client.users().get(user.getId().toString(), "teams");
    assertTrue(
        refreshed.getTeams() == null
            || refreshed.getTeams().stream().noneMatch(t -> team.getId().equals(t.getId())),
        "User should no longer belong to the team when dryRun=false");
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private GlossaryTerm createGlossaryTerm(
      TestNamespace ns, OpenMetadataClient client, String suffix) {
    Glossary glossary =
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(ns.prefix("glossary_" + suffix))
                    .withDescription("Glossary for dryRun remove test"));
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(ns.prefix("term_" + suffix))
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Term for dryRun remove test"));
  }

  private TagLabel toGlossaryTagLabel(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private Domain createDomain(TestNamespace ns, OpenMetadataClient client, String suffix) {
    return client
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix("domain_" + suffix))
                .withDomainType(DomainType.AGGREGATE)
                .withDescription("Domain for dryRun remove test"));
  }

  private DataProduct createDataProduct(
      TestNamespace ns, OpenMetadataClient client, String suffix, Domain domain) {
    return client
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix("dp_" + suffix))
                .withDomains(List.of(domain.getFullyQualifiedName()))
                .withDescription("Data product for dryRun remove test"));
  }

  private Team createTeam(TestNamespace ns, OpenMetadataClient client, String suffix) {
    return client
        .teams()
        .create(
            new CreateTeam()
                .withName(ns.prefix("team_" + suffix))
                .withTeamType(TeamType.GROUP)
                .withDescription("Team for dryRun remove test"));
  }

  private User createUser(TestNamespace ns, OpenMetadataClient client, String suffix) {
    String name = ns.prefix("user_" + suffix);
    return client
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(name + "@test.om.org")
                .withDescription("User for dryRun remove test"));
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

  private Table createTableWithTag(TestNamespace ns, TagLabel tagLabel) throws Exception {
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
                        .withDescription("ID column")))
            .withTags(List.of(tagLabel));

    Table created = SdkClients.adminClient().tables().create(createTable);
    Table fetched = SdkClients.adminClient().tables().get(created.getId().toString(), "tags");
    assertTrue(
        hasTag(fetched, tagLabel.getTagFQN()), "Newly created table should already have the tag");
    return fetched;
  }

  private boolean hasTag(Table table, String tagFqn) {
    return table.getTags() != null
        && table.getTags().stream().anyMatch(t -> tagFqn.equals(t.getTagFQN()));
  }
}
