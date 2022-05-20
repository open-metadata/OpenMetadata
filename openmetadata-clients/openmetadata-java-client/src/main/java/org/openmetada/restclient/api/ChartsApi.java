package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetadata.core.util.ResultList;
import org.openmetadata.catalog.api.data.CreateChart;
import org.openmetadata.catalog.entity.data.Chart;

import java.util.HashMap;
import java.util.Map;
import feign.*;
import org.openmetadata.catalog.type.EntityHistory;

import feign.Response;

public interface ChartsApi extends ApiClient.Api {

  /**
   * Add a follower
   * Add a user identified by &#x60;userId&#x60; as followed of this chart
   * @param id Id of the chart (required)
   * @param body Id of the user to be added as follower (optional)
   */
  @RequestLine("PUT /charts/{id}/followers")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response addFollower(@Param("id") String id, String body);
  /**
   * Create a chart
   * Create a chart under an existing &#x60;service&#x60;.
   * @param body  (optional)
   * @return CreateChart
   */
  @RequestLine("POST /charts")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createChart(CreateChart body);
  /**
   * Create or update chart
   * Create a chart, it it does not exist or update an existing chart.
   * @param body  (optional)
   * @return CreateChart
   */
  @RequestLine("PUT /charts")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateChart body);
  /**
   * Delete a Chart
   * Delete a chart by &#x60;id&#x60;.
   * @param id Chart Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /charts/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response delete(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a Chart
   * Delete a chart by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Chart Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /charts/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response delete(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete</code> method in a fluent style.
   */
  public static class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Remove a follower
   * Remove the user identified &#x60;userId&#x60; as a follower of the chart.
   * @param id Id of the chart (required)
   * @param userId Id of the user being removed as follower (required)
   */
  @RequestLine("DELETE /charts/{id}/followers/{userId}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response deleteFollower(@Param("id") String id, @Param("userId") String userId);
  /**
   * Get a Chart
   * Get a chart by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Chart
   */
  @RequestLine("GET /charts/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Chart getChartByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a Chart
   * Get a chart by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get1</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link Get1QueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Chart

   */
  @RequestLine("GET /charts/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Chart getChartByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get1</code> method in a fluent style.
   */
  public static class Get1QueryParams extends HashMap<String, Object> {
    public Get1QueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public Get1QueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a chart by name
   * Get a chart by fully qualified name.
   * @param fqn  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Chart
   */
  @RequestLine("GET /charts/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Chart getByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a chart by name
   * Get a chart by fully qualified name.
   * Note, this is equivalent to the other <code>getByName</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param fqn  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Chart

   */
  @RequestLine("GET /charts/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Chart getByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName</code> method in a fluent style.
   */
  public static class GetByNameQueryParams extends HashMap<String, Object> {
    public GetByNameQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetByNameQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a version of the chart
   * Get a version of the chart by given &#x60;id&#x60;
   * @param id Chart Id (required)
   * @param version Chart version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Chart
   */
  @RequestLine("GET /charts/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Chart getVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List charts
   * Get a list of charts, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param service Filter charts by service name (optional)
   * @param limit Limit the number charts returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of charts before this cursor (optional)
   * @param after Returns list of charts after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return ChartList
   */
  @RequestLine("GET /charts?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Chart> listCharts(@Param("fields") String fields, @Param("service") String service, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List charts
   * Get a list of charts, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list1</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link List1QueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>service - Filter charts by service name (optional)</li>
   *   <li>limit - Limit the number charts returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of charts before this cursor (optional)</li>
   *   <li>after - Returns list of charts after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return ChartList

   */
  @RequestLine("GET /charts?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Chart> listCharts(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list1</code> method in a fluent style.
   */
  public static class List1QueryParams extends HashMap<String, Object> {
    public List1QueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public List1QueryParams service(final String value) {
      put("service", EncodingUtils.encode(value));
      return this;
    }
    public List1QueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public List1QueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public List1QueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
    public List1QueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List chart versions
   * Get a list of all the versions of a chart identified by &#x60;id&#x60;
   * @param id Chart Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /charts/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listVersions(@Param("id") String id);
  /**
   * Update a chart
   * Update an existing chart using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a chart Documentation</a>
   */
  @RequestLine("PATCH /charts/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
}
