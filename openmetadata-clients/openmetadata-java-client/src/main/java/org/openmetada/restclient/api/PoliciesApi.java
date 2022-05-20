package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;

import java.util.HashMap;
import java.util.Map;

import org.openmetadata.core.util.ResultList;
import feign.*;

import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.api.policies.CreatePolicy;
import org.openmetadata.catalog.entity.policies.Policy;

import feign.Response;

public interface PoliciesApi extends ApiClient.Api {

  /**
   * Create a policy
   * Create a new policy.
   * @param body  (optional)
   * @return CreatePolicy
   */
  @RequestLine("POST /policies")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createPolicy(CreatePolicy body);
  /**
   * Create or update a policy
   * Create a new policy, if it does not exist or update an existing policy.
   * @param body  (optional)
   * @return Policy
   */
  @RequestLine("PUT /policies")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreatePolicy body);
  /**
   * Delete a Policy
   * Delete a policy by &#x60;id&#x60;.
   * @param id Policy Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /policies/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deletePolicy(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a Policy
   * Delete a policy by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete10</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Policy Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /policies/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deletePolicy(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete10</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a policy
   * Get a policy by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Policy
   */
  @RequestLine("GET /policies/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Policy getPolicyWithID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a policy
   * Get a policy by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get16</code> method,
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
   * @return Policy

   */
  @RequestLine("GET /policies/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Policy getPolicyWithID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get16</code> method in a fluent style.
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
   * Get a policy by name
   * Get a policy by fully qualified name.
   * @param fqn  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Policy
   */
  @RequestLine("GET /policies/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Policy getPolicyByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a policy by name
   * Get a policy by fully qualified name.
   * Note, this is equivalent to the other <code>getByName12</code> method,
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
   * @return Policy

   */
  @RequestLine("GET /policies/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Policy getPolicyByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName12</code> method in a fluent style.
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
   * Get a version of the policy
   * Get a version of the policy by given &#x60;id&#x60;
   * @param id policy Id (required)
   * @param version policy version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Policy
   */
  @RequestLine("GET /policies/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Policy getVersion11(@Param("id") String id, @Param("version") String version);
  /**
   * List Policies
   * Get a list of policies. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit the number policies returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of policies before this cursor (optional)
   * @param after Returns list of policies after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return PolicyList
   */
  @RequestLine("GET /policies?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Policy> listPolicies(@Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List Policies
   * Get a list of policies. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list14</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit the number policies returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of policies before this cursor (optional)</li>
   *   <li>after - Returns list of policies after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return PolicyList

   */
  @RequestLine("GET /policies?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Policy> listPolicies(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list14</code> method in a fluent style.
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
   * List policy versions
   * Get a list of all the versions of a policy identified by &#x60;id&#x60;
   * @param id policy Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /policies/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listVersions11(@Param("id") String id);
  /**
   * Update a policy
   * Update an existing policy using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a policy Documentation</a>
   */
  @RequestLine("PATCH /policies/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
}
