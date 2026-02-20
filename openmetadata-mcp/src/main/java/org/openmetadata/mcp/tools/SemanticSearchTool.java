package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
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
  private static final int DESCRIPTION_MAX_LENGTH = 500;
  private static final int DESCRIPTION_TRUNCATE_LENGTH = 450;

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    LOG.info("Executing semanticSearch with params: {}", params);

    String query = (String) params.get("query");
    if (query == null || query.isBlank()) {
      return errorResponse("'query' parameter is required");
    }

    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      return errorResponse(
          "Semantic search is not enabled. Configure vector embeddings in the OpenMetadata server settings.");
    }

    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (vectorService == null) {
      return errorResponse("Vector search service is not initialized");
    }

    int size = parseIntParam(params, "size", DEFAULT_SIZE);
    size = Math.min(Math.max(size, 1), MAX_SIZE);

    int k = parseIntParam(params, "k", DEFAULT_K);
    k = Math.min(Math.max(k, 1), MAX_K);

    double threshold = parseDoubleParam(params, "threshold", DEFAULT_THRESHOLD);
    threshold = Math.min(Math.max(threshold, 0.0), 1.0);

    Map<String, List<String>> filters = parseFilters(params);

    try {
      VectorSearchResponse response = vectorService.search(query, filters, size, k, threshold);
      return buildResponse(query, response, size);
    } catch (Exception e) {
      LOG.error("Semantic search failed: {}", e.getMessage(), e);
      return errorResponse("Semantic search failed: " + e.getMessage());
    }
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
      String query, VectorSearchResponse response, int requestedSize) {
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

    List<Map<String, Object>> cleanedResults = new ArrayList<>();
    for (Map<String, Object> hit : response.getHits()) {
      cleanedResults.add(cleanHit(hit));
    }

    result.put("results", cleanedResults);
    result.put("returnedCount", cleanedResults.size());
    result.put("totalFound", cleanedResults.size());

    if (cleanedResults.size() >= requestedSize) {
      result.put(
          "message",
          String.format(
              "Showing %d results. Increase 'size' or refine your query for different results. "
                  + "Adjust 'threshold' to filter by similarity score.",
              cleanedResults.size()));
    }

    return result;
  }

  private Map<String, Object> cleanHit(Map<String, Object> hit) {
    Map<String, Object> cleaned = new HashMap<>();

    copyIfPresent(hit, cleaned, "parent_id");
    copyIfPresent(hit, cleaned, "entityType");
    copyIfPresent(hit, cleaned, "fullyQualifiedName");
    copyIfPresent(hit, cleaned, "name");
    copyIfPresent(hit, cleaned, "displayName");
    copyIfPresent(hit, cleaned, "serviceType");
    copyIfPresent(hit, cleaned, "owners");
    copyIfPresent(hit, cleaned, "tier");
    copyIfPresent(hit, cleaned, "tags");
    copyIfPresent(hit, cleaned, "domains");
    copyIfPresent(hit, cleaned, "columns");
    copyIfPresent(hit, cleaned, "certification");

    if (hit.containsKey("_score")) {
      cleaned.put("similarityScore", hit.get("_score"));
    }

    if (hit.containsKey("text_to_embed")) {
      Object textObj = hit.get("text_to_embed");
      if (textObj instanceof String text && text.length() > DESCRIPTION_MAX_LENGTH) {
        cleaned.put("description", text.substring(0, DESCRIPTION_TRUNCATE_LENGTH) + "...");
      } else {
        cleaned.put("description", textObj);
      }
    }

    return cleaned;
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

  private int parseIntParam(Map<String, Object> params, String key, int defaultValue) {
    if (!params.containsKey(key)) {
      return defaultValue;
    }
    Object val = params.get(key);
    if (val instanceof Number number) {
      return number.intValue();
    }
    if (val instanceof String string) {
      try {
        return Integer.parseInt(string);
      } catch (NumberFormatException e) {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  private double parseDoubleParam(Map<String, Object> params, String key, double defaultValue) {
    if (!params.containsKey(key)) {
      return defaultValue;
    }
    Object val = params.get(key);
    if (val instanceof Number number) {
      return number.doubleValue();
    }
    if (val instanceof String string) {
      try {
        return Double.parseDouble(string);
      } catch (NumberFormatException e) {
        return defaultValue;
      }
    }
    return defaultValue;
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
