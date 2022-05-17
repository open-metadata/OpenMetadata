package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.api.data.CreateDatabaseSchema;
import org.openmetadata.catalog.entity.data.DatabaseSchema;

import java.util.HashMap;
import java.util.Map;
import feign.*;

import javax.ws.rs.core.Response;

public interface DatabaseSchemasApi extends ApiClient.Api {

  /**
   * Create a schema
   * Create a schema under an existing &#x60;service&#x60;.
   * @param body  (optional)
   * @return CreateDatabaseSchema
   */
  @RequestLine("POST /v1/databaseSchemas")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createDatabaseSchema(CreateDatabaseSchema body);
  /**
   * Create or update schema
   * Create a database schema, if it does not exist or update an existing database schema.
   * @param body  (optional)
   * @return CreateDatabaseSchema
   */
  @RequestLine("PUT /v1/databaseSchemas")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateDatabaseSchema body);
  /**
   * Delete a schema
   * Delete a schema by &#x60;id&#x60;. Schema can only be deleted if it has no tables.
   * @param id  (required)
   * @param recursive Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/databaseSchemas/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response delete(@Param("id") String id, @Param("recursive") Boolean recursive, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a schema
   * Delete a schema by &#x60;id&#x60;. Schema can only be deleted if it has no tables.
   * Note, this is equivalent to the other <code>delete3</code> method,
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
  @RequestLine("DELETE /v1/databaseSchemas/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response delete(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete3</code> method in a fluent style.
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
   * Get a schema
   * Get a database schema by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DatabaseSchema
   */
  @RequestLine("GET /v1/databaseSchemas/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  DatabaseSchema getDatabaseSchema(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a schema
   * Get a database schema by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get4</code> method,
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
   * @return DatabaseSchema

   */
  @RequestLine("GET /v1/databaseSchemas/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  DatabaseSchema getDatabaseSchema(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get4</code> method in a fluent style.
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
   * Get a schema by name
   * Get a database schema by fully qualified name.
   * @param fqn  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DatabaseSchema
   */
  @RequestLine("GET /v1/databaseSchemas/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  DatabaseSchema getByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a schema by name
   * Get a database schema by fully qualified name.
   * Note, this is equivalent to the other <code>getByName3</code> method,
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
   * @return DatabaseSchema

   */
  @RequestLine("GET /v1/databaseSchemas/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  DatabaseSchema getByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName3</code> method in a fluent style.
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
   * Get a version of the schema
   * Get a version of the database schema by given &#x60;id&#x60;
   * @param id Database schema Id (required)
   * @param version Database schema version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return DatabaseSchema
   */
  @RequestLine("GET /v1/databaseSchemas/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  DatabaseSchema getVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List database schemas
   * Get a list of database schemas, optionally filtered by &#x60;database&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param database Filter schemas by database name (optional)
   * @param limit Limit the number schemas returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of schemas before this cursor (optional)
   * @param after Returns list of schemas after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return DatabaseSchemaList
   */
  @RequestLine("GET /v1/databaseSchemas?fields={fields}&database={database}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<DatabaseSchema> getDatabaseSchemaList(@Param("fields") String fields, @Param("database") String database, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List database schemas
   * Get a list of database schemas, optionally filtered by &#x60;database&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list4</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>database - Filter schemas by database name (optional)</li>
   *   <li>limit - Limit the number schemas returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of schemas before this cursor (optional)</li>
   *   <li>after - Returns list of schemas after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return DatabaseSchemaList

   */
  @RequestLine("GET /v1/databaseSchemas?fields={fields}&database={database}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<DatabaseSchema> getDatabaseSchemaList(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list4</code> method in a fluent style.
   */
  class ListQueryParams extends HashMap<String, Object> {
    public ListQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListQueryParams database(final String value) {
      put("database", EncodingUtils.encode(value));
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
   * List schema versions
   * Get a list of all the versions of a schema identified by &#x60;id&#x60;
   * @param id Database schema Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/databaseSchemas/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listVersions(@Param("id") String id);
  /**
   * Update a database schema
   * Update an existing database schema using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a database schema Documentation</a>
   */
  @RequestLine("PATCH /v1/databaseSchemas/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
}
