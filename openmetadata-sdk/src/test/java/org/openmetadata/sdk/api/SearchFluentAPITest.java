package org.openmetadata.sdk.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.search.SearchAPI;

/**
 * Tests for Search fluent API operations.
 * Verifies the new fluent builder pattern for search, suggest, and aggregate functionality.
 */
public class SearchFluentAPITest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private SearchAPI mockSearchAPI;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.search()).thenReturn(mockSearchAPI);
    Search.setDefaultClient(mockClient);
  }

  @Test
  void testBasicSearch() throws Exception {
    // Arrange
    String query = "test query";
    String expectedResult = "{\"hits\":[{\"id\":\"1\",\"name\":\"test_table\"}]}";
    when(mockSearchAPI.search(eq(query), isNull(), eq(0), eq(10), isNull(), eq("desc")))
        .thenReturn(expectedResult);

    // Act
    Search.SearchResults result = Search.query(query).execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockSearchAPI).search(eq(query), isNull(), eq(0), eq(10), isNull(), eq("desc"));
  }

  @Test
  void testSearchWithIndex() throws Exception {
    // Arrange
    String query = "test query";
    String index = "table_search_index";
    String expectedResult = "{\"hits\":[{\"id\":\"1\",\"name\":\"test_table\"}]}";
    when(mockSearchAPI.search(eq(query), eq(index), eq(0), eq(10), isNull(), eq("desc")))
        .thenReturn(expectedResult);

    // Act
    Search.SearchResults result = Search.query(query).in(index).execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockSearchAPI).search(eq(query), eq(index), eq(0), eq(10), isNull(), eq("desc"));
  }

  @Test
  void testSearchWithPagination() throws Exception {
    // Arrange
    String query = "test query";
    String index = "table_search_index";
    Integer from = 20;
    Integer size = 50;
    String sortField = "name";
    String expectedResult = "{\"hits\":[{\"id\":\"1\",\"name\":\"test_table\"}],\"total\":100}";

    when(mockSearchAPI.search(eq(query), eq(index), eq(from), eq(size), eq(sortField), eq("asc")))
        .thenReturn(expectedResult);

    // Act
    Search.SearchResults result =
        Search.query(query)
            .in(index)
            .from(from)
            .limit(size)
            .sortBy(sortField, Search.SortOrder.ASC)
            .execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockSearchAPI)
        .search(eq(query), eq(index), eq(from), eq(size), eq(sortField), eq("asc"));
  }

  @Test
  void testSearchWithMultipleFilters() throws Exception {
    // Arrange
    String query = "sales*";
    String index1 = "table_search_index";
    String index2 = "dashboard_search_index";
    String expectedResult = "{\"hits\":[]}";

    when(mockSearchAPI.search(
            eq(query),
            eq("table_search_index,dashboard_search_index"),
            eq(0),
            eq(20),
            eq("name"),
            eq("asc")))
        .thenReturn(expectedResult);

    // Act
    Search.SearchResults result =
        Search.query(query)
            .in(index1, index2)
            .filter("database.name", "production")
            .filter("tier", "Gold")
            .sortBy("name", Search.SortOrder.ASC)
            .limit(20)
            .execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
  }

  @Test
  void testSuggest() throws Exception {
    // Arrange
    String prefix = "tab";
    String expectedResult = "{\"suggestions\":[\"table\",\"tableau\",\"tab_view\"]}";
    when(mockSearchAPI.suggest(eq(prefix), isNull(), eq(5))).thenReturn(expectedResult);

    // Act
    Search.SuggestionResults result = Search.suggest(prefix).execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockSearchAPI).suggest(eq(prefix), isNull(), eq(5));
  }

  @Test
  void testSuggestWithIndex() throws Exception {
    // Arrange
    String prefix = "tab";
    String index = "table_search_index";
    String expectedResult = "{\"suggestions\":[\"table\",\"table_1\",\"table_2\"]}";
    when(mockSearchAPI.suggest(eq(prefix), eq(index), eq(5))).thenReturn(expectedResult);

    // Act
    Search.SuggestionResults result = Search.suggest(prefix).in(index).execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockSearchAPI).suggest(eq(prefix), eq(index), eq(5));
  }

  @Test
  void testSuggestWithCustomLimit() throws Exception {
    // Arrange
    String prefix = "tab";
    String index = "table_search_index";
    Integer limit = 10;
    String expectedResult = "{\"suggestions\":[\"table\",\"table_1\"]}";
    when(mockSearchAPI.suggest(eq(prefix), eq(index), eq(limit))).thenReturn(expectedResult);

    // Act
    Search.SuggestionResults result = Search.suggest(prefix).in(index).limit(limit).execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockSearchAPI).suggest(eq(prefix), eq(index), eq(limit));
  }

  @Test
  void testAggregate() throws Exception {
    // Arrange
    String query = "*";
    String index = "table_search_index";
    String field = "tags.tagFQN";
    String expectedResult = "{\"aggregations\":{\"by_tags\":{\"buckets\":[]}}}";
    when(mockSearchAPI.aggregate(eq(query), eq(index), eq(field))).thenReturn(expectedResult);

    // Act
    Search.AggregationResults result =
        Search.aggregate().query(query).in(index).aggregateBy(field).execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockSearchAPI).aggregate(eq(query), eq(index), eq(field));
  }

  @Test
  void testAggregateWithMultipleFields() throws Exception {
    // Arrange
    String query = "*";
    String index = "table_search_index";
    String expectedResult = "{\"aggregations\":{}}";
    when(mockSearchAPI.aggregate(eq(query), eq(index), eq("tags.tagFQN,tier")))
        .thenReturn(expectedResult);

    // Act
    Search.AggregationResults result =
        Search.aggregate()
            .query(query)
            .in(index)
            .aggregateBy("tags.tagFQN")
            .aggregateBy("tier")
            .execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockSearchAPI).aggregate(eq(query), eq(index), eq("tags.tagFQN,tier"));
  }

  @Test
  void testFacetedSearch() throws Exception {
    // Arrange
    String query = "order";
    String expectedResult = "{\"facets\":{}}";
    when(mockSearchAPI.searchAdvanced(any())).thenReturn(expectedResult);

    // Act
    Search.FacetedSearchResults result =
        Search.faceted()
            .query(query)
            .facet("database", 10)
            .facet("service", 5)
            .facet("tier", 5)
            .execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result.getRaw());
    verify(mockSearchAPI).searchAdvanced(any());
  }

  @Test
  void testReindex() throws Exception {
    // Arrange
    String entityType = "table";
    String expectedResult = "{\"status\":\"reindexing\"}";
    when(mockSearchAPI.reindex(entityType)).thenReturn(expectedResult);

    // Act
    String result = Search.reindex().entity(entityType).execute();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result);
    verify(mockSearchAPI).reindex(entityType);
  }

  @Test
  void testReindexAll() throws Exception {
    // Arrange
    String expectedResult = "{\"status\":\"reindexing all\"}";
    when(mockSearchAPI.reindexAll()).thenReturn(expectedResult);

    // Act
    String result = Search.reindex().all();

    // Assert
    assertNotNull(result);
    assertEquals(expectedResult, result);
    verify(mockSearchAPI).reindexAll();
  }

  @Test
  void testSearchWithoutClient() {
    // Reset client to null
    Search.setDefaultClient(null);

    // Act & Assert
    assertThrows(IllegalStateException.class, () -> Search.query("query"));
    assertThrows(IllegalStateException.class, () -> Search.suggest("prefix"));
    assertThrows(IllegalStateException.class, () -> Search.aggregate());
    assertThrows(IllegalStateException.class, () -> Search.faceted());
    assertThrows(IllegalStateException.class, () -> Search.reindex());
  }
}
