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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.CardinalityDistribution;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnJoin;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.JoinedWith;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.PartitionColumnDetails;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TablePartition;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.aicontext.ColumnProfileSummary;
import org.openmetadata.schema.type.aicontext.DataQuality;
import org.openmetadata.schema.type.aicontext.FieldContext;
import org.openmetadata.schema.type.aicontext.ForeignKey;
import org.openmetadata.schema.type.aicontext.JoinHint;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.LineageEdgeContext;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.type.aicontext.TableContext;
import org.openmetadata.schema.type.aicontext.TableDataModel;

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
  void structuralPreview_outlinesHeadingsPlusLeadParagraph() {
    String body =
        "Revenue recognition handbook opening paragraph.\n\n"
            + "## Recognition timing\n\nRecognize revenue when earned.\n\n"
            + "## Refund exclusions\n\nExclude refunded orders.";
    String preview = AIContextBuilder.structuralPreview(body, 800);
    assertTrue(
        preview.contains("Revenue recognition handbook opening paragraph"),
        "preview must lead with the first non-heading paragraph");
    assertTrue(
        preview.contains("Sections: Recognition timing · Refund exclusions"),
        "preview must outline the body's headings so the agent can judge relevance");
  }

  @Test
  void structuralPreview_shortNoHeadingContentIsReturnedAsIs() {
    assertEquals(
        "A single short definition.",
        AIContextBuilder.structuralPreview("A single short definition.", 800));
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
  void toFieldContexts_carriesRawDataTypeEnumAlongsideDisplayType() {
    List<FieldContext> fields = AIContextBuilder.toFieldContexts(sampleTable().getColumns());
    // customer_id has a display type ("bigint") that wins for dataType; the raw enum name must
    // still be available for programmatic type branching.
    assertEquals("bigint", fields.get(1).getDataType());
    assertEquals("BIGINT", fields.get(1).getDataTypeEnum());
    assertEquals("BIGINT", fields.get(0).getDataTypeEnum());
  }

  @Test
  void edgeContexts_capturesColumnMappingsAndFunctions() {
    UUID sourceId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    UUID targetId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    ColumnLineage mapping =
        new ColumnLineage()
            .withFromColumns(List.of("svc.db.raw.orders.balance"))
            .withToColumn("svc.db.analytics.orders.amount")
            .withFunction("SUM");
    Edge edge =
        new Edge()
            .withFromEntity(sourceId)
            .withToEntity(targetId)
            .withLineageDetails(new LineageDetails().withColumnsLineage(List.of(mapping)));
    EntityLineage lineage =
        new EntityLineage()
            .withNodes(
                List.of(
                    new EntityReference()
                        .withId(sourceId)
                        .withFullyQualifiedName("svc.db.raw.orders")))
            .withUpstreamEdges(List.of(edge));

    List<LineageEdgeContext> contexts = AIContextBuilder.edgeContexts(lineage, true);

    assertEquals(1, contexts.size());
    assertEquals("svc.db.raw.orders", contexts.getFirst().getFullyQualifiedName());
    assertEquals(List.of(mapping), contexts.getFirst().getColumns());
    assertEquals("SUM", contexts.getFirst().getColumns().getFirst().getFunction());
  }

  @Test
  void edgeContexts_capsColumnMappingsAtThePerEdgeLimit() {
    UUID sourceId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    List<ColumnLineage> mappings = new ArrayList<>();
    for (int index = 0; index < 30; index++) {
      mappings.add(
          new ColumnLineage()
              .withFromColumns(List.of("source.column_" + index))
              .withToColumn("target.column_" + index));
    }
    EntityLineage lineage =
        new EntityLineage()
            .withNodes(
                List.of(
                    new EntityReference()
                        .withId(sourceId)
                        .withFullyQualifiedName("svc.db.raw.orders")))
            .withUpstreamEdges(
                List.of(
                    new Edge()
                        .withFromEntity(sourceId)
                        .withToEntity(UUID.randomUUID())
                        .withLineageDetails(new LineageDetails().withColumnsLineage(mappings))));

    LineageEdgeContext context = AIContextBuilder.edgeContexts(lineage, true).getFirst();
    List<ColumnLineage> columns = context.getColumns();

    assertEquals(AIContextBuilder.MAX_COLUMN_MAPPINGS_PER_EDGE, columns.size());
    assertEquals("target.column_24", columns.getLast().getToColumn());
    assertTrue(Boolean.TRUE.equals(context.getColumnsTruncated()));
  }

  @Test
  void edgeContexts_doesNotMarkMappingsAtTheCapAsTruncated() {
    UUID sourceId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    List<ColumnLineage> mappings = new ArrayList<>();
    for (int index = 0; index < AIContextBuilder.MAX_COLUMN_MAPPINGS_PER_EDGE; index++) {
      mappings.add(
          new ColumnLineage()
              .withFromColumns(List.of("source.column_" + index))
              .withToColumn("target.column_" + index));
    }
    EntityLineage lineage =
        new EntityLineage()
            .withNodes(
                List.of(
                    new EntityReference()
                        .withId(sourceId)
                        .withFullyQualifiedName("svc.db.raw.orders")))
            .withUpstreamEdges(
                List.of(
                    new Edge()
                        .withFromEntity(sourceId)
                        .withToEntity(UUID.randomUUID())
                        .withLineageDetails(new LineageDetails().withColumnsLineage(mappings))));

    LineageEdgeContext context = AIContextBuilder.edgeContexts(lineage, true).getFirst();

    assertEquals(AIContextBuilder.MAX_COLUMN_MAPPINGS_PER_EDGE, context.getColumns().size());
    assertNull(context.getColumnsTruncated());
  }

  @Test
  void edgeContexts_leavesColumnsNullWhenLineageDetailsAreAbsent() {
    UUID sourceId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    EntityLineage lineage =
        new EntityLineage()
            .withNodes(
                List.of(
                    new EntityReference()
                        .withId(sourceId)
                        .withFullyQualifiedName("svc.db.raw.orders")))
            .withUpstreamEdges(
                List.of(new Edge().withFromEntity(sourceId).withToEntity(UUID.randomUUID())));

    List<LineageEdgeContext> contexts = AIContextBuilder.edgeContexts(lineage, true);

    assertNull(contexts.getFirst().getColumns());
  }

  @Test
  void edgeContexts_leavesColumnsNullWhenColumnMappingsAreEmpty() {
    UUID sourceId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    EntityLineage lineage =
        new EntityLineage()
            .withNodes(
                List.of(
                    new EntityReference()
                        .withId(sourceId)
                        .withFullyQualifiedName("svc.db.raw.orders")))
            .withUpstreamEdges(
                List.of(
                    new Edge()
                        .withFromEntity(sourceId)
                        .withToEntity(UUID.randomUUID())
                        .withLineageDetails(new LineageDetails().withColumnsLineage(List.of()))));

    List<LineageEdgeContext> contexts = AIContextBuilder.edgeContexts(lineage, true);

    assertNull(contexts.getFirst().getColumns());
  }

  @Test
  void edgeContexts_dropsEdgesWhoseNeighborNodeCannotBeResolved() {
    EntityLineage lineage =
        new EntityLineage()
            .withNodes(List.of())
            .withUpstreamEdges(
                List.of(
                    new Edge().withFromEntity(UUID.randomUUID()).withToEntity(UUID.randomUUID())));

    assertTrue(AIContextBuilder.edgeContexts(lineage, true).isEmpty());
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
  void unescapeRichText_decodesHtmlEntitiesFromBlockEditorContent() {
    assertEquals(
        "```\ncode\n```",
        AIContextBuilder.unescapeRichText("&#96;&#96;&#96;\ncode\n&#96;&#96;&#96;"),
        "backtick entities must decode to a real markdown code fence");
    assertEquals(
        "aum >= 250k for the bank's clients",
        AIContextBuilder.unescapeRichText("aum &gt;&#61; 250k for the bank&#39;s clients"),
        "operator and apostrophe entities must decode");
  }

  @Test
  void unescapeRichText_leavesPlainTextNullAndBareAmpersandUntouched() {
    assertEquals("R&D spend", AIContextBuilder.unescapeRichText("R&D spend"));
    assertEquals("", AIContextBuilder.unescapeRichText(""));
    assertNull(AIContextBuilder.unescapeRichText(null));
  }

  @Test
  void metricContent_unescapesDescriptionAndPreservesExpressionCode() {
    Metric metric =
        new Metric()
            .withName("HighValue")
            .withDescription("Flag when deposits &gt;&#61; 50k for the bank&#39;s book.")
            .withMetricExpression(new MetricExpression().withCode("SUM(deposit) >= 50000"));
    String content = AIContextBuilder.metricContent(metric);
    assertTrue(
        content.contains("deposits >= 50k for the bank's book."),
        "metric description entities must be unescaped");
    assertTrue(content.contains("SUM(deposit) >= 50000"), "expression code must pass through raw");
  }

  @Test
  void toFieldContexts_unescapesColumnDescriptionEntities() {
    Column column =
        new Column()
            .withName("value_segment")
            .withDataType(ColumnDataType.VARCHAR)
            .withDescription(
                "private_banking when aum &gt;&#61; 250k, else the bank&#39;s default");
    FieldContext field = AIContextBuilder.toFieldContexts(List.of(column)).getFirst();
    assertEquals(
        "private_banking when aum >= 250k, else the bank's default", field.getDescription());
  }

  @Test
  void toDataModelContext_prefersCompiledSqlAndMapsMeta() {
    DataModel dataModel =
        new DataModel()
            .withModelType(DataModel.ModelType.DBT)
            .withPath("models/marts/core/dim_customers.sql")
            .withDbtSourceProject("banking_redshift")
            .withSql("SELECT * FROM staging.customers")
            .withRawSql("SELECT * FROM {{ ref('customers') }}");
    TableDataModel context = AIContextBuilder.toDataModelContext(dataModel);
    assertEquals("DBT", context.getModelType());
    assertEquals("models/marts/core/dim_customers.sql", context.getPath());
    assertEquals("banking_redshift", context.getSourceProject());
    assertEquals("SELECT * FROM staging.customers", context.getSql(), "compiled SQL must win");
  }

  @Test
  void toDataModelContext_fallsBackToRawSqlWhenCompiledAbsent() {
    DataModel dataModel =
        new DataModel()
            .withModelType(DataModel.ModelType.DBT)
            .withRawSql("SELECT * FROM {{ ref('customers') }}");
    assertEquals(
        "SELECT * FROM {{ ref('customers') }}",
        AIContextBuilder.toDataModelContext(dataModel).getSql());
  }

  @Test
  void toDataModelContext_nullWhenAbsentOrEmpty() {
    assertNull(AIContextBuilder.toDataModelContext(null));
    assertNull(AIContextBuilder.toDataModelContext(new DataModel()), "empty model must be dropped");
  }

  @Test
  void toDataModelContext_boundsOversizedSql() {
    DataModel dataModel =
        new DataModel().withModelType(DataModel.ModelType.DDL).withSql("SELECT 1 ".repeat(2000));
    String sql = AIContextBuilder.toDataModelContext(dataModel).getSql();
    assertTrue(
        sql.length() <= AIContextBuilder.MAX_DATA_MODEL_SQL_CHARS + 20,
        "model SQL must be bounded");
    assertTrue(sql.endsWith("(truncated)"), "bounded SQL must be marked truncated");
  }

  @Test
  void buildTableContext_includesDataModelWhenPresent() {
    Table table =
        new Table()
            .withName("orders")
            .withColumns(List.of())
            .withDataModel(
                new DataModel().withModelType(DataModel.ModelType.DBT).withSql("SELECT 1"));
    TableDataModel dataModel = AIContextBuilder.buildTableContext(table).getDataModel();
    assertEquals("DBT", dataModel.getModelType());
    assertEquals("SELECT 1", dataModel.getSql());
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
  void populateProfile_carriesSampleMetadataAndDetailedColumnStats() {
    CardinalityDistribution distribution =
        new CardinalityDistribution()
            .withCategories(List.of("active", "Others"))
            .withCounts(List.of(80, 20))
            .withPercentages(List.of(80.0, 20.0));
    Table profiled =
        new Table()
            .withProfile(
                new TableProfile()
                    .withRowCount(1000.0)
                    .withTimestamp(123L)
                    .withProfileSample(50.0)
                    .withProfileSampleType(TableProfile.ProfileSampleType.PERCENTAGE))
            .withColumns(
                List.of(
                    new Column()
                        .withName("status")
                        .withProfile(
                            new ColumnProfile()
                                .withUniqueProportion(0.97)
                                .withMean(12.5)
                                .withMedian(11.0)
                                .withCardinalityDistribution(distribution))));
    Observability observability = new Observability();
    AIContextBuilder.populateProfile(observability, profiled);
    assertEquals(50.0, observability.getProfileSample());
    assertEquals("PERCENTAGE", observability.getProfileSampleType());
    ColumnProfileSummary summary = observability.getColumnProfiles().get(0);
    assertEquals(0.97, summary.getUniqueProportion());
    assertEquals(12.5, summary.getMean());
    assertEquals(11.0, summary.getMedian());
    assertEquals(distribution, summary.getCardinalityDistribution());
  }

  @Test
  void serviceRef_andServiceType_resolveFromTable() {
    EntityReference service =
        new EntityReference()
            .withId(UUID.fromString("33333333-3333-3333-3333-333333333333"))
            .withName("snowflake_prod")
            .withType("databaseService");
    Table table =
        sampleTable()
            .withService(service)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake);
    assertEquals(service, AIContextBuilder.serviceRef(table));
    assertEquals("Snowflake", AIContextBuilder.serviceType(table));
    assertNull(AIContextBuilder.serviceRef(new Metric()), "non-table assets carry no service ref");
    assertNull(AIContextBuilder.serviceType(new Metric()));
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
