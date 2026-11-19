package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * GET /metadata/types/name/{entityType}?fields=customProperties authorizes ViewCustomFields on the
 * entity type, where no asset exists. A conditional deny (e.g. !matchTeam()) must not refuse it
 * (#37759), while it keeps guarding the assets themselves; an unconditional deny still refuses it.
 * ADR:2026-11-16-entity-type-reads-skip-conditional-deny-rules
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class TypeCustomPropertiesPermissionIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String DATA_PRODUCT = "dataProduct";

  private final Deque<Runnable> fixtureCleanups = new ArrayDeque<>();

  @AfterEach
  void removeFixtures() {
    while (!fixtureCleanups.isEmpty()) {
      try {
        fixtureCleanups.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown: a cleanup failure must not mask the assertion result.
      }
    }
  }

  /**
   * The reported setup: the !matchTeam() deny sits on the user's team (matchTeam() is only ever
   * true for a team policy) and the team owns the data product.
   */
  @Test
  void teamScopedMatchTeamDeny_allowsTypeCustomProperties_andStillGuardsOtherTeamsAssets(
      TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String p = ns.shortPrefix();
    Rule deny =
        new Rule()
            .withName(p + "cpTeamDeny")
            .withResources(List.of(DATA_PRODUCT))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY)
            .withCondition("!matchTeam()");
    Policy policy = createPolicy(p + "cpteam_pol", List.of(deny));
    Team ownTeam = createTeam(p + "cpteam_own", List.of(policy.getId()));
    Team otherTeam = createTeam(p + "cpteam_other", List.of());
    String email = p + "cpteam_u@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(p + "cpteam_u")
                    .withEmail(email)
                    .withTeams(List.of(ownTeam.getId())));
    fixtureCleanups.push(() -> admin.users().delete(user.getId()));
    Domain domain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(p + "cpteam_dom")
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("Custom property permission"));
    fixtureCleanups.push(() -> admin.domains().delete(domain.getId()));
    DataProduct ownProduct = createDataProduct(p + "cpteam_own_dp", domain, ownTeam);
    DataProduct otherProduct = createDataProduct(p + "cpteam_other_dp", domain, otherTeam);
    OpenMetadataClient client = SdkClients.createClient(email, email, new String[] {});

    assertEquals(DATA_PRODUCT, getTypeWithCustomProperties(client).getName());
    assertEquals(
        ownProduct.getId(),
        client.dataProducts().get(ownProduct.getId().toString(), "extension").getId());
    assertThrows(
        ForbiddenException.class,
        () -> client.dataProducts().get(otherProduct.getId().toString(), "extension"),
        "the deny still applies to a data product owned by another team");
  }

  @Test
  void unconditionalViewCustomFieldsDeny_blocksTypeCustomProperties(TestNamespace ns) {
    Rule deny =
        new Rule()
            .withName(ns.shortPrefix() + "cpFieldsDeny")
            .withResources(List.of(DATA_PRODUCT))
            .withOperations(List.of(MetadataOperation.VIEW_CUSTOM_FIELDS))
            .withEffect(Rule.Effect.DENY);
    OpenMetadataClient client = clientForPrincipalWithRules(ns, "cpfields", List.of(deny));

    assertThrows(ForbiddenException.class, () -> getTypeWithCustomProperties(client));
  }

  @Test
  void conditionalDeny_isSkippedForTypeCustomProperties(TestNamespace ns) throws Exception {
    Rule deny =
        new Rule()
            .withName(ns.shortPrefix() + "cpOrgDeny")
            .withResources(List.of(DATA_PRODUCT))
            .withOperations(List.of(MetadataOperation.VIEW_CUSTOM_FIELDS))
            .withEffect(Rule.Effect.DENY)
            .withCondition("inAnyTeam('Organization')");
    OpenMetadataClient client = clientForPrincipalWithRules(ns, "cporg", List.of(deny));

    assertEquals(DATA_PRODUCT, getTypeWithCustomProperties(client).getName());
  }

  private static Type getTypeWithCustomProperties(OpenMetadataClient client) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types/name/" + DATA_PRODUCT + "?fields=customProperties",
                null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }

  private Policy createPolicy(String name, List<Rule> rules) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy = admin.policies().create(new CreatePolicy().withName(name).withRules(rules));
    fixtureCleanups.push(() -> admin.policies().delete(policy.getId()));
    return policy;
  }

  private Team createTeam(String name, List<UUID> policyIds) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(name)
                    .withTeamType(TeamType.GROUP)
                    .withPolicies(policyIds));
    fixtureCleanups.push(() -> admin.teams().delete(team.getId()));
    return team;
  }

  private DataProduct createDataProduct(String name, Domain domain, Team owner) {
    OpenMetadataClient admin = SdkClients.adminClient();
    DataProduct dataProduct =
        admin
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(name)
                    .withDescription("Custom property permission")
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withOwners(List.of(owner.getEntityReference())));
    fixtureCleanups.push(() -> admin.dataProducts().delete(dataProduct.getId()));
    return dataProduct;
  }

  private OpenMetadataClient clientForPrincipalWithRules(
      TestNamespace ns, String label, List<Rule> rules) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String p = ns.shortPrefix() + label;

    Policy policy = createPolicy(p + "_pol", rules);

    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(p + "_role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    fixtureCleanups.push(() -> admin.roles().delete(role.getId()));

    String email = p + "_u@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(p + "_u")
                    .withEmail(email)
                    .withRoles(List.of(role.getId())));
    fixtureCleanups.push(() -> admin.users().delete(user.getId()));

    return SdkClients.createClient(email, email, new String[] {});
  }
}
