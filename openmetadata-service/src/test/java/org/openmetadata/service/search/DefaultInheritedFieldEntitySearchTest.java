package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringReader;
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

    lenient().when(searchRepository.getSearchClient()).thenReturn(mock(SearchClient.class));
    lenient().when(searchRepository.getSearchClient().isClientAvailable()).thenReturn(true);
    lenient().when(searchRepository.getIndexOrAliasName(any())).thenReturn("global_search_alias");
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
  void shouldRespectMaxPageSizeLimit() throws IOException {
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

  @Test
  void shouldUseFallbackWhenSearchIsUnavailable() {
    when(searchRepository.getSearchClient().isClientAvailable()).thenReturn(false);

    InheritedFieldResult result =
        inheritedFieldSearch.getEntitiesForField(
            InheritedFieldQuery.forDomain("fallback", 0, 10),
            () ->
                new InheritedFieldResult(
                    List.of(
                        new org.openmetadata.schema.type.EntityReference().withName("fallback")),
                    1));

    assertEquals(1, result.total());
    assertEquals("fallback", result.entities().getFirst().getName());
  }

  @Test
  @SuppressWarnings("resource")
  void shouldReturnEmptyEntitiesWhenTotalCountIsZero() throws Exception {
    when(searchRepository.search(any(), isNull())).thenReturn(mockESResponse(0, 0));

    InheritedFieldResult result =
        inheritedFieldSearch.getEntitiesForField(
            InheritedFieldQuery.forDomain("empty", 0, 10),
            () -> new InheritedFieldResult(List.of(), 99));

    assertEquals(0, result.total());
    assertTrue(result.entities().isEmpty());
  }

  @Test
  @SuppressWarnings("resource")
  void shouldSkipMissingAndMalformedEntityDocuments() throws Exception {
    String responseBody =
        """
        {
          "hits": {
            "total": 3,
            "hits": [
              {},
              {
                "_source": {
                  "id": "not-a-uuid",
                  "entityType": "table",
                  "name": "broken",
                  "fullyQualifiedName": "svc.db.schema.broken"
                }
              },
              {
                "_source": {
                  "id": "11111111-1111-1111-1111-111111111111",
                  "entityType": "table",
                  "name": "orders",
                  "fullyQualifiedName": "svc.db.schema.orders"
                }
              }
            ]
          }
        }
        """;
    when(searchRepository.search(any(), isNull())).thenReturn(Response.ok(responseBody).build());

    InheritedFieldResult result =
        inheritedFieldSearch.getEntitiesForField(
            InheritedFieldQuery.forDomain("Engineering", 0, 10),
            () -> new InheritedFieldResult(List.of(), 0));

    assertEquals(3, result.total());
    assertEquals(1, result.entities().size());
    assertEquals("orders", result.entities().getFirst().getName());
  }

  @Test
  void shouldUseFallbackCountWhenIndexAliasIsMissing() {
    when(searchRepository.getIndexOrAliasName(any())).thenReturn("");

    Integer count =
        inheritedFieldSearch.getCountForField(InheritedFieldQuery.forTeam("team", 0, 10), () -> 42);

    assertEquals(42, count);
  }

  @Test
  void shouldBuildOwnerQueryFiltersForCountRequests() throws Exception {
    when(searchRepository.search(any(), isNull())).thenReturn(mockESResponse(1, 0));

    inheritedFieldSearch.getCountForField(InheritedFieldQuery.forTeam("team-1", 0, 10), () -> 0);

    verify(searchRepository)
        .search(
            org.mockito.ArgumentMatchers.argThat(
                req ->
                    req.getQueryFilter().contains("\"match\":{\"owners.id\":\"team-1\"}")
                        && req.getSortFieldParam().equals("_score")
                        && req.getSortOrder().equals("desc")),
            isNull());
  }

  @Test
  void shouldBuildUserQueryFiltersForCountRequests() throws Exception {
    when(searchRepository.search(any(), isNull())).thenReturn(mockESResponse(1, 0));

    inheritedFieldSearch.getCountForField(
        InheritedFieldQuery.forUser("user-1", List.of("team-1", "team-2"), 0, 10), () -> 0);

    verify(searchRepository)
        .search(
            org.mockito.ArgumentMatchers.argThat(
                req ->
                    req.getQueryFilter().contains("\"term\":{\"owners.id\":\"user-1\"}")
                        && req.getQueryFilter().contains("\"term\":{\"owners.id\":\"team-1\"}")
                        && req.getQueryFilter().contains("\"term\":{\"owners.id\":\"team-2\"}")),
            isNull());
  }

  @Test
  void shouldBuildGenericQueryFiltersWithCustomSorting() throws Exception {
    when(searchRepository.search(any(), isNull())).thenReturn(mockESResponse(1, 0));

    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("dataProducts.fullyQualifiedName")
            .fieldValue("finance.product")
            .filterType(InheritedFieldEntitySearch.QueryFilterType.GENERIC)
            .sortField("name.keyword")
            .sortOrder("asc")
            .build();

    inheritedFieldSearch.getEntitiesForField(query, () -> new InheritedFieldResult(List.of(), 0));

    verify(searchRepository)
        .search(
            org.mockito.ArgumentMatchers.argThat(
                req ->
                    req.getQueryFilter()
                            .contains("\"dataProducts.fullyQualifiedName\":\"finance.product\"")
                        && req.getSortFieldParam().equals("name.keyword")
                        && req.getSortOrder().equals("asc")),
            isNull());
  }

  @Test
  void shouldAggregateCountsForNestedFields() throws Exception {
    JsonObject response =
        jsonObject(
            """
            {
              "nested_wrapper": {
                "field_aggregation": {
                  "buckets": [
                    {"key": "teamA", "doc_count": 3},
                    {"key": "teamB", "doc_count": 1}
                  ]
                }
              }
            }
            """);
    when(searchRepository.aggregate(any(), any(), any(), any())).thenReturn(response);

    var result =
        inheritedFieldSearch.getAggregatedCountsByField("owners.name", "{\"query\":{}}", 5);

    assertEquals(2, result.size());
    assertEquals(3, result.get("teamA"));
    assertEquals(1, result.get("teamB"));
  }

  @Test
  void shouldAggregateCountsForTopLevelFieldsUsingDefaultSize() throws Exception {
    JsonObject response =
        jsonObject(
            """
            {
              "field_aggregation": {
                "buckets": [
                  {"key": "Tier.Tier1", "doc_count": 7}
                ]
              }
            }
            """);
    when(searchRepository.aggregate(any(), any(), any(), any())).thenReturn(response);

    var result = inheritedFieldSearch.getAggregatedCountsByField("tags.tagFQN", "{\"query\":{}}");

    assertEquals(1, result.size());
    assertEquals(7, result.get("Tier.Tier1"));
  }

  @Test
  void shouldReturnEmptyAggregationWhenSearchUnavailableOrBucketsMissing() throws Exception {
    when(searchRepository.getSearchClient().isClientAvailable()).thenReturn(false);

    assertTrue(
        inheritedFieldSearch.getAggregatedCountsByField("owners.name", "{\"query\":{}}").isEmpty());

    when(searchRepository.getSearchClient().isClientAvailable()).thenReturn(true);
    when(searchRepository.aggregate(any(), any(), any(), any()))
        .thenReturn(jsonObject("{\"field_aggregation\": {}}"));

    assertTrue(
        inheritedFieldSearch
            .getAggregatedCountsByField("owners.name", "{\"query\":{}}", 5)
            .isEmpty());
  }

  @Test
  void shouldBuildInheritedFieldQueriesWithExpectedDefaults() {
    InheritedFieldQuery domain = InheritedFieldQuery.forDomain("domain", 1, 2);
    InheritedFieldQuery tag = InheritedFieldQuery.forTag("tag", 3, 4);
    InheritedFieldQuery dataProduct = InheritedFieldQuery.forDataProduct("product", 5, 6);
    InheritedFieldQuery glossary = InheritedFieldQuery.forGlossaryTerm("term", 7, 8);
    InheritedFieldQuery team = InheritedFieldQuery.forTeam("team", 9, 10);
    InheritedFieldQuery user = InheritedFieldQuery.forUser("user", List.of("team1"), 11, 12);

    assertEquals("domains.fullyQualifiedName", domain.getFieldPath());
    assertTrue(domain.isSupportsHierarchy());
    assertEquals(InheritedFieldEntitySearch.QueryFilterType.DOMAIN_ASSETS, domain.getFilterType());
    assertEquals("tags.tagFQN", tag.getFieldPath());
    assertEquals(InheritedFieldEntitySearch.QueryFilterType.TAG_ASSETS, tag.getFilterType());
    assertEquals("dataProducts.fullyQualifiedName", dataProduct.getFieldPath());
    assertFalse(dataProduct.isIncludeDeleted());
    assertEquals("tags.tagFQN", glossary.getFieldPath());
    assertEquals("owners.id", team.getFieldPath());
    assertEquals(InheritedFieldEntitySearch.QueryFilterType.OWNER_ASSETS, team.getFilterType());
    assertEquals(List.of("user", "team1"), user.getFieldValues());
    assertEquals(11, user.getFrom());
    assertEquals(12, user.getSize());
  }

  @Test
  void shouldRejectInvalidInheritedFieldQueries() {
    var missingFieldPath =
        org.junit.jupiter.api.Assertions.assertThrows(
            IllegalArgumentException.class,
            () -> InheritedFieldQuery.builder().fieldValue("value").build());
    var missingValues =
        org.junit.jupiter.api.Assertions.assertThrows(
            IllegalArgumentException.class,
            () -> InheritedFieldQuery.builder().fieldPath("owners.id").build());

    assertEquals("fieldPath is required", missingFieldPath.getMessage());
    assertEquals("Either fieldValue or fieldValues is required", missingValues.getMessage());
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

    return Response.ok(responseBody).build();
  }

  private JsonObject jsonObject(String json) {
    return Json.createReader(new StringReader(json)).readObject();
  }
}
