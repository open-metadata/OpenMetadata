package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.SearchDocs.awaitDoc;
import static org.openmetadata.it.util.SearchDocs.refOf;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.TeamHierarchyTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Membership is a relationship between a team and its users, shown in both documents: the users'
 * teams and the team's user count. Changing it has to rebuild both, and only those.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TeamMembershipSearchIT {

  private static final String USER_INDEX = "user_search_index";
  private static final String TEAM_INDEX = "team_search_index";

  @Test
  void teamUsersEndpoints_reindexTheMembersAndTheTeam(TestNamespace ns) {
    Team department = TeamHierarchyTestFactory.departmentUnderDivision(ns, "mbr", null);
    Team group = TeamHierarchyTestFactory.groupUnder(ns, "mbrgroup", department);
    User user = UserTestFactory.createUser(ns, "member");
    awaitDoc(USER_INDEX, user.getId(), doc -> true);

    client()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/teams/" + group.getId() + "/users",
            List.of(new EntityReference().withId(user.getId()).withType("user")));
    awaitDoc(USER_INDEX, user.getId(), doc -> refOf(doc.path("teams"), group.getId()).isObject());
    awaitDoc(TEAM_INDEX, group.getId(), doc -> doc.path("userCount").asInt() == 1);

    client()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE, "/v1/teams/" + group.getId() + "/users/" + user.getId(), null);
    awaitDoc(
        USER_INDEX, user.getId(), doc -> refOf(doc.path("teams"), group.getId()).isMissingNode());
    awaitDoc(TEAM_INDEX, group.getId(), doc -> doc.path("userCount").asInt() == 0);
  }

  @Test
  void userTeamChange_keepsTheRestOfTheTeamDocument(TestNamespace ns) {
    Team department = TeamHierarchyTestFactory.departmentUnderDivision(ns, "kept", null);
    User owner = UserTestFactory.createUser(ns, "teamowner");
    Team group =
        TeamHierarchyTestFactory.team(
            new CreateTeam()
                .withName(ns.prefix("keptgroup"))
                .withTeamType(CreateTeam.TeamType.GROUP)
                .withParents(List.of(department.getId()))
                .withOwners(List.of(new EntityReference().withId(owner.getId()).withType("user"))));
    awaitDoc(TEAM_INDEX, group.getId(), doc -> refOf(doc.path("owners"), owner.getId()).isObject());

    User member = UserTestFactory.createUser(ns, "joiner");
    User edited = client().users().get(member.getId().toString(), "teams");
    edited.setTeams(List.of(new EntityReference().withId(group.getId()).withType("team")));
    client().users().update(member.getId().toString(), edited);

    JsonNode doc = awaitDoc(TEAM_INDEX, group.getId(), d -> d.path("userCount").asInt() == 1);
    assertTrue(refOf(doc.path("owners"), owner.getId()).isObject(), doc.path("owners").toString());
  }

  private static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }
}
