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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.text.StringEscapeUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnJoin;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.JoinedWith;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.PartitionColumnDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TablePartition;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
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
import org.openmetadata.schema.type.aicontext.TableDataModel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Assembles the {@link AIContext} (Context Profile) for a data asset: the common knowledge envelope
 * (attached glossary terms and Context Center articles) that applies to every entity type, plus the
 * type-specific structural {@link AssetContext} (schema, primary/foreign keys, frequent joins for
 * tables). It is the server-side, permission-agnostic core behind the {@code get_asset_context} MCP
 * tool and REST endpoint, so any agent can pull an asset's full context in a single call.
 *
 * <p>The structural transforms ({@link #buildTableContext}, {@link #extractForeignKeys}, etc.) are
 * pure functions of the already-fetched entity and are unit tested directly. The relationship
 * resolvers ({@link #resolveGlossaryTerms}, {@link #resolveArticles}) read from repositories and are
 * exercised by integration tests.
 */
@Slf4j
public class AIContextBuilder {
  private static final int MAX_KNOWLEDGE_ITEMS = 50;
  private static final int MAX_ARTICLES = 20;
  private static final int MAX_JOIN_HINTS = 25;
  static final int MAX_COLUMN_MAPPINGS_PER_EDGE = 25;

  /** Upper bound on the model SQL inlined into a table's data-model context, in characters. */
  static final int MAX_DATA_MODEL_SQL_CHARS = 4000;

  private static final String TABLE_FIELDS =
      "columns,tableConstraints,joins,tablePartition,tags,testSuite,dataModel";
  private static final String DEFAULT_FIELDS = "tags";

  /** Total characters of knowledge-item content allowed in one bundle before degradation. */
  static final int DEFAULT_KNOWLEDGE_BUDGET_CHARS = 8000;

  /** Hard per-item content ceiling: a single item never inlines more than this, budget aside. */
  static final int MAX_ITEM_CHARS = 1500;

  /** Length of the lead excerpt substituted for an item that does not fit in full. */
  static final int EXCERPT_CHARS = 800;

  /** Below this remaining budget an item is emitted as a reference (content omitted). */
  private static final int MIN_EXCERPT_CHARS = 120;

  /** Max markdown headings surfaced in a structural preview's "Sections:" outline. */
  private static final int MAX_OUTLINE_HEADINGS = 8;

  /** Max query-relevant vector lookups per bundle; items beyond it use the structural preview. */
  private static final int MAX_QUERY_EXCERPTS = 5;

  private final String entityType;
  private final String fqn;
  private Authorizer authorizer;
  private SecurityContext securityContext;
  private int knowledgeBudgetChars = DEFAULT_KNOWLEDGE_BUDGET_CHARS;
  private String query;
  private int queryExcerptsRemaining = MAX_QUERY_EXCERPTS;

  public AIContextBuilder(String entityType, String fqn) {
    this.entityType = entityType;
    this.fqn = fqn;
  }

  /**
   * Supply the user's question so a truncated knowledge item's excerpt is the passage most relevant
   * to it (top chunk from the per-chunk embeddings, issue #4789) rather than the positional lead —
   * giving the agent a decision-grade snippet for whether to fetch the full body. Ignored when
   * blank or when vector search is unavailable, where the structural preview is used instead.
   */
  public AIContextBuilder withQuery(String query) {
    this.query = nullOrEmpty(query) ? null : query;
    return this;
  }

  /**
   * Override the total knowledge-content budget for this bundle. Values below one item's excerpt
   * are floored to {@link #EXCERPT_CHARS} so at least the first item still carries a lead.
   */
  public AIContextBuilder withKnowledgeBudget(int budgetChars) {
    this.knowledgeBudgetChars = Math.max(budgetChars, EXCERPT_CHARS);
    return this;
  }

  /**
   * Supply the caller's security context so the (permission-masked) latest profile can be loaded
   * into the observability section. When absent, observability still includes data-quality
   * standing but omits the profiled column shape.
   */
  public AIContextBuilder withSecurity(Authorizer authorizer, SecurityContext securityContext) {
    this.authorizer = authorizer;
    this.securityContext = securityContext;
    return this;
  }

  public AIContext build() {
    EntityInterface entity =
        Entity.getEntityByName(entityType, fqn, fieldsFor(entityType), Include.NON_DELETED);
    return buildForEntity(entity);
  }

  AIContext buildForEntity(EntityInterface entity) {
    EntityLineage lineage = fetchLineage(entity);
    List<LineageEdgeContext> upstreamEdges = edgeContexts(lineage, true);
    List<LineageEdgeContext> downstreamEdges = edgeContexts(lineage, false);
    AIContext context =
        new AIContext()
            .withId(entity.getId())
            .withFullyQualifiedName(entity.getFullyQualifiedName())
            .withEntityType(entityType)
            .withDisplayName(entity.getDisplayName())
            .withDescription(unescapeRichText(entity.getDescription()))
            .withResource(entity.getHref())
            .withTags(extractClassificationTags(entity))
            .withGlossaryTerms(resolveGlossaryTerms(entity))
            .withArticles(resolveArticles(entity))
            .withMetrics(resolveMetrics(entity))
            .withUpstream(edgeFqns(upstreamEdges))
            .withUpstreamEdges(upstreamEdges)
            .withDownstream(edgeFqns(downstreamEdges))
            .withDownstreamEdges(downstreamEdges)
            .withAssetContext(buildAssetContext(entity))
            .withObservability(resolveObservability(entity))
            .withGeneratedAt(System.currentTimeMillis());
    applyKnowledgeBudget(context);
    return context;
  }

  /**
   * Bounds the total knowledge-item content so a bundle can't overwhelm an LLM context window.
   * Definitions come first (glossary, metrics — short and high-value), then attached articles and
   * pills (potentially long). Each item is kept in full when it fits under the per-item ceiling and
   * the remaining budget, degraded to a lead excerpt when it doesn't, and finally reduced to a
   * reference (content omitted) once the budget is exhausted. Truncated items carry
   * {@code contentTruncated=true} so the agent knows to fetch the full body via get_knowledge_content.
   */
  void applyKnowledgeBudget(AIContext context) {
    int remaining = knowledgeBudgetChars;
    remaining = fitItems(context.getGlossaryTerms(), remaining);
    remaining = fitItems(context.getMetrics(), remaining);
    remaining = fitItems(context.getArticles(), remaining);
    logDegradation(context);
  }

  private int fitItems(List<KnowledgeItem> items, int remaining) {
    int budget = remaining;
    for (KnowledgeItem item : listOrEmpty(items)) {
      budget = fitItem(item, budget);
    }
    return budget;
  }

  private int fitItem(KnowledgeItem item, int remaining) {
    String content = item.getContent();
    int budget = remaining;
    if (!nullOrEmpty(content)) {
      if (content.length() <= MAX_ITEM_CHARS && content.length() <= remaining) {
        budget = remaining - content.length();
      } else if (remaining >= MIN_EXCERPT_CHARS) {
        String lead = buildExcerpt(item, content, Math.min(EXCERPT_CHARS, remaining));
        item.withContent(lead).withContentTruncated(true);
        budget = remaining - lead.length();
      } else {
        item.withContent(null).withContentTruncated(true);
      }
    }
    return budget;
  }

  /**
   * The excerpt shown for a truncated item: the query-relevant chunk when a question is set and the
   * item is embedded, otherwise a structural preview (lead paragraph + heading outline) that lets an
   * agent judge relevance far better than an arbitrary positional cut.
   */
  private String buildExcerpt(KnowledgeItem item, String content, int limit) {
    String result = null;
    if (query != null && queryExcerptsRemaining > 0) {
      // Count the attempt (not just hits) so total vector round-trips per bundle stay bounded.
      queryExcerptsRemaining--;
      result = queryRelevantExcerpt(item, limit);
    }
    if (result == null) {
      result = structuralPreview(content, limit);
    }
    return result;
  }

  /** Top chunk of the item's body by relevance to the query (issue #4789), or null when absent. */
  private String queryRelevantExcerpt(KnowledgeItem item, int limit) {
    String result = null;
    try {
      OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
      if (item.getType() != null
          && vectorService != null
          && Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
        EntityReference reference =
            Entity.getEntityReferenceByName(
                item.getType().value(), item.getFullyQualifiedName(), Include.NON_DELETED);
        List<String> passages =
            vectorService.searchChunksByParent(reference.getId().toString(), query, 1);
        if (!nullOrEmpty(passages)) {
          result = excerpt(passages.getFirst(), limit);
        }
      }
    } catch (Exception e) {
      LOG.debug(
          "AIContext: query-relevant excerpt failed for {}: {}",
          item.getFullyQualifiedName(),
          e.getMessage());
    }
    return result;
  }

  /**
   * A relevance-judgeable preview of long content: the lead paragraph plus a {@code Sections:}
   * outline of the body's markdown headings, so an agent sees what the document covers (not just its
   * opening) before deciding to fetch the full body.
   */
  static String structuralPreview(String content, int limit) {
    List<String> headings = extractHeadings(content);
    String outline =
        headings.size() >= 2
            ? "\n\nSections: " + String.join(" · ", capList(headings, MAX_OUTLINE_HEADINGS))
            : "";
    // Reserve room for the outline so lead + Sections together stay within limit and the item
    // never overruns its share of the knowledge budget.
    String lead = excerpt(leadParagraph(content), Math.max(0, limit - outline.length()));
    return lead + outline;
  }

  private static List<String> extractHeadings(String content) {
    List<String> headings = new ArrayList<>();
    for (String line : content.split("\n")) {
      String trimmed = line.strip();
      if (trimmed.startsWith("#")) {
        String heading = trimmed.replaceFirst("^#+\\s*", "").strip();
        if (!heading.isEmpty()) {
          headings.add(heading);
        }
      }
    }
    return headings;
  }

  /** First non-empty, non-heading paragraph of the body (falls back to the whole content). */
  private static String leadParagraph(String content) {
    String result = content;
    for (String paragraph : content.strip().split("\n\\s*\n")) {
      String candidate = paragraph.strip();
      if (!candidate.isEmpty() && !candidate.startsWith("#")) {
        result = candidate;
        break;
      }
    }
    return result;
  }

  /** A lead excerpt bounded to {@code limit} characters, cut on a word boundary. */
  static String excerpt(String content, int limit) {
    String result = content;
    if (content != null && content.length() > limit) {
      int boundary = content.lastIndexOf(' ', limit);
      int cut = boundary < limit / 2 ? limit : boundary;
      result = content.substring(0, cut).stripTrailing() + "…";
    }
    return result;
  }

  private void logDegradation(AIContext context) {
    long truncated =
        Stream.of(context.getGlossaryTerms(), context.getMetrics(), context.getArticles())
            .flatMap(items -> listOrEmpty(items).stream())
            .filter(item -> Boolean.TRUE.equals(item.getContentTruncated()))
            .count();
    if (truncated > 0) {
      LOG.debug(
          "AIContext {}: {} knowledge item(s) truncated/omitted to fit the {}-char budget",
          fqn,
          truncated,
          knowledgeBudgetChars);
    }
  }

  private Observability resolveObservability(EntityInterface entity) {
    Observability observability = null;
    if (entity instanceof Table) {
      observability = new Observability().withDataQuality(resolveDataQuality((Table) entity));
      applyProfile(observability, entity);
      if (isEmpty(observability)) {
        observability = null;
      }
    }
    return observability;
  }

  private static boolean isEmpty(Observability observability) {
    return observability.getDataQuality() == null
        && observability.getRowCount() == null
        && nullOrEmpty(observability.getColumnProfiles());
  }

  private void applyProfile(Observability observability, EntityInterface entity) {
    if (authorizer != null && securityContext != null) {
      try {
        TableRepository repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
        Table profiled = repository.getLatestTableProfile(fqn, true, authorizer, securityContext);
        populateProfile(observability, profiled);
      } catch (Exception e) {
        LOG.warn("AIContext: failed to load profile for {}: {}", fqn, e.getMessage());
      }
    }
  }

  static void populateProfile(Observability observability, Table profiled) {
    TableProfile profile = profiled.getProfile();
    if (profile != null) {
      observability.withRowCount(profile.getRowCount()).withProfiledAt(profile.getTimestamp());
    }
    List<ColumnProfileSummary> columnProfiles = new ArrayList<>();
    for (Column column : listOrEmpty(profiled.getColumns())) {
      ColumnProfile columnProfile = column.getProfile();
      if (columnProfile != null) {
        columnProfiles.add(
            new ColumnProfileSummary()
                .withName(column.getName())
                .withNullProportion(columnProfile.getNullProportion())
                .withDistinctCount(columnProfile.getDistinctCount())
                .withMin(toStringOrNull(columnProfile.getMin()))
                .withMax(toStringOrNull(columnProfile.getMax())));
      }
    }
    if (!columnProfiles.isEmpty()) {
      observability.withColumnProfiles(columnProfiles);
    }
  }

  private DataQuality resolveDataQuality(Table table) {
    DataQuality dataQuality = null;
    EntityReference testSuiteRef = table.getTestSuite();
    if (testSuiteRef != null) {
      try {
        TestSuite testSuite = Entity.getEntity(testSuiteRef, "summary", Include.NON_DELETED);
        dataQuality = toDataQuality(testSuite.getSummary());
      } catch (Exception e) {
        LOG.warn("AIContext: failed to load data quality for {}: {}", fqn, e.getMessage());
      }
    }
    return dataQuality;
  }

  static DataQuality toDataQuality(TestSummary summary) {
    DataQuality dataQuality = null;
    if (summary != null) {
      dataQuality =
          new DataQuality()
              .withTotal(summary.getTotal())
              .withPassed(summary.getSuccess())
              .withFailed(summary.getFailed())
              .withAborted(summary.getAborted());
    }
    return dataQuality;
  }

  private static String toStringOrNull(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private EntityLineage fetchLineage(EntityInterface entity) {
    EntityLineage lineage = null;
    try {
      lineage = Entity.getLineageRepository().get(entityType, entity.getId().toString(), 1, 1);
    } catch (Exception e) {
      LOG.warn("AIContext: failed to fetch lineage for {}: {}", fqn, e.getMessage());
    }
    return lineage;
  }

  static List<LineageEdgeContext> edgeContexts(EntityLineage lineage, boolean upstream) {
    List<LineageEdgeContext> contexts = new ArrayList<>();
    if (lineage != null) {
      Map<UUID, String> nodeFqn = nodeFqnMap(lineage);
      List<Edge> edges = upstream ? lineage.getUpstreamEdges() : lineage.getDownstreamEdges();
      for (Edge edge : listOrEmpty(edges)) {
        String nodeFullyQualifiedName =
            nodeFqn.get(upstream ? edge.getFromEntity() : edge.getToEntity());
        if (nodeFullyQualifiedName != null) {
          contexts.add(edgeContext(nodeFullyQualifiedName, edge));
        }
      }
    }
    return contexts;
  }

  private static LineageEdgeContext edgeContext(String fullyQualifiedName, Edge edge) {
    List<ColumnLineage> columns = edgeColumns(edge);
    boolean columnsTruncated = columns != null && columns.size() > MAX_COLUMN_MAPPINGS_PER_EDGE;
    return new LineageEdgeContext()
        .withFullyQualifiedName(fullyQualifiedName)
        .withColumns(columns == null ? null : capList(columns, MAX_COLUMN_MAPPINGS_PER_EDGE))
        .withColumnsTruncated(columnsTruncated ? Boolean.TRUE : null);
  }

  private static List<String> edgeFqns(List<LineageEdgeContext> edges) {
    return listOrEmpty(edges).stream().map(LineageEdgeContext::getFullyQualifiedName).toList();
  }

  private static List<ColumnLineage> edgeColumns(Edge edge) {
    List<ColumnLineage> columns = null;
    LineageDetails lineageDetails = edge.getLineageDetails();
    if (lineageDetails != null && !nullOrEmpty(lineageDetails.getColumnsLineage())) {
      columns = lineageDetails.getColumnsLineage();
    }
    return columns;
  }

  private static Map<UUID, String> nodeFqnMap(EntityLineage lineage) {
    Map<UUID, String> nodeFqn = new HashMap<>();
    for (EntityReference node : listOrEmpty(lineage.getNodes())) {
      nodeFqn.put(node.getId(), node.getFullyQualifiedName());
    }
    return nodeFqn;
  }

  private static String fieldsFor(String entityType) {
    String result;
    if (Entity.TABLE.equals(entityType)) {
      result = TABLE_FIELDS;
    } else {
      result = supportsTags(entityType) ? DEFAULT_FIELDS : "";
    }
    return result;
  }

  /**
   * Not every entity type carries tags (e.g. user, team) — requesting the field would fail the
   * fetch. This keeps the generic context path safe for the full entity surface.
   */
  private static boolean supportsTags(String entityType) {
    boolean supported = false;
    try {
      supported =
          Entity.getEntityRepository(entityType).getAllowedFields().contains(Entity.FIELD_TAGS);
    } catch (Exception e) {
      LOG.debug("AIContext: cannot resolve repository for {}: {}", entityType, e.getMessage());
    }
    return supported;
  }

  private List<KnowledgeItem> resolveGlossaryTerms(EntityInterface entity) {
    List<KnowledgeItem> items = new ArrayList<>();
    for (String termFqn : capped(collectGlossaryFqns(entity), MAX_KNOWLEDGE_ITEMS)) {
      KnowledgeItem item = toGlossaryKnowledgeItem(termFqn);
      if (item != null) {
        items.add(item);
      }
    }
    return items;
  }

  static Set<String> collectGlossaryFqns(EntityInterface entity) {
    Set<String> fqns = new LinkedHashSet<>();
    addGlossaryFqns(entity.getTags(), fqns);
    if (entity instanceof Table table) {
      collectColumnGlossary(table.getColumns(), fqns);
    }
    return fqns;
  }

  static List<String> extractClassificationTags(EntityInterface entity) {
    List<String> tags = new ArrayList<>();
    for (TagLabel tag : listOrEmpty(entity.getTags())) {
      if (tag.getSource() != TagLabel.TagSource.GLOSSARY) {
        tags.add(tag.getTagFQN());
      }
    }
    return tags;
  }

  private static void addGlossaryFqns(List<TagLabel> tags, Set<String> into) {
    for (TagLabel tag : listOrEmpty(tags)) {
      if (tag.getSource() == TagLabel.TagSource.GLOSSARY) {
        into.add(tag.getTagFQN());
      }
    }
  }

  private static void collectColumnGlossary(List<Column> columns, Set<String> into) {
    for (Column column : listOrEmpty(columns)) {
      addGlossaryFqns(column.getTags(), into);
      collectColumnGlossary(column.getChildren(), into);
    }
  }

  /**
   * Per-item PBAC: when the caller's security context is present (the MCP path), knowledge items
   * the caller cannot view are dropped from the bundle — being allowed to view the asset does not
   * imply access to every glossary term, article, pill, or metric attached to it. Server-internal
   * callers (no security context) are not filtered.
   */
  private boolean canViewKnowledge(String knowledgeType, String knowledgeFqn) {
    boolean visible = true;
    if (authorizer != null && securityContext != null) {
      try {
        authorizer.authorize(
            securityContext,
            new OperationContext(knowledgeType, MetadataOperation.VIEW_BASIC),
            new ResourceContext<>(knowledgeType, null, knowledgeFqn));
      } catch (AuthorizationException e) {
        LOG.debug(
            "AIContext: dropping {} {} not viewable by caller: {}",
            knowledgeType,
            knowledgeFqn,
            e.getMessage());
        visible = false;
      } catch (Exception e) {
        // Not an authorization decision (policy-store hiccup, resolution error). Still fail
        // closed, but at WARN so an incomplete context is distinguishable from a denial.
        LOG.warn(
            "AIContext: failed to check access to {} {}; dropping (fail-closed): {}",
            knowledgeType,
            knowledgeFqn,
            e.getMessage());
        visible = false;
      }
    }
    return visible;
  }

  private boolean canViewPill(ContextMemory pill) {
    return securityContext == null
        || !ContextMemoryVisibility.filterByVisibility(List.of(pill), securityContext).isEmpty();
  }

  private KnowledgeItem toGlossaryKnowledgeItem(String termFqn) {
    KnowledgeItem item = null;
    try {
      GlossaryTerm term =
          Entity.getEntityByName(Entity.GLOSSARY_TERM, termFqn, "", Include.NON_DELETED);
      if (isApproved(term) && canViewKnowledge(Entity.GLOSSARY_TERM, termFqn)) {
        item =
            new KnowledgeItem()
                .withId(term.getId())
                .withType(KnowledgeItem.Type.GLOSSARY_TERM)
                .withName(term.getName())
                .withDisplayName(term.getDisplayName())
                .withFullyQualifiedName(term.getFullyQualifiedName())
                .withContent(unescapeRichText(term.getDescription()));
      }
    } catch (Exception e) {
      LOG.warn("AIContext: failed to resolve glossary term {}: {}", termFqn, e.getMessage());
    }
    return item;
  }

  private static boolean isApproved(GlossaryTerm term) {
    EntityStatus status = term.getEntityStatus();
    return status == null || status == EntityStatus.APPROVED;
  }

  private List<KnowledgeItem> resolveArticles(EntityInterface entity) {
    List<KnowledgeItem> items = new ArrayList<>();
    addItems(
        items,
        capWithLog(findAttachedPages(entity), MAX_ARTICLES, "articles"),
        this::toArticleKnowledgeItem);
    addItems(
        items,
        capWithLog(findAttachedPills(entity), MAX_ARTICLES, "pills"),
        this::toPillKnowledgeItem);
    return items;
  }

  private void addItems(
      List<KnowledgeItem> items,
      List<EntityReference> refs,
      Function<EntityReference, KnowledgeItem> mapper) {
    for (EntityReference ref : refs) {
      KnowledgeItem item = mapper.apply(ref);
      if (item != null) {
        items.add(item);
      }
    }
  }

  private List<EntityReference> findAttachedPills(EntityInterface entity) {
    // Edge direction: primaryEntity --APPLIED_TO--> contextMemory (see ContextMemoryRepository).
    // The asset is the FROM side, so the pills are resolved as the TO side via findTo.
    List<EntityReference> pills = new ArrayList<>();
    try {
      pills =
          Entity.getEntityRepository(entityType)
              .findTo(entity.getId(), entityType, Relationship.APPLIED_TO, Entity.CONTEXT_MEMORY);
    } catch (Exception e) {
      LOG.warn("AIContext: failed to list knowledge pills for {}: {}", fqn, e.getMessage());
    }
    return pills;
  }

  private KnowledgeItem toPillKnowledgeItem(EntityReference ref) {
    KnowledgeItem item = null;
    try {
      ContextMemory pill = Entity.getEntity(ref, "", Include.NON_DELETED);
      if (canViewPill(pill)) {
        item =
            new KnowledgeItem()
                .withId(pill.getId())
                .withType(KnowledgeItem.Type.CONTEXT_MEMORY)
                .withName(pill.getName())
                .withDisplayName(pill.getDisplayName())
                .withFullyQualifiedName(pill.getFullyQualifiedName())
                .withContent(pillContent(pill));
      }
    } catch (Exception e) {
      LOG.warn("AIContext: failed to fetch knowledge pill {}: {}", ref.getName(), e.getMessage());
    }
    return item;
  }

  private static String pillContent(ContextMemory pill) {
    String content = pill.getDescription();
    if (!nullOrEmpty(pill.getSummary())) {
      content = pill.getSummary();
    } else if (!nullOrEmpty(pill.getAnswer())) {
      content = pill.getAnswer();
    }
    return unescapeRichText(content);
  }

  private List<KnowledgeItem> resolveMetrics(EntityInterface entity) {
    List<KnowledgeItem> items = new ArrayList<>();
    addItems(
        items,
        capList(findAttachedMetrics(entity), MAX_KNOWLEDGE_ITEMS),
        this::toMetricKnowledgeItem);
    return items;
  }

  private List<EntityReference> findAttachedMetrics(EntityInterface entity) {
    List<EntityReference> metrics = new ArrayList<>();
    try {
      metrics =
          Entity.getEntityRepository(entityType)
              .findFrom(entity.getId(), entityType, Relationship.APPLIED_TO, Entity.METRIC);
    } catch (Exception e) {
      LOG.warn("AIContext: failed to list metrics for {}: {}", fqn, e.getMessage());
    }
    return metrics;
  }

  private KnowledgeItem toMetricKnowledgeItem(EntityReference ref) {
    KnowledgeItem item = null;
    try {
      Metric metric = Entity.getEntity(ref, "", Include.NON_DELETED);
      if (canViewKnowledge(Entity.METRIC, metric.getFullyQualifiedName())) {
        item =
            new KnowledgeItem()
                .withId(metric.getId())
                .withType(KnowledgeItem.Type.METRIC)
                .withName(metric.getName())
                .withDisplayName(metric.getDisplayName())
                .withFullyQualifiedName(metric.getFullyQualifiedName())
                .withContent(metricContent(metric));
      }
    } catch (Exception e) {
      LOG.warn("AIContext: failed to fetch metric {}: {}", ref.getName(), e.getMessage());
    }
    return item;
  }

  /**
   * The full (un-budgeted) body of a knowledge entity, for the get_knowledge_content tool's
   * progressive-disclosure path. Keeps the per-type extraction (metric expression, pill answer)
   * in one place so it matches what the bundle excerpts.
   */
  public static String fullContentOf(EntityInterface entity) {
    String content;
    if (entity instanceof Metric metric) {
      content = metricContent(metric);
    } else if (entity instanceof ContextMemory pill) {
      content = pillContent(pill);
    } else {
      content = unescapeRichText(entity.getDescription());
    }
    return content;
  }

  /**
   * Block-editor rich text is persisted HTML-entity-escaped (e.g. {@code &#96;} for a backtick,
   * {@code &gt;&#61;} for {@code >=}). Un-escape it before it enters the AIContext so the markdown an
   * LLM consumes carries real code fences and operators, not their entity references.
   */
  static String unescapeRichText(String value) {
    return nullOrEmpty(value) ? value : StringEscapeUtils.unescapeHtml4(value);
  }

  static String metricContent(Metric metric) {
    StringBuilder content = new StringBuilder();
    if (!nullOrEmpty(metric.getDescription())) {
      content.append(unescapeRichText(metric.getDescription()));
    }
    MetricExpression expression = metric.getMetricExpression();
    if (expression != null && !nullOrEmpty(expression.getCode())) {
      if (content.length() > 0) {
        content.append('\n');
      }
      content.append(expression.getCode());
    }
    return content.toString();
  }

  private List<EntityReference> findAttachedPages(EntityInterface entity) {
    List<EntityReference> pages = new ArrayList<>();
    try {
      pages =
          Entity.getEntityRepository(entityType)
              .findTo(entity.getId(), entityType, Relationship.HAS, Entity.PAGE);
    } catch (Exception e) {
      LOG.warn("AIContext: failed to list attached articles for {}: {}", fqn, e.getMessage());
    }
    return pages;
  }

  private KnowledgeItem toArticleKnowledgeItem(EntityReference ref) {
    KnowledgeItem item = null;
    try {
      Page page = Entity.getEntity(ref, "", Include.NON_DELETED);
      if (canViewKnowledge(Entity.PAGE, page.getFullyQualifiedName())) {
        item =
            new KnowledgeItem()
                .withId(page.getId())
                .withType(KnowledgeItem.Type.PAGE)
                .withName(page.getName())
                .withDisplayName(page.getDisplayName())
                .withFullyQualifiedName(page.getFullyQualifiedName())
                .withContent(unescapeRichText(page.getDescription()));
      }
    } catch (Exception e) {
      LOG.warn(
          "AIContext: failed to fetch article {}: {}", ref.getFullyQualifiedName(), e.getMessage());
    }
    return item;
  }

  private static AssetContext buildAssetContext(EntityInterface entity) {
    AssetContext context = new AssetContext();
    if (entity instanceof Table table) {
      context.withTable(buildTableContext(table));
    }
    return context;
  }

  /**
   * Materializes the cheap, entity-local structural context onto an entity's search document: a
   * normalized {@code aiContext} blob (served with the entity) plus a queryable
   * {@code aiContextForeignKeyTargets} keyword list of the columns this table's foreign keys
   * reference. Only tables carry structural context today; other entity types are a no-op.
   */
  public static void applySearchFields(Map<String, Object> doc, EntityInterface entity) {
    if (entity instanceof Table table) {
      TableContext context = buildTableContext(table);
      doc.put("aiContext", Map.of("table", JsonUtils.getMap(context)));
      List<String> foreignKeyTargets = foreignKeyTargets(context);
      if (!foreignKeyTargets.isEmpty()) {
        doc.put("aiContextForeignKeyTargets", foreignKeyTargets);
      }
    }
  }

  static List<String> foreignKeyTargets(TableContext context) {
    List<String> targets = new ArrayList<>();
    for (ForeignKey foreignKey : listOrEmpty(context.getForeignKeys())) {
      targets.addAll(listOrEmpty(foreignKey.getReferredColumns()));
    }
    return targets;
  }

  static TableContext buildTableContext(Table table) {
    return new TableContext()
        .withColumns(toFieldContexts(table.getColumns()))
        .withPrimaryKey(extractPrimaryKey(table))
        .withForeignKeys(extractForeignKeys(table))
        .withFrequentJoins(extractJoins(table))
        .withPartitionColumns(extractPartitionColumns(table))
        .withSchemaDefinition(table.getSchemaDefinition())
        .withDataModel(toDataModelContext(table.getDataModel()));
  }

  /**
   * Projects the table's dbt/DDL {@link DataModel} into the AI context: its type, model-file path,
   * source project, and the SQL that defines it — the compiled SQL when present, else the raw
   * (templated) SQL. Returns null when the table carries no model, so the section is skipped.
   */
  static TableDataModel toDataModelContext(DataModel dataModel) {
    TableDataModel context = null;
    if (dataModel != null) {
      context =
          new TableDataModel()
              .withModelType(modelTypeValue(dataModel))
              .withPath(dataModel.getPath())
              .withSourceProject(dataModel.getDbtSourceProject())
              .withSql(boundedSql(definingSql(dataModel)));
      if (isEmptyDataModel(context)) {
        context = null;
      }
    }
    return context;
  }

  private static String definingSql(DataModel dataModel) {
    return nullOrEmpty(dataModel.getSql()) ? dataModel.getRawSql() : dataModel.getSql();
  }

  private static String modelTypeValue(DataModel dataModel) {
    return dataModel.getModelType() == null ? null : dataModel.getModelType().value();
  }

  private static String boundedSql(String sql) {
    String result = sql;
    if (!nullOrEmpty(sql) && sql.length() > MAX_DATA_MODEL_SQL_CHARS) {
      result = sql.substring(0, MAX_DATA_MODEL_SQL_CHARS) + "\n… (truncated)";
    }
    return result;
  }

  private static boolean isEmptyDataModel(TableDataModel model) {
    return nullOrEmpty(model.getModelType())
        && nullOrEmpty(model.getPath())
        && nullOrEmpty(model.getSourceProject())
        && nullOrEmpty(model.getSql());
  }

  static List<FieldContext> toFieldContexts(List<Column> columns) {
    List<FieldContext> fields = new ArrayList<>();
    for (Column column : listOrEmpty(columns)) {
      fields.add(
          new FieldContext()
              .withName(column.getName())
              .withDataType(columnType(column))
              .withConstraint(
                  column.getConstraint() == null ? null : column.getConstraint().value())
              .withDescription(unescapeRichText(column.getDescription())));
    }
    return fields;
  }

  private static String columnType(Column column) {
    String display = column.getDataTypeDisplay();
    return !nullOrEmpty(display)
        ? display
        : (column.getDataType() == null ? null : column.getDataType().value());
  }

  static List<String> extractPrimaryKey(Table table) {
    List<String> primaryKey = new ArrayList<>();
    for (TableConstraint constraint : listOrEmpty(table.getTableConstraints())) {
      if (constraint.getConstraintType() == TableConstraint.ConstraintType.PRIMARY_KEY) {
        primaryKey.addAll(listOrEmpty(constraint.getColumns()));
      }
    }
    for (Column column : listOrEmpty(table.getColumns())) {
      if (column.getConstraint() == org.openmetadata.schema.type.ColumnConstraint.PRIMARY_KEY
          && !primaryKey.contains(column.getName())) {
        primaryKey.add(column.getName());
      }
    }
    return primaryKey;
  }

  static List<ForeignKey> extractForeignKeys(Table table) {
    List<ForeignKey> foreignKeys = new ArrayList<>();
    for (TableConstraint constraint : listOrEmpty(table.getTableConstraints())) {
      if (constraint.getConstraintType() == TableConstraint.ConstraintType.FOREIGN_KEY) {
        foreignKeys.add(
            new ForeignKey()
                .withColumns(constraint.getColumns())
                .withReferredColumns(constraint.getReferredColumns())
                .withRelationshipType(cardinality(constraint)));
      }
    }
    return foreignKeys;
  }

  private static String cardinality(TableConstraint constraint) {
    return constraint.getRelationshipType() == null
        ? null
        : constraint.getRelationshipType().value();
  }

  static List<JoinHint> extractJoins(Table table) {
    List<JoinHint> hints = new ArrayList<>();
    TableJoins joins = table.getJoins();
    if (joins != null) {
      for (ColumnJoin columnJoin : listOrEmpty(joins.getColumnJoins())) {
        collectJoinHints(columnJoin, hints);
      }
    }
    hints.sort(Comparator.comparingInt(AIContextBuilder::joinCount).reversed());
    return capList(hints, MAX_JOIN_HINTS);
  }

  private static void collectJoinHints(ColumnJoin columnJoin, List<JoinHint> hints) {
    for (JoinedWith joinedWith : listOrEmpty(columnJoin.getJoinedWith())) {
      hints.add(
          new JoinHint()
              .withColumn(columnJoin.getColumnName())
              .withJoinedWith(joinedWith.getFullyQualifiedName())
              .withJoinCount(joinedWith.getJoinCount()));
    }
  }

  private static int joinCount(JoinHint hint) {
    return hint.getJoinCount() == null ? 0 : hint.getJoinCount();
  }

  static List<String> extractPartitionColumns(Table table) {
    List<String> columns = new ArrayList<>();
    TablePartition partition = table.getTablePartition();
    if (partition != null) {
      for (PartitionColumnDetails details : listOrEmpty(partition.getColumns())) {
        columns.add(details.getColumnName());
      }
    }
    return columns;
  }

  private static <T> List<T> capped(Set<T> values, int max) {
    return capList(new ArrayList<>(values), max);
  }

  private static <T> List<T> capList(List<T> values, int max) {
    return values.size() > max ? new ArrayList<>(values.subList(0, max)) : values;
  }

  /**
   * Caps to {@code max} and surfaces any overflow: the kept subset is currently unranked, so a
   * dropped item could be more relevant than a kept one. Logging keeps the truncation from being
   * silent until relevance/recency ranking is added.
   */
  private <T> List<T> capWithLog(List<T> values, int max, String label) {
    if (values.size() > max) {
      LOG.debug(
          "AIContext {}: dropped {} of {} {} at the cap of {} (unranked overflow)",
          fqn,
          values.size() - max,
          values.size(),
          label,
          max);
    }
    return capList(values, max);
  }
}
