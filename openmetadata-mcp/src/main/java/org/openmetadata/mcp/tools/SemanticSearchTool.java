package org.openmetadata.mcp.tools;

import com.google.common.annotations.VisibleForTesting;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.UnaryOperator;
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

  /**
   * Every filter key {@code VectorSearchQueryBuilder} understands. A key belongs under
   * {@code filters} and nowhere else, and a key outside this set would be dropped with nothing but a
   * debug log — so both mistakes are rejected instead, per {@link #validateParams}. Keep in step
   * with the switch in {@code VectorSearchQueryBuilder.appendFilterMustClauses}.
   */
  private static final List<String> FILTER_FIELDS =
      List.of(
          "entityType",
          "service",
          "serviceType",
          "tags",
          "owners",
          "domains",
          "tier",
          "certification",
          "database",
          "databaseSchema",
          "primaryEntityId",
          "parentId",
          "metricType",
          "granularity",
          "unitOfMeasurement");

  /** Filter keys of the form {@code customProperties.<name>}, matched by prefix. */
  private static final String CUSTOM_PROPERTIES_PREFIX = "customProperties.";

  /** Sentinel unit meaning "see customUnitOfMeasurement" rather than a unit in its own right. */
  private static final String UNIT_OF_MEASUREMENT_OTHER = "OTHER";

  /** Read-side ceiling on the metric expression a summary carries. */
  private static final int MAX_METRIC_CODE_CHARS = 1000;

  private static final int MAX_COLUMN_NAMES = 60;

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
      return errorResponse(failureMessage(e));
    }
  }

  /**
   * Rejects the two ways a filter used to be discarded in silence: passed at the top level instead
   * of under {@code filters}, or named something the query builder does not understand. Either way
   * the caller got an unfiltered search back with no indication their filter had done nothing — a
   * wrong answer that looks like a right one.
   *
   * @return the error message, or {@code null} when the parameters are usable
   */
  private static String validateParams(String query, Map<String, Object> params) {
    String error = null;
    if (query == null || query.isBlank()) {
      error = "'query' parameter is required";
    } else {
      error = misplacedFilterError(params);
      if (error == null) {
        error = unknownFilterError(params);
      }
    }
    return error;
  }

  private static String misplacedFilterError(Map<String, Object> params) {
    String misplaced = FILTER_FIELDS.stream().filter(params::containsKey).findFirst().orElse(null);
    return misplaced == null
        ? null
        : String.format(
            "'%s' is a filter and must be nested under 'filters' as an array, "
                + "for example: {\"query\": \"...\", \"filters\": {\"%s\": [\"value\"]}}",
            misplaced, misplaced);
  }

  private static String unknownFilterError(Map<String, Object> params) {
    String unknown =
        parseFilters(params).keySet().stream()
            .filter(key -> !isSupportedFilter(key))
            .findFirst()
            .orElse(null);
    return unknown == null
        ? null
        : String.format(
            "'%s' is not a supported filter field. Supported fields: %s, "
                + "or 'customProperties.<name>'.",
            unknown, String.join(", ", FILTER_FIELDS));
  }

  private static boolean isSupportedFilter(String key) {
    return FILTER_FIELDS.contains(key) || key.startsWith(CUSTOM_PROPERTIES_PREFIX);
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
    addParentTotal(result, from);
    return result;
  }

  /**
   * Publishes {@code totalFound} in the same unit as everything else here: entities.
   *
   * <p>{@code VectorSearchResponse.totalHits} counts chunks, not entities - the vector service
   * indexes several chunks per entity - while {@code results}, {@code returnedCount}, {@code size},
   * {@code from} and {@code nextCursor} all count parents. Reporting it made eight matching tables
   * read as {@code totalFound: 96}.
   *
   * <p>So report what is known: once paging stops, {@code from + returnedCount} is exact. While it
   * continues, the same figure is a lower bound and is labelled as one.
   */
  @VisibleForTesting
  static void addParentTotal(Map<String, Object> result, int from) {
    int returned = result.get("returnedCount") instanceof Number number ? number.intValue() : 0;
    result.put("totalFound", from + returned);
    if (Boolean.TRUE.equals(result.get(McpResponseTrim.HAS_MORE_KEY))) {
      result.put("totalFoundIsLowerBound", Boolean.TRUE);
      result.put(
          "totalFoundNote",
          "'totalFound' counts the entities seen so far, not the whole corpus - more exist. Page"
              + " with 'nextCursor' until 'hasMore' is absent to get the exact count.");
    }
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
    copySlim(hit, cleaned, "service", McpResponseTrim::slimRef);
    copySlim(hit, cleaned, "database", McpResponseTrim::slimRef);
    copySlim(hit, cleaned, "databaseSchema", McpResponseTrim::slimRef);
    copySlim(hit, cleaned, "owners", McpResponseTrim::slimRefs);
    copySlim(hit, cleaned, "domains", McpResponseTrim::slimRefs);
    copySlim(hit, cleaned, "tier", McpResponseTrim::slimTag);
    copySlim(hit, cleaned, "tags", McpResponseTrim::slimTag);
    copyColumnNames(hit, cleaned);
    copySlim(
        hit,
        cleaned,
        "certification",
        value -> McpResponseTrim.slimCertification(value, System.currentTimeMillis()));
    // Metric facts: a metric summary without its expression, granularity, type and unit cannot be
    // told apart from a similarly named metric, which forced a per-result get_entity_details call.
    copyMetricExpression(hit, cleaned);
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
   * A metric's expression, capped for the summary.
   *
   * <p>The write-side cap in {@code VectorDocBuilder} only covers chunk docs. Entity documents are
   * members of the same {@code dataAssetEmbeddings} alias and carry the untruncated expression —
   * and on Elasticsearch, which has no chunk index, every hit is an entity document. A 30 KB SQL
   * body would then eat most of the response budget and crowd out the other results, so the read
   * side caps it too, exactly as {@code description} is capped on both sides.
   */
  private static void copyMetricExpression(Map<String, Object> hit, Map<String, Object> cleaned) {
    if (hit.get("metricExpression") instanceof Map<?, ?> expression) {
      Map<String, Object> summary = new HashMap<>(expression.size());
      expression.forEach((key, value) -> summary.put(String.valueOf(key), value));
      Object code = summary.get("code");
      if (code instanceof String sql) {
        summary.put("code", McpResponseTrim.truncate(sql, MAX_METRIC_CODE_CHARS));
      }
      cleaned.put("metricExpression", summary);
    }
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

  /** Copies a field through a slimming function, skipping absent fields. */
  private void copySlim(
      Map<String, Object> hit,
      Map<String, Object> cleaned,
      String field,
      UnaryOperator<Object> slim) {
    Object value = hit.get(field);
    if (value != null) {
      cleaned.put(field, slim.apply(value));
    }
  }

  /**
   * Emits column <em>names</em> rather than full column objects, matching {@code search_metadata}.
   * Full {@code columns} was most of a 10-hit response - per-column descriptions that do not help
   * choose between assets. Names still answer "does this table have a customer_id column?", and
   * {@code get_entity_details} stays the way to get the detail.
   */
  private void copyColumnNames(Map<String, Object> hit, Map<String, Object> cleaned) {
    if (hit.get("columns") instanceof List<?> columns && !columns.isEmpty()) {
      List<Object> names =
          columns.stream()
              .map(column -> column instanceof Map<?, ?> map ? map.get("name") : column)
              .filter(Objects::nonNull)
              .toList();
      if (!names.isEmpty()) {
        putCappedColumnNames(cleaned, names);
      }
    }
  }

  /**
   * Caps the column-name list on a search hit.
   *
   * <p>One hit carrying ~1000 generated names pushed a response past the client's display budget and
   * cost the caller most of its results. Nobody picks an asset by its 900th column, so cap the list
   * and say when it was cut.
   */
  private static void putCappedColumnNames(Map<String, Object> cleaned, List<Object> names) {
    if (names.size() <= MAX_COLUMN_NAMES) {
      cleaned.put("columnNames", names);
    } else {
      cleaned.put("columnNames", names.subList(0, MAX_COLUMN_NAMES));
      cleaned.put("totalColumns", names.size());
      cleaned.put("columnNamesTruncated", Boolean.TRUE);
    }
  }

  private void copyIfPresent(Map<String, Object> source, Map<String, Object> target, String key) {
    if (source.containsKey(key)) {
      target.put(key, source.get(key));
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, List<String>> parseFilters(Map<String, Object> params) {
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

  /**
   * Describes a failure as what it actually was.
   *
   * <p>This used to hardcode {@code serverFault = true} and tell every caller to stop using the
   * tool, so a bad {@code filters} value or an unparseable cursor was reported as a backend outage -
   * telling the caller its arguments were fine when they were the problem.
   */
  private static String failureMessage(Exception e) {
    boolean backendFault =
        DefaultToolContext.isServerFault(DefaultToolContext.resolveStatusCode(e));
    String advice =
        backendFault
            ? " Semantic search depends on an embedding backend; when it is unavailable, use"
                + " search_metadata with a queryFilter instead of retrying this tool."
            : " This is a problem with the arguments, not the backend - correct them and retry.";
    return "Semantic search failed: " + McpResponseTrim.summarizeFailure(e, backendFault) + advice;
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
