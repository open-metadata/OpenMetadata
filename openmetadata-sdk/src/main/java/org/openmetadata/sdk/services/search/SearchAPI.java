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

  public String search(String query) throws OpenMetadataException {
    return search(query, null, null, null, null, null, null);
  }

  public String search(String query, String index) throws OpenMetadataException {
    return search(query, index, null, null, null, null, null);
  }

  public String search(
      String query, String index, Integer from, Integer size, String sortField, String sortOrder)
      throws OpenMetadataException {
    return search(query, index, from, size, sortField, sortOrder, null);
  }

  public String search(
      String query,
      String index,
      Integer from,
      Integer size,
      String sortField,
      String sortOrder,
      Boolean includeAggregations)
      throws OpenMetadataException {

    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    optionsBuilder.queryParam("q", query);
    if (index != null) optionsBuilder.queryParam("index", index);
    if (from != null) optionsBuilder.queryParam("from", from.toString());
    if (size != null) optionsBuilder.queryParam("size", size.toString());
    if (sortField != null) optionsBuilder.queryParam("sort_field", sortField);
    if (sortOrder != null) optionsBuilder.queryParam("sort_order", sortOrder);
    if (includeAggregations != null)
      optionsBuilder.queryParam("include_aggregations", String.valueOf(includeAggregations));

    return httpClient.executeForString(
        HttpMethod.GET, "/v1/search/query", null, optionsBuilder.build());
  }

  public String suggest(String query) throws OpenMetadataException {
    return suggest(query, null, null);
  }

  public String suggest(String query, String index, Integer size) throws OpenMetadataException {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    optionsBuilder.queryParam("q", query);
    if (index != null) optionsBuilder.queryParam("index", index);
    if (size != null) optionsBuilder.queryParam("size", size.toString());

    return httpClient.executeForString(
        HttpMethod.GET, "/v1/search/suggest", null, optionsBuilder.build());
  }

  public String aggregate(String query, String index, String field) throws OpenMetadataException {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    optionsBuilder.queryParam("q", query);
    if (index != null) optionsBuilder.queryParam("index", index);
    if (field != null) optionsBuilder.queryParam("field", field);

    return httpClient.executeForString(
        HttpMethod.GET, "/v1/search/aggregate", null, optionsBuilder.build());
  }

  public String searchAdvanced(Map<String, Object> searchRequest) throws OpenMetadataException {
    return httpClient.executeForString(HttpMethod.POST, "/v1/search/query", searchRequest);
  }

  public String reindex(String entityType) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParam("entityType", entityType).build();

    return httpClient.executeForString(HttpMethod.POST, "/v1/search/reindex", null, options);
  }

  public String reindexAll() throws OpenMetadataException {
    return httpClient.executeForString(HttpMethod.POST, "/v1/search/reindex/all", null);
  }
}
