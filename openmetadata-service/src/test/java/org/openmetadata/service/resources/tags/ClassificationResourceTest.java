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
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.CHANGE_CONSOLIDATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.tags.ClassificationResource.ClassificationList;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;

/** Tests not covered here: Classification and Tag usage counts are covered in TableResourceTest */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ClassificationResourceTest
    extends EntityResourceTest<Classification, CreateClassification> {
  public ClassificationResourceTest() {
    super(
        Entity.CLASSIFICATION,
        Classification.class,
        ClassificationList.class,
        "classifications",
        ClassificationResource.FIELDS);
  }

  @Test
  void put_classificationInvalidRequest_400(TestInfo test) {
    // Primary tag with missing description
    String newCategoryName = test.getDisplayName().substring(0, 10);
    CreateClassification create =
        new CreateClassification().withName(newCategoryName).withDescription(null);
    assertResponseContains(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "description must not be null");

    // Long primary tag name
    create.withDescription("description").withName(TestUtils.LONG_ENTITY_NAME);
    assertResponseContains(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name size must be between 1 and 256");
  }

  @Test
  void delete_systemClassification() throws HttpResponseException {
    Classification classification = getEntityByName("Tier", ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteEntity(classification.getId(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.systemEntityDeleteNotAllowed(
            classification.getName(), Entity.CLASSIFICATION));
  }

  @Test
  void test_addUpdateRemoveRolesInClassification(TestInfo test) throws IOException {

    // Create a classification with roles
    String classificationName = getEntityName(test);
    CreateClassification createRequest =
        createRequest(classificationName)
            .withDescription("Test classification with roles")
            .withRoles(
                listOf(
                    DATA_CONSUMER_ROLE.getEntityReference(),
                    DATA_STEWARD_ROLE.getEntityReference()));

    Classification classification = createAndCheckEntity(createRequest, ADMIN_AUTH_HEADERS);

    // Validate that roles are assigned
    assertEquals(2, classification.getRoles().size());
    assertTrue(
        classification.getRoles().stream()
            .anyMatch(
                r ->
                    r.getId().equals(DATA_CONSUMER_ROLE.getId())
                        && r.getType().equals(Entity.ROLE)));
    assertTrue(
        classification.getRoles().stream()
            .anyMatch(
                r ->
                    r.getId().equals(DATA_STEWARD_ROLE.getId())
                        && r.getType().equals(Entity.ROLE)));
    String origJson = JsonUtils.pojoToJson(classification);
    // Update the classification by removing one role and adding another
    Role role3 = createRole("Role3");
    classification.setRoles(
        listOf(DATA_CONSUMER_ROLE.getEntityReference(), role3.getEntityReference()));

    ChangeDescription change = getChangeDescription(classification, MINOR_UPDATE);
    fieldAdded(change, "roles", listOf(role3.getEntityReference()));
    fieldDeleted(change, "roles", listOf(DATA_STEWARD_ROLE.getEntityReference()));
    Classification updatedClassification =
        patchEntityAndCheck(classification, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Validate that roles are updated
    assertEquals(2, updatedClassification.getRoles().size());
    assertTrue(
        updatedClassification.getRoles().stream()
            .anyMatch(
                r ->
                    r.getId().equals(DATA_CONSUMER_ROLE.getId())
                        && r.getType().equals(Entity.ROLE)));
    assertTrue(
        updatedClassification.getRoles().stream()
            .anyMatch(r -> r.getId().equals(role3.getId()) && r.getType().equals(Entity.ROLE)));

    origJson = JsonUtils.pojoToJson(updatedClassification);
    change = getChangeDescription(updatedClassification, CHANGE_CONSOLIDATED);
    updatedClassification.setRoles(null);
    fieldDeleted(
        change,
        "roles",
        listOf(DATA_CONSUMER_ROLE.getEntityReference(), DATA_STEWARD_ROLE.getEntityReference()));
    Classification classificationWithoutRoles =
        patchEntityAndCheck(
            updatedClassification, origJson, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);

    assertTrue(
        classificationWithoutRoles.getRoles() == null
            || classificationWithoutRoles.getRoles().isEmpty());
  }

  private Role createRole(String roleName) throws IOException {
    CreateRole createRole =
        new CreateRole()
            .withName(roleName)
            .withDescription("Test role")
            .withPolicies(listOf(POLICY1.getFullyQualifiedName()));
    return TestUtils.post(getResource("roles"), createRole, Role.class, 201, ADMIN_AUTH_HEADERS);
  }

  @Override
  public CreateClassification createRequest(String name) {
    return new CreateClassification()
        .withName(name)
        .withDescription("description")
        .withProvider(ProviderType.USER);
  }

  @Override
  public void validateCreatedEntity(
      Classification createdEntity, CreateClassification request, Map<String, String> authHeaders) {
    assertEquals(
        request.getProvider() == null ? ProviderType.USER : request.getProvider(),
        createdEntity.getProvider());
    assertEquals(request.getMutuallyExclusive(), createdEntity.getMutuallyExclusive());
  }

  @Override
  public void compareEntities(
      Classification expected, Classification updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getDescription(), updated.getDescription());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getTags(), updated.getTags());
    if (expected.getRoles() != null) {
      assertEntityReferences(expected.getRoles(), updated.getRoles());
    }
    assertEquals(expected.getMutuallyExclusive(), updated.getMutuallyExclusive());
    assertEquals(
        expected.getProvider() == null ? ProviderType.USER : expected.getProvider(),
        updated.getProvider());
  }

  @Override
  public Classification validateGetWithDifferentFields(
      Classification classification, boolean byName) throws HttpResponseException {
    classification =
        byName
            ? getEntityByName(classification.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(classification.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(classification.getUsageCount());

    String fields = "usageCount";
    classification =
        byName
            ? getEntityByName(classification.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(classification.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(classification.getUsageCount());
    return classification;
  }

  public void renameClassificationAndCheck(Classification classification, String newName)
      throws IOException {
    // User PATCH operation to rename a classification
    String oldName = classification.getName();
    String json = JsonUtils.pojoToJson(classification);
    ChangeDescription change = getChangeDescription(classification, MINOR_UPDATE);
    fieldUpdated(change, "name", oldName, newName);
    classification.setName(newName);
    Classification ret =
        patchEntityAndCheck(classification, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Now check all the children are renamed
    // List children glossary terms with this term as the parent and ensure rename
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("parent", ret.getFullyQualifiedName());
    List<Tag> children =
        new TagResourceTest().listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    for (Tag child : listOrEmpty(children)) {
      assertTrue(child.getFullyQualifiedName().startsWith(ret.getFullyQualifiedName()));
    }
  }

  public Classification updateEntity(Classification classification, String json, Map<String, String> authHeaders, TestUtils.UpdateType updateType, ChangeDescription change)
      throws IOException {
    return patchEntityAndCheck(classification, json, authHeaders, updateType, change);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    } else if (fieldName.equals("roles")) {
      assertEntityReferencesFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
