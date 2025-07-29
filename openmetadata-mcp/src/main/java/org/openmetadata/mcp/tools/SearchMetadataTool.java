package org.openmetadata.mcp.tools;

import static org.openmetadata.service.search.SearchUtil.mapEntityTypesToIndexNames;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class SearchMetadataTool implements McpTool {

  private static final List<String> IGNORE_SEARCH_KEYS =
      List.of(
          "id",
          "version",
          "updatedAt",
          "updatedBy",
          "usageSummary",
          "followers",
          "deleted",
          "votes",
          "lifeCycle",
          "sourceHash",
          "processedLineage",
          "totalVotes",
          "fqnParts",
          "service_suggest",
          "column_suggest",
          "schema_suggest",
          "database_suggest",
          "upstreamLineage",
          "entityRelationship",
          "changeSummary",
          "fqnHash");

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    LOG.info("Executing searchMetadata with params: {}", params);
    String query = params.containsKey("query") ? (String) params.get("query") : "*";
    int limit = 10;
    if (params.containsKey("limit")) {
      Object limitObj = params.get("limit");
      if (limitObj instanceof Number) {
        limit = ((Number) limitObj).intValue();
      } else if (limitObj instanceof String) {
        limit = Integer.parseInt((String) limitObj);
      }
    }

    boolean includeDeleted = false;
    if (params.containsKey("include_deleted")) {
      Object deletedObj = params.get("include_deleted");
      if (deletedObj instanceof Boolean) {
        includeDeleted = (Boolean) deletedObj;
      } else if (deletedObj instanceof String) {
        includeDeleted = "true".equals(deletedObj);
      }
    }

    String entityType =
        params.containsKey("entity_type") ? (String) params.get("entity_type") : null;
    String entityIndex =
        (entityType != null && !entityType.isEmpty())
            ? mapEntityTypesToIndexNames(entityType)
            : Entity.TABLE;

    // Get the actual alias name with cluster alias
    String index = Entity.getSearchRepository().getIndexOrAliasName(entityIndex);

    LOG.info(
        "Search query: {}, entityIndex: {}, actualIndex: {}, limit: {}, includeDeleted: {}",
        query,
        entityIndex,
        index,
        limit,
        includeDeleted);

    SearchRequest searchRequest =
        new SearchRequest()
            .withQuery(query)
            .withIndex(index)
            .withSize(limit)
            .withFrom(0)
            .withFetchSource(true)
            .withDeleted(includeDeleted);

    SubjectContext subjectContext = getSubjectContext(securityContext);
    Response response = Entity.getSearchRepository().search(searchRequest, subjectContext);

    Map<String, Object> searchResponse;
    if (response.getEntity() instanceof String responseStr) {
      LOG.info("Search returned string response");
      JsonNode jsonNode = JsonUtils.readTree(responseStr);
      searchResponse = JsonUtils.convertValue(jsonNode, Map.class);
    } else {
      LOG.info("Search returned object response: {}", response.getEntity().getClass().getName());
      searchResponse = JsonUtils.convertValue(response.getEntity(), Map.class);
    }
    return SearchMetadataTool.cleanSearchResponse(searchResponse);
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "SearchMetadataTool does not support limits enforcement.");
  }

  public static Map<String, Object> cleanSearchResponse(Map<String, Object> searchResponse) {
    if (searchResponse == null) return Collections.emptyMap();

    Map<String, Object> topHits = safeGetMap(searchResponse.get("hits"));
    if (topHits == null) return Collections.emptyMap();

    List<Object> hits = safeGetList(topHits.get("hits"));
    if (hits == null || hits.isEmpty()) return Collections.emptyMap();

    for (Object hitObj : hits) {
      Map<String, Object> hit = safeGetMap(hitObj);
      if (hit == null) continue;

      Map<String, Object> source = safeGetMap(hit.get("_source"));
      if (source == null) continue;

      IGNORE_SEARCH_KEYS.forEach(source::remove);
      return source; // Return the first valid, cleaned _source
    }

    return Collections.emptyMap();
  }

  @SuppressWarnings("unused")
  public static Map<String, Object> cleanSearchResponseObject(Map<String, Object> object) {
    IGNORE_SEARCH_KEYS.forEach(object::remove);
    return object;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> safeGetMap(Object obj) {
    return (obj instanceof Map) ? (Map<String, Object>) obj : null;
  }

  @SuppressWarnings("unchecked")
  private static List<Object> safeGetList(Object obj) {
    return (obj instanceof List) ? (List<Object>) obj : null;
  }
}
