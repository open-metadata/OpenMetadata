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

package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;

class InPlaceIndexSweepTest {
  private static final long RUN_START = 1_700_000_000_000L;
  private static final String INDEX = "dashboard_search_index";
  private static final String POST = "POST";

  private final SearchClient searchClient = mock(SearchClient.class);

  @Test
  void removesOnlyTheDocumentsWhoseRowsAreGone() throws IOException {
    when(searchClient.rawSearchRequest(any(), anyString(), any())).thenReturn(ok("{}"));
    when(searchClient.rawSearchRequest(eq(POST), startsWith("/" + INDEX + "/_search"), anyString()))
        .thenReturn(ok(page("scroll-1", "kept-a", "gone", "kept-b")));
    when(searchClient.rawSearchRequest(eq(POST), eq("/_search/scroll"), anyString()))
        .thenReturn(ok(page("scroll-1")));
    when(searchClient.rawSearchRequest(
            eq(POST), startsWith("/" + INDEX + "/_delete_by_query"), anyString()))
        .thenReturn(ok("{\"deleted\":1}"));
    final InPlaceIndexSweep sweep =
        new InPlaceIndexSweep(
            new RawIndexOperations(searchClient),
            entityType -> Optional.of(ids -> List.of("kept-a", "kept-b")),
            null);

    final long removed = sweep.removeOrphans(Entity.DASHBOARD, INDEX, RUN_START);

    assertEquals(1, removed);
    assertEquals(List.of("gone"), deletedIds());
  }

  @Test
  void indexesWithoutRowIdsAreLeftAlone() throws IOException {
    final InPlaceIndexSweep sweep =
        new InPlaceIndexSweep(
            new RawIndexOperations(searchClient), InPlaceIndexSweep::databaseRows, null);

    assertEquals(0, sweep.removeOrphans("entityReportData", INDEX, RUN_START));
    verifyNoInteractions(searchClient);
  }

  @Test
  void onlyDocumentsTheRunDidNotRewriteAreCandidates() {
    final String query = InPlaceIndexSweep.untouchedSince(RUN_START).toString();

    assertTrue(query.contains("{\"range\":{\"sourceReadAt\":{\"lt\":" + RUN_START + "}}}"));
    assertTrue(query.contains("{\"exists\":{\"field\":\"sourceReadAt\"}}"));
    assertFalse(
        query.contains("updatedAt"),
        "updatedAt is mapped as epoch seconds and cannot be compared with a time in millis");
  }

  private List<String> deletedIds() throws IOException {
    final ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
    verify(searchClient)
        .rawSearchRequest(eq(POST), startsWith("/" + INDEX + "/_delete_by_query"), body.capture());
    final List<String> ids = new ArrayList<>();
    JsonUtils.readTree(body.getValue())
        .path("query")
        .path("ids")
        .path("values")
        .forEach(id -> ids.add(id.asText()));
    return ids;
  }

  private static RawSearchResponse ok(final String body) {
    return new RawSearchResponse(200, body);
  }

  private static String page(final String scrollId, final String... ids) {
    final ObjectNode response = JsonUtils.getObjectNode();
    response.put("_scroll_id", scrollId);
    final ArrayNode hits = response.putObject("hits").putArray("hits");
    for (final String id : ids) {
      hits.addObject().put("_id", id);
    }
    return response.toString();
  }
}
