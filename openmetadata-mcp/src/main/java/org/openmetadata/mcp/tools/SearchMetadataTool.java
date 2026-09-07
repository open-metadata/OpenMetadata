package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.annotations.VisibleForTesting;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.PageCursor;
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

  private static final Set<String> REFERENCE_FIELDS =
      Set.of("service", "database", "databaseSchema");
  private static final Set<String> REFERENCE_LIST_FIELDS = Set.of("owners", "domains");
  private static final Set<String> TAG_FIELDS = Set.of("tier", "tags");
  private static final String CERTIFICATION_FIELD = "certification";
  private static final Set<String> BULK_FIELDS =
      Set.of("columns", "columnNames", "charts", "tasks");
  private static final int MAX_BULK_ITEMS = 60;
  private static final String DESCRIPTION_TRUNCATED_KEY = "descriptionTruncated";
  private static final String TEST_CASE_ENTITY = "testCase";
  private static final String NEVER_RUN_KEY = "neverRun";

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

  /** Lucene match-anything query, mirroring the {@code @DefaultValue("*")} on the REST search API. */
  private static final String MATCH_ANY_QUERY = "*";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    LOG.debug("Executing searchMetadata with params: {}", params);
    String query = stringParam(params, "query", MATCH_ANY_QUERY);
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
    Optional<PageCursor.Cursor> cursor = PageCursor.decode(stringParam(params, "cursor", null));
    if (cursor.isPresent() && cursor.get().isOffset()) {
      from = cursor.get().offset();
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

    Set<String> excludedTypes =
        new java.util.HashSet<>(McpParams.getStringList(params, "excludeEntityTypes"));
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
        queryWrapper.set("query", excludeTypesFrom(queryNode, excludedTypes));
        queryFilter = JsonUtils.pojoToJson(queryWrapper);
      } else {
        ObjectNode wrapped = (ObjectNode) queryNode;
        wrapped.set("query", excludeTypesFrom(wrapped.get("query"), excludedTypes));
        queryFilter = JsonUtils.pojoToJson(wrapped);
      }
      LOG.debug("Applied query filter to query: {}", queryFilter);
    }

    // With no caller-supplied queryFilter there is nothing to fold the exclusion into, so build a
    // filter carrying only the exclusion. The standard search path ANDs it with the text query
    // (OpenSearchSearchManager.applyQueryFilter), so the engine applies it and the page backfills.
    String exclusionFilter = queryFilter == null ? excludeOnlyFilter(excludedTypes) : null;

    LOG.debug(
        "Search query: {}, index: {}, limit: {}, includeDeleted: {}",
        queryFilter,
        index,
        size,
        includeDeleted);

    // One request shape for both cases. A caller-supplied queryFilter used to be sent through
    // searchWithDirectQuery, which reads neither the text query nor the deleted flag, so both were
    // silently dropped whenever a filter was present. The standard search path ANDs the filter
    // under
    // the text query (OpenSearchSearchManager#applyQueryFilter) and additionally applies the
    // deleted
    // filter, ranked scoring, and the search preference.
    SearchRequest searchRequest =
        new SearchRequest()
            .withQuery(nullOrEmpty(query) ? MATCH_ANY_QUERY : query)
            .withIndex(Entity.getSearchRepository().getIndexOrAliasName(index))
            .withQueryFilter(nullOrEmpty(queryFilter) ? exclusionFilter : queryFilter)
            .withSize(size)
            .withFrom(from)
            .withFetchSource(true)
            .withDeleted(includeDeleted);

    SubjectContext subjectContext = getSubjectContext(securityContext);
    Response response = Entity.getSearchRepository().search(searchRequest, subjectContext);

    Map<String, Object> searchResponse;
    if (response.getEntity() instanceof String responseStr) {
      LOG.debug("Search returned string response");
      JsonNode jsonNode = JsonUtils.readTree(responseStr);
      searchResponse = JsonUtils.convertValue(jsonNode, Map.class);
    } else {
      LOG.debug("Search returned object response: {}", response.getEntity().getClass().getName());
      searchResponse = JsonUtils.convertValue(response.getEntity(), Map.class);
    }

    Map<String, Object> enhanced =
        buildEnhancedSearchResponse(
            searchResponse,
            query,
            size,
            from,
            requestedFields,
            includeAggregations,
            maxAggregationBuckets);
    return dropExcludedTypes(enhanced, excludedTypes);
  }

  /**
   * Backstop removal of excluded hits. The real exclusion happens in {@link #excludeTypesFrom}.
   *
   * <p>Post-filtering alone is not enough: it strips hits from a page already fetched, so a page
   * that happened to be all columns came back empty - which reads as "no such assets exist" when
   * hundreds do.
   */
  private static Map<String, Object> dropExcludedTypes(
      Map<String, Object> response, Set<String> excluded) {
    if (!excluded.isEmpty() && response.get("results") instanceof List<?> results) {
      List<Object> kept =
          results.stream()
              .filter(hit -> !isExcluded(hit, excluded))
              .collect(Collectors.toCollection(ArrayList::new));
      int removed = results.size() - kept.size();
      response.put("results", kept);
      response.put("returnedCount", kept.size());
      if (removed > 0) {
        response.put("excludedByType", removed);
      }
    }
    return response;
  }

  private static boolean isExcluded(Object hit, Set<String> excluded) {
    Map<String, Object> map = safeGetMap(hit);
    Object type = map == null ? null : map.get("entityType");
    return type != null && excluded.contains(type.toString());
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

      boolean scoresVary = scoresDiscriminate(hits);
      for (Object hitObj : hits) {
        Map<String, Object> hit = safeGetMap(hitObj);
        if (hit == null) continue;

        Map<String, Object> source = safeGetMap(hit.get("_source"));
        if (source == null) continue;

        Map<String, Object> cleanedSource = cleanSearchResult(source, requestedFields);
        // A pure queryFilter lookup runs no scoring query, so every hit carries the same constant
        // _score. Publishing that as "similarityScore" presents a filter match as a ranking, so
        // emit it only when the scores actually differ.
        if (hit.containsKey("_score") && scoresVary) {
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

    boolean moreInIndex = (long) from + cleanedResults.size() < totalResults;
    if (moreInIndex) {
      result.put(
          "message",
          String.format(
              "Found %d total results, showing first %d. "
                  + "There are many matching assets. Are you looking for something specific? "
                  + "Try narrowing with a service name, schema name, or more specific search term.",
              totalResults, cleanedResults.size()));
      result.put("hasMore", true);
    }

    fitResultsToBudget(result, cleanedResults, totalResults, query);
    attachPagingContract(result, from, totalResults);

    return result;
  }

  /**
   * Sets the unified paging markers. {@code total} is the real ES hit count; {@code nextCursor}
   * advances by the count actually returned this page (after any budget trim) so the next call never
   * skips rows. Emitted only when {@code hasMore} was set — either the total exceeds this page or the
   * size budget trimmed it.
   */
  private static void attachPagingContract(
      Map<String, Object> result, int from, long totalResults) {
    result.put(McpResponseTrim.TOTAL_KEY, totalResults);
    int returned = result.get("returnedCount") instanceof Number number ? number.intValue() : 0;
    if (Boolean.TRUE.equals(result.get(McpResponseTrim.HAS_MORE_KEY)) && returned > 0) {
      result.put(McpResponseTrim.NEXT_CURSOR_KEY, PageCursor.encodeOffset(from + returned));
    } else if (returned == 0) {
      result.remove(McpResponseTrim.HAS_MORE_KEY);
      result.remove(McpResponseTrim.MESSAGE_KEY);
    }
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
                  + "Pass 'nextCursor' to fetch the next page, or narrow the query.",
              trimmed.size(), totalResults));
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
        result.put(field, slimField(field, source.get(field)));
      }
    }

    // Slim requested fields too: `fields=certification` used to bypass slimField and return the
    // whole nested label, with expiry as epoch millis, on every hit.
    for (String field : requestedFields) {
      if (source.containsKey(field)) {
        result.put(field, capBulkField(field, slimField(field, source.get(field)), result));
      }
    }

    addSlimTestCaseResult(source, result);

    // Truncate long descriptions, and say so. A silent cut is worse than a short field: the caller
    // reads it as the complete text. Columns were already flagged this way; descriptions were not.
    if (result.get("description") instanceof String description) {
      String trimmed = McpResponseTrim.truncateDescription(description);
      result.put("description", trimmed);
      if (trimmed.length() < description.length()) {
        result.put(DESCRIPTION_TRUNCATED_KEY, Boolean.TRUE);
      }
    }
    markNeverRunTestCase(result);
    return result;
  }

  /**
   * Distinguishes a test that has never executed from a field that was simply not returned.
   *
   * <p>{@code testCaseStatus} is accurate once a test has run, so its absence is genuine - but
   * absence alone is ambiguous, and callers spent extra calls just to learn that "no status" meant
   * "never ran".
   *
   * <p>Reported as a separate {@code neverRun} flag, not as a {@code testCaseStatus} value:
   * {@code testCaseStatus} is a closed schema enum (Success, Failed, Aborted, Queued) with a
   * generated parser behind it, so writing {@code "NeverRun"} into it invents a value that exists
   * nowhere in OpenMetadata and throws in any client that parses the field.
   */
  private static void markNeverRunTestCase(Map<String, Object> result) {
    boolean isTestCase = TEST_CASE_ENTITY.equals(result.get("entityType"));
    if (isTestCase && result.get("testCaseStatus") == null) {
      result.put(NEVER_RUN_KEY, Boolean.TRUE);
    }
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

  /**
   * A queryFilter whose only job is to exclude entity types, for the path where the caller supplied
   * no filter of their own. Null when there is nothing to exclude, so the request is unchanged.
   */
  @VisibleForTesting
  static String excludeOnlyFilter(Set<String> excluded) {
    String filter = null;
    if (!excluded.isEmpty()) {
      ObjectNode wrapper = JsonUtils.getObjectMapper().createObjectNode();
      wrapper.set("query", excludeTypesFrom(null, excluded));
      filter = JsonUtils.pojoToJson(wrapper);
    }
    return filter;
  }

  /**
   * Wraps a query so excluded entity types never match, letting the engine backfill the page.
   *
   * <p>{@code tableColumn} documents sit inside the default {@code dataAsset} scope, so a broad
   * sweep can return mostly columns inheriting their parent's tags or certification.
   */
  private static JsonNode excludeTypesFrom(JsonNode query, Set<String> excluded) {
    JsonNode result = query;
    if (!excluded.isEmpty()) {
      ObjectNode bool = JsonUtils.getObjectMapper().createObjectNode();
      ObjectNode inner = bool.putObject("bool");
      // A null query means there is nothing to exclude *from* - the caller supplied no filter - so
      // the bool carries must_not alone and matches everything else.
      if (query != null) {
        inner.set("must", query);
      }
      ArrayNode mustNot = inner.putArray("must_not");
      for (String type : excluded) {
        mustNot.addObject().putObject("term").put("entityType", type);
      }
      result = bool;
    }
    return result;
  }

  /** True when hit scores vary, i.e. something actually ranked them. */
  private static boolean scoresDiscriminate(List<?> hits) {
    Object first = null;
    boolean varies = false;
    for (Object hitObj : hits) {
      Map<String, Object> hit = safeGetMap(hitObj);
      Object score = hit == null ? null : hit.get("_score");
      if (score == null) {
        continue;
      }
      if (first == null) {
        first = score;
      } else if (!first.equals(score)) {
        varies = true;
        break;
      }
    }
    return varies;
  }

  /**
   * Caps a hydrated bulk field on a search hit.
   *
   * <p>{@code fields=columns} hydrates every column with its full description, so one wide table can
   * dominate a page. A search hit exists to be chosen between; {@code get_entity_details} is where
   * the full detail lives.
   */
  private static Object capBulkField(String field, Object value, Map<String, Object> result) {
    Object capped = value;
    if (BULK_FIELDS.contains(field)
        && value instanceof List<?> items
        && items.size() > MAX_BULK_ITEMS) {
      capped = new ArrayList<>(items.subList(0, MAX_BULK_ITEMS));
      result.put(field + "Total", items.size());
      result.put(field + "Truncated", Boolean.TRUE);
    }
    return capped;
  }

  /**
   * Entity references and tag labels are collapsed to the identifier a caller can act on.
   *
   * <p>{@code tier}, {@code service}, {@code database} and {@code databaseSchema} each repeat a full
   * descriptor on every hit, which on a 10-hit response was most of the payload. Every MCP tool is
   * addressed by {@code (entityType, fqn)}, so the FQN is the actionable part.
   */
  private static Object slimField(String field, Object value) {
    Object result = value;
    if (REFERENCE_FIELDS.contains(field)) {
      result = McpResponseTrim.slimRef(value);
    } else if (REFERENCE_LIST_FIELDS.contains(field)) {
      result = McpResponseTrim.slimRefs(value);
    } else if (TAG_FIELDS.contains(field)) {
      result = McpResponseTrim.slimTag(value);
    } else if (CERTIFICATION_FIELD.equals(field)) {
      result = McpResponseTrim.slimCertification(value, System.currentTimeMillis());
    }
    return result;
  }

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
