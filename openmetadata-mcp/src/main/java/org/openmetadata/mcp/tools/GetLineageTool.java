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
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

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
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(entityType));
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
    EntityLineage lineage =
        Entity.getLineageRepository()
            .getByName(
                entityType,
                fqn,
                upstreamDepth,
                downstreamDepth,
                getSubjectContext(securityContext));
    return enforceSizeBudget(toSlim(lineage, options));
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
    Map<UUID, EntityReference> nodeIndex = buildNodeIndex(lineage);
    List<SlimEdge> upstream = slimEdges(lineage.getUpstreamEdges(), nodeIndex, options);
    List<SlimEdge> downstream = slimEdges(lineage.getDownstreamEdges(), nodeIndex, options);
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
      List<Edge> edges, Map<UUID, EntityReference> nodeIndex, EdgeOptions options) {
    // The repository dedups nodes but not edges: a node reachable via multiple paths has its
    // upstream/downstream edges re-added on each recursion. Identical slim edges carry no extra
    // information, so collapse them with a LinkedHashSet (record equality), preserving order.
    Set<SlimEdge> deduped = new LinkedHashSet<>();
    if (!nullOrEmpty(edges)) {
      edges.forEach(edge -> deduped.add(buildSlimEdge(edge, nodeIndex, options)));
    }
    return new ArrayList<>(deduped);
  }

  private static SlimEdge buildSlimEdge(
      Edge edge, Map<UUID, EntityReference> nodeIndex, EdgeOptions options) {
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
    SqlText sql = sqlText(details, options.includeSql());
    return new SlimEdge(
        refFqn(from),
        refFqn(to),
        refName(from),
        refName(to),
        refType(from),
        refType(to),
        relationshipType(pipeline),
        pipeline != null ? pipeline.getFullyQualifiedName() : null,
        pipeline != null ? pipeline.getDescription() : null,
        details != null ? details.getDescription() : null,
        sourceValue(details),
        details != null ? details.getAssetEdges() : null,
        sql.value(),
        sql.truncated(),
        sql.present(),
        details != null ? details.getTempLineageTables() : null,
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

  private static String relationshipType(EntityReference pipeline) {
    return pipeline != null ? pipeline.getType() + ":" + pipeline.getName() : RELATIONSHIP_SQL;
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
