package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;

import java.util.HashMap;
import java.util.Map;
import feign.*;
import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.api.data.CreateTopic;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.type.EntityHistory;

import javax.ws.rs.core.Response;

public interface TopicsApi extends ApiClient.Api {

  /**
   * Add a follower
   * Add a user identified by &#x60;userId&#x60; as followed of this topic
   * @param id Id of the topic (required)
   * @param body Id of the user to be added as follower (optional)
   */
  @RequestLine("PUT /v1/topics/{id}/followers")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response addFollower(@Param("id") String id, String body);
  /**
   * Create a topic
   * Create a topic under an existing &#x60;service&#x60;.
   * @param body  (optional)
   * @return CreateTopic
   */
  @RequestLine("POST /v1/topics")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createTopic(CreateTopic body);
  /**
   * Update topic
   * Create a topic, it it does not exist or update an existing topic.
   * @param body  (optional)
   * @return CreateTopic
   */
  @RequestLine("PUT /v1/topics")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateTopic body);
  /**
   * Delete a topic
   * Delete a topic by &#x60;id&#x60;.
   * @param id Topic Id (required)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/topics/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteTopic(@Param("id") String id, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a topic
   * Delete a topic by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete20</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Topic Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/topics/{id}?hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteTopic(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete20</code> method in a fluent style.
   */
  class DeleteQueryParams extends HashMap<String, Object> {
    public DeleteQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Remove a follower
   * Remove the user identified &#x60;userId&#x60; as a follower of the topic.
   * @param id Id of the topic (required)
   * @param userId Id of the user being removed as follower (required)
   */
  @RequestLine("DELETE /v1/topics/{id}/followers/{userId}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response deleteFollower(@Param("id") String id, @Param("userId") String userId);
  /**
   * Get a topic
   * Get a topic by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Topic
   */
  @RequestLine("GET /v1/topics/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Topic getTopicByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a topic
   * Get a topic by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get27</code> method,
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
   * @return Topic

   */
  @RequestLine("GET /v1/topics/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Topic getTopicByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get27</code> method in a fluent style.
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
   * Get a topic by name
   * Get a topic by fully qualified name.
   * @param fqn  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Topic
   */
  @RequestLine("GET /v1/topics/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Topic getTopicByName(@Param("fqn") String fqn, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a topic by name
   * Get a topic by fully qualified name.
   * Note, this is equivalent to the other <code>getByName22</code> method,
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
   * @return Topic

   */
  @RequestLine("GET /v1/topics/name/{fqn}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Topic getTopicByName(@Param("fqn") String fqn, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName22</code> method in a fluent style.
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
   * Get a version of the topic
   * Get a version of the topic by given &#x60;id&#x60;
   * @param id Topic Id (required)
   * @param version Topic version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Topic
   */
  @RequestLine("GET /v1/topics/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Topic getTopicVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List topics
   * Get a list of topics, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param service Filter topics by service name (optional)
   * @param limit Limit the number topics returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of topics before this cursor (optional)
   * @param after Returns list of topics after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return TopicList
   */
  @RequestLine("GET /v1/topics?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Topic> listTopics(@Param("fields") String fields, @Param("service") String service, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List topics
   * Get a list of topics, optionally filtered by &#x60;service&#x60; it belongs to. Use &#x60;fields&#x60; parameter to get only necessary fields. Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list25</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>service - Filter topics by service name (optional)</li>
   *   <li>limit - Limit the number topics returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of topics before this cursor (optional)</li>
   *   <li>after - Returns list of topics after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return TopicList

   */
  @RequestLine("GET /v1/topics?fields={fields}&service={service}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Topic> listTopics(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list25</code> method in a fluent style.
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
   * List topic versions
   * Get a list of all the versions of a topic identified by &#x60;id&#x60;
   * @param id Topic Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/topics/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listTopicVersions(@Param("id") String id);
  /**
   * Update a topic
   * Update an existing topic using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a topic Documentation</a>
   */
  @RequestLine("PATCH /v1/topics/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
}
