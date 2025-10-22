package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldResult;

@ExtendWith(MockitoExtension.class)
class DefaultInheritedFieldEntitySearchTest {

  private static final int MAX_PAGE_SIZE = 1000;

  @Mock private SearchRepository searchRepository;
  private DefaultInheritedFieldEntitySearch inheritedFieldSearch;

  @BeforeEach
  void setUp() {
    inheritedFieldSearch = new DefaultInheritedFieldEntitySearch(searchRepository);

    when(searchRepository.getSearchClient()).thenReturn(mock(SearchClient.class));
    when(searchRepository.getSearchClient().isClientAvailable()).thenReturn(true);
    when(searchRepository.getIndexOrAliasName(any())).thenReturn("global_search_alias");
  }

  @Test
  @SuppressWarnings("resource")
  void shouldFetchSinglePageWithRequestedSize() throws Exception {
    // Given: A domain with 500 total assets and query.size=100
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("domains.fullyQualifiedName")
            .fieldValue("Engineering")
            .filterType(InheritedFieldEntitySearch.QueryFilterType.DOMAIN_ASSETS)
            .size(100)
            .from(0)
            .build();

    // ES returns 100 entities for the requested page
    Response esResponse = mockESResponse(500, 100);
    when(searchRepository.search(any(), isNull())).thenReturn(esResponse);

    // When: Fetching entities
    InheritedFieldResult result =
        inheritedFieldSearch.getEntitiesForField(
            query, () -> new InheritedFieldResult(List.of(), 0));

    // Then: Should request with query.size=100 (true pagination)
    verify(searchRepository)
        .search(
            org.mockito.ArgumentMatchers.argThat(req -> req.getSize() == 100 && req.getFrom() == 0),
            isNull());

    // And: Should return the single page with 100 entities
    assertEquals(500, result.total());
    assertEquals(100, result.entities().size());
  }

  @Test
  @SuppressWarnings("resource")
  void shouldRespectMaxPageSizeLimit() throws Exception {
    // Given: A query requesting 2500 entities (exceeds MAX_PAGE_SIZE=1000)
    InheritedFieldQuery query = InheritedFieldQuery.forDomain("LargeDomain", 0, 2500);

    // ES returns 1000 entities (capped at MAX_PAGE_SIZE)
    Response response = mockESResponse(2500, 1000, 0);
    when(searchRepository.search(any(), isNull())).thenReturn(response);

    // When: Fetching entities
    InheritedFieldResult result =
        inheritedFieldSearch.getEntitiesForField(
            query, () -> new InheritedFieldResult(List.of(), 0));

    // Then: Should cap the request at MAX_PAGE_SIZE=1000
    verify(searchRepository)
        .search(
            org.mockito.ArgumentMatchers.argThat(
                req -> req.getFrom() == 0 && req.getSize() == MAX_PAGE_SIZE),
            isNull());

    // And: Should return only the first page with 1000 entities
    assertEquals(2500, result.total());
    assertEquals(1000, result.entities().size());
  }

  @Test
  void shouldUseFallbackWhenSearchFails() throws Exception {
    // Given: Search throws exception
    when(searchRepository.search(any(), isNull())).thenThrow(new RuntimeException("ES down"));

    InheritedFieldQuery query = InheritedFieldQuery.forDomain("TestDomain", 0, 100);

    // When: Fetching entities with fallback (empty list, count 0)
    InheritedFieldResult result =
        inheritedFieldSearch.getEntitiesForField(
            query, () -> new InheritedFieldResult(List.of(), 0));

    // Then: Should return fallback instead of throwing exception
    assertEquals(0, result.total());
    assertEquals(0, result.entities().size());
  }

  @Test
  @SuppressWarnings("resource")
  void shouldReturnCorrectCountWithoutFetchingEntities() throws Exception {
    // Given: Count query for domain with 250 assets
    Response esResponse = mockESResponse(250, 0); // 0 entities in response body (count-only query)
    when(searchRepository.search(any(), isNull())).thenReturn(esResponse);

    InheritedFieldQuery query = InheritedFieldQuery.forDomain("CountTestDomain", 0, 100);

    // When: Getting count
    Integer count = inheritedFieldSearch.getCountForField(query, () -> 0);

    // Then: Should return correct count from ES total
    assertEquals(250, count);
  }

  // Helper methods

  private Response mockESResponse(int total, int entityCount) {
    return mockESResponse(total, entityCount, 0);
  }

  private Response mockESResponse(int total, int entityCount, int fromOffset) {
    StringBuilder hits = new StringBuilder();

    for (int i = 0; i < entityCount; i++) {
      if (i > 0) hits.append(",");

      hits.append(
          String.format(
              """
              {
                "_source": {
                  "id": "%s",
                  "entityType": "table",
                  "name": "table_%d",
                  "fullyQualifiedName": "db.schema.table_%d"
                }
              }
              """,
              java.util.UUID.randomUUID(), fromOffset + i, fromOffset + i));
    }

    String responseBody =
        String.format(
            """
            {
              "hits": {
                "total": { "value": %d },
                "hits": [%s]
              }
            }
            """,
            total, hits);

    Response response = mock(Response.class);
    when(response.getEntity()).thenReturn(responseBody);
    return response;
  }
}
