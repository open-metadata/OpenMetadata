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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.type.aicontext.ColumnProfileSummary;
import org.openmetadata.schema.type.aicontext.ConceptBinding;
import org.openmetadata.schema.type.aicontext.ConceptContext;
import org.openmetadata.schema.type.aicontext.ConceptEvidence;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/** Bounded concept resolution shared by the entity context REST surface and MCP. */
final class ConceptContextBuilder {
  static final int CANDIDATE_PAGE_SIZE = 100;
  static final int MAX_ASSETS = 10;
  static final int MAX_BINDINGS_PER_ASSET = 25;
  private static final int MAX_EVIDENCE = 20;

  interface Catalog {
    CandidatePage candidates(EntityInterface concept, int offset);

    Table table(EntityReference reference);

    boolean canView(String type, String fqn);

    ContextMemory memory(UUID id);

    Query query(EntityReference reference);

    Observability profile(Table table);

    TableData sampleData(Table table);
  }

  record ColumnField(Column column, String fqn, String name) {}

  record CandidatePage(List<EntityReference> references, int nextOffset, boolean hasMore) {}

  private static final class BindingTotals {
    private int assets;
    private int bindings;

    void addAsset(int count) {
      assets++;
      bindings = Math.addExact(bindings, count);
    }
  }

  private final Catalog catalog;

  ConceptContextBuilder(Catalog catalog) {
    this.catalog = catalog;
  }

  ConceptContext build(
      EntityInterface entity, List<KnowledgeItem> metrics, List<KnowledgeItem> articles) {
    ConceptContext context =
        definition(entity).withMetrics(metrics).withEvidence(evidence(entity, articles));
    if (entity instanceof GlossaryTerm term) {
      bindTerm(context, term);
    } else if (entity instanceof Metric metric) {
      bindMetric(context, metric);
    }
    return context;
  }

  private ConceptContext definition(EntityInterface entity) {
    ConceptContext context = new ConceptContext().withBindings(new ArrayList<>());
    if (entity instanceof GlossaryTerm term) {
      context
          .withDefinition(AIContextBuilder.unescapeRichText(term.getDescription()))
          .withSynonyms(term.getSynonyms())
          .withAttributes(term.getAttributes())
          .withRelatedTerms(visibleRelations(term));
    } else if (entity instanceof Metric metric) {
      context.withDefinition(expression(metric));
    }
    return context;
  }

  private List<TermRelation> visibleRelations(GlossaryTerm term) {
    return listOrEmpty(term.getRelatedTerms()).stream()
        .filter(relation -> relation.getTerm() != null)
        .filter(
            relation ->
                catalog.canView(Entity.GLOSSARY_TERM, relation.getTerm().getFullyQualifiedName()))
        .toList();
  }

  private void bindTerm(ConceptContext context, GlossaryTerm term) {
    BindingTotals totals = new BindingTotals();
    scanCandidates(term, reference -> addTermBindings(context, term, reference, totals));
    finishCounts(context, totals.assets, totals.bindings);
  }

  private void addTermBindings(
      ConceptContext context, GlossaryTerm term, EntityReference reference, BindingTotals totals) {
    Table table = catalog.table(reference);
    if (table != null) {
      long columns = termFields(table, term).count();
      int total =
          Math.toIntExact(columns)
              + (hasTerm(table.getTags(), term.getFullyQualifiedName()) ? 1 : 0);
      if (total > 0) {
        totals.addAsset(total);
        if (totals.assets <= MAX_ASSETS) {
          List<ConceptBinding> bindings = termBindings(table, term);
          enrichBindings(table, bindings);
          context.getBindings().addAll(bindings);
        }
      }
    }
  }

  private static List<ConceptBinding> termBindings(Table table, GlossaryTerm term) {
    Stream<ConceptBinding> asset =
        hasTerm(table.getTags(), term.getFullyQualifiedName())
            ? Stream.of(assetBinding(table.getEntityReference()))
            : Stream.empty();
    return Stream.concat(asset, termFields(table, term).map(field -> columnBinding(table, field)))
        .limit(MAX_BINDINGS_PER_ASSET)
        .toList();
  }

  private static Stream<ColumnField> termFields(Table table, GlossaryTerm term) {
    return columnFields(table)
        .filter(field -> hasTerm(field.column().getTags(), term.getFullyQualifiedName()));
  }

  private static boolean hasTerm(List<TagLabel> tags, String termFqn) {
    return listOrEmpty(tags).stream()
        .anyMatch(
            tag ->
                tag.getSource() == TagLabel.TagSource.GLOSSARY && termFqn.equals(tag.getTagFQN()));
  }

  private void bindMetric(ConceptContext context, Metric metric) {
    MetricColumnResolver resolver = MetricColumnResolver.parse(expression(metric));
    List<EntityReference> retained = new ArrayList<>();
    BindingTotals totals = new BindingTotals();
    scanCandidates(metric, reference -> collectMetricAsset(reference, retained, resolver, totals));
    List<String> columns = resolver.resolvedColumns();
    retained.forEach(reference -> addMetricBindings(context, reference, columns));
    finishCounts(context, totals.assets, Math.addExact(totals.bindings, columns.size()));
  }

  private void collectMetricAsset(
      EntityReference reference,
      List<EntityReference> retained,
      MetricColumnResolver resolver,
      BindingTotals totals) {
    if (Entity.TABLE.equals(reference.getType())) {
      Table table = catalog.table(reference);
      if (table != null) {
        resolver.accept(table);
      }
    }
    totals.addAsset(1);
    if (retained.size() < MAX_ASSETS) {
      retained.add(reference);
    }
  }

  private void addMetricBindings(
      ConceptContext context, EntityReference reference, List<String> columns) {
    List<ConceptBinding> bindings = new ArrayList<>();
    bindings.add(assetBinding(reference));
    if (Entity.TABLE.equals(reference.getType())) {
      Table table = catalog.table(reference);
      if (table != null) {
        columnFields(table)
            .filter(field -> columns.contains(field.fqn()))
            .limit(MAX_BINDINGS_PER_ASSET - 1)
            .map(field -> columnBinding(table, field))
            .forEach(bindings::add);
        enrichBindings(table, bindings);
      }
    }
    context.getBindings().addAll(bindings);
  }

  private static String expression(Metric metric) {
    return metric.getMetricExpression() == null ? null : metric.getMetricExpression().getCode();
  }

  private void scanCandidates(EntityInterface concept, Consumer<EntityReference> consumer) {
    int offset = 0;
    CandidatePage page;
    do {
      page = catalog.candidates(concept, offset);
      page.references().stream()
          .filter(
              reference -> catalog.canView(reference.getType(), reference.getFullyQualifiedName()))
          .forEach(consumer);
      offset = page.nextOffset();
    } while (page.hasMore());
  }

  private static void finishCounts(ConceptContext context, int assets, int bindings) {
    context
        .withTotalAssets(assets)
        .withTotalBindings(bindings)
        .withTruncated(context.getBindings().size() < bindings);
  }

  private static ConceptBinding assetBinding(EntityReference reference) {
    return new ConceptBinding()
        .withAssetFqn(reference.getFullyQualifiedName())
        .withAssetType(reference.getType());
  }

  private static ConceptBinding columnBinding(Table table, ColumnField field) {
    return assetBinding(table.getEntityReference().withType(Entity.TABLE))
        .withColumn(field.fqn())
        .withDataType(AIContextBuilder.columnType(field.column()));
  }

  static Stream<ColumnField> columnFields(Table table) {
    return columnFields(table.getColumns(), table.getFullyQualifiedName(), "");
  }

  private static Stream<ColumnField> columnFields(
      List<Column> columns, String parentFqn, String parentName) {
    return listOrEmpty(columns).stream()
        .flatMap(
            column -> {
              String fqn =
                  nullOrEmpty(column.getFullyQualifiedName())
                      ? FullyQualifiedName.add(parentFqn, column.getName())
                      : column.getFullyQualifiedName();
              String name =
                  parentName.isEmpty() ? column.getName() : parentName + "." + column.getName();
              return Stream.concat(
                  Stream.of(new ColumnField(column, fqn, name)),
                  columnFields(column.getChildren(), fqn, name));
            });
  }

  private void enrichBindings(Table table, List<ConceptBinding> bindings) {
    if (bindings.stream().noneMatch(binding -> binding.getColumn() != null)) {
      return;
    }
    Observability profile = catalog.profile(table);
    TableData samples = catalog.sampleData(table);
    for (ConceptBinding binding : bindings) {
      if (binding.getColumn() != null) {
        String name =
            FullyQualifiedName.unquoteName(
                binding.getColumn().substring(table.getFullyQualifiedName().length() + 1));
        binding
            .withProfile(columnProfile(profile, name))
            .withSampleValues(sampleValues(samples, name));
      }
    }
  }

  private static ColumnProfileSummary columnProfile(Observability profile, String name) {
    return profile == null
        ? null
        : listOrEmpty(profile.getColumnProfiles()).stream()
            .filter(column -> name.equals(column.getName()))
            .findFirst()
            .orElse(null);
  }

  private static List<Object> sampleValues(TableData samples, String name) {
    List<Object> values = null;
    int index = samples == null ? -1 : listOrEmpty(samples.getColumns()).indexOf(name);
    if (index >= 0) {
      values =
          listOrEmpty(samples.getRows()).stream()
              .limit(AIContextBuilder.MAX_SAMPLE_ROWS)
              .filter(row -> row != null && index < row.size())
              .map(row -> row.get(index))
              .toList();
    }
    return values;
  }

  private List<ConceptEvidence> evidence(EntityInterface concept, List<KnowledgeItem> articles) {
    Map<UUID, ConceptEvidence> evidence = new LinkedHashMap<>();
    sourceMemories(concept, articles).forEach(id -> addMemoryEvidence(id, evidence));
    return List.copyOf(evidence.values());
  }

  private static List<UUID> sourceMemories(EntityInterface concept, List<KnowledgeItem> articles) {
    Set<UUID> ids = new LinkedHashSet<>();
    if (concept instanceof GlossaryTerm term) {
      if (term.getSourceMemoryIds() != null) {
        term.getSourceMemoryIds().stream().limit(MAX_EVIDENCE).forEach(ids::add);
      }
    } else if (concept instanceof Metric metric && metric.getDerivedFrom() != null) {
      ids.add(metric.getDerivedFrom().getId());
    }
    listOrEmpty(articles).stream()
        .filter(item -> item.getType() == KnowledgeItem.Type.CONTEXT_MEMORY)
        .limit(MAX_EVIDENCE)
        .map(KnowledgeItem::getId)
        .forEach(ids::add);
    return ids.stream().filter(id -> id != null).limit(MAX_EVIDENCE).toList();
  }

  private void addMemoryEvidence(UUID memoryId, Map<UUID, ConceptEvidence> evidence) {
    ContextMemory memory = catalog.memory(memoryId);
    if (memory != null
        && memory.getEntityStatus() == EntityStatus.APPROVED
        && catalog.canView(Entity.CONTEXT_MEMORY, memory.getFullyQualifiedName())) {
      listOrEmpty(memory.getRelatedEntities()).stream()
          .filter(reference -> Entity.QUERY.equals(reference.getType()))
          .limit(MAX_EVIDENCE)
          .forEach(reference -> addQueryEvidence(reference, evidence));
    }
  }

  private void addQueryEvidence(EntityReference reference, Map<UUID, ConceptEvidence> evidence) {
    if (evidence.size() < MAX_EVIDENCE) {
      Query query = catalog.query(reference);
      if (query != null && catalog.canView(Entity.QUERY, query.getFullyQualifiedName())) {
        String sql = query.getQuery();
        boolean truncated = sql != null && sql.length() > AIContextBuilder.MAX_DATA_MODEL_SQL_CHARS;
        evidence.putIfAbsent(
            query.getId(),
            new ConceptEvidence()
                .withId(query.getId())
                .withFullyQualifiedName(query.getFullyQualifiedName())
                .withLastRunAt(query.getQueryDate())
                .withQuery(
                    truncated ? sql.substring(0, AIContextBuilder.MAX_DATA_MODEL_SQL_CHARS) : sql)
                .withQueryTruncated(truncated));
      }
    }
  }
}
