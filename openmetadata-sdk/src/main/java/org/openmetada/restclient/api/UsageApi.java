package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;

import java.util.HashMap;
import java.util.Map;
import feign.*;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.EntityUsage;

public interface UsageApi extends ApiClient.Api {

  /**
   * Report usage
   * Report usage information for an entity on a given date. System stores last 30 days of usage information. Usage information older than 30 days is deleted.
   * @param entity Entity type for which usage is reported (required)
   * @param id Entity id (required)
   * @param body Usage information a given date (optional)
   * @return EntityUsage
   */
  @RequestLine("POST /v1/usage/{entity}/{id}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createUsage(@Param("entity") String entity, @Param("id") String id, DailyCount body);
  /**
   * Report usage by name
   * Report usage information for an entity by name on a given date. System stores last 30 days of usage information. Usage information older than 30 days is deleted.
   * @param entity Entity type for which usage is reported (required)
   * @param fqn Fully qualified name of the entity that uniquely identifies an entity (required)
   * @param body Usage information a given date (optional)
   * @return EntityUsage
   */
  @RequestLine("POST /v1/usage/{entity}/name/{fqn}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createByName(@Param("entity") String entity, @Param("fqn") String fqn, DailyCount body);
  /**
   * Get usage
   * Get usage details for an entity identified by &#x60;id&#x60;.
   * @param entity Entity type for which usage is requested (required)
   * @param id Entity id (required)
   * @param days Usage for number of days going back from the given date (default&#x3D;1, min&#x3D;1, max&#x3D;30) (optional)
   * @param date Usage for number of days going back from this date in ISO 8601 format. (default &#x3D; currentDate) (optional)
   * @return EntityUsage
   */
  @RequestLine("GET /v1/usage/{entity}/{id}?days={days}&date={date}")
  @Headers({
      "Accept: application/json",
  })
  EntityUsage getUsage(@Param("entity") String entity, @Param("id") String id, @Param("days") Integer days, @Param("date") String date);

  /**
   * Get usage
   * Get usage details for an entity identified by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get28</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param entity Entity type for which usage is requested (required)
   * @param id Entity id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>days - Usage for number of days going back from the given date (default&#x3D;1, min&#x3D;1, max&#x3D;30) (optional)</li>
   *   <li>date - Usage for number of days going back from this date in ISO 8601 format. (default &#x3D; currentDate) (optional)</li>
   *   </ul>
   * @return EntityUsage

   */
  @RequestLine("GET /v1/usage/{entity}/{id}?days={days}&date={date}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  EntityUsage getUsage(@Param("entity") String entity, @Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get28</code> method in a fluent style.
   */
  class GetQueryParams extends HashMap<String, Object> {
    public GetQueryParams days(final Integer value) {
      put("days", EncodingUtils.encode(value));
      return this;
    }
    public GetQueryParams date(final String value) {
      put("date", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get usage by name
   * Get usage details for an entity identified by fully qualified name.
   * @param entity Entity type for which usage is requested (required)
   * @param fqn Fully qualified name of the entity that uniquely identifies an entity (required)
   * @param days Usage for number of days going back from the given date (default&#x3D;1, min&#x3D;1, max&#x3D;30) (optional)
   * @param date Usage for number of days going back from this date in ISO 8601 format (default &#x3D; currentDate) (optional)
   * @return EntityUsage
   */
  @RequestLine("GET /v1/usage/{entity}/name/{fqn}?days={days}&date={date}")
  @Headers({
      "Accept: application/json",
  })
  EntityUsage getUsageByName(@Param("entity") String entity, @Param("fqn") String fqn, @Param("days") Integer days, @Param("date") String date);

  /**
   * Get usage by name
   * Get usage details for an entity identified by fully qualified name.
   * Note, this is equivalent to the other <code>getByName23</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetByNameQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param entity Entity type for which usage is requested (required)
   * @param fqn Fully qualified name of the entity that uniquely identifies an entity (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>days - Usage for number of days going back from the given date (default&#x3D;1, min&#x3D;1, max&#x3D;30) (optional)</li>
   *   <li>date - Usage for number of days going back from this date in ISO 8601 format (default &#x3D; currentDate) (optional)</li>
   *   </ul>
   * @return EntityUsage

   */
  @RequestLine("GET /v1/usage/{entity}/name/{fqn}?days={days}&date={date}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  EntityUsage getUsageByName(@Param("entity") String entity, @Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName23</code> method in a fluent style.
   */
  class GetByNameQueryParams extends HashMap<String, Object> {
    public GetByNameQueryParams days(final Integer value) {
      put("days", EncodingUtils.encode(value));
      return this;
    }
    public GetByNameQueryParams date(final String value) {
      put("date", EncodingUtils.encode(value));
      return this;
    }
  }
}
