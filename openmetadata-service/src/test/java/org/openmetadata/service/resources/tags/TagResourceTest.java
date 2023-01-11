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
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.tags.TagResource.TagList;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

/** Tests not covered here: Classification and Tag usage counts are covered in TableResourceTest */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TagResourceTest extends EntityResourceTest<Tag, CreateTag> {
  private final ClassificationResourceTest classificationResourceTest = new ClassificationResourceTest();

  public TagResourceTest() {
    super(Entity.TAG, Tag.class, TagList.class, "tags", TagResource.FIELDS);
    supportsEmptyDescription = false;
  }

  public void setupTags() throws IOException {
    PERSONAL_DATA_TAG_LABEL = getTagLabel(FullyQualifiedName.add("PersonalData", "Personal"));
    PII_SENSITIVE_TAG_LABEL = getTagLabel(FullyQualifiedName.add("PII", "Sensitive"));
    TIER1_TAG_LABEL = getTagLabel(FullyQualifiedName.add("Tier", "Tier1"));
    TIER2_TAG_LABEL = getTagLabel(FullyQualifiedName.add("Tier", "Tier2"));

    CreateClassification create = classificationResourceTest.createRequest("User");
    USER_TAG_CATEGORY = classificationResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    List<String> associatedTags = new ArrayList<>();
    associatedTags.add(PERSONAL_DATA_TAG_LABEL.getTagFQN());
    associatedTags.add(PII_SENSITIVE_TAG_LABEL.getTagFQN());

    CreateTag createTag =
        createRequest("Address").withClassification(USER_TAG_CATEGORY.getName()).withAssociatedTags(associatedTags);
    ADDRESS_TAG = createEntity(createTag, ADMIN_AUTH_HEADERS);
    USER_ADDRESS_TAG_LABEL = getTagLabel(FullyQualifiedName.add("User", "Address"));
  }

  private TagLabel getTagLabel(String tagName) throws HttpResponseException {
    return EntityUtil.toTagLabel(getEntityByName(tagName, "", ADMIN_AUTH_HEADERS));
  }

  @Order(1)
  @Test
  void post_validTags_200() throws HttpResponseException {
    Classification category =
        classificationResourceTest.getEntityByName(USER_TAG_CATEGORY.getName(), authHeaders("test@open-meatadata.org"));
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("parent", category.getFullyQualifiedName());
    List<Tag> childrenBefore = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();

    CreateTag create = createRequest("tag1").withClassification(category.getName());
    Tag tag1 = createEntity(create, ADMIN_AUTH_HEADERS);
    List<Tag> childrenAfter = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();

    assertEquals(childrenBefore.size() + 1, childrenAfter.size());

    // POST .../tags/{category}/{primaryTag}/{secondaryTag} to create secondary tag
    create = createRequest("SecondaryTag").withParent(tag1.getFullyQualifiedName());
    createEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_newTagsOnNonExistentParents_404() {
    // POST .../tags/{nonExistent}/{primaryTag} where category does not exist
    String nonExistent = "nonExistent";
    CreateTag create = createRequest("primary").withClassification(nonExistent);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), NOT_FOUND, entityNotFound(Entity.CLASSIFICATION, nonExistent));

    // POST .../tags/{user}/{nonExistent}/tag where primaryTag does not exist
    String parentFqn = FullyQualifiedName.build(USER_TAG_CATEGORY.getName(), nonExistent);
    CreateTag create1 = createRequest(nonExistent).withParent(parentFqn);
    assertResponse(() -> createEntity(create1, ADMIN_AUTH_HEADERS), NOT_FOUND, entityNotFound(Entity.TAG, parentFqn));
  }

  @Test
  void put_tagNameChange(TestInfo test) throws IOException {
    //
    // Create classification with tags t1, t2
    // Create under tag1 secondary tags t11 t12
    // Create under tag2 secondary tags t21 t22
    //
    String categoryName = test.getDisplayName().substring(0, 10);
    CreateClassification createCategory = classificationResourceTest.createRequest(categoryName);
    Classification category =
        classificationResourceTest.updateEntity(createCategory, Status.CREATED, ADMIN_AUTH_HEADERS);

    Tag t1 = createOrUpdate(categoryName, null, "t1", CREATED);
    createOrUpdate(categoryName, t1, "t11", CREATED);
    createOrUpdate(categoryName, t1, "t12", CREATED);
    Tag t2 = createOrUpdate(categoryName, null, "t2", CREATED);
    createOrUpdate(categoryName, t2, "t21", CREATED);
    Tag t22 = createOrUpdate(categoryName, t2, "t22", CREATED);

    // Rename leaf node t22 to newt22
    renameTagAndCheck(t22, "newt22");

    // Change the tag t2 name and ensure all the children's FQN are updated
    renameTagAndCheck(t2, "newt2");

    // Change classification name and ensure all the tags have the new names
    String newCategoryName = "new" + categoryName;
    classificationResourceTest.renameClassificationAndCheck(category, newCategoryName);
  }

  @Test
  void delete_systemTag() throws HttpResponseException {
    Tag tag = getEntityByName("Tier.Tier1", ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteEntity(tag.getId(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.systemEntityDeleteNotAllowed(tag.getName(), Entity.TAG));
  }

  private Tag createOrUpdate(String categoryName, Tag parent, String name, Status status) throws HttpResponseException {
    String parentFqn = parent != null ? parent.getFullyQualifiedName() : null;
    CreateTag createTag =
        createRequest(name).withParent(parentFqn).withClassification(categoryName).withDescription("description");
    return updateEntity(createTag, status, ADMIN_AUTH_HEADERS); // Change to updateAndCheck
  }

  public void renameTagAndCheck(Tag tag, String newName) throws IOException {
    String oldName = tag.getName();
    String json = JsonUtils.pojoToJson(tag);
    ChangeDescription change = getChangeDescription(tag.getVersion());
    fieldUpdated(change, "name", oldName, newName);
    tag.setName(newName);
    tag = patchEntityAndCheck(tag, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // GET the tag and check all the children are renamed
    Tag getTag = getEntity(tag.getId(), ADMIN_AUTH_HEADERS);
    for (EntityReference ref : getTag.getChildren()) {
      assertTrue(ref.getFullyQualifiedName().startsWith(getTag.getFullyQualifiedName()));
    }

    // List children tags with this term as the parent and ensure rename
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("parent", getTag.getFullyQualifiedName());
    List<Tag> children = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    for (Tag child : listOrEmpty(children)) {
      assertTrue(child.getFullyQualifiedName().startsWith(getTag.getFullyQualifiedName()));
    }
  }

  @Override
  public CreateTag createRequest(String name) {
    return new CreateTag()
        .withName(name)
        .withDescription("description")
        .withClassification(USER_TAG_CATEGORY.getName());
  }

  @Override
  public void validateCreatedEntity(Tag createdEntity, CreateTag request, Map<String, String> authHeaders) {
    assertEquals(request.getClassification(), createdEntity.getClassification().getFullyQualifiedName());
    if (request.getParent() == null) {
      assertNull(createdEntity.getParent());
    } else {
      assertEquals(request.getParent(), createdEntity.getParent().getFullyQualifiedName());
    }
    assertEquals(
        request.getProvider() == null ? ProviderType.USER : request.getProvider(), createdEntity.getProvider());
    assertEquals(request.getMutuallyExclusive(), createdEntity.getMutuallyExclusive());
  }

  @Override
  public void compareEntities(Tag expected, Tag updated, Map<String, String> authHeaders) {
    assertReference(expected.getClassification(), updated.getClassification());
    assertReference(expected.getParent(), updated.getParent());
    assertEquals(expected.getProvider() == null ? ProviderType.USER : expected.getProvider(), updated.getProvider());
    assertEquals(expected.getMutuallyExclusive(), updated.getMutuallyExclusive());
  }

  @Override
  public Tag validateGetWithDifferentFields(Tag tag, boolean byName) throws HttpResponseException {
    String fields = "";
    tag =
        byName
            ? getEntityByName(tag.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(tag.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(tag.getClassification());
    assertListNull(tag.getUsageCount(), tag.getChildren());

    fields = "children,usageCount";
    tag =
        byName
            ? getEntityByName(tag.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(tag.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(tag.getClassification(), tag.getUsageCount(), tag.getChildren());
    return tag;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
