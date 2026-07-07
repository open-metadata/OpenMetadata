package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.annotations.VisibleForTesting;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.ResponseBudget;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class SearchMetadataTool implements McpTool {

  private static final int DEFAULT_MAX_AGGREGATION_BUCKETS = 10;
  private static final int MAX_ALLOWED_AGGREGATION_BUCKETS = 50;

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
          "deleted",
          "entityFQN",
          "originEntityFQN",
          "testCaseStatus",
          "testCaseType",
          "dataQualityDimension",
          "testPlatforms",
          "basic",
          "lastResultTimestamp");

  // Latest-result subset kept in test case search results; the full testCaseResult object
  // (testResultValue, sample row counts, ...) is available via the 'fields' parameter.
  private static final List<String> TEST_CASE_RESULT_SLIM_FIELDS =
      List.of("testCaseStatus", "timestamp", "result");

  private static final List<String> DETAILED_EXCLUDE_KEYS =
      Stream.concat(
              Stream.of(
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
                  "domains"),
              McpResponseTrim.VECTOR_NOISE_FIELDS.stream())
          .toList();

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    LOG.info("Executing searchMetadata with params: {}", params);
    String query = stringParam(params, "query", "*");
    String entityType = stringParam(params, "entityType", null);
    String index = resolveIndex(entityType);

    int size = 10;
    if (params.containsKey("size")) {
      Object limitObj = params.get("size");
      if (limitObj instanceof Number number) {
        size = number.intValue();
      } else if (limitObj instanceof String string) {
        try {
          size = Integer.parseInt(string);
        } catch (NumberFormatException e) {
          size = 10;
        }
      }
    }

    int from = 0;
    if (params.containsKey("from")) {
      Object limitObj = params.get("from");
      if (limitObj instanceof Number number) {
        from = number.intValue();
      } else if (limitObj instanceof String string) {
        try {
          from = Integer.parseInt(string);
        } catch (NumberFormatException e) {
          from = 0;
        }
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

    // Parse includeAggregations - defaults to false to keep LLM context size manageable
    boolean includeAggregations = false;
    if (params.containsKey("includeAggregations")) {
      Object aggObj = params.get("includeAggregations");
      if (aggObj instanceof Boolean booleanValue) {
        includeAggregations = booleanValue;
      } else if (aggObj instanceof String) {
        includeAggregations = "true".equals(aggObj);
      }
    }

    // Parse maxAggregationBuckets - limit aggregation size to prevent context overflow
    int maxAggregationBuckets = DEFAULT_MAX_AGGREGATION_BUCKETS;
    if (params.containsKey("maxAggregationBuckets")) {
      Object maxBucketsObj = params.get("maxAggregationBuckets");
      if (maxBucketsObj instanceof Number number) {
        maxAggregationBuckets =
            Math.min(Math.max(number.intValue(), 1), MAX_ALLOWED_AGGREGATION_BUCKETS);
      } else if (maxBucketsObj instanceof String string) {
        try {
          maxAggregationBuckets =
              Math.min(Math.max(Integer.parseInt(string), 1), MAX_ALLOWED_AGGREGATION_BUCKETS);
        } catch (NumberFormatException e) {
          maxAggregationBuckets = DEFAULT_MAX_AGGREGATION_BUCKETS;
        }
      }
    }

    List<String> requestedFields = new ArrayList<>();
    String fieldsParam = stringParam(params, "fields", null);
    if (fieldsParam != null && !fieldsParam.trim().isEmpty()) {
      requestedFields =
          List.of(fieldsParam.split(",")).stream()
              .map(String::trim)
              .filter(field -> !field.isEmpty())
              .collect(Collectors.toList());
    }

    String queryFilter = null;
    Object queryFilterParam = params.get("queryFilter");
    if (queryFilterParam != null) {
      // LLM callers occasionally send the filter as a JSON object instead of a string; serialize
      // non-string input back to JSON rather than failing on a cast.
      String rawFilter =
          queryFilterParam instanceof String stringValue
              ? stringValue
              : JsonUtils.pojoToJson(queryFilterParam);
      JsonNode queryNode = JsonUtils.getObjectMapper().readTree(rawFilter);

      if (!queryNode.has("query")) {
        ObjectNode queryWrapper = JsonUtils.getObjectMapper().createObjectNode();
        queryWrapper.set("query", queryNode);
        queryFilter = JsonUtils.pojoToJson(queryWrapper);
      } else {
        queryFilter = JsonUtils.pojoToJson(queryNode);
      }
      LOG.debug("Applied query filter to query: {}", queryFilter);
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

    return buildEnhancedSearchResponse(
        searchResponse,
        query,
        size,
        from,
        requestedFields,
        includeAggregations,
        maxAggregationBuckets);
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

  @VisibleForTesting
  static Map<String, Object> buildEnhancedSearchResponse(
      Map<String, Object> searchResponse,
      String query,
      int requestedLimit,
      List<String> requestedFields,
      boolean includeAggregations,
      int maxAggregationBuckets) {
    return buildEnhancedSearchResponse(
        searchResponse,
        query,
        requestedLimit,
        0,
        requestedFields,
        includeAggregations,
        maxAggregationBuckets);
  }

  static Map<String, Object> buildEnhancedSearchResponse(
      Map<String, Object> searchResponse,
      String query,
      int requestedLimit,
      int from,
      List<String> requestedFields,
      boolean includeAggregations,
      int maxAggregationBuckets) {
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
        if (hit.containsKey("_score")) {
          cleanedSource.put("similarityScore", hit.get("_score"));
        }
        cleanedResults.add(cleanedSource);
      }
    }

    Map<String, Object> result = new HashMap<>();
    result.put("results", cleanedResults);
    result.put("totalFound", totalResults);
    result.put("returnedCount", cleanedResults.size());
    result.put("query", query);
    result.put(
        "usage",
        "To get full details for any result, call get_entity_details with the result's exact 'entityType' and 'fullyQualifiedName' values.");

    // Handle aggregations based on includeAggregations flag
    if (includeAggregations && searchResponse.containsKey("aggregations")) {
      Map<String, Object> rawAggregations = safeGetMap(searchResponse.get("aggregations"));
      if (rawAggregations != null && !rawAggregations.isEmpty()) {
        Map<String, Object> truncatedAggregations =
            truncateAggregations(rawAggregations, maxAggregationBuckets);
        result.put("aggregations", truncatedAggregations.get("aggregations"));
        if (truncatedAggregations.containsKey("aggregationsTruncated")) {
          result.put("aggregationsTruncated", true);
          result.put(
              "aggregationsMessage",
              String.format(
                  "Aggregation buckets truncated to %d per field to optimize LLM context. "
                      + "Set maxAggregationBuckets parameter for more (max %d).",
                  maxAggregationBuckets, MAX_ALLOWED_AGGREGATION_BUCKETS));
        }
      }
    }

    if (totalResults > requestedLimit) {
      result.put(
          "message",
          String.format(
              "Found %d total results, showing first %d. "
                  + "There are many matching assets. Are you looking for something specific? "
                  + "Try narrowing with a service name, schema name, or more specific search term.",
              totalResults, cleanedResults.size()));
      result.put("hasMore", true);
    }

    fitResultsToBudget(result, cleanedResults, totalResults, from, query);

    return result;
  }

  /**
   * Ensures the response stays under the dispatch-level size cap by returning fewer <em>results</em>
   * (never mangling the ones kept), so search never falls through to the empty-stub nuke. Uses
   * {@link ResponseBudget} to fit results to the budget by measuring each result's real serialized
   * size, which the previous single proportional estimate could undershoot on heavy `fields=`
   * responses, leaving the payload above the cap.
   */
  private static void fitResultsToBudget(
      Map<String, Object> result,
      List<Map<String, Object>> cleanedResults,
      long totalResults,
      int from,
      String query) {
    long overhead = overheadWithoutResults(result);
    int fit = ResponseBudget.fitCount(cleanedResults, overhead);
    if (fit < cleanedResults.size()) {
      List<Map<String, Object>> trimmed = new ArrayList<>(cleanedResults.subList(0, fit));
      LOG.warn(
          "[MCP] search_metadata fit {} of {} results to size budget for query '{}'",
          trimmed.size(),
          cleanedResults.size(),
          query);
      result.put("results", trimmed);
      result.put("returnedCount", trimmed.size());
      result.put("hasMore", true);
      result.put(
          "message",
          String.format(
              "Returning %d of %d results to stay within the response size budget. "
                  + "Fetch more with 'from'=%d, or narrow the query with a service, schema, or name.",
              trimmed.size(), totalResults, from + trimmed.size()));
    }
  }

  private static long overheadWithoutResults(Map<String, Object> result) {
    Object savedResults = result.remove("results");
    long overhead = McpResponseTrim.serializedLength(result);
    result.put("results", savedResults);
    return overhead;
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

    addSlimTestCaseResult(source, result);

    // Truncate long descriptions to optimize LLM context usage
    if (result.get("description") instanceof String description) {
      result.put("description", McpResponseTrim.truncateDescription(description));
    }
    return result;
  }

  private static void addSlimTestCaseResult(
      Map<String, Object> source, Map<String, Object> result) {
    if (result.containsKey("testCaseResult")
        || !(source.get("testCaseResult") instanceof Map<?, ?> testCaseResult)) {
      return;
    }
    Map<String, Object> slim = new HashMap<>();
    for (String field : TEST_CASE_RESULT_SLIM_FIELDS) {
      if (testCaseResult.containsKey(field)) {
        slim.put(field, testCaseResult.get(field));
      }
    }
    if (!slim.isEmpty()) {
      result.put("testCaseResult", slim);
    }
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

  /**
   * Reads a parameter as a string without assuming the caller sent a string. LLM callers sometimes
   * send numbers or other scalars (e.g. {@code "entityType": 123}); {@code toString} keeps the tool
   * tolerant instead of failing on a class cast.
   */
  private static String stringParam(Map<String, Object> params, String key, String defaultValue) {
    Object value = params.get(key);
    return value == null ? defaultValue : value.toString();
  }

  /**
   * Resolves the search index from the requested entity type using the authoritative index registry
   * instead of a hand-maintained switch. A registered entity type resolves to its own single-type
   * index, so results are correctly scoped (fixing #27796, where unlisted types fell back to the
   * broad dataAsset alias and leaked other types). Null, unregistered, wildcard, or comma-separated
   * input is not a registry key and falls back to dataAsset, preserving the prior graceful default
   * rather than erroring or widening the search.
   */
  @VisibleForTesting
  static String resolveIndex(String entityType) {
    String index = "dataAsset";
    if (!nullOrEmpty(entityType)
        && Entity.getSearchRepository().getIndexMapping(entityType) != null) {
      index = entityType;
    }
    return index;
  }

  /**
   * Truncates aggregation buckets to prevent excessive response size that could overwhelm LLM
   * context windows. Based on industry best practices, LLM performance degrades when context
   * utilization exceeds 85%, so keeping responses concise is critical.
   *
   * @param aggregations Raw aggregations from search response
   * @param maxBuckets Maximum number of buckets to keep per aggregation field
   * @return Map containing truncated aggregations and a flag if any were truncated
   */
  @SuppressWarnings("unchecked")
  private static Map<String, Object> truncateAggregations(
      Map<String, Object> aggregations, int maxBuckets) {
    Map<String, Object> result = new HashMap<>();
    Map<String, Object> truncatedAggs = new HashMap<>();
    boolean anyTruncated = false;

    for (Map.Entry<String, Object> entry : aggregations.entrySet()) {
      String aggName = entry.getKey();
      Object aggValue = entry.getValue();

      if (aggValue instanceof Map) {
        Map<String, Object> aggMap = (Map<String, Object>) aggValue;

        // Check if this aggregation has buckets
        if (aggMap.containsKey("buckets")) {
          Object bucketsObj = aggMap.get("buckets");
          if (bucketsObj instanceof List) {
            List<Object> buckets = (List<Object>) bucketsObj;
            if (buckets.size() > maxBuckets) {
              // Truncate buckets
              Map<String, Object> truncatedAgg = new HashMap<>(aggMap);
              truncatedAgg.put("buckets", buckets.subList(0, maxBuckets));
              truncatedAgg.put("_originalBucketCount", buckets.size());
              truncatedAgg.put("_truncated", true);
              truncatedAggs.put(aggName, truncatedAgg);
              anyTruncated = true;
            } else {
              truncatedAggs.put(aggName, aggMap);
            }
          } else {
            truncatedAggs.put(aggName, aggMap);
          }
        } else {
          // Not a bucket aggregation (e.g., value_count, sum, etc.)
          truncatedAggs.put(aggName, aggMap);
        }
      } else {
        truncatedAggs.put(aggName, aggValue);
      }
    }

    result.put("aggregations", truncatedAggs);
    if (anyTruncated) {
      result.put("aggregationsTruncated", true);
    }
    return result;
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
