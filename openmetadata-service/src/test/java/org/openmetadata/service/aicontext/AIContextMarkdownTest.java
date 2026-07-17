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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.aicontext.ColumnProfileSummary;
import org.openmetadata.schema.type.aicontext.DataQuality;
import org.openmetadata.schema.type.aicontext.FieldContext;
import org.openmetadata.schema.type.aicontext.ForeignKey;
import org.openmetadata.schema.type.aicontext.JoinHint;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.LineageEdgeContext;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.type.aicontext.TableContext;
import org.openmetadata.schema.type.personaContext.ContextSection;

/**
 * Unit tests for {@link AIContextMarkdown}: verify the LLM-facing markdown carries the frontmatter,
 * the schema table, and the foreign-key / join cross-links an agent needs for SQL generation.
 */
class AIContextMarkdownTest {

  private AIContext sampleContext() {
    TableContext table =
        new TableContext()
            .withColumns(
                List.of(
                    new FieldContext()
                        .withName("id")
                        .withDataType("BIGINT")
                        .withConstraint("PRIMARY_KEY"),
                    new FieldContext().withName("customer_id").withDataType("bigint")))
            .withPrimaryKey(List.of("id"))
            .withForeignKeys(
                List.of(
                    new ForeignKey()
                        .withColumns(List.of("customer_id"))
                        .withReferredColumns(List.of("svc.db.sch.customers.id"))
                        .withRelationshipType("MANY_TO_ONE")))
            .withFrequentJoins(
                List.of(
                    new JoinHint()
                        .withColumn("customer_id")
                        .withJoinedWith("svc.db.sch.customers.id")
                        .withJoinCount(128)))
            .withPartitionColumns(List.of("created_at"));
    return new AIContext()
        .withEntityType("table")
        .withDisplayName("Orders")
        .withFullyQualifiedName("svc.db.sch.orders")
        .withDescription("Orders placed by customers.")
        .withTags(List.of("Tier.Tier1", "PII.None"))
        .withGeneratedAt(1782864000000L)
        .withUpstream(List.of("svc.db.sch.raw_orders"))
        .withGlossaryTerms(
            List.of(
                new KnowledgeItem()
                    .withType(KnowledgeItem.Type.GLOSSARY_TERM)
                    .withName("Order")
                    .withDisplayName("Order")
                    .withFullyQualifiedName("Business.Order")
                    .withContent("An order placed by a customer.")))
        .withAssetContext(new AssetContext().withTable(table));
  }

  @Test
  void render_emitsFrontmatterWithTypeTitleAndTags() {
    String markdown = render();
    assertTrue(markdown.startsWith("---\n"), "missing opening frontmatter");
    assertTrue(markdown.contains("type: \"table\""), "missing type");
    assertTrue(markdown.contains("title: \"Orders\""), "missing title");
    assertTrue(
        markdown.contains("description: \"Orders placed by customers.\""),
        "missing one-line description summary");
    assertTrue(markdown.contains("tags: [\"Tier.Tier1\", \"PII.None\"]"), "missing tags");
    assertTrue(markdown.contains("timestamp: \"2026-07-01T"), "missing ISO timestamp");
  }

  @Test
  void render_emitsResourceUriWhenPresent() {
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withResource(java.net.URI.create("https://openmetadata.example/api/v1/tables/abc"));
    String markdown = AIContextMarkdown.render(context);
    assertTrue(
        markdown.contains("resource: \"https://openmetadata.example/api/v1/tables/abc\""),
        "missing canonical resource URI");
  }

  @Test
  void render_quotesYamlSignificantCharactersInFrontmatter() {
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withDisplayName("Orders: \"gold\" tier\nrevenue")
            .withFullyQualifiedName("svc.db.sch.orders");
    String markdown = AIContextMarkdown.render(context);
    assertTrue(
        markdown.contains("title: \"Orders: \\\"gold\\\" tier revenue\""),
        "frontmatter must quote and escape YAML-significant characters");
  }

  @Test
  void render_emitsSchemaTableWithColumns() {
    String markdown = render();
    assertTrue(markdown.contains("# Schema"), "missing schema heading");
    assertTrue(markdown.contains("| id | BIGINT | PRIMARY_KEY |"), "missing id column row");
    assertTrue(
        markdown.contains("| customer_id | bigint | -- |  |"),
        "missing constraint must render as --");
    assertTrue(markdown.contains("**Primary key:** id"), "missing primary key line");
    assertTrue(markdown.contains("**Partitioned by:** created_at"), "missing partition line");
  }

  @Test
  void render_keepsExplicitNullConstraintVerbatim() {
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withAssetContext(
                new AssetContext()
                    .withTable(
                        new TableContext()
                            .withColumns(
                                List.of(
                                    new FieldContext()
                                        .withName("nullable_value")
                                        .withDataType("string")
                                        .withConstraint("NULL")))));

    String markdown = AIContextMarkdown.render(context);

    assertTrue(markdown.contains("| nullable_value | string | NULL |  |"));
    assertFalse(markdown.contains("| nullable_value | string | -- |  |"));
  }

  @Test
  void render_emitsForeignKeyAndJoinCrossLinks() {
    String markdown = render();
    assertTrue(markdown.contains("# Foreign Keys"), "missing foreign key heading");
    assertTrue(
        markdown.contains("`customer_id` → `svc.db.sch.customers.id` (MANY_TO_ONE)"),
        "missing foreign key cross-link");
    assertTrue(markdown.contains("# Frequent Joins"), "missing joins heading");
    assertTrue(
        markdown.contains("`customer_id` ↔ `svc.db.sch.customers.id` (128×)"),
        "missing join cross-link");
  }

  @Test
  void render_marksTruncatedKnowledgeWithFetchHint() {
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withArticles(
                List.of(
                    new KnowledgeItem()
                        .withType(KnowledgeItem.Type.PAGE)
                        .withName("Revenue Rules")
                        .withFullyQualifiedName("kb.revenue_rules")
                        .withContent("Exclude refunded orders.")
                        .withContentTruncated(true)));
    String markdown = AIContextMarkdown.render(context);
    assertTrue(markdown.contains("Exclude refunded orders."), "excerpt body should render");
    assertTrue(
        markdown.contains("get_knowledge_content(entityType=`page`, fqn=`kb.revenue_rules`)"),
        "truncated item must carry the retrieval hint");
  }

  @Test
  void render_emitsBusinessDefinitionsAndLineage() {
    String markdown = render();
    assertTrue(markdown.contains("# Business Definitions"), "missing business definitions heading");
    assertTrue(markdown.contains("### Order"), "missing glossary term label");
    assertTrue(markdown.contains("`Business.Order`"), "missing glossary term fqn");
    assertTrue(markdown.contains("An order placed by a customer."), "missing glossary definition");
    assertTrue(markdown.contains("# Lineage"), "missing lineage heading");
    assertTrue(markdown.contains("**Upstream:** `svc.db.sch.raw_orders`"), "missing upstream");
  }

  @Test
  void render_emitsNestedUpstreamColumnLineage() {
    String upstreamFqn = "svc.db.raw.orders";
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withUpstream(List.of(upstreamFqn))
            .withDownstream(List.of("svc.db.analytics.orders"))
            .withUpstreamEdges(
                List.of(
                    new LineageEdgeContext()
                        .withFullyQualifiedName(upstreamFqn)
                        .withColumns(
                            List.of(
                                new ColumnLineage()
                                    .withFromColumns(List.of(upstreamFqn + ".account_id"))
                                    .withToColumn("svc.db.sch.orders.account_id"),
                                new ColumnLineage()
                                    .withFromColumns(
                                        List.of(upstreamFqn + ".balance", upstreamFqn + ".fee"))
                                    .withToColumn("svc.db.sch.orders.amount")
                                    .withFunction("SUM")))));

    String markdown = AIContextMarkdown.render(context);

    assertTrue(
        markdown.contains(
            "**Upstream:**\n"
                + "- `svc.db.raw.orders`\n"
                + "  - `account_id → account_id`\n"
                + "  - `balance, fee → amount (SUM)`\n\n"
                + "**Downstream:** `svc.db.analytics.orders`"));
  }

  @Test
  void render_preservesFlatLineageWhenEdgesHaveNoColumnMappings() {
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withUpstream(List.of("svc.db.raw.orders"))
            .withUpstreamEdges(
                List.of(
                    new LineageEdgeContext()
                        .withFullyQualifiedName("svc.db.raw.orders")
                        .withColumns(null)));

    String markdown = AIContextMarkdown.render(context);

    assertTrue(markdown.contains("**Upstream:** `svc.db.raw.orders`\n"));
    assertFalse(markdown.contains("**Upstream:**\n- `svc.db.raw.orders`"));
  }

  @Test
  void render_flipsPrefixesForDownstreamColumnLineage() {
    String downstreamFqn = "svc.db.analytics.enriched_orders";
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withDownstream(List.of(downstreamFqn))
            .withDownstreamEdges(
                List.of(
                    new LineageEdgeContext()
                        .withFullyQualifiedName(downstreamFqn)
                        .withColumns(
                            List.of(
                                new ColumnLineage()
                                    .withFromColumns(List.of("svc.db.sch.orders.gross"))
                                    .withToColumn(downstreamFqn + ".net")))));

    String markdown = AIContextMarkdown.render(context);

    assertTrue(
        markdown.contains(
            "**Downstream:**\n"
                + "- `svc.db.analytics.enriched_orders`\n"
                + "  - `gross → net`\n"));
  }

  @Test
  void shortName_stripsOnlyAnExactEntityPrefix() {
    assertEquals(
        "amount", AIContextMarkdown.shortName("svc.db.sch.orders.amount", "svc.db.sch.orders"));
    assertEquals(
        "other.db.sch.orders.amount",
        AIContextMarkdown.shortName("other.db.sch.orders.amount", "svc.db.sch.orders"));
    assertEquals(
        "svc.db.sch.ordersX.amount",
        AIContextMarkdown.shortName("svc.db.sch.ordersX.amount", "svc.db.sch.orders"));
    assertEquals(
        "svc.db.sch.orders.amount", AIContextMarkdown.shortName("svc.db.sch.orders.amount", null));
  }

  @Test
  void render_notesWhenColumnMappingsReachTheCap() {
    List<ColumnLineage> mappings = new ArrayList<>();
    for (int index = 0; index < AIContextBuilder.MAX_COLUMN_MAPPINGS_PER_EDGE; index++) {
      mappings.add(
          new ColumnLineage()
              .withFromColumns(List.of("svc.db.raw.orders.source_" + index))
              .withToColumn("svc.db.sch.orders.target_" + index));
    }
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withUpstream(List.of("svc.db.raw.orders"))
            .withDownstream(List.of("svc.db.analytics.orders"))
            .withUpstreamEdges(
                List.of(
                    new LineageEdgeContext()
                        .withFullyQualifiedName("svc.db.raw.orders")
                        .withColumns(mappings)));

    String markdown = AIContextMarkdown.render(context);

    assertTrue(
        markdown.contains(
            "_Column mappings are capped at 25 per edge — fetch the full lineage graph with "
                + "get_entity_lineage(entityType=`table`, fqn=`svc.db.sch.orders`)._"));
    assertTrue(
        markdown.contains(
            "**Downstream:** `svc.db.analytics.orders`\n\n_Column mappings are capped"));
  }

  @Test
  void render_skipsBlankTargetsAndRendersMappingsWithoutSources() {
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withUpstream(List.of("svc.db.raw.orders"))
            .withUpstreamEdges(
                List.of(
                    new LineageEdgeContext()
                        .withFullyQualifiedName("svc.db.raw.orders")
                        .withColumns(
                            List.of(
                                new ColumnLineage()
                                    .withFromColumns(List.of("svc.db.raw.orders.ignored"))
                                    .withToColumn(" "),
                                new ColumnLineage()
                                    .withFromColumns(List.of())
                                    .withToColumn("svc.db.sch.orders.x"),
                                new ColumnLineage()
                                    .withFromColumns(
                                        Arrays.asList(
                                            "svc.db.raw.orders.a",
                                            null,
                                            "",
                                            " ",
                                            "svc.db.raw.orders.b"))
                                    .withToColumn("svc.db.sch.orders.y")))));

    String markdown = AIContextMarkdown.render(context);

    assertTrue(markdown.contains("  - `→ x`\n"));
    assertTrue(markdown.contains("  - `a, b → y`\n"));
    assertFalse(markdown.contains("ignored"));
    assertFalse(markdown.contains("a, , b"));
  }

  @Test
  void render_emitsObservabilityProfileAndDataQuality() {
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withObservability(
                new Observability()
                    .withRowCount(1000.0)
                    .withColumnProfiles(
                        List.of(
                            new ColumnProfileSummary()
                                .withName("status")
                                .withNullProportion(0.1)
                                .withDistinctCount(3.0)
                                .withMin("A")
                                .withMax("Z")))
                    .withDataQuality(
                        new DataQuality().withTotal(5).withPassed(3).withFailed(2).withAborted(0)));
    String markdown = AIContextMarkdown.render(context);
    assertTrue(markdown.contains("# Data Profile"), "missing profile heading");
    assertTrue(markdown.contains("**Row count:** 1000"), "missing row count");
    assertTrue(markdown.contains("| status | 10% | 3 | A | Z |"), "missing column profile row");
    assertTrue(markdown.contains("# Data Quality"), "missing data quality heading");
    assertTrue(markdown.contains("failed: 2"), "missing failed count");
    assertTrue(markdown.contains("currently failing"), "missing failing-test warning");
  }

  @Test
  void appendEntitySections_honorsSelectionAndHeadingDepth() {
    StringBuilder markdown = new StringBuilder();
    AIContextMarkdown.appendEntitySections(
        markdown,
        sampleContext(),
        Set.of(ContextSection.DESCRIPTION, ContextSection.SCHEMA),
        "###");

    assertTrue(markdown.toString().contains("### Schema"));
    assertTrue(markdown.toString().contains("Orders placed by customers."));
    assertFalse(markdown.toString().contains("Foreign Keys"));
  }

  private String render() {
    return AIContextMarkdown.render(sampleContext());
  }
}
