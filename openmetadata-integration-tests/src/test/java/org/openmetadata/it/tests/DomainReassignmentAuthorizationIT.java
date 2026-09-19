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
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
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
 * out of domains the caller had no rights over.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DomainReassignmentAuthorizationIT {

  /** A user scoped to {@code heldDomain} by a hasDomain()-conditioned grant. */
  private record DomainScopedUser(
      OpenMetadataClient client, Domain heldDomain, Domain heldSubDomain, Domain otherDomain) {}

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
    Table table = createTable(ns, scoped.otherDomain());

    assertThrows(
        ForbiddenException.class,
        () -> addAssetToDomain(scoped.client(), scoped.heldDomain(), table),
        "Adding an asset to your own domain must still require rights over that asset");
  }

  @Test
  void test_bulkAddAssetsStillAcceptsAnAssetTheCallerMayEdit(TestNamespace ns) throws Exception {
    DomainScopedUser scoped = domainScopedUser(ns);
    Table table = createTable(ns, null);

    BulkOperationResult result = addAssetToDomain(scoped.client(), scoped.heldDomain(), table);

    assertEquals(
        1,
        result.getNumberOfRowsPassed(),
        "A domain-scoped user must still be able to claim an asset they may edit");
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

  private DomainScopedUser domainScopedUser(TestNamespace ns) {
    Domain held = createDomain(ns, "held", null);
    Domain heldSub = createDomain(ns, "heldsub", held.getFullyQualifiedName());
    Domain other = createDomain(ns, "other", null);

    Policy policy = createHasDomainPolicy(ns);
    Role role = createRole(ns, policy);
    Team team = createTeam(ns, role, held);
    User user = createUser(ns, "scoped", team);
    return new DomainScopedUser(clientFor(user), held, heldSub, other);
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

  private BulkOperationResult addAssetToDomain(
      OpenMetadataClient client, Domain domain, Table table) {
    BulkAssets request =
        new BulkAssets().withAssets(List.of(table.getEntityReference())).withDryRun(false);
    return client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/domains/" + domain.getFullyQualifiedName() + "/assets/add",
            request,
            BulkOperationResult.class);
  }

  private static RequestOptions jsonPatchOptions() {
    return RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();
  }
}
