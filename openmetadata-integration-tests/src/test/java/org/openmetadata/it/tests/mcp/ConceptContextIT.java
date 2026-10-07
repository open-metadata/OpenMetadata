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
import static org.awaitility.Awaitility.await;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.CONCURRENT)
class ConceptContextIT extends McpTestBase {
  private static final String COLUMN = "amount_cents";
  private static final String EXPRESSION = "SUM(amount_cents) / 100";
  private static final String DEFINITION = "An amount stored in cents.";
  private static String suffix;
  private static Glossary glossary;
  private static GlossaryTerm term;
  private static Table orders;
  private static Metric metric;
  private static String deniedTablesToken;
  private static String deniedSignalsToken;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    suffix = UUID.randomUUID().toString().substring(0, 8);
    Table anchor = createServiceDatabaseSchemaTable("concept_" + suffix);
    glossary =
        post(
            "glossaries",
            new CreateGlossary()
                .withName("concept_" + suffix)
                .withDescription("Concept context tests"),
            Glossary.class);
    term = createTerm("Amount");
    orders = createBoundTable(anchor, term, "orders_" + suffix, 1, false);
    addSignals(orders);
    metric =
        post(
            "metrics",
            new CreateMetric()
                .withName("revenue_" + suffix)
                .withMetricExpression(new MetricExpression().withCode(EXPRESSION)),
            Metric.class);
    put(
        "metrics/" + metric.getName() + "/assets/add",
        new BulkAssets().withAssets(List.of(reference(orders.getId(), "table"))),
        BulkOperationResult.class);
    deniedTablesToken = restrictedToken("tables", List.of(MetadataOperation.VIEW_BASIC));
    deniedSignalsToken =
        restrictedToken(
            "signals",
            List.of(MetadataOperation.VIEW_SAMPLE_DATA, MetadataOperation.VIEW_DATA_PROFILE));
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> assertThat(termContext(term).path("totalAssets").asInt()).isEqualTo(1));
  }

  @Test
  void termContextReturnsExactBindingTypeProfileAndOntologyAttributes() throws Exception {
    JsonNode context = termContext(term);
    JsonNode binding = context.path("bindings").get(0);
    assertThat(context.path("definition").asText()).isEqualTo(DEFINITION);
    assertThat(binding.path("assetFqn").asText()).isEqualTo(orders.getFullyQualifiedName());
    assertThat(binding.path("column").asText())
        .isEqualTo(orders.getFullyQualifiedName() + "." + COLUMN);
    assertThat(binding.path("dataType").asText()).isEqualToIgnoringCase("BIGINT");
    assertThat(binding.at("/profile/distinctCount").asDouble()).isEqualTo(3.0);
    assertThat(binding.path("sampleValues").size()).isEqualTo(3);
    assertThat(context.at("/attributes/0/unit").asText()).isEqualTo("cents");
  }

  @Test
  void tableContextKeepsGlossaryDefinitionOnTheColumn() throws Exception {
    JsonNode context =
        get(
            "tables/name/" + orders.getFullyQualifiedName() + "/context?format=json",
            JsonNode.class);
    assertThat(context.path("glossaryTerms").size()).isZero();
    assertThat(
            context.at("/assetContext/table/columns/0/glossaryTerms/0/fullyQualifiedName").asText())
        .isEqualTo(term.getFullyQualifiedName());
    assertThat(context.at("/assetContext/table/columns/0/glossaryTerms/0/content").asText())
        .isEqualTo(DEFINITION);
    String markdown =
        getResponse("tables/name/" + orders.getFullyQualifiedName() + "/context", authToken).body();
    assertThat(markdown).contains("Column " + COLUMN, DEFINITION, term.getFullyQualifiedName());
  }

  @Test
  void deniedAssetsAreAbsentFromTermBindingsAndMetricSourceAssets() throws Exception {
    JsonNode context =
        conceptResponse("glossaryTerms", term.getFullyQualifiedName(), deniedTablesToken);
    assertThat(context.at("/assetContext/conceptContext/bindings").size()).isZero();
    assertThat(context.at("/assetContext/conceptContext/totalAssets").asInt()).isZero();
    context = conceptResponse("metrics", metric.getFullyQualifiedName(), deniedTablesToken);
    assertThat(context.at("/assetContext/conceptContext/bindings").size()).isZero();
    assertThat(context.at("/assetContext/generic/sourceAssets").size()).isZero();
  }

  @Test
  void columnBindingsSurviveWithoutProfileOrSamplePermissions() throws Exception {
    JsonNode context =
        conceptResponse("glossaryTerms", term.getFullyQualifiedName(), deniedSignalsToken);
    JsonNode binding = context.at("/assetContext/conceptContext/bindings/0");
    assertThat(binding.path("column").asText())
        .isEqualTo(orders.getFullyQualifiedName() + "." + COLUMN);
    assertThat(binding.hasNonNull("profile")).isFalse();
    assertThat(binding.hasNonNull("sampleValues")).isFalse();
  }

  @Test
  void metricContextReturnsExpressionAppliedTablesAndResolvedColumns() throws Exception {
    JsonNode context =
        get(
            "metrics/name/" + metric.getFullyQualifiedName() + "/context?format=json",
            JsonNode.class);
    assertThat(context.at("/assetContext/generic/definition").asText()).isEqualTo(EXPRESSION);
    assertThat(context.at("/assetContext/generic/sourceAssets/0").asText())
        .isEqualTo(orders.getFullyQualifiedName());
    assertThat(context.at("/assetContext/conceptContext/totalBindings").asInt()).isEqualTo(2);
    assertThat(context.at("/assetContext/conceptContext/bindings/1/column").asText())
        .isEqualTo(orders.getFullyQualifiedName() + "." + COLUMN);
  }

  @Test
  void mcpExposesSameConceptBundleAndChecksAssetPermissions() throws Exception {
    Map<String, Object> call =
        McpTestUtils.createToolCallRequest(
            "get_concept_context",
            Map.of(
                "entityType",
                "glossaryTerm",
                "fqn",
                term.getFullyQualifiedName(),
                "format",
                "json"));
    JsonNode response = executeMcpRequest(call);
    JsonNode context = OBJECT_MAPPER.readTree(response.at("/result/content/0/text").asText());
    assertThat(context.at("/assetContext/conceptContext")).isEqualTo(termContext(term));
    response = executeMcpRequest(call, deniedTablesToken);
    context = OBJECT_MAPPER.readTree(response.at("/result/content/0/text").asText());
    assertThat(context.at("/assetContext/conceptContext/bindings").size()).isZero();
    response =
        executeMcpRequest(
            McpTestUtils.createToolCallRequest(
                "get_concept_context",
                Map.of("entityType", "metric", "fqn", metric.getFullyQualifiedName())));
    assertThat(response.at("/result/content/0/text").asText())
        .contains(EXPRESSION, orders.getFullyQualifiedName());
  }

  @Test
  void cappedAssetListCarriesActualTotals() throws Exception {
    GlossaryTerm capped = createTerm("Capped");
    for (int index = 0; index < 12; index++) {
      createBoundTable(orders, capped, "capped_" + suffix + "_" + index, 1, false);
    }
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              JsonNode context = termContext(capped);
              assertThat(context.path("totalAssets").asInt()).isEqualTo(12);
              assertThat(context.path("totalBindings").asInt()).isEqualTo(12);
              assertThat(context.path("bindings").size()).isEqualTo(10);
              assertThat(context.path("truncated").asBoolean()).isTrue();
            });
  }

  @Test
  void piiProfilesAreOmittedAndStoredSamplesAreMasked() throws Exception {
    GlossaryTerm piiTerm = createTerm("PiiAmount");
    Table pii = createBoundTable(orders, piiTerm, "pii_" + suffix, 1, true);
    addSignals(pii);
    String reader = restrictedToken("pii", List.of(MetadataOperation.EDIT_DESCRIPTION));
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> assertThat(termContext(piiTerm).path("totalAssets").asInt()).isEqualTo(1));
    JsonNode context = conceptResponse("glossaryTerms", piiTerm.getFullyQualifiedName(), reader);
    JsonNode binding = context.at("/assetContext/conceptContext/bindings/0");
    assertThat(binding.hasNonNull("profile")).isFalse();
    assertThat(binding.path("sampleValues").toString()).doesNotContain("100", "200", "700");
  }

  @Test
  void savedQueryEvidenceComesThroughAttachedApprovedMemory() throws Exception {
    GlossaryTerm evidenceTerm = createTerm("Evidence");
    Query query =
        post(
            "queries",
            new CreateQuery()
                .withService(orders.getService().getFullyQualifiedName())
                .withQuery("SELECT SUM(amount_cents) / 100 FROM orders")
                .withQueryDate(123L),
            Query.class);
    post(
        "contextCenter/memories",
        new CreateContextMemory()
            .withName("evidence_" + suffix)
            .withDescription("The amount is in cents.")
            .withQuestion("How is the amount encoded?")
            .withAnswer("The amount is stored in cents.")
            .withEntityStatus(EntityStatus.APPROVED)
            .withPrimaryEntity(reference(evidenceTerm.getId(), "glossaryTerm"))
            .withRelatedEntities(List.of(reference(query.getId(), "query"))),
        ContextMemory.class);
    JsonNode evidence = termContext(evidenceTerm).path("evidence").get(0);
    assertThat(evidence.path("id").asText()).isEqualTo(query.getId().toString());
    assertThat(evidence.path("query").asText()).isEqualTo(query.getQuery());
    assertThat(evidence.path("lastRunAt").asLong()).isEqualTo(123L);
    assertThat(evidence.hasNonNull("lastRunStatus")).isFalse();
    delete("queries/" + query.getId());
    assertThat(termContext(evidenceTerm).path("evidence").size()).isZero();
  }

  private static GlossaryTerm createTerm(String name) throws Exception {
    return post(
        "glossaryTerms",
        new CreateGlossaryTerm()
            .withGlossary(glossary.getFullyQualifiedName())
            .withName(name)
            .withDescription(DEFINITION)
            .withAttributes(
                List.of(
                    new OntologyAttribute()
                        .withId(UUID.randomUUID())
                        .withName("amount")
                        .withDataType(OntologyAttributeDataType.INTEGER)
                        .withUnit("cents")
                        .withIsIdentifier(false))),
        GlossaryTerm.class);
  }

  private static Table createBoundTable(
      Table anchor, GlossaryTerm term, String name, int columnCount, boolean pii) throws Exception {
    List<Column> columns =
        IntStream.range(0, columnCount)
            .mapToObj(
                index ->
                    new Column()
                        .withName(index == 0 ? COLUMN : COLUMN + index)
                        .withDataType(ColumnDataType.BIGINT)
                        .withTags(
                            pii
                                ? List.of(
                                    glossaryTag(term),
                                    new TagLabel()
                                        .withTagFQN("PII.Sensitive")
                                        .withSource(TagLabel.TagSource.CLASSIFICATION)
                                        .withLabelType(TagLabel.LabelType.MANUAL)
                                        .withState(TagLabel.State.CONFIRMED))
                                : List.of(glossaryTag(term))))
            .toList();
    return post(
        "tables",
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(anchor.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(columns),
        Table.class);
  }

  private static TagLabel glossaryTag(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static void addSignals(Table table) throws Exception {
    long timestamp = System.currentTimeMillis();
    put(
        "tables/" + table.getId() + "/tableProfile",
        new CreateTableProfile()
            .withTableProfile(new TableProfile().withTimestamp(timestamp).withRowCount(3.0))
            .withColumnProfile(
                List.of(
                    new ColumnProfile()
                        .withName(COLUMN)
                        .withTimestamp(timestamp)
                        .withDistinctCount(3.0)
                        .withMin(100)
                        .withMax(700))),
        Table.class);
    put(
        "tables/" + table.getId() + "/sampleData",
        new TableData()
            .withColumns(List.of(COLUMN))
            .withRows(List.of(List.of(100), List.of(200), List.of(700))),
        Table.class);
  }

  private static EntityReference reference(UUID id, String type) {
    return new EntityReference().withId(id).withType(type);
  }

  private static JsonNode termContext(GlossaryTerm term) throws Exception {
    return get(
            "glossaryTerms/name/" + term.getFullyQualifiedName() + "/context?format=json",
            JsonNode.class)
        .at("/assetContext/conceptContext");
  }

  private static JsonNode conceptResponse(String collection, String fqn, String token)
      throws Exception {
    HttpResponse<String> response =
        getResponse(collection + "/name/" + fqn + "/context?format=json", token);
    assertThat(response.statusCode()).isEqualTo(200);
    return OBJECT_MAPPER.readTree(response.body());
  }

  private static String restrictedToken(String name, List<MetadataOperation> operations)
      throws Exception {
    return restrictedToken(name, operations, null);
  }

  private static String restrictedToken(
      String name, List<MetadataOperation> operations, String condition) throws Exception {
    String userName = "concept_" + name + "_" + suffix;
    Rule deny =
        new Rule()
            .withName("Deny" + name)
            .withResources(List.of("table"))
            .withOperations(operations)
            .withEffect(Rule.Effect.DENY)
            .withCondition(condition);
    Policy policy =
        post(
            "policies",
            new CreatePolicy().withName(userName + "_policy").withRules(List.of(deny)),
            Policy.class);
    Role role =
        post(
            "roles",
            new CreateRole()
                .withName(userName + "_role")
                .withPolicies(List.of(policy.getFullyQualifiedName())),
            Role.class);
    User user =
        post(
            "users",
            new CreateUser()
                .withName(userName)
                .withEmail(userName + "@test.openmetadata.org")
                .withRoles(List.of(role.getId())),
            User.class);
    return "Bearer "
        + JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 3600);
  }
}
