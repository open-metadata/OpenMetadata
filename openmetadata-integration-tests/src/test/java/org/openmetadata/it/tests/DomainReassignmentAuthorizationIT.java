/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.EntityRulesUtil;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * A domain reassignment must be authorized against the domain the asset is moving <i>into</i>, not
 * only the one it is leaving.
 *
 * <p>Both write paths used to authorize half the move. {@code PATCH /v1/<entity>/{id}} evaluated the
 * stored entity, so {@code hasDomain()} saw the source domain, and saw nothing at all for an asset
 * that had no domain, where it deliberately returns true. {@code PUT /v1/domains/{name}/assets/add}
 * authorized the target domain but never the assets, so a domain's asset picker could pull assets
 * out of domains the caller had no rights over. It now authorizes each asset as its own PATCH, so an
 * asset the caller may not move comes back as a failed row while the others still move.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DomainReassignmentAuthorizationIT {

  /** A user scoped to {@code heldDomain} by a hasDomain()-conditioned grant. */
  record DomainScopedUser(
      User user,
      OpenMetadataClient client,
      Team team,
      Domain heldDomain,
      Domain heldSubDomain,
      Domain otherDomain) {}

  @Test
  void test_patchCannotMoveADomainlessAssetIntoAnUnheldDomain(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, null);

    assertThrows(
        ForbiddenException.class,
        () -> patchDomains(scoped.client(), table, scoped.otherDomain()),
        "A domainless asset must not be movable into a domain the caller does not hold");
  }

  @Test
  void test_patchCannotMoveAnAssetOutOfAHeldDomainIntoAnUnheldOne(TestNamespace ns)
      throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    assertThrows(
        ForbiddenException.class,
        () -> patchDomains(scoped.client(), table, scoped.otherDomain()),
        "An asset must not be pushed into a domain the caller does not hold");
  }

  @Test
  void test_patchCanMoveAnAssetIntoASubDomainOfAHeldDomain(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    patchDomains(scoped.client(), table, scoped.heldSubDomain());

    Table reloaded = SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    assertEquals(
        scoped.heldSubDomain().getId(),
        reloaded.getDomains().getFirst().getId(),
        "Domain hierarchy access must still allow a move into a sub-domain");
  }

  @Test
  void test_bulkAddAssetsCannotPullAnAssetOutOfAnUnheldDomain(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table editable = createTable(ns, null);
    Table unheld = createTable(ns, scoped.otherDomain());

    BulkOperationResult result =
        addAssetsToDomain(scoped.client(), scoped.heldDomain(), editable, unheld);

    assertOnlyFirstAccepted(scoped, result, editable, unheld);
    assertEquals(
        scoped.otherDomain().getId(),
        domainOf(unheld),
        "Adding an asset to your own domain must still require rights over that asset");
  }

  /**
   * Regression for the inherited-domain gap: a table with no domain of its own inherits its schema's
   * domain. If that inherited domain is one the caller does not hold, pulling the table into their
   * own domain must still be denied. Authorization has to resolve inherited domains, not only the
   * ones set directly on the asset.
   */
  @Test
  void test_bulkAddAssetsCannotPullAnAssetThatInheritsAnUnheldDomain(TestNamespace ns)
      throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table editable = createTable(ns, null);
    Table inheriting = createTableInheritingDomain(ns, scoped.otherDomain());
    assertEquals(
        scoped.otherDomain().getId(),
        domainOf(inheriting),
        "precondition: the table should inherit the unheld domain from its schema");

    BulkOperationResult result =
        addAssetsToDomain(scoped.client(), scoped.heldDomain(), editable, inheriting);

    assertOnlyFirstAccepted(scoped, result, editable, inheriting);
    assertEquals(
        scoped.otherDomain().getId(),
        domainOf(inheriting),
        "An asset that inherits a domain the caller does not hold must not be pullable into theirs");
  }

  @Test
  void test_putReassignmentCannotMoveAnAssetIntoAnUnheldDomain(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    assertThrows(
        ForbiddenException.class,
        () -> putTableDomains(scoped.client(), table, scoped.otherDomain()),
        "A PUT reassignment must not move an asset into a domain the caller does not hold");
  }

  @Test
  void test_putReassignmentCanStillMoveWithinAHeldDomain(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    putTableDomains(scoped.client(), table, scoped.heldSubDomain());

    Table reloaded = SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    assertEquals(
        scoped.heldSubDomain().getId(),
        reloaded.getDomains().getFirst().getId(),
        "A PUT must still allow a move within the held domain hierarchy");
  }

  @Test
  void test_dataProductBulkAddCannotPullAnAssetFromAnUnheldDomain(TestNamespace ns)
      throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    DataProduct dataProduct = createDataProduct(ns, scoped.heldDomain());
    Table editable = createTable(ns, scoped.heldDomain());
    Table unheld = createTable(ns, scoped.otherDomain());

    BulkOperationResult result =
        addAssetsToDataProduct(scoped.client(), dataProduct, editable, unheld);

    assertOnlyFirstAccepted(scoped, result, editable, unheld);
    Table reloaded =
        SdkClients.adminClient().tables().get(unheld.getId().toString(), "dataProducts");
    assertTrue(
        listOrEmpty(reloaded.getDataProducts()).stream()
            .noneMatch(product -> dataProduct.getId().equals(product.getId())),
        "Adding an asset from an unheld domain to a data product must be denied per asset");
  }

  /**
   * Blast-radius guard: the extra check must be invisible where no policy carries a domain
   * condition. An owner holds EditAll through OrganizationPolicy-Owner-Rule and must keep being able
   * to set a domain.
   */
  @Test
  void test_ownerWithNoDomainPolicyCanStillSetADomain(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Domain domain = createDomain(ns, "plain", null);
    User owner = createUser(ns, "owner", null);
    OpenMetadataClient ownerClient = clientFor(owner);

    Table table = createTable(ns, null);
    addOwner(tablePath(table), owner);

    patchDomains(ownerClient, table, domain);

    Table reloaded = admin.tables().get(table.getId().toString(), "domains");
    assertEquals(domain.getId(), reloaded.getDomains().getFirst().getId());
  }

  /** An owner of the schema owns its tables, and a PUT must see that owner as a PATCH does. */
  @Test
  void test_inheritedOwnerCanStillPutADomain(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns, "plain", null);
    User owner = createUser(ns, "owner", null);
    DatabaseSchema schema = createSchema(ns);
    addOwner("/v1/databaseSchemas/" + schema.getId(), owner);
    Table table = createTableIn(ns, schema, "owned", null);

    clientFor(owner)
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/tables", tableIn(schema, table, domain), Table.class);

    assertEquals(domain.getId(), domainOf(table));
  }

  /**
   * The target domain is authorized by the id that will be persisted, not the FQN the client sends.
   * A forged reference, an unheld domain's id wearing a held domain's FQN, would otherwise pass
   * {@code hasDomain()} yet be stored under the unheld id, re-opening exactly this bug.
   */
  @Test
  void test_patchCannotForgeAHeldFqnOverAnUnheldDomainId(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    assertThrows(
        ForbiddenException.class,
        () -> patchDomainsForged(scoped.client(), table, scoped.otherDomain(), scoped.heldDomain()),
        "A client-supplied FQN must not override the domain id used for authorization");

    Table reloaded = SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    assertEquals(
        scoped.heldDomain().getId(),
        reloaded.getDomains().getFirst().getId(),
        "The forged move must not have persisted the unheld domain");
  }

  /**
   * An id-only reference (no FQN, common from API clients) must resolve to a clean authorization
   * decision, not an NPE/500 from dereferencing a null FQN. A {@link ForbiddenException} both proves
   * the move is denied and that it did not 500 (which would surface as a different exception).
   */
  @Test
  void test_patchWithIdOnlyDomainReferenceIsDeniedNotCrashed(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    assertThrows(
        ForbiddenException.class,
        () -> patchDomainsIdOnly(scoped.client(), table, scoped.otherDomain()),
        "An id-only move into an unheld domain must be denied cleanly, not 500");
  }

  /** A patch that replaces the whole document names no domains path, yet stores the new domains. */
  @Test
  void test_wholeDocumentPatchCannotMoveAnAssetIntoAnUnheldDomain(TestNamespace ns)
      throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    assertThrows(
        ForbiddenException.class,
        () -> patchWholeDocument(scoped.client(), table, scoped.otherDomain()));
    assertEquals(scoped.heldDomain().getId(), domainOf(table));
  }

  /** The UI diffs its copy of the entity, so a domain change patches the reference field by field. */
  @Test
  void test_uiDomainDiffMovesAnAssetWithinAHeldDomain(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    patchDomainFields(scoped.client(), table, scoped.heldSubDomain());

    assertEquals(scoped.heldSubDomain().getId(), domainOf(table));
  }

  @Test
  void test_uiDomainDiffCannotMoveAnAssetIntoAnUnheldDomain(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    assertThrows(
        ForbiddenException.class,
        () -> patchDomainFields(scoped.client(), table, scoped.otherDomain()));
    assertEquals(scoped.heldDomain().getId(), domainOf(table));
  }

  @Test
  void test_bulkPutMovesOnlyTheAssetsTheCallerMayMove(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    DatabaseSchema schema = createSchema(ns);
    Table movable = createTableIn(ns, schema, "movable", scoped.heldDomain());
    Table unmovable = createTableIn(ns, schema, "unmovable", scoped.heldDomain());

    BulkOperationResult result =
        BulkApi.upsert(
            Entity.TABLE + "s",
            List.of(
                tableIn(schema, movable, scoped.heldSubDomain()),
                tableIn(schema, unmovable, scoped.otherDomain())),
            false,
            tokenFor(scoped.user()));

    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
    assertEquals(scoped.heldSubDomain().getId(), domainOf(movable));
    assertEquals(scoped.heldDomain().getId(), domainOf(unmovable));
  }

  @Test
  void test_csvImportMovesOnlyTheAssetsTheCallerMayMove(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    DatabaseSchema schema = createSchema(ns);
    Table movable = createTableIn(ns, schema, "movable", scoped.heldDomain());
    Table unmovable = createTableIn(ns, schema, "unmovable", scoped.heldDomain());
    String exported =
        SdkClients.adminClient().databaseSchemas().exportCsv(schema.getFullyQualifiedName());
    String csv =
        moveRow(
            moveRow(exported, movable, scoped.heldDomain(), scoped.heldSubDomain()),
            unmovable,
            scoped.heldDomain(),
            scoped.otherDomain());

    CsvImportResult result =
        JsonUtils.readValue(
            scoped.client().databaseSchemas().importCsv(schema.getFullyQualifiedName(), csv, false),
            CsvImportResult.class);

    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus(), result.getImportResultsCsv());
    assertEquals(scoped.heldSubDomain().getId(), domainOf(movable));
    assertEquals(scoped.heldDomain().getId(), domainOf(unmovable));
  }

  /** Two rows for one table in one import: every row's domains are checked, not only the last. */
  @Test
  void test_csvImportChecksEveryRowForTheSameTable(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    DatabaseSchema schema = createSchema(ns);
    Table table = createTableIn(ns, schema, "twice", scoped.heldDomain());
    String exported =
        SdkClients.adminClient().databaseSchemas().exportCsv(schema.getFullyQualifiedName());
    String header = exported.split("\n")[0];
    String held = rowOf(exported, table);
    String moved =
        rowOf(moveRow(exported, table, scoped.heldDomain(), scoped.otherDomain()), table);

    String csv = String.join("\n", header, moved, held) + "\n";

    CsvImportResult dryRun = importSchemaCsv(scoped, schema, csv, true);
    CsvImportResult imported = importSchemaCsv(scoped, schema, csv, false);

    assertEquals(1, imported.getNumberOfRowsFailed(), imported.getImportResultsCsv());
    assertEquals(imported.getNumberOfRowsFailed(), dryRun.getNumberOfRowsFailed());
    assertEquals(Set.of(scoped.heldDomain().getId()), domainIdsOf(table));
  }

  /** The test case endpoint authorizes against the table and saves through the repository. */
  @Test
  void test_testCasePatchCannotMoveATestCaseIntoAnUnheldDomain(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());
    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.shortPrefix("tc"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertThrows(
        ForbiddenException.class,
        () ->
            patchDomainsAt(
                scoped.client(),
                "/v1/dataQuality/testCases/" + testCase.getId(),
                scoped.otherDomain()));
    List<EntityReference> domains =
        SdkClients.adminClient()
            .testCases()
            .get(testCase.getId().toString(), "domains")
            .getDomains();
    assertTrue(
        listOrEmpty(domains).stream()
            .noneMatch(domain -> scoped.otherDomain().getId().equals(domain.getId())));
  }

  /** hasDomain() passes when any domain matches, so each domain a write adds is checked alone. */
  @Test
  @ResourceLock("MULTI_DOMAIN_RULE")
  void test_patchCannotAddAnUnheldDomainBesideAHeldOne(TestNamespace ns) throws Throwable {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    withMultipleDomainsAllowed(
        () ->
            assertRefusedNaming(
                scoped.otherDomain(),
                scoped.heldDomain(),
                () ->
                    patchDomains(
                        scoped.client(), table, scoped.heldDomain(), scoped.otherDomain())));

    assertEquals(Set.of(scoped.heldDomain().getId()), domainIdsOf(table));
  }

  @Test
  @ResourceLock("MULTI_DOMAIN_RULE")
  void test_putCannotAddAnUnheldDomainBesideAHeldOne(TestNamespace ns) throws Throwable {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    withMultipleDomainsAllowed(
        () ->
            assertRefusedNaming(
                scoped.otherDomain(),
                scoped.heldDomain(),
                () ->
                    putTableDomains(
                        scoped.client(), table, scoped.heldDomain(), scoped.otherDomain())));

    assertEquals(Set.of(scoped.heldDomain().getId()), domainIdsOf(table));
  }

  @Test
  @ResourceLock("MULTI_DOMAIN_RULE")
  void test_patchCanAddASubDomainOfAHeldDomainBesideIt(TestNamespace ns) throws Throwable {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, scoped.heldDomain());

    withMultipleDomainsAllowed(
        () -> patchDomains(scoped.client(), table, scoped.heldDomain(), scoped.heldSubDomain()));

    assertEquals(
        Set.of(scoped.heldDomain().getId(), scoped.heldSubDomain().getId()), domainIdsOf(table));
  }

  @Test
  @ResourceLock("MULTI_DOMAIN_RULE")
  void test_dataProductCannotBeGivenAnUnheldDomainBesideAHeldOne(TestNamespace ns)
      throws Throwable {
    DomainScopedUser scoped = domainScopedUser(ns);
    DataProduct dataProduct = createDataProduct(ns, scoped.heldDomain());

    withMultipleDomainsAllowed(
        () ->
            assertRefusedNaming(
                scoped.otherDomain(),
                scoped.heldDomain(),
                () ->
                    patchDomainsAt(
                        scoped.client(),
                        "/v1/dataProducts/" + dataProduct.getId(),
                        scoped.heldDomain(),
                        scoped.otherDomain())));

    DataProduct reloaded =
        SdkClients.adminClient().dataProducts().get(dataProduct.getId().toString(), "domains");
    assertEquals(Set.of(scoped.heldDomain().getId()), idsOf(reloaded.getDomains()));
  }

  /** Queries may hold several domains whatever the entity rules say. */
  @Test
  void test_queryCannotBeGivenAnUnheldDomainBesideAHeldOne(TestNamespace ns) {
    DomainScopedUser scoped = domainScopedUser(ns);
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc_" + ns.uniqueShortId(), ns);
    Query query =
        SdkClients.adminClient()
            .queries()
            .create(
                new CreateQuery()
                    .withName(ns.shortPrefix("query"))
                    .withQuery("SELECT 1 AS " + ns.shortPrefix("col"))
                    .withService(service.getFullyQualifiedName())
                    .withDomains(List.of(scoped.heldDomain().getFullyQualifiedName())));

    assertRefusedNaming(
        scoped.otherDomain(),
        scoped.heldDomain(),
        () ->
            patchDomainsAt(
                scoped.client(),
                "/v1/queries/" + query.getId(),
                scoped.heldDomain(),
                scoped.otherDomain()));

    Query reloaded = SdkClients.adminClient().queries().get(query.getId().toString(), "domains");
    assertEquals(Set.of(scoped.heldDomain().getId()), idsOf(reloaded.getDomains()));
  }

  /**
   * Teams may hold several domains whatever the entity rules say, and every member inherits them. A
   * member who may edit their team must not widen everyone's access with a domain they do not hold.
   */
  @Test
  void test_teamMemberCannotAddAnUnheldDomainToTheirTeam(TestNamespace ns) {
    DomainScopedUser scoped = domainScopedUser(ns);
    String teamPath = "/v1/teams/" + scoped.team().getId();

    assertRefusedNaming(
        scoped.otherDomain(),
        scoped.heldDomain(),
        () -> patchDomainsAt(scoped.client(), teamPath, scoped.heldDomain(), scoped.otherDomain()));

    Team reloaded =
        SdkClients.adminClient().teams().get(scoped.team().getId().toString(), "domains");
    assertEquals(Set.of(scoped.heldDomain().getId()), idsOf(reloaded.getDomains()));
  }

  @Test
  void test_teamMemberCanStillAddASubDomainOfAHeldDomainToTheirTeam(TestNamespace ns) {
    DomainScopedUser scoped = domainScopedUser(ns);

    patchDomainsAt(
        scoped.client(),
        "/v1/teams/" + scoped.team().getId(),
        scoped.heldDomain(),
        scoped.heldSubDomain());

    Team reloaded =
        SdkClients.adminClient().teams().get(scoped.team().getId().toString(), "domains");
    assertEquals(
        Set.of(scoped.heldDomain().getId(), scoped.heldSubDomain().getId()),
        idsOf(reloaded.getDomains()));
  }

  /** A dry run reports the rows the import would refuse, with or without an approval workflow. */
  @Test
  void test_csvDryRunReportsTheMovesTheImportRefuses(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    DatabaseSchema schema = createSchema(ns);
    Table movable = createTableIn(ns, schema, "movable", scoped.heldDomain());
    Table unmovable = createTableIn(ns, schema, "unmovable", scoped.heldDomain());
    String exported =
        SdkClients.adminClient().databaseSchemas().exportCsv(schema.getFullyQualifiedName());
    String csv =
        moveRow(
            moveRow(exported, movable, scoped.heldDomain(), scoped.heldSubDomain()),
            unmovable,
            scoped.heldDomain(),
            scoped.otherDomain());

    CsvImportResult dryRun = importSchemaCsv(scoped, schema, csv, true);

    assertEquals(ApiStatus.PARTIAL_SUCCESS, dryRun.getStatus(), dryRun.getImportResultsCsv());
    assertEquals(1, dryRun.getNumberOfRowsFailed(), dryRun.getImportResultsCsv());
    assertTrue(
        dryRun.getImportResultsCsv().contains(scoped.otherDomain().getFullyQualifiedName()),
        dryRun.getImportResultsCsv());
    assertEquals(scoped.heldDomain().getId(), domainOf(movable), "a dry run stores nothing");

    CsvImportResult imported = importSchemaCsv(scoped, schema, csv, false);

    assertEquals(imported.getStatus(), dryRun.getStatus(), imported.getImportResultsCsv());
    assertEquals(imported.getNumberOfRowsPassed(), dryRun.getNumberOfRowsPassed());
    assertEquals(imported.getNumberOfRowsFailed(), dryRun.getNumberOfRowsFailed());
  }

  static DomainScopedUser domainScopedUser(TestNamespace ns) {
    Domain held = createDomain(ns, "held", null);
    Domain heldSub = createDomain(ns, "heldsub", held.getFullyQualifiedName());
    Domain other = createDomain(ns, "other", null);

    Policy policy = createHasDomainPolicy(ns);
    Role role = createRole(ns, policy);
    Team team = createTeam(ns, role, held);
    User user = createUser(ns, "scoped", team);
    return new DomainScopedUser(user, clientFor(user), team, held, heldSub, other);
  }

  /**
   * Grants everything, but only on assets the caller shares a domain with: the shape the field
   * reports used. Without the fix the target domain is never consulted, so a reassignment out of
   * this scope is allowed.
   */
  private static Policy createHasDomainPolicy(TestNamespace ns) {
    Rule allow =
        new Rule()
            .withName("AllowWithinDomain")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL, MetadataOperation.EDIT_ALL))
            .withEffect(Rule.Effect.ALLOW)
            .withCondition("hasDomain()");
    return ns.trackRoot(
        Entity.POLICY,
        SdkClients.adminClient()
            .policies()
            .create(new CreatePolicy().withName(ns.shortPrefix("pol")).withRules(List.of(allow))));
  }

  private static Domain createDomain(TestNamespace ns, String suffix, String parentFqn) {
    CreateDomain create =
        new CreateDomain()
            .withName(ns.shortPrefix(suffix))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Domain " + suffix);
    if (parentFqn != null) {
      create.withParent(parentFqn);
    }
    return ns.trackRoot(Entity.DOMAIN, SdkClients.adminClient().domains().create(create));
  }

  private static Role createRole(TestNamespace ns, Policy policy) {
    return ns.trackRoot(
        Entity.ROLE,
        SdkClients.adminClient()
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.shortPrefix("role"))
                    .withPolicies(List.of(policy.getFullyQualifiedName()))));
  }

  private static Team createTeam(TestNamespace ns, Role role, Domain domain) {
    return ns.trackRoot(
        Entity.TEAM,
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.shortPrefix("team"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withDefaultRoles(List.of(role.getId()))
                    .withDomains(List.of(domain.getFullyQualifiedName()))));
  }

  private static User createUser(TestNamespace ns, String suffix, Team team) {
    CreateUser create =
        new CreateUser()
            .withName(ns.shortPrefix(suffix))
            .withEmail(ns.shortPrefix(suffix) + "@test.openmetadata.org");
    if (team != null) {
      create.withTeams(List.of(team.getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(create));
  }

  private static OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  static Table createTable(TestNamespace ns, Domain domain) throws Exception {
    return createTableIn(ns, createSchema(ns), "tbl", domain);
  }

  // Short names keep a test case's suite FQN, which nests the table's, within its column limit.
  private static DatabaseSchema createSchema(TestNamespace ns) {
    String id = ns.uniqueShortId();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("svc_" + id, ns);
    return DatabaseSchemaTestFactory.createSimpleWithName("s_" + id, ns, service);
  }

  private static Table createTableIn(
      TestNamespace ns, DatabaseSchema schema, String suffix, Domain domain) {
    CreateTable create = tableIn(schema, ns.shortPrefix(suffix), domain);
    return SdkClients.adminClient().tables().create(create);
  }

  private static CreateTable tableIn(DatabaseSchema schema, Table table, Domain domain) {
    return tableIn(schema, table.getName(), domain);
  }

  private static CreateTable tableIn(DatabaseSchema schema, String name, Domain domain) {
    CreateTable create =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
    if (domain != null) {
      create.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    return create;
  }

  /** The exported CSV with {@code table}'s row moved from domain {@code from} to {@code to}. */
  private static String moveRow(String csv, Table table, Domain from, Domain to) {
    List<String> lines = new ArrayList<>();
    for (String line : csv.split("\n")) {
      lines.add(
          line.startsWith(table.getName() + ",")
              ? line.replace(from.getFullyQualifiedName(), to.getFullyQualifiedName())
              : line);
    }
    return String.join("\n", lines) + "\n";
  }

  private static String rowOf(String csv, Table table) {
    String row = null;
    for (String line : csv.split("\n")) {
      row = line.startsWith(table.getName() + ",") ? line : row;
    }
    return row;
  }

  private static String tokenFor(User user) {
    return JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 3600);
  }

  /** A table with no domain of its own, under a schema placed in {@code schemaDomain} so it inherits it. */
  private static Table createTableInheritingDomain(TestNamespace ns, Domain schemaDomain)
      throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    patchDomainsAt(SdkClients.adminClient(), "/v1/databaseSchemas/" + schema.getId(), schemaDomain);
    CreateTable create =
        new CreateTable()
            .withName(ns.shortPrefix("tbl"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
    return SdkClients.adminClient().tables().create(create);
  }

  static void patchDomains(OpenMetadataClient client, Table table, Domain... targets) {
    patchDomainsAt(client, tablePath(table), targets);
  }

  private static void patchDomainsAt(OpenMetadataClient client, String path, Domain... targets) {
    List<EntityReference> references = new ArrayList<>();
    for (Domain target : targets) {
      references.add(domainReference(target.getId(), target.getFullyQualifiedName()));
    }
    patch(client, path, addPatch("/domains", references));
  }

  /** Patches a table's domain to {@code idDomain}'s id but {@code fqnDomain}'s FQN (a forgery). */
  private static void patchDomainsForged(
      OpenMetadataClient client, Table table, Domain idDomain, Domain fqnDomain) {
    patch(
        client,
        tablePath(table),
        addPatch(
            "/domains",
            List.of(domainReference(idDomain.getId(), fqnDomain.getFullyQualifiedName()))));
  }

  /** Patches a table's domain with an id-only reference (no FQN), as many API clients send. */
  private static void patchDomainsIdOnly(OpenMetadataClient client, Table table, Domain target) {
    patch(
        client,
        tablePath(table),
        addPatch("/domains", List.of(domainReference(target.getId(), null))));
  }

  /** Replaces the whole stored document with the table as read, carrying {@code target}. */
  static void patchWholeDocument(OpenMetadataClient client, Table table, Domain target) {
    Table replacement = client.tables().get(table.getId().toString(), "domains");
    replacement.setDomains(List.of(target.getEntityReference()));
    patch(
        client,
        tablePath(table),
        String.format(
            "[{\"op\":\"replace\",\"path\":\"\",\"value\":%s}]",
            JsonUtils.pojoToJson(replacement)));
  }

  /** The diff the UI sends: the stored reference's fields replaced one by one, href dropped. */
  private static void patchDomainFields(OpenMetadataClient client, Table table, Domain target) {
    patch(
        client,
        tablePath(table),
        String.format(
            "[{\"op\":\"remove\",\"path\":\"/domains/0/href\"},"
                + "{\"op\":\"replace\",\"path\":\"/domains/0/fullyQualifiedName\",\"value\":\"%s\"},"
                + "{\"op\":\"replace\",\"path\":\"/domains/0/name\",\"value\":\"%s\"},"
                + "{\"op\":\"replace\",\"path\":\"/domains/0/id\",\"value\":\"%s\"}]",
            target.getFullyQualifiedName(), target.getName(), target.getId()));
  }

  private static void addOwner(String path, User owner) {
    patch(
        SdkClients.adminClient(),
        path,
        addPatch(
            "/owners", List.of(new EntityReference().withId(owner.getId()).withType(Entity.USER))));
  }

  /** Sends {@code operations}, a JSON Patch document, to {@code path} as {@code client}. */
  private static void patch(OpenMetadataClient client, String path, String operations) {
    client.getHttpClient().executeForString(HttpMethod.PATCH, path, operations, jsonPatchOptions());
  }

  private static String addPatch(String field, List<EntityReference> references) {
    return String.format(
        "[{\"op\":\"add\",\"path\":\"%s\",\"value\":%s}]", field, JsonUtils.pojoToJson(references));
  }

  private static EntityReference domainReference(UUID id, String fullyQualifiedName) {
    return new EntityReference()
        .withId(id)
        .withType(Entity.DOMAIN)
        .withFullyQualifiedName(fullyQualifiedName);
  }

  private static String tablePath(Table table) {
    return "/v1/tables/" + table.getId();
  }

  private static BulkOperationResult addAssetsToDomain(
      OpenMetadataClient client, Domain domain, Table... tables) {
    return addAssets(
        client, "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/add", tables);
  }

  private static BulkOperationResult addAssets(
      OpenMetadataClient client, String path, Table... tables) {
    List<EntityReference> assets = new ArrayList<>();
    for (Table table : tables) {
      assets.add(table.getEntityReference());
    }
    BulkAssets request = new BulkAssets().withAssets(assets).withDryRun(false);
    return client.getHttpClient().execute(HttpMethod.PUT, path, request, BulkOperationResult.class);
  }

  /** The first table is accepted; the second comes back as a failed row naming the caller. */
  private static void assertOnlyFirstAccepted(
      DomainScopedUser scoped, BulkOperationResult result, Table accepted, Table refused) {
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
    assertEquals(List.of(accepted.getId()), requestIds(result.getSuccessRequest()));
    assertEquals(List.of(refused.getId()), requestIds(result.getFailedRequest()));
    String message = result.getFailedRequest().getFirst().getMessage();
    assertTrue(message.contains(scoped.user().getName()), message);
  }

  private static List<UUID> requestIds(List<BulkResponse> responses) {
    List<UUID> ids = new ArrayList<>();
    for (BulkResponse response : listOrEmpty(responses)) {
      ids.add(JsonUtils.convertValue(response.getRequest(), EntityReference.class).getId());
    }
    return ids;
  }

  static UUID domainOf(Table table) {
    Table reloaded = SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    return reloaded.getDomains().getFirst().getId();
  }

  /** Reassigns the domain through the PUT create-or-update path rather than a JSON patch. */
  private static void putTableDomains(OpenMetadataClient client, Table table, Domain... targets) {
    List<String> domains = new ArrayList<>();
    for (Domain target : targets) {
      domains.add(target.getFullyQualifiedName());
    }
    CreateTable update =
        new CreateTable()
            .withName(table.getName())
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(table.getColumns())
            .withDomains(domains);
    client.getHttpClient().execute(HttpMethod.PUT, "/v1/tables", update, Table.class);
  }

  private static DataProduct createDataProduct(TestNamespace ns, Domain domain) {
    return ns.trackRoot(
        Entity.DATA_PRODUCT,
        SdkClients.adminClient()
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(ns.shortPrefix("dp"))
                    .withDescription("Data product in " + domain.getName())
                    .withDomains(List.of(domain.getFullyQualifiedName()))));
  }

  private static BulkOperationResult addAssetsToDataProduct(
      OpenMetadataClient client, DataProduct dataProduct, Table... tables) {
    return addAssets(
        client, "/v1/dataProducts/" + dataProduct.getFullyQualifiedName() + "/assets/add", tables);
  }

  private static RequestOptions jsonPatchOptions() {
    return RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();
  }

  /** Runs {@code body} with the "Multiple Domains are not allowed" rule off, then restores it. */
  private static void withMultipleDomainsAllowed(Executable body) throws Throwable {
    OpenMetadataClient admin = SdkClients.adminClient();
    boolean ruleWasEnabled = EntityRulesUtil.isMultiDomainRuleEnabled(admin);
    EntityRulesUtil.toggleMultiDomainRule(admin, false);
    try {
      body.execute();
    } finally {
      EntityRulesUtil.toggleMultiDomainRule(admin, ruleWasEnabled);
    }
  }

  /** The write is refused, and the refusal names the domain it may not add, not the held one. */
  private static void assertRefusedNaming(Domain refused, Domain held, Executable write) {
    String message = assertThrows(ForbiddenException.class, write).getMessage();
    assertTrue(message.contains(refused.getFullyQualifiedName()), message);
    assertFalse(message.contains(held.getFullyQualifiedName()), message);
  }

  private static CsvImportResult importSchemaCsv(
      DomainScopedUser scoped, DatabaseSchema schema, String csv, boolean dryRun) {
    return JsonUtils.readValue(
        scoped.client().databaseSchemas().importCsv(schema.getFullyQualifiedName(), csv, dryRun),
        CsvImportResult.class);
  }

  private static Set<UUID> domainIdsOf(Table table) {
    return idsOf(
        SdkClients.adminClient().tables().get(table.getId().toString(), "domains").getDomains());
  }

  private static Set<UUID> idsOf(List<EntityReference> references) {
    return listOrEmpty(references).stream().map(EntityReference::getId).collect(Collectors.toSet());
  }
}
