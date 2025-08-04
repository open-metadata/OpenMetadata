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
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
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
import org.openmetadata.service.util.JsonUtils;
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
  void testImportExportWithTableConstraints() throws IOException {
    // Create a schema for this test to avoid conflicts
    CreateDatabaseSchema createSchema = createRequest("constraint_test_schema");
    DatabaseSchema schema = createEntity(createSchema, ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();

    // Create tables and columns for FK relationships
    Column c1 = new Column().withName("user_ref").withDataType(ColumnDataType.STRING);
    Column c2 = new Column().withName("tenant_id").withDataType(ColumnDataType.STRING);
    Column c3 = new Column().withName("user_id").withDataType(ColumnDataType.STRING);

    // Create target table (referenced table with 2 columns)
    Table targetTable =
        tableTest.createEntity(
            tableTest
                .createRequest("target_table")
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTableConstraints(null)
                .withColumns(List.of(c2, c3)),
            ADMIN_AUTH_HEADERS);

    // Create source table (no constraints initially)
    Table sourceTable =
        tableTest.createEntity(
            tableTest
                .createRequest("source_table")
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(c1))
                .withTableConstraints(null),
            ADMIN_AUTH_HEADERS);

    // Resolve column FQNs needed for FK definitions
    Table targetRef =
        tableTest.getEntityByName(targetTable.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);

    // Create foreign key constraint - simple 1:1 mapping
    String targetCol1FQN = targetRef.getColumns().getFirst().getFullyQualifiedName();

    String originalJson = JsonUtils.pojoToJson(sourceTable);
    Table sourceTableV2 = JsonUtils.deepCopy(sourceTable, Table.class);

    // Create a simple 1:1 foreign key constraint: 1 local column referencing 1 referred column
    TableConstraint foreignKeyConstraint =
        new TableConstraint()
            .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
            .withColumns(List.of("user_ref")) // 1 local column
            .withReferredColumns(
                Collections.singletonList(targetCol1FQN)); // 1 referred column (1:1 mapping)

    sourceTableV2.setTableConstraints(Collections.singletonList(foreignKeyConstraint));

    Table updatedSourceTable =
        tableTest.patchEntity(sourceTable.getId(), originalJson, sourceTableV2, ADMIN_AUTH_HEADERS);

    // Verify constraint was created correctly
    assertNotNull(updatedSourceTable.getTableConstraints());
    assertEquals(1, updatedSourceTable.getTableConstraints().size());
    TableConstraint constraint = updatedSourceTable.getTableConstraints().getFirst();
    assertEquals(TableConstraint.ConstraintType.FOREIGN_KEY, constraint.getConstraintType());
    assertEquals(1, constraint.getColumns().size()); // 1 local column
    assertEquals(1, constraint.getReferredColumns().size()); // 1 referred column (1:1 mapping)

    // Export recursively to CSV - this should include table constraints
    String exportedCsv = exportCsvRecursive(schema.getFullyQualifiedName());
    assertNotNull(exportedCsv);

    List<String> csvLines = List.of(exportedCsv.split(CsvUtil.LINE_SEPARATOR));
    assertTrue(csvLines.size() > 1, "Export should contain schema, tables, and columns");

    // Modify CSV to update some metadata while preserving structure
    String header = csvLines.getFirst();
    List<String> modified = new ArrayList<>();
    modified.add(header);

    for (String line : csvLines.subList(1, csvLines.size())) {
      if (line.contains("source_table") && line.contains("table")) {
        // Update table description
        line = line.replace("source_table", "source_table Updated via CSV import");
      }
      modified.add(line);
    }

    String newCsv = String.join(CsvUtil.LINE_SEPARATOR, modified) + CsvUtil.LINE_SEPARATOR;

    // Import the modified CSV recursively
    CsvImportResult result = importCsvRecursive(schema.getFullyQualifiedName(), newCsv, false);
    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Fetch the updated source table and verify constraints are preserved
    Table importedSourceTable =
        tableTest.getEntityByName(
            updatedSourceTable.getFullyQualifiedName(),
            "tableConstraints,columns,description",
            ADMIN_AUTH_HEADERS);

    // Verify table constraints are still present after CSV import
    assertNotNull(
        importedSourceTable.getTableConstraints(),
        "Table constraints should be preserved after CSV import");
    assertEquals(
        1,
        importedSourceTable.getTableConstraints().size(),
        "Should have exactly one table constraint");

    TableConstraint preservedConstraint = importedSourceTable.getTableConstraints().getFirst();
    assertEquals(
        TableConstraint.ConstraintType.FOREIGN_KEY, preservedConstraint.getConstraintType());
    assertEquals(1, preservedConstraint.getColumns().size(), "Should have 1 local column");
    assertEquals(
        1,
        preservedConstraint.getReferredColumns().size(),
        "Should have 1 referred column (1:1 mapping)");

    // Verify the specific column references are preserved
    assertEquals("user_ref", preservedConstraint.getColumns().getFirst());
    assertTrue(
        preservedConstraint.getReferredColumns().contains(targetCol1FQN),
        "Should contain target column FQN");

    // Verify search index building works without crashing
    assertDoesNotThrow(
        () -> {
          Entity.buildSearchIndex(Entity.TABLE, importedSourceTable);
        },
        "Search index building should not crash with table constraints after CSV import");

    // Verify target table is also intact
    Table importedTargetTable =
        tableTest.getEntityByName(
            targetTable.getFullyQualifiedName(), "columns", ADMIN_AUTH_HEADERS);

    assertNotNull(importedTargetTable.getColumns());
    assertEquals(
        2, importedTargetTable.getColumns().size(), "Target table should still have 2 columns");
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
