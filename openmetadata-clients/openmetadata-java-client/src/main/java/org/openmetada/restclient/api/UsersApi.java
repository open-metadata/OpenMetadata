package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;

import java.util.HashMap;
import java.util.Map;
import feign.*;
import org.openmetadata.core.util.ResultList;
import org.openmetadata.catalog.api.teams.CreateUser;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.type.EntityHistory;

import feign.Response;

public interface UsersApi extends ApiClient.Api {

  /**
   * Update user
   * Create or Update a user.
   * @param body  (optional)
   * @return CreateUser
   */
  @RequestLine("PUT /users")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdateUser(CreateUser body);
  /**
   * Create a user
   * Create a new user.
   * @param body  (optional)
   * @return CreateUser
   */
  @RequestLine("POST /users")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  feign.Response createUser(CreateUser body);
  /**
   * Delete a user
   * Users can&#x27;t be deleted but are soft-deleted.
   * @param id User Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /users/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteUser(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a user
   * Users can&#x27;t be deleted but are soft-deleted.
   * Note, this is equivalent to the other <code>delete19</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id User Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /users/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteUser(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete19</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a user
   * Get a user by &#x60;id&#x60;
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return User
   */
  @RequestLine("GET /users/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  User getUserByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a user
   * Get a user by &#x60;id&#x60;
   * Note, this is equivalent to the other <code>get26</code> method,
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
   * @return User

   */
  @RequestLine("GET /users/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  User getUserByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get26</code> method in a fluent style.
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
   * Get a user by name
   * Get a user by &#x60;name&#x60;.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return User
   */
  @RequestLine("GET /users/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  User getUserByName(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a user by name
   * Get a user by &#x60;name&#x60;.
   * Note, this is equivalent to the other <code>getByName21</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param name  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return User

   */
  @RequestLine("GET /users/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  User getUserByName(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName21</code> method in a fluent style.
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
   * Get current logged in user
   * Get the user who is authenticated and is currently logged in.
   * @param fields Fields requested in the returned resource (optional)
   * @return User
   */
  @RequestLine("GET /users/loggedInUser?fields={fields}")
  @Headers({
      "Accept: application/json",
  })
  User getCurrentLoggedInUser(@Param("fields") String fields);

  /**
   * Get current logged in user
   * Get the user who is authenticated and is currently logged in.
   * Note, this is equivalent to the other <code>getCurrentLoggedInUser</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetCurrentLoggedInUserQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   </ul>
   * @return User

   */
  @RequestLine("GET /users/loggedInUser?fields={fields}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  User getCurrentLoggedInUser(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getCurrentLoggedInUser</code> method in a fluent style.
   */
  class GetCurrentLoggedInUserQueryParams extends HashMap<String, Object> {
    public GetCurrentLoggedInUserQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a version of the user
   * Get a version of the user by given &#x60;id&#x60;
   * @param id User Id (required)
   * @param version User version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return User
   */
  @RequestLine("GET /users/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  User getUserVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List users
   * Get a list of users. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param team Filter users by team (optional)
   * @param limit Limit the number users returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of users before this cursor (optional)
   * @param after Returns list of users after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return UserList
   */
  @RequestLine("GET /users?fields={fields}&team={team}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<User> listUsers(@Param("fields") String fields, @Param("team") String team, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List users
   * Get a list of users. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list24</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>team - Filter users by team (optional)</li>
   *   <li>limit - Limit the number users returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of users before this cursor (optional)</li>
   *   <li>after - Returns list of users after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return UserList

   */
  @RequestLine("GET /users?fields={fields}&team={team}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<User> listUsers(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list24</code> method in a fluent style.
   */
  class ListQueryParams extends HashMap<String, Object> {
    public ListQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListQueryParams team(final String value) {
      put("team", EncodingUtils.encode(value));
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
   * List user versions
   * Get a list of all the versions of a user identified by &#x60;id&#x60;
   * @param id user Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /users/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listUserVersions(@Param("id") String id);
  /**
   * Update a user
   * Update an existing user using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a user Documentation</a>
   */
  @RequestLine("PATCH /users/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
}
