package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;

import java.util.HashMap;
import java.util.Map;

import org.openmetadata.core.util.ResultList;
import feign.*;
import org.openmetadata.catalog.type.ChangeEvent;

public interface EventsApi extends ApiClient.Api {

  /**
   * Get change events
   * Get a list of change events matching event types, entity type, from a given date
   * @param timestamp Events starting from this unix timestamp in milliseconds (required)
   * @param entityCreated List of comma separated entities requested for &#x60;entityCreated&#x60; event. When set to &#x60;*&#x60; all entities will be returned (optional)
   * @param entityUpdated List of comma separated entities requested for &#x60;entityCreated&#x60; event. When set to &#x60;*&#x60; all entities will be returned (optional)
   * @param entityDeleted List of comma separated entities requested for &#x60;entityCreated&#x60; event. When set to &#x60;*&#x60; all entities will be returned (optional)
   * @return ChangeEvent
   */
  @RequestLine("GET /events?entityCreated={entityCreated}&entityUpdated={entityUpdated}&entityDeleted={entityDeleted}&timestamp={timestamp}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<ChangeEvent> getChangeEventList(@Param("timestamp") Long timestamp, @Param("entityCreated") String entityCreated, @Param("entityUpdated") String entityUpdated, @Param("entityDeleted") String entityDeleted);

  /**
   * Get change events
   * Get a list of change events matching event types, entity type, from a given date
   * Note, this is equivalent to the other <code>get6</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>entityCreated - List of comma separated entities requested for &#x60;entityCreated&#x60; event. When set to &#x60;*&#x60; all entities will be returned (optional)</li>
   *   <li>entityUpdated - List of comma separated entities requested for &#x60;entityCreated&#x60; event. When set to &#x60;*&#x60; all entities will be returned (optional)</li>
   *   <li>entityDeleted - List of comma separated entities requested for &#x60;entityCreated&#x60; event. When set to &#x60;*&#x60; all entities will be returned (optional)</li>
   *   <li>timestamp - Events starting from this unix timestamp in milliseconds (required)</li>
   *   </ul>
   * @return ChangeEvent

   */
  @RequestLine("GET /events?entityCreated={entityCreated}&entityUpdated={entityUpdated}&entityDeleted={entityDeleted}&timestamp={timestamp}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<ChangeEvent>  getChangeEventList(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get6</code> method in a fluent style.
   */
  class GetQueryParams extends HashMap<String, Object> {
    public GetQueryParams entityCreated(final String value) {
      put("entityCreated", EncodingUtils.encode(value));
      return this;
    }
    public GetQueryParams entityUpdated(final String value) {
      put("entityUpdated", EncodingUtils.encode(value));
      return this;
    }
    public GetQueryParams entityDeleted(final String value) {
      put("entityDeleted", EncodingUtils.encode(value));
      return this;
    }
    public GetQueryParams timestamp(final Long value) {
      put("timestamp", EncodingUtils.encode(value));
      return this;
    }
  }
}
