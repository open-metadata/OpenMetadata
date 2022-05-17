package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.PipelineStatus;
import org.openmetadata.catalog.api.data.CreatePipeline;

import java.util.HashMap;
import java.util.Map;
import feign.*;

import javax.ws.rs.core.Response;

public interface PipelinesApi extends ApiClient.Api {

  /**
   * Add a follower
   * Add a user identified by &#x60;userId&#x60; as follower of this pipeline
   * @param id Id of the pipeline (required)
   * @param body Id of the user to be added as follower (optional)
   */
  @RequestLine("PUT /v1/pipelines/{id}/followers")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response addFollower(@Param("id") String id, String body);
  /**
   * Add status data
   * Add status data to the pipeline.
   * @param id Id of the pipeline (required)
   * @param body  (optional)
   * @return Pipeline
   */
  @RequestLine("PUT /v1/pipelines/{id}/status")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response addPipelineStatus(@Param("id") String id, PipelineStatus body);
  /**
   * Create a pipeline
   * Create a new pipeline.
   * @param body  (optional)
   * @return CreatePipeline
   */
  @RequestLine("POST /v1/pipelines")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createPipeline(CreatePipeline body);
  /**
   * Create or update a pipeline
   * Create a new pipeline, if it does not exist or update an existing pipeline.
   * @param body  (optional)
   * @return CreatePipeline
   */
  @RequestLine("PUT /v1/pipelines")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreatePipeline body);
  /**
   * Delete a Pipeline
   * Delete a pipeline by &#x60;id&#x60;.
   * @param id Chart Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/pipelines/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deletePipeline(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a Pipeline
   * Delete a pipeline by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete9</code> method,
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
  @RequestLine("DELETE /v1/pipelines/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deletePipeline(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete9</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Remove a follower
   * Remove the user identified &#x60;userId&#x60; as a follower of the pipeline.
   * @param id Id of the pipeline (required)
   * @param userId Id of the user being removed as follower (required)
   */
  @RequestLine("DELETE /v1/pipelines/{id}/followers/{userId}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response deleteFollowerFromPipelineWithUserID(@Param("id") String id, @Param("userId") String userId);
  /**
   * Get a pipeline
   * Get a pipeline by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Pipeline
   */
  @RequestLine("GET /v1/pipelines/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Pipeline getPipeline(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a pipeline
   * Get a pipeline by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get15</code> method,
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
   * @return Pipeline

   */
  @RequestLine("GET /v1/pipelines/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Pipeline getPipeline(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get15</code> method in a fluent style.
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
   * Get a pipeline by name
   * Get a pipeline by fully qualified name.
   * @param fqn  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Pipeline
   */
  @RequestLine("GET /v1/pipelines/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Pipeline getPipelineByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a pipeline by name
   * Get a pipeline by fully qualified name.
   * Note, this is equivalent to the other <code>getByName11</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByName11QueryParams} class that allows for
   * building up this map in a fluent style.
   * @param fqn  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Pipeline

   */
  @RequestLine("GET /v1/pipelines/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Pipeline getPipelineByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName11</code> method in a fluent style.
   */
  class GetByName11QueryParams extends HashMap<String, Object> {
    public GetByName11QueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetByName11QueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a version of the pipeline
   * Get a version of the pipeline by given &#x60;id&#x60;
   * @param id Pipeline Id (required)
   * @param version Pipeline version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Pipeline
   */
  @RequestLine("GET /v1/pipelines/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Pipeline getPipelineVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List Pipelines
   * Get a list of pipelines, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param service Filter pipelines by service name (optional)
   * @param limit Limit the number pipelines returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of pipelines before this cursor (optional)
   * @param after Returns list of pipelines after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return PipelineList
   */
  @RequestLine("GET /v1/pipelines?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Pipeline> listPipelines(@Param("fields") String fields, @Param("service") String service, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List Pipelines
   * Get a list of pipelines, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list13</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>service - Filter pipelines by service name (optional)</li>
   *   <li>limit - Limit the number pipelines returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of pipelines before this cursor (optional)</li>
   *   <li>after - Returns list of pipelines after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return PipelineList

   */
  @RequestLine("GET /v1/pipelines?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Pipeline> listPipelines(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list13</code> method in a fluent style.
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
   * List pipeline versions
   * Get a list of all the versions of a pipeline identified by &#x60;id&#x60;
   * @param id pipeline Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/pipelines/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listPipelineVersions(@Param("id") String id);
  /**
   * Update a Pipeline
   * Update an existing pipeline using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a Pipeline Documentation</a>
   */
  @RequestLine("PATCH /v1/pipelines/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
}
