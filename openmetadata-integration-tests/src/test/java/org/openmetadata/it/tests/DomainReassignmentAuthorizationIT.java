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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * A domain reassignment must be authorized against the domain the asset is moving <i>into</i>, not
 * only the one it is leaving.
 *
 * <p>Both write paths used to authorize half the move. {@code PATCH /v1/<entity>/{id}} evaluated the
 * stored entity, so {@code hasDomain()} saw the source domain — and saw nothing at all for an asset
 * that had no domain, where it deliberately returns true. {@code PUT /v1/domains/{name}/assets/add}
 * authorized the target domain but never the assets, so a domain's asset picker could pull assets
 * out of domains the caller had no rights over. It now authorizes each asset as its own PATCH, so an
 * asset the caller may not move comes back as a failed row while the others still move.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DomainReassignmentAuthorizationIT {

  /** A user scoped to {@code heldDomain} by a hasDomain()-conditioned grant. */
  private record DomainScopedUser(
      User user,
      OpenMetadataClient client,
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
        reloaded.getDomains().get(0).getId(),
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
        reloaded.getDomains().get(0).getId(),
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
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/tables/" + table.getId(),
            String.format(
                "[{\"op\":\"add\",\"path\":\"/owners\",\"value\":[{\"id\":\"%s\",\"type\":\"user\"}]}]",
                owner.getId()),
            jsonPatchOptions());

    patchDomains(ownerClient, table, domain);

    Table reloaded = admin.tables().get(table.getId().toString(), "domains");
    assertEquals(domain.getId(), reloaded.getDomains().get(0).getId());
  }

  /**
   * The target domain is authorized by the id that will be persisted, not the FQN the client sends.
   * A forged reference — an unheld domain's id wearing a held domain's FQN — would otherwise pass
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
        reloaded.getDomains().get(0).getId(),
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

  private DomainScopedUser domainScopedUser(TestNamespace ns) {
    Domain held = createDomain(ns, "held", null);
    Domain heldSub = createDomain(ns, "heldsub", held.getFullyQualifiedName());
    Domain other = createDomain(ns, "other", null);

    Policy policy = createHasDomainPolicy(ns);
    Role role = createRole(ns, policy);
    Team team = createTeam(ns, role, held);
    User user = createUser(ns, "scoped", team);
    return new DomainScopedUser(user, clientFor(user), held, heldSub, other);
  }

  /**
   * Grants everything, but only on assets the caller shares a domain with — the shape the field
   * reports used. Without the fix the target domain is never consulted, so a reassignment out of
   * this scope is allowed.
   */
  private Policy createHasDomainPolicy(TestNamespace ns) {
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

  private Domain createDomain(TestNamespace ns, String suffix, String parentFqn) {
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

  private Role createRole(TestNamespace ns, Policy policy) {
    return ns.trackRoot(
        Entity.ROLE,
        SdkClients.adminClient()
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.shortPrefix("role"))
                    .withPolicies(List.of(policy.getFullyQualifiedName()))));
  }

  private Team createTeam(TestNamespace ns, Role role, Domain domain) {
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

  private User createUser(TestNamespace ns, String suffix, Team team) {
    CreateUser create =
        new CreateUser()
            .withName(ns.shortPrefix(suffix))
            .withEmail(ns.shortPrefix(suffix) + "@test.openmetadata.org");
    if (team != null) {
      create.withTeams(List.of(team.getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(create));
  }

  private OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private Table createTable(TestNamespace ns, Domain domain) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    CreateTable create =
        new CreateTable()
            .withName(ns.shortPrefix("tbl"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
    if (domain != null) {
      create.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    return SdkClients.adminClient().tables().create(create);
  }

  /** A table with no domain of its own, under a schema placed in {@code schemaDomain} so it inherits it. */
  private Table createTableInheritingDomain(TestNamespace ns, Domain schemaDomain)
      throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/databaseSchemas/" + schema.getId(),
            String.format(
                "[{\"op\":\"add\",\"path\":\"/domains\",\"value\":[{\"id\":\"%s\",\"type\":\"domain\",\"fullyQualifiedName\":\"%s\"}]}]",
                schemaDomain.getId(), schemaDomain.getFullyQualifiedName()),
            jsonPatchOptions());
    CreateTable create =
        new CreateTable()
            .withName(ns.shortPrefix("tbl"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
    return SdkClients.adminClient().tables().create(create);
  }

  private void patchDomains(OpenMetadataClient client, Table table, Domain target) {
    String patch =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/domains\",\"value\":[{\"id\":\"%s\",\"type\":\"domain\",\"fullyQualifiedName\":\"%s\"}]}]",
            target.getId(), target.getFullyQualifiedName());
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH, "/v1/tables/" + table.getId(), patch, jsonPatchOptions());
  }

  /** Patches a table's domain to {@code idDomain}'s id but {@code fqnDomain}'s FQN (a forgery). */
  private void patchDomainsForged(
      OpenMetadataClient client, Table table, Domain idDomain, Domain fqnDomain) {
    String patch =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/domains\",\"value\":[{\"id\":\"%s\",\"type\":\"domain\",\"fullyQualifiedName\":\"%s\"}]}]",
            idDomain.getId(), fqnDomain.getFullyQualifiedName());
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH, "/v1/tables/" + table.getId(), patch, jsonPatchOptions());
  }

  /** Patches a table's domain with an id-only reference (no FQN), as many API clients send. */
  private void patchDomainsIdOnly(OpenMetadataClient client, Table table, Domain target) {
    String patch =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/domains\",\"value\":[{\"id\":\"%s\",\"type\":\"domain\"}]}]",
            target.getId());
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH, "/v1/tables/" + table.getId(), patch, jsonPatchOptions());
  }

  private BulkOperationResult addAssetsToDomain(
      OpenMetadataClient client, Domain domain, Table... tables) {
    return addAssets(
        client, "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/add", tables);
  }

  private BulkOperationResult addAssets(OpenMetadataClient client, String path, Table... tables) {
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

  private static UUID domainOf(Table table) {
    Table reloaded = SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    return reloaded.getDomains().getFirst().getId();
  }

  /** Reassigns the domain through the PUT create-or-update path rather than a JSON patch. */
  private void putTableDomains(OpenMetadataClient client, Table table, Domain target) {
    CreateTable update =
        new CreateTable()
            .withName(table.getName())
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(table.getColumns())
            .withDomains(List.of(target.getFullyQualifiedName()));
    client.getHttpClient().execute(HttpMethod.PUT, "/v1/tables", update, Table.class);
  }

  private DataProduct createDataProduct(TestNamespace ns, Domain domain) {
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

  private BulkOperationResult addAssetsToDataProduct(
      OpenMetadataClient client, DataProduct dataProduct, Table... tables) {
    return addAssets(
        client, "/v1/dataProducts/" + dataProduct.getFullyQualifiedName() + "/assets/add", tables);
  }

  private static RequestOptions jsonPatchOptions() {
    return RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();
  }
}
