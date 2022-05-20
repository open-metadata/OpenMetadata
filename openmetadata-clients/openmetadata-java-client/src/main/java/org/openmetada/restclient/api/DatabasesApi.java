package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetadata.core.util.ResultList;
import org.openmetadata.catalog.api.data.CreateDatabase;
import org.openmetadata.catalog.entity.data.Database;

import java.util.HashMap;
import java.util.Map;
import feign.*;
import org.openmetadata.catalog.type.EntityHistory;

import feign.Response;

public interface DatabasesApi extends ApiClient.Api {

  /**
   * Create a database
   * Create a database under an existing &#x60;service&#x60;.
   * @param body  (optional)
   * @return CreateDatabase
   */
  @RequestLine("POST /databases")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createDatabase(CreateDatabase body);
  /**
   * Create or update database
   * Create a database, if it does not exist or update an existing database.
   * @param body  (optional)
   * @return CreateDatabase
   */
  @RequestLine("PUT /databases")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateDatabase body);
  /**
   * Delete a database
   * Delete a database by &#x60;id&#x60;. Database can only be deleted if it has no tables.
   * @param id  (required)
   * @param recursive Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /databases/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response delete(@Param("id") String id, @Param("recursive") Boolean recursive, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a database
   * Delete a database by &#x60;id&#x60;. Database can only be deleted if it has no tables.
   * Note, this is equivalent to the other <code>delete2</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>recursive - Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)</li>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /databases/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response delete(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete2</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams recursive(final Boolean value) {
      put("recursive", EncodingUtils.encode(value));
      return this;
    }
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Remove the location
   * Remove the location
   * @param id Id of the database (required)
   * @return Database
   */
  @RequestLine("DELETE /databases/{id}/location")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Database deleteLocation(@Param("id") String id);
  /**
   * Get a database
   * Get a database by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Database
   */
  @RequestLine("GET /databases/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Database getDatabase(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a database
   * Get a database by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get3</code> method,
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
   * @return Database

   */
  @RequestLine("GET /databases/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Database getDatabase(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get3</code> method in a fluent style.
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
   * Get a database by name
   * Get a database by fully qualified name.
   * @param fqn  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Database
   */
  @RequestLine("GET /databases/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Database getByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a database by name
   * Get a database by fully qualified name.
   * Note, this is equivalent to the other <code>getByName2</code> method,
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
   * @return Database

   */
  @RequestLine("GET /databases/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Database getByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName2</code> method in a fluent style.
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
   * Get a version of the database
   * Get a version of the database by given &#x60;id&#x60;
   * @param id Database Id (required)
   * @param version Database version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Database
   */
  @RequestLine("GET /databases/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Database getVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List databases
   * Get a list of databases, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param service Filter databases by service name (optional)
   * @param limit Limit the number tables returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of tables before this cursor (optional)
   * @param after Returns list of tables after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DatabaseList
   */
  @RequestLine("GET /databases?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Database> listDatabases(@Param("fields") String fields, @Param("service") String service, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List databases
   * Get a list of databases, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list3</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>service - Filter databases by service name (optional)</li>
   *   <li>limit - Limit the number tables returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of tables before this cursor (optional)</li>
   *   <li>after - Returns list of tables after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return DatabaseList

   */
  @RequestLine("GET /databases?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Database>  listDatabases(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list3</code> method in a fluent style.
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
   * List database versions
   * Get a list of all the versions of a database identified by &#x60;id&#x60;
   * @param id database Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /databases/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listVersions(@Param("id") String id);
  /**
   * Update a database
   * Update an existing database using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a database Documentation</a>
   */
  @RequestLine("PATCH /databases/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
}
