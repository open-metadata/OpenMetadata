package org.openmetadata.mcp.tools;

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
import org.openmetadata.mcp.util.ResponseBudget;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
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
    EdgeOptions options =
        new EdgeOptions(
            McpParams.getBoolean(params, PARAM_INCLUDE_COLUMN_LINEAGE, false),
            McpParams.getBoolean(params, PARAM_INCLUDE_SQL, false));
    LOG.info(
        "Getting lineage for entity type: {}, FQN: {}, upstreamDepth: {}, downstreamDepth: {}, "
            + "includeColumnLineage: {}",
        entityType,
        fqn,
        upstreamDepth,
        downstreamDepth,
        options.includeColumnLineage());
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
    return annotateVisibility(
        enforceSizeBudget(toSlim(filtered.lineage(), options, pipelineVisible)),
        filtered,
        pruned.hiddenNodes());
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
    return pipeline ->
        pipeline == null
            || pipeline.getId() == null
            || decisions.computeIfAbsent(
                pipeline.getId(), id -> filter.canView(securityContext, pipeline));
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
      // annotateCompleteness may already have explained edge clipping; both facts matter.
      Object existing = result.get(McpResponseTrim.MESSAGE_KEY);
      result.put(McpResponseTrim.MESSAGE_KEY, existing == null ? note : existing + " " + note);
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
              "This graph was too large to authorize in full, so %d node(s) beyond the limit were"
                  + " removed without being checked. Reduce upstreamDepth/downstreamDepth for a"
                  + " complete, fully authorized graph at a shallower depth.",
              hidden);
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

  /**
   * Keeps the response under the dispatch-level cap by returning fewer <em>edges</em>, never by
   * dropping the whole graph to a bare count or by cutting an edge's SQL. When everything fits (the
   * common case, including full edge SQL) the complete graph is returned unchanged. When it does not,
   * the size budget is split fairly between the two directions so both upstream and downstream stay
   * represented, and per-direction markers tell the caller how many edges were withheld.
   */
  @VisibleForTesting
  /**
   * Always states whether the graph is complete.
   *
   * <p>"30 downstream" and "at least 30 downstream" are different answers to "what breaks if I
   * deprecate this", and the response used to carry no signal either way. {@code get_entity_details}
   * has flagged the analogous column case with {@code columnsTruncated} all along.
   */
  static Map<String, Object> enforceSizeBudget(SlimLineage slim) {
    int totalUpstream = slim.upstream() == null ? 0 : slim.upstream().size();
    int totalDownstream = slim.downstream() == null ? 0 : slim.downstream().size();
    Map<String, Object> full = JsonUtils.getMap(slim);
    Map<String, Object> result = full;
    if (McpResponseTrim.serializedLength(full) > McpResponseTrim.MAX_RESPONSE_CHARS) {
      result = fitGraphToBudget(slim);
    }
    annotateCompleteness(result, totalUpstream, totalDownstream);
    return result;
  }

  private static void annotateCompleteness(
      Map<String, Object> result, int totalUpstream, int totalDownstream) {
    int returnedUpstream = sizeOf(result.get("upstream"));
    int returnedDownstream = sizeOf(result.get("downstream"));
    boolean clipped = returnedUpstream < totalUpstream || returnedDownstream < totalDownstream;
    result.put("totalEdges", totalUpstream + totalDownstream);
    result.put("returnedEdges", returnedUpstream + returnedDownstream);
    result.put("edgesTruncated", clipped);
    if (clipped) {
      result.put(
          McpResponseTrim.MESSAGE_KEY,
          String.format(
              "Graph clipped to fit the response budget: %d of %d edges returned. Reduce"
                  + " upstreamDepth/downstreamDepth for a complete graph at a shallower depth.",
              returnedUpstream + returnedDownstream, totalUpstream + totalDownstream));
    }
  }

  private static int sizeOf(Object edges) {
    return edges instanceof List<?> list ? list.size() : 0;
  }

  private static Map<String, Object> fitGraphToBudget(SlimLineage slim) {
    long overhead = graphOverheadChars(slim);
    long available = Math.max(0, ResponseBudget.defaultBudgetChars() - overhead);
    long halfShare = available / 2;
    ResponseBudget.Fit up = ResponseBudget.fitWithin(slim.upstream(), halfShare);
    ResponseBudget.Fit down =
        ResponseBudget.fitWithin(slim.downstream(), available - up.usedChars());
    boolean downstreamLeftRoom =
        down.usedChars() < halfShare && up.count() < slim.upstream().size();
    if (downstreamLeftRoom) {
      up = ResponseBudget.fitWithin(slim.upstream(), available - down.usedChars());
    }
    return buildFittedGraph(slim, up.count(), down.count());
  }

  /** Serialized size of the graph shell (root identity + empty edge lists), the fixed overhead. */
  private static long graphOverheadChars(SlimLineage slim) {
    SlimLineage shell =
        new SlimLineage(slim.root(), slim.rootId(), slim.rootType(), List.of(), List.of());
    return McpResponseTrim.serializedLength(JsonUtils.getMap(shell));
  }

  private static Map<String, Object> buildFittedGraph(
      SlimLineage slim, int upCount, int downCount) {
    List<SlimEdge> up = slim.upstream().subList(0, upCount);
    List<SlimEdge> down = slim.downstream().subList(0, downCount);
    Map<String, Object> result =
        JsonUtils.getMap(
            new SlimLineage(
                slim.root(),
                slim.rootId(),
                slim.rootType(),
                new ArrayList<>(up),
                new ArrayList<>(down)));
    result.put("truncated", Boolean.TRUE);
    result.put("upstreamReturned", upCount);
    result.put("upstreamTotal", slim.upstream().size());
    result.put("downstreamReturned", downCount);
    result.put("downstreamTotal", slim.downstream().size());
    result.put(
        "message",
        String.format(
            "Lineage graph is large: returning %d of %d upstream and %d of %d downstream edges to"
                + " stay within the response size budget. Reduce upstreamDepth/downstreamDepth to"
                + " narrow the graph.",
            upCount, slim.upstream().size(), downCount, slim.downstream().size()));
    return result;
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
