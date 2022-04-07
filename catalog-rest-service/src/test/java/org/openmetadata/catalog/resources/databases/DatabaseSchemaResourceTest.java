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

package org.openmetadata.catalog.resources.databases;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateDatabaseSchema;
import org.openmetadata.catalog.entity.data.DatabaseSchema;
import org.openmetadata.catalog.jdbi3.DatabaseSchemaRepository.DatabaseSchemaEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.databases.DatabaseSchemaResource.DatabaseSchemaList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class DatabaseSchemaResourceTest extends EntityResourceTest<DatabaseSchema, CreateDatabaseSchema> {
  public DatabaseSchemaResourceTest() {
    super(
        Entity.DATABASE_SCHEMA,
        DatabaseSchema.class,
        DatabaseSchemaList.class,
        "databaseSchemas",
        DatabaseSchemaResource.FIELDS);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
  }

  @Test
  void post_schemaWithoutRequiredDatabase_400(TestInfo test) {
    CreateDatabaseSchema create = createRequest(test).withDatabase(null);
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "database must not be null");
  }

  /** Validate returned fields GET .../databases/{id}?fields="..." or GET .../databases/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(DatabaseSchema schema, boolean byName) throws HttpResponseException {
    String fields = "";
    schema =
        byName
            ? getEntityByName(schema.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(schema.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(schema.getService(), schema.getServiceType(), schema.getDatabase());
    assertListNull(schema.getOwner(), schema.getTables());

    fields = "owner,tables";
    schema =
        byName
            ? getEntityByName(schema.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(schema.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(schema.getService(), schema.getServiceType());
    // Fields usageSummary and location are not set during creation - tested elsewhere
    assertListNotNull(schema.getOwner(), schema.getTables());
    TestUtils.validateEntityReferences(schema.getTables());
  }

  @Override
  public CreateDatabaseSchema createRequest(
      String name, String description, String displayName, EntityReference owner) {
    return new CreateDatabaseSchema()
        .withName(name)
        .withDescription(description)
        .withOwner(owner)
        .withDatabase(getContainer());
  }

  @Override
  public EntityReference getContainer() {
    return DATABASE_REFERENCE;
  }

  @Override
  public void validateCreatedEntity(
      DatabaseSchema schema, CreateDatabaseSchema createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(schema),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());

    // Validate service
    assertNotNull(schema.getServiceType());
    assertReference(createRequest.getDatabase(), schema.getDatabase());
    assertEquals(
        FullyQualifiedName.add(schema.getDatabase().getName(), schema.getName()), schema.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(DatabaseSchema expected, DatabaseSchema updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(updated),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
    // Validate service
    assertReference(expected.getDatabase(), updated.getDatabase());
    assertEquals(
        FullyQualifiedName.add(updated.getDatabase().getName(), updated.getName()), updated.getFullyQualifiedName());
  }

  @Override
  public EntityInterface<DatabaseSchema> getEntityInterface(DatabaseSchema entity) {
    return new DatabaseSchemaEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
