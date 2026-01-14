package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.SearchUtil.mapEntityTypesToIndexNames;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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

  private static final List<String> ESSENTIAL_FIELDS_ONLY =
      List.of(
          "name",
          "displayName",
          "fullyQualifiedName",
          "description",
          "entityType",
          "service",
          "database",
          "databaseSchema",
          "serviceType",
          "href",
          "tags",
          "owners",
          "tier",
          "tableType",
          "columnNames",
          "deleted");

  private static final List<String> DETAILED_EXCLUDE_KEYS =
      List.of(
          "id",
          "version",
          "updatedAt",
          "updatedBy",
          "usageSummary",
          "followers",
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
          "fqnHash",
          "columns",
          "schemaDefinition",
          "queries",
          "sourceUrl",
          "locationPath",
          "customMetrics",
          "tierSources",
          "tagSources",
          "descriptionSources",
          "columnDescriptionStatus",
          "columnNamesFuzzy",
          "descriptionStatus",
          "domains",
          "embeddings");

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    LOG.info("Executing searchMetadata with params: {}", params);
    String query = params.containsKey("query") ? (String) params.get("query") : "*";
    String entityType = params.containsKey("entityType") ? (String) params.get("entityType") : null;
    String index = entityType == null ? "dataAsset" : mapEntityTypesToIndexNames(entityType);

    int size = 10;
    if (params.containsKey("size")) {
      Object limitObj = params.get("size");
      if (limitObj instanceof Number number) {
        size = number.intValue();
      } else if (limitObj instanceof String string) {
        size = Integer.parseInt(string);
      }
    }

    int from = 0;
    if (params.containsKey("from")) {
      Object limitObj = params.get("from");
      if (limitObj instanceof Number number) {
        from = number.intValue();
      } else if (limitObj instanceof String string) {
        from = Integer.parseInt(string);
      }
    }

    size = Math.min(size, 50);

    boolean includeDeleted = false;
    if (params.containsKey("includeDeleted")) {
      Object deletedObj = params.get("includeDeleted");
      if (deletedObj instanceof Boolean booleanValue) {
        includeDeleted = booleanValue;
      } else if (deletedObj instanceof String) {
        includeDeleted = "true".equals(deletedObj);
      }
    }

    List<String> requestedFields = new ArrayList<>();
    if (params.containsKey("fields")) {
      String fieldsParam = (String) params.get("fields");
      if (fieldsParam != null && !fieldsParam.trim().isEmpty()) {
        requestedFields =
            List.of(fieldsParam.split(",")).stream()
                .map(String::trim)
                .filter(field -> !field.isEmpty())
                .collect(Collectors.toList());
      }
    }

    String queryFilter = null;
    if (params.containsKey("queryFilter")) {
      queryFilter = (String) params.get("queryFilter");
      JsonNode queryNode = JsonUtils.getObjectMapper().readTree(queryFilter);

      if (!queryNode.has("query")) {
        ObjectNode queryWrapper = JsonUtils.getObjectMapper().createObjectNode();
        queryWrapper.set("query", queryNode);
        queryFilter = JsonUtils.pojoToJson(queryWrapper);
      } else {
        queryFilter = JsonUtils.pojoToJson(queryNode);
      }
      LOG.debug("Applied query filter to query: {}", queryFilter);
    } else {

    }

    LOG.info(
        "Search query: {}, index: {}, limit: {}, includeDeleted: {}",
        queryFilter,
        index,
        size,
        includeDeleted);

    SearchRequest searchRequest;
    if (!nullOrEmpty(queryFilter)) {
      // When queryFilter is provided, use it directly as it's already a transformed OpenSearch
      // query
      searchRequest =
          new SearchRequest()
              .withIndex(Entity.getSearchRepository().getIndexOrAliasName(index))
              .withQueryFilter(queryFilter)
              .withSize(size)
              .withFrom(from)
              .withFetchSource(true)
              .withDeleted(includeDeleted);
    } else {
      // Fallback to basic query when no queryFilter is provided
      searchRequest =
          new SearchRequest()
              .withQuery(query)
              .withIndex(Entity.getSearchRepository().getIndexOrAliasName(index))
              .withSize(size)
              .withFrom(from)
              .withFetchSource(true)
              .withDeleted(includeDeleted);
    }

    SubjectContext subjectContext = getSubjectContext(securityContext);
    Response response;
    if (!nullOrEmpty(queryFilter)) {
      // Use direct query method when queryFilter is provided since it's already a transformed query
      response = Entity.getSearchRepository().searchWithDirectQuery(searchRequest, subjectContext);
    } else {
      // Use regular search for basic queries
      response = Entity.getSearchRepository().search(searchRequest, subjectContext);
    }

    Map<String, Object> searchResponse;
    if (response.getEntity() instanceof String responseStr) {
      LOG.debug("Search returned string response");
      JsonNode jsonNode = JsonUtils.readTree(responseStr);
      searchResponse = JsonUtils.convertValue(jsonNode, Map.class);
    } else {
      LOG.debug("Search returned object response: {}", response.getEntity().getClass().getName());
      searchResponse = JsonUtils.convertValue(response.getEntity(), Map.class);
    }

    return buildEnhancedSearchResponse(searchResponse, query, size, requestedFields);
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

  public static Map<String, Object> buildEnhancedSearchResponse(
      Map<String, Object> searchResponse,
      String query,
      int requestedLimit,
      List<String> requestedFields) {
    if (searchResponse == null) {
      return createEmptyResponse();
    }

    Map<String, Object> topHits = safeGetMap(searchResponse.get("hits"));
    if (topHits == null) {
      return createEmptyResponse();
    }

    List<Object> hits = safeGetList(topHits.get("hits"));
    List<Map<String, Object>> cleanedResults = new ArrayList<>();
    int totalResults = 0;
    if (hits != null && !hits.isEmpty()) {

      if (topHits.get("total") instanceof Map) {
        Map<String, Object> totalObj = safeGetMap(topHits.get("total"));
        if (totalObj != null && totalObj.get("value") instanceof Number) {
          totalResults = ((Number) totalObj.get("value")).intValue();
        }
      } else if (topHits.get("total") instanceof Number) {
        totalResults = ((Number) topHits.get("total")).intValue();
      }

      for (Object hitObj : hits) {
        Map<String, Object> hit = safeGetMap(hitObj);
        if (hit == null) continue;

        Map<String, Object> source = safeGetMap(hit.get("_source"));
        if (source == null) continue;

        Map<String, Object> cleanedSource = cleanSearchResult(source, requestedFields);
        cleanedResults.add(cleanedSource);
      }
    }

    Map<String, Object> result = new HashMap<>();
    result.put("results", cleanedResults);
    result.put("totalFound", totalResults);
    result.put("returnedCount", cleanedResults.size());
    result.put("query", query);

    // Add aggregations if present in search response
    if (searchResponse.containsKey("aggregations")) {
      result.put("aggregations", searchResponse.get("aggregations"));
    }

    if (totalResults > requestedLimit) {
      result.put(
          "message",
          String.format(
              "Found %d total results, showing first %d. Use pagination or refine your search for more specific results, you can call these 3 times by yourself with pagination , and then only if the user ask for more paginate.",
              totalResults, cleanedResults.size()));
      result.put("hasMore", true);
    }

    return result;
  }

  public static Map<String, Object> cleanSearchResult(
      Map<String, Object> source, List<String> requestedFields) {
    Map<String, Object> result = new HashMap<>();

    // Always include essential fields
    for (String field : ESSENTIAL_FIELDS_ONLY) {
      if (source.containsKey(field)) {
        result.put(field, source.get(field));
      }
    }

    // Add any specifically requested additional fields
    for (String field : requestedFields) {
      if (source.containsKey(field)) {
        result.put(field, source.get(field));
      }
    }

    // Cleanup Description in case of huge description
    if (result.containsKey("description")) {
      String description = (String) result.get("description");
      if (description.length() > 3000) {
        result.put("description", description.substring(0, 300) + "...");
      }
    }
    return result;
  }

  public static Map<String, Object> createEmptyResponse() {
    Map<String, Object> result = new HashMap<>();
    result.put("results", Collections.emptyList());
    result.put("totalFound", 0);
    result.put("returnedCount", 0);
    result.put("message", "No results found");
    return result;
  }

  @SuppressWarnings("unused")
  public static Map<String, Object> cleanSearchResponseObject(Map<String, Object> object) {
    DETAILED_EXCLUDE_KEYS.forEach(object::remove);
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
