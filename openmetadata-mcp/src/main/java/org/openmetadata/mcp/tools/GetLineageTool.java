package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.google.common.annotations.VisibleForTesting;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.PageCursor;
import org.openmetadata.mcp.util.VectorPagingContract;
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.lineage.CompactLineageRequest;
import org.openmetadata.service.lineage.CompactLineageService;
import org.openmetadata.service.lineage.LineageEdgeFilter;
import org.openmetadata.service.lineage.LineageEdgePager;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * MCP adapter over {@link CompactLineageService}: turns tool params into a request, and the page
 * into the tool's wire shape - an opaque {@code nextCursor} instead of an offset, and plain-language
 * notes an LLM can act on. What the caller may see, and how the graph is slimmed and paged, live in
 * the service so the REST endpoint answers the same way.
 */
public class GetLineageTool implements McpTool {

  // Defaults matching ai-platform GetLineageTool.kt for consistency
  private static final int DEFAULT_DEPTH = 3;
  // Maximum depth to prevent exponential response growth (lineage graphs can explode)
  private static final int MAX_DEPTH = 10;
  private static final String PARAM_INCLUDE_COLUMN_LINEAGE = "includeColumnLineage";
  private static final String PARAM_INCLUDE_SQL = "includeSql";
  private static final String PARAM_COLUMN = "column";
  private static final String PARAM_ENTITY_TYPES = "entityTypes";
  private static final String PARAM_EXCLUDE_ENTITY_TYPES = "excludeEntityTypes";
  private static final String PARAM_SERVICES = "services";
  private static final String OVERSIZED_EDGES_KEY = "oversizedEdges";
  private static final String TRUNCATED_KEY = "truncated";

  /** Offsets and counts the tool says in prose or as a cursor instead. */
  private static final Set<String> SERVICE_ONLY_KEYS =
      Set.of("nextFrom", "firstEdge", "uncheckedNodes", "oversizedEdgeCount");

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    validateParams(params);
    CompactLineage page =
        new CompactLineageService(authorizer, Entity.getLineageRepository())
            .getLineage(toRequest(params), securityContext);
    return toToolResponse(page);
  }

  @VisibleForTesting
  static CompactLineageRequest toRequest(Map<String, Object> params) {
    return new CompactLineageRequest(
        (String) params.get("entityType"),
        (String) params.get("fqn"),
        clampDepth(McpParams.getInt(params, "upstreamDepth", DEFAULT_DEPTH)),
        clampDepth(McpParams.getInt(params, "downstreamDepth", DEFAULT_DEPTH)),
        McpParams.getString(params, PARAM_COLUMN, null),
        McpParams.getBoolean(params, PARAM_INCLUDE_COLUMN_LINEAGE, false),
        McpParams.getBoolean(params, PARAM_INCLUDE_SQL, false),
        VectorPagingContract.cursorOffsetOrDefault(params, 0),
        Integer.MAX_VALUE,
        McpResponseTrim.MAX_RESPONSE_CHARS,
        LineageEdgeFilter.of(
            McpParams.getStringList(params, PARAM_ENTITY_TYPES),
            McpParams.getStringList(params, PARAM_EXCLUDE_ENTITY_TYPES),
            McpParams.getStringList(params, PARAM_SERVICES)));
  }

  @VisibleForTesting
  static Map<String, Object> enforceSizeBudget(CompactLineage slim) {
    return enforceSizeBudget(slim, 0);
  }

  /** Pages an already slimmed graph the way {@link #execute} does, without the repository. */
  @VisibleForTesting
  static Map<String, Object> enforceSizeBudget(CompactLineage slim, int from) {
    return toToolResponse(
        LineageEdgePager.page(slim, from, Integer.MAX_VALUE, McpResponseTrim.MAX_RESPONSE_CHARS));
  }

  /**
   * Always states whether the graph is complete. "30 downstream" and "at least 30 downstream" are
   * different answers to "what breaks if I deprecate this", and an LLM cannot tell a small graph
   * from a clipped or pruned one unless the response says so.
   */
  static Map<String, Object> toToolResponse(CompactLineage page) {
    Map<String, Object> result = JsonUtils.getMap(page);
    SERVICE_ONLY_KEYS.forEach(result::remove);
    if (Boolean.TRUE.equals(page.getHasMore())) {
      annotateNextPage(result, page);
    } else {
      result.remove(McpResponseTrim.HAS_MORE_KEY);
    }
    if (page.getOversizedEdgeCount() != null) {
      annotateOversizedEdges(result, page);
    }
    if (page.getFilteredEdges() != null && page.getFilteredEdges() > 0) {
      appendMessage(
          result,
          String.format(
              "%d edge(s) in this graph lead to assets outside the requested entityTypes,"
                  + " excludeEntityTypes or services and were left out.",
              page.getFilteredEdges()));
    }
    if (page.getColumnUnmappedEdges() != null && page.getColumnUnmappedEdges() > 0) {
      appendMessage(result, unmappedEdgesNote(page.getColumnUnmappedEdges()));
    }
    String visibility = visibilityNote(page);
    if (visibility != null) {
      appendMessage(result, visibility);
    }
    return result;
  }

  private static void annotateNextPage(Map<String, Object> result, CompactLineage page) {
    result.put(TRUNCATED_KEY, Boolean.TRUE);
    result.put(McpResponseTrim.NEXT_CURSOR_KEY, PageCursor.encodeOffset(page.getNextFrom()));
    result.put(
        McpResponseTrim.MESSAGE_KEY,
        String.format(
            "Graph clipped to fit the response budget: edges %d-%d of %d returned. Call again with"
                + " the same arguments and cursor=nextCursor for the next page.",
            page.getFirstEdge() + 1, page.getNextFrom(), page.getTotalEdges()));
  }

  private static void annotateOversizedEdges(Map<String, Object> result, CompactLineage page) {
    List<String> named =
        listOrEmpty(page.getOversizedEdges()).stream()
            .map(edge -> edge.getFromFQN() + " -> " + edge.getToFQN())
            .toList();
    result.put(OVERSIZED_EDGES_KEY, named);
    appendMessage(
        result,
        String.format(
            "%d edge(s) were too large for any response and were skipped; %d of them are named in"
                + " '%s'. Their size is usually SQL (includeSql) or a very long column-mapping"
                + " list (includeColumnLineage); without those they can be returned.",
            page.getOversizedEdgeCount(), named.size(), OVERSIZED_EDGES_KEY));
  }

  /**
   * An edge with no column mappings may or may not carry the column, so it is left out - but saying
   * nothing made an unmapped consumer read as "nothing depends on this column".
   */
  private static String unmappedEdgesNote(int unmappedEdges) {
    return String.format(
        "%d lineage edge(s) out of tables this column reaches have no column-level mappings, so"
            + " whether the column flows through them is unknown; they were left out. Call without"
            + " 'column' to see the ones you can view.",
        unmappedEdges);
  }

  /**
   * Deliberately says "or are only reachable through such a node": removing a denied node also cuts
   * off whatever sat behind it, so the count is not purely a count of denials.
   */
  private static String visibilityNote(CompactLineage page) {
    int hidden = page.getHiddenNodes() == null ? 0 : page.getHiddenNodes();
    String note = null;
    if (Boolean.TRUE.equals(page.getHiddenNodesUnchecked())) {
      note =
          String.format(
              "%d node(s) were removed from this graph, and %d of those lie beyond the"
                  + " authorization limit and were never checked. Reduce"
                  + " upstreamDepth/downstreamDepth for a complete, fully authorized graph at a"
                  + " shallower depth.",
              hidden, page.getUncheckedNodes());
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

  /** Several independent facts can each need saying; none may overwrite another. */
  private static void appendMessage(Map<String, Object> result, String note) {
    Object existing = result.get(McpResponseTrim.MESSAGE_KEY);
    result.put(McpResponseTrim.MESSAGE_KEY, existing == null ? note : existing + " " + note);
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
