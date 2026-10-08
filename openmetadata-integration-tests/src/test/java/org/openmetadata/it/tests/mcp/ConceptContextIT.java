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
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.SchemaType;
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
    assertThat(binding.path("rowCount").asDouble()).isEqualTo(3.0);
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
    assertThat(binding.hasNonNull("rowCount")).isFalse();
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

  @Test
  void metricMemoryIsEvidenceNotABinding() throws Exception {
    Metric attached = createMetric("memory_metric", EXPRESSION, orders);
    Query query = createQuery("SELECT SUM(amount_cents) / 100 AS metric_revenue FROM orders");
    createMemory(
        "metric_memory_" + suffix,
        EntityStatus.APPROVED,
        reference(attached.getId(), "metric"),
        query);
    JsonNode context = metricContext(attached);
    JsonNode concept = context.at("/assetContext/conceptContext");
    assertThat(bindingKeys(concept))
        .containsExactly(
            orders.getFullyQualifiedName(), orders.getFullyQualifiedName() + "." + COLUMN);
    assertThat(concept.path("totalAssets").asInt()).isEqualTo(1);
    assertThat(concept.path("totalBindings").asInt()).isEqualTo(2);
    assertThat(concept.at("/evidence/0/id").asText()).isEqualTo(query.getId().toString());
    assertThat(context.at("/assetContext/generic/sourceAssets").size()).isEqualTo(1);
  }

  @Test
  void conceptsBindDashboardsDataModelsAndTopicFields() throws Exception {
    GlossaryTerm kpi = createTerm("BoardKpi");
    DashboardService dashboards =
        post(
            "services/dashboardServices",
            new CreateDashboardService()
                .withName("concept_dash_" + suffix)
                .withServiceType(DashboardServiceType.CustomDashboard),
            DashboardService.class);
    Dashboard dashboard =
        post(
            "dashboards",
            new CreateDashboard()
                .withName("board_" + suffix)
                .withService(dashboards.getFullyQualifiedName())
                .withTags(List.of(glossaryTag(kpi))),
            Dashboard.class);
    DashboardDataModel model =
        post(
            "dashboard/datamodels",
            new CreateDashboardDataModel()
                .withName("model_" + suffix)
                .withService(dashboards.getFullyQualifiedName())
                .withDataModelType(DataModelType.SupersetDataModel)
                .withColumns(
                    List.of(
                        new Column()
                            .withName(COLUMN)
                            .withDataType(ColumnDataType.BIGINT)
                            .withTags(List.of(glossaryTag(kpi))))),
            DashboardDataModel.class);
    Topic topic = createTopic(kpi);
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(() -> assertThat(termContext(kpi).path("totalAssets").asInt()).isEqualTo(3));
    JsonNode concept = termContext(kpi);
    assertThat(bindingKeys(concept))
        .containsExactlyInAnyOrder(
            dashboard.getFullyQualifiedName(),
            model.getFullyQualifiedName() + "." + COLUMN,
            topic.getFullyQualifiedName() + ".payload.amount");
    assertThat(concept.findValuesAsText("assetType"))
        .containsExactlyInAnyOrder("dashboard", "dashboardDataModel", "topic");
    assertThat(concept.findParents("sampleValues")).isEmpty();

    Metric modelMetric =
        createMetric(
            "model_metric",
            "SUM(" + COLUMN + ") / 100",
            List.of(
                reference(dashboard.getId(), "dashboard"),
                reference(model.getId(), "dashboardDataModel"),
                reference(topic.getId(), "topic")));
    assertThat(bindingKeys(metricContext(modelMetric).at("/assetContext/conceptContext")))
        .containsExactlyInAnyOrder(
            dashboard.getFullyQualifiedName(),
            model.getFullyQualifiedName(),
            model.getFullyQualifiedName() + "." + COLUMN,
            topic.getFullyQualifiedName());
  }

  @Test
  void assetLevelAndNestedColumnBindingsStayDistinct() throws Exception {
    GlossaryTerm key = createTerm("CustomerKey");
    Table customers =
        createTable(
            "customers_" + suffix,
            List.of(
                new Column()
                    .withName("id")
                    .withDataType(ColumnDataType.BIGINT)
                    .withTags(List.of(glossaryTag(key)))),
            List.of(glossaryTag(key)));
    Table nested =
        createTable(
            "nested_" + suffix,
            List.of(
                new Column()
                    .withName("customer")
                    .withDataType(ColumnDataType.STRUCT)
                    .withDataTypeDisplay("struct<customer_id:bigint>")
                    .withChildren(
                        List.of(
                            new Column()
                                .withName("customer_id")
                                .withDataType(ColumnDataType.BIGINT)
                                .withTags(List.of(glossaryTag(key)))))),
            List.of());
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(() -> assertThat(termContext(key).path("totalAssets").asInt()).isEqualTo(2));
    JsonNode concept = termContext(key);
    assertThat(bindingKeys(concept))
        .containsExactlyInAnyOrder(
            customers.getFullyQualifiedName(),
            customers.getFullyQualifiedName() + ".id",
            nested.getFullyQualifiedName() + ".customer.customer_id");
    assertThat(concept.path("totalBindings").asInt()).isEqualTo(3);
    JsonNode customersContext = tableContext(customers);
    assertThat(customersContext.at("/glossaryTerms/0/fullyQualifiedName").asText())
        .isEqualTo(key.getFullyQualifiedName());
    JsonNode nestedField = tableContext(nested).at("/assetContext/table/columns/1");
    assertThat(nestedField.path("name").asText()).isEqualTo("customer.customer_id");
    assertThat(nestedField.at("/glossaryTerms/0/fullyQualifiedName").asText())
        .isEqualTo(key.getFullyQualifiedName());
  }

  @Test
  void perAssetCapKeepsActualBindingCount() throws Exception {
    GlossaryTerm wide = createTerm("Wide");
    createBoundTable(orders, wide, "wide_" + suffix, 30, false);
    await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              JsonNode context = termContext(wide);
              assertThat(context.path("totalAssets").asInt()).isEqualTo(1);
              assertThat(context.path("totalBindings").asInt()).isEqualTo(30);
              assertThat(context.path("bindings").size()).isEqualTo(25);
              assertThat(context.path("truncated").asBoolean()).isTrue();
            });
    String markdown =
        getResponse("glossaryTerms/name/" + wide.getFullyQualifiedName() + "/context", authToken)
            .body();
    assertThat(markdown).contains("Bindings capped: showing 25 of 30 counted bindings across 1");
  }

  @Test
  void metricColumnsResolveThroughAliasesButNeverAcrossAmbiguousTables() throws Exception {
    Table payments =
        createTable(
            "payments_" + suffix,
            List.of(
                new Column().withName(COLUMN).withDataType(ColumnDataType.BIGINT),
                new Column()
                    .withName("status")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(16)),
            List.of());
    Metric aliased =
        createMetric(
            "aliased",
            "SELECT SUM(p.amount_cents) / 100 AS revenue FROM "
                + payments.getName()
                + " p WHERE p.status = 'paid'",
            payments);
    JsonNode concept = metricContext(aliased).at("/assetContext/conceptContext");
    assertThat(bindingKeys(concept))
        .containsExactly(
            payments.getFullyQualifiedName(),
            payments.getFullyQualifiedName() + "." + COLUMN,
            payments.getFullyQualifiedName() + ".status");
    Metric ambiguous = createMetric("ambiguous", "SUM(amount_cents)", orders, payments);
    JsonNode context = metricContext(ambiguous);
    assertThat(bindingKeys(context.at("/assetContext/conceptContext")))
        .containsExactlyInAnyOrder(
            orders.getFullyQualifiedName(), payments.getFullyQualifiedName());
    assertThat(context.at("/assetContext/generic/sourceAssets").size()).isEqualTo(2);
  }

  @Test
  void relatedMetricsAreListedOnBothConcepts() throws Exception {
    Metric base = createMetric("base", EXPRESSION, orders);
    Metric derived =
        post(
            "metrics",
            new CreateMetric()
                .withName("derived_" + suffix)
                .withMetricExpression(new MetricExpression().withCode("SUM(amount_cents)"))
                .withRelatedMetrics(List.of(base.getFullyQualifiedName())),
            Metric.class);
    assertThat(metricNames(metricContext(derived))).contains(base.getFullyQualifiedName());
    assertThat(metricNames(metricContext(base))).contains(derived.getFullyQualifiedName());
  }

  @Test
  void evidenceSkipsUnapprovedMemoriesAndExcerptsLongQueries() throws Exception {
    GlossaryTerm evidenceTerm = createTerm("LongEvidence");
    String longSql = "SELECT SUM(amount_cents) FROM orders -- " + "x".repeat(4500);
    Query approved = createQuery(longSql);
    Query draft = createQuery("SELECT 'draft' FROM orders");
    EntityReference primary = reference(evidenceTerm.getId(), "glossaryTerm");
    createMemory("long_" + suffix, EntityStatus.APPROVED, primary, approved);
    createMemory("draft_" + suffix, EntityStatus.DRAFT, primary, draft);
    JsonNode evidence = termContext(evidenceTerm).path("evidence");
    assertThat(evidence.size()).isEqualTo(1);
    assertThat(evidence.at("/0/id").asText()).isEqualTo(approved.getId().toString());
    assertThat(evidence.at("/0/queryTruncated").asBoolean()).isTrue();
    assertThat(evidence.at("/0/query").asText())
        .hasSize(4000)
        .isEqualTo(longSql.substring(0, 4000));
    String markdown =
        getResponse(
                "glossaryTerms/name/" + evidenceTerm.getFullyQualifiedName() + "/context",
                authToken)
            .body();
    assertThat(markdown)
        .contains("Saved Query Evidence", "Query excerpt;")
        .doesNotContain("SELECT 'draft'");
  }

  @Test
  void termMarkdownRendersEveryConceptSection() throws Exception {
    String markdown =
        getResponse("glossaryTerms/name/" + term.getFullyQualifiedName() + "/context", authToken)
            .body();
    assertThat(markdown)
        .contains(
            "Concept Definition",
            DEFINITION,
            "Ontology Attributes",
            "| amount | INTEGER | cents |",
            "Concept Bindings",
            "| "
                + orders.getFullyQualifiedName()
                + " | table | "
                + orders.getFullyQualifiedName()
                + "."
                + COLUMN,
            "Bound Profiles",
            "Stored samples for `"
                + orders.getFullyQualifiedName()
                + "."
                + COLUMN
                + "`: 100, 200, 700");
  }

  @Test
  void mcpRejectsNonConceptTypesAndUnknownConcepts() throws Exception {
    JsonNode wrongType =
        executeMcpRequest(
            McpTestUtils.createToolCallRequest(
                "get_concept_context",
                Map.of("entityType", "table", "fqn", orders.getFullyQualifiedName())));
    assertThat(wrongType.at("/result/isError").asBoolean(false)).isTrue();
    assertThat(wrongType.at("/result/content/0/text").asText()).contains("glossaryTerm or metric");
    JsonNode missing =
        executeMcpRequest(
            McpTestUtils.createToolCallRequest(
                "get_concept_context",
                Map.of("entityType", "glossaryTerm", "fqn", "missing_" + suffix + ".Term")));
    assertThat(missing.at("/result/isError").asBoolean(false)).isTrue();
    assertThat(
            getResponse("glossaryTerms/name/missing_" + suffix + ".Term/context", authToken)
                .statusCode())
        .isEqualTo(404);
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

  private static Table createTable(String name, List<Column> columns, List<TagLabel> tags)
      throws Exception {
    return post(
        "tables",
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(orders.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(columns)
            .withTags(tags),
        Table.class);
  }

  private static Topic createTopic(GlossaryTerm term) throws Exception {
    MessagingService messaging =
        post(
            "services/messagingServices",
            new CreateMessagingService()
                .withName("concept_kafka_" + suffix)
                .withServiceType(MessagingServiceType.CustomMessaging),
            MessagingService.class);
    Field amount =
        new Field()
            .withName("amount")
            .withDataType(FieldDataType.LONG)
            .withTags(List.of(glossaryTag(term)));
    return post(
        "topics",
        new CreateTopic()
            .withName("events_" + suffix)
            .withService(messaging.getFullyQualifiedName())
            .withPartitions(1)
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaType(SchemaType.Avro)
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("payload")
                                .withDataType(FieldDataType.RECORD)
                                .withChildren(List.of(amount))))),
        Topic.class);
  }

  private static Metric createMetric(String name, String expression, Table... tables)
      throws Exception {
    return createMetric(
        name,
        expression,
        Stream.of(tables).map(table -> reference(table.getId(), "table")).toList());
  }

  private static Metric createMetric(String name, String expression, List<EntityReference> assets)
      throws Exception {
    Metric created =
        post(
            "metrics",
            new CreateMetric()
                .withName(name + "_" + suffix)
                .withMetricExpression(new MetricExpression().withCode(expression)),
            Metric.class);
    put(
        "metrics/" + created.getName() + "/assets/add",
        new BulkAssets().withAssets(assets),
        BulkOperationResult.class);
    return created;
  }

  private static Query createQuery(String sql) throws Exception {
    return post(
        "queries",
        new CreateQuery().withService(orders.getService().getFullyQualifiedName()).withQuery(sql),
        Query.class);
  }

  private static void createMemory(
      String name, EntityStatus status, EntityReference primary, Query query) throws Exception {
    post(
        "contextCenter/memories",
        new CreateContextMemory()
            .withName(name)
            .withDescription("Revenue is stored in cents.")
            .withQuestion("How is revenue encoded?")
            .withAnswer("Revenue is stored in cents.")
            .withEntityStatus(status)
            .withPrimaryEntity(primary)
            .withRelatedEntities(List.of(reference(query.getId(), "query"))),
        ContextMemory.class);
  }

  private static List<String> bindingKeys(JsonNode concept) {
    return StreamSupport.stream(concept.path("bindings").spliterator(), false)
        .map(
            binding ->
                binding.hasNonNull("column")
                    ? binding.path("column").asText()
                    : binding.path("assetFqn").asText())
        .toList();
  }

  private static List<String> metricNames(JsonNode context) {
    return StreamSupport.stream(
            context.at("/assetContext/conceptContext/metrics").spliterator(), false)
        .map(metric -> metric.path("fullyQualifiedName").asText())
        .toList();
  }

  private static JsonNode metricContext(Metric metric) throws Exception {
    return get(
        "metrics/name/" + metric.getFullyQualifiedName() + "/context?format=json", JsonNode.class);
  }

  private static JsonNode tableContext(Table table) throws Exception {
    return get(
        "tables/name/" + table.getFullyQualifiedName() + "/context?format=json", JsonNode.class);
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
