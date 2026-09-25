package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * A request that names no team still arrives at the repository carrying one: {@code validateTeams}
 * substitutes the organization for an absent team list. That default is the server's doing, so the
 * privileged-field guard on {@code PUT /v1/users} has to ignore it - otherwise a deployment that
 * closes the organization turns every first write by a new user into an administrator-only
 * operation.
 *
 * <p>Isolated and single threaded because it flips {@code isJoinable} on the shared organization,
 * which every other user-facing test depends on.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class UserDefaultTeamAssignmentIT {

  private static final String ORGANIZATION = "Organization";

  @Test
  void test_closedOrganization_doesNotGateWritesThatNameNoTeam(TestNamespace ns) {
    Team organization = SdkClients.adminClient().teams().getByName(ORGANIZATION);
    setJoinable(organization, false);
    try {
      // A principal with no user row yet: the organization it lands in is not one it asked for.
      String newcomerName = "orgnewcomer" + ns.shortPrefix();
      String newcomerEmail = newcomerName + "@test.com";
      OpenMetadataClient newcomer =
          SdkClients.createClient(newcomerName, newcomerEmail, new String[] {});

      newcomer
          .getHttpClient()
          .executeForString(HttpMethod.PUT, "/v1/users", body(newcomerName, newcomerEmail, null));

      assertTrue(
          teamNames(newcomerName).contains(ORGANIZATION),
          "Creating yourself without naming a team must not need an admin");

      // And the same for an existing user editing itself.
      String memberName = "orgmember" + ns.shortPrefix();
      String memberEmail = memberName + "@test.com";
      SdkClients.adminClient()
          .users()
          .create(new CreateUser().withName(memberName).withEmail(memberEmail));
      OpenMetadataClient member = SdkClients.createClient(memberName, memberEmail, new String[] {});

      String description = "self update under a closed organization";
      String response =
          member
              .getHttpClient()
              .executeForString(
                  HttpMethod.PUT, "/v1/users", body(memberName, memberEmail, description));

      assertTrue(response.contains(description), "A self update naming no team must stay allowed");
    } finally {
      setJoinable(organization, true);
    }
  }

  private void setJoinable(Team organization, boolean joinable) {
    Team updated =
        SdkClients.adminClient()
            .teams()
            .update(organization.getId().toString(), organization.withIsJoinable(joinable));
    assertEquals(joinable, updated.getIsJoinable());
  }

  private String body(String name, String email, String description) {
    String payload = "{\"name\":\"" + name + "\",\"email\":\"" + email + "\"";
    if (description != null) {
      payload += ",\"description\":\"" + description + "\"";
    }
    return payload + "}";
  }

  private List<String> teamNames(String userName) {
    User stored = SdkClients.adminClient().users().getByName(userName, "teams");
    return stored.getTeams() == null
        ? List.of()
        : stored.getTeams().stream().map(EntityReference::getName).toList();
  }
}
