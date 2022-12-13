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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.tags.CreateTagCategory;
import org.openmetadata.schema.entity.tags.Tag;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagCategory;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.tags.TagCategoryResource.TagCategoryList;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;

/** Tests not covered here: Tag category and Tag usage counts are covered in TableResourceTest */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TagCategoryResourceTest extends EntityResourceTest<TagCategory, CreateTagCategory> {
  public TagCategoryResourceTest() {
    super(Entity.TAG_CATEGORY, TagCategory.class, TagCategoryList.class, "categories", TagCategoryResource.FIELDS);
    supportsEmptyDescription = false;
  }

  @Test
  void put_tagCategoryInvalidRequest_400(TestInfo test) {
    // Primary tag with missing description
    String newCategoryName = test.getDisplayName().substring(0, 10);
    CreateTagCategory create = new CreateTagCategory().withName(newCategoryName).withDescription(null);
    assertResponseContains(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS), BAD_REQUEST, "description must not be null");

    // Long primary tag name
    create.withDescription("description").withName(TestUtils.LONG_ENTITY_NAME);
    assertResponseContains(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 2 and 64");
  }

  @Test
  void delete_systemTagCategory() throws HttpResponseException {
    TagCategory tagCategory = getEntityByName("Tier", ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteEntity(tagCategory.getId(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.systemEntityDeleteNotAllowed(tagCategory.getName(), Entity.TAG_CATEGORY));
  }

  @Override
  public CreateTagCategory createRequest(String name) {
    return new CreateTagCategory().withName(name).withDescription("description");
  }

  @Override
  public void validateCreatedEntity(
      TagCategory createdEntity, CreateTagCategory request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(
        request.getProvider() == null ? ProviderType.USER : request.getProvider(), createdEntity.getProvider());
    assertEquals(request.getMutuallyExclusive(), createdEntity.getMutuallyExclusive());
  }

  @Override
  public void compareEntities(TagCategory expected, TagCategory updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getProvider() == null ? ProviderType.USER : expected.getProvider(), updated.getProvider());
    assertEquals(expected.getMutuallyExclusive(), updated.getMutuallyExclusive());
  }

  @Override
  public TagCategory validateGetWithDifferentFields(TagCategory tagCategory, boolean byName)
      throws HttpResponseException {
    tagCategory =
        byName
            ? getEntityByName(tagCategory.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(tagCategory.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(tagCategory.getUsageCount());

    String fields = "usageCount";
    tagCategory =
        byName
            ? getEntityByName(tagCategory.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(tagCategory.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(tagCategory.getUsageCount());
    return tagCategory;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }

  public void renameTagCategoryAndCheck(TagCategory tagCategory, String newName) throws IOException {
    String oldName = tagCategory.getName();
    String json = JsonUtils.pojoToJson(tagCategory);
    ChangeDescription change = getChangeDescription(tagCategory.getVersion());
    fieldUpdated(change, "name", oldName, newName);
    tagCategory.setName(newName);
    TagCategory ret = patchEntityAndCheck(tagCategory, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Now check all the children are renamed
    // List children glossary terms with this term as the parent and ensure rename
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("parent", ret.getFullyQualifiedName());
    List<Tag> children = new TagResourceTest().listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    for (Tag child : listOrEmpty(children)) {
      assertTrue(child.getFullyQualifiedName().startsWith(ret.getFullyQualifiedName()));
    }
  }
}
