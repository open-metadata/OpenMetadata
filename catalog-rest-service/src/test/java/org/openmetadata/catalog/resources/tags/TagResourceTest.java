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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.tags.TagResource.CategoryList;
import org.openmetadata.catalog.type.CreateTag;
import org.openmetadata.catalog.type.CreateTagCategory;
import org.openmetadata.catalog.type.CreateTagCategory.TagCategoryType;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagCategory;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.Source;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;

/** Tests not covered here: Tag category and Tag usage counts are covered in TableResourceTest */
@Execution(ExecutionMode.CONCURRENT)
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TagResourceTest extends CatalogApplicationTest {
  public static String TAGS_URL;
  public static TagCategory USER_TAG_CATEGORY;
  public static Tag ADDRESS_TAG;

  @BeforeAll
  public static void setup() throws HttpResponseException, JsonProcessingException {
    new TagResourceTest().setupTags();
  }

  public void setupTags() throws HttpResponseException {
    TAGS_URL = "http://localhost:" + APP.getLocalPort() + "/api/v1/tags";
    TagResourceTest tagResourceTest = new TagResourceTest();
    EntityResourceTest.PERSONAL_DATA_TAG_LABEL = getTagLabel(FullyQualifiedName.add("PersonalData", "Personal"));
    EntityResourceTest.PII_SENSITIVE_TAG_LABEL = getTagLabel(FullyQualifiedName.add("PII", "Sensitive"));
    EntityResourceTest.TIER1_TAG_LABEL = getTagLabel(FullyQualifiedName.add("Tier", "Tier1"));
    EntityResourceTest.TIER2_TAG_LABEL = getTagLabel(FullyQualifiedName.add("Tier", "Tier2"));

    CreateTagCategory create =
        new CreateTagCategory()
            .withName("User")
            .withDescription("description")
            .withCategoryType(TagCategoryType.Descriptive);
    USER_TAG_CATEGORY = tagResourceTest.createAndCheckCategory(create, ADMIN_AUTH_HEADERS);

    List<String> associatedTags = new ArrayList<>();
    associatedTags.add(EntityResourceTest.PERSONAL_DATA_TAG_LABEL.getTagFQN());
    associatedTags.add(EntityResourceTest.PII_SENSITIVE_TAG_LABEL.getTagFQN());

    CreateTag createTag =
        new CreateTag().withName("Address").withDescription("description").withAssociatedTags(associatedTags);
    ADDRESS_TAG = tagResourceTest.createPrimaryTag(USER_TAG_CATEGORY.getName(), createTag, ADMIN_AUTH_HEADERS);

    EntityResourceTest.USER_ADDRESS_TAG_LABEL = getTagLabel(FullyQualifiedName.add("User", "Address"));
  }

  private TagLabel getTagLabel(String tagName) throws HttpResponseException {
    Tag tag = TagResourceTest.getTag(tagName, ADMIN_AUTH_HEADERS);
    return new TagLabel()
        .withTagFQN(tag.getFullyQualifiedName())
        .withDescription(tag.getDescription())
        .withSource(Source.TAG);
  }

  @Test
  @Order(0)
  void list_categories_200() throws IOException {
    // GET .../tags to list all tag categories
    CategoryList list = listCategories();

    // Ensure category list has all the tag categories initialized from tags files in the resource path
    List<String> jsonData = EntityUtil.getJsonDataResources(".*json/data/tags/.*\\.json$");
    assertEquals(jsonData.size() + 1, list.getData().size()); // +1 for USER_TAG_CATEGORY created in this test

    // Validate list of tag categories returned in GET
    for (TagCategory category : list.getData()) {
      validate(category);
    }
    list.getData().forEach(cat -> LOG.info("Category {}", cat));
  }

  @Test
  void get_category_200() throws HttpResponseException {
    // GET .../tags/{category} to get a category
    TagCategory category = getCategory(USER_TAG_CATEGORY.getName(), TEST_AUTH_HEADERS);
    assertEquals(USER_TAG_CATEGORY.getName(), category.getName());
    validate(category);
  }

  @Test
  void get_nonExistentCategory_404() {
    // GET .../tags/{nonExistentCategory} returns 404
    String nonExistent = "nonExistent";
    assertResponse(
        () -> getCategory(nonExistent, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TAG_CATEGORY, nonExistent));
  }

  @Test
  void get_validTag_200() throws HttpResponseException {
    // GET .../tags/{category}/{tag} returns requested tag
    Tag tag = getTag(FullyQualifiedName.build(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName()), ADMIN_AUTH_HEADERS);
    String parentURI = TAGS_URL + "/" + USER_TAG_CATEGORY.getName();
    validateHRef(parentURI, tag);
  }

  @Test
  void get_nonExistentTag_404() {
    // GET .../tags/{category}/{nonExistent} returns 404 Not found
    String tagFQN = FullyQualifiedName.build(USER_TAG_CATEGORY.getName(), "NonExistent");
    assertResponse(() -> getTag(tagFQN, ADMIN_AUTH_HEADERS), NOT_FOUND, entityNotFound(Entity.TAG, tagFQN));
  }

  @Test
  void post_alreadyExistingTagCategory_4xx() {
    // POST .../tags/{allReadyExistingCategory} returns 4xx
    CreateTagCategory create =
        new CreateTagCategory()
            .withName(USER_TAG_CATEGORY.getName())
            .withDescription("description")
            .withCategoryType(TagCategoryType.Descriptive);
    assertResponse(() -> createAndCheckCategory(create, ADMIN_AUTH_HEADERS), CONFLICT, "Entity already exists");
  }

  @Test
  void post_delete_validTagCategory_as_admin_201(TestInfo test) throws HttpResponseException {
    // POST .../tags/{newCategory} returns 201
    String categoryName = test.getDisplayName().substring(0, 20); // Form a unique category name based on the test name
    CreateTagCategory create =
        new CreateTagCategory()
            .withName(categoryName)
            .withDescription("description")
            .withCategoryType(TagCategoryType.Descriptive);
    TagCategory category = createAndCheckCategory(create, ADMIN_AUTH_HEADERS);
    assertEquals(0, category.getChildren().size());

    CreateTag createTag = new CreateTag().withName("PrimaryTag").withDescription("description");
    Tag primaryTag = createPrimaryTag(category.getName(), createTag, ADMIN_AUTH_HEADERS);

    // POST .../tags/{category}/{primaryTag}/{secondaryTag} to create secondary tag
    createTag = new CreateTag().withName("SecondaryTag").withDescription("description");
    Tag secondaryTag = createSecondaryTag(category.getName(), "PrimaryTag", createTag, ADMIN_AUTH_HEADERS);

    // Now delete Tag category and ensure the tag category and tags under it are all deleted
    deleteCategory(category, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> getTag(primaryTag.getFullyQualifiedName(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TAG, primaryTag.getFullyQualifiedName()));
    assertResponse(
        () -> getTag(secondaryTag.getFullyQualifiedName(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TAG, secondaryTag.getFullyQualifiedName()));
  }

  @Test
  void post_delete_validTags_as_admin_201(TestInfo test) throws HttpResponseException {
    // Create tag category
    String categoryName = test.getDisplayName().substring(0, 20);
    CreateTagCategory create =
        new CreateTagCategory()
            .withName(categoryName)
            .withDescription("description")
            .withCategoryType(TagCategoryType.Descriptive);
    TagCategory category = createAndCheckCategory(create, ADMIN_AUTH_HEADERS);
    assertEquals(0, category.getChildren().size());

    // Create primaryTag
    CreateTag createTag = new CreateTag().withName("PrimaryTag").withDescription("description");
    Tag primaryTag = createPrimaryTag(category.getName(), createTag, ADMIN_AUTH_HEADERS);

    // Create secondaryTag1
    createTag = new CreateTag().withName("SecondaryTag1").withDescription("description");
    Tag secondaryTag1 = createSecondaryTag(category.getName(), "PrimaryTag", createTag, ADMIN_AUTH_HEADERS);

    // Create secondaryTag2
    createTag = new CreateTag().withName("SecondaryTag2").withDescription("description");
    Tag secondaryTag2 = createSecondaryTag(category.getName(), "PrimaryTag", createTag, ADMIN_AUTH_HEADERS);

    // Delete and verify secondaryTag2 is deleted
    deleteTag(category.getName(), secondaryTag2, ADMIN_AUTH_HEADERS);

    // Delete primaryTag and ensure secondaryTag1 under it is deleted
    deleteTag(category.getName(), primaryTag, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> getTag(secondaryTag1.getFullyQualifiedName(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TAG, secondaryTag1.getFullyQualifiedName()));
  }

  public final TagCategory deleteCategory(TagCategory category, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tags/" + category.getId());
    TagCategory deletedCategory = TestUtils.delete(target, TagCategory.class, authHeaders);
    assertResponse(
        () -> getCategory(category.getName(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TAG_CATEGORY, category.getName()));
    return deletedCategory;
  }

  public final Tag deleteTag(String categoryName, Tag tag, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tags/" + categoryName + "/" + tag.getId());
    Tag deletedTag = TestUtils.delete(target, Tag.class, authHeaders);
    assertResponse(
        () -> getTag(tag.getFullyQualifiedName(), ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TAG, tag.getFullyQualifiedName()));
    return deletedTag;
  }

  @Test
  void post_InvalidTagCategory_4xx(TestInfo test) {
    // POST .../tags/{newCategory} returns 201
    String categoryName = test.getDisplayName().substring(0, 10); // Form a unique category name based on the test name

    // Missing description
    CreateTagCategory create =
        new CreateTagCategory()
            .withName(categoryName)
            .withDescription(null)
            .withCategoryType(TagCategoryType.Descriptive);
    assertResponseContains(
        () -> createAndCheckCategory(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "description must not be null");

    // Missing category
    create.withDescription("description").withCategoryType(null);
    assertResponseContains(
        () -> createAndCheckCategory(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "categoryType must not be null");

    // Long name
    create.withName(TestUtils.LONG_ENTITY_NAME).withCategoryType(TagCategoryType.Descriptive);
    assertResponseContains(
        () -> createAndCheckCategory(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "name size must be between 2 and 25");
  }

  @Order(1)
  @Test
  void post_validTags_200() throws HttpResponseException {
    // POST .../tags/{category}/{primaryTag} to create primary tag
    TagCategory category = getCategory(USER_TAG_CATEGORY.getName(), authHeaders("test@open-meatadata.org"));
    CreateTag create = new CreateTag().withName("PrimaryTag").withDescription("description");
    createPrimaryTag(category.getName(), create, ADMIN_AUTH_HEADERS);
    TagCategory returnedCategory = getCategory(USER_TAG_CATEGORY.getName(), TEST_AUTH_HEADERS);

    // Ensure the tag category has one more additional tag to account for newly created tag
    assertEquals(category.getChildren().size() + 1, returnedCategory.getChildren().size());

    // POST .../tags/{category}/{primaryTag}/{secondaryTag} to create secondary tag
    create = new CreateTag().withName("SecondaryTag").withDescription("description");
    createSecondaryTag(category.getName(), "PrimaryTag", create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_invalidTags_400() {
    // Missing description in POST primary tag
    CreateTag create = new CreateTag().withName("noDescription").withDescription(null);
    assertResponseContains(
        () -> createPrimaryTag(USER_TAG_CATEGORY.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "description must not be null");

    // Missing description in POST secondary tag
    assertResponseContains(
        () -> createSecondaryTag(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "description must not be null");

    // Long primary tag name
    create.withDescription("description").withName(TestUtils.LONG_ENTITY_NAME);
    assertResponseContains(
        () -> createPrimaryTag(USER_TAG_CATEGORY.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 25");

    // Long secondary tag name
    assertResponseContains(
        () -> createSecondaryTag(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 25");
  }

  @Test
  void post_newTagsOnNonExistentParents_404() {
    // POST .../tags/{nonExistent}/{primaryTag} where category does not exist
    String nonExistent = "nonExistent";
    CreateTag create = new CreateTag().withName("primary").withDescription("description");
    assertResponse(
        () -> createPrimaryTag(nonExistent, create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TAG_CATEGORY, nonExistent));

    // POST .../tags/{user}/{nonExistent}/tag where primaryTag does not exist
    assertResponse(
        () -> createSecondaryTag(USER_TAG_CATEGORY.getName(), nonExistent, create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TAG, FullyQualifiedName.build(USER_TAG_CATEGORY.getName(), nonExistent)));
  }

  @Test
  void put_tagCategory_200(TestInfo test) {
    // Update an existing tag category
    String newCategoryName = test.getDisplayName().substring(0, 10);
    CreateTagCategory create =
        new CreateTagCategory()
            .withName(newCategoryName)
            .withDescription("updatedDescription")
            .withCategoryType(TagCategoryType.Descriptive);
    updateCategory(USER_TAG_CATEGORY.getName(), create, ADMIN_AUTH_HEADERS);

    // Revert tag category back
    create.withName(USER_TAG_CATEGORY.getName()).withCategoryType(TagCategoryType.Classification);
    updateCategory(newCategoryName, create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_tagCategoryInvalidRequest_400(TestInfo test) {
    // Primary tag with missing description
    String newCategoryName = test.getDisplayName().substring(0, 10);
    CreateTagCategory create =
        new CreateTagCategory()
            .withName(newCategoryName)
            .withDescription(null)
            .withCategoryType(TagCategoryType.Descriptive);
    assertResponseContains(
        () -> updateCategory(USER_TAG_CATEGORY.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "description must not be null");

    // Long primary tag name
    create.withDescription("description").withName(TestUtils.LONG_ENTITY_NAME);
    assertResponseContains(
        () -> updateCategory(USER_TAG_CATEGORY.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 25");
  }

  @Test
  void put_primaryTag_200() throws HttpResponseException {
    // Update the tag name from User.Address to User.AddressUpdated
    CreateTag create = new CreateTag().withName("AddressUpdated").withDescription("updatedDescription");
    updatePrimaryTag(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), create, ADMIN_AUTH_HEADERS);

    // Revert the tag name from User.AddressUpdated back to User.Address
    create.withName(ADDRESS_TAG.getName());
    updatePrimaryTag(USER_TAG_CATEGORY.getName(), "AddressUpdated", create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_secondaryTag_200() throws HttpResponseException {
    // Update the secondary tag name from User.PrimaryTag.SecondaryTag to User.PrimaryTag.SecondaryTag1
    CreateTag create = new CreateTag().withName("SecondaryTag1").withDescription("description");
    updateSecondaryTag(USER_TAG_CATEGORY.getName(), "PrimaryTag", "SecondaryTag", create, ADMIN_AUTH_HEADERS);

    // Revert the secondary tag name from User.PrimaryTag.SecondaryTag1 back to User.PrimaryTag.SecondaryTag
    create.withName("tag11");
    updateSecondaryTag(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), "SecondaryTag1", create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_tagInvalidRequest_404() {
    // Primary tag with missing description
    CreateTag create = new CreateTag().withName("AddressUpdated").withDescription(null);
    assertResponseContains(
        () -> updatePrimaryTag(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "description must not be null");

    // Secondary tag with missing description
    assertResponseContains(
        () ->
            updateSecondaryTag(
                USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), "Secondary", create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "description must not be null");

    // Long primary tag name
    create.withDescription("description").withName(TestUtils.LONG_ENTITY_NAME);
    assertResponseContains(
        () -> updatePrimaryTag(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 25");

    // Long secondary tag name
    assertResponseContains(
        () ->
            updateSecondaryTag(
                USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), "Secondary", create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 25");
  }

  private TagCategory createAndCheckCategory(CreateTagCategory create, Map<String, String> authHeaders)
      throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    WebTarget target = getResource("tags");
    TagCategory tagCategory = TestUtils.post(target, create, TagCategory.class, authHeaders);
    TagCategory category =
        validate(tagCategory, create.getCategoryType(), create.getName(), create.getDescription(), updatedBy);
    assertEquals(0.1, category.getVersion());

    TagCategory getCategory = getCategory(create.getName(), authHeaders);
    validate(getCategory, create.getCategoryType(), create.getName(), create.getDescription(), updatedBy);
    return category;
  }

  private Tag createPrimaryTag(String category, CreateTag create, Map<String, String> authHeaders)
      throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    WebTarget target = getResource("tags/" + category);

    // Ensure POST returns the primary tag as expected
    Tag returnedTag = TestUtils.post(target, create, Tag.class, authHeaders);
    assertEquals(0.1, returnedTag.getVersion());
    validate(target.getUri().toString(), returnedTag, create.getName(), create.getDescription(), updatedBy);

    // Ensure GET returns the primary tag as expected
    validate(
        target.getUri().toString(),
        getTag(returnedTag.getFullyQualifiedName(), authHeaders),
        create.getName(),
        create.getDescription(),
        updatedBy);
    return returnedTag;
  }

  private Tag createSecondaryTag(String category, String primaryTag, CreateTag create, Map<String, String> authHeaders)
      throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    WebTarget target = getResource("tags/" + category + "/" + primaryTag);

    // Ensure POST returns the secondary tag as expected
    Tag returnedTag = TestUtils.post(target, create, Tag.class, authHeaders);
    assertEquals(0.1, returnedTag.getVersion());
    validate(target.getUri().toString(), returnedTag, create.getName(), create.getDescription(), updatedBy);

    // Ensure GET returns the primary tag as expected
    validate(
        target.getUri().toString(),
        getTag(returnedTag.getFullyQualifiedName(), authHeaders),
        create.getName(),
        create.getDescription(),
        updatedBy);
    return returnedTag;
  }

  @SneakyThrows
  private void updateCategory(String category, CreateTagCategory update, Map<String, String> authHeaders) {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    WebTarget target = getResource("tags/" + category);

    // Ensure PUT returns the updated tag category
    TagCategory tagCategory = TestUtils.put(target, update, TagCategory.class, Status.OK, authHeaders);
    validate(tagCategory, update.getCategoryType(), update.getName(), update.getDescription(), updatedBy);

    // Ensure GET returns the updated tag category
    TagCategory getCategory = getCategory(update.getName(), authHeaders);
    validate(getCategory, update.getCategoryType(), update.getName(), update.getDescription(), updatedBy);
  }

  private void updatePrimaryTag(String category, String primaryTag, CreateTag update, Map<String, String> authHeaders)
      throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    String parentHref = getResource("tags/" + category).getUri().toString();
    WebTarget target = getResource("tags/" + category + "/" + primaryTag);

    // Ensure PUT returns the updated primary tag
    Tag returnedTag = TestUtils.put(target, update, Tag.class, Status.OK, authHeaders);
    validate(parentHref, returnedTag, update.getName(), update.getDescription(), updatedBy);

    // Ensure GET returns the updated primary tag
    validate(
        parentHref,
        getTag(returnedTag.getFullyQualifiedName(), authHeaders),
        update.getName(),
        update.getDescription(),
        updatedBy);
  }

  private void updateSecondaryTag(
      String category, String primaryTag, String secondaryTag, CreateTag update, Map<String, String> authHeaders)
      throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    String parentHref = getResource("tags/" + category + "/" + primaryTag).getUri().toString();
    WebTarget target = getResource("tags/" + category + "/" + primaryTag + "/" + secondaryTag);

    // Ensure PUT returns the updated secondary tag
    Tag returnedTag = TestUtils.put(target, update, Tag.class, Status.OK, authHeaders);
    validate(parentHref, returnedTag, update.getName(), update.getDescription(), updatedBy);

    // Ensure GET returns the updated primary tag
    validate(
        parentHref,
        getTag(returnedTag.getFullyQualifiedName(), authHeaders),
        update.getName(),
        update.getDescription(),
        updatedBy);
  }

  public static CategoryList listCategories() throws HttpResponseException {
    WebTarget target = getResource("tags");
    return TestUtils.get(target, CategoryList.class, TEST_AUTH_HEADERS);
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
    String[] split = FullyQualifiedName.split(fqn);
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

  private TagCategory validate(
      TagCategory actual,
      TagCategoryType expectedCategoryType,
      String expectedName,
      String expectedDescription,
      String expectedUpdatedBy) {
    validate(actual);
    assertEquals(expectedName, actual.getName());
    assertEquals(expectedCategoryType, actual.getCategoryType());
    assertEquals(expectedDescription, actual.getDescription());
    assertEquals(expectedUpdatedBy, actual.getUpdatedBy());
    return actual;
  }

  private void validate(TagCategory category) {
    assertNotNull(category.getName());
    assertEquals(URI.create(TAGS_URL + "/" + category.getName()), category.getHref());
    for (Tag tag : listOrEmpty(category.getChildren())) {
      validateHRef(category.getHref().toString(), tag);
    }
  }

  @SneakyThrows
  private void validate(
      String parentURI, Tag actual, String expectedName, String expectedDescription, String expectedUpdatedBy) {
    LOG.info("Actual tag {}", JsonUtils.pojoToJson(actual));
    validateHRef(parentURI, actual);
    assertEquals(expectedName, actual.getName());
    assertEquals(expectedDescription, actual.getDescription());
    assertEquals(expectedUpdatedBy, actual.getUpdatedBy());
  }

  /** Ensure the href in the children tags is correct */
  private void validateHRef(String parentURI, Tag actual) {
    assertNotNull(actual.getName(), actual.getFullyQualifiedName());
    String href = parentURI + "/" + actual.getName();
    assertEquals(URI.create(href), actual.getHref());
    for (Tag child : listOrEmpty(actual.getChildren())) {
      validateHRef(actual.getHref().toString(), child);
    }
  }
}
