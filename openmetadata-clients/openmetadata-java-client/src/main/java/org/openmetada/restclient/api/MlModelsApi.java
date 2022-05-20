package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetadata.core.util.ResultList;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.api.data.CreateMlModel;

import java.util.HashMap;
import java.util.Map;
import feign.*;

import feign.Response;

public interface MlModelsApi extends ApiClient.Api {

  /**
   * Add a follower
   * Add a user identified by &#x60;userId&#x60; as follower of this model
   * @param id Id of the model (required)
   * @param body Id of the user to be added as follower (optional)
   */
  @RequestLine("PUT /mlmodels/{id}/followers")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response addFollower(@Param("id") String id, String body);
  /**
   * Create an ML Model
   * Create a new ML Model.
   * @param body  (optional)
   * @return CreateMlModel
   */
  @RequestLine("POST /mlmodels")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createMLModel(CreateMlModel body);
  /**
   * Create or update an ML Model
   * Create a new ML Model, if it does not exist or update an existing model.
   * @param body  (optional)
   * @return MlModel
   */
  @RequestLine("PUT /mlmodels")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateMlModel body);
  /**
   * Delete an ML Model
   * Delete an ML Model by &#x60;id&#x60;.
   * @param id ML Model Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /mlmodels/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteMLModel(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete an ML Model
   * Delete an ML Model by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete8</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id ML Model Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /mlmodels/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteMLModel(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete8</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Remove a follower
   * Remove the user identified &#x60;userId&#x60; as a follower of the model.
   * @param id Id of the model (required)
   * @param userId Id of the user being removed as follower (required)
   */
  @RequestLine("DELETE /mlmodels/{id}/followers/{userId}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response deleteFollower(@Param("id") String id, @Param("userId") String userId);
  /**
   * Get an ML Model
   * Get an ML Model by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return MlModel
   */
  @RequestLine("GET /mlmodels/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  MlModel getMLModel(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get an ML Model
   * Get an ML Model by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get14</code> method,
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
   * @return MlModel

   */
  @RequestLine("GET /mlmodels/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  MlModel getMLModel(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get14</code> method in a fluent style.
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
   * Get an ML Model by name
   * Get an ML Model by fully qualified name.
   * @param fqn  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return MlModel
   */
  @RequestLine("GET /mlmodels/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  MlModel getMLModelByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get an ML Model by name
   * Get an ML Model by fully qualified name.
   * Note, this is equivalent to the other <code>getByName10</code> method,
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
   * @return MlModel

   */
  @RequestLine("GET /mlmodels/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  MlModel getMLModelByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName10</code> method in a fluent style.
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
   * Get a version of the ML Model
   * Get a version of the ML Model by given &#x60;id&#x60;
   * @param id ML Model Id (required)
   * @param version ML Model version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return MlModel
   */
  @RequestLine("GET /mlmodels/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  MlModel getVersion9(@Param("id") String id, @Param("version") String version);
  /**
   * List ML Models
   * Get a list of ML Models. Use &#x60;fields&#x60; parameter to get only necessary fields.  Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit the number models returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of models before this cursor (optional)
   * @param after Returns list of models after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return MlModelList
   */
  @RequestLine("GET /mlmodels?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<MlModel> listMLModels(@Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List ML Models
   * Get a list of ML Models. Use &#x60;fields&#x60; parameter to get only necessary fields.  Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list12</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit the number models returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of models before this cursor (optional)</li>
   *   <li>after - Returns list of models after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return MlModelList

   */
  @RequestLine("GET /mlmodels?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<MlModel>  listMLModels(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list12</code> method in a fluent style.
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
   * List Ml Model versions
   * Get a list of all the versions of an Ml Model identified by &#x60;id&#x60;
   * @param id ML Model Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /mlmodels/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listMLModelVersions(@Param("id") String id);
  /**
   * Update an ML Model
   * Update an existing ML Model using JsonPatch.
   * @param id Id of the ML Model (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update an ML Model Documentation</a>
   */
  @RequestLine("PATCH /mlmodels/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  void patch(@Param("id") String id, Object body);
}
