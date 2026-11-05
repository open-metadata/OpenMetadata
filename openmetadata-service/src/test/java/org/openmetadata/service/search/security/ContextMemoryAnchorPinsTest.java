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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.search.SearchRequest;

class ContextMemoryAnchorPinsTest {

  @Test
  void termAndTermsClausesOnThePrimaryEntityIdPinTheirValues() {
    String filter =
        """
        {"query":{"bool":{
          "must":[{"term":{"primaryEntity.id":"a"}},{"term":{"primaryEntity.id":{"value":"b"}}}],
          "should":[{"terms":{"primaryEntity.id.keyword":["c","d"]}},
                    {"term":{"owners.id":"not-an-anchor"}}]}}}
        """;

    assertEquals(List.of("a", "b", "c", "d"), ContextMemoryAnchorPins.ofQueryFilters(filter));
    assertEquals(
        List.of("a", "b", "c", "d", "e"),
        ContextMemoryAnchorPins.ofQueryFilters(filter, "{\"term\":{\"primaryEntity.id\":\"e\"}}"));
  }

  @Test
  void anAnchorUnderMustNotIsNotAskedFor() {
    String filter =
        """
        {"query":{"bool":{
          "must":[{"term":{"primaryEntity.id":"wanted"}}],
          "must_not":[{"term":{"primaryEntity.id":"excluded"}},
                      {"bool":{"must":[{"term":{"primaryEntity.id":"nested-excluded"}}]}}]}}}
        """;

    assertEquals(List.of("wanted"), ContextMemoryAnchorPins.ofQueryFilters(filter));
  }

  @Test
  void aFilterThatIsAbsentOrNotJsonPinsNothing() {
    assertTrue(ContextMemoryAnchorPins.ofQueryFilters((String) null).isEmpty());
    assertTrue(ContextMemoryAnchorPins.ofQueryFilters("").isEmpty());
    assertTrue(ContextMemoryAnchorPins.ofQueryFilters("{not json").isEmpty());
    assertTrue(ContextMemoryAnchorPins.ofQueryFilters().isEmpty());
  }

  @Test
  void vectorAndHybridRequestsPinThroughTheirFiltersAndTheirQueryFilter() {
    Map<String, List<String>> filters =
        Map.of(ContextMemoryAnchorPins.PINNED_ANCHOR_FILTER, List.of("a"), "owners", List.of("x"));

    assertEquals(
        List.of("a", "b"),
        ContextMemoryAnchorPins.of(filters, "{\"term\":{\"primaryEntity.id\":\"b\"}}"));
    assertTrue(ContextMemoryAnchorPins.of(null, null).isEmpty());
  }

  @Test
  void aSearchRequestPinsThroughItsQueryAndPostFilters() {
    SearchRequest request =
        new SearchRequest()
            .withQueryFilter("{\"term\":{\"primaryEntity.id\":\"q\"}}")
            .withPostFilter("{\"terms\":{\"primaryEntity.id\":[\"p\"]}}");

    assertEquals(List.of("q", "p"), ContextMemoryAnchorPins.of(request));
  }
}
