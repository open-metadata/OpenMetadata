package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Members of a team hold the team's {@code defaultRoles} as inherited roles and are governed by the
 * team's policies, so adding a user to a team that is not open to everyone grants privileges the
 * same way naming a role does. {@code PATCH /v1/users/{id}} has always required an administrator for
 * it; these tests pin the same rule onto {@code POST /v1/users} and {@code PUT /v1/users}, which
 * carry the membership in the request body instead of a JSON patch.
 *
 * <p>The negative controls matter as much as the rejections: the guard is delta-based, so joinable
 * teams, unchanged membership and administrators all have to keep working.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class UserTeamAssignmentPrivilegeIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void test_selfUpdate_cannotJoinClosedTeam(TestNamespace ns) throws Exception {
    Team closedTeam = createTeam(ns, "closed", false, dataStewardRoleId());
    Joiner joiner = createJoiner(ns, "closedjoin", null);

    OpenMetadataException exception =
        assertThrows(
            OpenMetadataException.class, () -> joiner.putTeams(List.of(closedTeam.getId())));
    assertEquals(
        403,
        exception.getStatusCode(),
        "Joining a team that is not open to everyone is admin only: " + exception.getMessage());

    User stored = fetchMembership(joiner.user());
    assertFalse(
        teamIds(stored).contains(closedTeam.getId()), "The rejected team must not be added");
    assertFalse(
        roleNames(stored).contains(DATA_STEWARD),
        "The rejected team must not leak its defaultRoles as inherited roles");
  }

  @Test
  void test_selfUpdate_canJoinOpenTeam(TestNamespace ns) throws Exception {
    // The guard must only bite on closed teams - self service joining of an open team is exactly
    // what the isJoinable flag is for.
    Team openTeam = createTeam(ns, "open", true, dataStewardRoleId());
    Joiner joiner = createJoiner(ns, "openjoin", null);

    joiner.putTeams(List.of(openTeam.getId()));

    assertTrue(
        teamIds(fetchMembership(joiner.user())).contains(openTeam.getId()),
        "Joining an open team must stay allowed");
  }

  @Test
  void test_selfUpdate_reSendingCurrentClosedTeam_allowed(TestNamespace ns) throws Exception {
    // Re-sending membership the user already has asks for nothing new, so a plain upsert by a
    // member of a closed team must not start failing.
    Team closedTeam = createTeam(ns, "resend", false, dataStewardRoleId());
    Joiner joiner = createJoiner(ns, "resendjoin", closedTeam.getId());

    joiner.putTeams(List.of(closedTeam.getId()));

    assertTrue(
        teamIds(fetchMembership(joiner.user())).contains(closedTeam.getId()),
        "An existing member must keep the membership");
  }

  @Test
  void test_createUser_cannotPlaceUserInClosedTeam(TestNamespace ns) {
    // A principal that authenticates but has no user row yet takes the self sign-up path, where the
    // teams in the payload are decided before the entity exists.
    Team closedTeam = createTeam(ns, "signup", false, null);
    String userName = "signupjoin" + ns.shortPrefix();
    String email = userName + "@test.com";
    OpenMetadataClient newcomer = SdkClients.createClient(userName, email, new String[] {});

    OpenMetadataException exception =
        assertThrows(
            OpenMetadataException.class,
            () ->
                newcomer
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST, "/v1/users", body(userName, email, closedTeam.getId())));
    assertEquals(
        403,
        exception.getStatusCode(),
        "Creating yourself inside a closed team is admin only: " + exception.getMessage());
    assertFalse(userExists(userName), "The rejected request must not create the user");
  }

  @Test
  void test_adminAssignment_toClosedTeam_stillWorks(TestNamespace ns) {
    // Administrators are how users legitimately get into closed teams, so both write paths have to
    // keep working for them.
    Team closedTeam = createTeam(ns, "adminok", false, null);
    OpenMetadataClient admin = SdkClients.adminClient();

    String createdName = "adminpost" + ns.shortPrefix();
    User created =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(createdName)
                    .withEmail(createdName + "@test.com")
                    .withTeams(List.of(closedTeam.getId())));
    assertTrue(
        teamIds(fetchMembership(created)).contains(closedTeam.getId()),
        "An admin must still be able to create a user inside a closed team");

    String updatedName = "adminput" + ns.shortPrefix();
    String updatedEmail = updatedName + "@test.com";
    admin.users().create(new CreateUser().withName(updatedName).withEmail(updatedEmail));
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/users", body(updatedName, updatedEmail, closedTeam.getId()));

    assertTrue(
        teamIds(SdkClients.adminClient().users().getByName(updatedName, MEMBERSHIP_FIELDS))
            .contains(closedTeam.getId()),
        "An admin must still be able to move a user into a closed team");
  }

  @Test
  void test_selfUpdate_cannotReachAdminThroughRolesOrBots(TestNamespace ns) throws Exception {
    // The whole escalation walk in one place: neither the direct role grant nor the bot create is
    // available to an ordinary user, so there is no path from here to an administrator token.
    Joiner joiner = createJoiner(ns, "escalate", null);
    String botRoleId = roleId("ApplicationBotRole");

    OpenMetadataException roleGrant =
        assertThrows(OpenMetadataException.class, () -> joiner.putRoles(List.of(botRoleId)));
    assertEquals(
        403, roleGrant.getStatusCode(), "Self assigning a bot role must be rejected: " + roleGrant);

    String botName = "escalatebot" + ns.shortPrefix();
    String adminBot =
        "{\"name\":\""
            + botName
            + "\",\"email\":\""
            + botName
            + "@test.com\",\"isBot\":true,\"isAdmin\":true,"
            + "\"authenticationMechanism\":{\"authType\":\"JWT\",\"config\":{\"JWTTokenExpiry\":\"OneHour\"}}}";
    OpenMetadataException botCreate =
        assertThrows(
            OpenMetadataException.class,
            () ->
                joiner
                    .client()
                    .getHttpClient()
                    .executeForString(HttpMethod.POST, "/v1/users", adminBot));
    assertEquals(
        403, botCreate.getStatusCode(), "Creating an admin bot must be rejected: " + botCreate);
    assertFalse(userExists(botName), "The rejected request must not create the bot");
  }

  // ===================================================================
  // HELPERS
  // ===================================================================

  private static final String DATA_STEWARD = "DataSteward";
  private static final String MEMBERSHIP_FIELDS = "teams,roles,inheritedRoles";

  /** A non-admin principal together with the client that authenticates as it. */
  private record Joiner(User user, OpenMetadataClient client) {

    void putTeams(List<UUID> teamIds) {
      put("\"teams\":" + jsonIds(teamIds.stream().map(UUID::toString).toList()));
    }

    void putRoles(List<String> roleIds) {
      put("\"roles\":" + jsonIds(roleIds));
    }

    private void put(String privilegedField) {
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT,
              "/v1/users",
              "{\"name\":\""
                  + user.getName()
                  + "\",\"email\":\""
                  + user.getEmail()
                  + "\","
                  + privilegedField
                  + "}");
    }

    private static String jsonIds(List<String> ids) {
      return "[\"" + String.join("\",\"", ids) + "\"]";
    }
  }

  /**
   * The name has to equal the email local part: JwtFilter resolves the caller's username from the
   * token's email claim, so any other name never authenticates.
   */
  private Joiner createJoiner(TestNamespace ns, String prefix, UUID teamId) {
    String userName = prefix + ns.shortPrefix();
    String email = userName + "@test.com";
    CreateUser create = new CreateUser().withName(userName).withEmail(email);
    if (teamId != null) {
      create.withTeams(List.of(teamId));
    }
    User user = SdkClients.adminClient().users().create(create);
    assertNotNull(user.getId());
    assertFalse(Boolean.TRUE.equals(user.getIsAdmin()), "The joiner must not be an admin");
    return new Joiner(user, SdkClients.createClient(userName, email, new String[] {}));
  }

  private Team createTeam(TestNamespace ns, String prefix, boolean joinable, String defaultRoleId) {
    CreateTeam create =
        new CreateTeam()
            .withName("teamjoin_" + prefix + ns.shortPrefix())
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withIsJoinable(joinable);
    if (defaultRoleId != null) {
      create.withDefaultRoles(List.of(UUID.fromString(defaultRoleId)));
    }
    Team team = SdkClients.adminClient().teams().create(create);
    assertEquals(joinable, team.getIsJoinable());
    return team;
  }

  private String dataStewardRoleId() throws Exception {
    return roleId(DATA_STEWARD);
  }

  private String roleId(String roleName) throws Exception {
    String role =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/roles/name/" + roleName, null);
    return MAPPER.readTree(role).get("id").asText();
  }

  private String body(String name, String email, UUID teamId) {
    return "{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"teams\":[\"" + teamId + "\"]}";
  }

  private User fetchMembership(User user) {
    return SdkClients.adminClient().users().get(user.getId().toString(), MEMBERSHIP_FIELDS);
  }

  private static List<UUID> teamIds(User user) {
    return user.getTeams() == null
        ? List.of()
        : user.getTeams().stream().map(EntityReference::getId).toList();
  }

  private static List<String> roleNames(User user) {
    return user.getInheritedRoles() == null
        ? List.of()
        : user.getInheritedRoles().stream().map(EntityReference::getName).toList();
  }

  private boolean userExists(String name) {
    try {
      return SdkClients.adminClient().users().getByName(name) != null;
    } catch (Exception e) {
      return false;
    }
  }
}
