package org.openmetadata.sdk.api;

import java.util.*;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Search operations.
 *
 * <p>This provides a builder-style fluent interface for searching OpenMetadata entities.
 *
 * <p>Usage Examples:
 *
 * <pre>
 * // Simple search
 * var results = Search.query("customer")
 *     .in("table_search_index")
 *     .limit(10)
 *     .execute();
 *
 * // Advanced search with filters
 * var results = Search.query("sales*")
 *     .in("table_search_index", "dashboard_search_index")
 *     .filter("database.name", "production")
 *     .filter("tier", "Gold")
 *     .sortBy("name", SortOrder.ASC)
 *     .from(0)
 *     .limit(20)
 *     .includeDeleted(false)
 *     .execute();
 *
 * // Aggregation search
 * var aggregations = Search.aggregate()
 *     .query("*")
 *     .in("table_search_index")
 *     .aggregateBy("tags.tagFQN")
 *     .aggregateBy("tier")
 *     .size(100)
 *     .execute();
 *
 * // Suggest/Autocomplete
 * var suggestions = Search.suggest("cust")
 *     .in("table_search_index")
 *     .limit(5)
 *     .execute();
 * </pre>
 */
public final class Search {
  private static OpenMetadataClient defaultClient;

  private Search() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Search.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Search Builders ====================

  public static SearchBuilder query(String query) {
    return new SearchBuilder(getClient(), query);
  }

  public static SearchBuilder search() {
    return new SearchBuilder(getClient(), "*");
  }

  public static AggregationBuilder aggregate() {
    return new AggregationBuilder(getClient());
  }

  public static SuggestBuilder suggest(String prefix) {
    return new SuggestBuilder(getClient(), prefix);
  }

  public static FacetedSearchBuilder faceted() {
    return new FacetedSearchBuilder(getClient());
  }

  // ==================== Reindex Operations ====================

  public static ReindexOperation reindex() {
    return new ReindexOperation(getClient());
  }

  // ==================== Search Builder ====================

  public static class SearchBuilder {
    private final OpenMetadataClient client;
    private final String query;
    private final Set<String> indices = new HashSet<>();
    private final Map<String, Object> filters = new HashMap<>();
    private Integer from = 0;
    private Integer size = 10;
    private String sortField;
    private SortOrder sortOrder = SortOrder.DESC;
    private boolean includeDeleted = false;
    private final List<String> fields = new ArrayList<>();

    SearchBuilder(OpenMetadataClient client, String query) {
      this.client = client;
      this.query = query;
    }

    public SearchBuilder in(String... indices) {
      this.indices.addAll(Arrays.asList(indices));
      return this;
    }

    public SearchBuilder filter(String field, Object value) {
      filters.put(field, value);
      return this;
    }

    public SearchBuilder from(int offset) {
      this.from = offset;
      return this;
    }

    public SearchBuilder limit(int limit) {
      this.size = limit;
      return this;
    }

    public SearchBuilder sortBy(String field) {
      this.sortField = field;
      return this;
    }

    public SearchBuilder sortBy(String field, SortOrder order) {
      this.sortField = field;
      this.sortOrder = order;
      return this;
    }

    public SearchBuilder includeDeleted(boolean include) {
      this.includeDeleted = include;
      return this;
    }

    public SearchBuilder fields(String... fields) {
      this.fields.addAll(Arrays.asList(fields));
      return this;
    }

    public SearchResults execute() {
      String indexStr = indices.isEmpty() ? null : String.join(",", indices);

      // Use the new fluent API from services.search.SearchAPI
      var searchBuilder = client.search().query(query);

      if (indexStr != null) {
        searchBuilder.index(indexStr);
      }
      searchBuilder.from(from).size(size);

      if (sortField != null) {
        searchBuilder.sortBy(sortField, sortOrder.toString().toLowerCase());
      }

      searchBuilder.deleted(includeDeleted);

      String result = searchBuilder.execute();
      return new SearchResults(result, client);
    }

    public void forEach(java.util.function.Consumer<SearchResult> action) {
      SearchResults results = execute();
      results.forEach(action);
    }
  }

  // ==================== Aggregation Builder ====================

  public static class AggregationBuilder {
    private final OpenMetadataClient client;
    private String query = "*";
    private final Set<String> indices = new HashSet<>();
    private final List<String> aggregateFields = new ArrayList<>();
    private Integer size = 10;

    AggregationBuilder(OpenMetadataClient client) {
      this.client = client;
    }

    public AggregationBuilder query(String query) {
      this.query = query;
      return this;
    }

    public AggregationBuilder in(String... indices) {
      this.indices.addAll(Arrays.asList(indices));
      return this;
    }

    public AggregationBuilder aggregateBy(String field) {
      aggregateFields.add(field);
      return this;
    }

    public AggregationBuilder size(int size) {
      this.size = size;
      return this;
    }

    public AggregationResults execute() {
      String indexStr = indices.isEmpty() ? null : String.join(",", indices);
      String fieldStr = aggregateFields.isEmpty() ? null : aggregateFields.get(0);

      // Use the new fluent API
      var aggBuilder = client.search().aggregate(query);
      if (indexStr != null) {
        aggBuilder.index(indexStr);
      }
      if (fieldStr != null) {
        aggBuilder.field(fieldStr);
      }

      String result = aggBuilder.execute();
      return new AggregationResults(result);
    }
  }

  // ==================== Suggest Builder ====================

  public static class SuggestBuilder {
    private final OpenMetadataClient client;
    private final String prefix;
    private final Set<String> indices = new HashSet<>();
    private final List<String> fields = new ArrayList<>();
    private Integer size = 5;

    SuggestBuilder(OpenMetadataClient client, String prefix) {
      this.client = client;
      this.prefix = prefix;
    }

    public SuggestBuilder in(String... indices) {
      this.indices.addAll(Arrays.asList(indices));
      return this;
    }

    public SuggestBuilder field(String field) {
      fields.add(field);
      return this;
    }

    public SuggestBuilder limit(int limit) {
      this.size = limit;
      return this;
    }

    public SuggestionResults execute() {
      String indexStr = indices.isEmpty() ? null : String.join(",", indices);

      // Use the new fluent API
      var suggestBuilder = client.search().suggest(prefix);
      if (indexStr != null) {
        suggestBuilder.index(indexStr);
      }
      suggestBuilder.size(size);

      String result = suggestBuilder.execute();
      return new SuggestionResults(result);
    }
  }

  // ==================== Faceted Search Builder ====================

  public static class FacetedSearchBuilder {
    private final OpenMetadataClient client;
    private String query = "*";
    private final Map<String, Integer> facets = new LinkedHashMap<>();
    private final Map<String, Object> filters = new HashMap<>();

    FacetedSearchBuilder(OpenMetadataClient client) {
      this.client = client;
    }

    public FacetedSearchBuilder query(String query) {
      this.query = query;
      return this;
    }

    public FacetedSearchBuilder facet(String field, int size) {
      facets.put(field, size);
      return this;
    }

    public FacetedSearchBuilder filter(String field, Object value) {
      filters.put(field, value);
      return this;
    }

    public FacetedSearchResults execute() {
      Map<String, Object> request = new HashMap<>();
      request.put("query", query);
      request.put("facets", facets);
      request.put("filters", filters);

      // Use the new fluent API
      String result = client.search().advanced(request);
      return new FacetedSearchResults(result);
    }
  }

  // ==================== Reindex Operation ====================

  public static class ReindexOperation {
    private final OpenMetadataClient client;
    private String entityType;

    ReindexOperation(OpenMetadataClient client) {
      this.client = client;
    }

    public ReindexOperation entity(String entityType) {
      this.entityType = entityType;
      return this;
    }

    public String execute() {
      if (entityType != null) {
        return client.search().reindex(entityType);
      } else {
        return client.search().reindexAll();
      }
    }

    public String all() {
      return client.search().reindexAll();
    }
  }

  // ==================== Result Classes ====================

  public static class SearchResults {
    private final String rawResults;
    private final OpenMetadataClient client;

    SearchResults(String rawResults, OpenMetadataClient client) {
      this.rawResults = rawResults;
      this.client = client;
    }

    public String getRaw() {
      return rawResults;
    }

    public void forEach(java.util.function.Consumer<SearchResult> action) {
      // Parse results and iterate
    }

    public int getTotalCount() {
      return 0;
    }

    public List<SearchResult> getResults() {
      return new ArrayList<>();
    }
  }

  public static class SearchResult {
    private final Map<String, Object> data;

    SearchResult(Map<String, Object> data) {
      this.data = data;
    }

    public String getId() {
      return (String) data.get("id");
    }

    public String getName() {
      return (String) data.get("name");
    }

    public String getEntityType() {
      return (String) data.get("entityType");
    }

    public Object get(String field) {
      return data.get(field);
    }
  }

  public static class AggregationResults {
    private final String rawResults;

    AggregationResults(String rawResults) {
      this.rawResults = rawResults;
    }

    public String getRaw() {
      return rawResults;
    }

    public Map<String, List<BucketResult>> getBuckets() {
      return new HashMap<>();
    }
  }

  public static class BucketResult {
    private final String key;
    private final long count;

    BucketResult(String key, long count) {
      this.key = key;
      this.count = count;
    }

    public String getKey() {
      return key;
    }

    public long getCount() {
      return count;
    }
  }

  public static class SuggestionResults {
    private final String rawResults;

    SuggestionResults(String rawResults) {
      this.rawResults = rawResults;
    }

    public String getRaw() {
      return rawResults;
    }

    public List<String> getSuggestions() {
      return new ArrayList<>();
    }
  }

  public static class FacetedSearchResults {
    private final String rawResults;

    FacetedSearchResults(String rawResults) {
      this.rawResults = rawResults;
    }

    public String getRaw() {
      return rawResults;
    }

    public SearchResults getResults() {
      return null;
    }

    public Map<String, List<FacetValue>> getFacets() {
      return new HashMap<>();
    }
  }

  public static class FacetValue {
    private final String value;
    private final long count;

    FacetValue(String value, long count) {
      this.value = value;
      this.count = count;
    }

    public String getValue() {
      return value;
    }

    public long getCount() {
      return count;
    }
  }

  // ==================== Enums ====================

  public enum SortOrder {
    ASC,
    DESC
  }
}
