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
  void shouldFetchAllAssetsWhenCountBelowBatchSize() throws Exception {
    // Given: A domain with 102 total assets and query.size=100 (the old default that caused bug)
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("domains.fullyQualifiedName")
            .fieldValue("Engineering")
            .filterType(InheritedFieldEntitySearch.QueryFilterType.DOMAIN_ASSETS)
            .size(100) // Old behavior would respect this and return only 100
            .build();

    // ES returns all 102 entities in one batch (since 102 < MAX_PAGE_SIZE=1000)
    Response esResponse = mockESResponse(102, 102);
    when(searchRepository.search(any(), isNull())).thenReturn(esResponse);

    // When: Fetching entities
    InheritedFieldResult result =
        inheritedFieldSearch.getEntitiesForField(
            query, () -> new InheritedFieldResult(List.of(), 0));

    // Then: Should request with MAX_PAGE_SIZE=1000, not query.size=100
    verify(searchRepository)
        .search(
            org.mockito.ArgumentMatchers.argThat(req -> req.getSize() == MAX_PAGE_SIZE), isNull());

    // And: Should return all 102 entities, not just 100
    assertEquals(102, result.total());
    assertEquals(102, result.entities().size());
  }

  @Test
  @SuppressWarnings("resource")
  void shouldPaginateCorrectlyForLargeDataAssets() throws Exception {
    // Given: A domain with 2500 assets requiring 3 batches (1000 + 1000 + 500)
    InheritedFieldQuery query = InheritedFieldQuery.forDomain("LargeDomain");

    Response batch1 = mockESResponse(2500, 1000, 0);
    Response batch2 = mockESResponse(2500, 1000, 1000);
    Response batch3 = mockESResponse(2500, 500, 2000);

    when(searchRepository.search(any(), isNull()))
        .thenReturn(batch1)
        .thenReturn(batch2)
        .thenReturn(batch3);

    // When: Fetching entities
    InheritedFieldResult result =
        inheritedFieldSearch.getEntitiesForField(
            query, () -> new InheritedFieldResult(List.of(), 0));

    // Then: Should make 3 paginated requests with correct from/size parameters
    var inOrder = org.mockito.Mockito.inOrder(searchRepository);

    inOrder
        .verify(searchRepository)
        .search(
            org.mockito.ArgumentMatchers.argThat(
                req -> req.getFrom() == 0 && req.getSize() == 1000),
            isNull());

    inOrder
        .verify(searchRepository)
        .search(
            org.mockito.ArgumentMatchers.argThat(
                req -> req.getFrom() == 1000 && req.getSize() == 1000),
            isNull());

    inOrder
        .verify(searchRepository)
        .search(
            org.mockito.ArgumentMatchers.argThat(
                req -> req.getFrom() == 2000 && req.getSize() == 500),
            isNull());

    // And: Should return all 2500 entities
    assertEquals(2500, result.total());
    assertEquals(2500, result.entities().size());
  }

  @Test
  void shouldUseFallbackWhenSearchFails() throws Exception {
    // Given: Search throws exception
    when(searchRepository.search(any(), isNull())).thenThrow(new RuntimeException("ES down"));

    InheritedFieldQuery query = InheritedFieldQuery.forDomain("TestDomain");

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

    InheritedFieldQuery query = InheritedFieldQuery.forDomain("CountTestDomain");

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
