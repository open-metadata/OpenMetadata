package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchClient.DATA_ASSET_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.spi.JsonProvider;
import jakarta.json.stream.JsonGenerator;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringWriter;
import java.util.Arrays;
import java.util.List;
import java.util.function.Consumer;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;

/** Counts all requested types in one search while preserving each type's ranked matching rules. */
public final class SearchEntityTypeCounts {
  private static final String PRECISE = "precise";
  private static final String PROBE = "probe";
  private static final String EXACT_TOTAL_RELATION = "eq";
  private final SearchRepository searchRepository;
  private final QueryBuilder queries;
  private final Aggregate aggregate;
  private final Search hintSearch;

  public SearchEntityTypeCounts(
      SearchRepository searchRepository,
      QueryBuilder queries,
      Aggregate aggregate,
      Search hintSearch) {
    this.searchRepository = searchRepository;
    this.queries = queries;
    this.aggregate = aggregate;
    this.hintSearch = hintSearch;
  }

  @FunctionalInterface
  public interface QueryBuilder {
    ObjectNode build(SearchRequest request, SearchSettings settings) throws IOException;
  }

  @FunctionalInterface
  public interface Aggregate {
    ObjectNode run(ObjectNode request, String index) throws IOException;
  }

  @FunctionalInterface
  public interface Search {
    Response run(SearchRequest request) throws IOException;
  }

  private record Plan(String index, List<String> types, ObjectNode body, boolean precision) {}

  public Response search(SearchRequest request, String index, SearchSettings settings)
      throws IOException {
    Plan plan = plan(request, index, settings);
    ObjectNode response = validateResponse(aggregate.run(plan.body(), plan.index()), plan.index());
    normalizeCounts(response, plan, request.getQuery());
    if (request.getSize() > 0) {
      attachHint(response, request);
    }
    return Response.ok(JsonUtils.pojoToJson(response)).build();
  }

  private Plan plan(SearchRequest request, String index, SearchSettings settings)
      throws IOException {
    List<String> types = entityTypes(index);
    boolean precision = SearchRankingHelper.hasPrunableFuzzyStage(settings);
    SearchSettings precise =
        precision ? SearchRankingHelper.withoutFuzzyStages(settings) : settings;
    ObjectNode body = object().put("size", 0).put("track_total_hits", false);
    ObjectNode bool = body.putObject("query").putObject("bool").put("minimum_should_match", 1);
    ArrayNode should = bool.putArray("should");
    ObjectNode aggregations = body.putObject("aggs");
    for (String type : types) {
      addType(request, new TypeSettings(type, settings, precise, precision), should, aggregations);
    }
    String indexes =
        String.join(",", types.stream().map(searchRepository::getIndexOrAliasName).toList());
    return new Plan(indexes, types, body, precision);
  }

  private record TypeSettings(
      String type, SearchSettings broad, SearchSettings precise, boolean probe) {}

  private void addType(
      SearchRequest request, TypeSettings settings, ArrayNode should, ObjectNode aggregations)
      throws IOException {
    SearchRequest perType = identityRequest(request, settings.type());
    ObjectNode broad = queries.build(perType, settings.broad());
    ObjectNode indexFilter = object();
    indexFilter.putObject("term").put("_index", perType.getIndex());
    ObjectNode scoped = should.addObject().putObject("bool");
    scoped.set("must", filteredQuery(broad));
    scoped.set("filter", indexFilter);
    ObjectNode bucket = aggregations.putObject(settings.type());
    bucket.set("filter", indexFilter);
    if (settings.probe()) {
      addPrecisionAggregations(bucket, broad, queries.build(perType, settings.precise()));
    }
  }

  private SearchRequest identityRequest(SearchRequest request, String type) {
    return JsonUtils.deepCopy(request, SearchRequest.class)
        .withIndex(searchRepository.getIndexOrAliasName(type))
        .withFrom(0)
        .withSize(SearchRankingHelper.identityProbeSize())
        .withSearchAfter(null)
        .withSortFieldParam("_score")
        .withSortOrder("desc")
        .withIsHierarchy(false)
        .withIncludeAggregations(false)
        .withFetchSource(true)
        .withIncludeSourceFields(List.of("name", "fullyQualifiedName"))
        .withExcludeSourceFields(null);
  }

  private JsonNode filteredQuery(ObjectNode prepared) throws IOException {
    JsonNode query = prepared.path("query");
    if (!query.isObject()) throw new IOException("Missing prepared count query");
    if (prepared.hasNonNull("post_filter")) {
      ObjectNode combined = object();
      ObjectNode bool = combined.putObject("bool");
      bool.set("must", query);
      // Engine post_filter does not affect aggregations; counts must include it in the query.
      bool.set("filter", prepared.get("post_filter"));
      return combined;
    }
    return query;
  }

  private void addPrecisionAggregations(ObjectNode bucket, ObjectNode broad, ObjectNode precise)
      throws IOException {
    ObjectNode children = bucket.putObject("aggs");
    children.putObject(PRECISE).set("filter", filteredQuery(precise));
    ObjectNode probe = children.putObject(PROBE).putObject("top_hits");
    probe.put("size", SearchRankingHelper.identityProbeSize()).put("track_scores", true);
    probe.putObject("_source").putArray("includes").add("name").add("fullyQualifiedName");
    // Top hits inherit the root query's score. Disjoint index-scoped branches above preserve
    // each type's score, and its normal tie-breakers preserve the exact identity-probe window.
    probe.set("sort", broad.path("sort"));
  }

  private List<String> entityTypes(String index) {
    List<String> targets =
        Arrays.stream(index.split(","))
            .map(String::trim)
            .map(searchRepository::getIndexOrAliasName)
            .toList();
    List<String> types =
        searchRepository.getIndexedEntityTypes().stream()
            .filter(
                type -> matchesCountTarget(targets, type, searchRepository.getIndexMapping(type)))
            .toList();
    if (types.isEmpty()) throw new BadRequestException("No indexed entity types for " + index);
    return types;
  }

  private boolean matchesCountTarget(List<String> targets, String type, IndexMapping mapping) {
    return targets.stream()
        .anyMatch(
            target ->
                target.equals(searchRepository.getIndexOrAliasName(type))
                    || ((target.equals(searchRepository.getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                            || target.equals(
                                searchRepository.getIndexOrAliasName(DATA_ASSET_SEARCH_ALIAS)))
                        && mapping.getParentAliases() != null
                        && mapping.getParentAliases().stream()
                            .map(searchRepository::getIndexOrAliasName)
                            .anyMatch(target::equals)));
  }

  private void normalizeCounts(ObjectNode response, Plan plan, String query) throws IOException {
    JsonNode original = response.path("aggregations");
    ArrayNode buckets =
        response.putObject("aggregations").putObject("entityType").putArray("buckets");
    long total = 0;
    for (String type : plan.types()) {
      long count = selectedCount(aggregation(original, type), plan.precision(), query, type);
      if (count > 0) buckets.addObject().put("key", type).put("doc_count", count);
      try {
        total = Math.addExact(total, count);
      } catch (ArithmeticException e) {
        throw new IOException("Search count total overflow for " + plan.index(), e);
      }
    }
    ObjectNode hits = response.putObject("hits");
    hits.putNull("max_score").putArray("hits");
    hits.putObject("total").put("value", total).put("relation", EXACT_TOTAL_RELATION);
  }

  private long selectedCount(JsonNode bucket, boolean precision, String query, String type)
      throws IOException {
    long broad = countValue(bucket.path("doc_count"), type);
    if (!precision) return broad;
    long precise = countValue(aggregation(bucket, PRECISE).path("doc_count"), type);
    JsonNode hits = aggregation(bucket, PROBE).at("/hits/hits");
    if (!hits.isArray()
        || hits.size() != Math.min(broad, SearchRankingHelper.identityProbeSize())) {
      throw new IOException("Incomplete identity probe for " + type);
    }
    Stream<String> identifiers =
        StreamSupport.stream(hits.spliterator(), false)
            .flatMap(
                hit -> Stream.of(hit.at("/_source/name"), hit.at("/_source/fullyQualifiedName")))
            .filter(JsonNode::isTextual)
            .map(JsonNode::textValue);
    return SearchRankingHelper.isExactIdentifierLookup(query, identifiers) ? precise : broad;
  }

  private JsonNode aggregation(JsonNode parent, String name) {
    if (parent.has(name)) return parent.get(name);
    if (parent.has("filter#" + name)) return parent.get("filter#" + name);
    return parent.path("top_hits#" + name);
  }

  private long countValue(JsonNode value, String type) throws IOException {
    if (!value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() < 0) {
      throw new IOException("Missing or invalid exact search count for " + type);
    }
    return value.longValue();
  }

  private void attachHint(ObjectNode response, SearchRequest request) throws IOException {
    SearchRequest hint =
        JsonUtils.deepCopy(request, SearchRequest.class)
            .withIndex(searchRepository.getIndexOrAliasName(DATA_ASSET_SEARCH_ALIAS))
            .withSize(1)
            .withFetchSource(true)
            .withIncludeSourceFields(List.of("entityType"));
    try (Response result = hintSearch.run(hint)) {
      if (result.getStatus() != Response.Status.OK.getStatusCode()) {
        throw new IOException("Unable to fetch search hint for " + hint.getIndex());
      }
      ObjectNode body = parseResponse(result.getEntity(), hint.getIndex());
      ((ObjectNode) response.path("hits")).set("hits", body.at("/hits/hits"));
      ((ObjectNode) response.path("hits")).set("max_score", body.at("/hits/max_score"));
      mergeMetrics(response, body);
    }
  }

  private void mergeMetrics(ObjectNode response, ObjectNode hint) {
    response.put("took", response.path("took").asLong() + hint.path("took").asLong());
    ObjectNode shards = (ObjectNode) response.path("_shards");
    for (String field : List.of("total", "successful", "skipped", "failed")) {
      shards.put(field, shards.path(field).asLong() + hint.path("_shards").path(field).asLong());
    }
  }

  private ObjectNode parseResponse(Object entity, String index) throws IOException {
    if (!(entity instanceof String json))
      throw new IOException("Missing search response for " + index);
    try {
      JsonNode body = JsonUtils.getObjectMapper().readTree(json);
      if (!(body instanceof ObjectNode object))
        throw new IOException("Invalid search response for " + index);
      return validateResponse(object, index);
    } catch (JsonProcessingException e) {
      throw new IOException("Invalid search response JSON for " + index, e);
    }
  }

  private ObjectNode validateResponse(ObjectNode body, String index) throws IOException {
    if (body == null || !body.path("hits").isObject() || !body.path("_shards").isObject()) {
      throw new IOException("Invalid search response structure for " + index);
    }
    if (body.path("timed_out").asBoolean() || body.at("/_shards/failed").asInt() > 0) {
      throw new IOException("Incomplete search counts for " + index);
    }
    return body;
  }

  private static ObjectNode object() {
    return JsonUtils.getObjectMapper().createObjectNode();
  }

  /** Bridge the engine-specific JSON-P serializers without duplicating the aggregation planner. */
  public static ObjectNode toJson(JsonProvider provider, Consumer<JsonGenerator> serialize) {
    StringWriter writer = new StringWriter();
    try (JsonGenerator generator = provider.createGenerator(writer)) {
      serialize.accept(generator);
    }
    return (ObjectNode) JsonUtils.readTree(writer.toString());
  }
}
