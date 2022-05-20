package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;

import java.util.HashMap;
import java.util.Map;
import feign.*;

public interface SearchApi extends ApiClient.Api {

  /**
   * Search entities
   * Search entities using query test. Use query params &#x60;from&#x60; and &#x60;size&#x60; for pagination. Use &#x60;sort_field&#x60; to sort the results in &#x60;sort_order&#x60;.
   * @param q Search Query Text, Pass *text* for substring match; Pass without wildcards for exact match. &lt;br/&gt; 1. For listing all tables or topics pass q&#x3D;* &lt;br/&gt;2. For search tables or topics pass q&#x3D;*search_term* &lt;br/&gt;3. For searching field names such as search by column_name pass q&#x3D;column_names:address &lt;br/&gt;4. For searching by tag names pass q&#x3D;tags:user.email &lt;br/&gt;5. When user selects a filter pass q&#x3D;query_text AND tags:user.email AND platform:MYSQL &lt;br/&gt;6. Search with multiple values of same filter q&#x3D;tags:user.email AND tags:user.address &lt;br/&gt; logic operators such as AND and OR must be in uppercase  (required)
   * @param index ElasticSearch Index name, defaults to table_search_index (optional)
   * @param deleted Filter documents by deleted param. By default deleted is false (optional)
   * @param from From field to paginate the results, defaults to 0 (optional)
   * @param size Size field to limit the no.of results returned, defaults to 10 (optional)
   * @param sortField Sort the search results by field, available fields to sort weekly_stats , daily_stats, monthly_stats, last_updated_timestamp (optional)
   * @param sortOrder Sort order asc for ascending or desc for descending, defaults to desc (optional)
   * @return SearchResponse
   */
  @RequestLine("GET /search/query?q={q}&index={index}&deleted={deleted}&from={from}&size={size}&sort_field={sortField}&sort_order={sortOrder}")
  @Headers({
      "Accept: application/json",
  })
  Response search(@Param("q") String q, @Param("index") String index, @Param("deleted") Boolean deleted, @Param("from") Integer from, @Param("size") Integer size, @Param("sortField") String sortField, @Param("sortOrder") String sortOrder);

  /**
   * Search entities
   * Search entities using query test. Use query params &#x60;from&#x60; and &#x60;size&#x60; for pagination. Use &#x60;sort_field&#x60; to sort the results in &#x60;sort_order&#x60;.
   * Note, this is equivalent to the other <code>search</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link SearchQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>q - Search Query Text, Pass *text* for substring match; Pass without wildcards for exact match. &lt;br/&gt; 1. For listing all tables or topics pass q&#x3D;* &lt;br/&gt;2. For search tables or topics pass q&#x3D;*search_term* &lt;br/&gt;3. For searching field names such as search by column_name pass q&#x3D;column_names:address &lt;br/&gt;4. For searching by tag names pass q&#x3D;tags:user.email &lt;br/&gt;5. When user selects a filter pass q&#x3D;query_text AND tags:user.email AND platform:MYSQL &lt;br/&gt;6. Search with multiple values of same filter q&#x3D;tags:user.email AND tags:user.address &lt;br/&gt; logic operators such as AND and OR must be in uppercase  (required)</li>
   *   <li>index - ElasticSearch Index name, defaults to table_search_index (optional)</li>
   *   <li>deleted - Filter documents by deleted param. By default deleted is false (optional)</li>
   *   <li>from - From field to paginate the results, defaults to 0 (optional)</li>
   *   <li>size - Size field to limit the no.of results returned, defaults to 10 (optional)</li>
   *   <li>sortField - Sort the search results by field, available fields to sort weekly_stats , daily_stats, monthly_stats, last_updated_timestamp (optional)</li>
   *   <li>sortOrder - Sort order asc for ascending or desc for descending, defaults to desc (optional)</li>
   *   </ul>
   * @return SearchResponse

   */
  @RequestLine("GET /search/query?q={q}&index={index}&deleted={deleted}&from={from}&size={size}&sort_field={sortField}&sort_order={sortOrder}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Response search(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>search</code> method in a fluent style.
   */
  class SearchQueryParams extends HashMap<String, Object> {
    public SearchQueryParams q(final String value) {
      put("q", EncodingUtils.encode(value));
      return this;
    }
    public SearchQueryParams index(final String value) {
      put("index", EncodingUtils.encode(value));
      return this;
    }
    public SearchQueryParams deleted(final Boolean value) {
      put("deleted", EncodingUtils.encode(value));
      return this;
    }
    public SearchQueryParams from(final Integer value) {
      put("from", EncodingUtils.encode(value));
      return this;
    }
    public SearchQueryParams size(final Integer value) {
      put("size", EncodingUtils.encode(value));
      return this;
    }
    public SearchQueryParams sortField(final String value) {
      put("sort_field", EncodingUtils.encode(value));
      return this;
    }
    public SearchQueryParams sortOrder(final String value) {
      put("sort_order", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Suggest entities
   * Get suggested entities used for auto-completion.
   * @param q Suggest API can be used to auto-fill the entities name while use is typing search text &lt;br/&gt; 1. To get suggest results pass q&#x3D;us or q&#x3D;user etc.. &lt;br/&gt; 2. Do not add any wild-cards such as * like in search api &lt;br/&gt; 3. suggest api is a prefix suggestion &lt;br/&gt; (required)
   * @param index  (optional)
   * @return SearchResponse
   */
  @RequestLine("GET /search/suggest?q={q}&index={index}")
  @Headers({
      "Accept: application/json",
  })
  Response suggest(@Param("q") String q, @Param("index") String index);

  /**
   * Suggest entities
   * Get suggested entities used for auto-completion.
   * Note, this is equivalent to the other <code>suggest</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link SuggestQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>q - Suggest API can be used to auto-fill the entities name while use is typing search text &lt;br/&gt; 1. To get suggest results pass q&#x3D;us or q&#x3D;user etc.. &lt;br/&gt; 2. Do not add any wild-cards such as * like in search api &lt;br/&gt; 3. suggest api is a prefix suggestion &lt;br/&gt; (required)</li>
   *   <li>index -  (optional)</li>
   *   </ul>
   * @return SearchResponse

   */
  @RequestLine("GET /search/suggest?q={q}&index={index}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Response suggest(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>suggest</code> method in a fluent style.
   */
  class SuggestQueryParams extends HashMap<String, Object> {
    public SuggestQueryParams q(final String value) {
      put("q", EncodingUtils.encode(value));
      return this;
    }
    public SuggestQueryParams index(final String value) {
      put("index", EncodingUtils.encode(value));
      return this;
    }
  }
}
