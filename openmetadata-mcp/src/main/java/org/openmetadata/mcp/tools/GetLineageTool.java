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
    SqlText sql = truncateSqlQuery(details);
    return new SlimEdge(
        refFqn(from),
        refFqn(to),
        refName(from),
        refName(to),
        refType(from),
        refType(to),
        relationshipType(pipeline),
        pipeline != null ? pipeline.getFullyQualifiedName() : null,
        truncateText(pipeline != null ? pipeline.getDescription() : null),
        truncateText(details != null ? details.getDescription() : null),
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

  private static String truncateText(String text) {
    return McpResponseTrim.truncate(text, McpResponseTrim.TEXT_MAX_LENGTH);
  }

  private static String sourceValue(LineageDetails details) {
    return details != null && details.getSource() != null ? details.getSource().value() : null;
  }

  private static SqlText truncateSqlQuery(LineageDetails details) {
    String sql = details != null ? details.getSqlQuery() : null;
    SqlText result = new SqlText(null, null);
    if (sql != null) {
      boolean tooLong = sql.length() > McpResponseTrim.SQL_MAX_LENGTH;
      String value = McpResponseTrim.truncate(sql, McpResponseTrim.SQL_MAX_LENGTH);
      result = new SqlText(value, tooLong ? Boolean.TRUE : null);
    }
    return result;
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
    Map<String, Object> response = JsonUtils.getMap(slim);
    int responseSize = McpResponseTrim.serializedLength(response);
    Map<String, Object> result = response;
    if (responseSize > McpResponseTrim.MAX_RESPONSE_CHARS) {
      result = oversizedHint(slim, responseSize);
    }
    return result;
  }

  private static Map<String, Object> oversizedHint(SlimLineage slim, int size) {
    Map<String, Object> hint = new HashMap<>();
    hint.put("root", slim.root());
    hint.put("upstreamCount", slim.upstream().size());
    hint.put("downstreamCount", slim.downstream().size());
    hint.put("responseSizeChars", size);
    // Machine-detectable marker so a programmatic client can tell a capped graph from a complete
    // one without parsing the message. Stays on the success path — this is a deliberate cap, not an
    // error the caller can fix by retrying.
    hint.put("truncated", Boolean.TRUE);
    hint.put(
        "message",
        String.format(
            "Lineage response exceeded %d characters (was %d). Reduce upstreamDepth/downstreamDepth,"
                + " or keep includeColumnLineage disabled, to get a smaller graph.",
            McpResponseTrim.MAX_RESPONSE_CHARS, size));
    return hint;
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
