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
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.entity.ai.McpComplianceCheckRecord;
import org.openmetadata.schema.entity.ai.McpComplianceSeverity;
import org.openmetadata.schema.entity.ai.McpDataAccessRecord;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.entity.ai.McpExecutionMetrics;
import org.openmetadata.schema.entity.ai.McpExecutionStatus;
import org.openmetadata.schema.entity.ai.McpResourceAccessRecord;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpToolCallRecord;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for MCP Execution time-series entity using direct REST API calls.
 *
 * <p>Tests MCP Execution CRUD operations, including creation, listing with filters, deletion by
 * timestamp, and verification of execution tracking for audit trails.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class McpExecutionResourceIT {

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll
  public static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void testCreateMcpExecution(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpExecution created = createExecution(execution);

    assertNotNull(created);
    assertNotNull(created.getId());
    assertEquals(server.getId(), created.getServerId());
    assertEquals(McpExecutionStatus.Success, created.getStatus());
  }

  @Test
  void testCreateMcpExecutionWithToolCalls(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long timestamp = System.currentTimeMillis();

    McpToolCallRecord toolCall =
        new McpToolCallRecord()
            .withToolName("query_database")
            .withResult("{\"rows\": 100}")
            .withSuccess(true)
            .withLatencyMs(150.0);

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp)
            .withStatus(McpExecutionStatus.Success)
            .withToolCalls(List.of(toolCall));

    McpExecution created = createExecution(execution);

    assertNotNull(created);
    assertNotNull(created.getToolCalls());
    assertEquals(1, created.getToolCalls().size());
    assertEquals("query_database", created.getToolCalls().get(0).getToolName());
    assertTrue(created.getToolCalls().get(0).getSuccess());
  }

  @Test
  void testCreateMcpExecutionWithResourceAccesses(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long timestamp = System.currentTimeMillis();

    McpResourceAccessRecord resourceAccess =
        new McpResourceAccessRecord().withResourceUri("file:///etc/config.json").withSuccess(true);

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp)
            .withStatus(McpExecutionStatus.Success)
            .withResourceAccesses(List.of(resourceAccess));

    McpExecution created = createExecution(execution);

    assertNotNull(created);
    assertNotNull(created.getResourceAccesses());
    assertEquals(1, created.getResourceAccesses().size());
    assertEquals("file:///etc/config.json", created.getResourceAccesses().get(0).getResourceUri());
  }

  @Test
  void testCreateMcpExecutionWithDataAccess(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long timestamp = System.currentTimeMillis();

    McpDataAccessRecord dataAccess =
        new McpDataAccessRecord().withRecordCount(100).withPiiAccessed(true);

    McpToolCallRecord toolCall =
        new McpToolCallRecord()
            .withToolName("read_users")
            .withSuccess(true)
            .withDataAccessed(List.of(dataAccess));

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp)
            .withStatus(McpExecutionStatus.Success)
            .withToolCalls(List.of(toolCall));

    McpExecution created = createExecution(execution);

    assertNotNull(created);
    assertNotNull(created.getToolCalls().get(0).getDataAccessed());
    assertTrue(created.getToolCalls().get(0).getDataAccessed().get(0).getPiiAccessed());
  }

  @Test
  void testCreateMcpExecutionWithComplianceChecks(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long timestamp = System.currentTimeMillis();

    McpComplianceCheckRecord complianceCheck =
        new McpComplianceCheckRecord()
            .withCheckName("data_access_authorization")
            .withPassed(true)
            .withDetails("User has required permissions")
            .withSeverity(McpComplianceSeverity.Info);

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp)
            .withStatus(McpExecutionStatus.Success)
            .withComplianceChecks(List.of(complianceCheck));

    McpExecution created = createExecution(execution);

    assertNotNull(created);
    assertNotNull(created.getComplianceChecks());
    assertEquals(1, created.getComplianceChecks().size());
    assertEquals("data_access_authorization", created.getComplianceChecks().get(0).getCheckName());
    assertTrue(created.getComplianceChecks().get(0).getPassed());
  }

  @Test
  void testCreateMcpExecutionWithMetrics(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long timestamp = System.currentTimeMillis();

    McpExecutionMetrics metrics =
        new McpExecutionMetrics()
            .withTotalToolCalls(5)
            .withSuccessfulToolCalls(4)
            .withTotalResourceAccesses(3);

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp)
            .withStatus(McpExecutionStatus.Success)
            .withMetrics(metrics);

    McpExecution created = createExecution(execution);

    assertNotNull(created);
    assertNotNull(created.getMetrics());
    assertEquals(5, created.getMetrics().getTotalToolCalls());
    assertEquals(4, created.getMetrics().getSuccessfulToolCalls());
  }

  @Test
  void testGetMcpExecutionById(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpExecution created = createExecution(execution);
    McpExecution fetched = getExecution(created.getId().toString());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getServerId(), fetched.getServerId());
  }

  @Test
  void testListMcpExecutions(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long baseTimestamp = System.currentTimeMillis();

    for (int i = 0; i < 3; i++) {
      McpExecution execution =
          new McpExecution()
              .withServer(server.getEntityReference())
              .withServerId(server.getId())
              .withTimestamp(baseTimestamp + (i * 1000))
              .withStatus(McpExecutionStatus.Success);
      createExecution(execution);
    }

    McpExecutionList executions = listExecutions(null, null, null, 100);

    assertNotNull(executions);
    assertNotNull(executions.getData());
    assertTrue(executions.getData().size() >= 3, "Should have at least 3 executions");
  }

  @Test
  void testListMcpExecutionsByServerId(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long baseTimestamp = System.currentTimeMillis();

    for (int i = 0; i < 2; i++) {
      McpExecution execution =
          new McpExecution()
              .withServer(server.getEntityReference())
              .withServerId(server.getId())
              .withTimestamp(baseTimestamp + (i * 1000))
              .withStatus(McpExecutionStatus.Success);
      createExecution(execution);
    }

    McpExecutionList executions = listExecutions(server.getId(), null, null, 100);

    assertNotNull(executions);
    assertNotNull(executions.getData());
  }

  @Test
  void testListMcpExecutionsWithTimeRange(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long startTimestamp = System.currentTimeMillis();

    McpExecution execution1 =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(startTimestamp)
            .withStatus(McpExecutionStatus.Success);

    McpExecution execution2 =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(startTimestamp + 5000)
            .withStatus(McpExecutionStatus.Success);

    createExecution(execution1);
    createExecution(execution2);

    McpExecutionList executions =
        listExecutions(server.getId(), startTimestamp - 1000, startTimestamp + 2000, 100);

    assertNotNull(executions);
    assertNotNull(executions.getData());
  }

  @Test
  void testExecutionStatusTracking(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long timestamp = System.currentTimeMillis();

    McpExecution successExecution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp)
            .withStatus(McpExecutionStatus.Success);

    McpExecution failedExecution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp + 1000)
            .withStatus(McpExecutionStatus.Failed);

    McpExecution runningExecution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp + 2000)
            .withStatus(McpExecutionStatus.Running);

    McpExecution createdSuccess = createExecution(successExecution);
    McpExecution createdFailed = createExecution(failedExecution);
    McpExecution createdRunning = createExecution(runningExecution);

    assertEquals(McpExecutionStatus.Success, createdSuccess.getStatus());
    assertEquals(McpExecutionStatus.Failed, createdFailed.getStatus());
    assertEquals(McpExecutionStatus.Running, createdRunning.getStatus());
  }

  @Test
  void testDeleteMcpExecutionByTimestamp(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long timestamp = System.currentTimeMillis();

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp)
            .withStatus(McpExecutionStatus.Success);

    createExecution(execution);

    deleteExecutionByTimestamp(server.getId(), timestamp);

    McpExecutionList executions = listExecutions(server.getId(), timestamp, timestamp, 100);
    assertNotNull(executions);
    assertEquals(0, executions.getData().size(), "Execution should have been deleted");
  }

  @Test
  void testDeleteMcpExecutionById(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpExecution created = createExecution(execution);
    deleteExecutionById(created.getId().toString(), false);
  }

  @Test
  void testMcpExecutionAuditTrail(TestNamespace ns) throws Exception {
    McpServer server = createTestMcpServer(ns);
    long timestamp = System.currentTimeMillis();

    McpToolCallRecord toolCall1 =
        new McpToolCallRecord()
            .withToolName("read_data")
            .withResult("{\"count\": 1000}")
            .withSuccess(true)
            .withLatencyMs(200.0);

    McpToolCallRecord toolCall2 =
        new McpToolCallRecord().withToolName("write_data").withSuccess(true).withLatencyMs(50.0);

    McpResourceAccessRecord resourceAccess =
        new McpResourceAccessRecord()
            .withResourceUri("jdbc:mysql://localhost:3306/db")
            .withSuccess(true);

    McpComplianceCheckRecord complianceCheck =
        new McpComplianceCheckRecord()
            .withCheckName("data_classification_check")
            .withPassed(true)
            .withDetails("All accessed data is classified appropriately")
            .withSeverity(McpComplianceSeverity.Info);

    McpExecutionMetrics metrics =
        new McpExecutionMetrics()
            .withTotalToolCalls(2)
            .withSuccessfulToolCalls(2)
            .withTotalResourceAccesses(1);

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(timestamp)
            .withStatus(McpExecutionStatus.Success)
            .withToolCalls(List.of(toolCall1, toolCall2))
            .withResourceAccesses(List.of(resourceAccess))
            .withComplianceChecks(List.of(complianceCheck))
            .withMetrics(metrics);

    McpExecution created = createExecution(execution);

    assertNotNull(created);
    assertEquals(2, created.getToolCalls().size());
    assertEquals(1, created.getResourceAccesses().size());
    assertEquals(1, created.getComplianceChecks().size());
    assertNotNull(created.getMetrics());
    assertEquals(2, created.getMetrics().getTotalToolCalls());
  }

  private McpServer createTestMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer createServer =
        new CreateMcpServer()
            .withName(
                ns.prefix("exec-test-server") + "-" + UUID.randomUUID().toString().substring(0, 8))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Test server for execution tests");

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/mcpServers", createServer, RequestOptions.builder().build());

    return MAPPER.readValue(response, McpServer.class);
  }

  private McpExecution createExecution(McpExecution execution) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/mcpExecutions", execution, RequestOptions.builder().build());

    return MAPPER.readValue(response, McpExecution.class);
  }

  private McpExecution getExecution(String id) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/mcpExecutions/" + id, null, RequestOptions.builder().build());

    return MAPPER.readValue(response, McpExecution.class);
  }

  private McpExecutionList listExecutions(UUID serverId, Long startTs, Long endTs, int limit)
      throws Exception {
    RequestOptions.Builder optionsBuilder =
        RequestOptions.builder().queryParam("limit", String.valueOf(limit));

    if (serverId != null) {
      optionsBuilder.queryParam("serverId", serverId.toString());
    }
    if (startTs != null) {
      optionsBuilder.queryParam("startTs", startTs.toString());
    }
    if (endTs != null) {
      optionsBuilder.queryParam("endTs", endTs.toString());
    }

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/mcpExecutions", null, optionsBuilder.build());

    return MAPPER.readValue(response, McpExecutionList.class);
  }

  private void deleteExecutionByTimestamp(UUID serverId, Long timestamp) throws Exception {
    try {
      SdkClients.adminClient()
          .getHttpClient()
          .executeForString(
              HttpMethod.DELETE,
              "/v1/mcpExecutions/" + serverId + "/" + timestamp,
              null,
              RequestOptions.builder().build());
    } catch (Exception e) {
      // Ignore exceptions for deletion
    }
  }

  private void deleteExecutionById(String id, boolean hardDelete) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/mcpExecutions/" + id,
            null,
            RequestOptions.builder().queryParam("hardDelete", String.valueOf(hardDelete)).build());
  }

  public static class McpExecutionList {
    private List<McpExecution> data;
    private Paging paging;

    public List<McpExecution> getData() {
      return data;
    }

    public void setData(List<McpExecution> data) {
      this.data = data;
    }

    public Paging getPaging() {
      return paging;
    }

    public void setPaging(Paging paging) {
      this.paging = paging;
    }
  }

  public static class Paging {
    private Integer total;
    private String after;
    private String before;

    public Integer getTotal() {
      return total;
    }

    public void setTotal(Integer total) {
      this.total = total;
    }

    public String getAfter() {
      return after;
    }

    public void setAfter(String after) {
      this.after = after;
    }

    public String getBefore() {
      return before;
    }

    public void setBefore(String before) {
      this.before = before;
    }
  }
}
