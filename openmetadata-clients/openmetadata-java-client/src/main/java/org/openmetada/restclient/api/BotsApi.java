package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;

import java.util.HashMap;
import java.util.Map;

import org.openmetadata.core.util.ResultList;
import feign.*;
import org.openmetadata.catalog.api.CreateBot;
import org.openmetadata.catalog.entity.Bot;
import org.openmetadata.catalog.type.EntityHistory;

import feign.Response;

public interface BotsApi extends ApiClient.Api {

  /**
   * Create a bot
   * Create a new bot.
   * @param body  (optional)
   * @return Bots
   */
  @RequestLine("POST /bots")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response create(Bot body);

  /**
   * Create a bot if doesn't exist or update
   * @param body  (optional)
   * @return Bots
   */
  @RequestLine("PUT /bots")
  @Headers({
          "Content-Type: application/json",
          "Accept: application/json",
  })
  Response createOrUpdate(CreateBot body);

  /**
   * Update a bot
   * @return Bots
   */
  @RequestLine("PATCH /bots/{id}")
  @Headers({
          "Content-Type: application/json-patch+json",
          "Accept: application/json",
  })
  Response patch(@Param("id") String id);

  /**
   * Delete a bot
   * @return Bots
   */
  @RequestLine("DELETE /bots/{id}")
  @Headers({
          "Content-Type: application/jsons",
          "Accept: application/json",
  })
  Response delete(@Param("id") String id);
  /**
   * Get a bot
   * Get a bot by &#x60;id&#x60;.
   * @param id  (required)
   * @return Bots
   */
  @RequestLine("GET /bots/{id}")
  @Headers({
      "Accept: application/json",
  })
  Bot getBotByID(@Param("id") String id);
  /**
   * List bots
   * Get a list of bots.
   * @param limit  (optional)
   * @param before Returns list of bots before this cursor (optional)
   * @param after Returns list of bots after this cursor (optional)
   * @return BotsList
   */
  @RequestLine("GET /bots?limit={limit}&before={before}&after={after}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Bot> getBotsList(@Param("limit") Integer limit, @Param("before") String before, @Param("after") String after);

  /**
   * List bots
   * Get a list of bots.
   * Note, this is equivalent to the other <code>list</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>limit -  (optional)</li>
   *   <li>before - Returns list of bots before this cursor (optional)</li>
   *   <li>after - Returns list of bots after this cursor (optional)</li>
   *   </ul>
   * @return BotsList

   */
  @RequestLine("GET /bots?limit={limit}&before={before}&after={after}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Bot>  getBotsList(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * Get Bot By Name
   * Get a list of bots.
   *  Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>limit -  (optional)</li>
   *   <li>before - Returns list of bots before this cursor (optional)</li>
   *   <li>after - Returns list of bots after this cursor (optional)</li>
   *   </ul>
   * @return BotsList

   */
  @RequestLine("GET /bots/name/{fqn}")
  @Headers({
          "Content-Type: */*",
          "Accept: application/json",
  })
  Bot getBotsByFQN(@Param("fqn") String id);

  /**
   * Get Bots Version by Id
   * Get a list of bots.
   *   </ul>
   * @return EntityHistory

   */
  @RequestLine("GET /bots/{id}/versions")
  @Headers({
          "Content-Type: */*",
          "Accept: application/json",
  })
  EntityHistory getBotsVersion(@Param("id") String id);

  /**
   * Get Specific Version of Bot by Id
   * @return BotsList

   */
  @RequestLine("GET /bots/{id}/versions/{version}")
  @Headers({
          "Content-Type: */*",
          "Accept: application/json",
  })
  EntityHistory getBotsVersionById(@Param("id") String id, @Param("version") String version);
  /**
   * A convenience class for generating query parameters for the
   * <code>list</code> method in a fluent style.
   */
  class ListQueryParams extends HashMap<String, Object> {
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
  }
}
