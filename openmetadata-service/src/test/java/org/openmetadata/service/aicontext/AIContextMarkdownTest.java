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

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.aicontext.ColumnProfileSummary;
import org.openmetadata.schema.type.aicontext.DataQuality;
import org.openmetadata.schema.type.aicontext.FieldContext;
import org.openmetadata.schema.type.aicontext.ForeignKey;
import org.openmetadata.schema.type.aicontext.JoinHint;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.type.aicontext.TableContext;

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
    assertTrue(markdown.contains("type: table"), "missing type");
    assertTrue(markdown.contains("title: Orders"), "missing title");
    assertTrue(markdown.contains("tags: [Tier.Tier1, PII.None]"), "missing tags");
    assertTrue(markdown.contains("generatedAt: 2026-07-01T"), "missing ISO timestamp");
  }

  @Test
  void render_emitsSchemaTableWithColumns() {
    String markdown = render();
    assertTrue(markdown.contains("# Schema"), "missing schema heading");
    assertTrue(markdown.contains("| id | BIGINT | PRIMARY_KEY |"), "missing id column row");
    assertTrue(markdown.contains("**Primary key:** id"), "missing primary key line");
    assertTrue(markdown.contains("**Partitioned by:** created_at"), "missing partition line");
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

  private String render() {
    return AIContextMarkdown.render(sampleContext());
  }
}
