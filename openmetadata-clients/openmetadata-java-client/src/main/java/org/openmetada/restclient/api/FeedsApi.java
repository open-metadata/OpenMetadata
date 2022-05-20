package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;
import org.openmetadata.core.util.ResultList;
import org.openmetadata.catalog.entity.feed.Thread;

import org.openmetadata.catalog.api.feed.CreatePost;
import org.openmetadata.catalog.api.feed.CreateThread;
import org.openmetadata.catalog.api.feed.ThreadCount;

import java.util.HashMap;
import java.util.Map;
import feign.*;

public interface FeedsApi extends ApiClient.Api {

  /**
   * Add post to a thread
   * Add a post to an existing thread.
   * @param id  (required)
   * @param body  (optional)
   * @return CreatePost
   */
  @RequestLine("POST /feed/{id}/posts")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response addPost(@Param("id") String id,CreatePost body);
  /**
   * Create a thread
   * Create a new thread. A thread is created about a data asset when a user posts the first post.
   * @param body  (optional)
   * @return CreateThread
   */
  @RequestLine("POST /feed")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response create(CreateThread body);
  /**
   * Delete a post from its thread
   * Delete a post from an existing thread.
   * @param threadId ThreadId of the post to be deleted (required)
   * @param postId PostId of the post to be deleted (required)
   */
  @RequestLine("DELETE /feed/{threadId}/posts/{postId}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deletePost(@Param("threadId") String threadId, @Param("postId") String postId);
  /**
   * Get a thread
   * Get a thread by &#x60;id&#x60;.
   * @param id  (required)
   * @return Thread
   */
  @RequestLine("GET /feed/{id}")
  @Headers({
      "Accept: application/json",
  })
  Thread getThreadByID(@Param("id") String id);
  /**
   * Get all the posts of a thread
   * Get all the posts of an existing thread.
   * @param id  (required)
   * @return PostList
   */
  @RequestLine("GET /feed/{id}/posts")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Thread> getPosts(@Param("id") String id);
  /**
   * count of threads
   * Get a count of threads, optionally filtered by &#x60;entityLink&#x60; for each of the entities.
   * @param entityLink Filter threads by entity link (optional)
   * @param isResolved Filter threads by whether it is active or resolved (optional)
   * @return ThreadCount
   */
  @RequestLine("GET /feed/count?entityLink={entityLink}&isResolved={isResolved}")
  @Headers({
      "Accept: application/json",
  })
  ThreadCount getThreadCount(@Param("entityLink") String entityLink, @Param("isResolved") Boolean isResolved);

  /**
   * count of threads
   * Get a count of threads, optionally filtered by &#x60;entityLink&#x60; for each of the entities.
   * Note, this is equivalent to the other <code>getThreadCount</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetThreadCountQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>entityLink - Filter threads by entity link (optional)</li>
   *   <li>isResolved - Filter threads by whether it is active or resolved (optional)</li>
   *   </ul>
   * @return ThreadCount

   */
  @RequestLine("GET /feed/count?entityLink={entityLink}&isResolved={isResolved}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ThreadCount getThreadCount(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getThreadCount</code> method in a fluent style.
   */
  class GetThreadCountQueryParams extends HashMap<String, Object> {
    public GetThreadCountQueryParams entityLink(final String value) {
      put("entityLink", EncodingUtils.encode(value));
      return this;
    }
    public GetThreadCountQueryParams isResolved(final Boolean value) {
      put("isResolved", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List threads
   * Get a list of threads, optionally filtered by &#x60;entityLink&#x60;.
   * @param limitPosts Limit the number of posts sorted by chronological order (1 to 1000000, default &#x3D; 3) (optional)
   * @param limit Limit the number of threads returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of threads before this cursor (optional)
   * @param after Returns list of threads after this cursor (optional)
   * @param entityLink Filter threads by entity link (optional)
   * @param userId Filter threads by user id. This filter requires a &#x27;filterType&#x27; query param. The default filter type is &#x27;OWNER&#x27;. This filter cannot be combined with the entityLink filter. (optional)
   * @param filterType Filter type definition for the user filter. It can take one of &#x27;OWNER&#x27;, &#x27;FOLLOWS&#x27;, &#x27;MENTIONS&#x27;. This must be used with the &#x27;user&#x27; query param (optional)
   * @param resolved Filter threads by whether they are resolved or not. By default resolved is false (optional)
   * @return ThreadList
   */
  @RequestLine("GET /feed?limitPosts={limitPosts}&limit={limit}&before={before}&after={after}&entityLink={entityLink}&userId={userId}&filterType={filterType}&resolved={resolved}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Thread> listThreads(@Param("limitPosts") Long limitPosts, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("entityLink") String entityLink, @Param("userId") String userId, @Param("filterType") String filterType, @Param("resolved") Boolean resolved);

  /**
   * List threads
   * Get a list of threads, optionally filtered by &#x60;entityLink&#x60;.
   * Note, this is equivalent to the other <code>list7</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>limitPosts - Limit the number of posts sorted by chronological order (1 to 1000000, default &#x3D; 3) (optional)</li>
   *   <li>limit - Limit the number of threads returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of threads before this cursor (optional)</li>
   *   <li>after - Returns list of threads after this cursor (optional)</li>
   *   <li>entityLink - Filter threads by entity link (optional)</li>
   *   <li>userId - Filter threads by user id. This filter requires a &#x27;filterType&#x27; query param. The default filter type is &#x27;OWNER&#x27;. This filter cannot be combined with the entityLink filter. (optional)</li>
   *   <li>filterType - Filter type definition for the user filter. It can take one of &#x27;OWNER&#x27;, &#x27;FOLLOWS&#x27;, &#x27;MENTIONS&#x27;. This must be used with the &#x27;user&#x27; query param (optional)</li>
   *   <li>resolved - Filter threads by whether they are resolved or not. By default resolved is false (optional)</li>
   *   </ul>
   * @return ThreadList

   */
  @RequestLine("GET /feed?limitPosts={limitPosts}&limit={limit}&before={before}&after={after}&entityLink={entityLink}&userId={userId}&filterType={filterType}&resolved={resolved}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Thread> listThreads(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list7</code> method in a fluent style.
   */
  class ListQueryParams extends HashMap<String, Object> {
    public ListQueryParams limitPosts(final Long value) {
      put("limitPosts", EncodingUtils.encode(value));
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
    public ListQueryParams entityLink(final String value) {
      put("entityLink", EncodingUtils.encode(value));
      return this;
    }
    public ListQueryParams userId(final String value) {
      put("userId", EncodingUtils.encode(value));
      return this;
    }
    public ListQueryParams filterType(final String value) {
      put("filterType", EncodingUtils.encode(value));
      return this;
    }
    public ListQueryParams resolved(final Boolean value) {
      put("resolved", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Update a thread by &#x60;id&#x60;.
   * Update an existing thread using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a thread by &#x60;id&#x60;. Documentation</a>
   */
  @RequestLine("PATCH /feed/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response updateThread(@Param("id") String id, Object body);
}
