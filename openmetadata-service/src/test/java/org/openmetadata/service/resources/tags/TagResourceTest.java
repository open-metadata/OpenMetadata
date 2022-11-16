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

package org.openmetadata.service.resources.tags;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.resources.EntityResourceTest.PERSONAL_DATA_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.PII_SENSITIVE_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.TIER1_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.TIER2_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.USER_ADDRESS_TAG_LABEL;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

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
import org.openmetadata.schema.api.tags.CreateTag;
import org.openmetadata.schema.api.tags.CreateTagCategory;
import org.openmetadata.schema.entity.tags.Tag;
import org.openmetadata.schema.type.TagCategory;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.tags.TagResource.CategoryList;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;

/** Tests not covered here: Tag category and Tag usage counts are covered in TableResourceTest */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TagResourceTest extends OpenMetadataApplicationTest {
  public static String TAGS_URL;
  public static TagCategory USER_TAG_CATEGORY;
  public static Tag ADDRESS_TAG;

  @BeforeAll
  public static void setup() throws HttpResponseException {
    new TagResourceTest().setupTags();
  }

  public void setupTags() throws HttpResponseException {
    TAGS_URL = "http://localhost:" + APP.getLocalPort() + "/api/v1/tags";
    TagResourceTest tagResourceTest = new TagResourceTest();
    PERSONAL_DATA_TAG_LABEL = getTagLabel(FullyQualifiedName.add("PersonalData", "Personal"));
    PII_SENSITIVE_TAG_LABEL = getTagLabel(FullyQualifiedName.add("PII", "Sensitive"));
    TIER1_TAG_LABEL = getTagLabel(FullyQualifiedName.add("Tier", "Tier1"));
    TIER2_TAG_LABEL = getTagLabel(FullyQualifiedName.add("Tier", "Tier2"));

    CreateTagCategory create = new CreateTagCategory().withName("User").withDescription("description");
    USER_TAG_CATEGORY = tagResourceTest.createAndCheckCategory(create, ADMIN_AUTH_HEADERS);

    List<String> associatedTags = new ArrayList<>();
    associatedTags.add(PERSONAL_DATA_TAG_LABEL.getTagFQN());
    associatedTags.add(PII_SENSITIVE_TAG_LABEL.getTagFQN());

    CreateTag createTag =
        new CreateTag().withName("Address").withDescription("description").withAssociatedTags(associatedTags);
    ADDRESS_TAG = tagResourceTest.createPrimaryTag(USER_TAG_CATEGORY.getName(), createTag, ADMIN_AUTH_HEADERS);

    USER_ADDRESS_TAG_LABEL = getTagLabel(FullyQualifiedName.add("User", "Address"));
  }

  private TagLabel getTagLabel(String tagName) throws HttpResponseException {
    return EntityUtil.getTagLabel(TagResourceTest.getTag(tagName, ADMIN_AUTH_HEADERS));
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
        new CreateTagCategory().withName(USER_TAG_CATEGORY.getName()).withDescription("description");
    assertResponse(() -> createAndCheckCategory(create, ADMIN_AUTH_HEADERS), CONFLICT, "Entity already exists");
  }

  @Test
  void post_delete_validTagCategory_as_admin_201(TestInfo test) throws HttpResponseException {
    // POST .../tags/{newCategory} returns 201
    String categoryName = test.getDisplayName().substring(0, 20); // Form a unique category name based on the test name
    CreateTagCategory create = new CreateTagCategory().withName(categoryName).withDescription("description");
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
    CreateTagCategory create = new CreateTagCategory().withName(categoryName).withDescription("description");
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

  @Test
  void delete_systemTags() throws HttpResponseException {
    TagCategory tagCategory = getCategory("Tier", ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteCategory(tagCategory, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.systemEntityDeleteNotAllowed(tagCategory.getName(), Entity.TAG_CATEGORY));

    Tag tag = getTag("Tier.Tier1", ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteTag(tagCategory.getName(), tag, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.systemEntityDeleteNotAllowed(tag.getName(), Entity.TAG));
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
    CreateTagCategory create = new CreateTagCategory().withName(categoryName).withDescription(null);
    assertResponseContains(
        () -> createAndCheckCategory(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "description must not be null");

    // Long name
    create.withName(TestUtils.LONG_ENTITY_NAME);
    assertResponseContains(
        () -> createAndCheckCategory(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "name size must be between 2 and 64");
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
        "name size must be between 2 and 64");

    // Long secondary tag name
    assertResponseContains(
        () -> createSecondaryTag(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 64");
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
  void put_tagCategoryInvalidRequest_400(TestInfo test) {
    // Primary tag with missing description
    String newCategoryName = test.getDisplayName().substring(0, 10);
    CreateTagCategory create = new CreateTagCategory().withName(newCategoryName).withDescription(null);
    assertResponseContains(
        () -> updateCategory(USER_TAG_CATEGORY.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "description must not be null");

    // Long primary tag name
    create.withDescription("description").withName(TestUtils.LONG_ENTITY_NAME);
    assertResponseContains(
        () -> updateCategory(USER_TAG_CATEGORY.getName(), create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 64");
  }

  @Test
  void put_renameSystemTag_400() {
    // Renaming of system tag category and tags are not allowed
    CreateTagCategory create = new CreateTagCategory().withName("Tier").withDescription("description");
    assertResponse(
        () -> renameTagCategory("Tier", "newTier"),
        Status.BAD_REQUEST,
        CatalogExceptionMessage.systemEntityRenameNotAllowed("Tier", Entity.TAG_CATEGORY));

    assertResponse(
        () -> renamePrimaryTag("Tier", "Tier1", "newTier1"),
        Status.BAD_REQUEST,
        CatalogExceptionMessage.systemEntityRenameNotAllowed("Tier1", Entity.TAG));
  }

  @Test
  void put_tagNameChange(TestInfo test) throws HttpResponseException {
    //
    // Create tagCategory with tags t1, t2
    // Create under tag1 secondary tags t11 t12
    // Create under tag2 secondary tags t21 t22
    //
    String categoryName = test.getDisplayName().substring(0, 10);
    CreateTagCategory createCategory = new CreateTagCategory().withName(categoryName).withDescription("description");
    updateCategory(categoryName, createCategory, ADMIN_AUTH_HEADERS);

    updatePrimaryTag(categoryName, "t1", CREATED);
    updateSecondaryTag(categoryName, "t1", "t11");
    updateSecondaryTag(categoryName, "t1", "t12");
    updatePrimaryTag(categoryName, "t2", CREATED);
    updateSecondaryTag(categoryName, "t2", "t21");
    updateSecondaryTag(categoryName, "t2", "t22");

    // Change the tag t2 name and ensure all the children's FQN are updated
    Tag tag = renamePrimaryTag(categoryName, "t2", "newt2");
    assertEquals("newt2", tag.getName());
    getTag(categoryName + ".newt2.t21", ADMIN_AUTH_HEADERS);
    getTag(categoryName + ".newt2.t21", ADMIN_AUTH_HEADERS);

    // Change tag category name and ensure all the tags have the new names
    String newCategoryName = "new" + categoryName;
    TagCategory category = renameTagCategory(categoryName, newCategoryName);
    assertEquals(newCategoryName, category.getName());
    getTag(newCategoryName + ".t1", ADMIN_AUTH_HEADERS);
    getTag(newCategoryName + ".t1.t11", ADMIN_AUTH_HEADERS);
    getTag(newCategoryName + ".t1.t12", ADMIN_AUTH_HEADERS);
    getTag(newCategoryName + ".newt2", ADMIN_AUTH_HEADERS);
    getTag(newCategoryName + ".newt2.t21", ADMIN_AUTH_HEADERS);
    getTag(newCategoryName + ".newt2.t22", ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_tagInvalidRequest_404() {
    // Primary tag with missing description
    CreateTag create = new CreateTag().withName("AddressUpdated").withDescription(null);
    assertResponseContains(
        () -> updatePrimaryTag(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), create, CREATED, ADMIN_AUTH_HEADERS),
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
        () -> updatePrimaryTag(USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), create, CREATED, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 64");

    // Long secondary tag name
    assertResponseContains(
        () ->
            updateSecondaryTag(
                USER_TAG_CATEGORY.getName(), ADDRESS_TAG.getName(), "Secondary", create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 64");
  }

  private TagCategory createAndCheckCategory(CreateTagCategory create, Map<String, String> authHeaders)
      throws HttpResponseException {
    String updatedBy = getPrincipalName(authHeaders);
    WebTarget target = getResource("tags");
    TagCategory tagCategory = TestUtils.post(target, create, TagCategory.class, authHeaders);
    TagCategory category = validate(tagCategory, create.getName(), create.getDescription(), updatedBy);
    assertEquals(0.1, category.getVersion());

    TagCategory getCategory = getCategory(create.getName(), authHeaders);
    validate(getCategory, create.getName(), create.getDescription(), updatedBy);
    return category;
  }

  private Tag createPrimaryTag(String category, CreateTag create, Map<String, String> authHeaders)
      throws HttpResponseException {
    String updatedBy = getPrincipalName(authHeaders);
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
    String updatedBy = getPrincipalName(authHeaders);
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
  private TagCategory updateCategory(String category, CreateTagCategory update, Map<String, String> authHeaders) {
    String updatedBy = getPrincipalName(authHeaders);
    WebTarget target = getResource("tags/" + category);

    // Ensure PUT returns the updated tag category
    TagCategory tagCategory = TestUtils.put(target, update, TagCategory.class, Status.OK, authHeaders);
    validate(tagCategory, update.getName(), update.getDescription(), updatedBy);

    // Ensure GET returns the updated tag category
    TagCategory getCategory = getCategory(update.getName(), authHeaders);
    validate(getCategory, update.getName(), update.getDescription(), updatedBy);
    return tagCategory;
  }

  private Tag updatePrimaryTag(String categoryName, String primaryTag, Status status) throws HttpResponseException {
    CreateTag createTag = new CreateTag().withName(primaryTag).withDescription("description");
    return updatePrimaryTag(categoryName, primaryTag, createTag, status, ADMIN_AUTH_HEADERS);
  }

  private Tag updatePrimaryTag(
      String categoryName, String primaryTag, CreateTag update, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    String updatedBy = getPrincipalName(authHeaders);
    String parentHref = getResource("tags/" + categoryName).getUri().toString();
    WebTarget target = getResource("tags/" + categoryName + "/" + primaryTag);

    // Ensure PUT returns the updated primary tag
    Tag returnedTag = TestUtils.put(target, update, Tag.class, status, authHeaders);
    validate(parentHref, returnedTag, update.getName(), update.getDescription(), updatedBy);

    // Ensure GET returns the updated primary tag
    validate(
        parentHref,
        getTag(returnedTag.getFullyQualifiedName(), authHeaders),
        update.getName(),
        update.getDescription(),
        updatedBy);
    return returnedTag;
  }

  private void updateSecondaryTag(String category, String primaryTag, String secondaryTag)
      throws HttpResponseException {
    CreateTag createTag = new CreateTag().withName(secondaryTag).withDescription("description");
    updateSecondaryTag(category, primaryTag, secondaryTag, createTag, ADMIN_AUTH_HEADERS);
  }

  private void updateSecondaryTag(
      String category, String primaryTag, String secondaryTag, CreateTag update, Map<String, String> authHeaders)
      throws HttpResponseException {
    String updatedBy = getPrincipalName(authHeaders);
    String parentHref = getResource("tags/" + category + "/" + primaryTag).getUri().toString();
    WebTarget target = getResource("tags/" + category + "/" + primaryTag + "/" + secondaryTag);

    // Ensure PUT returns the updated secondary tag
    Tag returnedTag = TestUtils.put(target, update, Tag.class, Status.CREATED, authHeaders);
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
      TagCategory actual, String expectedName, String expectedDescription, String expectedUpdatedBy) {
    validate(actual);
    assertEquals(expectedName, actual.getName());
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

  public Tag renamePrimaryTag(String categoryName, String oldName, String newName) throws HttpResponseException {
    CreateTag create = new CreateTag().withName(newName).withDescription("updateDescription");
    return updatePrimaryTag(categoryName, oldName, create, OK, ADMIN_AUTH_HEADERS);
  }

  public TagCategory renameTagCategory(String oldName, String newName) {
    CreateTagCategory create = new CreateTagCategory().withName(newName).withDescription("description");
    return updateCategory(oldName, create, ADMIN_AUTH_HEADERS);
  }
}
