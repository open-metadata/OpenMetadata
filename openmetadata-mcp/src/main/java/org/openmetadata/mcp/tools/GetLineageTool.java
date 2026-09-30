package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.google.common.annotations.VisibleForTesting;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.PageCursor;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TempLineageTable;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.lineage.LineagePermissionFilter;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Returns a compact, LLM-friendly lineage graph. The raw {@link EntityLineage} from the repository
 * is intentionally verbose (full SQL, column-level mappings, node descriptions) and can reach
 * hundreds of KB for even a couple of nodes. This tool slims it to identity + relationship info,
 * folding node details into edge endpoints. Column lineage and full SQL are dropped by default and
 * only surfaced on request, keeping the default response table-level. All slimming happens here in
 * the tool — the repository and its UI/RCA callers are untouched.
 */
@Slf4j
public class GetLineageTool implements McpTool {

  // Defaults matching ai-platform GetLineageTool.kt for consistency
  private static final int DEFAULT_DEPTH = 3;
  // Maximum depth to prevent exponential response growth (lineage graphs can explode)
  private static final int MAX_DEPTH = 10;
  private static final String RELATIONSHIP_SQL = "sql";
  private static final String PARAM_INCLUDE_COLUMN_LINEAGE = "includeColumnLineage";
  private static final String PARAM_INCLUDE_SQL = "includeSql";
  private static final String PARAM_COLUMN = "column";
  private static final String PARAM_CURSOR = "cursor";
  private static final String COLUMN_UNMAPPED_EDGES_KEY = "columnUnmappedEdges";
  private static final String OVERSIZED_EDGES_KEY = "oversizedEdges";

  @JsonInclude(JsonInclude.Include.NON_NULL)
  record SlimEdge(
      String fromFQN,
      String toFQN,
      String fromName,
      String toName,
      String fromType,
      String toType,
      String relationshipType,
      String pipelineFQN,
      String pipelineDescription,
      String edgeDescription,
      String source,
      Integer assetEdges,
      String sqlQuery,
      Boolean sqlTruncated,
      Boolean hasSql,
      List<TempLineageTable> tempLineageTables,
      Long updatedAt,
      String updatedBy,
      List<ColumnLineage> columnsLineage) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  record SlimLineage(
      String root,
      String rootId,
      String rootType,
      List<SlimEdge> upstream,
      List<SlimEdge> downstream) {}

  private record SqlText(String value, Boolean truncated, Boolean present) {}

  /** What an edge should carry. Grouped so the slimming chain keeps a small, stable signature. */
  record EdgeOptions(boolean includeColumnLineage, boolean includeSql) {}

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    validateParams(params);
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    // Authorize by FQN so entity-scoped tag/owner/domain policies are evaluated, not just the
    // resource-type permission. A ResourceContext with no id and no name never resolves an entity,
    // leaving every attribute unread: matchAnyTag then reads false whether or not the tag is
    // present, so a Deny fires on every entity in one polarity and on none in the other.
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(entityType, null, fqn));
    int upstreamDepth = clampDepth(McpParams.getInt(params, "upstreamDepth", DEFAULT_DEPTH));
    int downstreamDepth = clampDepth(McpParams.getInt(params, "downstreamDepth", DEFAULT_DEPTH));
    String column = requestedColumn(params, entityType, fqn, securityContext);
    EdgeOptions options =
        new EdgeOptions(
            column != null || McpParams.getBoolean(params, PARAM_INCLUDE_COLUMN_LINEAGE, false),
            McpParams.getBoolean(params, PARAM_INCLUDE_SQL, false));
    LOG.info(
        "Getting lineage for entity type: {}, FQN: {}, upstreamDepth: {}, downstreamDepth: {}, "
            + "includeColumnLineage: {}, column: {}",
        entityType,
        fqn,
        upstreamDepth,
        downstreamDepth,
        options.includeColumnLineage(),
        column);
    // The subject context applies the caller's domain restrictions
    // (LineageRepository.pruneLineageByDomain); the overload without it prunes nothing.
    SubjectContext subjectContext = getSubjectContext(securityContext);
    // The reporting overload so domain-scoped removals are counted too; otherwise hiddenNodes
    // silently omits them and understates what was withheld.
    LineageRepository.DomainPrunedLineage pruned =
        Entity.getLineageRepository()
            .getByNameReportingPrune(
                entityType, fqn, upstreamDepth, downstreamDepth, subjectContext);
    EntityLineage lineage = pruned.lineage();
    // Before the permission filter, so its node ceiling is spent on the column's graph, not on
    // every table around a busy root.
    int unmappedEdges = column == null ? 0 : ColumnLineageScope.narrow(lineage, column);
    // Authorizing the root only grants the root. Neighbour nodes carry their own FQNs, names and
    // descriptions, so an entity-scoped policy has to be applied to them as well or the graph
    // discloses exactly the assets the policy hides.
    LineagePermissionFilter permissionFilter = new LineagePermissionFilter(authorizer);
    LineagePermissionFilter.Result filtered =
        permissionFilter.filter(securityContext, subjectContext, lineage);
    // A pipeline is edge metadata, not a graph node, so the node filter never saw it. It is its own
    // entity with its own policy, and its FQN, description and name would otherwise ride out on an
    // edge whose two endpoints are both visible.
    Predicate<EntityReference> pipelineVisible =
        pipelineVisibility(permissionFilter, securityContext, filtered.lineage());
    Map<String, Object> result =
        enforceSizeBudget(
            toSlim(filtered.lineage(), options, pipelineVisible),
            pageStart(McpParams.getString(params, PARAM_CURSOR, null)));
    if (column != null) {
      annotateUnmappedEdges(result, unmappedEdges);
    }
    return annotateVisibility(result, filtered, pruned.hiddenNodes());
  }

  /**
   * An edge with no column mappings may or may not carry the column, so it is left out - but saying
   * nothing made an unmapped consumer read as "nothing depends on this column".
   */
  private static void annotateUnmappedEdges(Map<String, Object> result, int unmappedEdges) {
    result.put(COLUMN_UNMAPPED_EDGES_KEY, unmappedEdges);
    if (unmappedEdges > 0) {
      appendMessage(
          result,
          String.format(
              "%d lineage edge(s) out of tables this column reaches have no column-level mappings,"
                  + " so whether the column flows through them is unknown; they were left out."
                  + " Call without 'column' to see them.",
              unmappedEdges));
    }
  }

  /** Several independent facts can each need saying; none may overwrite another. */
  private static void appendMessage(Map<String, Object> result, String note) {
    Object existing = result.get(McpResponseTrim.MESSAGE_KEY);
    result.put(McpResponseTrim.MESSAGE_KEY, existing == null ? note : existing + " " + note);
  }

  /**
   * Decides each distinct pipeline once. A graph commonly repeats one pipeline across many edges, so
   * a per-edge check would re-evaluate the same policy repeatedly.
   */
  private static Predicate<EntityReference> pipelineVisibility(
      LineagePermissionFilter filter,
      CatalogSecurityContext securityContext,
      EntityLineage lineage) {
    if (lineage == null) {
      return pipeline -> true;
    }
    Map<UUID, Boolean> decisions = new HashMap<>();
    // No pipeline at all is nothing to hide. A pipeline we cannot identify is one we cannot
    // authorize, so it is withheld rather than waved through.
    return pipeline ->
        pipeline == null
            || (pipeline.getId() != null
                && decisions.computeIfAbsent(
                    pipeline.getId(), id -> filter.canView(securityContext, pipeline)));
  }

  /**
   * Records what the permission filter removed. An LLM cannot tell a small graph from a pruned one,
   * so a graph that lost nodes must say so rather than reading as complete lineage.
   */
  private static Map<String, Object> annotateVisibility(
      Map<String, Object> result, LineagePermissionFilter.Result filtered, int domainHiddenNodes) {
    int hidden = filtered.hiddenNodes() + domainHiddenNodes;
    result.put(McpResponseTrim.HIDDEN_NODES_KEY, hidden);
    result.put(McpResponseTrim.HIDDEN_UNCHECKED_KEY, filtered.hiddenUnchecked());
    String note = visibilityNote(filtered, hidden);
    if (note != null) {
      appendMessage(result, note);
    }
    return result;
  }

  /**
   * Deliberately says "or are only reachable through such a node": removing a denied node also cuts
   * off whatever sat behind it, so the count is not purely a count of denials.
   */
  private static String visibilityNote(LineagePermissionFilter.Result filtered, int hidden) {
    String note = null;
    if (filtered.hiddenUnchecked()) {
      note =
          String.format(
              "%d node(s) were removed from this graph, and %d of those lie beyond the"
                  + " authorization limit and were never checked. Reduce"
                  + " upstreamDepth/downstreamDepth for a complete, fully authorized graph at a"
                  + " shallower depth.",
              hidden, filtered.uncheckedNodes());
    } else if (hidden > 0) {
      note =
          String.format(
              "%d node(s) were removed because your permissions do not allow viewing them, or"
                  + " because they are only reachable through such a node; the graph shown is the"
                  + " connected part you can see.",
              hidden);
    }
    return note;
  }

  private static void validateParams(Map<String, Object> params) {
    if (nullOrEmpty(params)) {
      throw new IllegalArgumentException("Parameters cannot be null or empty");
    }
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    if (nullOrEmpty(entityType) || nullOrEmpty(fqn)) {
      throw new IllegalArgumentException("Parameters 'entityType' and 'fqn' are required");
    }
  }

  private static String requestedColumn(
      Map<String, Object> params,
      String entityType,
      String fqn,
      CatalogSecurityContext securityContext) {
    String column = McpParams.getString(params, PARAM_COLUMN, null);
    return column == null ? null : requireExistingColumn(entityType, fqn, column, securityContext);
  }

  /** The cheap FQN check first, so a column of another entity never costs an entity read. */
  private static String requireExistingColumn(
      String entityType, String fqn, String column, CatalogSecurityContext securityContext) {
    ColumnLineageScope.requireColumnOf(fqn, column);
    EntityInterface entity =
        CommonUtils.readEntityForCaller(entityType, fqn, "", Include.NON_DELETED, securityContext);
    return ColumnLineageScope.requireColumnExists(entity, column);
  }

  @VisibleForTesting
  static SlimLineage toSlim(EntityLineage lineage, boolean includeColumnLineage) {
    return toSlim(lineage, new EdgeOptions(includeColumnLineage, true));
  }

  static SlimLineage toSlim(EntityLineage lineage, EdgeOptions options) {
    return toSlim(lineage, options, pipeline -> true);
  }

  static SlimLineage toSlim(
      EntityLineage lineage, EdgeOptions options, Predicate<EntityReference> pipelineVisible) {
    Map<UUID, EntityReference> nodeIndex = buildNodeIndex(lineage);
    List<SlimEdge> upstream =
        slimEdges(lineage.getUpstreamEdges(), nodeIndex, options, pipelineVisible);
    List<SlimEdge> downstream =
        slimEdges(lineage.getDownstreamEdges(), nodeIndex, options, pipelineVisible);
    EntityReference root = lineage.getEntity();
    return new SlimLineage(
        refFqn(root),
        root != null && root.getId() != null ? root.getId().toString() : null,
        refType(root),
        upstream,
        downstream);
  }

  private static Map<UUID, EntityReference> buildNodeIndex(EntityLineage lineage) {
    Map<UUID, EntityReference> index = new HashMap<>();
    if (lineage.getEntity() != null) {
      index.put(lineage.getEntity().getId(), lineage.getEntity());
    }
    if (!nullOrEmpty(lineage.getNodes())) {
      lineage.getNodes().forEach(node -> index.put(node.getId(), node));
    }
    return index;
  }

  private static List<SlimEdge> slimEdges(
      List<Edge> edges,
      Map<UUID, EntityReference> nodeIndex,
      EdgeOptions options,
      Predicate<EntityReference> pipelineVisible) {
    // The repository dedups nodes but not edges: a node reachable via multiple paths has its
    // upstream/downstream edges re-added on each recursion. Identical slim edges carry no extra
    // information, so collapse them with a LinkedHashSet (record equality), preserving order.
    Set<SlimEdge> deduped = new LinkedHashSet<>();
    if (!nullOrEmpty(edges)) {
      edges.forEach(edge -> deduped.add(buildSlimEdge(edge, nodeIndex, options, pipelineVisible)));
    }
    return new ArrayList<>(deduped);
  }

  private static SlimEdge buildSlimEdge(
      Edge edge,
      Map<UUID, EntityReference> nodeIndex,
      EdgeOptions options,
      Predicate<EntityReference> pipelineVisible) {
    // computeLineage adds every edge endpoint to nodes (or it is the root), so nodeIndex
    // resolves both ends. If that invariant ever breaks (a partial/cached graph), the endpoint
    // fields come back null and identical anonymous edges dedup-collapse — warn instead of
    // silently emitting a linkless edge.
    EntityReference from = nodeIndex.get(edge.getFromEntity());
    EntityReference to = nodeIndex.get(edge.getToEntity());
    if (from == null || to == null) {
      LOG.warn(
          "Lineage edge endpoint missing from node index (from={}, to={}); emitting partial edge",
          edge.getFromEntity(),
          edge.getToEntity());
    }
    LineageDetails details = edge.getLineageDetails();
    EntityReference pipeline = details != null ? details.getPipeline() : null;
    // A denied pipeline still gets to say that a pipeline is what connects these two assets; what
    // it does not get to say is which pipeline.
    EntityReference namedPipeline = pipelineVisible.test(pipeline) ? pipeline : null;
    SqlText sql = sqlText(details, options.includeSql());
    return new SlimEdge(
        refFqn(from),
        refFqn(to),
        refName(from),
        refName(to),
        refType(from),
        refType(to),
        relationshipType(pipeline, namedPipeline != null),
        namedPipeline != null ? namedPipeline.getFullyQualifiedName() : null,
        namedPipeline != null ? namedPipeline.getDescription() : null,
        details != null ? details.getDescription() : null,
        sourceValue(details),
        details != null ? details.getAssetEdges() : null,
        sql.value(),
        sql.truncated(),
        sql.present(),
        tempLineageTablesOf(details, options.includeSql()),
        details != null ? details.getUpdatedAt() : null,
        details != null ? details.getUpdatedBy() : null,
        columnsLineageOf(details, options.includeColumnLineage()));
  }

  private static List<ColumnLineage> columnsLineageOf(
      LineageDetails details, boolean includeColumns) {
    List<ColumnLineage> columns = null;
    if (includeColumns && details != null && !nullOrEmpty(details.getColumnsLineage())) {
      columns = details.getColumnsLineage();
    }
    return columns;
  }

  private static String relationshipType(EntityReference pipeline, boolean named) {
    String relationship = RELATIONSHIP_SQL;
    if (pipeline != null) {
      relationship = named ? pipeline.getType() + ":" + pipeline.getName() : pipeline.getType();
    }
    return relationship;
  }

  /**
   * Temp-table hops are table <em>names</em> parsed out of the transformation, not catalog entities,
   * so there is no policy to evaluate them against. They are identifiers lifted from the SQL, so
   * they travel with the SQL rather than being returned by default.
   */
  private static List<TempLineageTable> tempLineageTablesOf(
      LineageDetails details, boolean includeSql) {
    return includeSql && details != null ? details.getTempLineageTables() : null;
  }

  private static String sourceValue(LineageDetails details) {
    return details != null && details.getSource() != null ? details.getSource().value() : null;
  }

  /**
   * Edge SQL is opt-in. On an 18-edge graph {@code sqlQuery} was ~94% of the response, so a caller
   * asking "what feeds this table?" paid for transformation SQL to learn 18 table names.
   *
   * <p>When SQL is not requested the text is omitted and {@code hasSql} is set instead, so the
   * caller still knows a transformation exists and can re-request with {@code includeSql=true}.
   * Dropping it silently would hide that it was ever there.
   *
   * <p>When SQL <em>is</em> requested it is returned in full and never cut. Size is then controlled
   * by returning fewer edges (see {@link #enforceSizeBudget}).
   */
  private static SqlText sqlText(LineageDetails details, boolean includeSql) {
    final String sql = details != null ? details.getSqlQuery() : null;
    final Boolean present = nullOrEmpty(sql) ? null : Boolean.TRUE;
    return new SqlText(includeSql ? sql : null, null, present);
  }

  private static String refFqn(EntityReference ref) {
    return ref != null ? ref.getFullyQualifiedName() : null;
  }

  private static String refType(EntityReference ref) {
    return ref != null ? ref.getType() : null;
  }

  private static String refName(EntityReference ref) {
    String name = null;
    if (ref != null) {
      name = ref.getDisplayName() != null ? ref.getDisplayName() : ref.getName();
    }
    return name;
  }

  @VisibleForTesting
  static Map<String, Object> enforceSizeBudget(SlimLineage slim) {
    return enforceSizeBudget(slim, 0);
  }

  /**
   * Keeps the response under the dispatch-level cap by returning fewer <em>edges</em>, never by
   * dropping the whole graph to a bare count or by cutting an edge's SQL, and makes the withheld
   * edges reachable: a clipped page carries a {@code nextCursor} that resumes at the next edge.
   *
   * <p>Always states whether the graph is complete. "30 downstream" and "at least 30 downstream" are
   * different answers to "what breaks if I deprecate this", and the response used to carry no signal
   * either way. {@code get_entity_details} has flagged the analogous column case with {@code
   * columnsTruncated} all along.
   */
  static Map<String, Object> enforceSizeBudget(SlimLineage slim, int from) {
    LineageEdgePager.Page page = LineageEdgePager.page(slim, from);
    Map<String, Object> result =
        JsonUtils.getMap(
            new SlimLineage(
                slim.root(), slim.rootId(), slim.rootType(), page.upstream(), page.downstream()));
    result.put("totalEdges", page.total());
    result.put("returnedEdges", page.returned());
    result.put("edgesTruncated", page.hasMore());
    if (page.hasMore()) {
      annotateNextPage(result, slim, page);
    }
    if (!page.oversized().isEmpty()) {
      annotateOversizedEdges(result, page.oversized());
    }
    return result;
  }

  private static void annotateOversizedEdges(Map<String, Object> result, List<SlimEdge> edges) {
    List<String> named =
        edges.stream().map(edge -> edge.fromFQN() + " -> " + edge.toFQN()).toList();
    result.put(OVERSIZED_EDGES_KEY, named);
    appendMessage(
        result,
        String.format(
            "%d edge(s) were too large for any response and were skipped, listed in"
                + " '%s'. This is usually their SQL; call without includeSql to see them.",
            named.size(), OVERSIZED_EDGES_KEY));
  }

  private static void annotateNextPage(
      Map<String, Object> result, SlimLineage slim, LineageEdgePager.Page page) {
    result.put("truncated", Boolean.TRUE);
    result.put("upstreamReturned", page.upstream().size());
    result.put("upstreamTotal", listOrEmpty(slim.upstream()).size());
    result.put("downstreamReturned", page.downstream().size());
    result.put("downstreamTotal", listOrEmpty(slim.downstream()).size());
    result.put(McpResponseTrim.HAS_MORE_KEY, Boolean.TRUE);
    result.put(McpResponseTrim.NEXT_CURSOR_KEY, PageCursor.encodeOffset(page.nextFrom()));
    result.put(
        McpResponseTrim.MESSAGE_KEY,
        String.format(
            "Graph clipped to fit the response budget: edges %d-%d of %d returned. Call again with"
                + " the same arguments and cursor=nextCursor for the next page.",
            page.start() + 1, page.nextFrom(), page.total()));
  }

  /** A missing or unreadable cursor starts at the first edge rather than failing the call. */
  static int pageStart(String cursor) {
    return PageCursor.decode(cursor)
        .filter(PageCursor.Cursor::isOffset)
        .map(PageCursor.Cursor::offset)
        .orElse(0);
  }

  /**
   * Clamps a requested depth into {@code [1, MAX_DEPTH]} to prevent excessive response sizes that
   * could overwhelm LLM context. Parsing is delegated to {@link McpParams}; the valid range is
   * specific to this tool, so the clamp stays here.
   */
  /**
   * Zero is a meaningful request, not a mistake: it is how a caller asks for one direction only.
   * {@code LineageRepository} honours 0, so clamping the floor to 1 here silently overrode the
   * caller and returned the edges they asked to omit.
   */
  private static int clampDepth(int depth) {
    return Math.min(Math.max(depth, 0), MAX_DEPTH);
  }

  @VisibleForTesting
  static int clampDepthForTest(int depth) {
    return clampDepth(depth);
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    throw new UnsupportedOperationException("GetLineageTool does not support limits enforcement.");
  }
}
