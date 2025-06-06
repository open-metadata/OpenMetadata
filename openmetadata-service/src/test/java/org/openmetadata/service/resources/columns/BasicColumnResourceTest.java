/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.columns;

import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class BasicColumnResourceTest extends OpenMetadataApplicationTest {

  private Table table;
  private DashboardDataModel dashboardDataModel;
  private TableResourceTest tableResourceTest;
  private DashboardDataModelResourceTest dataModelResourceTest;

  private static final String COLUMN_UPDATE_PATH = "columns/name/";

  @BeforeAll
  void setup(TestInfo test) throws IOException {
    DatabaseServiceResourceTest dbServiceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createDBService =
        dbServiceTest.createRequest(test).withName("basic_column_test_db_service");
    DatabaseService databaseService =
        dbServiceTest.createEntity(createDBService, ADMIN_AUTH_HEADERS);

    DatabaseResourceTest dbTest = new DatabaseResourceTest();
    CreateDatabase createDB =
        new CreateDatabase()
            .withName("basic_column_test_database")
            .withService(databaseService.getFullyQualifiedName());
    Database database = dbTest.createEntity(createDB, ADMIN_AUTH_HEADERS);

    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("basic_column_test_schema")
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    List<Column> columns =
        Arrays.asList(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withConstraint(ColumnConstraint.PRIMARY_KEY),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));

    tableResourceTest = new TableResourceTest();
    CreateTable createTable =
        new CreateTable()
            .withName("basic_column_test_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(columns);
    table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    DashboardServiceResourceTest dashServiceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashService =
        dashServiceTest.createRequest(test).withName("basic_column_test_dash_service");
    DashboardService dashboardService =
        dashServiceTest.createEntity(createDashService, ADMIN_AUTH_HEADERS);

    List<Column> dataModelColumns =
        Arrays.asList(
            new Column().withName("metric1").withDataType(ColumnDataType.DOUBLE),
            new Column().withName("dimension1").withDataType(ColumnDataType.STRING));

    dataModelResourceTest = new DashboardDataModelResourceTest();
    CreateDashboardDataModel createDataModel =
        new CreateDashboardDataModel()
            .withName("basic_column_test_datamodel")
            .withService(dashboardService.getFullyQualifiedName())
            .withColumns(dataModelColumns)
            .withDataModelType(DataModelType.MetabaseDataModel);
    dashboardDataModel = dataModelResourceTest.createEntity(createDataModel, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_updateTableColumn_displayName() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".name";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Full Name");

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertEquals("Full Name", updatedColumn.getDisplayName());
    assertEquals("name", updatedColumn.getName());
    assertEquals(ColumnDataType.VARCHAR, updatedColumn.getDataType());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column nameColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertEquals("Full Name", nameColumn.getDisplayName());
  }

  @Test
  void test_updateTableColumn_description() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDescription("User's email address");

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertEquals("User's email address", updatedColumn.getDescription());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column emailColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals("User's email address", emailColumn.getDescription());
  }

  @Test
  void test_updateTableColumn_tags() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".id";
    UpdateColumn updateColumn = new UpdateColumn();

    org.openmetadata.schema.type.TagLabel personalDataTagLabel =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("PersonalData.Personal")
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    updateColumn.setTags(listOf(personalDataTagLabel));
    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertNotNull(updatedColumn.getTags());
    assertEquals(1, updatedColumn.getTags().size());
    assertEquals("PersonalData.Personal", updatedColumn.getTags().get(0).getTagFQN());

    Table updatedTable =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column idColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("id"))
            .findFirst()
            .orElseThrow();
    assertEquals(1, idColumn.getTags().size());
    assertEquals("PersonalData.Personal", idColumn.getTags().get(0).getTagFQN());
  }

  @Test
  void test_updateTableColumn_constraint() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setConstraint(ColumnConstraint.UNIQUE);

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);

    assertEquals(ColumnConstraint.UNIQUE, updatedColumn.getConstraint());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column emailColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals(ColumnConstraint.UNIQUE, emailColumn.getConstraint());
  }

  @Test
  void test_updateDashboardDataModelColumn() throws IOException {
    String columnFQN = dashboardDataModel.getFullyQualifiedName() + ".metric1";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Sales Metric");
    updateColumn.setDescription("Total sales amount");
    updateColumn.setConstraint(
        ColumnConstraint.PRIMARY_KEY); // Should be ignored for dashboard data model

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn, "dashboardDataModel");
    assertEquals("Sales Metric", updatedColumn.getDisplayName());
    assertEquals("Total sales amount", updatedColumn.getDescription());
    assertNull(updatedColumn.getConstraint());

    DashboardDataModel updatedDataModel =
        dataModelResourceTest.getEntity(dashboardDataModel.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column metric1Column =
        updatedDataModel.getColumns().stream()
            .filter(c -> c.getName().equals("metric1"))
            .findFirst()
            .orElseThrow();
    assertEquals("Sales Metric", metric1Column.getDisplayName());
    assertEquals("Total sales amount", metric1Column.getDescription());
    assertNull(metric1Column.getConstraint());
  }

  @Test
  void test_updateColumn_multipleUpdatesAtOnce() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".name";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Customer Name");
    updateColumn.setDescription("Name of the customer");

    org.openmetadata.schema.type.TagLabel piiTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    updateColumn.setTags(listOf(piiTag));

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);
    assertEquals("Customer Name", updatedColumn.getDisplayName());
    assertEquals("Name of the customer", updatedColumn.getDescription());
    assertEquals(1, updatedColumn.getTags().size());
    assertEquals("PII.Sensitive", updatedColumn.getTags().get(0).getTagFQN());

    Table updatedTable =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column nameColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals("name"))
            .findFirst()
            .orElseThrow();
    assertEquals("Customer Name", nameColumn.getDisplayName());
    assertEquals("Name of the customer", nameColumn.getDescription());
    assertEquals(1, nameColumn.getTags().size());
  }

  @Test
  void test_updateColumn_nonExistentColumn_404() {
    String invalidColumnFQN = table.getFullyQualifiedName() + ".nonexistent";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Should Fail");

    assertResponse(
        () -> updateColumnByFQN(invalidColumnFQN, updateColumn),
        NOT_FOUND,
        "Column not found: " + invalidColumnFQN);
  }

  @Test
  void test_updateColumn_tagRemoval() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".email";
    UpdateColumn updateColumn = new UpdateColumn();

    org.openmetadata.schema.type.TagLabel testTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("PersonalData.Personal")
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    updateColumn.setTags(listOf(testTag));
    updateColumnByFQN(columnFQN, updateColumn);

    Table tableWithTag =
        tableResourceTest.getEntity(table.getId(), "columns, tags", ADMIN_AUTH_HEADERS);
    Column emailColumn =
        tableWithTag.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();
    assertEquals(1, emailColumn.getTags().size());

    UpdateColumn removeTagsUpdate = new UpdateColumn();
    removeTagsUpdate.setTags(new java.util.ArrayList<>()); // Empty list to remove tags
    updateColumnByFQN(columnFQN, removeTagsUpdate);

    Table tableWithoutTags =
        tableResourceTest.getEntity(table.getId(), "columns, tags", ADMIN_AUTH_HEADERS);
    Column emailColumnAfterRemoval =
        tableWithoutTags.getColumns().stream()
            .filter(c -> c.getName().equals("email"))
            .findFirst()
            .orElseThrow();

    assertTrue(
        emailColumnAfterRemoval.getTags() == null || emailColumnAfterRemoval.getTags().isEmpty());
  }

  @Test
  void test_updateColumn_nonExistentTable_404() {
    String invalidFQN = "nonexistent.service.database.schema.table.column";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Should Fail");
    assertResponse(
        () -> updateColumnByFQN(invalidFQN, updateColumn),
        NOT_FOUND,
        "table instance for " + FullyQualifiedName.getParentFQN(invalidFQN) + " not found");
  }

  @Test
  void test_updateColumn_databasePersistence() throws IOException {
    String columnFQN = table.getFullyQualifiedName() + ".id";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Primary ID");
    updateColumn.setDescription("Primary identifier for the record");

    org.openmetadata.schema.type.TagLabel testTag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("PersonalData.Personal")
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    updateColumn.setTags(listOf(testTag));

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn);
    assertEquals("Primary ID", updatedColumn.getDisplayName());
    assertEquals("Primary identifier for the record", updatedColumn.getDescription());
    assertEquals(1, updatedColumn.getTags().size());
    assertEquals("PersonalData.Personal", updatedColumn.getTags().get(0).getTagFQN());

    Table persistedTable =
        tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    Column persistedColumn =
        persistedTable.getColumns().stream()
            .filter(c -> c.getName().equals("id"))
            .findFirst()
            .orElseThrow();

    assertEquals("Primary ID", persistedColumn.getDisplayName());
    assertEquals("Primary identifier for the record", persistedColumn.getDescription());
    assertEquals(1, persistedColumn.getTags().size());
    assertEquals("PersonalData.Personal", persistedColumn.getTags().get(0).getTagFQN());

    assertTrue(persistedTable.getVersion() > table.getVersion());
  }

  private Column updateColumnByFQN(String columnFQN, UpdateColumn updateColumn, String entityType)
      throws IOException {
    WebTarget target =
        getResource(COLUMN_UPDATE_PATH + columnFQN).queryParam("entityType", entityType);
    return TestUtils.put(target, updateColumn, Column.class, OK, ADMIN_AUTH_HEADERS);
  }

  private Column updateColumnByFQN(String columnFQN, UpdateColumn updateColumn) throws IOException {
    return updateColumnByFQN(columnFQN, updateColumn, "table");
  }
}
