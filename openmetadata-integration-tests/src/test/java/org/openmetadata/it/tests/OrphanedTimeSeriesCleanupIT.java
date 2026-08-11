/*
 *  Copyright 2025 Collate
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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.ApplicationType;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.AIApplications;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Integration tests for {@link CollectionDAO} per-type orphan time-series cleanup queries used by
 * {@code DataRetention.cleanOrphanedTimeSeriesRows()}.
 *
 * <p>Each test inserts one valid row (referencing a real parent entity) and one orphan row
 * (referencing a non-existent parent), invokes {@code deleteOrphanedRecords(limit)} on the
 * corresponding DAO, and verifies that only the orphan is deleted.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OrphanedTimeSeriesCleanupIT {

  private static final int BATCH = 10_000;
  private static final String MCP_SERVICE_NAME = "mcp-orphan-cleanup-svc";

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll
  public static void setup() throws Exception {
    AIApplications.setDefaultClient(SdkClients.adminClient());

    CreateMcpService createService =
        new CreateMcpService()
            .withName(MCP_SERVICE_NAME)
            .withServiceType(CreateMcpService.McpServiceType.Mcp);
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/services/mcpServices",
            createService,
            RequestOptions.builder().build());
  }

  @Test
  void agentExecutionOrphans(TestNamespace ns) {
    AIApplication app =
        AIApplications.create()
            .name("agentExecOrph_" + ns.uniqueShortId())
            .withApplicationType(ApplicationType.Chatbot)
            .withDescription("Parent app for orphan cleanup test")
            .execute();
    assertNotNull(app.getId());

    UUID validId = UUID.randomUUID();
    UUID orphanId = UUID.randomUUID();
    UUID orphanAgentId = UUID.randomUUID();

    insertAgentExecution(validId, app.getId());
    insertAgentExecution(orphanId, orphanAgentId);

    int deleted = Entity.getCollectionDAO().agentExecutionDAO().deleteOrphanedRecords(BATCH);

    assertTrue(deleted >= 1, "Expected at least the inserted orphan row to be deleted");
    assertEquals(0, countRowsById("agent_execution_entity", orphanId.toString()));
    assertEquals(1, countRowsById("agent_execution_entity", validId.toString()));
  }

  @Test
  void mcpExecutionOrphans(TestNamespace ns) throws Exception {
    CreateMcpServer createServer =
        new CreateMcpServer()
            .withName("mcpOrph-" + ns.uniqueShortId())
            .withService(MCP_SERVICE_NAME)
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Parent MCP server for orphan cleanup test");
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/mcpServers", createServer, RequestOptions.builder().build());
    McpServer server = MAPPER.readValue(response, McpServer.class);
    assertNotNull(server.getId());

    UUID validId = UUID.randomUUID();
    UUID orphanId = UUID.randomUUID();
    UUID orphanServerId = UUID.randomUUID();

    insertMcpExecution(validId, server.getId());
    insertMcpExecution(orphanId, orphanServerId);

    int deleted = Entity.getCollectionDAO().mcpExecutionDAO().deleteOrphanedRecords(BATCH);

    assertTrue(deleted >= 1, "Expected at least the inserted orphan row to be deleted");
    assertEquals(0, countRowsById("mcp_execution_entity", orphanId.toString()));
    assertEquals(1, countRowsById("mcp_execution_entity", validId.toString()));
  }

  @Test
  void testCaseResolutionStatusOrphans(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, "tcrs");
    TestCase testCase = createTestCase(table, "tcrsCase_" + ns.uniqueShortId());

    CreateTestCaseResolutionStatus createStatus =
        new CreateTestCaseResolutionStatus()
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)
            .withTestCaseReference(testCase.getFullyQualifiedName());
    TestCaseResolutionStatus validStatus = client.testCaseResolutionStatuses().create(createStatus);
    assertNotNull(validStatus.getId());

    UUID orphanId = UUID.randomUUID();
    UUID orphanStateId = UUID.randomUUID();
    insertResolutionStatus(orphanId, orphanStateId, testCase);

    int deleted =
        Entity.getCollectionDAO()
            .testCaseResolutionStatusTimeSeriesDao()
            .deleteOrphanedRecords(BATCH);

    assertTrue(deleted >= 1, "Expected at least the inserted orphan row to be deleted");
    assertEquals(0, countRowsById("test_case_resolution_status_time_series", orphanId.toString()));
    assertEquals(
        1,
        countRowsById("test_case_resolution_status_time_series", validStatus.getId().toString()));
  }

  @Test
  void profilerDataOrphans(TestNamespace ns) throws Exception {
    Table table = createTable(ns, "prof");
    String validFqn = table.getFullyQualifiedName();
    String orphanFqn = "orphanTbl_" + ns.uniqueShortId() + ".profile";

    String validJson =
        String.format("{\"timestamp\":%d,\"rowCount\":42}", System.currentTimeMillis());
    String orphanJson =
        String.format("{\"timestamp\":%d,\"rowCount\":7}", System.currentTimeMillis());

    Entity.getCollectionDAO()
        .profilerDataTimeSeriesDao()
        .insert(validFqn, "table.tableProfile", "tableProfile", validJson);
    Entity.getCollectionDAO()
        .profilerDataTimeSeriesDao()
        .insert(orphanFqn, "table.tableProfile", "tableProfile", orphanJson);

    int deleted =
        Entity.getCollectionDAO().profilerDataTimeSeriesDao().deleteOrphanedRecords(BATCH);

    assertTrue(deleted >= 1, "Expected at least the inserted orphan row to be deleted");
    assertEquals(
        0,
        countRowsByFqnHash("profiler_data_time_series", FullyQualifiedName.buildHash(orphanFqn)));
    assertTrue(
        countRowsByFqnHash("profiler_data_time_series", FullyQualifiedName.buildHash(validFqn))
            >= 1,
        "Valid profiler row must be preserved");
  }

  @Test
  void queryCostOrphans(TestNamespace ns) throws Exception {
    Query query = createQuery(ns, "qc");
    String validFqn = query.getFullyQualifiedName();
    String orphanFqn = "orphanQc_" + ns.uniqueShortId();

    String validJson =
        String.format(
            "{\"id\":\"%s\",\"timestamp\":%d,\"cost\":1.5,\"count\":3}",
            UUID.randomUUID(), System.currentTimeMillis());
    UUID orphanRowId = UUID.randomUUID();
    String orphanJson =
        String.format(
            "{\"id\":\"%s\",\"timestamp\":%d,\"cost\":2.5,\"count\":1}",
            orphanRowId, System.currentTimeMillis());

    Entity.getCollectionDAO()
        .queryCostRecordTimeSeriesDAO()
        .insert(validFqn, "queryCostRecord", validJson);
    Entity.getCollectionDAO()
        .queryCostRecordTimeSeriesDAO()
        .insert(orphanFqn, "queryCostRecord", orphanJson);

    int deleted =
        Entity.getCollectionDAO().queryCostRecordTimeSeriesDAO().deleteOrphanedRecords(BATCH);

    assertTrue(deleted >= 1, "Expected at least the inserted orphan row to be deleted");
    assertEquals(0, countRowsById("query_cost_time_series", orphanRowId.toString()));
    assertTrue(
        countRowsByFqnHash("query_cost_time_series", FullyQualifiedName.buildHash(validFqn)) >= 1,
        "Valid query-cost row must be preserved");
  }

  private void insertAgentExecution(UUID id, UUID agentId) {
    String json =
        String.format(
            "{\"id\":\"%s\",\"agentId\":\"%s\",\"timestamp\":%d,\"status\":\"Success\","
                + "\"agent\":{\"id\":\"%s\",\"type\":\"aiApplication\"}}",
            id, agentId, System.currentTimeMillis(), agentId);
    Entity.getCollectionDAO().agentExecutionDAO().insertWithoutExtension(null, "", "", json);
  }

  private void insertMcpExecution(UUID id, UUID serverId) {
    String json =
        String.format(
            "{\"id\":\"%s\",\"serverId\":\"%s\",\"timestamp\":%d,\"status\":\"Success\","
                + "\"server\":{\"id\":\"%s\",\"type\":\"mcpServer\"}}",
            id, serverId, System.currentTimeMillis(), serverId);
    Entity.getCollectionDAO()
        .mcpExecutionDAO()
        .insertWithoutExtension("mcp_execution_entity", "", "", json);
  }

  private void insertResolutionStatus(UUID id, UUID stateId, TestCase testCase) {
    String json =
        String.format(
            "{\"id\":\"%s\",\"stateId\":\"%s\",\"timestamp\":%d,"
                + "\"testCaseResolutionStatusType\":\"New\","
                + "\"testCaseReference\":{\"id\":\"%s\",\"type\":\"testCase\","
                + "\"fullyQualifiedName\":\"%s\"}}",
            id,
            stateId,
            System.currentTimeMillis(),
            testCase.getId(),
            testCase.getFullyQualifiedName());
    Entity.getCollectionDAO()
        .testCaseResolutionStatusTimeSeriesDao()
        .insert(testCase.getFullyQualifiedName(), Entity.TEST_CASE_RESOLUTION_STATUS, json);
  }

  private Table createTable(TestNamespace ns, String prefix) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.uniqueShortId();
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(prefix + "Db_" + id)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(prefix + "Sc_" + id)
                    .withDatabase(database.getFullyQualifiedName()));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(prefix + "Tb_" + id)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private TestCase createTestCase(Table table, String name) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String testDefFqn =
        client
            .testDefinitions()
            .list(new ListParams().withLimit(1))
            .getData()
            .get(0)
            .getFullyQualifiedName();
    CreateTestCase createTestCase =
        new CreateTestCase()
            .withName(name)
            .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + "::columns::id>")
            .withTestDefinition(testDefFqn);
    return client.testCases().create(createTestCase);
  }

  private Query createQuery(TestNamespace ns, String prefix) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, prefix);
    return client
        .queries()
        .create(
            new CreateQuery()
                .withName(prefix + "Q_" + ns.uniqueShortId())
                .withQuery("SELECT 1")
                .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName())
                .withQueryUsedIn(List.of(table.getEntityReference())));
  }

  private int countRowsById(String table, String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM " + table + " WHERE id = :id")
                    .bind("id", id)
                    .mapTo(Integer.class)
                    .one());
  }

  private int countRowsByFqnHash(String table, String fqnHash) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM " + table + " WHERE entityFQNHash = :h")
                    .bind("h", fqnHash)
                    .mapTo(Integer.class)
                    .one());
  }
}
