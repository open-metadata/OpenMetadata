package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetadata.core.util.ResultList;
import org.openmetadata.catalog.entity.data.Metrics;

import java.util.HashMap;
import java.util.Map;
import feign.*;

import feign.Response;

public interface MetricsApi extends ApiClient.Api {

  /**
   * Create a metric
   * Create a new metric.
   * @param body  (optional)
   * @return Metrics
   */
  @RequestLine("POST /metrics")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createMetric(Metrics body);
  /**
   * Create or update a metric
   * Create a new metric, if it does not exist or update an existing metric.
   * @param body  (optional)
   * @return Metrics
   */
  @RequestLine("PUT /metrics")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(Metrics body);
  /**
   * Get a metric
   * Get a metric by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Metrics
   */
  @RequestLine("GET /metrics/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Metrics getMetricByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a metric
   * Get a metric by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get13</code> method,
   * but with the query pasrameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Metrics

   */
  @RequestLine("GET /metrics/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Metrics getMetricByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get13</code> method in a fluent style.
   */
  class GetQueryParams extends HashMap<String, Object> {
    public GetQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List metrics
   * Get a list of metrics. Use &#x60;fields&#x60; parameter to get only necessary fields.
   * @param fields Fields requested in the returned resource (optional)
   * @param limit  (optional)
   * @param before Returns list of metrics before this cursor (optional)
   * @param after Returns list of metrics after this cursor (optional)
   * @return MetricsList
   */
  @RequestLine("GET /metrics?fields={fields}&limit={limit}&before={before}&after={after}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Metrics> listMetrics(@Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after);

  /**
   * List metrics
   * Get a list of metrics. Use &#x60;fields&#x60; parameter to get only necessary fields.
   * Note, this is equivalent to the other <code>list11</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit -  (optional)</li>
   *   <li>before - Returns list of metrics before this cursor (optional)</li>
   *   <li>after - Returns list of metrics after this cursor (optional)</li>
   *   </ul>
   * @return MetricsList

   */
  @RequestLine("GET /metrics?fields={fields}&limit={limit}&before={before}&after={after}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Metrics> listMetrics(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list11</code> method in a fluent style.
   */
  class ListQueryParams extends HashMap<String, Object> {
    public ListQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListQueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public ListQueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public ListQueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
  }
}
