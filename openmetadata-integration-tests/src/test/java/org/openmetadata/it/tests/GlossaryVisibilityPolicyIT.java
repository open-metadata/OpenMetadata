package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.Entity;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryVisibilityPolicyIT {

  private enum Assignment {
    OWNER,
    OWNER_AND_REVIEWER,
    REVIEWER,
    TEAM_OWNER,
    TEAM_REVIEWER
  }

  @ParameterizedTest
  @EnumSource(Assignment.class)
  void assignedUserCanListGlossaryUnderConditionalDeny(Assignment assignment, TestNamespace ns) {
    final String condition =
        switch (assignment) {
          case OWNER, OWNER_AND_REVIEWER, REVIEWER, TEAM_OWNER -> "!isOwner()";
          case TEAM_REVIEWER -> "!isOwner() && !isReviewer()";
        };
    final User owner = createUserWithDenyPolicy(ns, condition);
    final Glossary owned = createAssignedGlossary(ns.shortPrefix("owned"), owner, assignment);
    final Glossary hidden = createGlossary(ns.shortPrefix("hidden"));
    final OpenMetadataClient restricted = clientFor(owner);

    assertEquals(owned.getId(), restricted.glossaries().get(owned.getId().toString()).getId());
    assertThrows(
        ForbiddenException.class, () -> restricted.glossaries().get(hidden.getId().toString()));
    final ListResponse<Glossary> listed =
        restricted.glossaries().list(new ListParams().setLimit(1000));
    assertEquals(List.of(owned.getId()), listed.getData().stream().map(Glossary::getId).toList());
    assertEquals(1, listed.getTotal());
    assertTrue(nullOrEmpty(listed.getData().getFirst().getOwners()));
    assertTrue(nullOrEmpty(listed.getData().getFirst().getReviewers()));
    assertPage(
        restricted
            .glossaries()
            .list(new ListParams().setLimit(1000).setFields("owners,reviewers,tags,termCount")),
        owned,
        1);
  }

  @Test
  void conditionalDenyReturnsEmptyListWhenNoGlossaryIsVisible(TestNamespace ns) {
    final User user = createUserWithDenyPolicy(ns, "!isOwner()");
    createGlossary(ns.shortPrefix("hidden"));
    final ListResponse<Glossary> listed = clientFor(user).glossaries().list(new ListParams());
    assertEquals(List.of(), listed.getData());
    assertEquals(0, listed.getTotal());
    assertNull(listed.getPaging().getBefore());
    assertNull(listed.getPaging().getAfter());
  }

  @Test
  void conditionalDenyPreservesVisiblePaginationAndCounts(TestNamespace ns) {
    final User owner = createUserWithDenyPolicy(ns, "!isOwner()");
    createGlossary(ns.shortPrefix("a_hidden"));
    final Glossary first =
        createAssignedGlossary(ns.shortPrefix("b_owned"), owner, Assignment.OWNER);
    for (int index = 0; index < 101; index++) {
      createGlossary(ns.shortPrefix("c_hidden_" + index));
    }
    final Glossary second =
        createAssignedGlossary(ns.shortPrefix("d_owned"), owner, Assignment.OWNER);
    createGlossary(ns.shortPrefix("e_hidden"));
    final OpenMetadataClient restricted = clientFor(owner);

    final ListResponse<Glossary> firstPage =
        restricted.glossaries().list(new ListParams().setLimit(1));
    assertPage(firstPage, first, 2);
    assertNull(firstPage.getPaging().getBefore());
    assertNotNull(firstPage.getPaging().getAfter());
    final ListResponse<Glossary> secondPage =
        restricted
            .glossaries()
            .list(new ListParams().setLimit(1).setAfter(firstPage.getPaging().getAfter()));
    assertPage(secondPage, second, 2);
    assertNull(secondPage.getPaging().getAfter());
    assertPage(
        restricted
            .glossaries()
            .list(new ListParams().setLimit(1).setBefore(secondPage.getPaging().getBefore())),
        first,
        2);
    final ListResponse<Glossary> countOnly =
        restricted.glossaries().list(new ListParams().setLimit(0));
    assertEquals(List.of(), countOnly.getData());
    assertEquals(2, countOnly.getTotal());
    assertEmptyCursorPages(restricted, firstPage, secondPage);
  }

  private void assertEmptyCursorPages(
      OpenMetadataClient client, ListResponse<Glossary> first, ListResponse<Glossary> last) {
    final String firstCursor = first.getPaging().getAfter();
    final String lastCursor = last.getPaging().getBefore();
    final ListResponse<Glossary> afterLast =
        client.glossaries().list(new ListParams().setLimit(1).setAfter(lastCursor));
    assertEquals(List.of(), afterLast.getData());
    assertEquals(lastCursor, afterLast.getPaging().getBefore());
    final ListResponse<Glossary> beforeFirst =
        client.glossaries().list(new ListParams().setLimit(1).setBefore(firstCursor));
    assertEquals(List.of(), beforeFirst.getData());
    assertEquals(firstCursor, beforeFirst.getPaging().getAfter());
  }

  @Test
  void unconditionalDenyDoesNotExposeOwnedGlossaries(TestNamespace ns) {
    final User owner = createUserWithDenyPolicy(ns, null);
    final Glossary owned = createAssignedGlossary(ns.shortPrefix("owned"), owner, Assignment.OWNER);
    final OpenMetadataClient restricted = clientFor(owner);
    assertThrows(
        ForbiddenException.class, () -> restricted.glossaries().get(owned.getId().toString()));
    assertThrows(ForbiddenException.class, () -> restricted.glossaries().list(new ListParams()));
  }

  @Test
  void conditionalDenyPreservesDomainFilter(TestNamespace ns) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final User owner = createUserWithDenyPolicy(ns, "!isOwner()");
    final Domain domain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.shortPrefix("domain"))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Glossary visibility domain"));
    final Glossary inDomain =
        admin
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(ns.shortPrefix("in_domain"))
                    .withDescription("Owned glossary in the requested domain")
                    .withOwners(List.of(owner.getEntityReference()))
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    createAssignedGlossary(ns.shortPrefix("outside_domain"), owner, Assignment.OWNER);
    assertPage(
        clientFor(owner)
            .glossaries()
            .list(new ListParams().setDomain(domain.getFullyQualifiedName())),
        inDomain,
        1);
  }

  private void assertPage(ListResponse<Glossary> page, Glossary expected, int total) {
    assertEquals(List.of(expected.getId()), page.getData().stream().map(Glossary::getId).toList());
    assertEquals(total, page.getTotal());
  }

  private OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private Glossary createAssignedGlossary(String name, User user, Assignment assignment) {
    final EntityReference principal =
        switch (assignment) {
          case TEAM_OWNER, TEAM_REVIEWER -> user.getTeams().getFirst();
          default -> user.getEntityReference();
        };
    final CreateGlossary request =
        new CreateGlossary().withName(name).withDescription("Glossary visibility regression");
    switch (assignment) {
      case OWNER, TEAM_OWNER -> request.withOwners(List.of(principal));
      case REVIEWER, TEAM_REVIEWER -> request.withReviewers(List.of(principal));
      case OWNER_AND_REVIEWER -> request
          .withOwners(List.of(principal))
          .withReviewers(List.of(principal));
    }
    return SdkClients.adminClient().glossaries().create(request);
  }

  private User createUserWithDenyPolicy(TestNamespace ns, String condition) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Role role = createRole(ns, condition);
    final Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.shortPrefix("team"))
                    .withTeamType(TeamType.GROUP)
                    .withDefaultRoles(List.of(role.getId())));
    final String name = ns.shortPrefix("owner");
    return admin
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(name + "@test.openmetadata.org")
                .withTeams(List.of(team.getId())));
  }

  private Role createRole(TestNamespace ns, String condition) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.shortPrefix("policy"))
                    .withRules(
                        List.of(
                            viewRule("allowView", Rule.Effect.ALLOW, null),
                            viewRule("denyNonOwner", Rule.Effect.DENY, condition))));
    return admin
        .roles()
        .create(
            new CreateRole()
                .withName(ns.shortPrefix("role"))
                .withPolicies(List.of(policy.getFullyQualifiedName())));
  }

  private Rule viewRule(String name, Rule.Effect effect, String condition) {
    return new Rule()
        .withName(name)
        .withEffect(effect)
        .withResources(List.of(Entity.GLOSSARY))
        .withOperations(List.of(MetadataOperation.VIEW_ALL))
        .withCondition(condition);
  }

  private Glossary createGlossary(String name) {
    return SdkClients.adminClient()
        .glossaries()
        .create(
            new CreateGlossary().withName(name).withDescription("Glossary visibility regression"));
  }
}
