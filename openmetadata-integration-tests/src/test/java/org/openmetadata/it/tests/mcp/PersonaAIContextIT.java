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
package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.ContextSection;
import org.openmetadata.service.Entity;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PersonaAIContextIT extends McpTestBase {
  private static Persona persona;
  private static Table table;
  private static String directMemberToken;
  private static String inheritedMemberToken;
  private static String nonMemberToken;
  private static String botToken;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    table = createServiceDatabaseSchemaTable("persona_context_" + suffix);

    User directMember = createUser("persona_direct_" + suffix);
    User inheritedMember = createUser("persona_inherited_" + suffix);
    User nonMember = createUser("persona_non_member_" + suffix);
    User bot = get("users/name/profiler-bot", User.class);

    persona =
        post(
            "personas",
            new CreatePersona()
                .withName("persona_context_" + suffix)
                .withDescription("Persona AI context integration test")
                .withUsers(List.of(directMember.getId())),
            Persona.class);

    post(
        "teams",
        new CreateTeam()
            .withName("persona_context_team_" + suffix)
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withUsers(List.of(inheritedMember.getId()))
            .withDefaultPersona(persona.getId()),
        JsonNode.class);

    directMemberToken = tokenFor(directMember);
    inheritedMemberToken = tokenFor(inheritedMember);
    nonMemberToken = tokenFor(nonMember);
    botToken = tokenFor(bot);

    put(
        contextPath(),
        new PersonaContextDefinition()
            .withEnabled(true)
            .withCharacterBudget(400_000)
            .withCacheTtlMinutes(30),
        PersonaContextDefinition.class);
    post(contextPath() + "/rules", tableRule("Baseline tables"), PersonaContextDefinition.class);
  }

  @Test
  void ruleCrudPreviewDocumentCacheAndMcpRoundTrip() throws Exception {
    ContextRule requested = tableRule("CRUD tables");
    PersonaContextDefinition created =
        post(contextPath() + "/rules", requested, PersonaContextDefinition.class);
    ContextRule createdRule =
        created.getRules().stream()
            .filter(rule -> requested.getName().equals(rule.getName()))
            .findFirst()
            .orElseThrow();
    assertThat(createdRule.getId()).isNotNull();
    assertThat(createdRule.getSections())
        .contains(ContextSection.DESCRIPTION, ContextSection.JOINS, ContextSection.METRICS);

    JsonNode preview = post(contextPath() + "/rules/preview", requested, JsonNode.class);
    assertThat(preview.get("matchedCount").asInt()).isGreaterThanOrEqualTo(1);
    assertThat(preview.get("sampleNames").isArray()).isTrue();

    HttpResponse<String> duplicate =
        postResponse(contextPath() + "/rules", tableRule(" crud TABLES "), authToken);
    assertThat(duplicate.statusCode()).isEqualTo(400);

    ContextRule updatedRule = tableRule("Updated CRUD tables").withMaxAssets(2);
    PersonaContextDefinition updated =
        put(
            contextPath() + "/rules/" + createdRule.getId(),
            updatedRule,
            PersonaContextDefinition.class);
    assertThat(updated.getRules()).anyMatch(rule -> updatedRule.getName().equals(rule.getName()));

    HttpResponse<String> firstDocument = getResponse(contextPath() + "/document", authToken);
    HttpResponse<String> secondDocument = getResponse(contextPath() + "/document", authToken);
    assertThat(firstDocument.statusCode()).isEqualTo(200);
    assertThat(secondDocument.statusCode()).isEqualTo(200);
    assertThat(firstDocument.headers().firstValue("X-Cache")).isPresent();
    assertThat(secondDocument.headers().firstValue("X-Cache")).isPresent();
    assertThat(secondDocument.headers().firstValue("X-Cache").orElseThrow()).isIn("HIT", "BYPASS");
    JsonNode document = OBJECT_MAPPER.readTree(secondDocument.body());
    assertThat(document.get("markdown").asText()).contains(table.getFullyQualifiedName());

    HttpResponse<String> refreshed =
        postResponse(contextPath() + "/document:refresh", Map.of(), authToken);
    assertThat(refreshed.statusCode()).isEqualTo(200);
    assertThat(refreshed.headers().firstValue("X-Cache").orElseThrow()).isEqualTo("BYPASS");

    JsonNode mcp =
        executeMcp(
            McpTestUtils.createToolCallRequest(
                "get_persona_context",
                Map.of("personaName", persona.getFullyQualifiedName(), "format", "json")),
            directMemberToken);
    assertThat(mcp.path("result").path("isError").asBoolean(false)).isFalse();
    assertThat(mcp.toString()).contains(persona.getFullyQualifiedName());

    HttpResponse<String> deleted =
        deleteResponse(contextPath() + "/rules/" + createdRule.getId(), authToken);
    assertThat(deleted.statusCode()).isEqualTo(200);
  }

  @Test
  void enforcesMemberInheritedBotAdminAndRefreshAuthorization() throws Exception {
    String personaContextPath =
        "personas/name/" + persona.getFullyQualifiedName() + "/context?format=json";
    assertThat(getResponse(personaContextPath, directMemberToken).statusCode()).isEqualTo(200);
    assertThat(getResponse(personaContextPath, inheritedMemberToken).statusCode()).isEqualTo(200);
    assertThat(getResponse(personaContextPath, nonMemberToken).statusCode()).isEqualTo(403);
    assertThat(getResponse(contextPath(), directMemberToken).statusCode()).isEqualTo(403);
    assertThat(getResponse(personaContextPath + "&refresh=true", directMemberToken).statusCode())
        .isEqualTo(403);
    assertThat(getResponse(personaContextPath + "&refresh=true", botToken).statusCode())
        .isEqualTo(200);

    JsonNode deniedMcp =
        executeMcp(
            McpTestUtils.createToolCallRequest(
                "get_persona_context", Map.of("personaName", persona.getFullyQualifiedName())),
            nonMemberToken);
    assertThat(deniedMcp.toString()).contains("not assigned to persona");
  }

  private JsonNode executeMcp(Map<String, Object> requestBody, String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp")))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", token)
            .POST(
                HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(requestBody)))
            .timeout(Duration.ofSeconds(30))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertThat(response.statusCode()).isEqualTo(200);
    return OBJECT_MAPPER.readTree(extractJsonFromResponse(response.body()));
  }

  private static User createUser(String name) throws Exception {
    return post(
        "users", new CreateUser().withName(name).withEmail(name + "@example.com"), User.class);
  }

  private static String tokenFor(User user) {
    return "Bearer "
        + JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 3_600);
  }

  private static ContextRule tableRule(String name) {
    return new ContextRule()
        .withName(name)
        .withEntityType(Entity.TABLE)
        .withQueryFilter(
            "{\"query\":{\"term\":{\"fullyQualifiedName\":\""
                + table.getFullyQualifiedName()
                + "\"}}}")
        .withSections(Set.of())
        .withMaxAssets(1)
        .withEnabled(true);
  }

  private static String contextPath() {
    return "personas/" + persona.getId() + "/aiContext";
  }
}
