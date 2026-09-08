package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;

/** RDF batch readers must preserve the fields projected by live entity refreshes. */
@ExtendWith(TestNamespaceExtension.class)
public class RdfBatchFieldsIT {
  @Test
  void batchRoleReadsRetainUsersAndTeams(final TestNamespace namespace) {
    final var client = SdkClients.adminClient();
    final Role role =
        namespace.trackRoot(
            Entity.ROLE,
            client
                .roles()
                .create(
                    new CreateRole()
                        .withName(namespace.prefix("role"))
                        .withPolicies(List.of("DataConsumerPolicy"))));
    final Team team =
        namespace.trackRoot(
            Entity.TEAM,
            client
                .teams()
                .create(
                    new CreateTeam()
                        .withName(namespace.prefix("roleTeam"))
                        .withTeamType(TeamType.GROUP)
                        .withDefaultRoles(List.of(role.getId()))));
    final User user = createUser(namespace, List.of(role.getId()), List.of());
    final Role normal = client.roles().get(role.getId().toString(), "users,teams");
    assertEquals(Set.of(user.getId()), ids(normal.getUsers()));
    assertEquals(Set.of(team.getId()), ids(normal.getTeams()));
    final RoleRepository repository = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
    final Role batch = repository.getDao().findEntityById(role.getId());
    repository.setFieldsInBulk(repository.getFields("users,teams"), List.of(batch));
    assertEquals(ids(normal.getUsers()), ids(batch.getUsers()));
    assertEquals(ids(normal.getTeams()), ids(batch.getTeams()));
  }

  @Test
  void batchTeamReadsRetainMembersAndInheritedRoles(final TestNamespace namespace) {
    final var client = SdkClients.adminClient();
    final Team team =
        namespace.trackRoot(
            Entity.TEAM,
            client
                .teams()
                .create(
                    new CreateTeam()
                        .withName(namespace.prefix("team"))
                        .withTeamType(TeamType.GROUP)));
    final User user = createUser(namespace, List.of(), List.of(team.getId()));
    final Team normal = client.teams().get(team.getId().toString(), "users,defaultRoles");
    assertEquals(Set.of(user.getId()), ids(normal.getUsers()));
    assertFalse(normal.getInheritedRoles().isEmpty());
    final TeamRepository repository = (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
    final Team batch = repository.getDao().findEntityById(team.getId());
    repository.setFieldsInBulk(repository.getFields("users,defaultRoles"), List.of(batch));
    assertEquals(ids(normal.getUsers()), ids(batch.getUsers()));
    assertEquals(ids(normal.getInheritedRoles()), ids(batch.getInheritedRoles()));
    assertEquals("user", batch.getUsers().getFirst().getType());
  }

  @Test
  void batchTeamReadsRetainHierarchyChildren(final TestNamespace namespace) {
    final var client = SdkClients.adminClient();
    final Team parent =
        namespace.trackRoot(
            Entity.TEAM,
            client
                .teams()
                .create(
                    new CreateTeam()
                        .withName(namespace.prefix("department"))
                        .withTeamType(TeamType.DEPARTMENT)));
    final Team child =
        namespace.trackRoot(
            Entity.TEAM,
            client
                .teams()
                .create(
                    new CreateTeam()
                        .withName(namespace.prefix("child"))
                        .withTeamType(TeamType.GROUP)
                        .withParents(List.of(parent.getId()))));
    final Team normal = client.teams().get(parent.getId().toString(), "children");
    assertEquals(Set.of(child.getId()), ids(normal.getChildren()));
    final TeamRepository repository = (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
    final Team batch = repository.getDao().findEntityById(parent.getId());
    repository.setFieldsInBulk(repository.getFields("children"), List.of(batch));
    assertEquals(ids(normal.getChildren()), ids(batch.getChildren()));
  }

  private static User createUser(
      final TestNamespace namespace, final List<UUID> roles, final List<UUID> teams) {
    final String name = "member_" + namespace.shortPrefix();
    return namespace.trackRoot(
        Entity.USER,
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@example.com")
                    .withRoles(roles)
                    .withTeams(teams)));
  }

  private static Set<UUID> ids(final List<EntityReference> references) {
    return references == null
        ? Set.of()
        : references.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }
}
