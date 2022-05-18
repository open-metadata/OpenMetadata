package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.api.data.CreateDashboard;
import org.openmetadata.catalog.entity.data.Dashboard;

import java.util.HashMap;
import java.util.Map;
import feign.*;
import org.openmetadata.catalog.type.EntityHistory;

import javax.ws.rs.core.Response;

public interface DashboardsApi extends ApiClient.Api {

  /**
   * Add a follower
   * Add a user identified by &#x60;userId&#x60; as follower of this dashboard
   * @param id Id of the dashboard (required)
   * @param body Id of the user to be added as follower (optional)
   */
  @RequestLine("PUT /v1/dashboards/{id}/followers")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response addFollower(@Param("id") String id, String body);
  /**
   * Create a dashboard
   * Create a new dashboard.
   * @param body  (optional)
   * @return CreateDashboard
   */
  @RequestLine("POST /v1/dashboards")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createDashboard(CreateDashboard body);
  /**
   * Create or update a dashboard
   * Create a new dashboard, if it does not exist or update an existing dashboard.
   * @param body  (optional)
   * @return CreateDashboard
   */
  @RequestLine("PUT /v1/dashboards")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateDashboard body);
  /**
   * Delete a Dashboard
   * Delete a dashboard by &#x60;id&#x60;.
   * @param id Dashboard Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/dashboards/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response delete(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a Dashboard
   * Delete a dashboard by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete1</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link Delete1QueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Dashboard Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/dashboards/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response delete(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete1</code> method in a fluent style.
   */
  class Delete1QueryParams extends HashMap<String, Object> {
    public Delete1QueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Remove a follower
   * Remove the user identified &#x60;userId&#x60; as a follower of the dashboard.
   * @param id Id of the dashboard (required)
   * @param userId Id of the user being removed as follower (required)
   */
  @RequestLine("DELETE /v1/dashboards/{id}/followers/{userId}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response deleteFollower(@Param("id") String id, @Param("userId") String userId);
  /**
   * Get a dashboard
   * Get a dashboard by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Dashboard
   */
  @RequestLine("GET /v1/dashboards/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Dashboard getDashboardByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a dashboard
   * Get a dashboard by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get2</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link Get2QueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Dashboard

   */
  @RequestLine("GET /v1/dashboards/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Dashboard getDashboardByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get2</code> method in a fluent style.
   */
  class Get2QueryParams extends HashMap<String, Object> {
    public Get2QueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public Get2QueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a dashboard by name
   * Get a dashboard by fully qualified name.
   * @param fqn  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Dashboard
   */
  @RequestLine("GET /v1/dashboards/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Dashboard getDashboardByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a dashboard by name
   * Get a dashboard by fully qualified name.
   * Note, this is equivalent to the other <code>getByName1</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByName1QueryParams} class that allows for
   * building up this map in a fluent style.
   * @param fqn  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Dashboard

   */
  @RequestLine("GET /v1/dashboards/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Dashboard getDashboardByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName1</code> method in a fluent style.
   */
  class GetByName1QueryParams extends HashMap<String, Object> {
    public GetByName1QueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetByName1QueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a version of the dashboard
   * Get a version of the dashboard by given &#x60;id&#x60;
   * @param id Dashboard Id (required)
   * @param version Dashboard version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Dashboard
   */
  @RequestLine("GET /v1/dashboards/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Dashboard getVersionWithID(@Param("id") String id, @Param("version") String version);
  /**
   * List Dashboards
   * Get a list of dashboards, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param service Filter dashboards by service name (optional)
   * @param limit Limit the number dashboards returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of dashboards before this cursor (optional)
   * @param after Returns list of dashboards after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DashboardList
   */
  @RequestLine("GET /v1/dashboards?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Dashboard> getDashboardList(@Param("fields") String fields, @Param("service") String service, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List Dashboards
   * Get a list of dashboards, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list2</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link List2QueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>service - Filter dashboards by service name (optional)</li>
   *   <li>limit - Limit the number dashboards returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of dashboards before this cursor (optional)</li>
   *   <li>after - Returns list of dashboards after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return DashboardList

   */
  @RequestLine("GET /v1/dashboards?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Dashboard>  getDashboardList(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list2</code> method in a fluent style.
   */
  class List2QueryParams extends HashMap<String, Object> {
    public List2QueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public List2QueryParams service(final String value) {
      put("service", EncodingUtils.encode(value));
      return this;
    }
    public List2QueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public List2QueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public List2QueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
    public List2QueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List dashboard versions
   * Get a list of all the versions of a dashboard identified by &#x60;id&#x60;
   * @param id Dashboard Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/dashboards/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listVersions(@Param("id") String id);
  /**
   * Update a Dashboard
   * Update an existing dashboard using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a Dashboard Documentation</a>
   */
  @RequestLine("PATCH /v1/dashboards/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response updateDescription(@Param("id") String id, Object body);
}
