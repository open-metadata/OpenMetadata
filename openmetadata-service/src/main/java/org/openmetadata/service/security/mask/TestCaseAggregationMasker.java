package org.openmetadata.service.security.mask;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.mask.TestCaseSearchMasker.Projection;

final class TestCaseAggregationMasker {
  private static final int MAX_SCOPE_DOCUMENTS = 1000;
  private static final String ID_FIELD = "id.keyword";
  private static final String EXACT_TOTAL = "eq";
  private static final String UNAVAILABLE = "Aggregation is unavailable for the requested scope.";
  private static final Set<String> RESULT_FIELDS =
      Arrays.stream(TestCaseResult.class.getDeclaredFields())
          .filter(field -> !Modifier.isStatic(field.getModifiers()))
          .map(Field::getName)
          .collect(Collectors.toUnmodifiableSet());
  private final TestCaseSearchMasker.AggregationContext context;
  private final Predicate<JsonNode> containsMaskedHits;

  TestCaseAggregationMasker(
      TestCaseSearchMasker.AggregationContext context, Predicate<JsonNode> containsMaskedHits) {
    this.context = context;
    this.containsMaskedHits = containsMaskedHits;
  }

  AggregationRequest prepare(AggregationRequest request) throws IOException {
    if (isFilteredField(
        request.getFieldName(),
        TestCaseSearchMasker.projectionFor(context.repository(), request.getIndex()))) {
      return constrainToScope(request, validateScope(request));
    }
    return request;
  }

  private JsonNode validateScope(AggregationRequest request) throws IOException {
    final AggregationRequest probe =
        JsonUtils.deepCopy(request, AggregationRequest.class)
            .withFieldName(ID_FIELD)
            .withFieldValue(".*")
            .withSize(MAX_SCOPE_DOCUMENTS + 1)
            .withSourceFields(List.of("entityLink", "testCaseFQN"));
    try (Response response = context.repository().aggregate(probe, context.subject())) {
      final JsonNode root = readResponse(response);
      final JsonNode aggregations = root.path("aggregations");
      if (aggregations.size() != 1) {
        throw new BadRequestException(UNAVAILABLE);
      }
      final JsonNode scope = aggregations.elements().next();
      if (!isCompleteScope(root, scope) || containsMaskedHits.test(scope)) {
        throw new BadRequestException(UNAVAILABLE);
      }
      return scope;
    }
  }

  private static AggregationRequest constrainToScope(AggregationRequest request, JsonNode scope) {
    final Map<String, List<String>> documents = new LinkedHashMap<>();
    for (JsonNode bucket : scope.path("buckets")) {
      final JsonNode hit = topHits(bucket).get(0);
      documents
          .computeIfAbsent(hit.path("_index").asText(), ignored -> new ArrayList<>())
          .add(hit.path("_id").asText());
    }
    final List<Map<String, Object>> indexes =
        documents.entrySet().stream()
            .map(entry -> indexClause(entry.getKey(), entry.getValue()))
            .toList();
    final Map<String, Object> query =
        indexes.isEmpty()
            ? Map.of("match_none", Map.of())
            : Map.of("bool", Map.of("should", indexes, "minimum_should_match", 1));
    return JsonUtils.deepCopy(request, AggregationRequest.class)
        .withQuery(JsonUtils.pojoToJson(Map.of("query", query)))
        .withQueryText(null);
  }

  private static Map<String, Object> indexClause(String index, List<String> ids) {
    return Map.of(
        "bool",
        Map.of(
            "filter",
            List.of(
                Map.of("term", Map.of("_index", index)), Map.of("ids", Map.of("values", ids)))));
  }

  private static boolean isCompleteScope(JsonNode root, JsonNode scope) {
    final JsonNode total = root.path("hits").path("total");
    final JsonNode buckets = scope.path("buckets");
    return isCompleteSearch(root)
        && total.path("value").isIntegralNumber()
        && total.path("relation").asText().equals(EXACT_TOTAL)
        && total.path("value").asLong() <= MAX_SCOPE_DOCUMENTS
        && buckets.isArray()
        && buckets.size() == total.path("value").asLong()
        && scope.path("sum_other_doc_count").asLong() == 0
        && StreamSupport.stream(buckets.spliterator(), false)
            .allMatch(TestCaseAggregationMasker::isCompleteBucket);
  }

  private static boolean isCompleteSearch(JsonNode root) {
    final JsonNode shards = root.path("_shards");
    return !root.path("timed_out").asBoolean()
        && !root.path("terminated_early").asBoolean()
        && isShardCount(shards.path("total"))
        && isShardCount(shards.path("failed"))
        && isShardCount(shards.path("successful"))
        && shards.path("failed").asLong() == 0
        && shards.path("successful").asLong() == shards.path("total").asLong();
  }

  private static boolean isShardCount(JsonNode count) {
    return count.isNumber()
        && count.canConvertToExactIntegral()
        && count.canConvertToLong()
        && count.asLong() >= 0;
  }

  private static boolean isCompleteBucket(JsonNode bucket) {
    final JsonNode hits = topHits(bucket);
    return bucket.path("doc_count").asLong() == 1
        && hits.isArray()
        && hits.size() == 1
        && hits.get(0).path("_id").isTextual()
        && hits.get(0).path("_index").isTextual();
  }

  private static JsonNode topHits(JsonNode bucket) {
    final JsonNode top = bucket.has("top") ? bucket.path("top") : bucket.path("top_hits#top");
    return top.path("hits").path("hits");
  }

  private static JsonNode readResponse(Response response) {
    if (response.getStatus() != Response.Status.OK.getStatusCode()
        || response.getEntity() == null) {
      throw new BadRequestException(UNAVAILABLE);
    }
    return response.getEntity() instanceof String json
        ? JsonUtils.readTree(json)
        : JsonUtils.valueToTree(response.getEntity());
  }

  static boolean filterAutomatic(ObjectNode aggregations, Projection projection) {
    return filterAutomatic(
        aggregations,
        SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class),
        projection);
  }

  static boolean filterAutomatic(ObjectNode aggregations, SearchSettings settings) {
    return filterAutomatic(aggregations, settings, Projection.MIXED);
  }

  static boolean filterAutomatic(
      ObjectNode aggregations, SearchSettings settings, Projection projection) {
    final Set<String> filteredNames = configuredFilteredNames(settings, projection);
    final List<String> removed = new ArrayList<>();
    aggregations
        .fieldNames()
        .forEachRemaining(
            name -> {
              final String field = name.substring(name.indexOf('#') + 1);
              if (isFilteredField(field, projection) || filteredNames.contains(field)) {
                removed.add(name);
              }
            });
    aggregations.remove(removed);
    return !removed.isEmpty();
  }

  private static Set<String> configuredFilteredNames(
      SearchSettings settings, Projection projection) {
    final Set<String> names = new HashSet<>();
    if (settings != null) {
      if (settings.getGlobalSettings() != null) {
        addFilteredNames(names, settings.getGlobalSettings().getAggregations(), projection);
      }
      listOrEmpty(settings.getAssetTypeConfigurations())
          .forEach(config -> addFilteredNames(names, config.getAggregations(), projection));
    }
    return names;
  }

  private static void addFilteredNames(
      Set<String> names, List<Aggregation> aggregations, Projection projection) {
    listOrEmpty(aggregations).stream()
        .filter(
            aggregation ->
                !nullOrEmpty(aggregation.getScript())
                    || (!nullOrEmpty(aggregation.getField())
                        && isFilteredField(aggregation.getField(), projection)))
        .map(Aggregation::getName)
        .forEach(names::add);
  }

  private static boolean isFilteredField(String field, Projection projection) {
    final String rootField = field.split("\\.", 2)[0];
    return switch (projection) {
      case TEST_CASES -> TestCaseSearchMasker.isFilteredField(field, false);
      case RESULTS -> TestCaseSearchMasker.isFilteredField(field, true);
      case MIXED -> TestCaseSearchMasker.isFilteredField(field, false)
          || (RESULT_FIELDS.contains(rootField)
              && TestCaseSearchMasker.isFilteredField(field, true));
    };
  }
}
