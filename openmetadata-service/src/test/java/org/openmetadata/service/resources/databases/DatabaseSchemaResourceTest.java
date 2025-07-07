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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.apache.commons.lang.StringEscapeUtils.escapeCsv;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsv.entityNotFound;
import static org.openmetadata.csv.EntityCsvTest.assertRows;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.csv.EntityCsvTest.getFailedRecord;
import static org.openmetadata.csv.EntityCsvTest.getSuccessRecord;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResource.DatabaseSchemaList;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class DatabaseSchemaResourceTest
    extends EntityResourceTest<DatabaseSchema, CreateDatabaseSchema> {
  public DatabaseSchemaResourceTest() {
    super(
        Entity.DATABASE_SCHEMA,
        DatabaseSchema.class,
        DatabaseSchemaList.class,
        "databaseSchemas",
        DatabaseSchemaResource.FIELDS);
    supportedNameCharacters = "_'+#- .()$" + EntityResourceTest.RANDOM_STRING_GENERATOR.generate(1);
  }

  @Test
  void post_schemaWithoutRequiredDatabase_400(TestInfo test) {
    CreateDatabaseSchema create = createRequest(test).withDatabase(null);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "database must not be null");
  }

  @Test
  void delete_schemaWithTables_200(TestInfo test) throws IOException {
    CreateDatabaseSchema create =
        createRequest(test).withDatabase(DATABASE.getFullyQualifiedName());
    DatabaseSchema createdSchema = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable =
        tableResourceTest
            .createRequest("t1", "", "", null)
            .withDatabaseSchema(createdSchema.getFullyQualifiedName());
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    createTable =
        tableResourceTest
            .createRequest("t2", "", "", null)
            .withDatabaseSchema(createdSchema.getFullyQualifiedName());
    Table table2 = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // recursively soft delete schema
    deleteAndCheckEntity(createdSchema, true, false, ADMIN_AUTH_HEADERS);

    // Restore one of the tables.
    tableResourceTest.restoreEntity(
        new RestoreEntity().withId(table2.getId()), Response.Status.OK, ADMIN_AUTH_HEADERS);

    // Restore Schema
    restoreEntity(
        new RestoreEntity().withId(createdSchema.getId()), Response.Status.OK, ADMIN_AUTH_HEADERS);
    DatabaseSchema schema = getEntity(createdSchema.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(schema);
  }

  @Test
  @SneakyThrows
  void testImportInvalidCsv() {
    DatabaseSchema schema = createEntity(createRequest("invalidCsv"), ADMIN_AUTH_HEADERS);
    String schemaName = schema.getFullyQualifiedName();
    TableResourceTest tableTest = new TableResourceTest();
    CreateTable createTable =
        tableTest.createRequest("s1").withDatabaseSchema(schema.getFullyQualifiedName());
    tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Headers: name, displayName, description, owner, tags, glossaryTerms, tiers, certification,
    // retentionPeriod, sourceUrl, domain, extension
    // Create table with invalid tags field
    String resultsHeader =
        recordToString(EntityCsv.getResultHeaders(getDatabaseSchemaCsvHeaders(schema, false)));
    String record = "s1,dsp1,dsc1,,Tag.invalidTag,,,,,,,";
    String csv = createCsv(getDatabaseSchemaCsvHeaders(schema, false), listOf(record), null);
    CsvImportResult result = importCsv(schemaName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    String[] expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // Tag will cause failure
    record = "non-existing,dsp1,dsc1,,Tag.invalidTag,,,,,,,";
    csv = createCsv(getDatabaseSchemaCsvHeaders(schema, false), listOf(record), null);
    result = importCsv(schemaName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // non-existing table will cause
    record = "non-existing,dsp1,dsc1,,,,,,,,,";
    String tableFqn = FullyQualifiedName.add(schema.getFullyQualifiedName(), "non-existing");
    csv = createCsv(getDatabaseSchemaCsvHeaders(schema, false), listOf(record), null);
    result = importCsv(schemaName, csv, false);
    assertSummary(result, ApiStatus.SUCCESS, 2, 2, 0);
    expectedRows = new String[] {resultsHeader, getSuccessRecord(record, "Entity created")};
    assertRows(result, expectedRows);
    Table table = tableTest.getEntityByName(tableFqn, "id", ADMIN_AUTH_HEADERS);
    assertEquals(tableFqn, table.getFullyQualifiedName());
  }

  @Test
  void testImportExport() throws IOException {
    String user1 = USER1.getName();
    DatabaseSchema schema = createEntity(createRequest("importExportTest"), ADMIN_AUTH_HEADERS);
    TableResourceTest tableTest = new TableResourceTest();
    CreateTable createTable =
        tableTest.createRequest("s1").withDatabaseSchema(schema.getFullyQualifiedName());
    tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create certification
    TagResourceTest tagResourceTest = new TagResourceTest();
    Tag certificationTag =
        tagResourceTest.createEntity(
            tagResourceTest.createRequest("Certification"), ADMIN_AUTH_HEADERS);

    // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
    List<String> updateRecords =
        listOf(
            String.format(
                "s1,dsp1,new-dsc1,user:%s,,,Tier.Tier1,%s,P23DT23H,http://test.com,%s,",
                user1,
                certificationTag.getFullyQualifiedName(),
                escapeCsv(DOMAIN.getFullyQualifiedName())));

    // Update created entity with changes
    importCsvAndValidate(
        schema.getFullyQualifiedName(),
        getDatabaseSchemaCsvHeaders(schema, false),
        null,
        updateRecords);

    List<String> clearRecords = listOf("s1,dsp1,new-dsc2,,,,,,P23DT23H,http://test.com,,");

    importCsvAndValidate(
        schema.getFullyQualifiedName(),
        getDatabaseSchemaCsvHeaders(schema, false),
        null,
        clearRecords);

    String tableFqn = String.format("%s.%s", schema.getFullyQualifiedName(), "s1");
    Table updatedTable = tableTest.getEntityByName(tableFqn, ADMIN_AUTH_HEADERS);
    assertEquals("new-dsc2", updatedTable.getDescription());
    assertTrue(listOrEmpty(updatedTable.getOwners()).isEmpty(), "Owner should be cleared");
    assertTrue(
        listOrEmpty(updatedTable.getTags()).isEmpty(), "Tags should be empty after clearing");
    Assertions.assertNull(updatedTable.getDomain(), "Domain should be null after clearing");
  }

  @Test
  void testImportExportRecursive() throws IOException {
    String schemaName = "importExportRecursiveSchema";
    DatabaseSchema schema = createEntity(createRequest(schemaName), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();

    // Create a table with one column
    CreateTable createTable =
        tableTest
            .createRequest("t1")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Initial Table Description");

    // Set column description
    createTable.getColumns().get(0).setDescription("Initial Column Description");

    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Export recursively
    String exportedCsv = exportCsvRecursive(schema.getFullyQualifiedName());
    assertNotNull(exportedCsv);

    List<String> csvLines = List.of(exportedCsv.split(CsvUtil.LINE_SEPARATOR));
    assertTrue(csvLines.size() > 1, "Export should contain schema, table, and column");

    String header = csvLines.get(0);
    List<String> modified = new ArrayList<>();
    modified.add(header);

    for (String line : csvLines.subList(1, csvLines.size())) {
      if (line.contains("t1") && line.contains("table")) {
        line = line.replace("Initial Table Description", "Updated Table Description");
      } else if (line.contains("column")) {
        line = line.replace("Initial Column Description", "Updated Column Description");
      }
      modified.add(line);
    }

    String newCsv = String.join(CsvUtil.LINE_SEPARATOR, modified) + CsvUtil.LINE_SEPARATOR;
    CsvImportResult result = importCsvRecursive(schema.getFullyQualifiedName(), newCsv, false);
    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Validate updated table
    Table updated =
        tableTest.getEntityByName(
            table.getFullyQualifiedName(), "description,certification", ADMIN_AUTH_HEADERS);
    assertEquals("Updated Table Description", updated.getDescription());

    // Validate updated column
    assertNotNull(updated.getColumns());
    assertTrue(
        updated.getColumns().stream()
            .anyMatch(c -> "Updated Column Description".equals(c.getDescription())),
        "At least one column should have updated description");
  }

  @Override
  public DatabaseSchema validateGetWithDifferentFields(DatabaseSchema schema, boolean byName)
      throws HttpResponseException {
    // Add tables to the database schema
    if (nullOrEmpty(schema.getTables())) {
      TableResourceTest tableResourceTest = new TableResourceTest();
      CreateTable create =
          tableResourceTest
              .createRequest("t1", "", "", null)
              .withDatabaseSchema(schema.getFullyQualifiedName());
      tableResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);

      create.withName("t2");
      tableResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    }

    // Now query request different fields
    String fields = "";
    schema =
        byName
            ? getEntityByName(schema.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(schema.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(schema.getService(), schema.getServiceType(), schema.getDatabase());
    assertListNull(schema.getOwners(), schema.getTables());

    fields = "owners,tags,tables,followers";
    schema =
        byName
            ? getEntityByName(schema.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(schema.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(schema.getService(), schema.getServiceType());
    // Fields usageSummary and location are not set during creation - tested elsewhere
    assertListNotNull(schema.getTables());
    TestUtils.validateEntityReferences(schema.getTables(), true);
    // Checks for other owner, tags, and followers is done in the base class
    return schema;
  }

  @Override
  public CreateDatabaseSchema createRequest(String name) {
    return new CreateDatabaseSchema()
        .withName(name)
        .withDatabase(getContainer().getFullyQualifiedName());
  }

  @Override
  public EntityReference getContainer() {
    return DATABASE.getEntityReference();
  }

  @Override
  public EntityReference getContainer(DatabaseSchema entity) {
    return entity.getDatabase();
  }

  @Override
  public void validateCreatedEntity(
      DatabaseSchema schema, CreateDatabaseSchema createRequest, Map<String, String> authHeaders) {
    // Validate service
    assertNotNull(schema.getServiceType());
    assertReference(createRequest.getDatabase(), schema.getDatabase());
    assertEquals(
        FullyQualifiedName.add(schema.getDatabase().getFullyQualifiedName(), schema.getName()),
        schema.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(
      DatabaseSchema expected, DatabaseSchema updated, Map<String, String> authHeaders) {
    // Validate service
    assertReference(expected.getDatabase(), updated.getDatabase());
    assertEquals(
        FullyQualifiedName.add(updated.getDatabase().getFullyQualifiedName(), updated.getName()),
        updated.getFullyQualifiedName());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  private SearchSchemaEntityRelationshipResult searchSchemaEntityRelationship(
      String fqn, String queryFilter, boolean includeDeleted) throws HttpResponseException {
    WebTarget target = getResource("databaseSchemas/entityRelationship");
    if (fqn != null) {
      target = target.queryParam("fqn", fqn);
    }
    if (queryFilter != null) {
      target = target.queryParam("query_filter", queryFilter);
    }
    target = target.queryParam("includeDeleted", includeDeleted);

    return TestUtils.get(target, SearchSchemaEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_schemaEntityRelationship() throws IOException {
    // Create a schema for this test
    TableResourceTest tableTest = new TableResourceTest();
    CreateDatabaseSchema createSchema = createRequest("er_test_schema_direction");
    DatabaseSchema schema = createEntity(createSchema, ADMIN_AUTH_HEADERS);
    String schemaFqn = schema.getFullyQualifiedName();

    // Create tables and columns for FK relationships
    Column c1 = new Column().withName("c1").withDataType(ColumnDataType.INT);
    Column c2 = new Column().withName("c2").withDataType(ColumnDataType.INT);

    Table upstreamTable =
        tableTest.createEntity(
            tableTest
                .createRequest("er_upstream_fk")
                .withDatabaseSchema(schemaFqn)
                .withTableConstraints(null)
                .withColumns(List.of(c1)),
            ADMIN_AUTH_HEADERS);

    Table tableInSchema2 =
        tableTest.createEntity(
            tableTest
                .createRequest("er_table2_fk")
                .withDatabaseSchema(schemaFqn)
                .withColumns(List.of(c2))
                .withTableConstraints(null),
            ADMIN_AUTH_HEADERS);

    // Resolve column FQNs needed for FK definitions
    Table upstreamRef =
        tableTest.getEntityByName(upstreamTable.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    Table table2Ref =
        tableTest.getEntityByName(tableInSchema2.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);

    // Create table with FK to upstream table
    Column c1Local = new Column().withName("c1_local").withDataType(ColumnDataType.INT);
    Column c1FkCol = new Column().withName("c1_fk").withDataType(ColumnDataType.INT);
    Table tableInSchema1 =
        tableTest.createEntity(
            tableTest
                .createRequest("er_table1_fk")
                .withDatabaseSchema(schemaFqn)
                .withColumns(List.of(c1Local, c1FkCol))
                .withTableConstraints(
                    List.of(
                        new TableConstraint()
                            .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                            .withColumns(List.of(c1FkCol.getName()))
                            .withReferredColumns(
                                List.of(
                                    upstreamRef.getColumns().getFirst().getFullyQualifiedName())))),
            ADMIN_AUTH_HEADERS);

    // Create downstream table with FK to table2
    Column c2Local = new Column().withName("c2_local").withDataType(ColumnDataType.INT);
    Column c2FkCol = new Column().withName("c2_fk").withDataType(ColumnDataType.INT);
    Table downstreamTable =
        tableTest.createEntity(
            tableTest
                .createRequest("er_downstream_fk")
                .withDatabaseSchema(schemaFqn)
                .withColumns(List.of(c2Local, c2FkCol))
                .withTableConstraints(
                    List.of(
                        new TableConstraint()
                            .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                            .withColumns(List.of(c2FkCol.getName()))
                            .withReferredColumns(
                                List.of(
                                    table2Ref.getColumns().getFirst().getFullyQualifiedName())))),
            ADMIN_AUTH_HEADERS);

    // Test the DatabaseSchema entityRelationship endpoint
    SearchSchemaEntityRelationshipResult result =
        searchSchemaEntityRelationship(schemaFqn, null, false);

    // Debug: Print the full result and its key fields
    System.out.println("Full result: " + result);
    if (result != null && result.getData() != null) {
      System.out.println("Full result nodes: " + result.getData().getNodes());
      System.out.println("Full result upstreamEdges: " + result.getData().getUpstreamEdges());
      System.out.println("Full result downstreamEdges: " + result.getData().getDownstreamEdges());
      System.out.println("Full result paging: " + result.getPaging());
    }

    // Verify the response structure
    assertNotNull(result);
    assertNotNull(result.getData().getNodes());
    assertNotNull(result.getData().getUpstreamEdges());
    assertNotNull(result.getData().getDownstreamEdges());

    // Verify we get the expected number of nodes (4 tables in the schema)
    assertEquals(4, result.getData().getNodes().size());

    // Verify we get the expected number of upstream edges (2 FK relationships)
    assertEquals(2, result.getData().getUpstreamEdges().size());

    // Verify we get no downstream edges (as expected for this setup)
    assertEquals(2, result.getData().getDownstreamEdges().size());

    // Verify all tables in the schema are present in the nodes
    assertTrue(result.getData().getNodes().containsKey(upstreamTable.getFullyQualifiedName()));
    assertTrue(result.getData().getNodes().containsKey(tableInSchema2.getFullyQualifiedName()));
    assertTrue(result.getData().getNodes().containsKey(tableInSchema1.getFullyQualifiedName()));
    assertTrue(result.getData().getNodes().containsKey(downstreamTable.getFullyQualifiedName()));

    // --- Pagination Test: offset=0, limit=2 ---
    WebTarget pagedTarget1 =
        getResource("databaseSchemas/entityRelationship")
            .queryParam("fqn", schemaFqn)
            .queryParam("limit", 2)
            .queryParam("offset", 0);
    SearchSchemaEntityRelationshipResult pagedResult1 =
        TestUtils.get(pagedTarget1, SearchSchemaEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    // Debug: Print the paged result 1 and its key fields
    System.out.println("Paged result 1: " + pagedResult1);
    if (pagedResult1 != null && pagedResult1.getData() != null) {
      System.out.println("Paged result 1 nodes: " + pagedResult1.getData().getNodes());
      System.out.println(
          "Paged result 1 upstreamEdges: " + pagedResult1.getData().getUpstreamEdges());
      System.out.println(
          "Paged result 1 downstreamEdges: " + pagedResult1.getData().getDownstreamEdges());
      System.out.println("Paged result 1 paging: " + pagedResult1.getPaging());
    }

    assertNotNull(pagedResult1);
    assertNotNull(pagedResult1.getData().getNodes());
    assertEquals(2, pagedResult1.getData().getNodes().size(), "First page should return 2 nodes");
    assertNotNull(pagedResult1.getData().getUpstreamEdges());
    assertNotNull(pagedResult1.getData().getDownstreamEdges());
    assertNotNull(pagedResult1.getPaging());
    assertEquals(4, pagedResult1.getPaging().getTotal(), "Total results should be 4");

    // --- Pagination Test: offset=2, limit=2 ---
    WebTarget pagedTarget2 =
        getResource("databaseSchemas/entityRelationship")
            .queryParam("fqn", schemaFqn)
            .queryParam("limit", 2)
            .queryParam("offset", 2);
    SearchSchemaEntityRelationshipResult pagedResult2 =
        TestUtils.get(pagedTarget2, SearchSchemaEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    // Debug: Print the paged result 2 and its key fields
    System.out.println("Paged result 2: " + pagedResult2);
    if (pagedResult2 != null && pagedResult2.getData() != null) {
      System.out.println("Paged result 2 nodes: " + pagedResult2.getData().getNodes());
      System.out.println(
          "Paged result 2 upstreamEdges: " + pagedResult2.getData().getUpstreamEdges());
      System.out.println(
          "Paged result 2 downstreamEdges: " + pagedResult2.getData().getDownstreamEdges());
      System.out.println("Paged result 2 paging: " + pagedResult2.getPaging());
    }

    assertNotNull(pagedResult2);
    assertNotNull(pagedResult2.getData().getNodes());
    assertEquals(2, pagedResult2.getData().getNodes().size(), "Second page should return 2 nodes");
    assertNotNull(pagedResult2.getData().getUpstreamEdges());
    assertNotNull(pagedResult2.getData().getDownstreamEdges());
    assertNotNull(pagedResult2.getPaging());

    // Calculate total upstream and downstream edges across both pages (no filtering by nodes)
    int totalUpstreamEdges =
        pagedResult1.getData().getUpstreamEdges().size()
            + pagedResult2.getData().getUpstreamEdges().size();
    int totalDownstreamEdges =
        pagedResult1.getData().getDownstreamEdges().size()
            + pagedResult2.getData().getDownstreamEdges().size();
    System.out.println("Total upstream edges: " + totalUpstreamEdges);
    System.out.println("Total downstream edges: " + totalDownstreamEdges);
    assertEquals(
        2,
        totalUpstreamEdges,
        "Sum of upstream edges across pages should match total upstream edges");
    assertEquals(
        2,
        totalDownstreamEdges,
        "Sum of downstream edges across pages should match total downstream edges");
  }
}
