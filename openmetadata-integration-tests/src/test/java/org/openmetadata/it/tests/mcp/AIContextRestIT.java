/*
 *  Copyright 2024 Collate
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
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;

/**
 * End-to-end test for the per-entity AI Context REST endpoint added to the {@code EntityResource}
 * base class, so every entity type exposes {@code GET /{id}/context} and {@code
 * GET /name/{fqn}/context}. Verifies the OKF-style markdown default and the JSON alternative for a
 * data asset (table), and that the generic path works for a non-data-asset (glossaryTerm) and for a
 * type that does not carry tags (team) without failing the fields fetch.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AIContextRestIT extends McpTestBase {

  private static Table table;
  private static String glossaryTermFqn;
  private static String teamName;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    table = createServiceDatabaseSchemaTable("aicontext_rest_" + suffix);
    glossaryTermFqn = createGlossaryTerm(suffix);
    teamName = createTeam(suffix);
  }

  private static String createGlossaryTerm(String suffix) throws Exception {
    Glossary glossary =
        post(
            "glossaries",
            new CreateGlossary()
                .withName("aicontext_rest_glossary_" + suffix)
                .withDescription("Glossary for AI context REST tests"),
            Glossary.class);
    GlossaryTerm term =
        post(
            "glossaryTerms",
            new CreateGlossaryTerm()
                .withGlossary(glossary.getFullyQualifiedName())
                .withName("Customer")
                .withDescription("A person or organization that buys goods or services."),
            GlossaryTerm.class);
    return term.getFullyQualifiedName();
  }

  private static String createTeam(String suffix) throws Exception {
    String name = "aicontext_rest_team_" + suffix;
    post(
        "teams",
        new CreateTeam()
            .withName(name)
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withDescription("Team for AI context REST tests"),
        Team.class);
    return name;
  }

  @Test
  void tableContext_returnsOkfMarkdownByFqn() throws Exception {
    HttpResponse<String> response =
        getResponse("tables/name/" + table.getFullyQualifiedName() + "/context", authToken);
    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.headers().firstValue("Content-Type").orElse("")).contains("text/markdown");
    String markdown = response.body();
    assertThat(markdown).startsWith("---");
    assertThat(markdown).contains("type: \"table\"");
    assertThat(markdown).contains("# Schema");
  }

  @Test
  void tableContext_returnsStructuredJsonWhenRequested() throws Exception {
    JsonNode context =
        get(
            "tables/name/" + table.getFullyQualifiedName() + "/context?format=json",
            JsonNode.class);
    assertThat(context.get("entityType").asText()).isEqualTo("table");
    assertThat(context.get("fullyQualifiedName").asText()).isEqualTo(table.getFullyQualifiedName());
    assertThat(context.has("assetContext")).isTrue();
  }

  @Test
  void tableContext_resolvableById() throws Exception {
    HttpResponse<String> response = getResponse("tables/" + table.getId() + "/context", authToken);
    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.body()).contains("type: \"table\"");
  }

  @Test
  void glossaryTermContext_genericNonDataAssetPath() throws Exception {
    HttpResponse<String> response =
        getResponse("glossaryTerms/name/" + glossaryTermFqn + "/context", authToken);
    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.body()).contains("type: \"glossaryTerm\"");
  }

  @Test
  void teamContext_noTagsTypeDoesNotFailFieldsFetch() throws Exception {
    HttpResponse<String> response = getResponse("teams/name/" + teamName + "/context", authToken);
    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.body()).contains("type: \"team\"");
  }
}
