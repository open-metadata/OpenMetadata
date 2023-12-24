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

package org.openmetadata.service.resources.databases;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsv.entityNotFound;
import static org.openmetadata.csv.EntityCsvTest.assertRows;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.csv.EntityCsvTest.getFailedRecord;
import static org.openmetadata.service.util.EntityUtil.getFqn;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseRepository.DatabaseCsv;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class DatabaseResourceTest extends EntityResourceTest<Database, CreateDatabase> {
  public DatabaseResourceTest() {
    super(
        Entity.DATABASE, Database.class, DatabaseList.class, "databases", DatabaseResource.FIELDS);
    supportedNameCharacters = "_'+#- .()$" + EntityResourceTest.RANDOM_STRING_GENERATOR.generate(1);
  }

  @Test
  void post_databaseFQN_as_admin_200_OK(TestInfo test) throws IOException {
    // Create database with different optional fields
    CreateDatabase create =
        createRequest(test).withService(SNOWFLAKE_REFERENCE.getFullyQualifiedName());
    Database db = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    String expectedFQN =
        FullyQualifiedName.build(SNOWFLAKE_REFERENCE.getFullyQualifiedName(), create.getName());
    assertEquals(expectedFQN, db.getFullyQualifiedName());
  }

  @Test
  void post_databaseWithoutRequiredService_4xx(TestInfo test) {
    CreateDatabase create = createRequest(test).withService(null);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_databaseWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {
      MYSQL_REFERENCE, REDSHIFT_REFERENCE, BIGQUERY_REFERENCE, SNOWFLAKE_REFERENCE
    };

    // Create database for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(
          createRequest(test).withService(service.getFullyQualifiedName()), ADMIN_AUTH_HEADERS);

      // List databases by filtering on service name and ensure right databases in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service.getName());

      ResultList<Database> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Database db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  @SneakyThrows
  void testImportInvalidCsv() {
    Database database = createEntity(createRequest("invalidCsv"), ADMIN_AUTH_HEADERS);
    String databaseName = database.getFullyQualifiedName();

    // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
    // Create database schema with invalid name (due to ::)
    String resultsHeader = recordToString(EntityCsv.getResultHeaders(DatabaseCsv.HEADERS));
    String record = "s::1,dsp1,dsc1,,,,,";
    String csv = createCsv(DatabaseCsv.HEADERS, listOf(record), null);
    CsvImportResult result = importCsv(databaseName, csv, false);
    Awaitility.await().atMost(4, TimeUnit.SECONDS).until(() -> true);
    assertSummary(result, ApiStatus.FAILURE, 2, 1, 1);
    String[] expectedRows = {
      resultsHeader, getFailedRecord(record, "[name must match \"\"^((?!::).)*$\"\"]")
    };
    assertRows(result, expectedRows);

    // Create databaseSchema with invalid tags field
    record = "s1,dsp1,dsc1,,Tag.invalidTag,,,";
    csv = createCsv(DatabaseCsv.HEADERS, listOf(record), null);
    result = importCsv(databaseName, csv, false);
    assertSummary(result, ApiStatus.FAILURE, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);
  }

  @Test
  void testImportExport() throws IOException {
    Database database = createEntity(createRequest("importExportTest"), ADMIN_AUTH_HEADERS);
    String user1 = USER1.getName();

    // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
    // Create two records
    List<String> createRecords =
        listOf(
            String.format(
                "s1,dsp1,\"dsc1,1\",user;%s,Tier.Tier1,P23DT23H,http://test.com,\"\"%s\"\"",
                user1, DOMAIN.getFullyQualifiedName()),
            String.format(
                "s2,dsp2,\"dsc2,2\",team;%s,Tier.Tier1,P23DT23H,http://test.com,",
                TEAM1.getName()));

    // Update terms with change in description
    List<String> updateRecords =
        listOf(
            String.format(
                "s1,dsp1,new-dsc1,user;%s,Tier.Tier1,P23DT23H,http://test.com,\"\"%s\"\"",
                user1, DOMAIN.getFullyQualifiedName()),
            String.format(
                "s2,dsp2,new-dsc2,team;%s,Tier.Tier1,P23DT23H,http://test.com,", TEAM1.getName()));

    // Add new row to existing rows
    List<String> newRecords = listOf("s3,dsp3,dsc3,,Tier.Tier3,,,");
    testImportExport(
        database.getFullyQualifiedName(),
        DatabaseCsv.HEADERS,
        createRecords,
        updateRecords,
        newRecords);
  }

  @Override
  public Database validateGetWithDifferentFields(Database database, boolean byName)
      throws HttpResponseException {
    // Add a schema if it already does not exist
    if (nullOrEmpty(database.getDatabaseSchemas())) {
      DatabaseSchemaResourceTest databaseSchemaResourceTest = new DatabaseSchemaResourceTest();
      CreateDatabaseSchema create =
          databaseSchemaResourceTest
              .createRequest("schema", "", "", null)
              .withDatabase(getFqn(database));
      databaseSchemaResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    }

    String fields = "";
    database =
        byName
            ? getEntityByName(database.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(database.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(database.getService(), database.getServiceType());
    assertListNull(
        database.getOwner(),
        database.getDatabaseSchemas(),
        database.getUsageSummary(),
        database.getLocation());

    fields = "owner,databaseSchemas,usageSummary,location,tags";
    database =
        byName
            ? getEntityByName(database.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(database.getId(), fields, ADMIN_AUTH_HEADERS);

    assertListNotNull(database.getService(), database.getServiceType());
    // Fields usageSummary and location are not set during creation - tested elsewhere
    TestUtils.validateEntityReferences(database.getDatabaseSchemas(), true);
    assertListNotEmpty(database.getDatabaseSchemas());
    // Checks for other owner, tags, and followers is done in the base class
    return database;
  }

  @Override
  public CreateDatabase createRequest(String name) {
    return new CreateDatabase().withName(name).withService(getContainer().getFullyQualifiedName());
  }

  @Override
  public EntityReference getContainer() {
    return SNOWFLAKE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Database entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      Database database, CreateDatabase createRequest, Map<String, String> authHeaders) {
    // Validate service
    assertNotNull(database.getServiceType());
    assertReference(createRequest.getService(), database.getService());
    assertEquals(
        FullyQualifiedName.build(database.getService().getName(), database.getName()),
        database.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(
      Database expected, Database updated, Map<String, String> authHeaders) {
    assertReference(expected.getService(), updated.getService());
    assertEquals(
        FullyQualifiedName.build(updated.getService().getName(), updated.getName()),
        updated.getFullyQualifiedName());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
