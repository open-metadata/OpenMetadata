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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnJoin;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.JoinedWith;
import org.openmetadata.schema.type.PartitionColumnDetails;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TablePartition;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.aicontext.DataQuality;
import org.openmetadata.schema.type.aicontext.FieldContext;
import org.openmetadata.schema.type.aicontext.ForeignKey;
import org.openmetadata.schema.type.aicontext.JoinHint;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.type.aicontext.TableContext;

/**
 * Unit tests for the pure structural transforms of {@link AIContextBuilder}. These verify that the
 * strong SQL-generation signals — foreign keys, empirical joins, primary key, partitions, and
 * column schema — are extracted from a {@link Table} without touching any repository.
 */
class AIContextBuilderTest {

  private static final String CUSTOMERS_ID_FQN = "svc.db.sch.customers.id";

  private Table sampleTable() {
    Column id =
        new Column()
            .withName("id")
            .withDataType(ColumnDataType.BIGINT)
            .withConstraint(ColumnConstraint.PRIMARY_KEY);
    Column customerId =
        new Column()
            .withName("customer_id")
            .withDataType(ColumnDataType.BIGINT)
            .withDataTypeDisplay("bigint")
            .withDescription("FK to customers")
            .withTags(
                List.of(
                    new TagLabel()
                        .withSource(TagLabel.TagSource.GLOSSARY)
                        .withTagFQN("Business.CustomerId")));
    TableConstraint fk =
        new TableConstraint()
            .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
            .withColumns(List.of("customer_id"))
            .withReferredColumns(List.of(CUSTOMERS_ID_FQN))
            .withRelationshipType(TableConstraint.RelationshipType.MANY_TO_ONE);
    TableJoins joins =
        new TableJoins()
            .withColumnJoins(
                List.of(
                    new ColumnJoin()
                        .withColumnName("customer_id")
                        .withJoinedWith(
                            List.of(
                                new JoinedWith()
                                    .withFullyQualifiedName(CUSTOMERS_ID_FQN)
                                    .withJoinCount(128)))));
    TablePartition partition =
        new TablePartition()
            .withColumns(List.of(new PartitionColumnDetails().withColumnName("created_at")));
    return new Table()
        .withName("orders")
        .withColumns(List.of(id, customerId))
        .withTableConstraints(List.of(fk))
        .withJoins(joins)
        .withTablePartition(partition)
        .withTags(
            List.of(
                new TagLabel().withSource(TagLabel.TagSource.GLOSSARY).withTagFQN("Business.Order"),
                new TagLabel()
                    .withSource(TagLabel.TagSource.CLASSIFICATION)
                    .withTagFQN("PII.None")));
  }

  private KnowledgeItem knowledgeItem(String name, String content) {
    return new KnowledgeItem()
        .withType(KnowledgeItem.Type.PAGE)
        .withName(name)
        .withFullyQualifiedName("kb." + name)
        .withContent(content);
  }

  @Test
  void excerpt_boundsOnWordBoundaryAndLeavesShortContentAlone() {
    assertEquals("short body", AIContextBuilder.excerpt("short body", 100));
    String lead = AIContextBuilder.excerpt("alpha beta gamma delta epsilon", 12);
    assertTrue(lead.endsWith("…"), "excerpt must be marked with an ellipsis");
    assertTrue(lead.length() <= 13, "excerpt must respect the char bound");
    assertTrue(!lead.contains("epsilon"), "excerpt must drop the tail");
  }

  @Test
  void applyKnowledgeBudget_keepsShortItemsFullAndExcerptsOversized() {
    KnowledgeItem term = knowledgeItem("term", "x".repeat(100));
    KnowledgeItem metric = knowledgeItem("metric", "y".repeat(100));
    KnowledgeItem article = knowledgeItem("article", "z".repeat(4000));
    AIContext context =
        new AIContext()
            .withGlossaryTerms(List.of(term))
            .withMetrics(List.of(metric))
            .withArticles(List.of(article));

    new AIContextBuilder("table", "svc.db.sch.orders").applyKnowledgeBudget(context);

    assertTrue(
        term.getContentTruncated() == null || !term.getContentTruncated(), "term stays full");
    assertEquals(100, term.getContent().length());
    assertTrue(Boolean.TRUE.equals(article.getContentTruncated()), "oversized article excerpted");
    assertTrue(
        article.getContent().length() <= AIContextBuilder.EXCERPT_CHARS + 1,
        "excerpted article bounded to the excerpt length");
  }

  @Test
  void applyKnowledgeBudget_omitsContentWhenBudgetExhausted() {
    KnowledgeItem first = knowledgeItem("a1", "z".repeat(4000));
    KnowledgeItem second = knowledgeItem("a2", "z".repeat(4000));
    AIContext context = new AIContext().withArticles(List.of(first, second));

    new AIContextBuilder("table", "svc.db.sch.orders")
        .withKnowledgeBudget(AIContextBuilder.EXCERPT_CHARS)
        .applyKnowledgeBudget(context);

    assertTrue(Boolean.TRUE.equals(first.getContentTruncated()), "first article excerpted");
    assertTrue(
        Boolean.TRUE.equals(second.getContentTruncated()), "second article marked truncated");
    assertTrue(second.getContent() == null, "second article content omitted (reference-only)");
  }

  @Test
  void extractForeignKeys_capturesReferredColumnsAndCardinality() {
    List<ForeignKey> foreignKeys = AIContextBuilder.extractForeignKeys(sampleTable());
    assertEquals(1, foreignKeys.size());
    ForeignKey fk = foreignKeys.get(0);
    assertEquals(List.of("customer_id"), fk.getColumns());
    assertEquals(List.of(CUSTOMERS_ID_FQN), fk.getReferredColumns());
    assertEquals("MANY_TO_ONE", fk.getRelationshipType());
  }

  @Test
  void extractPrimaryKey_readsColumnLevelConstraint() {
    assertEquals(List.of("id"), AIContextBuilder.extractPrimaryKey(sampleTable()));
  }

  @Test
  void extractJoins_capturesFrequentlyJoinedColumns() {
    List<JoinHint> joins = AIContextBuilder.extractJoins(sampleTable());
    assertEquals(1, joins.size());
    JoinHint hint = joins.get(0);
    assertEquals("customer_id", hint.getColumn());
    assertEquals(CUSTOMERS_ID_FQN, hint.getJoinedWith());
    assertEquals(128, hint.getJoinCount());
  }

  @Test
  void extractPartitionColumns_readsPartitionDetails() {
    assertEquals(List.of("created_at"), AIContextBuilder.extractPartitionColumns(sampleTable()));
  }

  @Test
  void collectGlossaryFqns_takesGlossarySourceOnlyFromTableAndColumns() {
    Set<String> fqns = AIContextBuilder.collectGlossaryFqns(sampleTable());
    assertTrue(fqns.contains("Business.Order"), "table-level glossary term missing");
    assertTrue(fqns.contains("Business.CustomerId"), "column-level glossary term missing");
    assertTrue(fqns.stream().noneMatch(f -> f.startsWith("PII.")), "classification tag leaked in");
    assertEquals(2, fqns.size());
  }

  @Test
  void toFieldContexts_mapsNameTypeAndConstraint() {
    List<FieldContext> fields = AIContextBuilder.toFieldContexts(sampleTable().getColumns());
    assertEquals(2, fields.size());
    assertEquals("id", fields.get(0).getName());
    assertEquals("PRIMARY_KEY", fields.get(0).getConstraint());
    assertEquals("bigint", fields.get(1).getDataType());
  }

  @Test
  void metricContent_combinesDescriptionAndExpressionCode() {
    Metric metric =
        new Metric()
            .withName("Revenue")
            .withDescription("Total revenue from completed orders.")
            .withMetricExpression(
                new MetricExpression().withCode("SUM(amount) WHERE status = 'completed'"));
    String content = AIContextBuilder.metricContent(metric);
    assertTrue(content.contains("Total revenue from completed orders."), "missing description");
    assertTrue(
        content.contains("SUM(amount) WHERE status = 'completed'"), "missing expression code");
  }

  @Test
  void applySearchFields_materializesStructuralContextAndFkTargets() {
    Map<String, Object> doc = new HashMap<>();
    AIContextBuilder.applySearchFields(doc, sampleTable());
    assertTrue(doc.containsKey("aiContext"), "missing materialized aiContext");
    assertEquals(List.of(CUSTOMERS_ID_FQN), doc.get("aiContextForeignKeyTargets"));
    assertTrue(doc.get("aiContext") instanceof Map, "aiContext must be an object");
    assertTrue(
        ((Map<?, ?>) doc.get("aiContext")).containsKey("table"), "aiContext missing table context");
  }

  @Test
  void toDataQuality_mapsTestSummaryCounts() {
    DataQuality dq =
        AIContextBuilder.toDataQuality(
            new TestSummary().withTotal(5).withSuccess(3).withFailed(2).withAborted(0));
    assertEquals(5, dq.getTotal());
    assertEquals(3, dq.getPassed());
    assertEquals(2, dq.getFailed());
    assertEquals(0, dq.getAborted());
  }

  @Test
  void populateProfile_readsRowCountAndColumnShape() {
    Table profiled =
        new Table()
            .withProfile(new TableProfile().withRowCount(1000.0).withTimestamp(123L))
            .withColumns(
                List.of(
                    new Column()
                        .withName("status")
                        .withProfile(
                            new ColumnProfile()
                                .withNullProportion(0.1)
                                .withDistinctCount(3.0)
                                .withMin("A")
                                .withMax("Z"))));
    Observability observability = new Observability();
    AIContextBuilder.populateProfile(observability, profiled);
    assertEquals(1000.0, observability.getRowCount());
    assertEquals(123L, observability.getProfiledAt());
    assertEquals(1, observability.getColumnProfiles().size());
    assertEquals("status", observability.getColumnProfiles().get(0).getName());
    assertEquals(0.1, observability.getColumnProfiles().get(0).getNullProportion());
    assertEquals("Z", observability.getColumnProfiles().get(0).getMax());
  }

  @Test
  void buildTableContext_composesAllStructuralSignals() {
    TableContext context = AIContextBuilder.buildTableContext(sampleTable());
    assertEquals(2, context.getColumns().size());
    assertEquals(List.of("id"), context.getPrimaryKey());
    assertEquals(1, context.getForeignKeys().size());
    assertEquals(1, context.getFrequentJoins().size());
    assertEquals(List.of("created_at"), context.getPartitionColumns());
  }
}
