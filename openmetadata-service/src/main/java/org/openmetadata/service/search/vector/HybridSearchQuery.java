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
package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The requests and the reading of a hybrid search's two legs, each its own search ranked over its
 * whole scope, and each leg's hits folded to one per entity in rank order. A chunk hit names its
 * entity in {@code parentId}, an entity document in {@code id}; every returned hit carries the
 * entity in {@code parentId}.
 */
public final class HybridSearchQuery {

  /** Chunks of one entity can take several of the ranked places before it is folded. */
  static final int CHUNK_OVERFETCH = 3;

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String PARENT_ID = "parentId";
  private static final String ID = "id";

  private HybridSearchQuery() {}

  static String endpoint(final List<String> indexes) {
    return "/" + String.join(",", indexes) + "/_search";
  }

  static String body(final String leg, final int size) {
    try {
      final ObjectNode body = JSON.createObjectNode();
      body.put("size", size * CHUNK_OVERFETCH);
      body.putObject("_source").putArray("excludes").add("embedding").add("columns");
      body.set("query", JSON.readTree(leg));
      return JSON.writeValueAsString(body);
    } catch (JsonProcessingException invalid) {
      throw new IllegalArgumentException("A hybrid search leg is not valid JSON", invalid);
    }
  }

  /** A query any one of {@code queries} satisfies, scored by all of those that match. */
  public static String anyOf(final List<String> queries) {
    try {
      final ObjectNode bool = JSON.createObjectNode();
      final ObjectNode clauses = bool.putObject("bool");
      final ArrayNode should = clauses.putArray("should");
      for (final String query : queries) {
        should.add(JSON.readTree(query));
      }
      clauses.put("minimum_should_match", 1);
      return JSON.writeValueAsString(bool);
    } catch (JsonProcessingException invalid) {
      throw new IllegalArgumentException("A hybrid word query is not valid JSON", invalid);
    }
  }

  /**
   * The word query, held to the same filters as the KNN leg: live documents of the types asked,
   * and the caller's search access filter when there is one.
   */
  static String lexicalLeg(
      final String lexicalQuery,
      final Map<String, List<String>> filters,
      final String accessFilter) {
    try {
      final ObjectNode bool = JSON.createObjectNode();
      final ObjectNode clauses = bool.putObject("bool");
      clauses.putArray("must").add(JSON.readTree(lexicalQuery));
      final ArrayNode filter = clauses.putArray("filter");
      filter.addObject().putObject("term").put("deleted", false);
      filters.forEach(
          (field, values) -> {
            final ArrayNode terms = filter.addObject().putObject("terms").putArray(field);
            values.forEach(terms::add);
          });
      if (accessFilter != null) {
        filter.add(JSON.readTree(accessFilter));
      }
      return JSON.writeValueAsString(bool);
    } catch (JsonProcessingException invalid) {
      throw new IllegalArgumentException("The hybrid word query is not valid JSON", invalid);
    }
  }

  @SuppressWarnings("unchecked")
  static List<Map<String, Object>> entities(final String response, final int size)
      throws JsonProcessingException {
    final Map<String, Map<String, Object>> byEntity = new LinkedHashMap<>();
    for (final JsonNode hit : JSON.readTree(response).path("hits").path("hits")) {
      final Map<String, Object> source = JSON.convertValue(hit.path("_source"), Map.class);
      final Object entity = source.containsKey(PARENT_ID) ? source.get(PARENT_ID) : source.get(ID);
      if (entity != null && byEntity.size() < size) {
        source.put(PARENT_ID, entity);
        source.put("_score", hit.path("_score").asDouble());
        byEntity.putIfAbsent(entity.toString(), source);
      }
    }
    return List.copyOf(byEntity.values());
  }
}
