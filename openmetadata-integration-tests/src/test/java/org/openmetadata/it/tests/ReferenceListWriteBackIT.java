package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * A team's owner who may not view one of its parents writes the parents as it was shown them: the
 * hidden parent stays, the change it meant is made, and the write answers without the hidden parent
 * (ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view). Each test hides a
 * parent from its own user, so nothing else in the run is affected.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ReferenceListWriteBackIT {

  @Test
  void aPatchByIndexReplacesTheParentTheOwnerSawAndKeepsTheHiddenOne(TestNamespace ns) {
    Hierarchy teams = hierarchy(ns, "patch");
    OpenMetadataClient owner = teams.ownerClient();
    assertEquals(
        Set.of(teams.shown()), parentIds(owner.teams().get(teams.child().toString(), "parents")));

    Team patched =
        owner
            .teams()
            .patch(
                teams.child(),
                JsonUtils.valueToTree(
                    List.of(
                        Map.of(
                            "op",
                            "replace",
                            "path",
                            "/parents/0",
                            "value",
                            Map.of("id", teams.newParent().toString(), "type", Entity.TEAM)))));

    assertEquals(Set.of(teams.newParent()), parentIds(patched));
    assertEquals(Set.of(teams.hidden(), teams.newParent()), storedParentIds(teams));
  }

  @Test
  void anEmptyPatchAnswersWithoutTheHiddenParent(TestNamespace ns) {
    Hierarchy teams = hierarchy(ns, "empty");

    Team unchanged = teams.ownerClient().teams().patch(teams.child(), JsonUtils.readTree("[]"));

    assertEquals(Set.of(teams.shown()), parentIds(unchanged));
    assertEquals(Set.of(teams.hidden(), teams.shown()), storedParentIds(teams));
  }

  @Test
  void aPutOfTheParentsTheOwnerSawKeepsTheHiddenOne(TestNamespace ns) {
    Hierarchy teams = hierarchy(ns, "put");
    CreateTeam asSeen =
        new CreateTeam()
            .withName(teams.childName())
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withOwners(List.of(teams.owner()))
            .withParents(List.of(teams.shown(), teams.newParent()));

    Team put =
        teams
            .ownerClient()
            .getHttpClient()
            .execute(HttpMethod.PUT, "/v1/teams", asSeen, Team.class);

    assertEquals(Set.of(teams.shown(), teams.newParent()), parentIds(put));
    assertEquals(Set.of(teams.hidden(), teams.shown(), teams.newParent()), storedParentIds(teams));
  }

  /**
   * A group team with two parents, one of which its owner may not view, and a third team the owner
   * may move it under. Which parent is hidden is chosen after reading the stored order, so the hidden
   * parent is the first one: an index the owner sends then means a different parent in the stored
   * list than in the list it was shown.
   */
  private static Hierarchy hierarchy(TestNamespace ns, String suffix) {
    OpenMetadataClient admin = SdkClients.adminClient();
    User user = ownerHidingUnownedTeams(ns, suffix);
    EntityReference owner = user.getEntityReference();
    Team first = department(ns, suffix + "ParentA", null);
    Team second = department(ns, suffix + "ParentB", null);
    Team newParent = department(ns, suffix + "NewParent", owner);
    Team child =
        ns.trackRoot(
            Entity.TEAM,
            admin
                .teams()
                .create(
                    new CreateTeam()
                        .withName(ns.prefix(suffix + "Child"))
                        .withTeamType(CreateTeam.TeamType.GROUP)
                        .withOwners(List.of(owner))
                        .withParents(List.of(first.getId(), second.getId()))));
    List<EntityReference> stored =
        admin.teams().get(child.getId().toString(), "parents").getParents();
    UUID hidden = stored.get(0).getId();
    UUID shown = stored.get(1).getId();
    admin.teams().patch(shown, ownedBy(user));
    return new Hierarchy(
        SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {}),
        owner,
        child.getId(),
        child.getName(),
        hidden,
        shown,
        newParent.getId());
  }

  /** A user who may not view a team it does not own; the user, role and policy are cleaned up. */
  private static User ownerHidingUnownedTeams(TestNamespace ns, String suffix) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy =
        ns.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(ns.prefix(suffix + "HideUnownedTeams"))
                        .withDescription("Hides the teams the user does not own")
                        .withRules(
                            List.of(
                                new Rule()
                                    .withName("hideUnownedTeams")
                                    .withResources(List.of(Entity.TEAM))
                                    .withOperations(List.of(MetadataOperation.VIEW_ALL))
                                    .withEffect(Rule.Effect.DENY)
                                    .withCondition("!isOwner()")))));
    Role role =
        ns.trackRoot(
            Entity.ROLE,
            admin
                .roles()
                .create(
                    new CreateRole()
                        .withName(ns.prefix(suffix + "HideUnownedTeamsRole"))
                        .withDescription("Role hiding the teams the user does not own")
                        .withPolicies(List.of(policy.getFullyQualifiedName()))));
    String name = "rlw_" + suffix + "_" + UUID.randomUUID().toString().substring(0, 8);
    return ns.trackRoot(
        Entity.USER,
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.openmetadata.org")
                    .withRoles(List.of(role.getId()))));
  }

  private static Team department(TestNamespace ns, String suffix, EntityReference owner) {
    CreateTeam request =
        new CreateTeam().withName(ns.prefix(suffix)).withTeamType(CreateTeam.TeamType.DEPARTMENT);
    if (owner != null) {
      request.withOwners(List.of(owner));
    }
    return ns.trackRoot(Entity.TEAM, SdkClients.adminClient().teams().create(request));
  }

  private static JsonNode ownedBy(User user) {
    return JsonUtils.valueToTree(
        List.of(
            Map.of(
                "op",
                "add",
                "path",
                "/owners",
                "value",
                List.of(Map.of("id", user.getId().toString(), "type", Entity.USER)))));
  }

  private static Set<UUID> storedParentIds(Hierarchy teams) {
    return parentIds(SdkClients.adminClient().teams().get(teams.child().toString(), "parents"));
  }

  private static Set<UUID> parentIds(Team team) {
    return team.getParents().stream().map(EntityReference::getId).collect(Collectors.toSet());
  }

  private record Hierarchy(
      OpenMetadataClient ownerClient,
      EntityReference owner,
      UUID child,
      String childName,
      UUID hidden,
      UUID shown,
      UUID newParent) {}
}
