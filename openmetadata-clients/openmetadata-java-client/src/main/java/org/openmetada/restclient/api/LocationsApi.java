package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetadata.core.util.ResultList;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.api.data.CreateLocation;

import java.util.HashMap;
import java.util.Map;
import feign.*;

public interface LocationsApi extends ApiClient.Api {

  /**
   * Add a follower
   * Add a user identified by &#x60;userId&#x60; as followed of this location
   * @param id Id of the location (required)
   * @param body Id of the user to be added as follower (optional)
   */
  @RequestLine("PUT /locations/{id}/followers")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  void addFollower(@Param("id") String id, String body);
  /**
   * Create a location
   * Create a location under an existing &#x60;service&#x60;.
   * @param body  (optional)
   * @return Location
   */
  @RequestLine("POST /locations")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Location createLocation(CreateLocation body);
  /**
   * Create or update location
   * Create a location, it it does not exist or update an existing location.
   * @param body  (optional)
   * @return Location
   */
  @RequestLine("PUT /locations")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Location createOrUpdate(CreateLocation body);
  /**
   * Delete a location
   * Delete a location by &#x60;id&#x60;.
   * @param id Location Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /locations/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  void deleteLocation(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a location
   * Delete a location by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete7</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Location Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /locations/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  void deleteLocation(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete7</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Remove a follower
   * Remove the user identified &#x60;userId&#x60; as a follower of the location.
   * @param id Id of the location (required)
   * @param userId Id of the user being removed as follower (required)
   */
  @RequestLine("DELETE /locations/{id}/followers/{userId}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  void deleteFollowerFromLocation(@Param("id") String id, @Param("userId") String userId);
  /**
   * Get a location
   * Get a location by &#x60;id&#x60;.
   * @param id location Id (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Location
   */
  @RequestLine("GET /locations/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Location getLocation(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a location
   * Get a location by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get12</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id location Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Location

   */
  @RequestLine("GET /locations/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Location getLocation(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get12</code> method in a fluent style.
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
   * Get a location by name
   * Get a location by fully qualified name.
   * @param fqn Fully qualified name of the location urlencoded if needed (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Location
   */
  @RequestLine("GET /locations/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Location getLocationByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a location by name
   * Get a location by fully qualified name.
   * Note, this is equivalent to the other <code>getByName9</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param fqn Fully qualified name of the location urlencoded if needed (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Location

   */
  @RequestLine("GET /locations/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Location getLocationByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName9</code> method in a fluent style.
   */
  class GetByNameQueryParams extends HashMap<String, Object> {
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
   * Get a version of the location
   * Get a version of the location by given &#x60;id&#x60;
   * @param id location Id (required)
   * @param version location version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Location
   */
  @RequestLine("GET /locations/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Location getLocationVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List locations
   * Get a list of locations, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param service Filter locations by prefix of the FQN (optional)
   * @param limit Limit the number locations returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of locations before this cursor (optional)
   * @param after Returns list of locations after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return LocationList
   */
  @RequestLine("GET /locations?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Location> listLocations(@Param("fields") String fields, @Param("service") String service, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List locations
   * Get a list of locations, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list10</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>service - Filter locations by prefix of the FQN (optional)</li>
   *   <li>limit - Limit the number locations returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of locations before this cursor (optional)</li>
   *   <li>after - Returns list of locations after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return LocationList

   */
  @RequestLine("GET /locations?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Location> listLocations(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list10</code> method in a fluent style.
   */
  class ListQueryParams extends HashMap<String, Object> {
    public ListQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListQueryParams service(final String value) {
      put("service", EncodingUtils.encode(value));
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
    public ListQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List locations that are prefixes
   * Get a list of locations. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fqn Fully qualified name of the location urlencoded if needed (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit the number locations returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of locations before this cursor (optional)
   * @param after Returns list of locations after this cursor (optional)
   * @return LocationList
   */
  @RequestLine("GET /locations/prefixes/{fqn}?fields={fields}&limit={limit}&before={before}&after={after}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Location> listPrefixes(@Param("fqn") String fqn, @Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after);

  /**
   * List locations that are prefixes
   * Get a list of locations. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>listPrefixes</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListPrefixesQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param fqn Fully qualified name of the location urlencoded if needed (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit the number locations returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of locations before this cursor (optional)</li>
   *   <li>after - Returns list of locations after this cursor (optional)</li>
   *   </ul>
   * @return LocationList

   */
  @RequestLine("GET /locations/prefixes/{fqn}?fields={fields}&limit={limit}&before={before}&after={after}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Location>  listPrefixes(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>listPrefixes</code> method in a fluent style.
   */
  class ListPrefixesQueryParams extends HashMap<String, Object> {
    public ListPrefixesQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListPrefixesQueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public ListPrefixesQueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public ListPrefixesQueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List location versions
   * Get a list of all the versions of a location identified by &#x60;id&#x60;
   * @param id location Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /locations/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listVersions8(@Param("id") String id);
  /**
   * Update a location
   * Update an existing location using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a location Documentation</a>
   */
  @RequestLine("PATCH /locations/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  void patch(@Param("id") String id, Object body);
}
