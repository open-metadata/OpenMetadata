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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.type.aicontext.ColumnProfileSummary;
import org.openmetadata.schema.type.aicontext.ConceptContext;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.service.Entity;

class ConceptContextBuilderTest {
  private static final String TERM = "Business.Amount";

  @Test
  void resolvesExactColumnTagsAndKeepsTableBindingsSeparate() {
    Catalog catalog = new Catalog();
    Table table = table("orders", column("amount_cents", TERM), column("other", "Other.Amount"));
    table.withTags(List.of(tag(TERM)));
    table.getColumns().getFirst().withChildren(List.of(column("nested", TERM)));
    catalog.assets.add(table);

    ConceptContext context = build(catalog, term());

    assertEquals(1, context.getTotalAssets());
    assertEquals(3, context.getTotalBindings());
    assertNull(context.getBindings().getFirst().getColumn());
    assertEquals("svc.db.schema.orders.amount_cents", context.getBindings().get(1).getColumn());
    assertEquals("BIGINT", context.getBindings().get(1).getDataType());
    assertEquals(
        "svc.db.schema.orders.amount_cents.nested", context.getBindings().get(2).getColumn());
    assertFalse(context.getTruncated());
  }

  @Test
  void deniedAssetsAreExcludedFromBindingsAndCounts() {
    Catalog catalog = new Catalog();
    catalog.assets.add(table("visible", column("amount", TERM)));
    catalog.assets.add(table("secret", column("amount", TERM)));
    catalog.hidden = Set.of("svc.db.schema.secret");

    ConceptContext context = build(catalog, term());

    assertEquals(1, context.getTotalAssets());
    assertEquals(1, context.getTotalBindings());
    assertEquals("svc.db.schema.visible", context.getBindings().getFirst().getAssetFqn());
  }

  @Test
  void countsOverflowAcrossCandidatePagesWithoutRetainingUnboundedBindings() {
    Catalog catalog = new Catalog();
    IntStream.range(0, 112)
        .forEach(index -> catalog.assets.add(table("orders" + index, column("amount", TERM))));

    ConceptContext context = build(catalog, term());

    assertEquals(10, context.getBindings().size());
    assertEquals(112, context.getTotalAssets());
    assertEquals(112, context.getTotalBindings());
    assertTrue(context.getTruncated());
  }

  @Test
  void candidateScanStopsAtTheCapAndReportsLowerBoundTotals() {
    Catalog catalog = new Catalog();
    IntStream.range(0, 612)
        .forEach(index -> catalog.assets.add(table("orders" + index, column("amount", TERM))));

    ConceptContext context = build(catalog, term());

    assertEquals(10, context.getBindings().size());
    assertEquals(ConceptContextBuilder.MAX_CANDIDATES_SCANNED, context.getTotalAssets());
    assertEquals(ConceptContextBuilder.MAX_CANDIDATES_SCANNED, context.getTotalBindings());
    assertTrue(context.getTruncated());
    assertEquals(
        ConceptContextBuilder.MAX_CANDIDATES_SCANNED / ConceptContextBuilder.CANDIDATE_PAGE_SIZE,
        catalog.pagesRequested);
  }

  @Test
  void cappedMetricScanDoesNotGuessColumnsAmbiguousWithUnscannedAssets() {
    Catalog catalog = new Catalog();
    IntStream.range(0, 612)
        .forEach(index -> catalog.assets.add(table("orders" + index, column("other", null))));
    catalog.assets.add(table("late", column("amount_cents", null)));
    catalog.assets.set(0, table("orders0", column("amount_cents", null)));
    Metric metric =
        new Metric().withMetricExpression(new MetricExpression().withCode("SUM(amount_cents)"));

    ConceptContext context = build(catalog, metric);

    assertEquals(ConceptContextBuilder.MAX_CANDIDATES_SCANNED, context.getTotalAssets());
    assertTrue(context.getTruncated());
    assertTrue(context.getBindings().stream().allMatch(binding -> binding.getColumn() == null));
  }

  @Test
  void perAssetCapReportsActualColumnCount() {
    Catalog catalog = new Catalog();
    Column[] columns =
        IntStream.range(0, 30)
            .mapToObj(index -> column("amount" + index, TERM))
            .toArray(Column[]::new);
    catalog.assets.add(table("wide", columns));

    ConceptContext context = build(catalog, term());

    assertEquals(25, context.getBindings().size());
    assertEquals(30, context.getTotalBindings());
    assertTrue(context.getTruncated());
  }

  @Test
  void bindsOnlyPermissionMaskedProfilesAndSamplesReturnedByCatalog() {
    Catalog catalog = new Catalog();
    catalog.assets.add(table("orders", column("amount", TERM)));
    catalog.profile =
        new Observability()
            .withColumnProfiles(
                List.of(new ColumnProfileSummary().withName("amount").withDistinctCount(3.0)));
    catalog.samples =
        new TableData()
            .withColumns(List.of("amount"))
            .withRows(List.of(List.of("masked"), List.of("masked")));

    ConceptContext context = build(catalog, term());

    assertEquals(3.0, context.getBindings().getFirst().getProfile().getDistinctCount());
    assertEquals(List.of("masked", "masked"), context.getBindings().getFirst().getSampleValues());
    catalog.profile = null;
    catalog.samples = null;
    context = build(catalog, term());
    assertNull(context.getBindings().getFirst().getProfile());
    assertNull(context.getBindings().getFirst().getSampleValues());
  }

  @Test
  void quotedColumnNamesStillResolveTheirProfilesAndSamples() {
    Catalog catalog = new Catalog();
    catalog.assets.add(table("orders", column("amount.cents", TERM)));
    catalog.profile =
        new Observability()
            .withColumnProfiles(
                List.of(
                    new ColumnProfileSummary().withName("amount.cents").withDistinctCount(3.0)));
    catalog.samples =
        new TableData().withColumns(List.of("amount.cents")).withRows(List.of(List.of(100)));

    ConceptContext context = build(catalog, term());

    assertEquals(
        "svc.db.schema.orders.\"amount.cents\"", context.getBindings().getFirst().getColumn());
    assertEquals(3.0, context.getBindings().getFirst().getProfile().getDistinctCount());
    assertEquals(List.of(100), context.getBindings().getFirst().getSampleValues());
  }

  @Test
  void preservesOntologyAttributesAndVisibleTypedRelations() {
    Catalog catalog = new Catalog();
    catalog.hidden = Set.of("Business.Secret");
    GlossaryTerm term =
        term()
            .withSynonyms(List.of("Revenue"))
            .withAttributes(
                List.of(
                    new OntologyAttribute()
                        .withName("status")
                        .withDataType(OntologyAttributeDataType.ENUM)
                        .withUnit("cents")
                        .withEnumValues(Set.of("Legal", "Banned"))))
            .withRelatedTerms(List.of(relation("Business.Visible"), relation("Business.Secret")));

    ConceptContext context = build(catalog, term);

    assertEquals("Amount in cents", context.getDefinition());
    assertEquals(List.of("Revenue"), context.getSynonyms());
    assertEquals("cents", context.getAttributes().getFirst().getUnit());
    assertEquals(Set.of("Legal", "Banned"), context.getAttributes().getFirst().getEnumValues());
    assertEquals(1, context.getRelatedTerms().size());
  }

  @Test
  void metricResolvesExpressionReferencesButIgnoresLiteralsAndAmbiguousColumns() {
    Catalog catalog = new Catalog();
    catalog.assets.add(table("orders", column("amount_cents", null), column("status", null)));
    catalog.assets.add(table("refunds", column("status", null)));
    Metric metric =
        new Metric()
            .withMetricExpression(
                new MetricExpression()
                    .withCode("SUM(orders.amount_cents) + COUNT(status) + LENGTH('status')"));

    ConceptContext context = build(catalog, metric);

    assertEquals(metric.getMetricExpression().getCode(), context.getDefinition());
    assertEquals(2, context.getTotalAssets());
    assertEquals(3, context.getTotalBindings());
    assertEquals(
        List.of("svc.db.schema.orders.amount_cents"),
        context.getBindings().stream()
            .filter(binding -> binding.getColumn() != null)
            .map(binding -> binding.getColumn())
            .toList());
  }

  @Test
  void metricResolvesSqlAliasesAndQuotedColumns() {
    Catalog catalog = new Catalog();
    catalog.assets.add(table("orders", column("amount_cents", null), column("revenue", null)));
    Metric metric =
        new Metric()
            .withMetricExpression(
                new MetricExpression()
                    .withCode(
                        "SELECT SUM(o.\"amount_cents\") AS revenue FROM orders AS o ORDER BY revenue"));

    ConceptContext context = build(catalog, metric);

    assertEquals(2, context.getTotalBindings());
    assertEquals("svc.db.schema.orders.amount_cents", context.getBindings().get(1).getColumn());

    metric
        .getMetricExpression()
        .withCode("SELECT SUM(amount_cents) AS amount_cents FROM orders ORDER BY amount_cents");
    context = build(catalog, metric);

    assertEquals(2, context.getTotalBindings());
    assertEquals("svc.db.schema.orders.amount_cents", context.getBindings().get(1).getColumn());
  }

  @Test
  void metricKeepsInputColumnsInWhereThatShadowProjectionAliases() {
    Catalog catalog = new Catalog();
    catalog.assets.add(table("orders", column("amount_cents", null), column("status", null)));
    Metric metric =
        new Metric()
            .withMetricExpression(
                new MetricExpression()
                    .withCode(
                        "SELECT SUM(amount_cents) AS status FROM orders WHERE status = 'paid'"));

    assertEquals(
        List.of("svc.db.schema.orders.amount_cents", "svc.db.schema.orders.status"),
        boundColumns(build(catalog, metric)));

    metric
        .getMetricExpression()
        .withCode("SELECT SUM(amount_cents) AS status FROM orders ORDER BY status DESC");

    assertEquals(
        List.of("svc.db.schema.orders.amount_cents"), boundColumns(build(catalog, metric)));
  }

  @Test
  void metricDistinguishesQuotedDottedColumnFromNestedField() {
    Catalog catalog = new Catalog();
    Column nested = column("amount", null).withChildren(List.of(column("cents", null)));
    catalog.assets.add(table("orders", column("amount.cents", null), nested));
    Metric metric =
        new Metric().withMetricExpression(new MetricExpression().withCode("SUM(\"amount.cents\")"));

    assertEquals(
        List.of("svc.db.schema.orders.\"amount.cents\""), boundColumns(build(catalog, metric)));

    metric.getMetricExpression().withCode("SUM(amount.cents)");

    assertEquals(
        List.of("svc.db.schema.orders.amount.cents"), boundColumns(build(catalog, metric)));

    metric.getMetricExpression().withCode("SUM(cents)");

    assertEquals(List.of(), boundColumns(build(catalog, metric)));
  }

  @Test
  void metricDoesNotGuessBindingsAcrossSubqueryScopes() {
    Catalog catalog = new Catalog();
    catalog.assets.add(table("orders", column("amount_cents", null)));
    catalog.assets.add(table("refunds", column("amount_cents", null)));
    Metric metric =
        new Metric()
            .withMetricExpression(
                new MetricExpression()
                    .withCode(
                        "SELECT SUM(o.amount_cents) FROM orders o WHERE EXISTS (SELECT 1 FROM refunds o WHERE o.amount_cents > 0)"));

    ConceptContext context = build(catalog, metric);

    assertEquals(2, context.getTotalBindings());
    assertTrue(context.getBindings().stream().allMatch(binding -> binding.getColumn() == null));
  }

  @Test
  void metricDoesNotUseAliasesFromDerivedTables() {
    Catalog catalog = new Catalog();
    catalog.assets.add(table("orders", column("amount_cents", null)));
    catalog.assets.add(table("refunds", column("amount_cents", null)));
    Metric metric =
        new Metric()
            .withMetricExpression(
                new MetricExpression()
                    .withCode(
                        "SELECT SUM(o.amount_cents) FROM orders o JOIN (SELECT o.amount_cents FROM refunds o) r ON 1 = 1"));

    ConceptContext context = build(catalog, metric);

    assertEquals(2, context.getTotalBindings());
    assertTrue(context.getBindings().stream().allMatch(binding -> binding.getColumn() == null));
  }

  @Test
  void bindsTaggedAssetsOfEveryTypeAtAssetAndFieldLevel() {
    Catalog catalog = new Catalog();
    catalog.assets.add(
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("revenue")
            .withFullyQualifiedName("looker.revenue")
            .withTags(List.of(tag(TERM))));
    catalog.assets.add(
        topic(
            "orders",
            new Field()
                .withName("payload")
                .withDataType(FieldDataType.RECORD)
                .withChildren(
                    List.of(
                        new Field()
                            .withName("amount")
                            .withDataType(FieldDataType.LONG)
                            .withTags(List.of(tag(TERM)))))));
    catalog.assets.add(dataModel("revenue_model", column("amount", TERM)));
    catalog.profile =
        new Observability()
            .withRowCount(1200.0)
            .withColumnProfiles(List.of(new ColumnProfileSummary().withName("amount")));

    ConceptContext context = build(catalog, term());

    assertEquals(3, context.getTotalAssets());
    assertEquals(3, context.getTotalBindings());
    assertEquals(
        List.of(
            List.of(Entity.DASHBOARD, "looker.revenue", ""),
            List.of(Entity.TOPIC, "kafka.orders", "kafka.orders.payload.amount"),
            List.of(
                Entity.DASHBOARD_DATA_MODEL,
                "looker.model.revenue_model",
                "looker.model.revenue_model.amount")),
        context.getBindings().stream()
            .map(
                binding ->
                    List.of(
                        binding.getAssetType(),
                        binding.getAssetFqn(),
                        binding.getColumn() == null ? "" : binding.getColumn()))
            .toList());
    assertEquals("LONG", context.getBindings().get(1).getDataType());
    assertTrue(context.getBindings().stream().allMatch(binding -> binding.getProfile() == null));
    assertTrue(context.getBindings().stream().allMatch(binding -> binding.getRowCount() == null));
    assertTrue(
        context.getBindings().stream().allMatch(binding -> binding.getSampleValues() == null));
  }

  @Test
  void tableRowCountReachesAssetAndColumnBindings() {
    Catalog catalog = new Catalog();
    catalog.assets.add(table("customers").withTags(List.of(tag(TERM))));
    catalog.assets.add(table("orders", column("amount", TERM)));
    catalog.profile = new Observability().withRowCount(1200.0);

    ConceptContext context = build(catalog, term());

    assertEquals(
        List.of(1200.0, 1200.0),
        context.getBindings().stream().map(binding -> binding.getRowCount()).toList());
    assertNull(context.getBindings().getFirst().getColumn());
    catalog.profile = null;
    assertNull(build(catalog, term()).getBindings().getFirst().getRowCount());
  }

  @Test
  void metricResolvesTabularColumnsOfAnyAssetButNotSchemaFields() {
    Catalog catalog = new Catalog();
    catalog.assets.add(dataModel("revenue_model", column("amount_cents", null)));
    catalog.assets.add(
        topic("orders", new Field().withName("amount_cents").withDataType(FieldDataType.LONG)));
    Metric metric =
        new Metric()
            .withMetricExpression(new MetricExpression().withCode("SUM(amount_cents) / 100"));

    ConceptContext context = build(catalog, metric);

    assertEquals(2, context.getTotalAssets());
    assertEquals(
        List.of("looker.model.revenue_model.amount_cents"),
        context.getBindings().stream()
            .filter(binding -> binding.getColumn() != null)
            .map(binding -> binding.getColumn())
            .toList());
  }

  @Test
  void evidenceUsesQueryIdsAndDoesNotInventExecutionStatus() {
    Catalog catalog = new Catalog();
    UUID memoryId = UUID.randomUUID();
    UUID queryId = UUID.randomUUID();
    catalog.memories.put(
        memoryId,
        new ContextMemory()
            .withId(memoryId)
            .withFullyQualifiedName("memory.amount")
            .withEntityStatus(ContextMemoryStatus.APPROVED)
            .withRelatedEntities(
                List.of(new EntityReference().withId(queryId).withType(Entity.QUERY))));
    catalog.queries.put(
        queryId,
        new Query()
            .withId(queryId)
            .withFullyQualifiedName("saved.query")
            .withQuery("SELECT amount FROM orders")
            .withQueryDate(123L));

    ConceptContext context = build(catalog, term().withSourceMemoryIds(Set.of(memoryId)));

    assertEquals(queryId, context.getEvidence().getFirst().getId());
    assertEquals(123L, context.getEvidence().getFirst().getLastRunAt());
    assertNull(context.getEvidence().getFirst().getLastRunStatus());
    catalog.hidden = Set.of("saved.query");
    assertTrue(
        build(catalog, term().withSourceMemoryIds(Set.of(memoryId))).getEvidence().isEmpty());
  }

  private static ConceptContext build(Catalog catalog, EntityInterface entity) {
    return new ConceptContextBuilder(catalog).build(entity, List.of(), List.of());
  }

  private static List<String> boundColumns(ConceptContext context) {
    return context.getBindings().stream()
        .map(binding -> binding.getColumn())
        .filter(column -> column != null)
        .toList();
  }

  private static GlossaryTerm term() {
    return new GlossaryTerm().withFullyQualifiedName(TERM).withDescription("Amount in cents");
  }

  private static TermRelation relation(String fqn) {
    return new TermRelation()
        .withRelationType("relatedTo")
        .withTerm(new EntityReference().withType(Entity.GLOSSARY_TERM).withFullyQualifiedName(fqn));
  }

  private static Table table(String name, Column... columns) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("svc.db.schema." + name)
        .withColumns(List.of(columns));
  }

  private static Topic topic(String name, Field... fields) {
    return new Topic()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("kafka." + name)
        .withMessageSchema(new MessageSchema().withSchemaFields(List.of(fields)));
  }

  private static DashboardDataModel dataModel(String name, Column... columns) {
    return new DashboardDataModel()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("looker.model." + name)
        .withColumns(List.of(columns));
  }

  private static Column column(String name, String term) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.BIGINT)
        .withTags(term == null ? List.of() : List.of(tag(term)));
  }

  private static TagLabel tag(String term) {
    return new TagLabel().withSource(TagLabel.TagSource.GLOSSARY).withTagFQN(term);
  }

  private static final class Catalog implements ConceptContextBuilder.Catalog {
    private final List<EntityInterface> assets = new ArrayList<>();
    private final Map<UUID, ContextMemory> memories = new HashMap<>();
    private final Map<UUID, Query> queries = new HashMap<>();
    private Set<String> hidden = Set.of();
    private Observability profile;
    private TableData samples;
    private int pagesRequested;

    @Override
    public ConceptContextBuilder.CandidatePage candidates(EntityInterface concept, int offset) {
      pagesRequested++;
      List<EntityReference> refs =
          assets.stream()
              .skip(offset)
              .limit(ConceptContextBuilder.CANDIDATE_PAGE_SIZE)
              .map(asset -> asset.getEntityReference().withType(typeOf(asset)))
              .toList();
      return new ConceptContextBuilder.CandidatePage(
          refs, offset + refs.size(), offset + refs.size() < assets.size());
    }

    @Override
    public EntityInterface asset(EntityReference reference) {
      return assets.stream()
          .filter(asset -> asset.getFullyQualifiedName().equals(reference.getFullyQualifiedName()))
          .findFirst()
          .orElseThrow();
    }

    private static String typeOf(EntityInterface asset) {
      return switch (asset) {
        case Table table -> Entity.TABLE;
        case Topic topic -> Entity.TOPIC;
        case Dashboard dashboard -> Entity.DASHBOARD;
        case DashboardDataModel model -> Entity.DASHBOARD_DATA_MODEL;
        default -> throw new IllegalArgumentException(asset.getClass().getSimpleName());
      };
    }

    @Override
    public boolean canView(String type, String fqn) {
      return !hidden.contains(fqn);
    }

    @Override
    public ContextMemory memory(UUID id) {
      return memories.get(id);
    }

    @Override
    public Query query(EntityReference reference) {
      return queries.get(reference.getId());
    }

    @Override
    public Observability profile(Table table) {
      return profile;
    }

    @Override
    public TableData sampleData(Table table) {
      return samples;
    }
  }
}
