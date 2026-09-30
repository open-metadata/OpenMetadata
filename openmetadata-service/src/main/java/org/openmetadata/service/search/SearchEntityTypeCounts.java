package org.openmetadata.service.search;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Counts each entity type through the ranked, authorized search used by its results tab. */
public final class SearchEntityTypeCounts {
  private final SearchRepository searchRepository;
  private final Search search;

  public SearchEntityTypeCounts(SearchRepository searchRepository, Search search) {
    this.searchRepository = searchRepository;
    this.search = search;
  }

  @FunctionalInterface
  public interface Search {
    Response run(SearchRequest request, SubjectContext subjectContext) throws IOException;
  }

  private record Count(String entityType, long total, ObjectNode response) {}

  public Response search(SearchRequest request, String index, SubjectContext subjectContext)
      throws IOException {
    List<Count> counts = new ArrayList<>();
    for (String entityType : entityTypes(index)) {
      // Reuse the identity window's exact total rather than probing and then repeating
      // every ordinary query with size=0. Only the total escapes this private request.
      SearchRequest countRequest =
          JsonUtils.deepCopy(request, SearchRequest.class)
              .withIndex(searchRepository.getIndexOrAliasName(entityType))
              .withSize(SearchRankingHelper.identityProbeSize())
              .withFetchSource(true)
              .withIncludeSourceFields(List.of("name", "fullyQualifiedName"));
      ObjectNode body = searchBody(countRequest, subjectContext);
      counts.add(new Count(entityType, exactTotal(body, countRequest.getIndex()), body));
    }
    ObjectNode response =
        request.getSize() > 0
            ? searchBody(relevanceHint(request), subjectContext)
            : emptyResponse();
    mergeCounts(response, counts);
    return Response.ok(JsonUtils.pojoToJson(response)).build();
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

  private boolean matchesCountTarget(
      List<String> targets, String entityType, IndexMapping mapping) {
    return targets.stream()
        .anyMatch(
            target ->
                target.equals(searchRepository.getIndexOrAliasName(entityType))
                    || ((target.equals(searchRepository.getIndexOrAliasName("all"))
                            || target.equals(searchRepository.getIndexOrAliasName("dataAsset")))
                        && mapping.getParentAliases() != null
                        && mapping.getParentAliases().stream()
                            .map(searchRepository::getIndexOrAliasName)
                            .anyMatch(target::equals)));
  }

  private ObjectNode emptyResponse() {
    ObjectNode response = JsonUtils.getObjectMapper().createObjectNode();
    response.put("took", 0).put("timed_out", false);
    response
        .putObject("_shards")
        .put("total", 0)
        .put("successful", 0)
        .put("skipped", 0)
        .put("failed", 0);
    response.putObject("hits").putNull("max_score").putArray("hits");
    return response;
  }

  private SearchRequest relevanceHint(SearchRequest request) {
    // The composite ranking remains the tab-selection hint, but cannot supply per-type counts:
    // each tab has its own configured fields and identifier-precision decision.
    return JsonUtils.deepCopy(request, SearchRequest.class)
        .withIndex(searchRepository.getIndexOrAliasName("dataAsset"))
        .withSize(1)
        .withFetchSource(true)
        .withIncludeSourceFields(List.of("entityType"));
  }

  private void mergeCounts(ObjectNode response, List<Count> counts) {
    ArrayNode buckets =
        response.putObject("aggregations").putObject("entityType").putArray("buckets");
    for (Count count : counts) {
      if (count.total() > 0)
        buckets.addObject().put("key", count.entityType()).put("doc_count", count.total());
      mergeMetrics(response, count.response());
    }
    ((ObjectNode) response.path("hits"))
        .putObject("total")
        .put("value", counts.stream().mapToLong(Count::total).sum())
        .put("relation", "eq");
  }

  private void mergeMetrics(ObjectNode response, JsonNode count) {
    response.put("took", response.path("took").asLong() + count.path("took").asLong());
    ObjectNode shards = (ObjectNode) response.path("_shards");
    for (String field : List.of("total", "successful", "skipped", "failed")) {
      shards.put(field, shards.path(field).asLong() + count.path("_shards").path(field).asLong());
    }
  }

  private long exactTotal(ObjectNode response, String index) throws IOException {
    JsonNode total = response.at("/hits/total");
    JsonNode value = total.path("value");
    if (!value.isIntegralNumber()
        || !value.canConvertToLong()
        || value.longValue() < 0
        || !"eq".equals(total.path("relation").textValue())) {
      throw new IOException("Missing or invalid exact search total for " + index);
    }
    return value.longValue();
  }

  private ObjectNode searchBody(SearchRequest request, SubjectContext subjectContext)
      throws IOException {
    try (Response response = search.run(request, subjectContext)) {
      if (response.getStatus() != Response.Status.OK.getStatusCode()) {
        throw new IOException("Unable to count search results for " + request.getIndex());
      }
      ObjectNode body = parseResponse(response.getEntity(), request.getIndex());
      if (body.path("timed_out").asBoolean() || body.at("/_shards/failed").asInt() > 0) {
        throw new IOException("Incomplete search counts for " + request.getIndex());
      }
      return body;
    }
  }

  private ObjectNode parseResponse(Object entity, String index) throws IOException {
    if (!(entity instanceof String json)) {
      throw new IOException("Missing search response for " + index);
    }
    try {
      JsonNode body = JsonUtils.getObjectMapper().readTree(json);
      if (!(body instanceof ObjectNode object)
          || !body.path("hits").isObject()
          || !body.path("_shards").isObject()) {
        throw new IOException("Invalid search response structure for " + index);
      }
      return object;
    } catch (JsonProcessingException e) {
      throw new IOException("Invalid search response JSON for " + index, e);
    }
  }
}
