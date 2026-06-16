package org.openmetadata.mcp.tools;

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
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Semantic search over Company Context knowledge pills (file-extracted {@link
 * org.openmetadata.schema.entity.context.ContextMemory}). Returns the pill content (title,
 * question, answer, summary, sourceFile) in a single call.
 */
@Slf4j
public class SearchCompanyContextTool implements McpTool {
  private static final int DEFAULT_SIZE = 10;
  private static final int MAX_SIZE = 50;
  private static final int DEFAULT_K = 100;
  private static final double DEFAULT_THRESHOLD = 0.0;

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.CONTEXT_MEMORY, VIEW_ALL),
        new ResourceContext<>(Entity.CONTEXT_MEMORY));
    Map<String, Object> result;
    String query = (String) params.get("query");
    if (query == null || query.isBlank()) {
      result = errorResponse("'query' parameter is required");
    } else if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      result =
          errorResponse(
              "Semantic search is not enabled. Configure vector embeddings in the OpenMetadata server settings.");
    } else {
      result = runSearch(query, params);
    }
    return result;
  }

  private Map<String, Object> runSearch(String query, Map<String, Object> params) {
    Map<String, Object> result;
    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (vectorService == null) {
      result = errorResponse("Vector search service is not initialized");
    } else {
      int size = Math.min(Math.max(McpParams.getInt(params, "size", DEFAULT_SIZE), 1), MAX_SIZE);
      try {
        VectorSearchResponse response =
            vectorService.search(
                query, companyContextFilters(), size, 0, DEFAULT_K, DEFAULT_THRESHOLD);
        result = buildResponse(query, response);
      } catch (Exception e) {
        LOG.error("Company context search failed: {}", e.getMessage(), e);
        result = errorResponse("Company context search failed: " + McpResponseTrim.safeMessage(e));
      }
    }
    return result;
  }

  private Map<String, List<String>> companyContextFilters() {
    Map<String, List<String>> filters = new HashMap<>();
    filters.put("entityType", List.of(Entity.CONTEXT_MEMORY));
    filters.put("sourceType", List.of(ContextMemorySourceType.FILE_EXTRACTION.value()));
    filters.put("visibility", List.of(MemoryVisibility.SHARED.value()));
    return filters;
  }

  private Map<String, Object> buildResponse(String query, VectorSearchResponse response) {
    List<Map<String, Object>> pills = new ArrayList<>();
    if (response.getHits() != null) {
      for (Map<String, Object> hit : response.getHits()) {
        pills.add(projectPill(hit));
      }
    }
    Map<String, Object> result = new HashMap<>();
    result.put("query", query);
    result.put("results", pills);
    result.put("returnedCount", pills.size());
    return result;
  }

  private Map<String, Object> projectPill(Map<String, Object> hit) {
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

  private void copy(Map<String, Object> from, Map<String, Object> to, String key) {
    if (from.containsKey(key)) {
      to.put(key, from.get(key));
    }
  }

  private Map<String, Object> errorResponse(String message) {
    Map<String, Object> result = new HashMap<>();
    result.put("results", Collections.emptyList());
    result.put("returnedCount", 0);
    result.put("error", message);
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "SearchCompanyContextTool does not support limits enforcement.");
  }
}
