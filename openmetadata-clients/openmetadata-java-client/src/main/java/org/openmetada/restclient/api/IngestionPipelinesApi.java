package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.api.services.ingestionPipelines.TestServiceConnection;

import java.util.HashMap;
import java.util.Map;
import feign.*;

public interface IngestionPipelinesApi extends ApiClient.Api {

  /**s
   * Create a Ingestion Pipeline
   * Create a new Ingestion Pipeline.
   * @param body  (optional)
   * @return CreateIngestionPipeline
   */
  @RequestLine("POST /services/ingestionPipelines")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createIngestionPipeline(CreateIngestionPipeline body);
  /**
   * Create or update a IngestionPipeline
   * Create a new IngestionPipeline, if it does not exist or update an existing IngestionPipeline.
   * @param body  (optional)
   * @return IngestionPipeline
   */
  @RequestLine("PUT /services/ingestionPipelines")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateIngestionPipeline body);
  /**
   * Delete a Ingestion
   * Delete a ingestion by &#x60;id&#x60;.
   * @param id Pipeline Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /services/ingestionPipelines/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteIngestionPipeline(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a Ingestion
   * Delete a ingestion by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete13</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Pipeline Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /services/ingestionPipelines/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteIngestionPipeline(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a IngestionPipeline
   * Get a IngestionPipeline by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return IngestionPipeline
   */
  @RequestLine("GET /services/ingestionPipelines/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  IngestionPipeline getIngestionPipelineByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a IngestionPipeline
   * Get a IngestionPipeline by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get20</code> method,
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
   * @return IngestionPipeline

   */
  @RequestLine("GET /services/ingestionPipelines/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  IngestionPipeline getIngestionPipelineByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get20</code> method in a fluent style.
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
   * Get a IngestionPipeline by name
   * Get a ingestion by fully qualified name.
   * @param fqn  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return IngestionPipeline
   */
  @RequestLine("GET /services/ingestionPipelines/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  IngestionPipeline getIngestionPipelineByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a IngestionPipeline by name
   * Get a ingestion by fully qualified name.
   * Note, this is equivalent to the other <code>getByName15</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByName15QueryParams} class that allows for
   * building up this map in a fluent style.
   * @param fqn  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return IngestionPipeline

   */
  @RequestLine("GET /services/ingestionPipelines/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  IngestionPipeline getIngestionPipelineByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName15</code> method in a fluent style.
   */
  class GetByName15QueryParams extends HashMap<String, Object> {
    public GetByName15QueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetByName15QueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a version of the IngestionPipeline
   * Get a version of the IngestionPipeline by given &#x60;id&#x60;
   * @param id Ingestion Id (required)
   * @param version Ingestion version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return IngestionPipeline
   */
  @RequestLine("GET /services/ingestionPipelines/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  IngestionPipeline getIngestionPipelineVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List Ingestion Pipelines for Metadata Operations
   * Get a list of Airflow Pipelines for Metadata Operations. Use &#x60;fields&#x60; parameter to get only necessary fields.  Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param service Filter airflow pipelines by service fully qualified name (optional)
   * @param limit Limit the number ingestion returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of ingestion before this cursor (optional)
   * @param after Returns list of ingestion after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return IngestionPipeline
   */
  @RequestLine("GET /services/ingestionPipelines?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  IngestionPipeline listIngestionPipeline(@Param("fields") String fields, @Param("service") String service, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List Ingestion Pipelines for Metadata Operations
   * Get a list of Airflow Pipelines for Metadata Operations. Use &#x60;fields&#x60; parameter to get only necessary fields.  Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list18</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>service - Filter airflow pipelines by service fully qualified name (optional)</li>
   *   <li>limit - Limit the number ingestion returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of ingestion before this cursor (optional)</li>
   *   <li>after - Returns list of ingestion after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return IngestionPipeline

   */
  @RequestLine("GET /services/ingestionPipelines?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  IngestionPipeline listIngestionPipeline(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list18</code> method in a fluent style.
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
   * List ingestion workflow versions
   * Get a list of all the versions of a IngestionPipeline identified by &#x60;id&#x60;
   * @param id IngestionPipeline Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /services/ingestionPipelines/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listIngestionPipelineVersions(@Param("id") String id);
  /**
   * Test Connection of a Service
   * Test Connection of a Service.
   * @param body  (optional)
   * @return IngestionPipeline
   */
  @RequestLine("POST /services/ingestionPipelines/testConnection")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  IngestionPipeline testIngestion(TestServiceConnection body);
  /**
   * Trigger a airflow pipeline run
   * Trigger a airflow pipeline run by id.
   * @param id  (required)
   * @return IngestionPipeline
   */
  @RequestLine("POST /services/ingestionPipelines/trigger/{id}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  IngestionPipeline triggerIngestion(@Param("id") String id);
  /**
   * Update a IngestionPipeline
   * Update an existing IngestionPipeline using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a IngestionPipeline Documentation</a>
   */
  @RequestLine("PATCH /services/ingestionPipelines/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  void patchIngestionPipeline(@Param("id") String id, Object body);
}
