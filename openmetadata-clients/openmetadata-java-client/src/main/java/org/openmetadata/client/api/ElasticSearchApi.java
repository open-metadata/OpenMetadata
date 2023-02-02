package org.openmetadata.client.api;

import feign.Headers;
import feign.Param;
import feign.QueryMap;
import feign.RequestLine;
import feign.Response;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.client.ApiClient;
import org.openmetadata.client.EncodingUtils;

public interface ElasticSearchApi extends ApiClient.Api {

  /**
   * Get Aggregated Fields Get Aggregated Fields from Entities.
   *
   * @param index (optional, default to table_search_index)
   * @param field Field in an entity. (optional)
   * @param size Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   * @param deleted (optional, default to false)
   * @return Suggest
   */
  @RequestLine("GET /v1/search/aggregate?index={index}&field={field}&size={size}&deleted={deleted}")
  @Headers({
    "Accept: application/json",
  })
  Response getAggregateFields(
      @Param("index") String index,
      @Param("field") String field,
      @Param("size") Integer size,
      @Param("deleted") String deleted);

  /**
   * Get Aggregated Fields Similar to <code>getAggregateFields</code> but it also returns the http response headers .
   * Get Aggregated Fields from Entities.
   *
   * @param index (optional, default to table_search_index)
   * @param field Field in an entity. (optional)
   * @param size Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   * @param deleted (optional, default to false)
   * @return A ApiResponse that wraps the response boyd and the http headers.
   */
  @RequestLine("GET /v1/search/aggregate?index={index}&field={field}&size={size}&deleted={deleted}")
  @Headers({
    "Accept: application/json",
  })
  Response getAggregateFieldsWithHttpInfo(
      @Param("index") String index,
      @Param("field") String field,
      @Param("size") Integer size,
      @Param("deleted") String deleted);

  /**
   * Get Aggregated Fields Get Aggregated Fields from Entities. Note, this is equivalent to the other <code>
   * getAggregateFields</code> method, but with the query parameters collected into a single Map parameter. This is
   * convenient for services with optional query parameters, especially when used with the {@link
   * GetAggregateFieldsQueryParams} class that allows for building up this map in a fluent style.
   *
   * @param queryParams Map of query parameters as name-value pairs
   *     <p>The following elements may be specified in the query map:
   *     <ul>
   *       <li>index - (optional, default to table_search_index)
   *       <li>field - Field in an entity. (optional)
   *       <li>size - Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   *       <li>deleted - (optional, default to false)
   *     </ul>
   *
   * @return Suggest
   */
  @RequestLine("GET /v1/search/aggregate?index={index}&field={field}&size={size}&deleted={deleted}")
  @Headers({
    "Accept: application/json",
  })
  Response getAggregateFields(@QueryMap(encoded = true) Map<String, Object> queryParams);

  /**
   * Get Aggregated Fields Get Aggregated Fields from Entities. Note, this is equivalent to the other <code>
   * getAggregateFields</code> that receives the query parameters as a map, but this one also exposes the Http response
   * headers
   *
   * @param queryParams Map of query parameters as name-value pairs
   *     <p>The following elements may be specified in the query map:
   *     <ul>
   *       <li>index - (optional, default to table_search_index)
   *       <li>field - Field in an entity. (optional)
   *       <li>size - Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   *       <li>deleted - (optional, default to false)
   *     </ul>
   *
   * @return Suggest
   */
  @RequestLine("GET /v1/search/aggregate?index={index}&field={field}&size={size}&deleted={deleted}")
  @Headers({
    "Accept: application/json",
  })
  Response getAggregateFieldsWithHttpInfo(@QueryMap(encoded = true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the <code>getAggregateFields</code> method in a fluent
   * style.
   */
  class GetAggregateFieldsQueryParams extends HashMap<String, Object> {
    public GetAggregateFieldsQueryParams index(final String value) {
      put("index", EncodingUtils.encode(value));
      return this;
    }

    public GetAggregateFieldsQueryParams field(final String value) {
      put("field", EncodingUtils.encode(value));
      return this;
    }

    public GetAggregateFieldsQueryParams size(final Integer value) {
      put("size", EncodingUtils.encode(value));
      return this;
    }

    public GetAggregateFieldsQueryParams deleted(final String value) {
      put("deleted", EncodingUtils.encode(value));
      return this;
    }
  }

  /**
   * Suggest Entities Get suggested entities used for auto-completion.
   *
   * @param q Suggest API can be used to auto-fill the entities name while use is typing search text <br>
   *     1. To get suggest results pass q=us or q=user etc.. <br>
   *     2. Do not add any wild-cards such as * like in search api <br>
   *     3. suggest api is a prefix suggestion <br>
   *     (required)
   * @param index (optional, default to table_search_index)
   * @param field Field in object containing valid suggestions. Defaults to `suggest`. All indices has a `suggest`
   *     field, only some indices have other `suggest_*` fields. (optional, default to suggest)
   * @param size Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   * @param fetchSource Get document body for each hit (optional, default to true)
   * @param includeSourceFields Get only selected fields of the document body for each hit. Empty value will return all
   *     fields (optional)
   * @param deleted (optional, default to false)
   * @return Suggest
   */
  @RequestLine(
      "GET /v1/search/suggest?q={q}&index={index}&field={field}&size={size}&fetch_source={fetchSource}&include_source_fields={includeSourceFields}&deleted={deleted}")
  @Headers({
    "Accept: application/json",
  })
  Response getSuggestedEntities(
      @Param("q") String q,
      @Param("index") String index,
      @Param("field") String field,
      @Param("size") Integer size,
      @Param("fetchSource") Boolean fetchSource,
      @Param("includeSourceFields") List<String> includeSourceFields,
      @Param("deleted") String deleted);

  /**
   * Suggest Entities Similar to <code>getSuggestedEntities</code> but it also returns the http response headers . Get
   * suggested entities used for auto-completion.
   *
   * @param q Suggest API can be used to auto-fill the entities name while use is typing search text <br>
   *     1. To get suggest results pass q=us or q=user etc.. <br>
   *     2. Do not add any wild-cards such as * like in search api <br>
   *     3. suggest api is a prefix suggestion <br>
   *     (required)
   * @param index (optional, default to table_search_index)
   * @param field Field in object containing valid suggestions. Defaults to `suggest`. All indices has a `suggest`
   *     field, only some indices have other `suggest_*` fields. (optional, default to suggest)
   * @param size Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   * @param fetchSource Get document body for each hit (optional, default to true)
   * @param includeSourceFields Get only selected fields of the document body for each hit. Empty value will return all
   *     fields (optional)
   * @param deleted (optional, default to false)
   * @return A ApiResponse that wraps the response boyd and the http headers.
   */
  @RequestLine(
      "GET /v1/search/suggest?q={q}&index={index}&field={field}&size={size}&fetch_source={fetchSource}&include_source_fields={includeSourceFields}&deleted={deleted}")
  @Headers({
    "Accept: application/json",
  })
  Response getSuggestedEntitiesWithHttpInfo(
      @Param("q") String q,
      @Param("index") String index,
      @Param("field") String field,
      @Param("size") Integer size,
      @Param("fetchSource") Boolean fetchSource,
      @Param("includeSourceFields") List<String> includeSourceFields,
      @Param("deleted") String deleted);

  /**
   * Suggest Entities Get suggested entities used for auto-completion. Note, this is equivalent to the other <code>
   * getSuggestedEntities</code> method, but with the query parameters collected into a single Map parameter. This is
   * convenient for services with optional query parameters, especially when used with the {@link
   * GetSuggestedEntitiesQueryParams} class that allows for building up this map in a fluent style.
   *
   * @param queryParams Map of query parameters as name-value pairs
   *     <p>The following elements may be specified in the query map:
   *     <ul>
   *       <li>q - Suggest API can be used to auto-fill the entities name while use is typing search text <br>
   *           1. To get suggest results pass q=us or q=user etc.. <br>
   *           2. Do not add any wild-cards such as * like in search api <br>
   *           3. suggest api is a prefix suggestion <br>
   *           (required)
   *       <li>index - (optional, default to table_search_index)
   *       <li>field - Field in object containing valid suggestions. Defaults to `suggest`. All indices has a `suggest`
   *           field, only some indices have other `suggest_*` fields. (optional, default to suggest)
   *       <li>size - Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   *       <li>fetchSource - Get document body for each hit (optional, default to true)
   *       <li>includeSourceFields - Get only selected fields of the document body for each hit. Empty value will return
   *           all fields (optional)
   *       <li>deleted - (optional, default to false)
   *     </ul>
   *
   * @return Suggest
   */
  @RequestLine(
      "GET /v1/search/suggest?q={q}&index={index}&field={field}&size={size}&fetch_source={fetchSource}&include_source_fields={includeSourceFields}&deleted={deleted}")
  @Headers({
    "Accept: application/json",
  })
  Response getSuggestedEntities(@QueryMap(encoded = true) Map<String, Object> queryParams);

  /**
   * Suggest Entities Get suggested entities used for auto-completion. Note, this is equivalent to the other <code>
   * getSuggestedEntities</code> that receives the query parameters as a map, but this one also exposes the Http
   * response headers
   *
   * @param queryParams Map of query parameters as name-value pairs
   *     <p>The following elements may be specified in the query map:
   *     <ul>
   *       <li>q - Suggest API can be used to auto-fill the entities name while use is typing search text <br>
   *           1. To get suggest results pass q=us or q=user etc.. <br>
   *           2. Do not add any wild-cards such as * like in search api <br>
   *           3. suggest api is a prefix suggestion <br>
   *           (required)
   *       <li>index - (optional, default to table_search_index)
   *       <li>field - Field in object containing valid suggestions. Defaults to `suggest`. All indices has a `suggest`
   *           field, only some indices have other `suggest_*` fields. (optional, default to suggest)
   *       <li>size - Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   *       <li>fetchSource - Get document body for each hit (optional, default to true)
   *       <li>includeSourceFields - Get only selected fields of the document body for each hit. Empty value will return
   *           all fields (optional)
   *       <li>deleted - (optional, default to false)
   *     </ul>
   *
   * @return Suggest
   */
  @RequestLine(
      "GET /v1/search/suggest?q={q}&index={index}&field={field}&size={size}&fetch_source={fetchSource}&include_source_fields={includeSourceFields}&deleted={deleted}")
  @Headers({
    "Accept: application/json",
  })
  Response getSuggestedEntitiesWithHttpInfo(@QueryMap(encoded = true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the <code>getSuggestedEntities</code> method in a fluent
   * style.
   */
  class GetSuggestedEntitiesQueryParams extends HashMap<String, Object> {
    public GetSuggestedEntitiesQueryParams q(final String value) {
      put("q", EncodingUtils.encode(value));
      return this;
    }

    public GetSuggestedEntitiesQueryParams index(final String value) {
      put("index", EncodingUtils.encode(value));
      return this;
    }

    public GetSuggestedEntitiesQueryParams field(final String value) {
      put("field", EncodingUtils.encode(value));
      return this;
    }

    public GetSuggestedEntitiesQueryParams size(final Integer value) {
      put("size", EncodingUtils.encode(value));
      return this;
    }

    public GetSuggestedEntitiesQueryParams fetchSource(final Boolean value) {
      put("fetch_source", EncodingUtils.encode(value));
      return this;
    }

    public GetSuggestedEntitiesQueryParams includeSourceFields(final List<String> value) {
      put("include_source_fields", EncodingUtils.encodeCollection(value, "multi"));
      return this;
    }

    public GetSuggestedEntitiesQueryParams deleted(final String value) {
      put("deleted", EncodingUtils.encode(value));
      return this;
    }
  }

  /**
   * Search entities Search entities using query test. Use query params `from` and `size` for pagination. Use
   * `sort_field` to sort the results in `sort_order`.
   *
   * @param q Search Query Text, Pass *text* for substring match; Pass without wildcards for exact match. <br>
   *     1. For listing all tables or topics pass q=* <br>
   *     2. For search tables or topics pass q=*search_term* <br>
   *     3. For searching field names such as search by column_name pass q=column_names:address <br>
   *     4. For searching by tag names pass q=tags:user.email <br>
   *     5. When user selects a filter pass q=query_text AND tags:user.email AND platform:MYSQL <br>
   *     6. Search with multiple values of same filter q=tags:user.email AND tags:user.address <br>
   *     logic operators such as AND and OR must be in uppercase (required)
   * @param index ElasticSearch Index name, defaults to table_search_index (optional, default to table_search_index)
   * @param deleted Filter documents by deleted param. By default deleted is false (optional, default to false)
   * @param from From field to paginate the results, defaults to 0 (optional, default to 0)
   * @param size Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   * @param sortField Sort the search results by field, available fields to sort weekly_stats , daily_stats,
   *     monthly_stats, last_updated_timestamp (optional, default to _score)
   * @param sortOrder Sort order asc for ascending or desc for descending, defaults to desc (optional, default to desc)
   * @param trackTotalHits Track Total Hits (optional, default to false)
   * @param queryFilter Elasticsearch query that will be combined with the query_string query generator from the `query`
   *     argument (optional)
   * @param postFilter Elasticsearch query that will be used as a post_filter (optional)
   * @param fetchSource Get document body for each hit (optional, default to true)
   * @param includeSourceFields Get only selected fields of the document body for each hit. Empty value will return all
   *     fields (optional)
   * @return SearchResponse
   */
  @RequestLine(
      "GET /v1/search/query?q={q}&index={index}&deleted={deleted}&from={from}&size={size}&sort_field={sortField}&sort_order={sortOrder}&track_total_hits={trackTotalHits}&query_filter={queryFilter}&post_filter={postFilter}&fetch_source={fetchSource}&include_source_fields={includeSourceFields}")
  @Headers({
    "Accept: application/json",
  })
  Response searchEntitiesWithQuery(
      @Param("q") String q,
      @Param("index") String index,
      @Param("deleted") Boolean deleted,
      @Param("from") Integer from,
      @Param("size") Integer size,
      @Param("sortField") String sortField,
      @Param("sortOrder") String sortOrder,
      @Param("trackTotalHits") Boolean trackTotalHits,
      @Param("queryFilter") String queryFilter,
      @Param("postFilter") String postFilter,
      @Param("fetchSource") Boolean fetchSource,
      @Param("includeSourceFields") List<String> includeSourceFields);

  /**
   * Search entities Similar to <code>searchEntitiesWithQuery</code> but it also returns the http response headers .
   * Search entities using query test. Use query params `from` and `size` for pagination. Use `sort_field` to sort the
   * results in `sort_order`.
   *
   * @param q Search Query Text, Pass *text* for substring match; Pass without wildcards for exact match. <br>
   *     1. For listing all tables or topics pass q=* <br>
   *     2. For search tables or topics pass q=*search_term* <br>
   *     3. For searching field names such as search by column_name pass q=column_names:address <br>
   *     4. For searching by tag names pass q=tags:user.email <br>
   *     5. When user selects a filter pass q=query_text AND tags:user.email AND platform:MYSQL <br>
   *     6. Search with multiple values of same filter q=tags:user.email AND tags:user.address <br>
   *     logic operators such as AND and OR must be in uppercase (required)
   * @param index ElasticSearch Index name, defaults to table_search_index (optional, default to table_search_index)
   * @param deleted Filter documents by deleted param. By default deleted is false (optional, default to false)
   * @param from From field to paginate the results, defaults to 0 (optional, default to 0)
   * @param size Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   * @param sortField Sort the search results by field, available fields to sort weekly_stats , daily_stats,
   *     monthly_stats, last_updated_timestamp (optional, default to _score)
   * @param sortOrder Sort order asc for ascending or desc for descending, defaults to desc (optional, default to desc)
   * @param trackTotalHits Track Total Hits (optional, default to false)
   * @param queryFilter Elasticsearch query that will be combined with the query_string query generator from the `query`
   *     argument (optional)
   * @param postFilter Elasticsearch query that will be used as a post_filter (optional)
   * @param fetchSource Get document body for each hit (optional, default to true)
   * @param includeSourceFields Get only selected fields of the document body for each hit. Empty value will return all
   *     fields (optional)
   * @return A ApiResponse that wraps the response boyd and the http headers.
   */
  @RequestLine(
      "GET /v1/search/query?q={q}&index={index}&deleted={deleted}&from={from}&size={size}&sort_field={sortField}&sort_order={sortOrder}&track_total_hits={trackTotalHits}&query_filter={queryFilter}&post_filter={postFilter}&fetch_source={fetchSource}&include_source_fields={includeSourceFields}")
  @Headers({
    "Accept: application/json",
  })
  Response searchEntitiesWithQueryWithHttpInfo(
      @Param("q") String q,
      @Param("index") String index,
      @Param("deleted") Boolean deleted,
      @Param("from") Integer from,
      @Param("size") Integer size,
      @Param("sortField") String sortField,
      @Param("sortOrder") String sortOrder,
      @Param("trackTotalHits") Boolean trackTotalHits,
      @Param("queryFilter") String queryFilter,
      @Param("postFilter") String postFilter,
      @Param("fetchSource") Boolean fetchSource,
      @Param("includeSourceFields") List<String> includeSourceFields);

  /**
   * Search entities Search entities using query test. Use query params `from` and `size` for pagination. Use
   * `sort_field` to sort the results in `sort_order`. Note, this is equivalent to the other <code>
   * searchEntitiesWithQuery</code> method, but with the query parameters collected into a single Map parameter. This is
   * convenient for services with optional query parameters, especially when used with the {@link
   * SearchEntitiesWithQueryQueryParams} class that allows for building up this map in a fluent style.
   *
   * @param queryParams Map of query parameters as name-value pairs
   *     <p>The following elements may be specified in the query map:
   *     <ul>
   *       <li>q - Search Query Text, Pass *text* for substring match; Pass without wildcards for exact match. <br>
   *           1. For listing all tables or topics pass q=* <br>
   *           2. For search tables or topics pass q=*search_term* <br>
   *           3. For searching field names such as search by column_name pass q=column_names:address <br>
   *           4. For searching by tag names pass q=tags:user.email <br>
   *           5. When user selects a filter pass q=query_text AND tags:user.email AND platform:MYSQL <br>
   *           6. Search with multiple values of same filter q=tags:user.email AND tags:user.address <br>
   *           logic operators such as AND and OR must be in uppercase (required)
   *       <li>index - ElasticSearch Index name, defaults to table_search_index (optional, default to
   *           table_search_index)
   *       <li>deleted - Filter documents by deleted param. By default deleted is false (optional, default to false)
   *       <li>from - From field to paginate the results, defaults to 0 (optional, default to 0)
   *       <li>size - Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   *       <li>sortField - Sort the search results by field, available fields to sort weekly_stats , daily_stats,
   *           monthly_stats, last_updated_timestamp (optional, default to _score)
   *       <li>sortOrder - Sort order asc for ascending or desc for descending, defaults to desc (optional, default to
   *           desc)
   *       <li>trackTotalHits - Track Total Hits (optional, default to false)
   *       <li>queryFilter - Elasticsearch query that will be combined with the query_string query generator from the
   *           `query` argument (optional)
   *       <li>postFilter - Elasticsearch query that will be used as a post_filter (optional)
   *       <li>fetchSource - Get document body for each hit (optional, default to true)
   *       <li>includeSourceFields - Get only selected fields of the document body for each hit. Empty value will return
   *           all fields (optional)
   *     </ul>
   *
   * @return SearchResponse
   */
  @RequestLine(
      "GET /v1/search/query?q={q}&index={index}&deleted={deleted}&from={from}&size={size}&sort_field={sortField}&sort_order={sortOrder}&track_total_hits={trackTotalHits}&query_filter={queryFilter}&post_filter={postFilter}&fetch_source={fetchSource}&include_source_fields={includeSourceFields}")
  @Headers({
    "Accept: application/json",
  })
  Response searchEntitiesWithQuery(@QueryMap(encoded = true) Map<String, Object> queryParams);

  /**
   * Search entities Search entities using query test. Use query params `from` and `size` for pagination. Use
   * `sort_field` to sort the results in `sort_order`. Note, this is equivalent to the other <code>
   * searchEntitiesWithQuery</code> that receives the query parameters as a map, but this one also exposes the Http
   * response headers
   *
   * @param queryParams Map of query parameters as name-value pairs
   *     <p>The following elements may be specified in the query map:
   *     <ul>
   *       <li>q - Search Query Text, Pass *text* for substring match; Pass without wildcards for exact match. <br>
   *           1. For listing all tables or topics pass q=* <br>
   *           2. For search tables or topics pass q=*search_term* <br>
   *           3. For searching field names such as search by column_name pass q=column_names:address <br>
   *           4. For searching by tag names pass q=tags:user.email <br>
   *           5. When user selects a filter pass q=query_text AND tags:user.email AND platform:MYSQL <br>
   *           6. Search with multiple values of same filter q=tags:user.email AND tags:user.address <br>
   *           logic operators such as AND and OR must be in uppercase (required)
   *       <li>index - ElasticSearch Index name, defaults to table_search_index (optional, default to
   *           table_search_index)
   *       <li>deleted - Filter documents by deleted param. By default deleted is false (optional, default to false)
   *       <li>from - From field to paginate the results, defaults to 0 (optional, default to 0)
   *       <li>size - Size field to limit the no.of results returned, defaults to 10 (optional, default to 10)
   *       <li>sortField - Sort the search results by field, available fields to sort weekly_stats , daily_stats,
   *           monthly_stats, last_updated_timestamp (optional, default to _score)
   *       <li>sortOrder - Sort order asc for ascending or desc for descending, defaults to desc (optional, default to
   *           desc)
   *       <li>trackTotalHits - Track Total Hits (optional, default to false)
   *       <li>queryFilter - Elasticsearch query that will be combined with the query_string query generator from the
   *           `query` argument (optional)
   *       <li>postFilter - Elasticsearch query that will be used as a post_filter (optional)
   *       <li>fetchSource - Get document body for each hit (optional, default to true)
   *       <li>includeSourceFields - Get only selected fields of the document body for each hit. Empty value will return
   *           all fields (optional)
   *     </ul>
   *
   * @return SearchResponse
   */
  @RequestLine(
      "GET /v1/search/query?q={q}&index={index}&deleted={deleted}&from={from}&size={size}&sort_field={sortField}&sort_order={sortOrder}&track_total_hits={trackTotalHits}&query_filter={queryFilter}&post_filter={postFilter}&fetch_source={fetchSource}&include_source_fields={includeSourceFields}")
  @Headers({
    "Accept: application/json",
  })
  Response searchEntitiesWithQueryWithHttpInfo(@QueryMap(encoded = true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the <code>searchEntitiesWithQuery</code> method in a fluent
   * style.
   */
  class SearchEntitiesWithQueryQueryParams extends HashMap<String, Object> {
    public SearchEntitiesWithQueryQueryParams q(final String value) {
      put("q", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams index(final String value) {
      put("index", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams deleted(final Boolean value) {
      put("deleted", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams from(final Integer value) {
      put("from", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams size(final Integer value) {
      put("size", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams sortField(final String value) {
      put("sort_field", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams sortOrder(final String value) {
      put("sort_order", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams trackTotalHits(final Boolean value) {
      put("track_total_hits", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams queryFilter(final String value) {
      put("query_filter", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams postFilter(final String value) {
      put("post_filter", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams fetchSource(final Boolean value) {
      put("fetch_source", EncodingUtils.encode(value));
      return this;
    }

    public SearchEntitiesWithQueryQueryParams includeSourceFields(final List<String> value) {
      put("include_source_fields", EncodingUtils.encodeCollection(value, "multi"));
      return this;
    }
  }
}
