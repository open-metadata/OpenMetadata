package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityReferenceValidator;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.RequestEntityCache;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Counts fresh team reads during owner validation")
class EntityOwnerValidationIT {
  @Test
  void groupOwnerReusesTheTeamReadWithoutChangingTheReference(TestNamespace ns) {
    final Team team = create(ns, TeamType.GROUP);
    final EntityReference expected =
        Entity.getEntityReferenceById(Entity.TEAM, team.getId(), Include.NON_DELETED);
    try (var fresh = FreshReadScope.enter();
        var queries = new SqlQueryCounter(Entity.getJdbi(), "from team_entity")) {
      final List<EntityReference> owners =
          EntityReferenceValidator.shared().owners(List.of(team.getEntityReference()));
      assertEquals(JsonUtils.pojoToJson(expected), JsonUtils.pojoToJson(owners.getFirst()));
      assertEquals(1, queries.count());
    } finally {
      RequestEntityCache.clear();
    }
  }

  @Test
  void duplicateOwnersKeepIndependentReferencesAndReuseTheRequestProjection(TestNamespace ns) {
    final Team team = create(ns, TeamType.GROUP);
    final EntityReference owner = team.getEntityReference();
    try (var fresh = FreshReadScope.enter();
        var queries = new SqlQueryCounter(Entity.getJdbi(), "from team_entity")) {
      final List<EntityReference> owners =
          EntityReferenceValidator.shared().owners(List.of(owner, owner));
      assertEquals(
          List.of(team.getId(), team.getId()),
          owners.stream().map(EntityReference::getId).toList());
      owners.getFirst().setDescription("Changed returned reference");
      assertEquals(team.getDescription(), owners.getLast().getDescription());
      assertEquals(1, queries.count());
    } finally {
      RequestEntityCache.clear();
    }
  }

  @Test
  void nonGroupOwnersStillFailAfterTheFirstTeamRead(TestNamespace ns) {
    final Team team = create(ns, TeamType.DEPARTMENT);
    try (var fresh = FreshReadScope.enter();
        var queries = new SqlQueryCounter(Entity.getJdbi(), "from team_entity")) {
      assertThrows(
          IllegalArgumentException.class,
          () -> EntityReferenceValidator.shared().owners(List.of(team.getEntityReference())));
      assertEquals(1, queries.count());
    } finally {
      RequestEntityCache.clear();
    }
  }

  private Team create(final TestNamespace ns, final TeamType type) {
    return SdkClients.adminClient()
        .teams()
        .create(
            new CreateTeam()
                .withName(ns.prefix("owner_team"))
                .withTeamType(type)
                .withDescription("Owner validation projection")
                .withDisplayName("Owner validation team"));
  }
}
