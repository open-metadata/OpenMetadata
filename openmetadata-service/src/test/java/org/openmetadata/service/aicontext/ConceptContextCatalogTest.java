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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class ConceptContextCatalogTest {
  private final SearchRepository search = mock(SearchRepository.class);
  private final GlossaryTerm term = new GlossaryTerm().withFullyQualifiedName("Business.Amount");
  private SearchRepository previousSearch;

  @BeforeEach
  void setUp() {
    previousSearch = Entity.getSearchRepository();
    Entity.setSearchRepository(search);
    when(search.getIndexOrAliasName(Entity.TABLE)).thenReturn("table_search_index");
  }

  @AfterEach
  void tearDown() {
    Entity.setSearchRepository(previousSearch);
  }

  @Test
  void followsSearchCursorsBeyondTheFirstCandidatePage() throws IOException {
    when(search.search(any(SearchRequest.class), isNull()))
        .thenAnswer(
            invocation -> {
              SearchRequest request = invocation.getArgument(0);
              List<Object> cursor = request.getSearchAfter();
              int start =
                  cursor == null || cursor.isEmpty()
                      ? 0
                      : Integer.parseInt(cursor.getFirst().toString()) + 1;
              return response(
                  IntStream.range(start, Math.min(start + request.getSize(), 101))
                      .mapToObj(index -> hit(index, true))
                      .toList());
            });
    ConceptContextCatalog catalog = catalog();

    var first = catalog.candidates(term, 0);
    var second = catalog.candidates(term, first.nextOffset());

    assertEquals(100, first.references().size());
    assertTrue(first.hasMore());
    assertEquals(101, second.nextOffset());
    assertFalse(second.hasMore());
    assertEquals("svc.db.schema.table100", second.references().getFirst().getFullyQualifiedName());
  }

  @Test
  void doesNotReportCompleteTotalsWithoutARequiredCursor() throws IOException {
    when(search.search(any(SearchRequest.class), isNull()))
        .thenReturn(
            response(IntStream.range(0, 100).mapToObj(index -> hit(index, false)).toList()));

    IllegalStateException error =
        assertThrows(IllegalStateException.class, () -> catalog().candidates(term, 0));

    assertTrue(error.getMessage().contains("Missing search cursor"));
    assertTrue(error.getMessage().contains(term.getFullyQualifiedName()));
  }

  @Test
  void propagatesSearchAvailabilityFailuresInsteadOfReturningEmptyBindings() throws IOException {
    when(search.search(any(SearchRequest.class), isNull()))
        .thenThrow(new IOException("Search unavailable"));

    UncheckedIOException error =
        assertThrows(UncheckedIOException.class, () -> catalog().candidates(term, 0));

    assertEquals("Search unavailable", error.getCause().getMessage());
    assertTrue(error.getMessage().contains(term.getFullyQualifiedName()));
  }

  @Test
  void advancesPastHitsWithIncompleteIdentity() throws IOException {
    when(search.search(any(SearchRequest.class), isNull()))
        .thenReturn(
            response(List.of(Map.of("_source", Map.of("entityType", Entity.TABLE)), hit(1, true))));

    var page = catalog().candidates(term, 0);

    assertEquals(2, page.nextOffset());
    assertFalse(page.hasMore());
    assertEquals(1, page.references().size());
    assertEquals("svc.db.schema.table1", page.references().getFirst().getFullyQualifiedName());
  }

  @Test
  void keepsModeBGlossaryRoutingOnTheSharedTagSearch() throws IOException {
    when(search.getIndexOrAliasName(GLOBAL_SEARCH_ALIAS)).thenReturn(GLOBAL_SEARCH_ALIAS);
    when(search.search(any(SearchRequest.class), isNull()))
        .thenReturn(response(List.of(hit(1, true))));
    Map<String, KnowledgeItem> items = new LinkedHashMap<>();
    Map<String, AIContextFinder.CandidateAsset> candidates = new LinkedHashMap<>();

    new AIContextFinder()
        .collectHit(
            Map.of(
                "entityType",
                Entity.GLOSSARY_TERM,
                "fullyQualifiedName",
                term.getFullyQualifiedName(),
                "description",
                "An amount stored in cents."),
            items,
            candidates);

    assertEquals(1, items.size());
    assertEquals(1, candidates.size());
    var candidate = candidates.values().iterator().next();
    assertEquals("svc.db.schema.table1", candidate.fullyQualifiedName());
    assertEquals(term.getFullyQualifiedName(), candidate.via());
  }

  private ConceptContextCatalog catalog() {
    return new ConceptContextCatalog(null, null, table -> null, table -> null);
  }

  private static Map<String, Object> hit(int index, boolean includeCursor) {
    Map<String, Object> source =
        Map.of("fullyQualifiedName", "svc.db.schema.table" + index, "entityType", Entity.TABLE);
    return includeCursor
        ? Map.of("_source", source, "sort", List.of(String.format("%03d", index)))
        : Map.of("_source", source);
  }

  private static Response response(List<?> hits) {
    return Response.ok(JsonUtils.pojoToJson(Map.of("hits", Map.of("hits", hits)))).build();
  }
}
