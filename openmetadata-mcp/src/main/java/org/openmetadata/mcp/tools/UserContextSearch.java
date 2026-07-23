/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * In-process owned/followed entity search backing {@link GetUserContextTool}. Runs against the
 * search repository ({@link org.openmetadata.service.search.SearchRepository}) with the caller's
 * {@link SubjectContext}, so RBAC and domain scoping are enforced by the engine — no HTTP hop and no
 * client-supplied identity.
 */
@Slf4j
final class UserContextSearch {
  static final String ALL_INDEX = "all";
  private static final String UPDATED_AT = "updatedAt";
  private static final String MATCH_ALL = "*";
  private static final int MAX_LIMIT = 100;

  /**
   * Data-asset entity types where a "missing description / tier" gap is meaningful. Excludes
   * testCase, ingestionPipeline, query, and other bookkeeping entities a user may own but that
   * aren't useful governance-gap results.
   */
  private static final List<String> GAP_ENTITY_TYPES =
      List.of(
          "table",
          "dashboard",
          "topic",
          "mlmodel",
          "container",
          "apiEndpoint",
          "searchIndex",
          "databaseSchema",
          "database",
          "pipeline",
          "glossaryTerm");

  private UserContextSearch() {}

  static Map<String, Object> ownedSummary(
      SubjectContext subjectContext,
      List<String> ownerIds,
      int limit,
      GetUserContextTool.OwnedFilter filter)
      throws IOException {
    Map<String, Object> summary = emptySummary();
    if (!ownerIds.isEmpty()) {
      ObjectNode ownersClause = nestedTerms("owners", "owners.id", ownerIds);
      List<ObjectNode> must = new ArrayList<>(List.of(ownersClause));
      must.addAll(gapClauses(filter));
      Map<String, Object> raw = runSearch(query(must), ALL_INDEX, limit, subjectContext);
      List<Map<String, Object>> recent = parseHits(raw);
      summary = new LinkedHashMap<>();
      summary.put("totalCount", parseTotal(raw));
      summary.put("byType", tallyByType(recent));
      summary.put("recent", recent);
    }
    return summary;
  }

  static Map<String, Object> followedSummary(
      SubjectContext subjectContext, String userId, int limit) throws IOException {
    ObjectNode followersClause = flatTerms("followers", List.of(userId));
    Map<String, Object> raw =
        runSearch(query(List.of(followersClause)), ALL_INDEX, limit, subjectContext);
    List<Map<String, Object>> entities = parseHits(raw);
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("totalCount", parseTotal(raw));
    summary.put("entities", entities);
    return summary;
  }

  private static Map<String, Object> emptySummary() {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("totalCount", 0);
    summary.put("byType", Map.of());
    summary.put("recent", List.of());
    return summary;
  }

  private static Map<String, Object> runSearch(
      String queryFilter, String index, int limit, SubjectContext subjectContext)
      throws IOException {
    // Use search() (not searchWithDirectQuery): it honors sortFieldParam / sortOrder /
    // trackTotalHits, which the direct-query path silently ignores. queryFilter narrows a match-all
    // base to the owned/followed set — the same wiring the REST /search/query endpoint uses.
    SearchRequest request =
        new SearchRequest()
            .withQuery(MATCH_ALL)
            .withIndex(Entity.getSearchRepository().getIndexOrAliasName(index))
            .withQueryFilter(queryFilter)
            .withSize(Math.min(Math.max(limit, 1), MAX_LIMIT))
            .withFrom(0)
            .withFetchSource(true)
            .withTrackTotalHits(true)
            .withSortFieldParam(UPDATED_AT)
            .withSortOrder("desc")
            .withDeleted(false);
    Response response = Entity.getSearchRepository().search(request, subjectContext);
    return toMap(response);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> toMap(Response response) {
    Object entity = response.getEntity();
    Map<String, Object> result;
    if (entity instanceof String responseStr) {
      result = JsonUtils.convertValue(JsonUtils.readTree(responseStr), Map.class);
    } else {
      result = JsonUtils.convertValue(entity, Map.class);
    }
    return result == null ? Map.of() : result;
  }

  private static String query(List<ObjectNode> mustClauses) {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    ArrayNode must = mapper.createArrayNode();
    mustClauses.forEach(must::add);
    ObjectNode bool = mapper.createObjectNode();
    bool.set("must", must);
    ObjectNode boolWrapper = mapper.createObjectNode();
    boolWrapper.set("bool", bool);
    ObjectNode root = mapper.createObjectNode();
    root.set("query", boolWrapper);
    return root.toString();
  }

  private static ObjectNode nestedTerms(String path, String field, List<String> values) {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    ObjectNode nested = mapper.createObjectNode();
    nested.put("path", path);
    nested.set("query", flatTerms(field, values));
    ObjectNode wrapper = mapper.createObjectNode();
    wrapper.set("nested", nested);
    return wrapper;
  }

  private static ObjectNode flatTerms(String field, List<String> values) {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    ArrayNode array = mapper.createArrayNode();
    values.forEach(array::add);
    ObjectNode terms = mapper.createObjectNode();
    terms.set(field, array);
    ObjectNode wrapper = mapper.createObjectNode();
    wrapper.set("terms", terms);
    return wrapper;
  }

  private static List<ObjectNode> gapClauses(GetUserContextTool.OwnedFilter filter) {
    List<ObjectNode> clauses = new ArrayList<>();
    if (filter != GetUserContextTool.OwnedFilter.NONE) {
      clauses.add(termsClause("entityType", GAP_ENTITY_TYPES));
      clauses.addAll(gapConditionClauses(filter));
    }
    return clauses;
  }

  private static List<ObjectNode> gapConditionClauses(GetUserContextTool.OwnedFilter filter) {
    return switch (filter) {
      case MISSING_DESCRIPTION -> List.of(missingDescription());
      case MISSING_TIER -> List.of(missingTier());
      case ANY_GAP -> List.of(anyGap());
      case NONE -> List.of();
    };
  }

  private static ObjectNode missingDescription() {
    return mustNot(term("descriptionStatus", "COMPLETE"));
  }

  private static ObjectNode missingTier() {
    return mustNot(existsField("tier.tagFQN"));
  }

  private static ObjectNode anyGap() {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    ArrayNode should = mapper.createArrayNode();
    should.add(missingDescription());
    should.add(missingTier());
    ObjectNode bool = mapper.createObjectNode();
    bool.set("should", should);
    bool.put("minimum_should_match", 1);
    ObjectNode wrapper = mapper.createObjectNode();
    wrapper.set("bool", bool);
    return wrapper;
  }

  private static ObjectNode mustNot(ObjectNode clause) {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    ArrayNode mustNot = mapper.createArrayNode();
    mustNot.add(clause);
    ObjectNode bool = mapper.createObjectNode();
    bool.set("must_not", mustNot);
    ObjectNode wrapper = mapper.createObjectNode();
    wrapper.set("bool", bool);
    return wrapper;
  }

  private static ObjectNode term(String field, String value) {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    ObjectNode term = mapper.createObjectNode();
    term.put(field, value);
    ObjectNode wrapper = mapper.createObjectNode();
    wrapper.set("term", term);
    return wrapper;
  }

  private static ObjectNode termsClause(String field, List<String> values) {
    return flatTerms(field, values);
  }

  private static ObjectNode existsField(String field) {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    ObjectNode exists = mapper.createObjectNode();
    exists.put("field", field);
    ObjectNode wrapper = mapper.createObjectNode();
    wrapper.set("exists", exists);
    return wrapper;
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> parseHits(Map<String, Object> raw) {
    List<Map<String, Object>> summaries = new ArrayList<>();
    Object hits = raw.get("hits");
    if (hits instanceof Map<?, ?> hitsMap && hitsMap.get("hits") instanceof List<?> hitList) {
      for (Object hit : hitList) {
        Map<String, Object> summary = summarizeHit(hit);
        if (summary != null) {
          summaries.add(summary);
        }
      }
    }
    return summaries;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> summarizeHit(Object hit) {
    Map<String, Object> summary = null;
    if (hit instanceof Map<?, ?> hitMap && hitMap.get("_source") instanceof Map<?, ?> sourceRaw) {
      Map<String, Object> source = (Map<String, Object>) sourceRaw;
      String fqn = string(source.get("fullyQualifiedName"));
      String type = string(source.get("entityType"));
      if (fqn != null && type != null) {
        summary = new LinkedHashMap<>();
        summary.put("type", type);
        summary.put("fqn", fqn);
        summary.put("name", string(source.getOrDefault("name", fqn)));
        putIfPresent(summary, "displayName", source.get("displayName"));
        putIfPresent(summary, UPDATED_AT, source.get(UPDATED_AT));
      }
    }
    return summary;
  }

  private static void putIfPresent(Map<String, Object> target, String key, Object value) {
    if (value != null) {
      target.put(key, value);
    }
  }

  private static int parseTotal(Map<String, Object> raw) {
    int total = 0;
    if (raw.get("hits") instanceof Map<?, ?> hitsMap) {
      Object totalNode = hitsMap.get("total");
      if (totalNode instanceof Map<?, ?> totalMap && totalMap.get("value") instanceof Number n) {
        total = n.intValue();
      } else if (totalNode instanceof Number n) {
        total = n.intValue();
      }
    }
    return total;
  }

  private static Map<String, Integer> tallyByType(List<Map<String, Object>> summaries) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    for (Map<String, Object> summary : summaries) {
      String type = string(summary.get("type"));
      if (type != null) {
        counts.merge(type, 1, Integer::sum);
      }
    }
    return counts;
  }

  private static String string(Object value) {
    return value == null ? null : String.valueOf(value);
  }
}
