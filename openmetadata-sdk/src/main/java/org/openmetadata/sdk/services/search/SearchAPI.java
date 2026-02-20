package org.openmetadata.sdk.services.search;

import java.util.Map;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

public class SearchAPI {
  private final HttpClient httpClient;

  public SearchAPI(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Start a fluent search query builder.
   *
   * <p>Example usage:
   * <pre>{@code
   * String result = client.search()
   *     .query("*")
   *     .index("table_search_index")
   *     .from(0)
   *     .size(10)
   *     .sortBy("name.keyword", "asc")
   *     .includeAggregations()
   *     .execute();
   * }</pre>
   */
  public SearchBuilder query(String query) {
    return new SearchBuilder(httpClient).query(query);
  }

  /**
   * Start a fluent suggest query builder.
   *
   * <p>Example usage:
   * <pre>{@code
   * String result = client.search()
   *     .suggest("tab")
   *     .index("table_search_index")
   *     .size(5)
   *     .execute();
   * }</pre>
   */
  public SuggestBuilder suggest(String query) {
    return new SuggestBuilder(httpClient).query(query);
  }

  /**
   * Start a fluent entity type counts query builder.
   *
   * <p>Example usage:
   * <pre>{@code
   * String result = client.search()
   *     .entityTypeCounts()
   *     .query("*")
   *     .index("dataAsset")
   *     .execute();
   * }</pre>
   */
  public EntityTypeCountsBuilder entityTypeCounts() {
    return new EntityTypeCountsBuilder(httpClient);
  }

  /**
   * Start a fluent aggregate query builder.
   */
  public AggregateBuilder aggregate(String query) {
    return new AggregateBuilder(httpClient).query(query);
  }

  /**
   * Execute an advanced search with a custom request body.
   */
  public String advanced(Map<String, Object> searchRequest) throws OpenMetadataException {
    return httpClient.executeForString(HttpMethod.POST, "/v1/search/query", searchRequest);
  }

  /**
   * Reindex a specific entity type.
   */
  public String reindex(String entityType) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParam("entityType", entityType).build();
    return httpClient.executeForString(HttpMethod.POST, "/v1/search/reindex", null, options);
  }

  /**
   * Reindex all entities.
   */
  public String reindexAll() throws OpenMetadataException {
    return httpClient.executeForString(HttpMethod.POST, "/v1/search/reindex/all", null);
  }

  // ===================================================================
  // FLUENT BUILDERS
  // ===================================================================

  /** Fluent builder for search queries. */
  public static class SearchBuilder {
    private final HttpClient httpClient;
    private String query;
    private String index;
    private Integer from;
    private Integer size;
    private String sortField;
    private String sortOrder;
    private Boolean includeAggregations;
    private Boolean deleted;
    private String queryFilter;
    private String postFilter;
    private Boolean trackTotalHits;

    SearchBuilder(HttpClient httpClient) {
      this.httpClient = httpClient;
    }

    /** Set the search query. */
    public SearchBuilder query(String query) {
      this.query = query;
      return this;
    }

    /** Set the search index (e.g., "table_search_index", "dataAsset"). */
    public SearchBuilder index(String index) {
      this.index = index;
      return this;
    }

    /** Set the starting offset for pagination. */
    public SearchBuilder from(int from) {
      this.from = from;
      return this;
    }

    /** Set the page size. */
    public SearchBuilder size(int size) {
      this.size = size;
      return this;
    }

    /** Set pagination using page number and size. */
    public SearchBuilder page(int pageNumber, int pageSize) {
      this.from = pageNumber * pageSize;
      this.size = pageSize;
      return this;
    }

    /** Set the sort field. */
    public SearchBuilder sortBy(String field) {
      this.sortField = field;
      return this;
    }

    /** Set the sort field and order. */
    public SearchBuilder sortBy(String field, String order) {
      this.sortField = field;
      this.sortOrder = order;
      return this;
    }

    /** Sort ascending by field. */
    public SearchBuilder sortAsc(String field) {
      this.sortField = field;
      this.sortOrder = "asc";
      return this;
    }

    /** Sort descending by field. */
    public SearchBuilder sortDesc(String field) {
      this.sortField = field;
      this.sortOrder = "desc";
      return this;
    }

    /** Include aggregations in response. */
    public SearchBuilder includeAggregations() {
      this.includeAggregations = true;
      return this;
    }

    /** Set whether to include aggregations. */
    public SearchBuilder includeAggregations(boolean include) {
      this.includeAggregations = include;
      return this;
    }

    /** Include deleted entities in search. */
    public SearchBuilder includeDeleted() {
      this.deleted = true;
      return this;
    }

    /** Set whether to include deleted entities. */
    public SearchBuilder deleted(boolean deleted) {
      this.deleted = deleted;
      return this;
    }

    /** Set a query filter (JSON format). */
    public SearchBuilder queryFilter(String filter) {
      this.queryFilter = filter;
      return this;
    }

    /** Set a post filter (JSON format). */
    public SearchBuilder postFilter(String filter) {
      this.postFilter = filter;
      return this;
    }

    /** Track total hits accurately. */
    public SearchBuilder trackTotalHits() {
      this.trackTotalHits = true;
      return this;
    }

    /** Execute the search and return raw JSON response. */
    public String execute() throws OpenMetadataException {
      RequestOptions.Builder optionsBuilder = RequestOptions.builder();

      if (query != null) optionsBuilder.queryParam("q", query);
      if (index != null) optionsBuilder.queryParam("index", index);
      if (from != null) optionsBuilder.queryParam("from", from.toString());
      if (size != null) optionsBuilder.queryParam("size", size.toString());
      if (sortField != null) optionsBuilder.queryParam("sort_field", sortField);
      if (sortOrder != null) optionsBuilder.queryParam("sort_order", sortOrder);
      if (includeAggregations != null)
        optionsBuilder.queryParam("include_aggregations", String.valueOf(includeAggregations));
      if (deleted != null) optionsBuilder.queryParam("deleted", deleted.toString());
      if (queryFilter != null) optionsBuilder.queryParam("query_filter", queryFilter);
      if (postFilter != null) optionsBuilder.queryParam("post_filter", postFilter);
      if (trackTotalHits != null)
        optionsBuilder.queryParam("track_total_hits", trackTotalHits.toString());

      return httpClient.executeForString(
          HttpMethod.GET, "/v1/search/query", null, optionsBuilder.build());
    }
  }

  /** Fluent builder for suggest queries. */
  public static class SuggestBuilder {
    private final HttpClient httpClient;
    private String query;
    private String index;
    private Integer size;

    SuggestBuilder(HttpClient httpClient) {
      this.httpClient = httpClient;
    }

    /** Set the suggest query. */
    public SuggestBuilder query(String query) {
      this.query = query;
      return this;
    }

    /** Set the search index. */
    public SuggestBuilder index(String index) {
      this.index = index;
      return this;
    }

    /** Set the number of suggestions to return. */
    public SuggestBuilder size(int size) {
      this.size = size;
      return this;
    }

    /** Execute the suggest query. */
    public String execute() throws OpenMetadataException {
      RequestOptions.Builder optionsBuilder = RequestOptions.builder();

      if (query != null) optionsBuilder.queryParam("q", query);
      if (index != null) optionsBuilder.queryParam("index", index);
      if (size != null) optionsBuilder.queryParam("size", size.toString());

      return httpClient.executeForString(
          HttpMethod.GET, "/v1/search/suggest", null, optionsBuilder.build());
    }
  }

  /** Fluent builder for entity type counts queries. */
  public static class EntityTypeCountsBuilder {
    private final HttpClient httpClient;
    private String query;
    private String index;
    private String queryFilter;
    private String postFilter;

    EntityTypeCountsBuilder(HttpClient httpClient) {
      this.httpClient = httpClient;
    }

    /** Set the search query. */
    public EntityTypeCountsBuilder query(String query) {
      this.query = query;
      return this;
    }

    /** Set the search index. */
    public EntityTypeCountsBuilder index(String index) {
      this.index = index;
      return this;
    }

    /** Set a query filter (JSON format). */
    public EntityTypeCountsBuilder queryFilter(String filter) {
      this.queryFilter = filter;
      return this;
    }

    /** Set a post filter (JSON format). */
    public EntityTypeCountsBuilder postFilter(String filter) {
      this.postFilter = filter;
      return this;
    }

    /** Execute and get entity type counts. */
    public String execute() throws OpenMetadataException {
      RequestOptions.Builder optionsBuilder = RequestOptions.builder();

      if (query != null) optionsBuilder.queryParam("q", query);
      if (index != null) optionsBuilder.queryParam("index", index);
      if (queryFilter != null) optionsBuilder.queryParam("query_filter", queryFilter);
      if (postFilter != null) optionsBuilder.queryParam("post_filter", postFilter);

      return httpClient.executeForString(
          HttpMethod.GET, "/v1/search/entityTypeCounts", null, optionsBuilder.build());
    }
  }

  /** Fluent builder for aggregate queries. */
  public static class AggregateBuilder {
    private final HttpClient httpClient;
    private String query;
    private String index;
    private String field;

    AggregateBuilder(HttpClient httpClient) {
      this.httpClient = httpClient;
    }

    /** Set the search query. */
    public AggregateBuilder query(String query) {
      this.query = query;
      return this;
    }

    /** Set the search index. */
    public AggregateBuilder index(String index) {
      this.index = index;
      return this;
    }

    /** Set the field to aggregate on. */
    public AggregateBuilder field(String field) {
      this.field = field;
      return this;
    }

    /** Execute the aggregate query. */
    public String execute() throws OpenMetadataException {
      RequestOptions.Builder optionsBuilder = RequestOptions.builder();

      if (query != null) optionsBuilder.queryParam("q", query);
      if (index != null) optionsBuilder.queryParam("index", index);
      if (field != null) optionsBuilder.queryParam("field", field);

      return httpClient.executeForString(
          HttpMethod.GET, "/v1/search/aggregate", null, optionsBuilder.build());
    }
  }
}
