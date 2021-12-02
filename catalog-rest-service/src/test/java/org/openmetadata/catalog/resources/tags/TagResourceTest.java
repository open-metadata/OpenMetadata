/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.tags;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.resources.tags.TagResource.CategoryList;
import org.openmetadata.catalog.type.CreateTag;
import org.openmetadata.catalog.type.CreateTagCategory;
import org.openmetadata.catalog.type.CreateTagCategory.TagCategoryType;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagCategory;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

/**
 * Tests not covered here:
 * Tag category and Tag usage counts are covered in TableResourceTest
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TagResourceTest extends CatalogApplicationTest {
  public static final Logger LOG = LoggerFactory.getLogger(TagResourceTest.class);
  public static String BASE_URL;

  @BeforeAll
  public static void setup() {
    BASE_URL = "http://localhost:" + APP.getLocalPort() + "/api/v1/tags";
  }

  @Test
  @Order(0)
  public void list_categories_200() throws IOException {
    // GET .../tags to list all tag categories
    CategoryList list = listCategories();

    // Ensure category list has all the tag categories initialized from tags files in the resource path
    List<String> files = TagResource.getTagDefinitions();
    assertEquals(files.size(), list.getData().size());

    // Validate list of tag categories returned in GET
    for (TagCategory category : list.getData()) {
      validate(category);
    }
    list.getData().forEach(cat -> LOG.info("Category {}", cat));
  }
  @Test
  public void get_category_200() throws HttpResponseException {
    // GET .../tags/{category} to get a category
    TagCategory category = getCategory("User", authHeaders("test@open-metadata.org"));
    assertEquals("User", category.getName());
    validate(category);
  }

  @Test
  public void get_nonExistentCategory_404() {
    // GET .../tags/{nonExistentCategory} returns 404
    String nonExistent = "nonExistent";
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getCategory(nonExistent, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, entityNotFound("TagCategory", nonExistent));
  }

  @Test
  public void get_validTag_200() throws HttpResponseException {
    // GET .../tags/{category}/{tag} returns requested tag
    Tag tag = getTag("User.Address", adminAuthHeaders());
    String parentURI = BASE_URL + "/User";
    validateHRef(parentURI, tag);
  }

  @Test
  public void get_nonExistentTag_404() {
    // GET .../tags/{category}/{nonExistent} returns 404 Not found
    String tagFQN = "User.NonExistent";
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getTag(tagFQN, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, entityNotFound("Tag", tagFQN));
  }

  @Test
  public void post_alreadyExistingTagCategory_4xx() {
    // POST .../tags/{allReadyExistingCategory} returns 4xx
    CreateTagCategory create = new CreateTagCategory().withName("User").withDescription("description")
            .withCategoryType(TagCategoryType.Descriptive);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createAndCheckCategory(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, CONFLICT, "Entity already exists");
  }

  @Test
  public void post_validTagCategory_as_admin_201(TestInfo test) throws HttpResponseException {
    // POST .../tags/{newCategory} returns 201
    String categoryName = test.getDisplayName().substring(0, 10); // Form a unique category name based on the test name
    CreateTagCategory create = new CreateTagCategory().withName(categoryName).withDescription("description")
            .withCategoryType(TagCategoryType.Descriptive);
    TagCategory newCategory = createAndCheckCategory(create, adminAuthHeaders());
    assertEquals(0, newCategory.getChildren().size());
  }

  @Test
  public void post_InvalidTagCategory_4xx(TestInfo test) {
    // POST .../tags/{newCategory} returns 201
    String categoryName = test.getDisplayName().substring(0, 10); // Form a unique category name based on the test name

    // Missing description
    CreateTagCategory create = new CreateTagCategory().withName(categoryName)
            .withDescription(null).withCategoryType(TagCategoryType.Descriptive);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createAndCheckCategory(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "description must not be null");

    // Missing category
    create.withDescription("description").withCategoryType(null);
    exception = assertThrows(HttpResponseException.class, () -> createAndCheckCategory(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "categoryType must not be null");

    // Long name
    create.withName(TestUtils.LONG_ENTITY_NAME).withCategoryType(TagCategoryType.Descriptive);
    exception = assertThrows(HttpResponseException.class, () -> createAndCheckCategory(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "name size must be between 2 and 25");
  }


  @Order(1)
  @Test
  public void post_validTags_200() throws HttpResponseException, JsonProcessingException {
    // POST .../tags/{category}/{primaryTag} to create primary tag
    TagCategory category = getCategory("User", authHeaders("test@open-meatadata.org"));
    CreateTag create = new CreateTag().withName("PrimaryTag").withDescription("description");
    createPrimaryTag(category.getName(), create, adminAuthHeaders());
    TagCategory returnedCategory = getCategory("User", authHeaders("test@open-metadata.org"));

    // Ensure the tag category "User" has one more additional tag to account for newly created tag
    assertEquals(category.getChildren().size() + 1, returnedCategory.getChildren().size());

    // POST .../tags/{category}/{primaryTag}/{secondaryTag} to create secondary tag
    create = new CreateTag().withName("SecondaryTag").withDescription("description");
    createSecondaryTag(category.getName(), "PrimaryTag", create, adminAuthHeaders());
  }

  @Test
  public void post_invalidTags_400() {
    // Missing description in POST primary tag
    CreateTag create = new CreateTag().withName("noDescription").withDescription(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPrimaryTag("User", create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "description must not be null");

    // Missing description in POST secondary tag
    exception = assertThrows(HttpResponseException.class, () ->
            createSecondaryTag("User", "Address", create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "description must not be null");

    // Long primary tag name
    create.withDescription("description").withName(TestUtils.LONG_ENTITY_NAME);
    exception = assertThrows(HttpResponseException.class, () ->
            createPrimaryTag("User", create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "name size must be between 2 and 25");

    // Long secondary tag name
    exception = assertThrows(HttpResponseException.class, () ->
            createSecondaryTag("User", "Address", create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "name size must be between 2 and 25");
  }

  @Test
  public void post_newTagsOnNonExistentParents_404() {
    // POST .../tags/{nonExistent}/{primaryTag} where category does not exist
    String nonExistent = "nonExistent";
    CreateTag create = new CreateTag().withName("primary").withDescription("description");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPrimaryTag(nonExistent, create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, entityNotFound("TagCategory", nonExistent));

    // POST .../tags/{user}/{nonExistent}/tag where primaryTag does not exist
    exception = assertThrows(HttpResponseException.class, () ->
            createSecondaryTag("User", nonExistent, create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, entityNotFound("Tag", nonExistent));
  }

  @Test
  public void put_tagCategory_200(TestInfo test) throws HttpResponseException {
    // PUT .../tags/{user} update the user tags
    String newCategoryName = test.getDisplayName().substring(0, 10);
    CreateTagCategory create = new CreateTagCategory().withName(newCategoryName).withDescription("updatedDescription")
            .withCategoryType(TagCategoryType.Descriptive);
    updateCategory("User", create, adminAuthHeaders());

    // Revert tag category back
    create.withName("User").withCategoryType(TagCategoryType.Classification);
    updateCategory(newCategoryName, create, adminAuthHeaders());
  }

  @Test
  public void put_tagCategoryInvalidRequest_400(TestInfo test) {
    // Primary tag with missing description
    String newCategoryName = test.getDisplayName().substring(0, 10);
    CreateTagCategory create = new CreateTagCategory().withName(newCategoryName).withDescription(null)
            .withCategoryType(TagCategoryType.Descriptive);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            updateCategory("User", create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "description must not be null");

    // Long primary tag name
    create.withDescription("description").withName(TestUtils.LONG_ENTITY_NAME);
    exception = assertThrows(HttpResponseException.class, () ->
            updateCategory("User", create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "name size must be between 2 and 25");
  }

  @Test
  public void put_primaryTag_200() throws HttpResponseException, JsonProcessingException {
    // PUT .../tags/{user}/{address} update the tag
    CreateTag create = new CreateTag().withName("AddressUpdated").withDescription("updatedDescription");
    updatePrimaryTag("User", "Address", create, adminAuthHeaders());

    // Revert back to old tag name user.address from user.addressUpdated
    create.withName("Address");
    updatePrimaryTag("User", "AddressUpdated", create, adminAuthHeaders());
  }

  @Test
  public void put_secondaryTag_200() throws HttpResponseException, JsonProcessingException {
    // PUT .../tags/{user}/{primaryTag}/{secondaryTag} update the tag
    CreateTag create = new CreateTag().withName("SecondaryTag1").withDescription("description");
    updateSecondaryTag("User", "PrimaryTag", "SecondaryTag", create, adminAuthHeaders());

    // Revert back to old tag name user.primaryTag.secondaryTag from user.primaryTag.secondaryTag1
    create.withName("SecondaryTag");
    updateSecondaryTag("User", "PrimaryTag", "SecondaryTag1", create, adminAuthHeaders());
  }

  @Test
  public void put_tagInvalidRequest_404() {
    // Primary tag with missing description
    CreateTag create = new CreateTag().withName("AddressUpdated").withDescription(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> updatePrimaryTag("User", "Address", create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "description must not be null");

    // Secondar tag with missing description
    exception = assertThrows(HttpResponseException.class, ()
            -> updateSecondaryTag("User", "Address", "Secondary",
            create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "description must not be null");

    // Long primary tag name
    create.withDescription("description").withName(TestUtils.LONG_ENTITY_NAME);
    exception = assertThrows(HttpResponseException.class, ()
            -> updatePrimaryTag("User", "Address", create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "name size must be between 2 and 25");

    // Long secondary tag name
    exception = assertThrows(HttpResponseException.class, ()
            -> updateSecondaryTag("User", "Address", "Secondary",
            create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "name size must be between 2 and 25");
  }

  private TagCategory createAndCheckCategory(CreateTagCategory create,
                                             Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    WebTarget target = getResource("tags");
    TagCategory tagCategory = TestUtils.post(target, create, TagCategory.class, authHeaders);
    TagCategory category = validate(tagCategory, create.getCategoryType(), create.getName(), create.getDescription(),
            updatedBy);
    assertEquals(0.1, category.getVersion());

    TagCategory getCategory = getCategory(create.getName(), authHeaders);
    validate(getCategory, create.getCategoryType(), create.getName(), create.getDescription(), updatedBy);
    return category;
  }

  private void createPrimaryTag(String category, CreateTag create, Map<String, String> authHeaders)
          throws HttpResponseException, JsonProcessingException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    WebTarget target = getResource("tags/" + category);

    // Ensure POST returns the primary tag as expected
    Tag returnedTag = TestUtils.post(target, create, Tag.class, authHeaders);
    assertEquals(0.1, returnedTag.getVersion());
    validate(target.getUri().toString(), returnedTag, create.getName(), create.getDescription(),
            create.getAssociatedTags(), updatedBy);

    // Ensure GET returns the primary tag as expected
    validate(target.getUri().toString(), getTag(returnedTag.getFullyQualifiedName(), authHeaders),
            create.getName(), create.getDescription(), create.getAssociatedTags(), updatedBy);
  }

  private void createSecondaryTag(String category, String primaryTag, CreateTag create, Map<String, String> authHeaders)
          throws HttpResponseException, JsonProcessingException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    WebTarget target = getResource("tags/" + category + "/" + primaryTag);

    // Ensure POST returns the secondary tag as expected
    Tag returnedTag = TestUtils.post(target, create, Tag.class, authHeaders);
    assertEquals(0.1, returnedTag.getVersion());
    validate(target.getUri().toString(), returnedTag, create.getName(), create.getDescription(),
            create.getAssociatedTags(), updatedBy);

    // Ensure GET returns the primary tag as expected
    validate(target.getUri().toString(), getTag(returnedTag.getFullyQualifiedName(), authHeaders), create.getName(),
            create.getDescription(), create.getAssociatedTags(), updatedBy);
  }

  private void updateCategory(String category, CreateTagCategory update,
                              Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    WebTarget target = getResource("tags/" + category);

    // Ensure PUT returns the updated tag category
    TagCategory tagCategory = TestUtils.put(target, update, TagCategory.class, Status.OK, authHeaders);
    validate(tagCategory, update.getCategoryType(), update.getName(), update.getDescription(), updatedBy);

    // Ensure GET returns the updated tag category
    TagCategory getCategory = getCategory(update.getName(), authHeaders);
    validate(getCategory, update.getCategoryType(), update.getName(), update.getDescription(), updatedBy);
  }

  private void updatePrimaryTag(String category, String primaryTag, CreateTag update,
                                Map<String, String> authHeaders) throws HttpResponseException,
          JsonProcessingException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    String parentHref = getResource("tags/" + category).getUri().toString();
    WebTarget target = getResource("tags/" + category + "/" + primaryTag);

    // Ensure PUT returns the updated primary tag
    Tag returnedTag = TestUtils.put(target, update, Tag.class, Status.OK, authHeaders);
    validate(parentHref, returnedTag, update.getName(), update.getDescription(), update.getAssociatedTags(), updatedBy);

    // Ensure GET returns the updated primary tag
    validate(parentHref, getTag(returnedTag.getFullyQualifiedName(), authHeaders), update.getName(),
            update.getDescription(), update.getAssociatedTags(), updatedBy);
  }

  private void updateSecondaryTag(String category, String primaryTag,
                                  String secondaryTag, CreateTag update, Map<String, String> authHeaders)
          throws HttpResponseException, JsonProcessingException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    String parentHref = getResource("tags/" + category + "/" + primaryTag).getUri().toString();
    WebTarget target = getResource("tags/" + category + "/" + primaryTag + "/" + secondaryTag);

    // Ensure PUT returns the updated secondary tag
    Tag returnedTag = TestUtils.put(target, update, Tag.class, Status.OK, authHeaders);
    validate(parentHref, returnedTag, update.getName(), update.getDescription(), update.getAssociatedTags(), updatedBy);

    // Ensure GET returns the updated primary tag
    validate(parentHref, getTag(returnedTag.getFullyQualifiedName(), authHeaders), update.getName(),
            update.getDescription(), update.getAssociatedTags(), updatedBy);
  }

  public static CategoryList listCategories() throws HttpResponseException {
    WebTarget target = getResource("tags");
    return TestUtils.get(target, CategoryList.class, authHeaders("test@open-metadata.org"));
  }

  public static TagCategory getCategory(String category, Map<String, String> autHeaders) throws HttpResponseException {
    return getCategory(category, null, autHeaders);
  }

  public static TagCategory getCategory(String category, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("tags/" + category);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, TagCategory.class, authHeaders);
  }

  public static Tag getTag(String fqn, Map<String, String> authHeaders) throws HttpResponseException {
    return getTag(fqn, null, authHeaders);
  }

  public static Tag getTag(String fqn, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    String[] split = fqn.split("\\.");
    WebTarget target;
    if (split.length == 1) {
      target = getResource("tags/" + split[0]);
    } else if (split.length == 2) {
      target = getResource("tags/" + split[0] + "/" + split[1]);
    } else if (split.length == 3) {
      target = getResource("tags/" + split[0] + "/" + split[1] + "/" + split[2]);
    } else {
      throw new IllegalArgumentException("Invalid fqn " + fqn);
    }
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Tag.class, authHeaders);
  }

  private TagCategory validate(TagCategory actual, TagCategoryType expectedCategoryType, String expectedName,
                        String expectedDescription, String expectedUpdatedBy) {
    validate(actual);
    assertEquals(expectedName, actual.getName());
    assertEquals(expectedCategoryType, actual.getCategoryType());
    assertEquals(expectedDescription, actual.getDescription());
    assertEquals(expectedUpdatedBy, actual.getUpdatedBy());
    return actual;
  }

  private void validate(TagCategory category) {
    assertNotNull(category.getName());
    assertEquals(URI.create(BASE_URL + "/" + category.getName()), category.getHref());
    for (Tag tag : Optional.ofNullable(category.getChildren()).orElse(Collections.emptyList())) {
      validateHRef(category.getHref().toString(), tag);
    }
  }

  private void validate(String parentURI, Tag actual, String expectedName, String expectedDescription,
                        List<String> expectedAssociatedTags, String expectedUpdatedBy) throws JsonProcessingException {
    LOG.info("Actual tag {}", JsonUtils.pojoToJson(actual));
    validateHRef(parentURI, actual);
    assertEquals(expectedName, actual.getName());
    assertEquals(expectedDescription, actual.getDescription());
    assertEquals(expectedUpdatedBy, actual.getUpdatedBy());
    Collections.sort(expectedAssociatedTags);
    Collections.sort(actual.getAssociatedTags());
    assertEquals(expectedAssociatedTags, actual.getAssociatedTags());
  }


  /** Ensure the href returned in the children tags is correct */
  private void validateHRef(String parentURI, Tag actual) {
    assertNotNull(actual.getName());
    assertNotNull(actual.getFullyQualifiedName());
    String href = parentURI + "/" + actual.getName();
    assertEquals(URI.create(href), actual.getHref());
    for (Tag child : Optional.ofNullable(actual.getChildren()).orElse(Collections.emptyList())) {
      validateHRef(actual.getHref().toString(), child);
    }
  }
}
