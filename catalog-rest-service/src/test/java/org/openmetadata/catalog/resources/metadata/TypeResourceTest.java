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

package org.openmetadata.catalog.resources.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.CreateType;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.entity.type.Category;
import org.openmetadata.catalog.entity.type.CustomField;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.types.TypeResource;
import org.openmetadata.catalog.resources.types.TypeResource.TypeList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TypeResourceTest extends EntityResourceTest<Type, CreateType> {

  public TypeResourceTest() {
    super(Entity.TYPE, Type.class, TypeList.class, "metadata/types", TypeResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFieldsQueryParam = false;
    supportsNameWithDot = false;
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    INT_TYPE = getEntityByName("integer", "", ADMIN_AUTH_HEADERS);
  }

  @Override
  @Test
  public void post_entityCreateWithInvalidName_400() {
    String[][] tests = {
      {"Abcd", "[name must match \"^[a-z][a-zA-Z0-9]+$\"]"},
      {"a bc", "[name must match \"^[a-z][a-zA-Z0-9]+$\"]"}, // Name must not have space
      {"a_bc", "[name must match \"^[a-z][a-zA-Z0-9]+$\"]"}, // Name must not be underscored
      {"a-bc", "[name must match \"^[a-z][a-zA-Z0-9]+$\"]"}, // Name must not be hyphened
    };

    CreateType create = createRequest("placeHolder", "", "", null);
    for (String[] test : tests) {
      LOG.info("Testing with the name {}", test[0]);
      create.withName(test[0]);
      assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), Status.BAD_REQUEST, test[1]);
    }
  }

  @Test
  public void put_customField_200() throws HttpResponseException {
    Type tableEntity = getEntityByName("table", "customFields", ADMIN_AUTH_HEADERS);
    assertTrue(listOrEmpty(tableEntity.getCustomFields()).isEmpty());

    // Add a custom field with name intA with type integer
    CustomField fieldA =
        new CustomField().withName("intA").withDescription("intA").withFieldType(INT_TYPE.getEntityReference());
    tableEntity = addCustomField(tableEntity.getId(), fieldA, Status.OK, ADMIN_AUTH_HEADERS);
    assertEquals(1, tableEntity.getCustomFields().size());
    assertEquals(fieldA, tableEntity.getCustomFields().get(0));

    // Add a second field with name intB with type integer
    CustomField fieldB =
        new CustomField().withName("intB").withDescription("intB").withFieldType(INT_TYPE.getEntityReference());
    tableEntity = addCustomField(tableEntity.getId(), fieldB, Status.OK, ADMIN_AUTH_HEADERS);
    assertEquals(2, tableEntity.getCustomFields().size());
    assertEquals(fieldA, tableEntity.getCustomFields().get(0));
    assertEquals(fieldB, tableEntity.getCustomFields().get(1));
  }

  @Test
  public void put_customFieldToFieldType_4xx() {
    // Adding a custom field to a field type is not allowed (only entity type is allowed)
    CustomField field =
        new CustomField().withName("intA").withDescription("intA").withFieldType(INT_TYPE.getEntityReference());
    assertResponse(
        () -> addCustomField(INT_TYPE.getId(), field, Status.CREATED, ADMIN_AUTH_HEADERS),
        Status.BAD_REQUEST,
        "Field types can't be extended");
  }

  @Override
  public Type validateGetWithDifferentFields(Type type, boolean byName) throws HttpResponseException {
    type =
        byName
            ? getEntityByName(type.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(type.getId(), null, ADMIN_AUTH_HEADERS);

    return type;
  }

  public Type addCustomField(UUID entityTypeId, CustomField customField, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(entityTypeId);
    return TestUtils.put(target, customField, Type.class, status, authHeaders);
  }

  @Override
  public CreateType createRequest(String name) {
    if (name != null) {
      name = name.replaceAll("[. _-]", "");
    }
    return new CreateType().withName(name).withCategory(Category.Field).withSchema(INT_TYPE.getSchema());
  }

  @Override
  public void validateCreatedEntity(Type createdEntity, CreateType createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        createdEntity, createRequest.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    // Entity specific validation
    assertEquals(createRequest.getSchema(), createdEntity.getSchema());
    // TODO
  }

  @Override
  public void compareEntities(Type expected, Type patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(patched, expected.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    // Entity specific validation
    assertEquals(expected.getSchema(), patched.getSchema());
    // TODO more checks
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
