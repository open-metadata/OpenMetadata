package org.openmetada.restclient.api;

import org.openmetada.restclient.ApiClient;
import org.openmetada.restclient.EncodingUtils;


import java.util.HashMap;
import java.util.Map;
import feign.*;
import org.openmetada.restclient.util.ResultList;
import org.openmetadata.catalog.type.CreateTag;
import org.openmetadata.catalog.type.CreateTagCategory;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagCategory;

@javax.annotation.Generated(value = "io.swagger.codegen.v3.generators.java.JavaClientCodegen", date = "2022-05-14T18:11:30.072415+05:30[Asia/Kolkata]")public interface TagsApi extends ApiClient.Api {

  /**
   * Create a tag category
   * Create a new tag category. The request can include the children tags to be created along with the tag category.
   * @param body  (optional)
   * @return CreateTagCategory
   */
  @RequestLine("POST /v1/tags")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Response createCategory(CreateTagCategory body);
  /**
   * Create a primary tag
   * Create a primary tag in the given tag category.
   * @param category Tag category name (required)
   * @param body  (optional)
   * @return CreateTag
   */
  @RequestLine("POST /v1/tags/{category}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Response createPrimaryTag(@Param("category") String category, CreateTag body);
  /**
   * Create a secondary tag
   * Create a secondary tag under the given primary tag.
   * @param category Tag category name (required)
   * @param primaryTag Primary tag name (required)
   * @param body  (optional)
   * @return CreateTag
   */
  @RequestLine("POST /v1/tags/{category}/{primaryTag}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Response createSecondaryTag(@Param("category") String category, @Param("primaryTag") String primaryTag, CreateTag body);
  /**
   * Delete tag category
   * Delete a tag category and all the tags under it.
   * @param id Tag category id (required)
   * @return TagCategory
   */
  @RequestLine("DELETE /v1/tags/{id}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  TagCategory deleteCategory(@Param("id") String id);
  /**
   * Delete tag
   * Delete a tag and all the tags under it.
   * @param category Tag id (required)
   * @param id Tag id (required)
   * @return Tag
   */
  @RequestLine("DELETE /v1/tags/{category}/{id}")
  @Headers({
      "Content-Type: application/json",
      "Accept: application/json",
  })
  Tag deleteTags(@Param("category") String category, @Param("id") String id);
  /**
   * List tag categories
   * Get a list of tag categories.
   * @param fields Fields requested in the returned resource (optional)
   * @return CategoryList
   */
  @RequestLine("GET /v1/tags?fields={fields}")
  @Headers({
      "Accept: application/json",
  })
  ResultList<TagCategory> getCategories(@Param("fields") String fields);

  /**
   * List tag categories
   * Get a list of tag categories.
   * Note, this is equivalent to the other <code>getCategories</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetCategoriesQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   </ul>
   * @return CategoryList

   */
  @RequestLine("GET /v1/tags?fields={fields}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  ResultList<TagCategory> getCategories(@QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getCategories</code> method in a fluent style.
   */
  public static class GetCategoriesQueryParams extends HashMap<String, Object> {
    public GetCategoriesQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a tag category
   * Get a tag category identified by name. The response includes tag category information along with the entire hierarchy of all the children tags.
   * @param category Tag category name (required)
   * @param fields Fields requested in the returned resource (optional)
   * @return TagCategory
   */
  @RequestLine("GET /v1/tags/{category}?fields={fields}")
  @Headers({
      "Accept: application/json",
  })
  TagCategory getCategoryByID(@Param("category") String category, @Param("fields") String fields);

  /**
   * Get a tag category
   * Get a tag category identified by name. The response includes tag category information along with the entire hierarchy of all the children tags.
   * Note, this is equivalent to the other <code>getCategory</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetCategoryQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param category Tag category name (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   </ul>
   * @return TagCategory

   */
  @RequestLine("GET /v1/tags/{category}?fields={fields}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  TagCategory getCategoryByID(@Param("category") String category, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getCategory</code> method in a fluent style.
   */
  public static class GetCategoryQueryParams extends HashMap<String, Object> {
    public GetCategoryQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a primary tag
   * Get a primary tag identified by name. The response includes with the entire hierarchy of all the children tags.
   * @param category Tag category name (required)
   * @param primaryTag Primary tag name (required)
   * @param fields Fields requested in the returned resource (optional)
   * @return Tag
   */
  @RequestLine("GET /v1/tags/{category}/{primaryTag}?fields={fields}")
  @Headers({
      "Accept: application/json",
  })
  Tag getPrimaryTag(@Param("category") String category, @Param("primaryTag") String primaryTag, @Param("fields") String fields);

  /**
   * Get a primary tag
   * Get a primary tag identified by name. The response includes with the entire hierarchy of all the children tags.
   * Note, this is equivalent to the other <code>getPrimaryTag</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetPrimaryTagQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param category Tag category name (required)
   * @param primaryTag Primary tag name (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   </ul>
   * @return Tag

   */
  @RequestLine("GET /v1/tags/{category}/{primaryTag}?fields={fields}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Tag getPrimaryTag(@Param("category") String category, @Param("primaryTag") String primaryTag, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getPrimaryTag</code> method in a fluent style.
   */
  public static class GetPrimaryTagQueryParams extends HashMap<String, Object> {
    public GetPrimaryTagQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Get a secondary tag
   * Get a secondary tag identified by name.
   * @param category Tag category name (required)
   * @param primaryTag Primary tag name (required)
   * @param secondaryTag Secondary tag name (required)
   * @param fields Fields requested in the returned resource (optional)
   * @return Tag
   */
  @RequestLine("GET /v1/tags/{category}/{primaryTag}/{secondaryTag}?fields={fields}")
  @Headers({
      "Accept: application/json",
  })
  Tag getSecondaryTag(@Param("category") String category, @Param("primaryTag") String primaryTag, @Param("secondaryTag") String secondaryTag, @Param("fields") String fields);

  /**
   * Get a secondary tag
   * Get a secondary tag identified by name.
   * Note, this is equivalent to the other <code>getSecondaryTag</code> method,
   * but with the query parameters collected into a single Map parameter. This
   * is convenient for services with optional query parameters, especially when
   * used with the {@link GetSecondaryTagQueryParams} class that allows for
   * building up this map in a fluent style.
   * @param category Tag category name (required)
   * @param primaryTag Primary tag name (required)
   * @param secondaryTag Secondary tag name (required)
   * @param queryParams Map of query parameters as name-value pairs
   *   <p>The following elements may be specified in the query map:</p>
   *   <ul>
   *   <li>fields - Fields requested in the returned resource (optional)</li>
   *   </ul>
   * @return Tag

   */
  @RequestLine("GET /v1/tags/{category}/{primaryTag}/{secondaryTag}?fields={fields}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Tag getSecondaryTag(@Param("category") String category, @Param("primaryTag") String primaryTag, @Param("secondaryTag") String secondaryTag, @QueryMap(encoded=true) Map<String, Object> queryParams);

  /**
   * A convenience class for generating query parameters for the
   * <code>getSecondaryTag</code> method in a fluent style.
   */
  public static class GetSecondaryTagQueryParams extends HashMap<String, Object> {
    public GetSecondaryTagQueryParams fields(final String value) {
      put("fields", EncodingUtils.encode(value));
      return this;
    }
  }
  /**
   * Update a tag category
   * Update an existing category identify by category name
   * @param category Tag category name (required)
   * @param body  (optional)
   */
  @RequestLine("PUT /v1/tags/{category}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Response updateCategory(@Param("category") String category, CreateTagCategory body);
  /**
   * Update a primaryTag
   * Update an existing primaryTag identify by name
   * @param category Tag category name (required)
   * @param primaryTag Primary tag name (required)
   * @param body  (optional)
   */
  @RequestLine("PUT /v1/tags/{category}/{primaryTag}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Response updatePrimaryTag(@Param("category") String category, @Param("primaryTag") String primaryTag, CreateTag body);
  /**
   * Update a secondaryTag
   * Update an existing secondaryTag identify by name
   * @param category Tag category name (required)
   * @param primaryTag Primary tag name (required)
   * @param secondaryTag SecondaryTag tag name (required)
   * @param body  (optional)
   */
  @RequestLine("PUT /v1/tags/{category}/{primaryTag}/{secondaryTag}")
  @Headers({
      "Content-Type: */*",
      "Accept: application/json",
  })
  Response updateSecondaryTag(@Param("category") String category, @Param("primaryTag") String primaryTag, @Param("secondaryTag") String secondaryTag, CreateTag body);
}
