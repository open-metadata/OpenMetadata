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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TableData;

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
  private static Table ownedTable;
  private static String glossaryTermFqn;
  private static String sampleRestrictedToken;
  private static String ownerToken;
  private static String teamName;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    table = createServiceDatabaseSchemaTable("aicontext_rest_" + suffix);
    addSampleData(table);
    sampleRestrictedToken = createSampleRestrictedToken(suffix);
    ownedTable = createServiceDatabaseSchemaTable("aicontext_owned_" + suffix);
    addSampleData(ownedTable);
    ownerToken = createOwnerDeniedSamplesToken(suffix, ownedTable);
    glossaryTermFqn = createGlossaryTerm(suffix);
    teamName = createTeam(suffix);
  }

  private static void addSampleData(Table target) throws Exception {
    List<List<Object>> rows = new ArrayList<>();
    for (int index = 0; index < 12; index++) {
      rows.add(List.of(index, "name-" + index, "2026-09-04T00:00:00Z"));
    }
    TableData sampleData =
        new TableData().withColumns(List.of("id", "name", "created_at")).withRows(rows);
    put("tables/" + target.getId() + "/sampleData", sampleData, Table.class);
  }

  private static String createSampleRestrictedToken(String suffix) throws Exception {
    Rule denySamples =
        new Rule()
            .withName("DenyViewSampleData")
            .withResources(List.of("table"))
            .withOperations(List.of(MetadataOperation.VIEW_SAMPLE_DATA))
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        post(
            "policies",
            new CreatePolicy()
                .withName("aicontext_no_samples_policy_" + suffix)
                .withRules(List.of(denySamples)),
            Policy.class);
    Role role =
        post(
            "roles",
            new CreateRole()
                .withName("aicontext_no_samples_role_" + suffix)
                .withPolicies(List.of(policy.getFullyQualifiedName())),
            Role.class);
    String name = "aicontext_no_samples_" + suffix;
    User user =
        post(
            "users",
            new CreateUser()
                .withName(name)
                .withEmail(name + "@test.openmetadata.org")
                .withRoles(List.of(role.getId())),
            User.class);
    return "Bearer "
        + JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 3600);
  }

  /**
   * An owner-conditioned DENY of VIEW_SAMPLE_DATA, which only fires when the decision can actually
   * see the table's owners. A ResourceContext wrapping the already-loaded table (fetched without
   * owners) reads isOwner() as false, so the rule stays silent and the samples are handed out.
   */
  private static String createOwnerDeniedSamplesToken(String suffix, Table target)
      throws Exception {
    Rule denySamplesForOwner =
        new Rule()
            .withName("DenyViewSampleDataForOwner")
            .withResources(List.of("table"))
            .withOperations(List.of(MetadataOperation.VIEW_SAMPLE_DATA))
            .withCondition("isOwner()")
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        post(
            "policies",
            new CreatePolicy()
                .withName("aicontext_owner_no_samples_policy_" + suffix)
                .withRules(List.of(denySamplesForOwner)),
            Policy.class);
    Role role =
        post(
            "roles",
            new CreateRole()
                .withName("aicontext_owner_no_samples_role_" + suffix)
                .withPolicies(List.of(policy.getFullyQualifiedName())),
            Role.class);
    String name = "aicontext_owner_no_samples_" + suffix;
    User user =
        post(
            "users",
            new CreateUser()
                .withName(name)
                .withEmail(name + "@test.openmetadata.org")
                .withRoles(List.of(role.getId())),
            User.class);
    patch(
        "tables/" + target.getId(),
        "[{\"op\":\"add\",\"path\":\"/owners\",\"value\":[{\"id\":\""
            + user.getId()
            + "\",\"type\":\"user\"}]}]");
    return "Bearer "
        + JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 3600);
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
    JsonNode sampleData = context.at("/assetContext/table/sampleData");
    assertThat(sampleData.get("columns").size()).isEqualTo(3);
    assertThat(sampleData.get("rows").size()).isEqualTo(10);
    assertThat(sampleData.get("rows").get(9).get(1).asText()).isEqualTo("name-9");
  }

  @Test
  void tableContext_omitsSamplesWithoutViewSampleDataPermission() throws Exception {
    HttpResponse<String> response =
        getResponse(
            "tables/name/" + table.getFullyQualifiedName() + "/context?format=json",
            sampleRestrictedToken);

    assertThat(response.statusCode()).isEqualTo(200);
    JsonNode context = OBJECT_MAPPER.readTree(response.body());
    JsonNode sampleData = context.at("/assetContext/table/sampleData");
    assertThat(sampleData.isMissingNode() || sampleData.isNull()).isTrue();
  }

  @Test
  void tableContext_omitsSamplesForOwnerConditionedDeny() throws Exception {
    assertThat(getResponse("tables/" + ownedTable.getId() + "/sampleData", ownerToken).statusCode())
        .isEqualTo(403);

    HttpResponse<String> response =
        getResponse(
            "tables/name/" + ownedTable.getFullyQualifiedName() + "/context?format=json",
            ownerToken);

    assertThat(response.statusCode()).isEqualTo(200);
    JsonNode context = OBJECT_MAPPER.readTree(response.body());
    JsonNode sampleData = context.at("/assetContext/table/sampleData");
    assertThat(sampleData.isMissingNode() || sampleData.isNull()).isTrue();
  }

  @Test
  void tableContext_resolvableById() throws Exception {
    HttpResponse<String> response = getResponse("tables/" + table.getId() + "/context", authToken);
    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.body()).contains("type: \"table\"");
  }

  @Test
  void tableContext_acceptsQueryParamAndDegradesGracefully() throws Exception {
    // With vector search disabled in the harness the query-relevant excerpt falls back to the
    // structural preview; the endpoint must still accept ?query and return a valid document.
    HttpResponse<String> response =
        getResponse(
            "tables/name/" + table.getFullyQualifiedName() + "/context?query=refund%20rules",
            authToken);
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
