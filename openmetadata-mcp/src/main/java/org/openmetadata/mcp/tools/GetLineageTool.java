package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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

  private record SqlText(String value, Boolean truncated) {}

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
    boolean includeColumnLineage = McpParams.getBoolean(params, "includeColumnLineage", false);
    LOG.info(
        "Getting lineage for entity type: {}, FQN: {}, upstreamDepth: {}, downstreamDepth: {}, "
            + "includeColumnLineage: {}",
        entityType,
        fqn,
        upstreamDepth,
        downstreamDepth,
        includeColumnLineage);
    EntityLineage lineage =
        Entity.getLineageRepository().getByName(entityType, fqn, upstreamDepth, downstreamDepth);
    return enforceSizeBudget(toSlim(lineage, includeColumnLineage));
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
    Map<UUID, EntityReference> nodeIndex = buildNodeIndex(lineage);
    List<SlimEdge> upstream =
        slimEdges(lineage.getUpstreamEdges(), nodeIndex, includeColumnLineage);
    List<SlimEdge> downstream =
        slimEdges(lineage.getDownstreamEdges(), nodeIndex, includeColumnLineage);
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
      List<Edge> edges, Map<UUID, EntityReference> nodeIndex, boolean includeColumnLineage) {
    // The repository dedups nodes but not edges: a node reachable via multiple paths has its
    // upstream/downstream edges re-added on each recursion. Identical slim edges carry no extra
    // information, so collapse them with a LinkedHashSet (record equality), preserving order.
    Set<SlimEdge> deduped = new LinkedHashSet<>();
    if (!nullOrEmpty(edges)) {
      edges.forEach(edge -> deduped.add(buildSlimEdge(edge, nodeIndex, includeColumnLineage)));
    }
    return new ArrayList<>(deduped);
  }

  private static SlimEdge buildSlimEdge(
      Edge edge, Map<UUID, EntityReference> nodeIndex, boolean includeColumns) {
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
    SqlText sql = fullSqlQuery(details);
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
        details != null ? details.getTempLineageTables() : null,
        details != null ? details.getUpdatedAt() : null,
        details != null ? details.getUpdatedBy() : null,
        columnsLineageOf(details, includeColumns));
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
   * Edge SQL is returned in full. Size is controlled by returning fewer edges (see {@link
   * #enforceSizeBudget}), never by cutting the transformation SQL, which is exactly the metadata a
   * lineage caller needs. The {@code sqlTruncated} marker stays in the record for wire compatibility
   * and is always null now.
   */
  private static SqlText fullSqlQuery(LineageDetails details) {
    String sql = details != null ? details.getSqlQuery() : null;
    return new SqlText(sql, null);
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
  static Map<String, Object> enforceSizeBudget(SlimLineage slim) {
    Map<String, Object> full = JsonUtils.getMap(slim);
    Map<String, Object> result = full;
    if (McpResponseTrim.serializedLength(full) > McpResponseTrim.MAX_RESPONSE_CHARS) {
      result = fitGraphToBudget(slim);
    }
    return result;
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
  private static int clampDepth(int depth) {
    return Math.min(Math.max(depth, 1), MAX_DEPTH);
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
