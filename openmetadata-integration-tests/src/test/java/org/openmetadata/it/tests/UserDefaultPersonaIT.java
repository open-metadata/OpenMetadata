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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Isolated("Changes the organization-wide default persona")
@ExtendWith(TestNamespaceExtension.class)
class UserDefaultPersonaIT {
  private OpenMetadataClient client;
  private Persona previousDefault;
  private Persona systemDefault;
  private Persona teamDefault;
  private Team team;

  @BeforeEach
  void setUp(TestNamespace ns) {
    client = SdkClients.adminClient();
    previousDefault = findSystemDefault();
    systemDefault = createPersona(ns, "system", true);
    teamDefault = createPersona(ns, "team", false);
    team = createTeam(ns, "group", teamDefault);
  }

  @AfterEach
  void restoreSystemDefault() {
    if (systemDefault != null) {
      client.personas().update(systemDefault.getId().toString(), systemDefault.withDefault(false));
    }
    if (previousDefault != null) {
      client
          .personas()
          .update(previousDefault.getId().toString(), previousDefault.withDefault(true));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"defaultPersona", "defaultPersona,teams,personas"})
  void teamDefaultTakesPrecedenceOverSystemDefault(String fields, TestNamespace ns) {
    final User user = createUser(ns, "member", null);

    assertDefaultPersona(teamDefault, client.users().get(user.getId().toString(), fields));
    assertDefaultPersona(teamDefault, client.users().getByName(user.getName(), fields));
    assertEquals(
        Boolean.TRUE,
        client.users().get(user.getId().toString(), fields).getDefaultPersona().getInherited());
    assertEquals(Boolean.TRUE, listTeamUsers(fields).getFirst().getDefaultPersona().getInherited());
  }

  @ParameterizedTest
  @ValueSource(strings = {"defaultPersona", "defaultPersona,teams,personas"})
  void explicitDefaultTakesPrecedenceOverTeamDefault(String fields, TestNamespace ns) {
    final Persona explicitDefault = createPersona(ns, "explicit", false);
    final User user = createUser(ns, "explicit", explicitDefault);

    assertDefaultPersona(explicitDefault, client.users().get(user.getId().toString(), fields));
    assertDefaultPersona(explicitDefault, client.users().getByName(user.getName(), fields));
    assertFalse(
        Boolean.TRUE.equals(
            client
                .users()
                .get(user.getId().toString(), fields)
                .getDefaultPersona()
                .getInherited()));
  }

  @ParameterizedTest
  @ValueSource(strings = {"defaultPersona", "defaultPersona,teams,personas"})
  void systemDefaultAppliesWhenTeamHasNoDefault(String fields, TestNamespace ns) {
    team = client.teams().get(team.getId().toString(), "defaultPersona");
    client.teams().update(team.getId().toString(), team.withDefaultPersona(null));
    final User user = createUser(ns, "fallback", null);

    assertDefaultPersona(systemDefault, client.users().get(user.getId().toString(), fields));
    assertDefaultPersona(systemDefault, client.users().getByName(user.getName(), fields));
    assertDefaultPersona(systemDefault, listTeamUsers(fields).getFirst());
  }

  @Test
  void teamDefaultAppliesWithoutSystemDefault(TestNamespace ns) {
    client.personas().update(systemDefault.getId().toString(), systemDefault.withDefault(false));
    final User user = createUser(ns, "member", null);

    assertDefaultPersona(
        teamDefault, client.users().get(user.getId().toString(), "defaultPersona"));
    assertDefaultPersona(teamDefault, listTeamUsers("defaultPersona").getFirst());
  }

  @Test
  void defaultIsNullWhenNoLevelHasOne(TestNamespace ns) {
    client.personas().update(systemDefault.getId().toString(), systemDefault.withDefault(false));
    team = client.teams().get(team.getId().toString(), "defaultPersona");
    client.teams().update(team.getId().toString(), team.withDefaultPersona(null));
    final User user = createUser(ns, "member", null);

    assertNull(client.users().get(user.getId().toString(), "defaultPersona").getDefaultPersona());
    assertNull(listTeamUsers("defaultPersona").getFirst().getDefaultPersona());
  }

  @Test
  void explicitlySelectedSystemDefaultTakesPrecedenceOverTeam(TestNamespace ns) {
    final User user = createUser(ns, "explicit", systemDefault);

    assertDefaultPersona(
        systemDefault, client.users().get(user.getId().toString(), "defaultPersona"));
    assertDefaultPersona(systemDefault, listTeamUsers("defaultPersona").getFirst());
  }

  @Test
  void selectingSystemDefaultOverridesInheritedTeamDefault(TestNamespace ns) {
    final User user = createUser(ns, "member", null);
    final User fetched =
        client.users().get(user.getId().toString(), "defaultPersona,teams,personas");
    client
        .users()
        .update(
            user.getId().toString(),
            fetched
                .withPersonas(List.of(systemDefault.getEntityReference()))
                .withDefaultPersona(systemDefault.getEntityReference()));

    assertDefaultPersona(
        systemDefault, client.users().get(user.getId().toString(), "defaultPersona"));
    assertDefaultPersona(systemDefault, listTeamUsers("defaultPersona").getFirst());
  }

  @Test
  void updatingUserDoesNotPinInheritedDefault(TestNamespace ns) {
    final User user = createUser(ns, "member", null);
    final User fetched =
        client.users().get(user.getId().toString(), "defaultPersona,teams,personas");
    client.users().update(user.getId().toString(), fetched.withDescription("Updated profile"));
    final Persona replacement = createPersona(ns, "replacement", false);
    team = client.teams().get(team.getId().toString(), "defaultPersona");
    client
        .teams()
        .update(team.getId().toString(), team.withDefaultPersona(replacement.getEntityReference()));

    assertDefaultPersona(
        replacement, client.users().get(user.getId().toString(), "defaultPersona"));
    assertDefaultPersona(replacement, listTeamUsers("defaultPersona").getFirst());
  }

  @Test
  void replacingUserDoesNotPinInheritedDefault(TestNamespace ns) {
    final User user = createUser(ns, "member", null);
    final User fetched = client.users().get(user.getId().toString(), "defaultPersona");
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/users",
            new CreateUser()
                .withName(user.getName())
                .withEmail(user.getEmail())
                .withTeams(List.of(team.getId()))
                .withDefaultPersona(fetched.getDefaultPersona())
                .withDescription("Updated profile"),
            User.class);
    final Persona replacement = createPersona(ns, "replacement", false);
    team = client.teams().get(team.getId().toString(), "defaultPersona");
    client
        .teams()
        .update(team.getId().toString(), team.withDefaultPersona(replacement.getEntityReference()));

    assertDefaultPersona(
        replacement, client.users().get(user.getId().toString(), "defaultPersona"));
  }

  @Test
  void inheritedPersonaCanBeSavedAndClearedAsAnExplicitDefault(TestNamespace ns) {
    final User user = createUser(ns, "member", null);
    final User fetched = client.users().get(user.getId().toString(), "defaultPersona");
    client
        .users()
        .update(
            user.getId().toString(),
            fetched.withDefaultPersona(teamDefault.getEntityReference().withInherited(false)));

    final User saved = client.users().get(user.getId().toString(), "defaultPersona");
    assertDefaultPersona(teamDefault, saved);
    assertFalse(Boolean.TRUE.equals(saved.getDefaultPersona().getInherited()));

    final Persona replacement = createPersona(ns, "replacement", false);
    team = client.teams().get(team.getId().toString(), "defaultPersona");
    client
        .teams()
        .update(team.getId().toString(), team.withDefaultPersona(replacement.getEntityReference()));
    assertDefaultPersona(
        teamDefault, client.users().get(user.getId().toString(), "defaultPersona"));

    client
        .users()
        .patch(
            user.getId(), JsonUtils.readTree("[{\"op\":\"remove\",\"path\":\"/defaultPersona\"}]"));
    final User cleared = client.users().get(user.getId().toString(), "defaultPersona");
    assertDefaultPersona(replacement, cleared);
    assertEquals(Boolean.TRUE, cleared.getDefaultPersona().getInherited());
  }

  @ParameterizedTest
  @ValueSource(strings = {"defaultPersona", "defaultPersona,teams,personas"})
  void deletedTeamDefaultIsIgnored(String fields, TestNamespace ns) {
    final Team deletedTeam = team;
    team = createTeam(ns, "remaining", null);
    final User user = createUser(ns, "member", null);
    addTeam(user, deletedTeam);
    client.teams().delete(deletedTeam.getId().toString());

    assertDefaultPersona(systemDefault, client.users().get(user.getId().toString(), fields));
    assertDefaultPersona(systemDefault, listTeamUsers(fields).getFirst());
  }

  @Test
  void multipleTeamsResolveConsistentlyAcrossReadPaths(TestNamespace ns) {
    final Persona otherDefault = createPersona(ns, "other", false);
    final Team otherTeam = createTeam(ns, "other", otherDefault);
    final User user = createUser(ns, "member", null);
    addTeam(user, otherTeam);

    final User fetched = client.users().get(user.getId().toString(), "defaultPersona");
    assertNotNull(fetched.getDefaultPersona());
    assertTrue(
        Set.of(teamDefault.getId(), otherDefault.getId())
            .contains(fetched.getDefaultPersona().getId()));
    assertEquals(
        fetched.getDefaultPersona().getId(),
        client
            .users()
            .getByName(user.getName(), "defaultPersona,teams,personas")
            .getDefaultPersona()
            .getId());
    assertEquals(
        fetched.getDefaultPersona().getId(),
        listTeamUsers("defaultPersona").getFirst().getDefaultPersona().getId());
  }

  @ParameterizedTest
  @ValueSource(strings = {"defaultPersona", "defaultPersona,teams,personas"})
  void listRespectsDefaultPersonaPrecedence(String fields, TestNamespace ns) {
    final User member = createUser(ns, "member", null);
    final Persona explicitDefault = createPersona(ns, "explicit", false);
    final User explicit = createUser(ns, "explicit", explicitDefault);
    final List<User> users = listTeamUsers(fields);

    assertDefaultPersona(
        teamDefault,
        users.stream()
            .filter(user -> user.getId().equals(member.getId()))
            .findFirst()
            .orElseThrow());
    assertDefaultPersona(
        explicitDefault,
        users.stream()
            .filter(user -> user.getId().equals(explicit.getId()))
            .findFirst()
            .orElseThrow());
  }

  private Persona createPersona(TestNamespace ns, String suffix, boolean isDefault) {
    return ns.trackRoot(
        Entity.PERSONA,
        client
            .personas()
            .create(new CreatePersona().withName(ns.shortPrefix(suffix)).withDefault(isDefault)));
  }

  private User createUser(TestNamespace ns, String suffix, Persona explicitDefault) {
    final CreateUser request =
        new CreateUser()
            .withName(ns.shortPrefix(suffix))
            .withEmail(ns.shortPrefix(suffix) + "@test.openmetadata.org")
            .withTeams(List.of(team.getId()));
    if (explicitDefault != null) {
      request
          .withPersonas(List.of(explicitDefault.getEntityReference()))
          .withDefaultPersona(explicitDefault.getEntityReference());
    }
    return ns.trackRoot(Entity.USER, client.users().create(request));
  }

  private Team createTeam(TestNamespace ns, String suffix, Persona defaultPersona) {
    return ns.trackRoot(
        Entity.TEAM,
        client
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.shortPrefix(suffix))
                    .withTeamType(TeamType.GROUP)
                    .withDefaultPersona(defaultPersona == null ? null : defaultPersona.getId())));
  }

  private void addTeam(User user, Team additionalTeam) {
    final User fetched = client.users().get(user.getId().toString(), "teams");
    client
        .users()
        .update(
            user.getId().toString(),
            fetched.withTeams(
                List.of(team.getEntityReference(), additionalTeam.getEntityReference())));
  }

  private Persona findSystemDefault() {
    final ListParams params = new ListParams().withLimit(100);
    ListResponse<Persona> page;
    do {
      page = client.personas().list(params);
      for (Persona persona : page.getData()) {
        if (Boolean.TRUE.equals(persona.getDefault())) {
          return persona;
        }
      }
      params.withAfter(page.getPaging().getAfter());
    } while (page.hasNextPage());
    return null;
  }

  private List<User> listTeamUsers(String fields) {
    return client
        .users()
        .list(new ListParams().setFields(fields).addQueryParam("team", team.getName()))
        .getData();
  }

  private void assertDefaultPersona(Persona expected, User user) {
    assertNotNull(user.getDefaultPersona());
    assertEquals(expected.getId(), user.getDefaultPersona().getId());
  }
}
