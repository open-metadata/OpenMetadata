package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.entity.data.Report;

import java.util.HashMap;
import java.util.Map;
import feign.*;

import javax.ws.rs.core.Response;

public interface ReportsApi extends ApiClient.Api {

  /**
   * Create a report
   * Create a new report.
   * @param body  (optional)
   * @return Report
   */
  @RequestLine("POST /v1/reports")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createReport(Report body);
  /**
   * Create or update a report
   * Create a new report, it it does not exist or update an existing report.
   * @param body  (optional)
   * @return Report
   */
  @RequestLine("PUT /v1/reports")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(Report body);
  /**
   * Get a report
   * Get a report by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Report
   */
  @RequestLine("GET /v1/reports/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Report getReportByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a report
   * Get a report by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get17</code> method,
   * but with the query parameters collected into a single Map parameter. This
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
   * @return Report

   */
  @RequestLine("GET /v1/reports/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Response getReportByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get17</code> method in a fluent style.
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
   * List reports
   * Get a list of reports. Use &#x60;fields&#x60; parameter to get only necessary fields.
   * @param fields Fields requested in the returned resource (optional)
   * @return ReportList
   */
  @RequestLine("GET /v1/reports?fields={fields}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Report> listReport(@Param("fields") String fields);

  /**
   * List reports
   * Get a list of reports. Use &#x60;fields&#x60; parameter to get only necessary fields.
   * Note, this is equivalent to the other <code>list15</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   </ul>
   * @return ReportList

   */
  @RequestLine("GET /v1/reports?fields={fields}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Report> listReport(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list15</code> method in a fluent style.
   */
  class ListQueryParams extends HashMap<String, Object> {
    public ListQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
  }
}
