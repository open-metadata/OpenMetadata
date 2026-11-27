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

package org.openmetadata.service.search.security;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The memory anchors a search names, which {@link ContextMemorySearchVisibility} evaluates once by
 * the REST rule (ADR:2026-10-09-search-admits-memories-of-pinned-anchors). They are only a hint of
 * which anchors to evaluate, never a grant, so a pin in a clause the query does not filter on cannot
 * widen anything. A pin under {@code must_not} is skipped: it excludes the anchor rather than asking
 * for it, and evaluating it would spend the cap on an anchor the query can never return.
 */
@Slf4j
public final class ContextMemoryAnchorPins {

  /** The filter key vector and hybrid search callers pin a memory anchor with. */
  public static final String PINNED_ANCHOR_FILTER = "primaryEntityId";

  /** The memory document field a query DSL filter pins an anchor on. */
  public static final String FIELD_PRIMARY_ENTITY_ID = "primaryEntity.id";

  private static final Set<String> PINNING_FIELDS =
      Set.of(FIELD_PRIMARY_ENTITY_ID, FIELD_PRIMARY_ENTITY_ID + ".keyword");
  private static final String TERM = "term";
  private static final String TERMS = "terms";
  private static final String VALUE = "value";
  private static final String MUST_NOT = "must_not";

  private ContextMemoryAnchorPins() {}

  /** The anchors a search request pins through its query filter or its post filter. */
  public static List<String> of(SearchRequest request) {
    return ofQueryFilters(request.getQueryFilter(), request.getPostFilter());
  }

  /** The anchors a vector or hybrid request pins through its filters or its query filter. */
  public static List<String> of(Map<String, List<String>> filters, String queryFilter) {
    List<String> anchorIds =
        new ArrayList<>(
            filters == null ? List.of() : listOrEmpty(filters.get(PINNED_ANCHOR_FILTER)));
    anchorIds.addAll(ofQueryFilters(queryFilter));
    return anchorIds;
  }

  /**
   * The anchors query DSL filters pin: the values of their {@code term} and {@code terms} clauses on
   * {@code primaryEntity.id}, outside any {@code must_not}. A filter that does not parse pins
   * nothing.
   */
  public static List<String> ofQueryFilters(String... queryFilters) {
    List<String> anchorIds = new ArrayList<>();
    for (String queryFilter : queryFilters) {
      collect(queryFilter, anchorIds);
    }
    return anchorIds;
  }

  private static void collect(String queryFilter, List<String> anchorIds) {
    if (!nullOrEmpty(queryFilter)) {
      try {
        collect(JsonUtils.readTree(queryFilter), anchorIds);
      } catch (JsonParsingException e) {
        LOG.debug("Query filter pins no memory anchor: it is not JSON", e);
      }
    }
  }

  private static void collect(JsonNode node, List<String> anchorIds) {
    if (node != null && node.isObject()) {
      collectPinnedValues(node.get(TERM), anchorIds);
      collectPinnedValues(node.get(TERMS), anchorIds);
      node.properties().stream()
          .filter(field -> !MUST_NOT.equals(field.getKey()))
          .forEach(field -> collect(field.getValue(), anchorIds));
    } else if (node != null && node.isArray()) {
      node.forEach(child -> collect(child, anchorIds));
    }
  }

  private static void collectPinnedValues(JsonNode clause, List<String> anchorIds) {
    if (clause != null && clause.isObject()) {
      for (String field : PINNING_FIELDS) {
        JsonNode value = clause.get(field);
        JsonNode pinned = value != null && value.isObject() ? value.get(VALUE) : value;
        if (pinned != null && pinned.isArray()) {
          pinned.forEach(element -> addTextual(element, anchorIds));
        } else {
          addTextual(pinned, anchorIds);
        }
      }
    }
  }

  private static void addTextual(JsonNode value, List<String> anchorIds) {
    if (value != null && value.isTextual()) {
      anchorIds.add(value.asText());
    }
  }
}
