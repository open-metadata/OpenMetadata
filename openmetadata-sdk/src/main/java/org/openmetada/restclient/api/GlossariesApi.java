package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;

import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.api.data.CreateGlossaryTerm;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.api.data.CreateGlossary;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.type.EntityHistory;

import java.util.HashMap;
import java.util.Map;
import feign.*;
import javax.ws.rs.core.Response;

public interface GlossariesApi extends ApiClient.Api {

  /**
   * Create a glossary
   * Create a new glossary.
   * @param body  (optional)
   * @return CreateGlossary
   */
  @RequestLine("POST /v1/glossaries")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createGlossary(CreateGlossary body);
  /**
   * Create a glossary term
   * Create a new glossary term.
   * @param body  (optional)
   * @return GlossaryTerm
   */
  @RequestLine("POST /v1/glossaryTerms")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createGlossaryTerm(CreateGlossaryTerm body);
  /**
   * Create or update a glossary
   * Create a new glossary, if it does not exist or update an existing glossary.
   * @param body  (optional)
   * @return Glossary
   */
  @RequestLine("PUT /v1/glossaries")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateGlossary body);
  /**
   * Create or update a glossary term
   * Create a new glossary term, if it does not exist or update an existing glossary term.
   * @param body  (optional)
   * @return GlossaryTerm
   */
  @RequestLine("PUT /v1/glossaryTerms")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Response createOrUpdate(CreateGlossaryTerm body);
  /**
   * Delete a Glossary
   * Delete a glossary by &#x60;id&#x60;.
   * @param id Chart Id (required)
   * @param recursive Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/glossaries/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteGlossary(@Param("id") String id, @Param("recursive") Boolean recursive, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a Glossary
   * Delete a glossary by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete5</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Chart Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>recursive - Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)</li>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/glossaries/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteGlossary(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete5</code> method in a fluent style.
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
   * Delete a glossary term
   * Delete a glossary term by &#x60;id&#x60;.
   * @param id Chart Id (required)
   * @param recursive Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)
   * @param hardDelete Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)
   */
  @RequestLine("DELETE /v1/glossaryTerms/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
      "Accept: */*",
  })
  Response deleteGlossaryTerm(@Param("id") String id, @Param("recursive") Boolean recursive, @Param("hardDelete") Boolean hardDelete);

  /**
   * Delete a glossary term
   * Delete a glossary term by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>delete6</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link DeleteQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id Chart Id (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>recursive - Recursively delete this entity and it&#x27;s children. (Default &#x60;false&#x60;) (optional)</li>
   *   <li>hardDelete - Hard delete the entity. (Default &#x3D; &#x60;false&#x60;) (optional)</li>
   *   </ul>

   */
  @RequestLine("DELETE /v1/glossaryTerms/{id}?recursive={recursive}&hardDelete={hardDelete}")
  @Headers({
      "Content-Type: application/json",
  })
  Response deleteGlossaryTerm(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>delete6</code> method in a fluent style.
   */
  class DeleteTermsQueryParams extends HashMap<String, Object> {
    public DeleteTermsQueryParams recursive(final Boolean value) {
      put("recursive", EncodingUtils.encode(value));
      return this;
    }
    public DeleteTermsQueryParams hardDelete(final Boolean value) {
      put("hardDelete", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a glossary term
   * Get a glossary term by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Glossary
   */
  @RequestLine("GET /v1/glossaryTerms/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  GlossaryTerm getGlossaryTermWithID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a glossary term
   * Get a glossary term by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get10</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetTermsQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Glossary

   */
  @RequestLine("GET /v1/glossaryTerms/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  GlossaryTerm getGlossaryTermWithID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get10</code> method in a fluent style.
   */
  class GetTermsQueryParams extends HashMap<String, Object> {
    public GetTermsQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetTermsQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a glossary
   * Get a glossary by &#x60;id&#x60;.
   * @param id  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Glossary
   */
  @RequestLine("GET /v1/glossaries/{id}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Glossary getGlossariesByID(@Param("id") String id, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a glossary
   * Get a glossary by &#x60;id&#x60;.
   * Note, this is equivalent to the other <code>get9</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetGlossaryQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param id  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Glossary

   */
  @RequestLine("GET /v1/glossaries/{id}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Glossary getGlossariesByID(@Param("id") String id, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>get9</code> method in a fluent style.
   */
  class GetGlossaryQueryParams extends HashMap<String, Object> {
    public GetGlossaryQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetGlossaryQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a glossary by name
   * Get a glossary by name.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Glossary
   */
  @RequestLine("GET /v1/glossaries/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  Glossary getGlossaryByName(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a glossary by name
   * Get a glossary by name.
   * Note, this is equivalent to the other <code>getByName6</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetGlossaryByNameQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param name  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Glossary

   */
  @RequestLine("GET /v1/glossaries/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Glossary getGlossaryByName(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName6</code> method in a fluent style.
   */
  class GetGlossaryByNameQueryParams extends HashMap<String, Object> {
    public GetGlossaryByNameQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetGlossaryByNameQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a glossary term by name
   * Get a glossary term by name.
   * @param name  (required)
   * @param fields Fields requested in the returned resource (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return Glossary
   */
  @RequestLine("GET /v1/glossaryTerms/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  GlossaryTerm getGlossaryTermByName(@Param("name") String name, @Param("fields") String fields, @Param("include") String include);

  /**
   * Get a glossary term by name
   * Get a glossary term by name.
   * Note, this is equivalent to the other <code>getByName7</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetTermByNameQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param name  (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return Glossary

   */
  @RequestLine("GET /v1/glossaryTerms/name/{name}?fields={fields}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  GlossaryTerm getGlossaryTermByName(@Param("name") String name, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getByName7</code> method in a fluent style.
   */
  class GetTermByNameQueryParams extends HashMap<String, Object> {
    public GetTermByNameQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GetTermByNameQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a version of the glossaries
   * Get a version of the glossary by given &#x60;id&#x60;
   * @param id glossary Id (required)
   * @param version glossary version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Glossary
   */
  @RequestLine("GET /v1/glossaries/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  Glossary getGlossaryVersion(@Param("id") String id, @Param("version") String version);
  /**
   * Get a version of the glossary term
   * Get a version of the glossary term by given &#x60;id&#x60;
   * @param id glossary Id (required)
   * @param version glossary term version number in the form &#x60;major&#x60;.&#x60;minor&#x60; (required)
   * @return Glossary
   */
  @RequestLine("GET /v1/glossaryTerms/{id}/versions/{version}")
  @Headers({
      "Accept: application/json",
  })
  GlossaryTerm getGlossaryTermVersion(@Param("id") String id, @Param("version") String version);
  /**
   * List Glossaries
   * Get a list of glossaries. Use &#x60;fields&#x60; parameter to get only necessary fields.  Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit the number glossaries returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of glossaries before this cursor (optional)
   * @param after Returns list of glossaries after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return GlossaryList
   */
  @RequestLine("GET /v1/glossaries?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<Glossary> getGlossaryList(@Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List Glossaries
   * Get a list of glossaries. Use &#x60;fields&#x60; parameter to get only necessary fields.  Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list8</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GlossaryListQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit the number glossaries returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of glossaries before this cursor (optional)</li>
   *   <li>after - Returns list of glossaries after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return GlossaryList

   */
  @RequestLine("GET /v1/glossaries?fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<Glossary> getGlossaryList(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list8</code> method in a fluent style.
   */
  class GlossaryListQueryParams extends HashMap<String, Object> {
    public GlossaryListQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public GlossaryListQueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public GlossaryListQueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public GlossaryListQueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
    public GlossaryListQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List glossary terms
   * Get a list of glossary terms. Use &#x60;fields&#x60; parameter to get only necessary fields.  Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * @param glossary List glossary terms filtered by glossary identified by Id given in &#x60;glossary&#x60; parameter. (optional)
   * @param parent List glossary terms filtered by children of glossary term identified by Id given in &#x60;parent&#x60; parameter. (optional)
   * @param fields Fields requested in the returned resource (optional)
   * @param limit Limit the number glossary terms returned. (1 to 1000000, default &#x3D; 10) (optional)
   * @param before Returns list of glossary terms before this cursor (optional)
   * @param after Returns list of glossary terms after this cursor (optional)
   * @param include Include all, deleted, or non-deleted entities. (optional)
   * @return GlossaryTermList
   */
  @RequestLine("GET /v1/glossaryTerms?glossary={glossary}&parent={parent}&fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<GlossaryTerm> listGlossaryTerms(@Param("glossary") String glossary, @Param("parent") String parent, @Param("fields") String fields, @Param("limit") Integer limit, @Param("before") String before, @Param("after") String after, @Param("include") String include);

  /**
   * List glossary terms
   * Get a list of glossary terms. Use &#x60;fields&#x60; parameter to get only necessary fields.  Use cursor-based pagination to limit the number entries in the list using &#x60;limit&#x60; and &#x60;before&#x60; or &#x60;after&#x60; query params.
   * Note, this is equivalent to the other <code>list9</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link ListGlossaryTermsQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>glossary - List glossary terms filtered by glossary identified by Id given in &#x60;glossary&#x60; parameter. (optional)</li>
   *   <li>parent - List glossary terms filtered by children of glossary term identified by Id given in &#x60;parent&#x60; parameter. (optional)</li>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   <li>limit - Limit the number glossary terms returned. (1 to 1000000, default &#x3D; 10) (optional)</li>
   *   <li>before - Returns list of glossary terms before this cursor (optional)</li>
   *   <li>after - Returns list of glossary terms after this cursor (optional)</li>
   *   <li>include - Include all, deleted, or non-deleted entities. (optional)</li>
   *   </ul>
   * @return GlossaryTermList

   */
  @RequestLine("GET /v1/glossaryTerms?glossary={glossary}&parent={parent}&fields={fields}&limit={limit}&before={before}&after={after}&include={include}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<GlossaryTerm> listGlossaryTerms(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>list9</code> method in a fluent style.
   */
  class ListGlossaryTermsQueryParams extends HashMap<String, Object> {
    public ListGlossaryTermsQueryParams glossary(final String value) {
      put("glossary", EncodingUtils.encode(value));
      return this;
    }
    public ListGlossaryTermsQueryParams parent(final String value) {
      put("parent", EncodingUtils.encode(value));
      return this;
    }
    public ListGlossaryTermsQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
    public ListGlossaryTermsQueryParams limit(final Integer value) {
      put("limit", EncodingUtils.encode(value));
      return this;
    }
    public ListGlossaryTermsQueryParams before(final String value) {
      put("before", EncodingUtils.encode(value));
      return this;
    }
    public ListGlossaryTermsQueryParams after(final String value) {
      put("after", EncodingUtils.encode(value));
      return this;
    }
    public ListGlossaryTermsQueryParams include(final String value) {
      put("include", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * List glossary versions
   * Get a list of all the versions of a glossary identified by &#x60;id&#x60;
   * @param id glossary Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/glossaries/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listGlossariesVersions(@Param("id") String id);
  /**
   * List glossary term versions
   * Get a list of all the versions of a glossary terms identified by &#x60;id&#x60;
   * @param id glossary Id (required)
   * @return EntityHistory
   */
  @RequestLine("GET /v1/glossaryTerms/{id}/versions")
  @Headers({
      "Accept: application/json",
  })
  EntityHistory listGlossaryTermVersions(@Param("id") String id);
  /**
   * Update a glossary term
   * Update an existing glossary term using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a glossary term Documentation</a>
   */
  @RequestLine("PATCH /v1/glossaryTerms/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response patch(@Param("id") String id, Object body);
  /**
   * Update a glossary
   * Update an existing glossary using JsonPatch.
   * @param id  (required)
   * @param body JsonPatch with array of operations (optional)
   * JsonPatch RFC
   * @see <a href="https://tools.ietf.org/html/rfc6902">Update a glossary Documentation</a>
   */
  @RequestLine("PATCH /v1/glossaries/{id}")
  @Headers({
      "Content-Type: application/json-patch+json",
      "Accept: application/json",
  })
  Response updateDescription(@Param("id") String id, Object body);
}
