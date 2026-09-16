package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.ResponseBudget;
import org.openmetadata.mcp.util.VectorPagingContract;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Reads Company Context knowledge pills, by question or by name.
 *
 * <p>Replaces {@code search_company_context} and {@code get_company_context}, which were one
 * resource behind two tools: the same {@link ContextMemory} entity, the same "file-extracted and
 * Shared" scope, and the same projection - the two implementations each carried their own copy, and
 * the by-name one carried a comment saying it mirrored the other. They differed only in the lookup
 * key, so they are one tool with two ways in.
 */
@Slf4j
public class CompanyContextTool implements McpTool {
  private static final int DEFAULT_SIZE = 10;
  private static final int MAX_SIZE = 50;
  private static final int DEFAULT_K = 100;
  private static final double DEFAULT_THRESHOLD = 0.0;

  private static final String QUERY_PARAM = "query";
  private static final String FQN_PARAM = "fqn";
  private static final String RESULTS_KEY = "results";
  private static final String RETURNED_COUNT_KEY = "returnedCount";

  private static final String NOT_A_SHARED_PILL_ERROR =
      "Requested entity is not a shared Company Context knowledge pill";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String query = CommonUtils.optString(params, QUERY_PARAM);
    String fqn = CommonUtils.optString(params, FQN_PARAM);
    // Scoped to the pill when the caller named one, so entity-level tag/owner/domain policies are
    // evaluated and not just the resource-type permission.
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.CONTEXT_MEMORY, VIEW_ALL),
        nullOrEmpty(fqn)
            ? new ResourceContext<>(Entity.CONTEXT_MEMORY)
            : new ResourceContext<>(
                Entity.CONTEXT_MEMORY, null, FullyQualifiedName.quoteName(fqn)));
    return route(query, fqn, params, securityContext);
  }

  /** One of the two keys, never both - guessing which the caller meant would be a coin toss. */
  private static Map<String, Object> route(
      String query,
      String fqn,
      Map<String, Object> params,
      CatalogSecurityContext securityContext) {
    boolean hasQuery = query != null && !query.isBlank();
    boolean hasFqn = fqn != null && !fqn.isBlank();
    Map<String, Object> result;
    if (hasQuery == hasFqn) {
      result =
          errorResponse(
              "Pass either 'query' to search knowledge pills or 'fqn' to read one by name, not"
                  + " both and not neither.");
    } else if (hasFqn) {
      result = lookupPill(fqn, securityContext);
    } else {
      result = runSearch(query, params, securityContext);
    }
    return result;
  }

  // --- by name ----------------------------------------------------------------------------------

  private static Map<String, Object> lookupPill(
      String fqn, CatalogSecurityContext securityContext) {
    Map<String, Object> result;
    try {
      ContextMemory memory = fetchPill(fqn);
      result =
          isExposablePill(memory, securityContext)
              ? projectPill(memory)
              : errorResponse(NOT_A_SHARED_PILL_ERROR);
    } catch (EntityNotFoundException e) {
      result = errorResponse("No Company Context knowledge pill found for '" + fqn + "'");
    }
    return result;
  }

  /**
   * A {@link ContextMemory} FQN is a single name part, so a file-extracted pill name (e.g. {@code
   * report.md_<hash>}) carries dots and is stored quoted ({@code "report.md_<hash>"}). MCP clients
   * routinely hand the value back unquoted; {@link FullyQualifiedName#quoteName(String)} restores
   * the canonical quoting (and is a no-op when the value is already correctly quoted), so the
   * by-name lookup resolves whichever form the client supplies.
   */
  private static ContextMemory fetchPill(String fqn) {
    String normalizedFqn = FullyQualifiedName.quoteName(fqn);
    LOG.debug("Getting company context pill: {} (normalized fqn: {})", fqn, normalizedFqn);
    return Entity.getEntityByName(
        Entity.CONTEXT_MEMORY, normalizedFqn, "sourceFile,owners,tags,domains", null);
  }

  /**
   * The by-name scope: a file-extracted pill, and one this caller may see - the same shareConfig
   * question {@code ContextMemorySearchVisibility} asks of every hit on the search half. The two
   * halves are not identical sets: {@link #searchFilters()} additionally pins {@code visibility} to
   * {@code Shared}, so a pill this caller may see for another reason (an org-wide one, or their own)
   * is readable by name but will not appear in a query. A pill outside the scope is reported as
   * not-a-shared-pill rather than denied, which keeps the answer the same whether or not it exists.
   */
  private static boolean isExposablePill(
      ContextMemory memory, CatalogSecurityContext securityContext) {
    return memory.getSourceType() == ContextMemorySourceType.FILE_EXTRACTION
        && !ContextMemoryVisibility.filterByVisibility(List.of(memory), securityContext).isEmpty();
  }

  static Map<String, Object> projectPill(ContextMemory memory) {
    Map<String, Object> pill = new HashMap<>();
    pill.put("fullyQualifiedName", memory.getFullyQualifiedName());
    pill.put("name", memory.getName());
    putIfPresent(pill, "title", memory.getTitle());
    putIfPresent(pill, "question", memory.getQuestion());
    putIfPresent(pill, "answer", memory.getAnswer());
    putIfPresent(pill, "summary", memory.getSummary());
    putIfPresent(pill, "memoryType", memory.getMemoryType());
    if (memory.getSourceFile() != null) {
      pill.put("sourceFile", memory.getSourceFile().getFullyQualifiedName());
    }
    return pill;
  }

  private static void putIfPresent(Map<String, Object> pill, String key, Object value) {
    if (value != null) {
      pill.put(key, value);
    }
  }

  // --- by question ------------------------------------------------------------------------------

  private static Map<String, Object> runSearch(
      String query, Map<String, Object> params, CatalogSecurityContext securityContext) {
    Map<String, Object> result;
    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled() || vectorService == null) {
      result =
          errorResponse(
              "Semantic search is not enabled. Configure vector embeddings in the OpenMetadata"
                  + " server settings. Reading a pill by 'fqn' does not need it.");
    } else {
      result = search(vectorService, query, params, securityContext);
    }
    return result;
  }

  private static Map<String, Object> search(
      OpenSearchVectorService vectorService,
      String query,
      Map<String, Object> params,
      CatalogSecurityContext securityContext) {
    int size = Math.min(Math.max(McpParams.getInt(params, "size", DEFAULT_SIZE), 1), MAX_SIZE);
    int from =
        VectorPagingContract.cursorOffsetOrDefault(
            params, Math.max(McpParams.getInt(params, "from", 0), 0));
    Map<String, Object> result;
    try {
      // Without a subject the vector query fails closed to org-wide memories only, which excludes
      // every Shared knowledge pill - that is, all of them - for admins and non-admins alike.
      VectorSearchResponse response =
          vectorService.search(
              query,
              searchFilters(),
              size,
              from,
              DEFAULT_K,
              DEFAULT_THRESHOLD,
              null,
              DefaultAuthorizer.getSubjectContext(securityContext));
      result = buildResponse(query, response, size, from);
    } catch (Exception e) {
      LOG.error("Company context search failed: {}", e.getMessage(), e);
      result = errorResponse("Company context search failed: " + McpResponseTrim.safeMessage(e));
    }
    return result;
  }

  /** The searchable scope. {@link #isExposablePill} is the same rule applied to one entity. */
  private static Map<String, List<String>> searchFilters() {
    Map<String, List<String>> filters = new HashMap<>();
    filters.put("entityType", List.of(Entity.CONTEXT_MEMORY));
    filters.put("sourceType", List.of(ContextMemorySourceType.FILE_EXTRACTION.value()));
    filters.put("visibility", List.of(MemoryVisibility.SHARED.value()));
    return filters;
  }

  private static Map<String, Object> buildResponse(
      String query, VectorSearchResponse response, int requestedSize, int from) {
    List<Map<String, Object>> pills = new ArrayList<>();
    if (response.getHits() != null) {
      response.getHits().forEach(hit -> pills.add(projectHit(hit)));
    }
    Map<String, Object> result = new HashMap<>();
    result.put(QUERY_PARAM, query);
    result.put(RESULTS_KEY, pills);
    result.put(RETURNED_COUNT_KEY, pills.size());
    int rawCount = pills.size();
    fitResultsToBudget(result, pills);
    VectorPagingContract.attach(
        result,
        from,
        rawCount,
        requestedSize,
        response,
        "Showing %d knowledge pills. Pass 'nextCursor' to fetch the next page.");
    return result;
  }

  /**
   * Keeps the response under the dispatch-level size cap by returning fewer <em>pills</em> (never
   * mangling the content of the ones kept), so the tool never falls through to the empty-stub nuke.
   */
  private static void fitResultsToBudget(
      Map<String, Object> result, List<Map<String, Object>> pills) {
    long overhead = overheadWithoutResults(result);
    int fit = ResponseBudget.fitCount(pills, overhead);
    if (fit < pills.size()) {
      List<Map<String, Object>> trimmed = new ArrayList<>(pills.subList(0, fit));
      result.put(RESULTS_KEY, trimmed);
      result.put(RETURNED_COUNT_KEY, trimmed.size());
      result.put(McpResponseTrim.HAS_MORE_KEY, true);
      result.put(
          McpResponseTrim.MESSAGE_KEY,
          String.format(
              "Returning %d of %d knowledge pills to stay within the response size budget. "
                  + "Refine the query or lower 'size' for a smaller response.",
              trimmed.size(), pills.size()));
    }
  }

  private static long overheadWithoutResults(Map<String, Object> result) {
    Object savedResults = result.remove(RESULTS_KEY);
    long overhead = McpResponseTrim.serializedLength(result);
    result.put(RESULTS_KEY, savedResults);
    return overhead;
  }

  /** A search hit carries the same fields as a stored pill, plus how well it matched. */
  private static Map<String, Object> projectHit(Map<String, Object> hit) {
    Map<String, Object> pill = new HashMap<>();
    copy(hit, pill, "fullyQualifiedName");
    copy(hit, pill, "name");
    copy(hit, pill, "title");
    copy(hit, pill, "question");
    copy(hit, pill, "answer");
    copy(hit, pill, "summary");
    copy(hit, pill, "sourceFile");
    if (hit.containsKey("_score")) {
      pill.put("similarityScore", hit.get("_score"));
    }
    return pill;
  }

  /** Same rule as the by-name projection: a field the pill does not have is left out, not nulled. */
  private static void copy(Map<String, Object> from, Map<String, Object> to, String key) {
    putIfPresent(to, key, from.get(key));
  }

  private static Map<String, Object> errorResponse(String message) {
    Map<String, Object> result = new HashMap<>();
    result.put(RESULTS_KEY, Collections.emptyList());
    result.put(RETURNED_COUNT_KEY, 0);
    result.put(McpResponseTrim.ERROR_KEY, message);
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "CompanyContextTool does not support limits enforcement.");
  }
}
