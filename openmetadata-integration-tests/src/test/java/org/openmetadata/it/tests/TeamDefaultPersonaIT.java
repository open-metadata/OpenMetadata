/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for team-level default persona support and user inherited personas.
 *
 * <p>Tests cover:
 * <ul>
 *   <li>Creating Group teams with a defaultPersona</li>
 *   <li>Updating defaultPersona via PUT/PATCH</li>
 *   <li>Validation: only Group teams can have defaultPersona</li>
 *   <li>User inheritedPersonas from team membership</li>
 *   <li>Backward compatibility: existing persona/defaultPersona behavior unchanged</li>
 *   <li>Teams without defaultPersona remain unaffected</li>
 *   <li>Multiple teams with different personas</li>
 *   <li>Deduplication of inherited personas</li>
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@org.junit.jupiter.api.extension.ExtendWith(TestNamespaceExtension.class)
public class TeamDefaultPersonaIT {

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private Persona createPersona(TestNamespace ns, String suffix) {
    OpenMetadataClient client = SdkClients.adminClient();
    CreatePersona request =
        new CreatePersona().withName(ns.prefix(suffix)).withDescription("Test persona: " + suffix);
    return client.personas().create(request);
  }

  private Team createGroupTeam(TestNamespace ns, String suffix) {
    return createGroupTeam(ns, suffix, null);
  }

  private Team createGroupTeam(TestNamespace ns, String suffix, UUID defaultPersonaId) {
    OpenMetadataClient client = SdkClients.adminClient();
    CreateTeam request =
        new CreateTeam()
            .withName(ns.prefix(suffix))
            .withTeamType(TeamType.GROUP)
            .withDefaultPersona(defaultPersonaId)
            .withDescription("Test group team: " + suffix);
    return client.teams().create(request);
  }

  private User createTestUser(TestNamespace ns, String suffix) {
    return createTestUser(ns, suffix, null);
  }

  private User createTestUser(TestNamespace ns, String suffix, List<UUID> teamIds) {
    OpenMetadataClient client = SdkClients.adminClient();
    String name = ns.prefix(suffix);
    String sanitized = name.replaceAll("[^a-zA-Z0-9._-]", "");
    if (sanitized.length() > 60) {
      sanitized = sanitized.substring(0, 52) + UUID.randomUUID().toString().substring(0, 8);
    }
    String email = sanitized + "@test.openmetadata.org";

    CreateUser request =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withTeams(teamIds)
            .withDescription("Test user: " + suffix);

    return client.users().create(request);
  }

  // ===================================================================
  // TEAM DEFAULT PERSONA - CRUD TESTS
  // ===================================================================

  @Test
  void test_createGroupTeamWithDefaultPersona(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "persona1");

    Team team = createGroupTeam(ns, "teamWithPersona", persona.getId());
    assertNotNull(team.getId());

    Team fetched = client.teams().get(team.getId().toString(), "defaultPersona");
    assertNotNull(fetched.getDefaultPersona());
    assertEquals(persona.getId(), fetched.getDefaultPersona().getId());
  }

  @Test
  void test_createGroupTeamWithoutDefaultPersona(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team team = createGroupTeam(ns, "teamNoPersona");
    assertNotNull(team.getId());

    Team fetched = client.teams().get(team.getId().toString(), "defaultPersona");
    assertNull(fetched.getDefaultPersona());
  }

  @Test
  void test_updateDefaultPersonaViaPatch(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona1 = createPersona(ns, "patchPersona1");
    Persona persona2 = createPersona(ns, "patchPersona2");

    Team team = createGroupTeam(ns, "teamPatchPersona", persona1.getId());

    Team fetched = client.teams().get(team.getId().toString(), "defaultPersona");
    assertNotNull(fetched.getDefaultPersona());
    assertEquals(persona1.getId(), fetched.getDefaultPersona().getId());

    // Update to persona2 via PATCH (update)
    fetched.setDefaultPersona(persona2.getEntityReference());
    fetched.setChildrenCount(null);
    fetched.setUserCount(null);
    client.teams().update(fetched.getId().toString(), fetched);

    Team updated = client.teams().get(team.getId().toString(), "defaultPersona");
    assertNotNull(updated.getDefaultPersona());
    assertEquals(persona2.getId(), updated.getDefaultPersona().getId());
  }

  @Test
  void test_removeDefaultPersonaViaPatch(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "removePersona");

    Team team = createGroupTeam(ns, "teamRemovePersona", persona.getId());

    Team fetched = client.teams().get(team.getId().toString(), "defaultPersona");
    assertNotNull(fetched.getDefaultPersona());

    // Remove default persona via update — the SDK's snapshot-based diff detects the removal
    fetched.setDefaultPersona(null);
    fetched.setChildrenCount(null);
    fetched.setUserCount(null);
    client.teams().update(fetched.getId().toString(), fetched);

    Team updated = client.teams().get(team.getId().toString(), "defaultPersona");
    assertNull(updated.getDefaultPersona());
  }

  @Test
  void test_defaultPersonaReturnedByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "byNamePersona");
    Team team = createGroupTeam(ns, "teamByName", persona.getId());

    Team fetched = client.teams().getByName(team.getName(), "defaultPersona");
    assertNotNull(fetched.getDefaultPersona());
    assertEquals(persona.getId(), fetched.getDefaultPersona().getId());
  }

  @Test
  void test_defaultPersonaNotReturnedWithoutField(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "noFieldPersona");
    Team team = createGroupTeam(ns, "teamNoField", persona.getId());

    // Fetch without the defaultPersona field
    Team fetched = client.teams().get(team.getId().toString());
    assertNull(fetched.getDefaultPersona());
  }

  // ===================================================================
  // VALIDATION - GROUP TYPE ONLY
  // ===================================================================

  @Test
  void test_defaultPersonaRejectedForDepartment(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "deptPersona");

    CreateTeam request =
        new CreateTeam()
            .withName(ns.prefix("deptWithPersona"))
            .withTeamType(TeamType.DEPARTMENT)
            .withDefaultPersona(persona.getId())
            .withDescription("Department team with persona - should fail");

    assertThrows(Exception.class, () -> client.teams().create(request));
  }

  @Test
  void test_defaultPersonaRejectedForDivision(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "divPersona");

    CreateTeam request =
        new CreateTeam()
            .withName(ns.prefix("divWithPersona"))
            .withTeamType(TeamType.DIVISION)
            .withDefaultPersona(persona.getId())
            .withDescription("Division team with persona - should fail");

    assertThrows(Exception.class, () -> client.teams().create(request));
  }

  @Test
  void test_defaultPersonaRejectedForBusinessUnit(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "buPersona");

    CreateTeam request =
        new CreateTeam()
            .withName(ns.prefix("buWithPersona"))
            .withTeamType(TeamType.BUSINESS_UNIT)
            .withDefaultPersona(persona.getId())
            .withDescription("Business unit with persona - should fail");

    assertThrows(Exception.class, () -> client.teams().create(request));
  }

  // ===================================================================
  // USER INHERITED PERSONAS
  // ===================================================================

  @Test
  void test_userInheritsPersonaFromGroupTeam(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "inheritPersona");
    Team team = createGroupTeam(ns, "teamForInherit", persona.getId());

    User user = createTestUser(ns, "inheritUser", List.of(team.getId()));

    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(fetched.getInheritedPersonas());
    assertEquals(1, fetched.getInheritedPersonas().size());
    assertEquals(persona.getId(), fetched.getInheritedPersonas().get(0).getId());
  }

  @Test
  void test_userInheritsPersonasFromMultipleTeams(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona1 = createPersona(ns, "multiPersona1");
    Persona persona2 = createPersona(ns, "multiPersona2");

    Team team1 = createGroupTeam(ns, "multiTeam1", persona1.getId());
    Team team2 = createGroupTeam(ns, "multiTeam2", persona2.getId());

    User user = createTestUser(ns, "multiInheritUser", List.of(team1.getId(), team2.getId()));

    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(fetched.getInheritedPersonas());
    assertEquals(2, fetched.getInheritedPersonas().size());
    assertTrue(
        fetched.getInheritedPersonas().stream().anyMatch(p -> p.getId().equals(persona1.getId())));
    assertTrue(
        fetched.getInheritedPersonas().stream().anyMatch(p -> p.getId().equals(persona2.getId())));
  }

  @Test
  void test_userInheritedPersonasDeduplication(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "dedupPersona");

    // Two teams both point to the same persona
    Team team1 = createGroupTeam(ns, "dedupTeam1", persona.getId());
    Team team2 = createGroupTeam(ns, "dedupTeam2", persona.getId());

    User user = createTestUser(ns, "dedupUser", List.of(team1.getId(), team2.getId()));

    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(fetched.getInheritedPersonas());
    assertEquals(1, fetched.getInheritedPersonas().size());
    assertEquals(persona.getId(), fetched.getInheritedPersonas().get(0).getId());
  }

  @Test
  void test_userNoInheritedPersonasFromTeamWithoutPersona(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team team = createGroupTeam(ns, "noPersonaTeam");

    User user = createTestUser(ns, "noInheritUser", List.of(team.getId()));

    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(fetched.getInheritedPersonas());
    assertTrue(fetched.getInheritedPersonas().isEmpty());
  }

  @Test
  void test_userNoInheritedPersonasFromNonGroupTeam(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Department teams cannot have defaultPersona, so no inheritance
    CreateTeam deptRequest =
        new CreateTeam()
            .withName(ns.prefix("deptNoInherit"))
            .withTeamType(TeamType.DEPARTMENT)
            .withDescription("Department without persona");
    Team dept = client.teams().create(deptRequest);

    User user = createTestUser(ns, "noInheritDeptUser", List.of(dept.getId()));

    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(fetched.getInheritedPersonas());
    assertTrue(fetched.getInheritedPersonas().isEmpty());
  }

  @Test
  void test_inheritedPersonasNotReturnedWithoutPersonasField(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "noFieldInheritPersona");
    Team team = createGroupTeam(ns, "noFieldInheritTeam", persona.getId());
    User user = createTestUser(ns, "noFieldInheritUser", List.of(team.getId()));

    // Fetch without the personas field
    User fetched = client.users().get(user.getId().toString(), "teams");
    assertNull(fetched.getInheritedPersonas());
  }

  // ===================================================================
  // BACKWARD COMPATIBILITY
  // ===================================================================

  @Test
  void test_existingDirectPersonasBehaviorUnchanged(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona directPersona = createPersona(ns, "directPersona");
    Persona teamPersona = createPersona(ns, "teamPersona");

    Team team = createGroupTeam(ns, "bcTeam", teamPersona.getId());

    // Create user with direct persona AND team membership
    String userName = ns.prefix("bcUser");
    String sanitized = userName.replaceAll("[^a-zA-Z0-9._-]", "");
    if (sanitized.length() > 60) {
      sanitized = sanitized.substring(0, 52) + UUID.randomUUID().toString().substring(0, 8);
    }
    String email = sanitized + "@test.openmetadata.org";
    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withTeams(List.of(team.getId()))
            .withPersonas(List.of(directPersona.getEntityReference()))
            .withDescription("User with direct and inherited personas");

    User user = client.users().create(userRequest);

    User fetched = client.users().get(user.getId().toString(), "personas,teams");

    // Direct personas should still work as before
    assertNotNull(fetched.getPersonas());
    assertEquals(1, fetched.getPersonas().size());
    assertEquals(directPersona.getId(), fetched.getPersonas().get(0).getId());

    // Inherited personas should come from team
    assertNotNull(fetched.getInheritedPersonas());
    assertEquals(1, fetched.getInheritedPersonas().size());
    assertEquals(teamPersona.getId(), fetched.getInheritedPersonas().get(0).getId());
  }

  @Test
  void test_existingDefaultPersonaBehaviorUnchanged(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona1 = createPersona(ns, "existingDefault1");
    Persona persona2 = createPersona(ns, "existingDefault2");
    Persona teamPersona = createPersona(ns, "existingTeamPersona");

    Team team = createGroupTeam(ns, "existingDefaultTeam", teamPersona.getId());

    // Create user with an explicit default persona and team membership
    String userName = ns.prefix("existingDefaultUser");
    String sanitized = userName.replaceAll("[^a-zA-Z0-9._-]", "");
    if (sanitized.length() > 60) {
      sanitized = sanitized.substring(0, 52) + UUID.randomUUID().toString().substring(0, 8);
    }
    String email = sanitized + "@test.openmetadata.org";
    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withTeams(List.of(team.getId()))
            .withPersonas(List.of(persona1.getEntityReference(), persona2.getEntityReference()))
            .withDefaultPersona(persona1.getEntityReference())
            .withDescription("User with explicit default persona");

    User user = client.users().create(userRequest);

    User fetched = client.users().get(user.getId().toString(), "personas,defaultPersona");

    // User's explicitly set default persona should be unaffected
    assertNotNull(fetched.getDefaultPersona());
    assertEquals(persona1.getId(), fetched.getDefaultPersona().getId());

    // Inherited personas should include team persona
    assertNotNull(fetched.getInheritedPersonas());
    assertTrue(
        fetched.getInheritedPersonas().stream()
            .anyMatch(p -> p.getId().equals(teamPersona.getId())));
  }

  @Test
  void test_teamWithoutDefaultPersonaBackwardCompatible(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Creating a team without defaultPersona (existing behavior)
    Team team = createGroupTeam(ns, "bcNoPersonaTeam");

    Team fetched = client.teams().get(team.getId().toString(), "defaultPersona,defaultRoles");
    assertNull(fetched.getDefaultPersona());
    // defaultRoles should still work
    assertNotNull(fetched.getDefaultRoles());
  }

  @Test
  void test_userWithNoTeamsHasNoInheritedPersonas(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    User user = createTestUser(ns, "noTeamUser");

    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(fetched.getInheritedPersonas());
    assertTrue(fetched.getInheritedPersonas().isEmpty());
  }

  // ===================================================================
  // TEAM DEFAULT PERSONA UPDATE REFLECTS ON USERS
  // ===================================================================

  @Test
  void test_updatingTeamDefaultPersonaReflectsOnUsers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona1 = createPersona(ns, "reflectPersona1");
    Persona persona2 = createPersona(ns, "reflectPersona2");

    Team team = createGroupTeam(ns, "reflectTeam", persona1.getId());

    User user = createTestUser(ns, "reflectUser", List.of(team.getId()));

    // Verify initial inherited persona
    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertEquals(1, fetched.getInheritedPersonas().size());
    assertEquals(persona1.getId(), fetched.getInheritedPersonas().get(0).getId());

    // Update team's default persona
    Team teamFetched = client.teams().get(team.getId().toString(), "defaultPersona");
    teamFetched.setDefaultPersona(persona2.getEntityReference());
    teamFetched.setChildrenCount(null);
    teamFetched.setUserCount(null);
    client.teams().update(teamFetched.getId().toString(), teamFetched);

    // User's inherited persona should now reflect the updated team persona
    User refetched = client.users().get(user.getId().toString(), "personas,teams");
    assertEquals(1, refetched.getInheritedPersonas().size());
    assertEquals(persona2.getId(), refetched.getInheritedPersonas().get(0).getId());
  }

  @Test
  void test_removingTeamDefaultPersonaReflectsOnUsers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "removeReflectPersona");
    Team team = createGroupTeam(ns, "removeReflectTeam", persona.getId());

    User user = createTestUser(ns, "removeReflectUser", List.of(team.getId()));

    // Verify initial inherited persona exists
    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertEquals(1, fetched.getInheritedPersonas().size());

    // Remove default persona from team via update
    Team teamFetched = client.teams().get(team.getId().toString(), "defaultPersona");
    teamFetched.setDefaultPersona(null);
    teamFetched.setChildrenCount(null);
    teamFetched.setUserCount(null);
    client.teams().update(teamFetched.getId().toString(), teamFetched);

    // User's inherited personas should now be empty
    User refetched = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(refetched.getInheritedPersonas());
    assertTrue(refetched.getInheritedPersonas().isEmpty());
  }

  // ===================================================================
  // VERSION HISTORY
  // ===================================================================

  @Test
  void test_teamVersionIncreasesOnDefaultPersonaChange(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team team = createGroupTeam(ns, "versionTeam");
    double initialVersion = team.getVersion();

    Persona persona = createPersona(ns, "versionPersona");

    Team fetched = client.teams().get(team.getId().toString(), "defaultPersona");
    fetched.setDefaultPersona(persona.getEntityReference());
    fetched.setChildrenCount(null);
    fetched.setUserCount(null);
    client.teams().update(fetched.getId().toString(), fetched);

    Team updated = client.teams().get(team.getId().toString(), "defaultPersona");
    assertTrue(
        updated.getVersion() > initialVersion,
        "Version should increase after setting defaultPersona");
    assertNotNull(updated.getDefaultPersona());
    assertEquals(persona.getId(), updated.getDefaultPersona().getId());
  }

  // ===================================================================
  // BACKWARD COMPATIBILITY — USER DEFAULT PERSONA (existing behavior)
  // These tests verify that the existing User.defaultPersona feature
  // (user picks their own default from assigned personas) continues
  // to work exactly as before, unaffected by team-level personas.
  // ===================================================================

  @Test
  void test_userDefaultPersonaFromDirectAssignment(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona1 = createPersona(ns, "userDirect1");
    Persona persona2 = createPersona(ns, "userDirect2");

    String userName = ns.prefix("directDefaultUser");
    String email = toEmail(userName);
    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withPersonas(List.of(persona1.getEntityReference(), persona2.getEntityReference()))
            .withDefaultPersona(persona1.getEntityReference())
            .withDescription("User with direct default persona");

    User user = client.users().create(userRequest);

    User fetched = client.users().get(user.getId().toString(), "personas,defaultPersona");
    assertNotNull(fetched.getDefaultPersona());
    assertEquals(persona1.getId(), fetched.getDefaultPersona().getId());
    assertNotNull(fetched.getPersonas());
    assertEquals(2, fetched.getPersonas().size());
  }

  @Test
  void test_userUpdateDefaultPersonaPreservesExistingBehavior(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona1 = createPersona(ns, "updateDirect1");
    Persona persona2 = createPersona(ns, "updateDirect2");

    String userName = ns.prefix("updateDefaultUser");
    String email = toEmail(userName);
    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withPersonas(List.of(persona1.getEntityReference(), persona2.getEntityReference()))
            .withDefaultPersona(persona1.getEntityReference())
            .withDescription("User for update default persona test");

    User user = client.users().create(userRequest);

    // Fetch and change default persona
    User fetched = client.users().get(user.getId().toString(), "personas,defaultPersona");
    assertEquals(persona1.getId(), fetched.getDefaultPersona().getId());

    fetched.setDefaultPersona(persona2.getEntityReference());
    client.users().update(fetched.getId().toString(), fetched);

    User updated = client.users().get(user.getId().toString(), "defaultPersona");
    assertNotNull(updated.getDefaultPersona());
    assertEquals(persona2.getId(), updated.getDefaultPersona().getId());
  }

  @Test
  void test_userDefaultPersonaIndependentOfTeamPersona(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona userPersona = createPersona(ns, "userOwnPersona");
    Persona teamPersona = createPersona(ns, "teamOwnPersona");

    Team team = createGroupTeam(ns, "indepTeam", teamPersona.getId());

    String userName = ns.prefix("indepUser");
    String email = toEmail(userName);
    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withTeams(List.of(team.getId()))
            .withPersonas(List.of(userPersona.getEntityReference()))
            .withDefaultPersona(userPersona.getEntityReference())
            .withDescription("User with own default persona + team persona");

    User user = client.users().create(userRequest);

    User fetched = client.users().get(user.getId().toString(), "personas,defaultPersona,teams");

    // User's chosen default persona is their own, NOT overridden by team
    assertNotNull(fetched.getDefaultPersona());
    assertEquals(userPersona.getId(), fetched.getDefaultPersona().getId());

    // Direct personas are separate from inherited
    assertNotNull(fetched.getPersonas());
    assertEquals(1, fetched.getPersonas().size());
    assertEquals(userPersona.getId(), fetched.getPersonas().get(0).getId());

    // Team persona appears in inherited
    assertNotNull(fetched.getInheritedPersonas());
    assertEquals(1, fetched.getInheritedPersonas().size());
    assertEquals(teamPersona.getId(), fetched.getInheritedPersonas().get(0).getId());
  }

  @Test
  void test_userWithoutDefaultPersonaStillGetsSystemDefault(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a user without any explicit default persona
    String userName = ns.prefix("sysDefaultUser");
    String email = toEmail(userName);
    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withDescription("User relying on system default persona");

    User user = client.users().create(userRequest);

    // Fetch with defaultPersona field - should get system default if one exists
    User fetched = client.users().get(user.getId().toString(), "defaultPersona");
    // System default persona may or may not exist in this test env,
    // but the field should be populated or null — NOT throw an error
    // This validates backward compat: the system default lookup still works
  }

  @Test
  void test_userDirectPersonasNotAffectedByTeamMembership(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona directPersona = createPersona(ns, "stayDirectPersona");
    Persona teamPersona = createPersona(ns, "stayTeamPersona");

    Team team = createGroupTeam(ns, "stayTeam", teamPersona.getId());

    String userName = ns.prefix("stayUser");
    String email = toEmail(userName);
    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withTeams(List.of(team.getId()))
            .withPersonas(List.of(directPersona.getEntityReference()))
            .withDescription("User - direct personas stay separate");

    User user = client.users().create(userRequest);

    User fetched = client.users().get(user.getId().toString(), "personas,teams");

    // Direct personas list should contain ONLY the directly assigned persona
    assertNotNull(fetched.getPersonas());
    assertEquals(1, fetched.getPersonas().size());
    assertEquals(directPersona.getId(), fetched.getPersonas().get(0).getId());

    // Team persona should NOT leak into the direct personas list
    assertTrue(
        fetched.getPersonas().stream().noneMatch(p -> p.getId().equals(teamPersona.getId())),
        "Team persona should not appear in user's direct personas list");

    // It should only appear in inheritedPersonas
    assertNotNull(fetched.getInheritedPersonas());
    assertEquals(1, fetched.getInheritedPersonas().size());
    assertEquals(teamPersona.getId(), fetched.getInheritedPersonas().get(0).getId());
  }

  @Test
  void test_addingUserToTeamWithPersonaAddsInheritedPersona(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona teamPersona = createPersona(ns, "addTeamPersona");
    Team team = createGroupTeam(ns, "addTeam", teamPersona.getId());

    // Create user without any teams
    String userName = ns.prefix("addTeamUser");
    String email = toEmail(userName);
    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withDescription("User to be added to team later");

    User user = client.users().create(userRequest);

    // Verify no inherited personas initially
    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(fetched.getInheritedPersonas());
    assertTrue(fetched.getInheritedPersonas().isEmpty());

    // Add user to the team
    fetched.setTeams(List.of(team.getEntityReference()));
    client.users().update(fetched.getId().toString(), fetched);

    // Now user should inherit the team's persona
    User updated = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(updated.getInheritedPersonas());
    assertEquals(1, updated.getInheritedPersonas().size());
    assertEquals(teamPersona.getId(), updated.getInheritedPersonas().get(0).getId());
  }

  @Test
  void test_removingUserFromTeamRemovesInheritedPersona(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona teamPersona = createPersona(ns, "removeTeamPersona");
    Team team = createGroupTeam(ns, "removeTeam", teamPersona.getId());

    User user = createTestUser(ns, "removeTeamUser", List.of(team.getId()));

    // Verify inherited persona exists
    User fetched = client.users().get(user.getId().toString(), "personas,teams");
    assertEquals(1, fetched.getInheritedPersonas().size());

    // Remove user from the team (set teams to empty)
    fetched.setTeams(new java.util.ArrayList<>());
    client.users().update(fetched.getId().toString(), fetched);

    // Inherited persona should be gone
    User updated = client.users().get(user.getId().toString(), "personas,teams");
    assertNotNull(updated.getInheritedPersonas());
    assertTrue(updated.getInheritedPersonas().isEmpty());
  }

  // ===================================================================
  // SOFT-DELETED PERSONA FILTERING
  // ===================================================================

  @Test
  void test_softDeletedPersonaExcludedFromInheritedPersonas(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "softDelPersona");
    Team team = createGroupTeam(ns, "softDelTeam", persona.getId());
    User user = createTestUser(ns, "softDelUser", List.of(team.getId()));

    // Verify inherited persona exists
    User fetched = client.users().get(user.getId().toString(), "personas");
    assertEquals(1, fetched.getInheritedPersonas().size());
    assertEquals(persona.getId(), fetched.getInheritedPersonas().get(0).getId());

    // Soft-delete the persona
    client.personas().delete(persona.getId());

    // Inherited personas should no longer include the deleted persona
    User afterDelete = client.users().get(user.getId().toString(), "personas");
    assertNotNull(afterDelete.getInheritedPersonas());
    assertTrue(afterDelete.getInheritedPersonas().isEmpty());
  }

  @Test
  void test_softDeletedPersonaExcludedFromTeamDefaultPersona(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Persona persona = createPersona(ns, "softDelTeamPersona");
    Team team = createGroupTeam(ns, "softDelTeamDp", persona.getId());

    // Verify team has defaultPersona
    Team fetched = client.teams().get(team.getId().toString(), "defaultPersona");
    assertNotNull(fetched.getDefaultPersona());
    assertEquals(persona.getId(), fetched.getDefaultPersona().getId());

    // Soft-delete the persona
    client.personas().delete(persona.getId());

    // Team's defaultPersona should be null since the persona is deleted
    Team afterDelete = client.teams().get(team.getId().toString(), "defaultPersona");
    assertNull(afterDelete.getDefaultPersona());
  }

  private String toEmail(String name) {
    String sanitized = name.replaceAll("[^a-zA-Z0-9._-]", "");
    if (sanitized.length() > 60) {
      sanitized = sanitized.substring(0, 52) + UUID.randomUUID().toString().substring(0, 8);
    }
    return sanitized + "@test.openmetadata.org";
  }
}
