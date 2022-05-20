package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;


import java.util.HashMap;
import java.util.Map;
import feign.*;
import org.openmetadata.core.util.ResultList;
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.type.EntityHistory;

public interface TeamsApi extends ApiClient.Api {

  /**
   * Create a team
   * Create a new team.
   * @param body  (optional)
   * @return CreateTeam
   */
  @RequestLine("POST /teams")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createTeam(CreateTeam body);
  /**
   * Update team
   * Create or Update a team.
   * @param body  (optional)
   * @return CreateTeam
   */
  @RequestLine("PUT /teams")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateTeam body);
  /**
   * Delete a team
   * Delete a team by given &#x60;id&#x60;.
   * @param id Team Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /teams/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteTeam(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a team
   * Delete a team by given &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete18</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Team Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /teams/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteTeam(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete18</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a team
   * Get a team by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Team
   */
  @RequestLine("GET /teams/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Team getTeamByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a team
   * Get a team by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get25</code> method,
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
   * @return Team

   */
  @RequestLine("GET /teams/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Team getTeamByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get25</code> method in a fluent style.
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
   * Get a team by name
   * Get a team by &#x60;name&#x60;.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Team
   */
  @RequestLine("GET /teams/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Team getTeamByName(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a team by name
   * Get a team by &#x60;name&#x60;.
   * Note, this is equivalent to the other <code>getByName20</code> method,
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
   * @return Team

   */
  @RequestLine("GET /teams/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Team getTeamByName(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName20</code> method in a fluent style.
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
   * Get a version of the team
   * Get a version of the team by given &#x60;id&#x60;
   * @param id Team Id (required)
   * @param version Team version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Team
   */
  @RequestLine("GET /teams/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Team getTeamVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List teams
   * Get a list of teams. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit the number of teams returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of teams before this cursor (optional)
   * @param after Returns list of teams after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return TeamList
   */
  @RequestLine("GET /teams?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Team> listTeams(@Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List teams
   * Get a list of teams. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list23</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit the number of teams returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of teams before this cursor (optional)</li>
   *   <li>after - Returns list of teams after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return TeamList

   */
  @RequestLine("GET /teams?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Team> listTeams(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list23</code> method in a fluent style.
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
    public ListQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List team versions
   * Get a list of all the versions of a team identified by &#x60;id&#x60;
   * @param id team Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /teams/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listTeamVersions(@Param("id") String id);
  /**
   * Update a team
   * Update an existing team with JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a team Documentation</a>
   */
  @RequestLine("PATCH /teams/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
}
