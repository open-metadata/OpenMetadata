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

package org.openmetadata.service.resources.lineage;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.lang.reflect.Method;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResourceTest;
import org.openmetadata.service.resources.dqtests.TestCaseResourceTest;
import org.openmetadata.service.resources.dqtests.TestDefinitionResourceTest;
import org.openmetadata.service.resources.dqtests.TestSuiteResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.mlmodels.MlModelResourceTest;
import org.openmetadata.service.resources.storages.ContainerResourceTest;
import org.openmetadata.service.resources.teams.RoleResource;
import org.openmetadata.service.resources.teams.RoleResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class LineageResourceTest extends OpenMetadataApplicationTest {
  public static final List<Table> TABLES = new ArrayList<>();
  public static final int TABLE_COUNT = 10;
  private static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  private static DashboardDataModel DATA_MODEL;
  private static Table TABLE_DATA_MODEL_LINEAGE;
  private static Topic TOPIC;
  private static Container CONTAINER;
  private static MlModel ML_MODEL;

  private static Dashboard DASHBOARD;

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    // Create TABLE_COUNT number of tables
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test); // Initialize TableResourceTest for using helper methods
    for (int i = 0; i < TABLE_COUNT; i++) {
      CreateTable createTable = tableResourceTest.createRequest(test, i);
      TABLES.add(tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS));
    }

    // Entities to test lineage DashboardDataModel <-> Table
    DashboardDataModelResourceTest dashboardResourceTest = new DashboardDataModelResourceTest();
    CreateDashboardDataModel createDashboardDataModel = dashboardResourceTest.createRequest(test);
    DATA_MODEL = dashboardResourceTest.createEntity(createDashboardDataModel, ADMIN_AUTH_HEADERS);
    CreateTable createTable = tableResourceTest.createRequest(test, TABLE_COUNT);
    createTable.setColumns(createDashboardDataModel.getColumns());
    TABLE_DATA_MODEL_LINEAGE = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    TopicResourceTest topicResourceTest = new TopicResourceTest();
    CreateTopic topicRequest =
        topicResourceTest
            .createRequest(test)
            .withMessageSchema(TopicResourceTest.SCHEMA.withSchemaFields(TopicResourceTest.fields));
    TOPIC = topicResourceTest.createEntity(topicRequest, ADMIN_AUTH_HEADERS);
    ContainerResourceTest containerResourceTest = new ContainerResourceTest();
    ContainerDataModel dataModel =
        new ContainerDataModel().withColumns(ContainerResourceTest.dataModelColumns);
    CreateContainer containerRequest =
        containerResourceTest.createRequest(test).withDataModel(dataModel);
    CONTAINER = containerResourceTest.createEntity(containerRequest, ADMIN_AUTH_HEADERS);
    MlModelResourceTest mlModelResourceTest = new MlModelResourceTest();
    CreateMlModel createMlModel =
        mlModelResourceTest.createRequest(test).withMlFeatures(MlModelResourceTest.ML_FEATURES);
    ML_MODEL = mlModelResourceTest.createEntity(createMlModel, ADMIN_AUTH_HEADERS);
    DashboardResourceTest dashboardResourceTest1 = new DashboardResourceTest();
    CreateDashboard createDashboard = dashboardResourceTest1.createRequest(test);
    DASHBOARD = dashboardResourceTest1.createEntity(createDashboard, ADMIN_AUTH_HEADERS);
  }

  @Order(1)
  @Test
  void put_delete_lineage_withAuthorizer() throws HttpResponseException {
    // Random user cannot update lineage.
    UserResourceTest userResourceTest = new UserResourceTest();
    User randomUser =
        userResourceTest.createEntity(
            userResourceTest.createRequest("lineage_user", "", "", null), ADMIN_AUTH_HEADERS);

    // User with Data Steward role. Data Steward role has a default policy to allow update for
    // lineage.
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role dataStewardRole =
        roleResourceTest.getEntityByName(
            DATA_STEWARD_ROLE_NAME, null, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);
    User userWithDataStewardRole =
        userResourceTest.createEntity(
            userResourceTest
                .createRequest("lineage_user_data_steward", "", "", null)
                .withRoles(List.of(dataStewardRole.getId())),
            ADMIN_AUTH_HEADERS);

    // Admins are able to add or delete edges.
    checkAuthorization(ADMIN_USER_NAME, false);
    // User with Data Steward role is able to add or delete edges.
    checkAuthorization(userWithDataStewardRole.getName(), false);
    // Random user is not able to add or delete edges.
    checkAuthorization(randomUser.getName(), true);
  }

  private void checkAuthorization(String userName, boolean shouldThrowException)
      throws HttpResponseException {
    Map<String, String> authHeaders = authHeaders(userName + "@open-metadata.org");

    if (shouldThrowException) {
      assertResponse(
          () -> addEdge(TABLES.get(1), TABLES.get(2), null, authHeaders),
          FORBIDDEN,
          permissionNotAllowed(userName, List.of(MetadataOperation.EDIT_LINEAGE)));
      assertResponse(
          () -> deleteEdge(TABLES.get(1), TABLES.get(2), authHeaders),
          FORBIDDEN,
          permissionNotAllowed(userName, List.of(MetadataOperation.EDIT_LINEAGE)));
      return;
    }

    addEdge(TABLES.get(1), TABLES.get(2), null, authHeaders(userName + "@open-metadata.org"));
    deleteEdge(TABLES.get(1), TABLES.get(2), authHeaders(userName + "@open-metadata.org"));
  }

  @Order(2)
  @Test
  void put_delete_lineage_200() throws HttpResponseException {
    // Add lineage table4-->table5
    addEdge(TABLES.get(4), TABLES.get(5));

    // Add lineage table5-->table6
    addEdge(TABLES.get(5), TABLES.get(6));
    addEdge(TABLES.get(5), TABLES.get(6)); // PUT operation again with the same edge

    //
    // Add edges to this lineage graph
    //          table2-->      -->table9
    // table0-->table3-->table4-->table5->table6->table7
    //          table1-->      -->table8
    addEdge(TABLES.get(0), TABLES.get(3));
    addEdge(TABLES.get(2), TABLES.get(4));
    addEdge(TABLES.get(3), TABLES.get(4));
    addEdge(TABLES.get(1), TABLES.get(4));
    addEdge(TABLES.get(4), TABLES.get(9));
    addEdge(TABLES.get(4), TABLES.get(5));
    addEdge(TABLES.get(4), TABLES.get(8));
    addEdge(TABLES.get(5), TABLES.get(6));
    addEdge(TABLES.get(6), TABLES.get(7));

    // Test table4 lineage
    Edge[] expectedUpstreamEdges = {
      getEdge(TABLES.get(2), TABLES.get(4)),
      getEdge(TABLES.get(3), TABLES.get(4)),
      getEdge(TABLES.get(1), TABLES.get(4)),
      getEdge(TABLES.get(0), TABLES.get(3))
    };
    Edge[] expectedDownstreamEdges = {
      getEdge(TABLES.get(4), TABLES.get(9)),
      getEdge(TABLES.get(4), TABLES.get(5)),
      getEdge(TABLES.get(4), TABLES.get(8)),
      getEdge(TABLES.get(5), TABLES.get(6)),
      getEdge(TABLES.get(6), TABLES.get(7))
    };

    // GET lineage by id and fqn and ensure it is correct
    assertLineage(
        Entity.TABLE,
        TABLES.get(4).getId(),
        TABLES.get(4).getFullyQualifiedName(),
        3,
        3,
        expectedUpstreamEdges,
        expectedDownstreamEdges);

    // Test table4 partial lineage with various upstream and downstream depths
    // First upstream and downstream depth of 0
    assertLineage(
        Entity.TABLE,
        TABLES.get(4).getId(),
        TABLES.get(4).getFullyQualifiedName(),
        0,
        0,
        Arrays.copyOfRange(expectedUpstreamEdges, 0, 0),
        Arrays.copyOfRange(expectedDownstreamEdges, 0, 0));
    // Upstream and downstream depth of 1
    assertLineage(
        Entity.TABLE,
        TABLES.get(4).getId(),
        TABLES.get(4).getFullyQualifiedName(),
        1,
        1,
        Arrays.copyOfRange(expectedUpstreamEdges, 0, 3),
        Arrays.copyOfRange(expectedDownstreamEdges, 0, 3));
    // Upstream and downstream depth of 2
    assertLineage(
        Entity.TABLE,
        TABLES.get(4).getId(),
        TABLES.get(4).getFullyQualifiedName(),
        2,
        2,
        Arrays.copyOfRange(expectedUpstreamEdges, 0, 4),
        Arrays.copyOfRange(expectedDownstreamEdges, 0, 4));

    // Upstream and downstream depth as null to test for default value of 1
    assertLineage(
        Entity.TABLE,
        TABLES.get(4).getId(),
        TABLES.get(4).getFullyQualifiedName(),
        null,
        null,
        Arrays.copyOfRange(expectedUpstreamEdges, 0, 3),
        Arrays.copyOfRange(expectedDownstreamEdges, 0, 3));

    //
    // Delete all the lineage edges
    //          table2-->      -->table9
    // table0-->table3-->table4-->table5->table6->table7
    //          table1-->      -->table8
    deleteEdge(TABLES.get(0), TABLES.get(3));
    deleteEdge(TABLES.get(3), TABLES.get(4));
    deleteEdge(TABLES.get(2), TABLES.get(4));
    deleteEdge(TABLES.get(1), TABLES.get(4));
    deleteEdge(TABLES.get(4), TABLES.get(9));
    deleteEdge(TABLES.get(4), TABLES.get(5));
    deleteEdge(TABLES.get(4), TABLES.get(8));
    deleteEdge(TABLES.get(5), TABLES.get(6));
    deleteEdge(TABLES.get(6), TABLES.get(7));

    // Ensure upstream and downstream lineage is empty
    assertLineage(
        Entity.TABLE,
        TABLES.get(4).getId(),
        TABLES.get(4).getFullyQualifiedName(),
        2,
        2,
        new Edge[0],
        new Edge[0]);
  }

  @Order(3)
  @Test
  void put_lineageWithDetails() throws HttpResponseException {
    // Add column lineage table1.c1 -> table2.c1
    LineageDetails details = new LineageDetails();
    String t1c1FQN = TABLES.get(0).getColumns().get(0).getFullyQualifiedName();
    String t1c2FQN = TABLES.get(0).getColumns().get(1).getFullyQualifiedName();
    String t1c3FQN = TABLES.get(0).getColumns().get(2).getFullyQualifiedName();
    String t2c1FQN = TABLES.get(1).getColumns().get(0).getFullyQualifiedName();
    String t2c2FQN = TABLES.get(1).getColumns().get(1).getFullyQualifiedName();
    String t2c3FQN = TABLES.get(1).getColumns().get(2).getFullyQualifiedName();
    String t3c1FQN = TABLES.get(2).getColumns().get(0).getFullyQualifiedName();
    String t3c2FQN = TABLES.get(2).getColumns().get(1).getFullyQualifiedName();
    String t3c3FQN = TABLES.get(2).getColumns().get(2).getFullyQualifiedName();

    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c1FQN)).withToColumn(t2c1FQN));
    addEdge(TABLES.get(0), TABLES.get(1), details, ADMIN_AUTH_HEADERS);

    // Add invalid column lineage (from column or to column are invalid)
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of("invalidColumn")).withToColumn(t2c1FQN));
    assertResponse(
        () -> addEdge(TABLES.get(0), TABLES.get(1), details, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid column name invalidColumn");
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c1FQN)).withToColumn("invalidColumn"));
    assertResponse(
        () -> addEdge(TABLES.get(0), TABLES.get(1), details, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid column name invalidColumn");

    // Add column level lineage with multiple fromColumns (t1c1 + t3c1) to t2c1
    details.getColumnsLineage().clear();
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c1FQN, t1c3FQN)).withToColumn(t2c1FQN));
    addEdge(TABLES.get(0), TABLES.get(1), details, ADMIN_AUTH_HEADERS);

    // Finally, add detailed column level lineage
    details.getColumnsLineage().clear();
    List<ColumnLineage> lineage = details.getColumnsLineage();
    lineage.add(new ColumnLineage().withFromColumns(List.of(t1c1FQN)).withToColumn(t2c1FQN));
    lineage.add(new ColumnLineage().withFromColumns(List.of(t1c2FQN)).withToColumn(t2c2FQN));
    lineage.add(new ColumnLineage().withFromColumns(List.of(t1c3FQN)).withToColumn(t2c3FQN));

    addEdge(TABLES.get(0), TABLES.get(1), details, ADMIN_AUTH_HEADERS);
  }

  @Order(4)
  @Test
  void putLineageFromEntityToEntity() throws HttpResponseException {
    // Add column lineage dashboard.d1 -> table.c1
    LineageDetails details = new LineageDetails();
    String d1c1FQN = DATA_MODEL.getColumns().get(0).getFullyQualifiedName();
    String d1c2FQN = DATA_MODEL.getColumns().get(1).getFullyQualifiedName();
    String d1c3FQN = DATA_MODEL.getColumns().get(2).getFullyQualifiedName();
    String c1c1FQN = TABLE_DATA_MODEL_LINEAGE.getColumns().get(0).getFullyQualifiedName();
    String c1c2FQN = TABLE_DATA_MODEL_LINEAGE.getColumns().get(1).getFullyQualifiedName();
    String c1c3FQN = TABLE_DATA_MODEL_LINEAGE.getColumns().get(2).getFullyQualifiedName();

    List<ColumnLineage> lineage = details.getColumnsLineage();
    lineage.add(new ColumnLineage().withFromColumns(List.of(c1c1FQN)).withToColumn(d1c1FQN));
    lineage.add(new ColumnLineage().withFromColumns(List.of(c1c2FQN)).withToColumn(d1c2FQN));
    lineage.add(new ColumnLineage().withFromColumns(List.of(c1c3FQN)).withToColumn(d1c3FQN));
    addEdge(TABLE_DATA_MODEL_LINEAGE, DATA_MODEL, details, ADMIN_AUTH_HEADERS);

    LineageDetails topicToTable = new LineageDetails();
    String f1FQN = TOPIC.getMessageSchema().getSchemaFields().get(0).getFullyQualifiedName();
    String f2FQN = TOPIC.getMessageSchema().getSchemaFields().get(0).getFullyQualifiedName();
    String f1t1 = TABLE_DATA_MODEL_LINEAGE.getColumns().get(0).getFullyQualifiedName();
    String f2t2 = TABLE_DATA_MODEL_LINEAGE.getColumns().get(1).getFullyQualifiedName();
    List<ColumnLineage> topicToTableLineage = topicToTable.getColumnsLineage();
    topicToTableLineage.add(new ColumnLineage().withFromColumns(List.of(f1FQN)).withToColumn(f1t1));
    topicToTableLineage.add(new ColumnLineage().withFromColumns(List.of(f2FQN)).withToColumn(f2t2));
    addEdge(TOPIC, TABLE_DATA_MODEL_LINEAGE, topicToTable, ADMIN_AUTH_HEADERS);
    String f3FQN = "test_non_existent_filed";
    topicToTableLineage.add(
        new ColumnLineage().withFromColumns(List.of(f3FQN)).withToColumn(d1c1FQN));
    assertResponse(
        () -> addEdge(TOPIC, TABLE_DATA_MODEL_LINEAGE, topicToTable, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        String.format("Invalid column name %s", f3FQN));

    LineageDetails topicToContainer = new LineageDetails();
    String f1c1 = CONTAINER.getDataModel().getColumns().get(0).getFullyQualifiedName();
    String f2c2 = CONTAINER.getDataModel().getColumns().get(1).getFullyQualifiedName();
    List<ColumnLineage> topicToContainerLineage = topicToContainer.getColumnsLineage();
    topicToContainerLineage.add(
        new ColumnLineage().withFromColumns(List.of(f1FQN)).withToColumn(f1c1));
    topicToContainerLineage.add(
        new ColumnLineage().withFromColumns(List.of(f2FQN)).withToColumn(f2c2));
    addEdge(TOPIC, CONTAINER, topicToContainer, ADMIN_AUTH_HEADERS);
    String f2c3FQN = "test_non_existent_container_column";
    topicToContainerLineage.add(
        new ColumnLineage().withFromColumns(List.of(f2FQN)).withToColumn(f2c3FQN));
    assertResponse(
        () -> addEdge(TOPIC, CONTAINER, topicToContainer, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        String.format("Invalid column name %s", f2c3FQN));

    LineageDetails containerToTable = new LineageDetails();
    List<ColumnLineage> containerToTableLineage = containerToTable.getColumnsLineage();
    containerToTableLineage.add(
        new ColumnLineage().withFromColumns(List.of(f1c1)).withToColumn(f1t1));
    containerToTableLineage.add(
        new ColumnLineage().withFromColumns(List.of(f2c2)).withToColumn(f2t2));
    addEdge(CONTAINER, TABLE_DATA_MODEL_LINEAGE, containerToTable, ADMIN_AUTH_HEADERS);

    LineageDetails tableToMlModel = new LineageDetails();
    String m1f1 = ML_MODEL.getMlFeatures().get(0).getFullyQualifiedName();
    String m2f2 = ML_MODEL.getMlFeatures().get(1).getFullyQualifiedName();
    List<ColumnLineage> tableToMlModelLineage = tableToMlModel.getColumnsLineage();
    tableToMlModelLineage.add(
        new ColumnLineage().withFromColumns(List.of(f1t1)).withToColumn(m1f1));
    tableToMlModelLineage.add(
        new ColumnLineage().withFromColumns(List.of(f2t2)).withToColumn(m2f2));
    addEdge(TABLE_DATA_MODEL_LINEAGE, ML_MODEL, tableToMlModel, ADMIN_AUTH_HEADERS);
    String m3f3 = "test_non_existent_feature";
    tableToMlModelLineage.add(
        new ColumnLineage().withFromColumns(List.of(f2t2)).withToColumn(m3f3));
    assertResponse(
        () -> addEdge(TABLE_DATA_MODEL_LINEAGE, ML_MODEL, tableToMlModel, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        String.format("Invalid column name %s", m3f3));

    LineageDetails tableToDashboard = new LineageDetails();
    String c1d1 = DASHBOARD.getCharts().get(0).getFullyQualifiedName();
    String c2d1 = DASHBOARD.getCharts().get(1).getFullyQualifiedName();

    List<ColumnLineage> tableToDashboardLineage = tableToDashboard.getColumnsLineage();
    tableToDashboardLineage.add(
        new ColumnLineage().withFromColumns(List.of(f1t1)).withToColumn(c1d1));
    tableToDashboardLineage.add(
        new ColumnLineage().withFromColumns(List.of(f2t2)).withToColumn(c2d1));
    addEdge(TABLE_DATA_MODEL_LINEAGE, DASHBOARD, tableToDashboard, ADMIN_AUTH_HEADERS);

    deleteEdgeByName(
        TOPIC.getEntityReference().getType(),
        TOPIC.getFullyQualifiedName(),
        CONTAINER.getEntityReference().getType(),
        CONTAINER.getFullyQualifiedName());
  }

  @Order(5)
  @Test
  void put_lineageWithDescription() throws HttpResponseException {
    LineageDetails lineageDetails = new LineageDetails();
    lineageDetails.setDescription("lineage edge description");
    addEdge(TABLES.get(0), TABLES.get(1), lineageDetails, ADMIN_AUTH_HEADERS);
    Edge edge = getEdge(TABLES.get(0).getId(), TABLES.get(1).getId(), lineageDetails);
    assertEquals(lineageDetails.getDescription(), edge.getLineageDetails().getDescription());
  }

  @Order(6)
  @Test
  void get_dataQualityLineage(TestInfo test)
      throws IOException, URISyntaxException, ParseException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TestCaseResourceTest testCaseResourceTest = new TestCaseResourceTest();
    TestDefinitionResourceTest testDefinitionResourceTest = new TestDefinitionResourceTest();

    addEdge(TABLES.get(4), TABLES.get(5));
    addEdge(TABLES.get(5), TABLES.get(6));
    addEdge(TABLES.get(0), TABLES.get(4));
    addEdge(TABLES.get(0), TABLES.get(2));
    addEdge(TABLES.get(2), TABLES.get(1));
    addEdge(TABLES.get(2), TABLES.get(7));
    addEdge(TABLES.get(6), TABLES.get(7));

    Map<String, String> queryParams =
        Map.of("fqn", TABLES.get(7).getFullyQualifiedName(), "upstreamDepth", "3");
    Map<String, Object> lineage = getDataQualityLineage(queryParams, ADMIN_AUTH_HEADERS);

    // we have no failures in the lineage, hence no
    assertEquals(0, ((List) lineage.get("nodes")).size());
    assertEquals(0, ((List) lineage.get("edges")).size());

    // Create test cases with failures for table 4 and table 6
    TestDefinition testDefinition =
        testDefinitionResourceTest.getEntityByName(
            "columnValuesToBeNotNull", "owners", ADMIN_AUTH_HEADERS);

    CreateTestSuite createTestSuite4 =
        testSuiteResourceTest.createRequest(test).withName(TABLES.get(4).getFullyQualifiedName());
    CreateTestSuite createTestSuite6 =
        testSuiteResourceTest.createRequest(test).withName(TABLES.get(6).getFullyQualifiedName());
    TestSuite testSuite4 =
        testSuiteResourceTest.createBasicTestSuite(createTestSuite4, ADMIN_AUTH_HEADERS);
    TestSuite testSuite6 =
        testSuiteResourceTest.createBasicTestSuite(createTestSuite6, ADMIN_AUTH_HEADERS);

    MessageParser.EntityLink TABLE4_COLUMN_LINK =
        MessageParser.EntityLink.parse(
            String.format("<#E::table::%s::columns::c1>", TABLES.get(4).getFullyQualifiedName()));
    MessageParser.EntityLink TABLE6_COLUMN_LINK =
        MessageParser.EntityLink.parse(
            String.format("<#E::table::%s::columns::c1>", TABLES.get(6).getFullyQualifiedName()));
    CreateTestCase create4 = testCaseResourceTest.createRequest(test);
    CreateTestCase create6 = testCaseResourceTest.createRequest(test, 2);
    create4
        .withEntityLink(TABLE4_COLUMN_LINK.getLinkString())
        .withTestDefinition(testDefinition.getFullyQualifiedName());
    create6
        .withEntityLink(TABLE6_COLUMN_LINK.getLinkString())
        .withTestDefinition(testDefinition.getFullyQualifiedName());
    TestCase testCase4 = testCaseResourceTest.createEntity(create4, ADMIN_AUTH_HEADERS);
    TestCase testCase6 = testCaseResourceTest.createEntity(create6, ADMIN_AUTH_HEADERS);

    CreateTestCaseResult createTestCaseResult =
        new CreateTestCaseResult()
            .withResult("tested")
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withTimestamp(TestUtils.dateToTimestamp(String.format("2024-09-11")));
    testCaseResourceTest.postTestCaseResult(
        testCase4.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);
    testCaseResourceTest.postTestCaseResult(
        testCase6.getFullyQualifiedName(), createTestCaseResult, ADMIN_AUTH_HEADERS);

    lineage = getDataQualityLineage(queryParams, ADMIN_AUTH_HEADERS);
    List<Map<String, Object>> edges = ((List<Map<String, Object>>) lineage.get("edges"));
    List<Map<String, Object>> nodes = ((List<Map<String, Object>>) lineage.get("nodes"));
    // We should have 2 nodes (4 and 6) and 3 edges (4->5, 5->6, 6->7)
    assertEquals(3, edges.size());
    assertEquals(2, nodes.size());

    assertTrue(
        nodes.stream()
            .allMatch(
                n ->
                    TABLES.get(4).getId().toString().equals(n.get("id"))
                        || TABLES.get(6).getId().toString().equals(n.get("id"))));
    // our lineage is 0 -> 4 -> 5 -> 6 -> 7
    for (Map<String, Object> edge : edges) {
      Map<String, String> toEntity = ((Map<String, String>) edge.get("toEntity"));
      Map<String, String> fromEntity = ((Map<String, String>) edge.get("fromEntity"));
      if (toEntity.get("id").equals(TABLES.get(6).getId().toString())) {
        assertEquals(TABLES.get(5).getId().toString(), fromEntity.get("id"));
      } else if (fromEntity.get("id").equals(TABLES.get(4).getId().toString())) {
        assertEquals(TABLES.get(5).getId().toString(), toEntity.get("id"));
      } else if (fromEntity.get("id").equals(TABLES.get(6).getId().toString())) {
        assertEquals(TABLES.get(7).getId().toString(), toEntity.get("id"));
      } else {
        fail(String.format("Unexpected edge: %s", edge));
      }
    }

    deleteEdge(TABLES.get(4), TABLES.get(5));
    deleteEdge(TABLES.get(5), TABLES.get(6));
    deleteEdge(TABLES.get(0), TABLES.get(4));
    deleteEdge(TABLES.get(0), TABLES.get(2));
    deleteEdge(TABLES.get(2), TABLES.get(1));
    deleteEdge(TABLES.get(2), TABLES.get(7));
    deleteEdge(TABLES.get(6), TABLES.get(7));
  }

  @Order(7)
  @Test
  void get_SearchLineage(TestInfo testInfo) throws HttpResponseException {
    // our lineage is
    //                  0
    //            +-----+-----+
    //            v           v
    //            2           4
    //        +---+---+       v
    //        v       |       5
    //        1       |       v
    //                |       6
    //                |       v
    //                +-----> 7

    addEdge(TABLES.get(4), TABLES.get(5));
    addEdge(TABLES.get(5), TABLES.get(6));
    addEdge(TABLES.get(0), TABLES.get(4));
    addEdge(TABLES.get(0), TABLES.get(2));
    addEdge(TABLES.get(2), TABLES.get(1));
    addEdge(TABLES.get(2), TABLES.get(7));
    addEdge(TABLES.get(6), TABLES.get(7));

    SearchLineageResult searchLineageResult =
        searchLineage(TABLES.get(5).getEntityReference(), 1, 1);
    assertSearchLineageResponseFields(searchLineageResult);

    deleteEdge(TABLES.get(4), TABLES.get(5));
    deleteEdge(TABLES.get(5), TABLES.get(6));
    deleteEdge(TABLES.get(0), TABLES.get(4));
    deleteEdge(TABLES.get(0), TABLES.get(2));
    deleteEdge(TABLES.get(2), TABLES.get(1));
    deleteEdge(TABLES.get(2), TABLES.get(7));
    deleteEdge(TABLES.get(6), TABLES.get(7));
  }

  public Edge getEdge(Table from, Table to) {
    return getEdge(from.getId(), to.getId(), null);
  }

  public static Edge getEdge(UUID from, UUID to, LineageDetails details) {
    return new Edge().withFromEntity(from).withToEntity(to).withLineageDetails(details);
  }

  public void addEdge(Table from, Table to) throws HttpResponseException {
    addEdge(from, to, null, ADMIN_AUTH_HEADERS);
  }

  private void addEdge(
      EntityInterface from,
      EntityInterface to,
      LineageDetails details,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    if (details != null) {
      details.setSqlQuery("select *;");
    }
    EntitiesEdge edge =
        new EntitiesEdge()
            .withFromEntity(from.getEntityReference())
            .withToEntity(to.getEntityReference())
            .withLineageDetails(details);
    AddLineage addLineage = new AddLineage().withEdge(edge);
    addLineageAndCheck(addLineage, authHeaders);
  }

  public void deleteEdge(Table from, Table to) throws HttpResponseException {
    deleteEdge(from, to, ADMIN_AUTH_HEADERS);
  }

  public void deleteEdgeByName(String fromEntity, String fromFQN, String toEntity, String toFQN)
      throws HttpResponseException {
    deleteLineageByName(fromEntity, fromFQN, toEntity, toFQN, ADMIN_AUTH_HEADERS);
  }

  private void deleteEdge(Table from, Table to, Map<String, String> authHeaders)
      throws HttpResponseException {
    EntitiesEdge edge =
        new EntitiesEdge()
            .withFromEntity(from.getEntityReference())
            .withToEntity(to.getEntityReference());
    deleteLineageAndCheck(edge, authHeaders);
  }

  public void addLineageAndCheck(AddLineage addLineage, Map<String, String> authHeaders)
      throws HttpResponseException {
    addLineage(addLineage, authHeaders);
    validateLineage(addLineage, authHeaders);
  }

  public void deleteLineageAndCheck(EntitiesEdge deleteEdge, Map<String, String> authHeaders)
      throws HttpResponseException {
    deleteLineage(deleteEdge, authHeaders);
    validateLineageDeleted(deleteEdge, authHeaders);
  }

  public void addLineage(AddLineage addLineage, Map<String, String> authHeaders)
      throws HttpResponseException {
    TestUtils.put(getResource("lineage"), addLineage, Status.OK, authHeaders);
  }

  public void deleteLineage(EntitiesEdge edge, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource(
            String.format(
                "lineage/%s/%s/%s/%s",
                edge.getFromEntity().getType(),
                edge.getFromEntity().getId(),
                edge.getToEntity().getType(),
                edge.getToEntity().getId()));
    TestUtils.delete(target, authHeaders);
  }

  public void deleteLineageByName(
      String fromEntity,
      String fromFQN,
      String toEntity,
      String toFQN,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResourceAsURI(
            String.format(
                "lineage/%s/name/%s/%s/name/%s",
                fromEntity, URLEncoder.encode(fromFQN), toEntity, URLEncoder.encode(toFQN)));
    TestUtils.delete(target, authHeaders);
  }

  private void validateLineage(AddLineage addLineage, Map<String, String> authHeaders)
      throws HttpResponseException {
    EntityReference from = addLineage.getEdge().getFromEntity();
    EntityReference to = addLineage.getEdge().getToEntity();
    Edge expectedEdge = getEdge(from.getId(), to.getId(), addLineage.getEdge().getLineageDetails());

    // Check fromEntity ---> toEntity downstream edge of 'from' is returned
    EntityLineage lineage = getLineage(from.getType(), from.getId(), 0, 1, authHeaders);
    assertEdge(lineage, expectedEdge, true);

    // Check fromEntity ---> toEntity upstream edge 'to' is returned
    lineage = getLineage(to.getType(), to.getId(), 1, 0, authHeaders);
    assertEdge(lineage, expectedEdge, false);
  }

  private void validateLineageDeleted(EntitiesEdge deletedEdge, Map<String, String> authHeaders)
      throws HttpResponseException {
    EntityReference from = deletedEdge.getFromEntity();
    EntityReference to = deletedEdge.getToEntity();
    Edge expectedEdge = getEdge(from.getId(), to.getId(), deletedEdge.getLineageDetails());

    // Check fromEntity ---> toEntity downstream edge is returned
    EntityLineage lineage = getLineage(from.getType(), from.getId(), 0, 1, authHeaders);
    assertDeleted(lineage, expectedEdge, true);

    // Check fromEntity ---> toEntity upstream edge is returned
    lineage = getLineage(to.getType(), to.getId(), 1, 0, authHeaders);
    assertDeleted(lineage, expectedEdge, false);
  }

  private static void validateLineage(EntityLineage lineage) {
    TestUtils.validateEntityReference(lineage.getEntity());
    lineage.getNodes().forEach(TestUtils::validateEntityReference);

    // Total number of from and to points in an edge must be equal to the number of nodes
    List<UUID> ids = new ArrayList<>();
    lineage
        .getUpstreamEdges()
        .forEach(
            edge -> {
              ids.add(edge.getFromEntity());
              ids.add(edge.getToEntity());
            });
    lineage
        .getDownstreamEdges()
        .forEach(
            edge -> {
              ids.add(edge.getFromEntity());
              ids.add(edge.getToEntity());
            });
    if (lineage.getNodes().size() != 0) {
      assertEquals((int) ids.stream().distinct().count(), lineage.getNodes().size() + 1);
    }
  }

  public void assertLineage(
      String entityType,
      UUID id,
      String fqn,
      Integer upstreamDepth,
      Integer downstreamDepth,
      Edge[] expectedUpstreamEdges,
      Edge[] expectedDownstreamEdges)
      throws HttpResponseException {
    EntityLineage lineageById =
        getLineage(entityType, id, upstreamDepth, downstreamDepth, ADMIN_AUTH_HEADERS);
    assertEdges(lineageById, expectedUpstreamEdges, expectedDownstreamEdges);

    EntityLineage lineageByName =
        getLineageByName(entityType, fqn, upstreamDepth, downstreamDepth, ADMIN_AUTH_HEADERS);
    assertEdges(lineageByName, expectedUpstreamEdges, expectedDownstreamEdges);

    // Finally, ensure lineage by Id matches lineage by name
    assertEquals(lineageById, lineageByName);
  }

  private void assertSearchLineageResponseFields(SearchLineageResult searchLineageResult) {
    JsonUtils.getMap(searchLineageResult);
    Map<String, NodeInformation> entities = searchLineageResult.getNodes();
    Set<String> nodesFields =
        Set.of("id", "name", "displayName", "fullyQualifiedName", "upstreamLineage");
    Set<String> nodesColumnsFields = Set.of("name", "fullyQualifiedName");
    for (Map.Entry<String, NodeInformation> entry : entities.entrySet()) {
      Map<String, Object> entity = entry.getValue().getEntity();
      Set<String> keys = entity.keySet();
      Set<String> missingKeys = new HashSet<>(nodesFields);
      missingKeys.removeAll(keys);
      String err = String.format("Nodes keys not found in the response: %s", missingKeys);
      assertTrue(keys.containsAll(nodesFields), err);

      List<Map<String, Object>> columns = (List<Map<String, Object>>) entity.get("columns");
      columns.forEach(
          c -> {
            Set<String> columnsKeys = c.keySet();
            Set<String> missingColumnKeys = new HashSet<>(nodesColumnsFields);
            missingColumnKeys.removeAll(columnsKeys);
            String columnErr =
                String.format("Column nodes keys not found in the response: %s", missingColumnKeys);
            assertTrue(columnsKeys.containsAll(nodesColumnsFields), columnErr);
          });
    }
  }

  public EntityLineage getLineage(
      String entity,
      UUID id,
      Integer upstreamDepth,
      Integer downStreamDepth,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("lineage/" + entity + "/" + id);
    target = upstreamDepth != null ? target.queryParam("upstreamDepth", upstreamDepth) : target;
    target =
        downStreamDepth != null ? target.queryParam("downstreamDepth", downStreamDepth) : target;
    EntityLineage lineage = TestUtils.get(target, EntityLineage.class, authHeaders);
    validateLineage((lineage));
    return lineage;
  }

  public SearchLineageResult searchLineage(
      @NonNull EntityReference entityReference,
      @NonNull int upstreamDepth,
      @NonNull int downstreamDepth)
      throws HttpResponseException {
    WebTarget target = getResource("lineage/getLineage");
    target = target.queryParam("fqn", entityReference.getFullyQualifiedName());
    target = target.queryParam("type", entityReference.getType());
    target = target.queryParam("upstreamDepth", upstreamDepth);
    target = target.queryParam("downstreamDepth", downstreamDepth);
    SearchLineageResult searchLineageResult =
        TestUtils.get(target, SearchLineageResult.class, ADMIN_AUTH_HEADERS);
    return searchLineageResult;
  }

  public EntityLineage getLineageByName(
      String entity,
      String fqn,
      Integer upstreamDepth,
      Integer downStreamDepth,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("lineage/" + entity + "/name/").path(fqn);
    target = upstreamDepth != null ? target.queryParam("upstreamDepth", upstreamDepth) : target;
    target =
        downStreamDepth != null ? target.queryParam("downstreamDepth", downStreamDepth) : target;
    EntityLineage lineage = TestUtils.get(target, EntityLineage.class, authHeaders);
    validateLineage((lineage));
    return lineage;
  }

  public Map<String, Object> getDataQualityLineage(
      Map<String, String> queryParams, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("lineage/getDataQualityLineage");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }

    return TestUtils.get(target, Map.class, authHeaders);
  }

  public void assertEdge(EntityLineage lineage, Edge expectedEdge, boolean downstream) {
    if (downstream) {
      assertTrue(assertEdgeFromLineage(lineage.getDownstreamEdges(), expectedEdge));
    } else {
      assertTrue(assertEdgeFromLineage(lineage.getUpstreamEdges(), expectedEdge));
    }
  }

  public boolean assertEdgeFromLineage(List<Edge> actualEdges, Edge expectedEdge) {
    for (Edge actualEdge : actualEdges) {
      if (actualEdge.getFromEntity().equals(expectedEdge.getFromEntity())
          && actualEdge.getToEntity().equals(expectedEdge.getToEntity())) {
        return true;
      }
    }
    return false;
  }

  public void assertDeleted(EntityLineage lineage, Edge expectedEdge, boolean downstream) {
    if (downstream) {
      assertFalse(lineage.getDownstreamEdges().contains(expectedEdge));
    } else {
      assertFalse(lineage.getUpstreamEdges().contains(expectedEdge));
    }
  }

  public void assertEdges(
      EntityLineage lineage, Edge[] expectedUpstreamEdges, Edge[] expectedDownstreamEdges) {
    assertEquals(lineage.getUpstreamEdges().size(), expectedUpstreamEdges.length);
    for (Edge expectedUpstreamEdge : expectedUpstreamEdges) {
      assertEdgeFromLineage(lineage.getUpstreamEdges(), expectedUpstreamEdge);
    }
    assertEquals(lineage.getDownstreamEdges().size(), expectedDownstreamEdges.length);
    for (Edge expectedDownstreamEdge : expectedDownstreamEdges) {
      assertEdgeFromLineage(lineage.getDownstreamEdges(), expectedDownstreamEdge);
    }
  }

  @Order(8)
  @Test
  void test_getChildrenNames_AllEntityTypes() throws Exception {
    LineageRepository lineageRepository = new LineageRepository();
    Method getChildrenNamesMethod =
        LineageRepository.class.getDeclaredMethod("getChildrenNames", EntityReference.class);
    getChildrenNamesMethod.setAccessible(true);

    // Test Table Entity - should return column children
    EntityReference tableRef = TABLES.get(0).getEntityReference();
    Set<String> tableChildren =
        (Set<String>) getChildrenNamesMethod.invoke(lineageRepository, tableRef);
    assertFalse(tableChildren.isEmpty(), "Table should have column children");
    assertTrue(tableChildren.size() >= 3, "Table should have at least 3 columns");
    Set<String> expectedColumns =
        TABLES.get(0).getColumns().stream().map(Column::getName).collect(Collectors.toSet());
    assertTrue(
        tableChildren.containsAll(expectedColumns),
        "Table children should contain expected column names: " + expectedColumns);

    // Test Topic Entity - should return schema field children
    EntityReference topicRef = TOPIC.getEntityReference();
    Set<String> topicChildren =
        (Set<String>) getChildrenNamesMethod.invoke(lineageRepository, topicRef);
    assertFalse(topicChildren.isEmpty(), "Topic should have schema field children");
    assertTrue(topicChildren.size() >= 1, "Topic should have at least 1 schema field");
    Set<String> expectedFields =
        TOPIC.getMessageSchema().getSchemaFields().stream()
            .map(Field::getName)
            .sorted()
            .collect(Collectors.toCollection(LinkedHashSet::new));
    assertEquals(
        expectedFields,
        topicChildren.stream().sorted().collect(Collectors.toCollection(LinkedHashSet::new)),
        "Topic children should contain expected field names: " + expectedFields);

    // Test Container Entity - should return data model column children
    EntityReference containerRef = CONTAINER.getEntityReference();
    Set<String> containerChildren =
        (Set<String>) getChildrenNamesMethod.invoke(lineageRepository, containerRef);
    assertFalse(containerChildren.isEmpty(), "Container should have data model column children");
    assertTrue(containerChildren.size() >= 2, "Container should have at least 2 columns");
    Set<String> expectedContainerField =
        CONTAINER.getDataModel().getColumns().stream()
            .map(Column::getName)
            .sorted()
            .collect(Collectors.toCollection(LinkedHashSet::new));
    assertEquals(
        expectedContainerField,
        containerChildren.stream().sorted().collect(Collectors.toCollection(LinkedHashSet::new)),
        "Container children should contain expected column names: " + expectedContainerField);

    // Test DashboardDataModel Entity - should return column children
    EntityReference dataModelRef = DATA_MODEL.getEntityReference();
    Set<String> dataModelChildren =
        (Set<String>) getChildrenNamesMethod.invoke(lineageRepository, dataModelRef);
    assertFalse(dataModelChildren.isEmpty(), "DashboardDataModel should have column children");
    assertTrue(dataModelChildren.size() >= 3, "DashboardDataModel should have at least 3 columns");
    Set<String> expectedDataModelColumns =
        DATA_MODEL.getColumns().stream()
            .map(Column::getName)
            .sorted()
            .collect(Collectors.toCollection(LinkedHashSet::new));
    assertTrue(
        dataModelChildren.stream().sorted().toList().containsAll(expectedDataModelColumns),
        "DashboardDataModel children should contain expected column names: "
            + expectedDataModelColumns);

    // Test Dashboard Entity - should return chart children without FQN prefix
    EntityReference dashboardRef = DASHBOARD.getEntityReference();
    Set<String> dashboardChildren =
        (Set<String>) getChildrenNamesMethod.invoke(lineageRepository, dashboardRef);
    assertFalse(dashboardChildren.isEmpty(), "Dashboard should have chart children");
    assertTrue(dashboardChildren.size() >= 2, "Dashboard should have at least 2 charts");
    Set<String> expectedChartNames =
        DASHBOARD.getCharts().stream()
            .map(
                chart ->
                    chart
                        .getFullyQualifiedName()
                        .replace(DASHBOARD.getFullyQualifiedName() + ".", ""))
            .collect(Collectors.toSet());
    assertEquals(
        expectedChartNames,
        dashboardChildren,
        "Dashboard children should match expected chart names without FQN prefix");
    for (String chartName : dashboardChildren) {
      assertFalse(
          chartName.contains(DASHBOARD.getFullyQualifiedName() + "."),
          "Chart name should not contain dashboard FQN prefix: " + chartName);
    }

    // Test MlModel Entity - should return feature children without FQN prefix
    EntityReference mlModelRef = ML_MODEL.getEntityReference();
    Set<String> mlModelChildren =
        (Set<String>) getChildrenNamesMethod.invoke(lineageRepository, mlModelRef);
    assertFalse(mlModelChildren.isEmpty(), "MlModel should have ML feature children");
    assertTrue(mlModelChildren.size() >= 2, "MlModel should have at least 2 ML features");
    Set<String> expectedFeatureNames =
        ML_MODEL.getMlFeatures().stream()
            .map(
                feature ->
                    feature
                        .getFullyQualifiedName()
                        .replace(ML_MODEL.getFullyQualifiedName() + ".", ""))
            .collect(Collectors.toSet());
    assertEquals(
        expectedFeatureNames,
        mlModelChildren,
        "MlModel children should match expected feature names without FQN prefix");
    for (String featureName : mlModelChildren) {
      assertFalse(
          featureName.contains(ML_MODEL.getFullyQualifiedName() + "."),
          "Feature name should not contain ML model FQN prefix: " + featureName);
    }

    // Test Topic Entity without schema - should return empty set
    TopicResourceTest topicResourceTest = new TopicResourceTest();
    CreateTopic topicRequest = topicResourceTest.createRequest("topicWithoutSchema");
    topicRequest.setMessageSchema(null);
    Topic topicWithoutSchema = topicResourceTest.createEntity(topicRequest, ADMIN_AUTH_HEADERS);
    EntityReference topicWithoutSchemaRef = topicWithoutSchema.getEntityReference();
    Set<String> topicWithoutSchemaChildren =
        (Set<String>) getChildrenNamesMethod.invoke(lineageRepository, topicWithoutSchemaRef);
    assertTrue(
        topicWithoutSchemaChildren.isEmpty(),
        "Topic without message schema should return empty set");

    // Test Container Entity without data model - should return empty set
    ContainerResourceTest containerResourceTest = new ContainerResourceTest();
    CreateContainer containerRequest =
        containerResourceTest.createRequest("containerWithoutDataModel");
    containerRequest.setDataModel(null);
    Container containerWithoutDataModel =
        containerResourceTest.createEntity(containerRequest, ADMIN_AUTH_HEADERS);
    EntityReference containerWithoutDataModelRef = containerWithoutDataModel.getEntityReference();
    Set<String> containerWithoutDataModelChildren =
        (Set<String>)
            getChildrenNamesMethod.invoke(lineageRepository, containerWithoutDataModelRef);
    assertTrue(
        containerWithoutDataModelChildren.isEmpty(),
        "Container without data model should return empty set");

    // Test unknown entity type - should return empty set
    EntityReference unknownRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("UNKNOWN_TYPE")
            .withFullyQualifiedName("test.unknown");
    Set<String> unknownChildren =
        (Set<String>) getChildrenNamesMethod.invoke(lineageRepository, unknownRef);
    assertTrue(unknownChildren.isEmpty(), "Unknown entity type should return empty set");
  }
}
