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

package org.openmetadata.service.resources.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.CHANGE_CONSOLIDATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertCustomProperties;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.CreateType;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.customproperties.EnumConfig;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.types.TypeResource;
import org.openmetadata.service.resources.types.TypeResource.TypeList;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TypeResourceTest extends EntityResourceTest<Type, CreateType> {

  public TypeResourceTest() {
    super(Entity.TYPE, Type.class, TypeList.class, "metadata/types", TypeResource.PROPERTIES);
    supportsFieldsQueryParam = false;
    supportedNameCharacters =
        "_" + RANDOM_STRING_GENERATOR.generate(1); // No other special characters allowed
  }

  public void setupTypes() throws HttpResponseException {
    INT_TYPE = getEntityByName("integer", "", ADMIN_AUTH_HEADERS);
    STRING_TYPE = getEntityByName("string", "", ADMIN_AUTH_HEADERS);
    ENUM_TYPE = getEntityByName("enum", "", ADMIN_AUTH_HEADERS);
  }

  @Override
  @Test
  public void post_entityCreateWithInvalidName_400() {
    // Names can't start with capital letter, can't have space, hyphen, apostrophe
    String[] tests = {"a bc", "a-bc", "a'b"};

    String error = "[name must match \"(?U)^[\\w]+$\"]";
    CreateType create = createRequest("placeHolder", "", "", null);
    for (String test : tests) {
      LOG.info("Testing with the name {}", test);
      create.withName(test);
      assertResponseContains(
          () -> createEntity(create, ADMIN_AUTH_HEADERS), Status.BAD_REQUEST, error);
    }
  }

  @Test
  void put_patch_customProperty_200() throws IOException {
    Type topicEntity = getEntityByName("topic", "customProperties", ADMIN_AUTH_HEADERS);
    assertTrue(listOrEmpty(topicEntity.getCustomProperties()).isEmpty());

    // Add a custom property with name intA with type integer with PUT
    CustomProperty fieldA =
        new CustomProperty()
            .withName("intA")
            .withDescription("intA")
            .withPropertyType(INT_TYPE.getEntityReference());
    ChangeDescription change = getChangeDescription(topicEntity, MINOR_UPDATE);
    fieldAdded(change, "customProperties", new ArrayList<>(List.of(fieldA)));
    topicEntity =
        addCustomPropertyAndCheck(
            topicEntity.getId(), fieldA, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertCustomProperties(new ArrayList<>(List.of(fieldA)), topicEntity.getCustomProperties());

    // Changing custom property description with PUT
    fieldA.withDescription("updated");
    change = getChangeDescription(topicEntity, MINOR_UPDATE);
    fieldUpdated(change, EntityUtil.getCustomField(fieldA, "description"), "intA", "updated");
    topicEntity =
        addCustomPropertyAndCheck(
            topicEntity.getId(), fieldA, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertCustomProperties(new ArrayList<>(List.of(fieldA)), topicEntity.getCustomProperties());

    // Changing custom property description with PATCH
    // Changes from this PATCH is consolidated with the previous changes
    fieldA.withDescription("updated2");
    String json = JsonUtils.pojoToJson(topicEntity);
    topicEntity.setCustomProperties(List.of(fieldA));
    change = getChangeDescription(topicEntity, CHANGE_CONSOLIDATED);
    fieldUpdated(change, EntityUtil.getCustomField(fieldA, "description"), "intA", "updated2");
    topicEntity =
        patchEntityAndCheck(topicEntity, json, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);

    // Add a second property with name intB with type integer
    // Note that since this is PUT operation, the previous changes are not consolidated
    EntityReference typeRef =
        new EntityReference()
            .withType(INT_TYPE.getEntityReference().getType())
            .withId(INT_TYPE.getEntityReference().getId());
    CustomProperty fieldB =
        new CustomProperty().withName("intB").withDescription("intB").withPropertyType(typeRef);
    change = getChangeDescription(topicEntity, MINOR_UPDATE);
    fieldAdded(change, "customProperties", new ArrayList<>(List.of(fieldB)));
    topicEntity =
        addCustomPropertyAndCheck(
            topicEntity.getId(), fieldB, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    fieldB.setPropertyType(INT_TYPE.getEntityReference());
    assertEquals(2, topicEntity.getCustomProperties().size());
    assertCustomProperties(
        new ArrayList<>(List.of(fieldA, fieldB)), topicEntity.getCustomProperties());
  }

  @Test
  void put_patch_customProperty_enum_200() throws IOException {
    Type tableEntity = getEntityByName("table", "customProperties", ADMIN_AUTH_HEADERS);
    assertTrue(listOrEmpty(tableEntity.getCustomProperties()).isEmpty());

    // Add a custom property with name intA with type integer with PUT
    CustomProperty enumFieldA =
        new CustomProperty()
            .withName("enumTest")
            .withDescription("enumTest")
            .withPropertyType(ENUM_TYPE.getEntityReference());
    ChangeDescription change = getChangeDescription(tableEntity, MINOR_UPDATE);
    fieldAdded(change, "customProperties", new ArrayList<>(List.of(enumFieldA)));
    Type finalTableEntity = tableEntity;
    ChangeDescription finalChange = change;
    assertResponseContains(
        () ->
            addCustomPropertyAndCheck(
                finalTableEntity.getId(),
                enumFieldA,
                ADMIN_AUTH_HEADERS,
                MINOR_UPDATE,
                finalChange),
        Status.BAD_REQUEST,
        "Enum Custom Property Type must have EnumConfig.");
    enumFieldA.setCustomPropertyConfig(new CustomPropertyConfig().withConfig(new EnumConfig()));
    ChangeDescription change1 = getChangeDescription(tableEntity, MINOR_UPDATE);
    Type tableEntity1 = tableEntity;
    assertResponseContains(
        () ->
            addCustomPropertyAndCheck(
                tableEntity1.getId(), enumFieldA, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change1),
        Status.BAD_REQUEST,
        "Enum Custom Property Type must have EnumConfig populated with values.");

    enumFieldA.setCustomPropertyConfig(
        new CustomPropertyConfig()
            .withConfig(new EnumConfig().withValues(List.of("A", "B", "C", "C"))));
    ChangeDescription change7 = getChangeDescription(tableEntity, MINOR_UPDATE);
    Type tableEntity2 = tableEntity;
    assertResponseContains(
        () ->
            addCustomPropertyAndCheck(
                tableEntity2.getId(), enumFieldA, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change7),
        Status.BAD_REQUEST,
        "Enum Custom Property values cannot have duplicates.");

    enumFieldA.setCustomPropertyConfig(
        new CustomPropertyConfig().withConfig(new EnumConfig().withValues(List.of("A", "B", "C"))));
    tableEntity =
        addCustomPropertyAndCheck(
            tableEntity.getId(), enumFieldA, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertCustomProperties(new ArrayList<>(List.of(enumFieldA)), tableEntity.getCustomProperties());
    CustomPropertyConfig prevConfig = enumFieldA.getCustomPropertyConfig();
    // Changing custom property description with PUT
    enumFieldA.withDescription("updatedEnumTest");
    ChangeDescription change2 = getChangeDescription(tableEntity, MINOR_UPDATE);
    fieldUpdated(
        change2,
        EntityUtil.getCustomField(enumFieldA, "description"),
        "enumTest",
        "updatedEnumTest");
    tableEntity =
        addCustomPropertyAndCheck(
            tableEntity.getId(), enumFieldA, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change2);
    assertCustomProperties(new ArrayList<>(List.of(enumFieldA)), tableEntity.getCustomProperties());

    enumFieldA.setCustomPropertyConfig(
        new CustomPropertyConfig().withConfig(new EnumConfig().withValues(List.of("A", "B"))));
    ChangeDescription change3 = getChangeDescription(tableEntity, MINOR_UPDATE);
    assertResponseContains(
        () ->
            addCustomPropertyAndCheck(
                tableEntity1.getId(), enumFieldA, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change3),
        Status.BAD_REQUEST,
        "Existing Enum Custom Property values cannot be removed.");

    enumFieldA.setCustomPropertyConfig(
        new CustomPropertyConfig()
            .withConfig(new EnumConfig().withValues(List.of("A", "B", "C", "C"))));
    ChangeDescription change4 = getChangeDescription(tableEntity, MINOR_UPDATE);
    assertResponseContains(
        () ->
            addCustomPropertyAndCheck(
                tableEntity1.getId(), enumFieldA, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change4),
        Status.BAD_REQUEST,
        "Enum Custom Property values cannot have duplicates.");

    ChangeDescription change5 = getChangeDescription(tableEntity, MINOR_UPDATE);
    enumFieldA.setCustomPropertyConfig(
        new CustomPropertyConfig()
            .withConfig(new EnumConfig().withValues(List.of("A", "B", "C", "D"))));
    fieldUpdated(
        change5,
        EntityUtil.getCustomField(enumFieldA, "customPropertyConfig"),
        prevConfig,
        enumFieldA.getCustomPropertyConfig());
    tableEntity =
        addCustomPropertyAndCheck(
            tableEntity.getId(), enumFieldA, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change5);
    assertCustomProperties(new ArrayList<>(List.of(enumFieldA)), tableEntity.getCustomProperties());

    // Changing custom property description with PATCH
    // Changes from this PATCH is consolidated with the previous changes
    enumFieldA.withDescription("updated2");
    String json = JsonUtils.pojoToJson(tableEntity);
    tableEntity.setCustomProperties(List.of(enumFieldA));
    change = getChangeDescription(tableEntity, CHANGE_CONSOLIDATED);
    fieldUpdated(
        change5,
        EntityUtil.getCustomField(enumFieldA, "description"),
        "updatedEnumTest",
        "updated2");

    tableEntity =
        patchEntityAndCheck(tableEntity, json, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change5);

    /* // Add a second property with name intB with type integer
    // Note that since this is PUT operation, the previous changes are not consolidated
    EntityReference typeRef =
        new EntityReference()
            .withType(INT_TYPE.getEntityReference().getType())
            .withId(INT_TYPE.getEntityReference().getId());
    CustomProperty fieldB =
        new CustomProperty().withName("intB").withDescription("intB").withPropertyType(typeRef);
    change = getChangeDescription(tableEntity, MINOR_UPDATE);
    fieldAdded(change, "customProperties", new ArrayList<>(List.of(fieldB)));
    tableEntity =
        addCustomPropertyAndCheck(
            tableEntity.getId(), fieldB, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    fieldB.setPropertyType(INT_TYPE.getEntityReference());
    assertEquals(2, tableEntity.getCustomProperties().size());
    assertCustomProperties(
        new ArrayList<>(List.of(fieldA, fieldB)), tableEntity.getCustomProperties());*/
  }

  @Test
  void put_customPropertyToPropertyType_4xx() {
    // Adding a custom property to a property type is not allowed (only entity type is allowed)
    CustomProperty field =
        new CustomProperty()
            .withName("intA")
            .withDescription("intA")
            .withPropertyType(INT_TYPE.getEntityReference());
    assertResponse(
        () -> addCustomProperty(INT_TYPE.getId(), field, Status.CREATED, ADMIN_AUTH_HEADERS),
        Status.BAD_REQUEST,
        "Only entity types can be extended and field types can't be extended");
  }

  @Override
  public Type validateGetWithDifferentFields(Type type, boolean byName)
      throws HttpResponseException {
    type =
        byName
            ? getEntityByName(type.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(type.getId(), null, ADMIN_AUTH_HEADERS);

    return type;
  }

  public Type addAndCheckCustomProperty(
      UUID entityTypeId,
      CustomProperty customProperty,
      Status status,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    Type updated = addCustomProperty(entityTypeId, customProperty, status, authHeaders);
    assertTrue(updated.getCustomProperties().contains(customProperty));

    Type get = getEntity(entityTypeId, "customProperties", authHeaders);
    assertTrue(get.getCustomProperties().contains(customProperty));
    return updated;
  }

  public Type addCustomPropertyAndCheck(
      UUID entityTypeId,
      CustomProperty customProperty,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription expectedChange)
      throws IOException {
    Type returned = addCustomProperty(entityTypeId, customProperty, Status.OK, authHeaders);
    validateChangeDescription(returned, updateType, expectedChange);
    validateEntityHistory(returned.getId(), updateType, expectedChange, authHeaders);
    validateLatestVersion(returned, updateType, expectedChange, authHeaders);
    return returned;
  }

  public Type addCustomProperty(
      UUID entityTypeId,
      CustomProperty customProperty,
      Status status,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(entityTypeId);
    return TestUtils.put(target, customProperty, Type.class, status, authHeaders);
  }

  @Override
  public CreateType createRequest(String name) {
    return new CreateType()
        .withName(name)
        .withCategory(Category.Field)
        .withSchema(INT_TYPE.getSchema());
  }

  @Override
  public void validateCreatedEntity(
      Type createdEntity, CreateType createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getSchema(), createdEntity.getSchema());
    assertEquals(createRequest.getCategory(), createdEntity.getCategory());
    assertEquals(createRequest.getNameSpace(), createdEntity.getNameSpace());
  }

  @Override
  public void compareEntities(Type expected, Type patched, Map<String, String> authHeaders) {
    assertEquals(expected.getSchema(), patched.getSchema());
    assertEquals(expected.getSchema(), patched.getSchema());
    assertEquals(expected.getCategory(), patched.getCategory());
    assertEquals(expected.getNameSpace(), patched.getNameSpace());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("customProperties")) {
      @SuppressWarnings("unchecked")
      List<CustomProperty> expectedProperties = (List<CustomProperty>) expected;
      List<CustomProperty> actualProperties =
          JsonUtils.readObjects(actual.toString(), CustomProperty.class);
      TestUtils.assertCustomProperties(expectedProperties, actualProperties);
    } else if (fieldName.contains("customPropertyConfig")) {
      String expectedStr = JsonUtils.pojoToJson(expected);
      String actualStr = JsonUtils.pojoToJson(actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
