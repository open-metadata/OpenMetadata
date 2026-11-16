package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * GET /metadata/types/name/{entityType}?fields=customProperties authorizes ViewCustomFields on the
 * entity type, where no asset exists. A deny whose condition reads the asset (matchTeam(),
 * isOwner(), ...) must not refuse it (#37759); unconditional and subject-only denies still must.
 * ADR:2026-11-16-entity-type-reads-skip-deny-rules-whose-condition-reads-the-asset
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

  @Test
  void conditionalTeamDeny_doesNotBlockTypeCustomProperties(TestNamespace ns) throws Exception {
    Rule deny =
        new Rule()
            .withName(ns.shortPrefix() + "cpTeamDeny")
            .withResources(List.of(DATA_PRODUCT))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY)
            .withCondition("!matchTeam()");
    OpenMetadataClient client = clientForPrincipalWithRules(ns, "cpteam", List.of(deny));

    Type type = getTypeWithCustomProperties(client);

    assertEquals(DATA_PRODUCT, type.getName());
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
  void subjectOnlyDeny_stillBlocksTypeCustomProperties(TestNamespace ns) {
    Rule deny =
        new Rule()
            .withName(ns.shortPrefix() + "cpOrgDeny")
            .withResources(List.of(DATA_PRODUCT))
            .withOperations(List.of(MetadataOperation.VIEW_CUSTOM_FIELDS))
            .withEffect(Rule.Effect.DENY)
            .withCondition("inAnyTeam('Organization')");
    OpenMetadataClient client = clientForPrincipalWithRules(ns, "cporg", List.of(deny));

    assertThrows(ForbiddenException.class, () -> getTypeWithCustomProperties(client));
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

  private OpenMetadataClient clientForPrincipalWithRules(
      TestNamespace ns, String label, List<Rule> rules) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String p = ns.shortPrefix() + label;

    Policy policy =
        admin.policies().create(new CreatePolicy().withName(p + "_pol").withRules(rules));
    fixtureCleanups.push(() -> admin.policies().delete(policy.getId()));

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
