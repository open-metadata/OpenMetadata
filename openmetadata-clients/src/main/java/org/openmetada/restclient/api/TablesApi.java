package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;


import java.util.HashMap;
import java.util.Map;
import feign.*;
import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.tests.CreateColumnTest;
import org.openmetadata.catalog.api.tests.CreateCustomMetric;
import org.openmetadata.catalog.api.tests.CreateTableTest;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.type.*;

import javax.ws.rs.core.Response;

public interface TablesApi extends ApiClient.Api {

  /**
   * Add column test cases
   * Add column test cases to the table.
   * @param id Id of the table (required)
   * @param body  (optional)
   * @return Table
   */
  @RequestLine("PUT /v1/tables/{id}/columnTest")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table addColumnTest(@Param("id") String id, CreateColumnTest body);
  /**
   * Add column custom metrics
   * Add column custom metrics.
   * @param id Id of the table (required)
   * @param body  (optional)
   * @return Table
   */
  @RequestLine("PUT /v1/tables/{id}/customMetric")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table addCustomMetric(@Param("id") String id, CreateCustomMetric body);
  /**
   * Add data modeling information to a table
   * Add data modeling (such as DBT model) information on how the table was created to the table.
   * @param id Id of the table (required)
   * @param body  (optional)
   * @return Table
   */
  @RequestLine("PUT /v1/tables/{id}/dataModel")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table addDataModel(@Param("id") String id, DataModel body);
  /**
   * Add table profile data
   * Add table profile data to the table.
   * @param id Id of the table (required)
   * @param body  (optional)
   * @return Table
   */
  @RequestLine("PUT /v1/tables/{id}/tableProfile")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table addDataProfiler(@Param("id") String id, TableProfile body);
  /**
   * Add a follower
   * Add a user identified by &#x60;userId&#x60; as followed of this table
   * @param id Id of the table (required)
   * @param body Id of the user to be added as follower (optional)
   */
  @RequestLine("PUT /v1/tables/{id}/followers")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response addFollower(@Param("id") String id, String body);
  /**
   * Add table join information
   * Add information about other tables that this table is joined with. Join information can only be added for the last 30 days starting today.
   * @param id Id of the table (required)
   * @param body  (optional)
   */
  @RequestLine("PUT /v1/tables/{id}/joins")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Table addJoins(@Param("id") String id, TableJoins body);
  /**
   * Add a location
   * Add a location identified by &#x60;locationId&#x60; to this table
   * @param id Id of the table (required)
   * @param body Id of the location to be added (optional)
   */
  @RequestLine("PUT /v1/tables/{id}/location")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response addLocation(@Param("id") String id, String body);
  /**
   * Add table query data
   * Add table query data to the table.
   * @param id Id of the table (required)
   * @param body  (optional)
   * @return Table
   */
  @RequestLine("PUT /v1/tables/{id}/tableQuery")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table addQuery(@Param("id") String id, SQLQuery body);
  /**
   * Add sample data
   * Add sample data to the table.
   * @param id Id of the table (required)
   * @param body  (optional)
   * @return Table
   */
  @RequestLine("PUT /v1/tables/{id}/sampleData")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table addSampleData(@Param("id") String id, TableData body);
  /**
   * Add table test cases
   * Add test cases to the table.
   * @param id Id of the table (required)
   * @param body  (optional)
   * @return Table
   */
  @RequestLine("PUT /v1/tables/{id}/tableTest")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table addTableTest(@Param("id") String id, CreateTableTest body);
  /**
   * Create a table
   * Create a new table under an existing &#x60;database&#x60;.
   * @param body  (optional)
   * @return CreateTable
   */
  @RequestLine("POST /v1/tables")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createTable(CreateTable body);
  /**
   * Create or update a table
   * Create a table, if it does not exist. If a table already exists, update the table.
   * @param body  (optional)
   * @return CreateTable
   */
  @RequestLine("PUT /v1/tables")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateTable body);
  /**
   * Delete a table
   * Delete a table by &#x60;id&#x60;. Table is not immediately deleted and is only marked as deleted.
   * @param id Id of the table (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/tables/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteTable(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a table
   * Delete a table by &#x60;id&#x60;. Table is not immediately deleted and is only marked as deleted.
   * Note, this is equivalent to the other <code>delete4</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Id of the table (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/tables/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteTable(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete4</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * delete column test case
   * Delete column test case from the table.
   * @param id Id of the table (required)
   * @param columnName column of the table (required)
   * @param columnTestType column Test Type (required)
   * @return Table
   */
  @RequestLine("DELETE /v1/tables/{id}/columnTest/{columnName}/{columnTestType}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table deleteColumnTest(@Param("id") String id, @Param("columnName") String columnName, @Param("columnTestType") String columnTestType);
  /**
   * delete custom metric from a column
   * Delete a custom metric from a column.
   * @param id Id of the table (required)
   * @param columnName column of the table (required)
   * @param customMetricName column Test Type (required)
   * @return Table
   */
  @RequestLine("DELETE /v1/tables/{id}/customMetric/{columnName}/{customMetricName}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table deleteCustomMetric(@Param("id") String id, @Param("columnName") String columnName, @Param("customMetricName") String customMetricName);
  /**
   * Remove a follower
   * Remove the user identified &#x60;userId&#x60; as a follower of the table.
   * @param id Id of the table (required)
   * @param userId Id of the user being removed as follower (required)
   */
  @RequestLine("DELETE /v1/tables/{id}/followers/{userId}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response deleteFollower(@Param("id") String id, @Param("userId") String userId);
  /**
   * Remove the location
   * Remove the location
   * @param id Id of the table (required)
   * @return Table
   */
  @RequestLine("DELETE /v1/tables/{id}/location")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table deleteLocation(@Param("id") String id);
  /**
   * delete table test case
   * Delete test case from the table.
   * @param id Id of the table (required)
   * @param tableTestType Table Test Type (required)
   * @return Table
   */
  @RequestLine("DELETE /v1/tables/{id}/tableTest/{tableTestType}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Table deleteTableTest(@Param("id") String id, @Param("tableTestType") String tableTestType);
  /**
   * Get a table
   * Get a table by &#x60;id&#x60;
   * @param id table Id (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Table
   */
  @RequestLine("GET /v1/tables/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Table getTableByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a table
   * Get a table by &#x60;id&#x60;
   * Note, this is equivalent to the other <code>get5</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id table Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Table

   */
  @RequestLine("GET /v1/tables/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Table getTableByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get5</code> method in a fluent style.
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
   * Get a table by name
   * Get a table by fully qualified table name.
   * @param fqn Fully qualified name of the table (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Table
   */
  @RequestLine("GET /v1/tables/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Table getTableByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a table by name
   * Get a table by fully qualified table name.
   * Note, this is equivalent to the other <code>getByName4</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param fqn Fully qualified name of the table (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Table

   */
  @RequestLine("GET /v1/tables/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Table getTableByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName4</code> method in a fluent style.
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
   * Get a version of the table
   * Get a version of the table by given &#x60;id&#x60;
   * @param id table Id (required)
   * @param version table version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Table
   */
  @RequestLine("GET /v1/tables/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Table getTableVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List tables
   * Get a list of tables, optionally filtered by &#x60;database&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param database Filter tables by database fully qualified name (optional)
   * @param limit Limit the number tables returned. (1 to 1000000, default &#x3D; 10)  (optional)
   * @param before Returns list of tables before this cursor (optional)
   * @param after Returns list of tables after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return TableList
   */
  @RequestLine("GET /v1/tables?fields={fields}&database={database}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Table> listTables(@Param("fields") String fields, @Param("database") String database, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List tables
   * Get a list of tables, optionally filtered by &#x60;database&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list5</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>database - Filter tables by database fully qualified name (optional)</li>
   *   <li>limit - Limit the number tables returned. (1 to 1000000, default &#x3D; 10)  (optional)</li>
   *   <li>before - Returns list of tables before this cursor (optional)</li>
   *   <li>after - Returns list of tables after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return TableList

   */
  @RequestLine("GET /v1/tables?fields={fields}&database={database}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Table> listTables(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list5</code> method in a fluent style.
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
   * List table versions
   * Get a list of all the versions of a table identified by &#x60;id&#x60;
   * @param id table Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/tables/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listTableVersions(@Param("id") String id);
  /**
   * Update a table
   * Update an existing table using JsonPatch.
   * @param id Id of the table (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a table Documentation</a>
   */
  @RequestLine("PATCH /v1/tables/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  void patch(@Param("id") String id, Object body);
}
