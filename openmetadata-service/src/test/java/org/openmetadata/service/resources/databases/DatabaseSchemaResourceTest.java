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
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import static org.pac4j.core.util.CommonHelper.assertTrue;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
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
import org.openmetadata.schema.api.entityRelationship.EsEntityRelationshipData;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipResult;
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

  @Test
  void test_entityRelationshipWithDirection() throws IOException {
    // Create a schema for this test to avoid conflicts
    CreateDatabaseSchema createSchema = createRequest("er_test_schema_direction");
    DatabaseSchema schema = createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Create tables and columns for FK relationships
    TableResourceTest tableTest = new TableResourceTest();
    Column c1 = new Column().withName("c1").withDataType(ColumnDataType.INT);
    Column c2 = new Column().withName("c2").withDataType(ColumnDataType.INT);

    Table upstreamTable =
        tableTest.createEntity(
            tableTest
                .createRequest("er_upstream_fk")
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTableConstraints(null)
                .withColumns(List.of(c1)),
            ADMIN_AUTH_HEADERS);

    // This table will have a FK to tableInSchema2, so create it first without the constraint
    CreateTable createDownstream =
        tableTest
            .createRequest("er_downstream_fk")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withTableConstraints(null)
            .withColumns(List.of(new Column().withName("c2_fk").withDataType(ColumnDataType.INT)));
    Table downstreamTable = tableTest.createEntity(createDownstream, ADMIN_AUTH_HEADERS);

    // This table has a FK to upstreamTable, create it without constraint first
    CreateTable createTableInSchema1 =
        tableTest
            .createRequest("er_table1_fk")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withTableConstraints(null)
            .withColumns(List.of(new Column().withName("c1_fk").withDataType(ColumnDataType.INT)));
    Table tableInSchema1 = tableTest.createEntity(createTableInSchema1, ADMIN_AUTH_HEADERS);

    Table tableInSchema2 =
        tableTest.createEntity(
            tableTest
                .createRequest("er_table2_fk")
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTableConstraints(null)
                .withColumns(List.of(c2)),
            ADMIN_AUTH_HEADERS);

    // Now, add the constraints via update
    createTableInSchema1.withTableConstraints(
        List.of(
            new TableConstraint()
                .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                .withColumns(List.of("c1_fk"))
                .withReferredColumns(
                    List.of(upstreamTable.getColumns().getFirst().getFullyQualifiedName()))));
    tableTest.updateEntity(createTableInSchema1, Response.Status.OK, ADMIN_AUTH_HEADERS);

    createDownstream.withTableConstraints(
        List.of(
            new TableConstraint()
                .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                .withColumns(List.of("c2_fk"))
                .withReferredColumns(
                    List.of(tableInSchema2.getColumns().getFirst().getFullyQualifiedName()))));
    tableTest.updateEntity(createDownstream, Response.Status.OK, ADMIN_AUTH_HEADERS);

    // Test UPSTREAM direction for the schema
    Map<String, String> queryParamsUpstream = new HashMap<>();
    queryParamsUpstream.put("fqn", schema.getFullyQualifiedName());
    queryParamsUpstream.put("upstreamDepth", "1");
    queryParamsUpstream.put("downstreamDepth", "0"); // We only want upstream

    WebTarget upstreamTarget = getResource("databaseSchemas/entityRelationship/upstream");
    for (Map.Entry<String, String> entry : queryParamsUpstream.entrySet()) {
      upstreamTarget = upstreamTarget.queryParam(entry.getKey(), entry.getValue());
    }
    SearchEntityRelationshipResult upstreamResult =
        TestUtils.get(upstreamTarget, SearchEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    // Assertions for upstream: should find upstreamTable -> tableInSchema1
    assertNotNull(upstreamResult);
    assertEquals(4, upstreamResult.getNodes().size());
    Assertions.assertTrue(
        upstreamResult.getNodes().containsKey(tableInSchema1.getFullyQualifiedName()));
    Assertions.assertTrue(
        upstreamResult.getNodes().containsKey(upstreamTable.getFullyQualifiedName()));
    Assertions.assertTrue(
        upstreamResult.getNodes().containsKey(downstreamTable.getFullyQualifiedName()));
    Assertions.assertTrue(
        upstreamResult.getNodes().containsKey(tableInSchema2.getFullyQualifiedName()));

    assertEquals(2, upstreamResult.getUpstreamEdges().size());
    Assertions.assertTrue(upstreamResult.getDownstreamEdges().isEmpty());

    // Test DOWNSTREAM direction for the schema
    Map<String, String> queryParamsDownstream = new HashMap<>();
    queryParamsDownstream.put("fqn", schema.getFullyQualifiedName());
    queryParamsDownstream.put("upstreamDepth", "0");
    queryParamsDownstream.put("downstreamDepth", "1"); // We only want downstream

    WebTarget downstreamTarget = getResource("databaseSchemas/entityRelationship/downstream");
    for (Map.Entry<String, String> entry : queryParamsDownstream.entrySet()) {
      downstreamTarget = downstreamTarget.queryParam(entry.getKey(), entry.getValue());
    }
    SearchEntityRelationshipResult downstreamResult =
        TestUtils.get(downstreamTarget, SearchEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    // Assertions for downstream: should find tableInSchema2 -> downstreamTable
    assertNotNull(downstreamResult);
    assertEquals(4, downstreamResult.getNodes().size());
    Assertions.assertTrue(
        downstreamResult.getNodes().containsKey(tableInSchema2.getFullyQualifiedName()));
    Assertions.assertTrue(
        downstreamResult.getNodes().containsKey(downstreamTable.getFullyQualifiedName()));
    Assertions.assertTrue(
        downstreamResult.getNodes().containsKey(tableInSchema1.getFullyQualifiedName()));
    Assertions.assertTrue(
        downstreamResult.getNodes().containsKey(upstreamTable.getFullyQualifiedName()));

    assertEquals(2, downstreamResult.getDownstreamEdges().size());
    Assertions.assertTrue(downstreamResult.getUpstreamEdges().isEmpty());
  }

  @Test
  void test_entityRelationshipBothDirections() throws IOException {
    // Create a schema for this test to avoid conflicts
    CreateDatabaseSchema createSchema = createRequest("er_both_dir_schema_fk");
    DatabaseSchema schema = createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Create tables and columns for FK relationships
    TableResourceTest tableTest = new TableResourceTest();
    Column cUp = new Column().withName("c_up").withDataType(ColumnDataType.INT);
    Column cMain = new Column().withName("c_main").withDataType(ColumnDataType.INT);
    Column cMainFk = new Column().withName("c_main_fk").withDataType(ColumnDataType.INT);
    Column cDownFk = new Column().withName("c_down_fk").withDataType(ColumnDataType.INT);

    // Ensure all tables are created in the same schema for this test
    String testSchemaFqn = schema.getFullyQualifiedName();

    // Step 1: Create all tables with columns, but no constraints
    Table upstreamTable =
        tableTest.createEntity(
            tableTest
                .createRequest("er_both_upstream_fk")
                .withDatabaseSchema(testSchemaFqn)
                .withTableConstraints(null)
                .withColumns(List.of(cUp)),
            ADMIN_AUTH_HEADERS);

    Table downstreamTable =
        tableTest.createEntity(
            tableTest
                .createRequest("er_both_downstream_fk")
                .withDatabaseSchema(testSchemaFqn)
                .withTableConstraints(null)
                .withColumns(List.of(cDownFk)),
            ADMIN_AUTH_HEADERS);

    Table tableInSchema =
        tableTest.createEntity(
            tableTest
                .createRequest("er_both_table_fk")
                .withDatabaseSchema(testSchemaFqn)
                .withTableConstraints(null)
                .withColumns(List.of(cMain, cMainFk)),
            ADMIN_AUTH_HEADERS);

    // Step 2: Retrieve the tables to get columns with FQN
    upstreamTable =
        tableTest.getEntityByName(upstreamTable.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    downstreamTable =
        tableTest.getEntityByName(downstreamTable.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    tableInSchema =
        tableTest.getEntityByName(tableInSchema.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);

    // Step 3: Patch constraints using the correct FQN columns
    CreateTable updateTableInSchema =
        tableTest
            .createRequest("er_both_table_fk")
            .withDatabaseSchema(testSchemaFqn)
            .withColumns(List.of(cMain, cMainFk))
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                        .withColumns(List.of(cMainFk.getName()))
                        .withReferredColumns(
                            List.of(
                                upstreamTable.getColumns().getFirst().getFullyQualifiedName()))));
    tableTest.updateEntity(updateTableInSchema, Response.Status.OK, ADMIN_AUTH_HEADERS);

    CreateTable updateDownstream =
        tableTest
            .createRequest("er_both_downstream_fk")
            .withDatabaseSchema(testSchemaFqn)
            .withColumns(List.of(cDownFk))
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                        .withColumns(List.of(cDownFk.getName()))
                        .withReferredColumns(
                            List.of(
                                tableInSchema.getColumns().getFirst().getFullyQualifiedName()))));
    tableTest.updateEntity(updateDownstream, Response.Status.OK, ADMIN_AUTH_HEADERS);

    // Test both directions
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fqn", schema.getFullyQualifiedName());
    queryParams.put("upstreamDepth", "1");
    queryParams.put("downstreamDepth", "1");

    WebTarget target = getResource("databaseSchemas/entityRelationship");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    SearchEntityRelationshipResult result =
        TestUtils.get(target, SearchEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    // Assertions
    assertNotNull(result);
    // Nodes should be tableInSchema, upstreamTable, downstreamTable
    assertEquals(3, result.getNodes().size());
    Assertions.assertTrue(result.getNodes().containsKey(tableInSchema.getFullyQualifiedName()));
    Assertions.assertTrue(result.getNodes().containsKey(upstreamTable.getFullyQualifiedName()));
    Assertions.assertTrue(result.getNodes().containsKey(downstreamTable.getFullyQualifiedName()));

    // 1 upstream edge, 1 downstream edge
    System.out.println("Upstream edges: " + result.getUpstreamEdges());
    System.out.println("Downstream edges: " + result.getDownstreamEdges());
    assertEquals(1, result.getUpstreamEdges().size());
    assertEquals(1, result.getDownstreamEdges().size());

    // Check upstream edge: upstreamTable -> tableInSchema
    EsEntityRelationshipData upEdge = result.getUpstreamEdges().values().iterator().next();
    assertEquals(upstreamTable.getId(), upEdge.getEntity().getId());
    assertEquals(tableInSchema.getId(), upEdge.getRelatedEntity().getId());

    // Check downstream edge: tableInSchema -> downstreamTable
    EsEntityRelationshipData downEdge = result.getDownstreamEdges().values().iterator().next();
    assertEquals(tableInSchema.getId(), downEdge.getEntity().getId());
    assertEquals(downstreamTable.getId(), downEdge.getRelatedEntity().getId());
  }

  @Test
  void test_entityRelationshipWithQueryFilter() throws IOException {
    // Test entity relationship API with query filter
    String databaseSchemaFQN = DATABASE_SCHEMA.getFullyQualifiedName();

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fqn", databaseSchemaFQN);
    queryParams.put("upstreamDepth", "1");
    queryParams.put("downstreamDepth", "1");
    queryParams.put("query_filter", "test");

    // Test with query filter - using correct path
    WebTarget target = getResource("databaseSchemas/entityRelationship/upstream");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    SearchEntityRelationshipResult result =
        TestUtils.get(target, SearchEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertNotNull(result.getNodes());
  }

  @Test
  void test_entityRelationshipWithInvalidDirection() {
    // Test entity relationship API with invalid direction
    String databaseSchemaFQN = DATABASE_SCHEMA.getFullyQualifiedName();

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fqn", databaseSchemaFQN);
    queryParams.put("upstreamDepth", "1");
    queryParams.put("downstreamDepth", "1");

    // Test invalid direction - should return 404
    assertThrows(
        HttpResponseException.class,
        () -> {
          WebTarget target = getResource("databaseSchemas/entityRelationship/invalid");
          for (Map.Entry<String, String> entry : queryParams.entrySet()) {
            target = target.queryParam(entry.getKey(), entry.getValue());
          }
          TestUtils.get(target, SearchEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);
        });
  }

  @Test
  void test_entityRelationshipWithMissingFQN() {
    // Test entity relationship API with missing FQN parameter
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("upstreamDepth", "1");
    queryParams.put("downstreamDepth", "1");

    // Test missing FQN - should return 400
    assertThrows(
        HttpResponseException.class,
        () -> {
          WebTarget target = getResource("databaseSchemas/entityRelationship/upstream");
          for (Map.Entry<String, String> entry : queryParams.entrySet()) {
            target = target.queryParam(entry.getKey(), entry.getValue());
          }
          TestUtils.get(target, SearchEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);
        });
  }

  @Test
  void test_entityRelationshipWithIncludeSourceFields() throws IOException {
    // Test entity relationship API with includeSourceFields parameter
    String databaseSchemaFQN = DATABASE_SCHEMA.getFullyQualifiedName();

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fqn", databaseSchemaFQN);
    queryParams.put("upstreamDepth", "1");
    queryParams.put("downstreamDepth", "1");
    queryParams.put("fields", "true");

    // Test with includeSourceFields - using correct path
    WebTarget target = getResource("databaseSchemas/entityRelationship/upstream");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    SearchEntityRelationshipResult result =
        TestUtils.get(target, SearchEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertNotNull(result.getNodes());
  }

  @Test
  void test_entityRelationshipPaginationAndDepth() throws IOException {
    // Test entity relationship API with different depth values
    String databaseSchemaFQN = DATABASE_SCHEMA.getFullyQualifiedName();

    // Test with depth 2
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fqn", databaseSchemaFQN);
    queryParams.put("upstreamDepth", "2");
    queryParams.put("downstreamDepth", "2");

    WebTarget target = getResource("databaseSchemas/entityRelationship/upstream");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    SearchEntityRelationshipResult result =
        TestUtils.get(target, SearchEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    assertNotNull(result);
    assertNotNull(result.getNodes());

    // Test with depth 0 (should return immediate relationships only)
    queryParams.put("upstreamDepth", "0");
    queryParams.put("downstreamDepth", "0");

    WebTarget immediateTarget = getResource("databaseSchemas/entityRelationship/upstream");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      immediateTarget = immediateTarget.queryParam(entry.getKey(), entry.getValue());
    }
    SearchEntityRelationshipResult immediateResult =
        TestUtils.get(immediateTarget, SearchEntityRelationshipResult.class, ADMIN_AUTH_HEADERS);

    assertNotNull(immediateResult);
    assertNotNull(immediateResult.getNodes());
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
}
