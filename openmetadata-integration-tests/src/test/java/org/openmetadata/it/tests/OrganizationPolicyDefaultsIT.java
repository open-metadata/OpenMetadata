package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * The default Organization Policy lets anyone set the owner of a data asset that has no owner, and
 * keeps the owner of a policy from changing or deleting it.
 * ADR:2026-11-09-only-data-assets-can-be-claimed-by-default
 */
@ExtendWith(TestNamespaceExtension.class)
class OrganizationPolicyDefaultsIT {

  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  @Test
  void aUserWithTheDefaultRolesSetsThemselvesOwnerOfAnUnownedDataAsset(TestNamespace ns) {
    final User user = UserTestFactory.createUser(ns, "assetUser");
    final HttpClient asUser = clientFor(user);
    final Table table = ShortStackFactory.table(ns);

    setOwner(asUser, "/v1/tables/" + table.getId(), user);
    setOwner(asUser, "/v1/topics/" + TopicTestFactory.createSimple(ns).getId(), user);
    setOwner(asUser, "/v1/databaseSchemas/" + table.getDatabaseSchema().getId(), user);
  }

  @Test
  void aUserWithTheDefaultRolesCannotSetThemselvesOwnerOfOtherUnownedItems(TestNamespace ns) {
    final User user = UserTestFactory.createUser(ns, "itemUser");
    final HttpClient asUser = clientFor(user);
    final List<String> paths =
        List.of(
            "/v1/glossaries/" + GlossaryTestFactory.createSimple(ns).getId(),
            "/v1/classifications/" + classification(ns).getId(),
            "/v1/services/databaseServices/"
                + DatabaseServiceTestFactory.createPostgres(ns).getId(),
            "/v1/policies/" + policy(ns, null).getId(),
            "/v1/teams/" + team(ns).getId());

    for (String path : paths) {
      assertEquals(403, failureOf(() -> setOwner(asUser, path, user)), path);
    }
  }

  @Test
  void theOwnerOfAPolicyCannotChangeOrDeleteIt(TestNamespace ns) {
    final User user = UserTestFactory.createUser(ns, "policyOwner");
    final HttpClient asOwner = clientFor(user);
    final Policy policy = policy(ns, user);
    final String path = "/v1/policies/" + policy.getId();
    final String describe =
        JsonUtils.pojoToJson(
            List.of(Map.of("op", "add", "path", "/description", "value", "Changed by its owner")));

    assertEquals(
        403,
        failureOf(() -> asOwner.executeForString(HttpMethod.PATCH, path, describe, JSON_PATCH)));
    assertEquals(
        403,
        failureOf(
            () ->
                asOwner.execute(
                    HttpMethod.PUT,
                    "/v1/policies",
                    createPolicy(ns.prefix("ownedPolicy"), user).withDescription("Changed"),
                    Policy.class)));
    assertEquals(403, failureOf(() -> asOwner.executeForString(HttpMethod.DELETE, path, null)));

    admin().executeForString(HttpMethod.PATCH, path, describe, JSON_PATCH);
  }

  @Test
  void aDataStewardStillAssignsOwnersOnItemsThatCannotBeClaimed(TestNamespace ns) {
    final User user = UserTestFactory.createUser(ns, "assignedOwner");
    final String path = "/v1/glossaries/" + GlossaryTestFactory.createSimple(ns).getId();

    setOwner(dataSteward(ns), path, user);
  }

  private static void setOwner(final HttpClient client, final String path, final User owner) {
    final Map<String, Object> reference = Map.of("id", owner.getId().toString(), "type", "user");
    final String patch =
        JsonUtils.pojoToJson(
            List.of(Map.of("op", "add", "path", "/owners", "value", List.of(reference))));
    client.executeForString(HttpMethod.PATCH, path, patch, JSON_PATCH);
  }

  private static int failureOf(final Executable request) {
    return assertThrows(OpenMetadataException.class, request).getStatusCode();
  }

  private static Classification classification(final TestNamespace ns) {
    final CreateClassification create =
        new CreateClassification()
            .withName(ns.prefix("classification"))
            .withDescription("A classification nobody owns");
    return ns.trackRoot(
        Entity.CLASSIFICATION,
        admin().execute(HttpMethod.POST, "/v1/classifications", create, Classification.class));
  }

  private static Team team(final TestNamespace ns) {
    final CreateTeam create =
        new CreateTeam().withName(ns.prefix("team")).withTeamType(CreateTeam.TeamType.GROUP);
    return ns.trackRoot(
        Entity.TEAM, admin().execute(HttpMethod.POST, "/v1/teams", create, Team.class));
  }

  private static Policy policy(final TestNamespace ns, final User owner) {
    return ns.trackRoot(
        Entity.POLICY,
        admin()
            .execute(
                HttpMethod.POST,
                "/v1/policies",
                createPolicy(ns.prefix("ownedPolicy"), owner),
                Policy.class));
  }

  private static CreatePolicy createPolicy(final String name, final User owner) {
    final Rule rule =
        new Rule()
            .withName(name + "-rule")
            .withEffect(Rule.Effect.ALLOW)
            .withResources(List.of("table"))
            .withOperations(List.of(MetadataOperation.VIEW_BASIC));
    final CreatePolicy create = new CreatePolicy().withName(name).withRules(List.of(rule));
    return owner == null ? create : create.withOwners(List.of(owner.getEntityReference()));
  }

  /** A user of its own with the seeded DataSteward role. */
  private static HttpClient dataSteward(final TestNamespace ns) {
    final String name = "steward_" + UUID.randomUUID().toString().substring(0, 8);
    final CreateUser create =
        new CreateUser()
            .withName(name)
            .withEmail(name + "@test.om.org")
            .withRoles(List.of(SdkClients.adminClient().roles().getByName("DataSteward").getId()));
    final User steward = ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(create));
    return clientFor(steward);
  }

  private static HttpClient clientFor(final User user) {
    return SdkClients.createClient(user.getName(), user.getEmail(), new String[] {})
        .getHttpClient();
  }

  private static HttpClient admin() {
    return SdkClients.adminClient().getHttpClient();
  }
}
