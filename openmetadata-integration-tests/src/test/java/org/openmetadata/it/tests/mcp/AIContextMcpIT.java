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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TableConstraint;

/**
 * End-to-end integration test for the AI Context Platform's Mode A ({@code get_asset_context} MCP
 * tool) against the real application: a table with a foreign key, an attached Approved glossary
 * term, a linked Context Center article, and a metric applied to the table must all surface in one
 * tool call, as the LLM-ready markdown document.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AIContextMcpIT extends McpTestBase {

  private static final String TERM_DEFINITION = "An order placed by a customer across any channel.";
  private static final String ARTICLE_BODY =
      "Revenue reporting rule: exclude cancelled and refunded orders from all revenue metrics.";
  private static final String METRIC_CODE = "SUM(amount) WHERE status = 'completed'";
  private static final String LONG_ARTICLE_LEAD = "Revenue recognition handbook";
  private static final String LONG_ARTICLE_TAIL = "REFUNDEXCLUSIONZZ";
  private static final String LONG_ARTICLE_BODY =
      LONG_ARTICLE_LEAD
          + " opening section. "
          + "detail ".repeat(400)
          + " "
          + LONG_ARTICLE_TAIL
          + ".";

  private static Table ordersTable;
  private static Table customersTable;
  private static Metric revenueMetric;
  private static String longArticleFqn;
  private static String suffix;

  @BeforeAll
  static void setup() throws Exception {
    initAuth();
    suffix = UUID.randomUUID().toString().substring(0, 8);
    customersTable = createServiceDatabaseSchemaTable("aicontext_customers_" + suffix);
    ordersTable = createOrdersTableWithForeignKey();
    applyGlossaryTermToTable();
    createLinkedArticle();
    longArticleFqn = createLongLinkedArticle();
    revenueMetric = createMetricAppliedToTable();
  }

  private static String createLongLinkedArticle() throws Exception {
    Map<String, Object> createPage =
        Map.of(
            "name",
            "aicontext_longarticle_" + suffix,
            "displayName",
            "Revenue Recognition Handbook",
            "description",
            LONG_ARTICLE_BODY,
            "pageType",
            "Article",
            "page",
            Map.of(),
            "relatedEntities",
            List.of(Map.of("id", ordersTable.getId().toString(), "type", "table")));
    JsonNode page = post("contextCenter/pages", createPage, JsonNode.class);
    return page.get("fullyQualifiedName").asText();
  }

  private static Table createOrdersTableWithForeignKey() throws Exception {
    String schemaFqn = customersTable.getDatabaseSchema().getFullyQualifiedName();
    String referredColumn = customersTable.getFullyQualifiedName() + ".id";
    CreateTable createTable =
        new CreateTable()
            .withName("aicontext_orders_" + suffix)
            .withDescription("Orders placed by customers")
            .withDatabaseSchema(schemaFqn)
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column().withName("customer_id").withDataType(ColumnDataType.BIGINT),
                    new Column().withName("amount").withDataType(ColumnDataType.DOUBLE)))
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                        .withColumns(List.of("customer_id"))
                        .withReferredColumns(List.of(referredColumn))
                        .withRelationshipType(TableConstraint.RelationshipType.MANY_TO_ONE)));
    return post("tables", createTable, Table.class);
  }

  private static void applyGlossaryTermToTable() throws Exception {
    Glossary glossary =
        post(
            "glossaries",
            new CreateGlossary()
                .withName("aicontext_glossary_" + suffix)
                .withDescription("Business glossary for AI context tests"),
            Glossary.class);
    GlossaryTerm term =
        post(
            "glossaryTerms",
            new CreateGlossaryTerm()
                .withGlossary(glossary.getFullyQualifiedName())
                .withName("Order")
                .withDescription(TERM_DEFINITION),
            GlossaryTerm.class);
    String tagPatch =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/tags\",\"value\":[{\"tagFQN\":\"%s\",\"source\":\"Glossary\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}]}]",
            term.getFullyQualifiedName());
    patch("tables/" + ordersTable.getId(), tagPatch);
  }

  private static void createLinkedArticle() throws Exception {
    Map<String, Object> createPage =
        Map.of(
            "name",
            "aicontext_article_" + suffix,
            "displayName",
            "Revenue Reporting Rules",
            "description",
            ARTICLE_BODY,
            "pageType",
            "Article",
            "page",
            Map.of(),
            "relatedEntities",
            List.of(Map.of("id", ordersTable.getId().toString(), "type", "table")));
    post("contextCenter/pages", createPage, JsonNode.class);
  }

  private static Metric createMetricAppliedToTable() throws Exception {
    CreateMetric createMetric =
        new CreateMetric()
            .withName("aicontext_revenue_" + suffix)
            .withDescription("Total revenue from completed orders.")
            .withMetricExpression(new MetricExpression().withCode(METRIC_CODE))
            .withAppliedToAssets(
                List.of(new EntityReference().withId(ordersTable.getId()).withType("table")));
    return post("metrics", createMetric, Metric.class);
  }

  @Test
  void metricAppliedToAssets_updateViaPatchRewiresTheEdge() throws Exception {
    Metric metric =
        post(
            "metrics",
            new CreateMetric()
                .withName("aicontext_patch_metric_" + suffix)
                .withDescription("Metric whose applied assets get rewired.")
                .withAppliedToAssets(
                    List.of(new EntityReference().withId(ordersTable.getId()).withType("table"))),
            Metric.class);

    String rewirePatch =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/appliedToAssets\",\"value\":[{\"id\":\"%s\",\"type\":\"table\"}]}]",
            customersTable.getId());
    patch("metrics/" + metric.getId(), rewirePatch);

    JsonNode updated =
        get("metrics/name/" + metric.getName() + "?fields=appliedToAssets", JsonNode.class);
    JsonNode assets = updated.get("appliedToAssets");
    assertThat(assets).isNotNull();
    assertThat(assets.size()).isEqualTo(1);
    assertThat(assets.get(0).get("id").asText()).isEqualTo(customersTable.getId().toString());
  }

  @Test
  void metricAppliedToAssets_roundTripsThroughApi() throws Exception {
    JsonNode metric =
        get("metrics/name/" + revenueMetric.getName() + "?fields=appliedToAssets", JsonNode.class);
    JsonNode assets = metric.get("appliedToAssets");
    assertThat(assets).isNotNull();
    assertThat(assets.isArray()).isTrue();
    assertThat(assets.get(0).get("id").asText()).isEqualTo(ordersTable.getId().toString());
  }

  @Test
  void getAssetContext_returnsStructuralAndAttachedKnowledgeAsMarkdown() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createToolCallRequest(
            "get_asset_context",
            Map.of("entityType", "table", "fqn", ordersTable.getFullyQualifiedName()));
    JsonNode response = executeMcpRequest(toolCall);

    String text = response.get("result").get("content").get(0).get("text").asText();
    assertThat(text).contains("# Schema");
    assertThat(text).contains("# Foreign Keys");
    assertThat(text).contains(customersTable.getFullyQualifiedName() + ".id");
    assertThat(text).contains("MANY_TO_ONE");
    assertThat(text).contains("# Business Definitions");
    assertThat(text).contains(TERM_DEFINITION);
    assertThat(text).contains("# Knowledge Articles");
    assertThat(text).contains(ARTICLE_BODY);
    assertThat(text).contains("# Metrics");
    assertThat(text).contains(METRIC_CODE);
  }

  @Test
  void getAssetContext_jsonFormatCarriesForeignKeysAndKnowledge() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createToolCallRequest(
            "get_asset_context",
            Map.of(
                "entityType",
                "table",
                "fqn",
                ordersTable.getFullyQualifiedName(),
                "format",
                "json"));
    JsonNode response = executeMcpRequest(toolCall);

    JsonNode context =
        OBJECT_MAPPER.readTree(response.get("result").get("content").get(0).get("text").asText());
    JsonNode foreignKeys = context.path("assetContext").path("table").path("foreignKeys");
    assertThat(foreignKeys.isArray()).isTrue();
    assertThat(foreignKeys.get(0).path("referredColumns").get(0).asText())
        .isEqualTo(customersTable.getFullyQualifiedName() + ".id");
    assertThat(context.path("glossaryTerms").get(0).path("content").asText())
        .isEqualTo(TERM_DEFINITION);
    assertThat(context.path("metrics").get(0).path("content").asText()).contains(METRIC_CODE);
  }

  @Test
  void getAssetContext_excerptsLongArticleAndTruncationFlagIsSet() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createToolCallRequest(
            "get_asset_context",
            Map.of(
                "entityType",
                "table",
                "fqn",
                ordersTable.getFullyQualifiedName(),
                "format",
                "json"));
    JsonNode response = executeMcpRequest(toolCall);

    JsonNode context =
        OBJECT_MAPPER.readTree(response.get("result").get("content").get(0).get("text").asText());
    JsonNode longArticle = findArticle(context.path("articles"), longArticleFqn);
    assertThat(longArticle).isNotNull();
    assertThat(longArticle.path("contentTruncated").asBoolean()).isTrue();
    assertThat(longArticle.path("content").asText()).contains(LONG_ARTICLE_LEAD);
    assertThat(longArticle.path("content").asText()).doesNotContain(LONG_ARTICLE_TAIL);
  }

  @Test
  void getKnowledgeContent_returnsFullBodyForTruncatedArticle() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createToolCallRequest(
            "get_knowledge_content", Map.of("entityType", "page", "fqn", longArticleFqn));
    JsonNode response = executeMcpRequest(toolCall);

    String text = response.get("result").get("content").get(0).get("text").asText();
    assertThat(text).contains(LONG_ARTICLE_LEAD);
    assertThat(text).contains(LONG_ARTICLE_TAIL);
  }

  private static JsonNode findArticle(JsonNode articles, String fqn) {
    JsonNode match = null;
    if (articles.isArray()) {
      for (JsonNode article : articles) {
        if (fqn.equals(article.path("fullyQualifiedName").asText())) {
          match = article;
          break;
        }
      }
    }
    return match;
  }
}
