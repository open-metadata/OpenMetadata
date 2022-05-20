package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetadata.core.util.ResultList;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.api.teams.CreateRole;
import org.openmetadata.catalog.entity.teams.Role;
import java.util.HashMap;
import java.util.Map;
import feign.*;

import feign.Response;

public interface RolesApi extends ApiClient.Api {

  /**
   * Create a role
   * Create a new role.
   * @param body  (optional)
   * @return CreateRole
   */
  @RequestLine("POST /roles")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createReport(CreateRole body);
  /**
   * Update role
   * Create or Update a role.
   * @param body  (optional)
   * @return CreateRole
   */
  @RequestLine("PUT /roles")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdateRole(CreateRole body);
  /**
   * Delete a role
   * Delete a role by given &#x60;id&#x60;.
   * @param id  (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /roles/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteReport(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a role
   * Delete a role by given &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete17</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /roles/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteReport(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete17</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a role
   * Get a role by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Role
   */
  @RequestLine("GET /roles/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Role getRoleByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a role
   * Get a role by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get24</code> method,
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
   * @return Role

   */
  @RequestLine("GET /roles/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Role getRoleByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get24</code> method in a fluent style.
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
   * Get a role by name
   * Get a role by &#x60;name&#x60;.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Role
   */
  @RequestLine("GET /roles/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Role getRoleByName(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a role by name
   * Get a role by &#x60;name&#x60;.
   * Note, this is equivalent to the other <code>getByName19</code> method,
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
   * @return Role

   */
  @RequestLine("GET /roles/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Role getRoleByName(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName19</code> method in a fluent style.
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
   * Get a version of the role
   * Get a version of the role by given &#x60;id&#x60;
   * @param id Role Id (required)
   * @param version Role version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Role
   */
  @RequestLine("GET /roles/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Role getRoleVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List roles
   * Get a list of roles. Use cursor-based pagination to limit the number of entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param _default List only default role(s) (optional)
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit the number tables returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of tables before this cursor (optional)
   * @param after Returns list of tables after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return RoleList
   */
  @RequestLine("GET /roles?default={_default}&fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Role> listRoles(@Param("_default") Boolean _default, @Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List roles
   * Get a list of roles. Use cursor-based pagination to limit the number of entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list22</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>_default - List only default role(s) (optional)</li>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit the number tables returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of tables before this cursor (optional)</li>
   *   <li>after - Returns list of tables after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return RoleList

   */
  @RequestLine("GET /roles?default={_default}&fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Role> listRoles(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list22</code> method in a fluent style.
   */
  class ListQueryParams extends HashMap<String, Object> {
    public ListQueryParams _default(final Boolean value) {
      put("default", EncodingUtils.encode(value));
      return this;
    }
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
    public ListQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List role versions
   * Get a list of all the versions of a role identified by &#x60;id&#x60;
   * @param id role Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /roles/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listRoleVersions(@Param("id") String id);
  /**
   * Update a role
   * Update an existing role with JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a role Documentation</a>
   */
  @RequestLine("PATCH /roles/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
}
