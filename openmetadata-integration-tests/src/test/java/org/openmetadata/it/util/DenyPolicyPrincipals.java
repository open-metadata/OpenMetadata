package org.openmetadata.it.util;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * Builds a principal that is genuinely denied one operation on one resource, for negative-authz
 * tests.
 *
 * <p>Needed because the data-consumer client is NOT denied: DataConsumerPolicy grants ViewAll and
 * EditDescription on resource "all", and the default organization policy grants broad view access
 * even to a user with no role. An expected 403 from either principal would never arrive.
 *
 * <p>Wiring copied from TaskPermissionsIT (policy to role to team to user). The rule is
 * deliberately different: that file's deny is conditional on isTaskFiler(); this one is
 * unconditional, because there is no case in which the denied principal should succeed.
 */
public final class DenyPolicyPrincipals {

  private DenyPolicyPrincipals() {}

  /**
   * Returns a client denied {@code operation} on {@code resource}, unconditionally.
   *
   * <p>When the denied operation is not itself a read, the policy also grants ViewAll so the
   * principal can still see the entity. Without that grant a test cannot tell a denied write from a
   * denied read: both surface as 403 on the same call.
   */
  public static OpenMetadataClient clientDenied(
      String uniquePrefix, String resource, MetadataOperation operation) {
    return clientDeniedWhen(uniquePrefix, resource, operation, null);
  }

  public static OpenMetadataClient clientDenied(
      final TestNamespace namespace, final String resource, final MetadataOperation operation) {
    return clientDeniedWhen(namespace, resource, operation, null);
  }

  /**
   * Same as {@link #clientDenied} but the deny only applies where the policy {@code condition}
   * holds, e.g. {@code matchAnyTag('PII.Sensitive')}. Proves that an endpoint resolves the actual
   * entity before evaluating, since a condition never matches without one.
   */
  public static OpenMetadataClient clientDeniedWhen(
      String uniquePrefix, String resource, MetadataOperation operation, String condition) {
    return clientFor(userDeniedWhen(uniquePrefix, resource, operation, condition));
  }

  /** Creates a denied principal whose fixtures are removed by the test namespace. */
  public static OpenMetadataClient clientDeniedWhen(
      final TestNamespace namespace,
      final String resource,
      final MetadataOperation operation,
      final String condition) {
    final User denied =
        userDeniedWhen(namespace.shortPrefix("deny"), resource, operation, condition, namespace);
    return clientFor(denied);
  }

  private static OpenMetadataClient clientFor(final User denied) {
    return SdkClients.createClient(denied.getName(), denied.getEmail(), new String[] {});
  }

  /** The user {@link #clientDeniedWhen} signs in as, for a test that acts as them another way. */
  public static User userDeniedWhen(
      String uniquePrefix, String resource, MetadataOperation operation, String condition) {
    return userDeniedWhen(uniquePrefix, resource, operation, condition, null);
  }

  private static User userDeniedWhen(
      final String uniquePrefix,
      final String resource,
      final MetadataOperation operation,
      final String condition,
      final TestNamespace namespace) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final List<Rule> rules = new ArrayList<>();
    if (!isReadOperation(operation)) {
      rules.add(
          new Rule()
              .withName(uniquePrefix + "_view")
              .withResources(List.of("All"))
              .withOperations(List.of(MetadataOperation.VIEW_ALL))
              .withEffect(Rule.Effect.ALLOW));
    }
    rules.add(
        new Rule()
            .withName(uniquePrefix + "_deny")
            .withResources(List.of(resource))
            .withOperations(List.of(operation))
            .withCondition(condition)
            .withEffect(Rule.Effect.DENY));

    final Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(uniquePrefix + "_policy")
                    .withDescription("Unconditional deny for a child-field negative-authz IT")
                    .withRules(rules));
    trackRoot(namespace, Entity.POLICY, policy.getId());
    final Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(uniquePrefix + "_role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    trackRoot(namespace, Entity.ROLE, role.getId());

    final CreateTeam createTeam = new CreateTeam();
    createTeam.setName(uniquePrefix + "_team");
    createTeam.setTeamType(CreateTeam.TeamType.GROUP);
    createTeam.setDefaultRoles(List.of(role.getId()));
    final Team team = admin.teams().create(createTeam);
    trackRoot(namespace, Entity.TEAM, team.getId());

    final CreateUser createUser = new CreateUser();
    createUser.setName(uniquePrefix + "_user");
    createUser.setEmail(uniquePrefix + "_user@test.openmetadata.org");
    createUser.setTeams(List.of(team.getId()));
    final User user = admin.users().create(createUser);
    trackRoot(namespace, Entity.USER, user.getId());
    return user;
  }

  private static void trackRoot(
      final TestNamespace namespace, final String entityType, final UUID id) {
    if (namespace != null) {
      namespace.trackRoot(entityType, id);
    }
  }

  private static boolean isReadOperation(MetadataOperation operation) {
    return operation.value().startsWith("View");
  }
}
