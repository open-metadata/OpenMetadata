package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.service.Entity;

/**
 * Which policies apply to a request: whether a disabled policy still counts, what an owning team's
 * policies give to outsiders, and who counts as a reviewer. Every user inherits DataConsumer, which grants EditDescription but not
 * EditDisplayName, so display-name edits are the probe here.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class PolicyEnforcementIT {

  @Test
  void aDisabledPolicyGrantsNothing(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("displayNamePolicy"))
                    .withDescription("Grants display name edits on glossaries")
                    .withRules(
                        List.of(
                            allowRule("displayNameRule", MetadataOperation.EDIT_DISPLAY_NAME)
                                .withResources(List.of(Entity.GLOSSARY)))));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("displayNameRole"))
                    .withDescription("Role carrying the display name policy")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    User user = createUser(ns, "roleholder", role, null);
    Glossary glossary = createGlossary(ns, "adminOwnedGlossary", adminOwner(), null);
    OpenMetadataClient asUser = clientFor(user);

    assertDoesNotThrow(
        () -> asUser.glossaries().patch(glossary.getId(), renameTo("Granted while enabled")));

    admin
        .policies()
        .patch(
            policy.getId(),
            JsonUtils.readTree("[{\"op\":\"replace\",\"path\":\"/enabled\",\"value\":false}]"));

    assertThrows(
        ForbiddenException.class,
        () -> asUser.glossaries().patch(glossary.getId(), renameTo("Refused once disabled")));
  }

  @Test
  void anOwningTeamsAllowRulesApplyOnlyToItsMembers(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("teamDisplayNamePolicy"))
                    .withDescription("Grants display name edits everywhere")
                    .withRules(
                        List.of(
                            allowRule(
                                "teamDisplayNameRule", MetadataOperation.EDIT_DISPLAY_NAME))));
    Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("owningTeam"))
                    .withDescription("Team that owns a glossary")
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withPolicies(List.of(policy.getId())));
    Glossary glossary =
        createGlossary(ns, "teamOwnedGlossary", List.of(team.getEntityReference()), null);
    User outsider = createUser(ns, "outsider", null, null);
    User member = createUser(ns, "member", null, team);

    assertThrows(
        ForbiddenException.class,
        () -> clientFor(outsider).glossaries().patch(glossary.getId(), renameTo("By outsider")));
    assertDoesNotThrow(
        () -> clientFor(member).glossaries().patch(glossary.getId(), renameTo("By member")));
  }

  @Test
  void aReviewerTeamDoesNotMakeAUserOfTheSameNameAReviewer(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String sharedName = shortName("reviewers");
    Team reviewerTeam =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(sharedName)
                    .withDescription("Team that reviews a glossary")
                    .withTeamType(CreateTeam.TeamType.GROUP));
    Glossary glossary =
        createGlossary(
            ns, "reviewedGlossary", adminOwner(), List.of(reviewerTeam.getEntityReference()));
    User namesake = ns.trackRoot(Entity.USER, createUserNamed(sharedName, null, null));

    assertThrows(
        ForbiddenException.class,
        () -> clientFor(namesake).glossaries().patch(glossary.getId(), renameTo("By namesake")));
  }

  private static Rule allowRule(String name, MetadataOperation operation) {
    return new Rule()
        .withName(name)
        .withResources(List.of(Entity.ALL_RESOURCES))
        .withOperations(List.of(operation))
        .withEffect(Rule.Effect.ALLOW);
  }

  private static Glossary createGlossary(
      TestNamespace ns,
      String name,
      List<EntityReference> owners,
      List<EntityReference> reviewers) {
    CreateGlossary request =
        new CreateGlossary().withName(ns.prefix(name)).withDescription("Glossary for policy tests");
    if (owners != null) {
      request.withOwners(owners);
    }
    if (reviewers != null) {
      request.withReviewers(reviewers);
    }
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(request));
  }

  private static List<EntityReference> adminOwner() {
    return List.of(SdkClients.adminClient().users().getByName("admin").getEntityReference());
  }

  private static String shortName(String suffix) {
    return "pe_" + suffix + "_" + UUID.randomUUID().toString().substring(0, 8);
  }

  private static User createUser(TestNamespace ns, String suffix, Role role, Team team) {
    return ns.trackRoot(Entity.USER, createUserNamed(shortName(suffix), role, team));
  }

  private static User createUserNamed(String name, Role role, Team team) {
    CreateUser request = new CreateUser().withName(name).withEmail(name + "@test.openmetadata.org");
    if (role != null) {
      request.withRoles(List.of(role.getId()));
    }
    if (team != null) {
      request.withTeams(List.of(team.getId()));
    }
    return SdkClients.adminClient().users().create(request);
  }

  private static OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private static JsonNode renameTo(String displayName) {
    return JsonUtils.valueToTree(
        List.of(Map.of("op", "add", "path", "/displayName", "value", displayName)));
  }
}
