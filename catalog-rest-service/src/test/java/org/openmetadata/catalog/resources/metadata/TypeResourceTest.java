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
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.CreateType;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.types.TypeResource;
import org.openmetadata.catalog.resources.types.TypeResource.TypeList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TypeResourceTest extends EntityResourceTest<Type, CreateType> {
  public static Type INT_TYPE;

  public TypeResourceTest() {
    super(Entity.TYPE, Type.class, TypeList.class, "metadata/types", TypeResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFieldsQueryParam = false;
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    INT_TYPE = getEntityByName("type.basic.integer", "", ADMIN_AUTH_HEADERS);
  }

  @Override
  public Type validateGetWithDifferentFields(Type type, boolean byName) throws HttpResponseException {
    type =
        byName
            ? getEntityByName(type.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(type.getId(), null, ADMIN_AUTH_HEADERS);

    return type;
  }

  @Override
  public CreateType createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateType()
        .withName(name)
        .withDescription(description)
        .withDisplayName(displayName)
        .withSchema(INT_TYPE.getSchema());
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
