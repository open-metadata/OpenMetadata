/*
 *  Copyright 2026 Collate
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

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class ActivePersonaHeaderIT {
  private static final String ACTIVE_PERSONA_HEADER = "X-OpenMetadata-Persona";
  private static final String IMPERSONATE_USER_HEADER = "X-Impersonate-User";
  private static final String MY_PERSONA_CONTEXT_PATH = "/v1/personas/me/context?format=json";

  @Test
  void activePersonaHeaderSelectsAssignedPersonaAndFallsBackToDefault(TestNamespace ns) {
    Persona defaultPersona = createPersona(ns, "default");
    Persona selectedPersona = createPersona(ns, "selected");
    Persona unassignedPersona = createPersona(ns, "unassigned");
    User user =
        createUser(
            ns,
            "direct_user",
            new CreateUser()
                .withPersonas(
                    List.of(
                        defaultPersona.getEntityReference(), selectedPersona.getEntityReference()))
                .withDefaultPersona(defaultPersona.getEntityReference()));

    assertEquals(defaultPersona.getId().toString(), activePersonaId(user, null));
    assertEquals(
        selectedPersona.getId().toString(),
        activePersonaId(user, selectedPersona.getId().toString()));
    assertEquals(
        selectedPersona.getId().toString(),
        activePersonaId(user, selectedPersona.getName().toUpperCase(Locale.ROOT)));
    assertEquals(
        defaultPersona.getId().toString(),
        activePersonaId(user, unassignedPersona.getId().toString()));
    assertEquals(defaultPersona.getId().toString(), activePersonaId(user, "stale-persona"));
  }

  @Test
  void activePersonaHeaderSelectsTeamInheritedPersona(TestNamespace ns) {
    Persona inheritedPersona = createPersona(ns, "inherited");
    User user = createUser(ns, "inherited_user", new CreateUser());
    ns.trackRoot(
        Entity.TEAM,
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.shortPrefix("active_persona_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withUsers(List.of(user.getId()))
                    .withDefaultPersona(inheritedPersona.getId())));

    assertEquals(
        inheritedPersona.getId().toString(),
        activePersonaId(user, inheritedPersona.getId().toString()));
  }

  @Test
  void personaSideAssignmentsInvalidateCachedUserContext(TestNamespace ns) {
    Persona defaultPersona = createPersona(ns, "cache_default");
    Persona selectedPersona = createPersona(ns, "cache_selected");
    User user =
        createUser(
            ns,
            "cache_user",
            new CreateUser()
                .withPersonas(List.of(defaultPersona.getEntityReference()))
                .withDefaultPersona(defaultPersona.getEntityReference()));

    assertEquals(
        defaultPersona.getId().toString(),
        activePersonaId(user, selectedPersona.getId().toString()));

    Persona personaWithUsers =
        SdkClients.adminClient().personas().get(selectedPersona.getId().toString(), "users");
    personaWithUsers.setUsers(List.of(new EntityReference().withId(user.getId())));
    SdkClients.adminClient()
        .personas()
        .update(selectedPersona.getId().toString(), personaWithUsers);
    assertEquals(
        selectedPersona.getId().toString(),
        activePersonaId(user, selectedPersona.getId().toString()));

    personaWithUsers =
        SdkClients.adminClient().personas().get(selectedPersona.getId().toString(), "users");
    personaWithUsers.setUsers(List.of());
    SdkClients.adminClient()
        .personas()
        .update(selectedPersona.getId().toString(), personaWithUsers);
    assertEquals(
        defaultPersona.getId().toString(),
        activePersonaId(user, selectedPersona.getId().toString()));
  }

  @Test
  void userDefaultPersonaChangeInvalidatesCachedUserContext(TestNamespace ns) {
    Persona originalDefault = createPersona(ns, "original_default");
    Persona updatedDefault = createPersona(ns, "updated_default");
    User user =
        createUser(
            ns,
            "updated_default_user",
            new CreateUser()
                .withPersonas(
                    List.of(
                        originalDefault.getEntityReference(), updatedDefault.getEntityReference()))
                .withDefaultPersona(originalDefault.getEntityReference()));

    assertEquals(originalDefault.getId().toString(), activePersonaId(user, null));

    User updatedUser =
        SdkClients.adminClient().users().get(user.getId().toString(), "personas,defaultPersona");
    updatedUser.setDefaultPersona(updatedDefault.getEntityReference());
    SdkClients.adminClient().users().update(user.getId().toString(), updatedUser);

    assertEquals(updatedDefault.getId().toString(), activePersonaId(user, null));
  }

  @Test
  void activePersonaResolvesAgainstImpersonatedUser(TestNamespace ns) {
    Persona defaultPersona = createPersona(ns, "impersonated_default");
    Persona selectedPersona = createPersona(ns, "impersonated_selected");
    User targetUser =
        createUser(
            ns,
            "impersonated_user",
            new CreateUser()
                .withPersonas(
                    List.of(
                        defaultPersona.getEntityReference(), selectedPersona.getEntityReference()))
                .withDefaultPersona(defaultPersona.getEntityReference()));
    User botUser = createBotUser(ns);
    Bot bot =
        SdkClients.adminClient()
            .bots()
            .create(
                new CreateBot()
                    .withName(ns.shortPrefix("active_persona_bot"))
                    .withDescription("Active persona impersonation integration test")
                    .withBotUser(botUser.getName())
                    .withAllowImpersonation(true));

    try {
      JWTAuthMechanism authentication =
          SdkClients.adminClient().users().generateToken(botUser.getId(), JWTTokenExpiry.Seven);
      assertEquals(
          selectedPersona.getId().toString(),
          activePersonaId(
              authentication.getJWTToken(),
              selectedPersona.getId().toString(),
              targetUser.getName()));
    } finally {
      SdkClients.adminClient().bots().delete(bot.getId().toString());
    }
  }

  private Persona createPersona(TestNamespace ns, String suffix) {
    return ns.trackRoot(
        Entity.PERSONA,
        SdkClients.adminClient()
            .personas()
            .create(
                new CreatePersona()
                    .withName(ns.shortPrefix("active_persona_" + suffix))
                    .withDescription("Active persona header integration test")));
  }

  private User createUser(TestNamespace ns, String suffix, CreateUser request) {
    String name = ns.shortPrefix("active_persona_" + suffix);
    request.withName(name).withEmail(name + "@example.com");
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private User createBotUser(TestNamespace ns) {
    AuthenticationMechanism authenticationMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));
    return createUser(
        ns,
        "bot_user",
        new CreateUser().withIsBot(true).withAuthenticationMechanism(authenticationMechanism));
  }

  private String activePersonaId(User user, String requestedPersona) {
    String accessToken =
        JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 3_600);
    return activePersonaId(accessToken, requestedPersona, null);
  }

  private String activePersonaId(
      String accessToken, String requestedPersona, String impersonatedUser) {
    OpenMetadataConfig.Builder config =
        OpenMetadataConfig.builder().serverUrl(SdkClients.baseUrl()).accessToken(accessToken);
    if (requestedPersona != null) {
      config.header(ACTIVE_PERSONA_HEADER, requestedPersona);
    }
    if (impersonatedUser != null) {
      config.header(IMPERSONATE_USER_HEADER, impersonatedUser);
    }
    OpenMetadataClient client = new OpenMetadataClient(config.build());
    JsonNode context =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, MY_PERSONA_CONTEXT_PATH, null, JsonNode.class);
    return context.path("persona").path("id").asText();
  }
}
