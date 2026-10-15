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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class SearchRepairScopeTest {
  private static final String QUERY =
      SearchRepairScope.anyFieldEquals(List.of("service.id"), "service-1");
  private static final SearchRepairScope SCOPE =
      new SearchRepairScope(List.of("table_search_index", "dashboard_search_index"), QUERY, 42L);

  @Test
  void documentsRebuiltSinceTheScopeWasRecordedAreLeftAlone() {
    final JsonNode bool = SCOPE.staleDocumentsQuery().path("bool");

    assertEquals(JsonUtils.readTree(QUERY), bool.path("filter").get(0));
    assertEquals(
        42L,
        bool.path("must_not")
            .get(0)
            .path("range")
            .path(SearchVersionGuard.SOURCE_READ_AT)
            .path("gte")
            .asLong());
  }

  @Test
  void anIdMatchesAKeywordFieldOrAKeywordSubField() {
    final JsonNode should = JsonUtils.readTree(QUERY).path("bool").path("should");

    assertEquals("service-1", should.get(0).path("terms").path("service.id").get(0).asText());
    assertEquals(
        "service-1", should.get(1).path("terms").path("service.id.keyword").get(0).asText());
    assertEquals(1, JsonUtils.readTree(QUERY).path("bool").path("minimum_should_match").asInt());
  }

  @Test
  void theSameDocumentsShareOneRetryRowWhicheverTimeTheyWereRecorded() {
    final SearchRepairScope later =
        new SearchRepairScope(SCOPE.indexes(), SCOPE.query(), SCOPE.notRewrittenSince() + 1_000);
    final SearchRepairScope otherService =
        new SearchRepairScope(
            SCOPE.indexes(),
            SearchRepairScope.anyFieldEquals(List.of("service.id"), "service-2"),
            42L);

    assertEquals(SCOPE.retryKey(), later.retryKey());
    assertNotEquals(SCOPE.retryKey(), otherService.retryKey());
  }

  @Test
  void aScopeSurvivesTheRetryQueue() {
    final String recorded =
        SearchIndexRetryQueue.withRepairScope("update-by-query: 3 version conflict(s)", SCOPE);
    final String stored = SearchIndexRetryQueue.preserveRetryContext(recorded, "a later failure");

    assertEquals(SCOPE, SearchIndexRetryQueue.getRepairScope(stored));
    assertEquals("a later failure", SearchIndexRetryQueue.visibleFailureReason(stored));
    assertNull(SearchIndexRetryQueue.getPropagationContext(stored));
  }

  @Test
  void narrowingKeepsTheTargetsAndTheTime() {
    final JsonNode window = JsonUtils.readTree("{\"range\":{\"sourceReadAt\":{\"gte\":10}}}");

    final SearchRepairScope narrowed = SCOPE.narrowedBy(window);

    assertEquals(SCOPE.indexes(), narrowed.indexes());
    assertEquals(SCOPE.notRewrittenSince(), narrowed.notRewrittenSince());
    final JsonNode filters = JsonUtils.readTree(narrowed.query()).path("bool").path("filter");
    assertEquals(JsonUtils.readTree(QUERY), filters.get(0));
    assertEquals(window, filters.get(1));
  }
}
