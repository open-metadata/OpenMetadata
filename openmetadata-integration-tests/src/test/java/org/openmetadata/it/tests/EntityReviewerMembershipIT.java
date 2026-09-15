package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.policy.EntityPolicySupport;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.RequestEntityCache;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
class EntityReviewerMembershipIT {
  @AfterEach
  void clearRequestCache() {
    RequestEntityCache.clear();
  }

  @Test
  void membershipChangesReplaceCachedReviewerAuthorization(TestNamespace ns) {
    SdkClients.adminClient();
    final User previous = UserTestFactory.createUser(ns, "previous_reviewer");
    final User replacement = UserTestFactory.createUser(ns, "replacement_reviewer");
    final Team team = reviewers(ns, previous);
    assertDoesNotThrow(() -> checkReviewer(team, previous));
    assertRejected(team, replacement);
    final Team updated = SdkClients.adminClient().teams().get(team.getId().toString(), "users");
    updated.setUsers(List.of(replacement.getEntityReference()));
    SdkClients.adminClient().teams().update(team.getId().toString(), updated);
    assertRejected(team, previous);
    assertDoesNotThrow(() -> checkReviewer(team, replacement));
    assertCachedAliasesContain(team, replacement);
  }

  private Team reviewers(TestNamespace ns, User member) {
    return ns.trackRoot(
        Entity.TEAM,
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("reviewers"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withUsers(List.of(member.getId()))));
  }

  private void checkReviewer(Team team, User user) {
    RequestEntityCache.clear();
    EntityPolicySupport.REVIEWER_POLICY.check(
        new GlossaryTerm().withReviewers(List.of(team.getEntityReference())), user.getName());
  }

  private void assertRejected(Team team, User user) {
    final var failure = assertThrows(AuthorizationException.class, () -> checkReviewer(team, user));
    assertEquals(notReviewer(user.getName()), failure.getMessage());
  }

  private void assertCachedAliasesContain(Team team, User member) {
    final var client = SdkClients.adminClient().teams();
    for (final Team cached :
        List.of(
            client.get(team.getId().toString(), "users"),
            client.getByName(team.getFullyQualifiedName(), "users"))) {
      assertEquals(
          List.of(member.getId()), cached.getUsers().stream().map(EntityReference::getId).toList());
    }
  }
}
