package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;

/**
 * Owner resolution for {@code update_entity}.
 *
 * <p>These need {@code Entity}'s static repository lookups stubbed, which is why they live apart
 * from {@link UpdateEntityMergeTest} - and why they did not exist while the tool shipped a path that
 * deleted every owner on a typo. The behaviour under test is the one the tool description promises:
 * a name that does not resolve fails the call rather than being dropped.
 */
class UpdateEntityOwnersTest {

  private static final String TEAM_NAME = "data-platform";

  private static Table tableOwnedBy(String ownerName) {
    return new Table()
        .withName("dim_address")
        .withOwners(
            List.of(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType(Entity.TEAM)
                    .withName(ownerName)));
  }

  private static void apply(Table table, Map<String, Object> params) {
    new UpdateEntityTool().applyChangesForTest(table, params);
  }

  /** Stubs the two repositories {@code getTeamsOrUsers} consults, resolving only {@link #TEAM_NAME}. */
  private static void stubDirectory(MockedStatic<Entity> entityMock) {
    UserRepository users = mock(UserRepository.class);
    TeamRepository teams = mock(TeamRepository.class);
    when(users.findByNameOrNull(any(), any())).thenReturn(null);
    when(teams.findByNameOrNull(any(), any())).thenReturn(null);
    Team resolved = new Team().withId(UUID.randomUUID()).withName(TEAM_NAME);
    when(teams.findByNameOrNull(eq(TEAM_NAME), any())).thenReturn(resolved);
    entityMock.when(Entity::getUserRepository).thenReturn(users);
    entityMock.when(() -> Entity.getEntityRepository(Entity.TEAM)).thenReturn(teams);
  }

  private static List<String> ownerNamesOf(Table table) {
    return table.getOwners().stream().map(EntityReference::getName).toList();
  }

  @Test
  void anUnresolvableOwnerFailsInsteadOfEmptyingTheOwnerList() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubDirectory(entityMock);
      Table table = tableOwnedBy(TEAM_NAME);

      IllegalArgumentException rejected =
          assertThrows(
              IllegalArgumentException.class,
              () -> apply(table, Map.of("owners", List.of("data-platfrom"), "ownersMode", "set")),
              "findByNameOrNull returning null is not an exception, so an unresolvable name used to"
                  + " be dropped in silence - and with a 'set' one typo wrote an empty list, "
                  + "deleting every owner and reporting success");

      assertTrue(
          rejected.getMessage().contains("data-platfrom"),
          "the error names the entry that did not resolve, so the caller can correct it in one go");
      assertEquals(
          List.of(TEAM_NAME), ownerNamesOf(table), "the existing owner is untouched by a failure");
    }
  }

  @Test
  void aPartiallyResolvableOwnerListFailsWholesale() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubDirectory(entityMock);
      Table table = tableOwnedBy(TEAM_NAME);

      assertThrows(
          IllegalArgumentException.class,
          () -> apply(table, Map.of("owners", List.of(TEAM_NAME, "ghost-team"))),
          "a half-applied owner list is the silent-loss case wearing a success response");
    }
  }

  @Test
  void ownersDefaultToAddSoAnExistingOwnerIsNotReplaced() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubDirectory(entityMock);
      Table table = tableOwnedBy("existing-steward");

      apply(table, Map.of("owners", List.of(TEAM_NAME)));

      assertEquals(
          List.of("existing-steward", TEAM_NAME),
          ownerNamesOf(table),
          "the default must merge: naming one owner is not a request to remove the others");
    }
  }

  @Test
  void aStaleOwnerCanStillBeRemovedAfterItStopsResolving() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubDirectory(entityMock);
      // "departed-user" is an owner of the entity but no longer resolves in the directory - the
      // ordinary state after a user is deleted or deactivated. Requiring resolution here would make
      // the one reference a caller most wants to clear the one they cannot.
      Table table = tableOwnedBy("departed-user");

      apply(table, Map.of("owners", List.of("departed-user"), "ownersMode", "remove"));

      assertEquals(List.of(), ownerNamesOf(table), "the stale owner is gone");
    }
  }

  @Test
  void ownersSetIsStillAReplaceWhenItIsAskedForByName() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubDirectory(entityMock);
      Table table = tableOwnedBy("existing-steward");

      apply(table, Map.of("owners", List.of(TEAM_NAME), "ownersMode", "set"));

      assertEquals(List.of(TEAM_NAME), ownerNamesOf(table), "'set' is a replace, as documented");
    }
  }
}
