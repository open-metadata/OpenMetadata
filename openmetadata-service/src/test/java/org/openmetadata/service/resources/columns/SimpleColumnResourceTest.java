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
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SimpleColumnResourceTest extends OpenMetadataApplicationTest {

  private Table table;
  private DashboardDataModel dashboardDataModel;
  private TableResourceTest tableResourceTest;
  private DashboardDataModelResourceTest dataModelResourceTest;

  private static final String COLUMN_UPDATE_PATH = "columns/name/";

  @BeforeAll
  void setup(TestInfo test) throws IOException {
    DatabaseServiceResourceTest dbServiceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createDBService =
        dbServiceTest.createRequest(test).withName("simple_column_test_db_service");
    DatabaseService databaseService =
        dbServiceTest.createEntity(createDBService, ADMIN_AUTH_HEADERS);

    DatabaseResourceTest dbTest = new DatabaseResourceTest();
    CreateDatabase createDB =
        new CreateDatabase()
            .withName("simple_column_test_database")
            .withService(databaseService.getFullyQualifiedName());
    Database database = dbTest.createEntity(createDB, ADMIN_AUTH_HEADERS);

    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("simple_column_test_schema")
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
            .withName("simple_column_test_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(columns);
    table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    DashboardServiceResourceTest dashServiceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashService =
        dashServiceTest.createRequest(test).withName("simple_column_test_dash_service");
    DashboardService dashboardService =
        dashServiceTest.createEntity(createDashService, ADMIN_AUTH_HEADERS);

    List<Column> dataModelColumns =
        Arrays.asList(
            new Column().withName("metric1").withDataType(ColumnDataType.DOUBLE),
            new Column().withName("dimension1").withDataType(ColumnDataType.STRING));

    dataModelResourceTest = new DashboardDataModelResourceTest();
    CreateDashboardDataModel createDataModel =
        new CreateDashboardDataModel()
            .withName("simple_column_test_datamodel")
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

    Column updatedColumn = updateColumnByFQN(columnFQN, updateColumn, "dashboardDataModel");
    assertEquals("Sales Metric", updatedColumn.getDisplayName());
    assertEquals("Total sales amount", updatedColumn.getDescription());

    DashboardDataModel updatedDataModel =
        dataModelResourceTest.getEntity(dashboardDataModel.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column metric1Column =
        updatedDataModel.getColumns().stream()
            .filter(c -> c.getName().equals("metric1"))
            .findFirst()
            .orElseThrow();
    assertEquals("Sales Metric", metric1Column.getDisplayName());
    assertEquals("Total sales amount", metric1Column.getDescription());
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
