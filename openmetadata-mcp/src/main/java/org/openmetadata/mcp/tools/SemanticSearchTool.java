package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.ResponseBudget;
import org.openmetadata.mcp.util.VectorPagingContract;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public class SemanticSearchTool implements McpTool {

  private static final int DEFAULT_SIZE = 10;
  private static final int MAX_SIZE = 50;
  private static final int DEFAULT_K = 100;
  private static final int MAX_K = 10_000;
  private static final double DEFAULT_THRESHOLD = 0.0;

  /** Filter fields the tool schema declares under {@code filters}; never valid at the top level. */
  private static final List<String> FILTER_FIELDS = List.of("entityType", "service", "tags");

  /** Sentinel unit meaning "see customUnitOfMeasurement" rather than a unit in its own right. */
  private static final String UNIT_OF_MEASUREMENT_OTHER = "OTHER";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    LOG.info("Executing semanticSearch with params: {}", params);

    String query = (String) params.get("query");
    String paramError = validateParams(query, params);
    if (paramError != null) {
      return errorResponse(paramError);
    }

    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      return errorResponse(
          "Semantic search is not enabled. Configure vector embeddings in the OpenMetadata server settings.");
    }

    VectorIndexService vectorService = Entity.getSearchRepository().getVectorIndexService();
    if (vectorService == null) {
      return errorResponse("Vector search service is not initialized");
    }

    int size = McpParams.getInt(params, "size", DEFAULT_SIZE);
    size = Math.min(Math.max(size, 1), MAX_SIZE);

    int from = McpParams.getInt(params, "from", 0);
    from = Math.max(from, 0);
    from = VectorPagingContract.cursorOffsetOrDefault(params, from);

    int k = McpParams.getInt(params, "k", DEFAULT_K);
    k = Math.min(Math.max(k, 1), MAX_K);

    double threshold = McpParams.getDouble(params, "threshold", DEFAULT_THRESHOLD);
    threshold = Math.min(Math.max(threshold, 0.0), 1.0);

    Map<String, List<String>> filters = parseFilters(params);

    try {
      VectorSearchResponse response =
          vectorService.search(query, filters, size, from, k, threshold);
      return buildResponse(query, response, size, from);
    } catch (Exception e) {
      LOG.error("Semantic search failed: {}", e.getMessage(), e);
      return errorResponse("Semantic search failed: " + McpResponseTrim.safeMessage(e));
    }
  }

  /**
   * Rejects a filter passed at the top level (e.g. {@code "entityType": "metric"}) instead of under
   * {@code filters}. Such a parameter used to be dropped by {@link #parseFilters}, so the caller got
   * an unfiltered search back with no indication their filter had done nothing — a wrong answer that
   * looks like a right one. Failing loudly with the correct shape is the only honest option.
   *
   * @return the error message, or {@code null} when the parameters are usable
   */
  private static String validateParams(String query, Map<String, Object> params) {
    String error = null;
    if (query == null || query.isBlank()) {
      error = "'query' parameter is required";
    } else {
      String misplaced =
          FILTER_FIELDS.stream().filter(params::containsKey).findFirst().orElse(null);
      if (misplaced != null) {
        error =
            String.format(
                "'%s' is a filter and must be nested under 'filters' as an array, "
                    + "for example: {\"query\": \"...\", \"filters\": {\"%s\": [\"value\"]}}",
                misplaced, misplaced);
      }
    }
    return error;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "SemanticSearchTool does not support limits enforcement.");
  }

  private Map<String, Object> buildResponse(
      String query, VectorSearchResponse response, int requestedSize, int from) {
    Map<String, Object> result = new HashMap<>();
    result.put("query", query);
    result.put("tookMillis", response.getTookMillis());

    if (response.getHits() == null || response.getHits().isEmpty()) {
      result.put("results", Collections.emptyList());
      result.put("totalFound", 0);
      result.put("returnedCount", 0);
      result.put("message", "No results found for semantic search");
      return result;
    }

    List<Map<String, Object>> cleanedResults = collapseByParent(response.getHits());

    result.put("results", cleanedResults);
    result.put("returnedCount", cleanedResults.size());
    result.put("totalFound", cleanedResults.size());
    result.put(
        "usage",
        "To get full details for any result, call get_entity_details with the result's exact 'entityType' and 'fullyQualifiedName' values.");

    int rawCount = cleanedResults.size();
    fitResultsToBudget(result, cleanedResults);
    VectorPagingContract.attach(
        result,
        from,
        rawCount,
        requestedSize,
        response,
        "Showing %d results. Pass 'nextCursor' to fetch the next page, or refine your query. "
            + "Adjust 'threshold' to filter by similarity score.");
    return result;
  }

  /**
   * One result per entity, best-scoring chunk first.
   *
   * <p>The vector service pages by <em>parent entity</em> but returns every matching chunk of each
   * parent, ordered best-first. Since {@link #cleanHit} keeps only entity-level fields, the extra
   * chunks of one entity clean down to near-identical results — duplicate rows that burn response
   * budget and caller context while adding nothing. Worse, {@code nextCursor} advances by the number
   * of rows returned (see {@code VectorPagingContract}) while the service's {@code from} skips
   * parents, so any multi-chunk parent made page two skip entities entirely. Collapsing here makes
   * the returned count equal the parent count, which is what the cursor arithmetic assumes.
   */
  private List<Map<String, Object>> collapseByParent(List<Map<String, Object>> hits) {
    Map<String, Map<String, Object>> byParent = new LinkedHashMap<>();
    for (Map<String, Object> hit : hits) {
      byParent.computeIfAbsent(parentKey(hit), ignored -> cleanHit(hit));
    }
    return new ArrayList<>(byParent.values());
  }

  /**
   * Identity of the entity a hit belongs to. {@code parentId} is present on chunk docs and on
   * backfilled entity docs; the FQN and then the hit's own identity hash are fallbacks so a doc
   * missing both is never silently merged into another entity's result.
   */
  private static String parentKey(Map<String, Object> hit) {
    Object parentId = hit.get("parentId");
    Object fqn = hit.get("fullyQualifiedName");
    String key = parentId != null ? parentId.toString() : null;
    if (key == null) {
      key = fqn != null ? fqn.toString() : "hit:" + System.identityHashCode(hit);
    }
    return key;
  }

  /**
   * Ensures the response stays under the dispatch-level size cap by returning fewer <em>results</em>
   * (never mangling the ones kept), so semantic_search never falls through to the empty-stub nuke.
   * Uses {@link ResponseBudget} to fit results by measuring each result's real serialized size.
   */
  private static void fitResultsToBudget(
      Map<String, Object> result, List<Map<String, Object>> cleanedResults) {
    long overhead = overheadWithoutResults(result);
    int fit = ResponseBudget.fitCount(cleanedResults, overhead);
    if (fit < cleanedResults.size()) {
      List<Map<String, Object>> trimmed = new ArrayList<>(cleanedResults.subList(0, fit));
      result.put("results", trimmed);
      result.put("returnedCount", trimmed.size());
      result.put("hasMore", true);
      result.put(
          "message",
          String.format(
              "Returning %d of %d results to stay within the response size budget. "
                  + "Refine the query or lower 'size' for a smaller response.",
              trimmed.size(), cleanedResults.size()));
    }
  }

  private static long overheadWithoutResults(Map<String, Object> result) {
    Object savedResults = result.remove("results");
    long overhead = McpResponseTrim.serializedLength(result);
    result.put("results", savedResults);
    return overhead;
  }

  private Map<String, Object> cleanHit(Map<String, Object> hit) {
    Map<String, Object> cleaned = new HashMap<>();

    copyIfPresent(hit, cleaned, "parentId");
    copyIfPresent(hit, cleaned, "entityType");
    copyIfPresent(hit, cleaned, "fullyQualifiedName");
    copyIfPresent(hit, cleaned, "name");
    copyIfPresent(hit, cleaned, "displayName");
    copyIfPresent(hit, cleaned, "serviceType");
    copyIfPresent(hit, cleaned, "service");
    copyIfPresent(hit, cleaned, "database");
    copyIfPresent(hit, cleaned, "databaseSchema");
    copyIfPresent(hit, cleaned, "owners");
    copyIfPresent(hit, cleaned, "tier");
    copyIfPresent(hit, cleaned, "tags");
    copyIfPresent(hit, cleaned, "domains");
    copyIfPresent(hit, cleaned, "columns");
    copyIfPresent(hit, cleaned, "certification");
    // Metric facts: a metric summary without its expression, granularity, type and unit cannot be
    // told apart from a similarly named metric, which forced a per-result get_entity_details call.
    copyIfPresent(hit, cleaned, "metricExpression");
    copyIfPresent(hit, cleaned, "metricType");
    copyIfPresent(hit, cleaned, "granularity");
    copyIfPresent(hit, cleaned, "unitOfMeasurement");
    resolveCustomUnit(hit, cleaned);

    if (hit.containsKey("_score")) {
      cleaned.put("similarityScore", hit.get("_score"));
    }

    if (hit.containsKey("description")) {
      Object descObj = hit.get("description");
      cleaned.put(
          "description",
          descObj instanceof String desc ? McpResponseTrim.truncateDescription(desc) : descObj);
    }

    return cleaned;
  }

  /**
   * A hit from an entity index carries the raw {@code OTHER} sentinel plus a separate
   * {@code customUnitOfMeasurement}, while a chunk doc already stores the resolved unit. Resolving
   * it here keeps the two doc types indistinguishable to the caller — "OTHER" on its own says
   * nothing about the metric.
   */
  private static void resolveCustomUnit(Map<String, Object> hit, Map<String, Object> cleaned) {
    Object customUnit = hit.get("customUnitOfMeasurement");
    if (UNIT_OF_MEASUREMENT_OTHER.equals(cleaned.get("unitOfMeasurement")) && customUnit != null) {
      cleaned.put("unitOfMeasurement", customUnit);
    }
  }

  private void copyIfPresent(Map<String, Object> source, Map<String, Object> target, String key) {
    if (source.containsKey(key)) {
      target.put(key, source.get(key));
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, List<String>> parseFilters(Map<String, Object> params) {
    if (!params.containsKey("filters")) {
      return Collections.emptyMap();
    }

    Object filtersObj = params.get("filters");
    if (filtersObj instanceof Map) {
      Map<String, Object> rawFilters = (Map<String, Object>) filtersObj;
      Map<String, List<String>> filters = new HashMap<>();
      for (Map.Entry<String, Object> entry : rawFilters.entrySet()) {
        if (entry.getValue() instanceof List) {
          filters.put(entry.getKey(), (List<String>) entry.getValue());
        } else if (entry.getValue() instanceof String) {
          filters.put(entry.getKey(), List.of((String) entry.getValue()));
        }
      }
      return filters;
    }

    if (filtersObj instanceof String filterStr) {
      try {
        Map<String, Object> parsed = JsonUtils.readValue(filterStr, Map.class);
        Map<String, List<String>> filters = new HashMap<>();
        for (Map.Entry<String, Object> entry : parsed.entrySet()) {
          if (entry.getValue() instanceof List) {
            filters.put(entry.getKey(), (List<String>) entry.getValue());
          } else if (entry.getValue() instanceof String) {
            filters.put(entry.getKey(), List.of((String) entry.getValue()));
          }
        }
        return filters;
      } catch (Exception e) {
        LOG.warn("Failed to parse filters string: {}", filterStr, e);
      }
    }

    return Collections.emptyMap();
  }

  private Map<String, Object> errorResponse(String message) {
    Map<String, Object> result = new HashMap<>();
    result.put("results", Collections.emptyList());
    result.put("totalFound", 0);
    result.put("returnedCount", 0);
    result.put("error", message);
    return result;
  }
}
