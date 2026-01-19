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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.entity.ai.McpDevelopmentStage;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpPrompt;
import org.openmetadata.schema.entity.ai.McpResource;
import org.openmetadata.schema.entity.ai.McpResourceType;
import org.openmetadata.schema.entity.ai.McpRiskLevel;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerCapabilities;
import org.openmetadata.schema.entity.ai.McpServerInfo;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTool;
import org.openmetadata.schema.entity.ai.McpToolCategory;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for MCP Server entity using direct REST API calls.
 *
 * <p>Tests MCP Server CRUD operations, governance metadata, tools, resources, and prompts
 * management through the /v1/mcpServers API endpoints.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class McpServerResourceIT {

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll
  public static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void testCreateMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-server"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Test MCP Server for integration testing");

    McpServer created = createMcpServer(create);

    assertNotNull(created);
    assertNotNull(created.getId());
    assertEquals(ns.prefix("mcp-server"), created.getName());
    assertEquals(McpServerType.DataAccess, created.getServerType());
    assertEquals(McpTransportType.Stdio, created.getTransportType());
    assertEquals("Test MCP Server for integration testing", created.getDescription());
    assertNotNull(created.getFullyQualifiedName());
  }

  @Test
  void testCreateMcpServerWithAllFields(TestNamespace ns) throws Exception {
    McpServerInfo serverInfo =
        new McpServerInfo()
            .withServerName("Test Server")
            .withServerVersion("1.0.0")
            .withVendor("OpenMetadata");

    McpServerCapabilities capabilities =
        new McpServerCapabilities()
            .withToolsSupported(true)
            .withResourcesSupported(true)
            .withPromptsSupported(true)
            .withLoggingSupported(true);

    McpGovernanceMetadata governance =
        new McpGovernanceMetadata()
            .withRegistrationStatus(McpGovernanceMetadata.RegistrationStatus.REGISTERED);

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-full"))
            .withDisplayName("Full Test MCP Server")
            .withDescription("MCP Server with all fields populated")
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.SSE)
            .withProtocolVersion("2024-11-05")
            .withDevelopmentStage(McpDevelopmentStage.Production)
            .withServerInfo(serverInfo)
            .withCapabilities(capabilities)
            .withGovernanceMetadata(governance);

    McpServer created = createMcpServer(create);

    assertNotNull(created);
    assertEquals("Full Test MCP Server", created.getDisplayName());
    assertEquals(McpServerType.Database, created.getServerType());
    assertEquals(McpTransportType.SSE, created.getTransportType());
    assertEquals("2024-11-05", created.getProtocolVersion());
    assertEquals(McpDevelopmentStage.Production, created.getDevelopmentStage());
    assertNotNull(created.getServerInfo());
    assertEquals("Test Server", created.getServerInfo().getServerName());
    assertNotNull(created.getCapabilities());
    assertTrue(created.getCapabilities().getToolsSupported());
  }

  @Test
  void testCreateMcpServerWithTools(TestNamespace ns) throws Exception {
    McpTool tool =
        new McpTool()
            .withName("query_database")
            .withDescription("Execute SQL queries against database")
            .withToolCategory(McpToolCategory.DatabaseOperation)
            .withRiskLevel(McpRiskLevel.Medium)
            .withSideEffects(false)
            .withIdempotent(true);

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-with-tools"))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("MCP Server with tools")
            .withTools(List.of(tool));

    McpServer created = createMcpServer(create);

    assertNotNull(created);
    assertNotNull(created.getTools());
    assertEquals(1, created.getTools().size());
    assertEquals("query_database", created.getTools().get(0).getName());
    assertEquals(McpToolCategory.DatabaseOperation, created.getTools().get(0).getToolCategory());
    assertEquals(McpRiskLevel.Medium, created.getTools().get(0).getRiskLevel());
  }

  @Test
  void testCreateMcpServerWithResources(TestNamespace ns) throws Exception {
    McpResource resource =
        new McpResource()
            .withName("config_file")
            .withDescription("Configuration file resource")
            .withResourceType(McpResourceType.File)
            .withUri("file:///etc/config.json")
            .withMimeType("application/json")
            .withAccessLevel(McpResource.AccessLevel.READ_ONLY);

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-with-resources"))
            .withServerType(McpServerType.FileSystem)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("MCP Server with resources")
            .withResources(List.of(resource));

    McpServer created = createMcpServer(create);

    assertNotNull(created);
    assertNotNull(created.getResources());
    assertEquals(1, created.getResources().size());
    assertEquals("config_file", created.getResources().get(0).getName());
    assertEquals(McpResourceType.File, created.getResources().get(0).getResourceType());
  }

  @Test
  void testCreateMcpServerWithPrompts(TestNamespace ns) throws Exception {
    McpPrompt prompt =
        new McpPrompt()
            .withName("analyze_data")
            .withDescription("Analyze data and provide insights");

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-with-prompts"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Streamable)
            .withDescription("MCP Server with prompts")
            .withPrompts(List.of(prompt));

    McpServer created = createMcpServer(create);

    assertNotNull(created);
    assertNotNull(created.getPrompts());
    assertEquals(1, created.getPrompts().size());
    assertEquals("analyze_data", created.getPrompts().get(0).getName());
  }

  @Test
  void testGetMcpServerById(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-get-by-id"))
            .withServerType(McpServerType.WebAPI)
            .withTransportType(McpTransportType.SSE)
            .withDescription("Test server for get by ID");

    McpServer created = createMcpServer(create);
    McpServer fetched = getMcpServer(created.getId().toString());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void testGetMcpServerByName(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-get-by-name"))
            .withServerType(McpServerType.Cloud)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Test server for get by name");

    McpServer created = createMcpServer(create);
    McpServer fetched = getMcpServerByName(created.getFullyQualifiedName());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void testListMcpServers(TestNamespace ns) throws Exception {
    createMcpServer(
        new CreateMcpServer()
            .withName(ns.prefix("mcp-list-1"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("List test server 1"));

    createMcpServer(
        new CreateMcpServer()
            .withName(ns.prefix("mcp-list-2"))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.SSE)
            .withDescription("List test server 2"));

    McpServerList servers = listMcpServers(100);

    assertNotNull(servers);
    assertNotNull(servers.getData());
    assertTrue(servers.getData().size() >= 2, "Should have at least 2 servers");
  }

  @Test
  void testListMcpServersWithLimit(TestNamespace ns) throws Exception {
    createMcpServer(
        new CreateMcpServer()
            .withName(ns.prefix("mcp-limit-1"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Limit test server 1"));

    createMcpServer(
        new CreateMcpServer()
            .withName(ns.prefix("mcp-limit-2"))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.SSE)
            .withDescription("Limit test server 2"));

    McpServerList servers = listMcpServers(1);

    assertNotNull(servers);
    assertNotNull(servers.getData());
    assertTrue(servers.getData().size() >= 1);
  }

  @Test
  void testUpdateMcpServerDescription(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-update-desc"))
            .withServerType(McpServerType.Security)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Initial description");

    McpServer created = createMcpServer(create);

    CreateMcpServer update =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-update-desc"))
            .withServerType(McpServerType.Security)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Updated description");

    McpServer updated = updateMcpServer(update);

    assertNotNull(updated);
    assertEquals("Updated description", updated.getDescription());
    assertTrue(updated.getVersion() > created.getVersion());
  }

  @Test
  void testUpdateMcpServerDisplayName(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-update-display"))
            .withServerType(McpServerType.Custom)
            .withTransportType(McpTransportType.Streamable)
            .withDisplayName("Initial Display Name")
            .withDescription("Test server");

    McpServer created = createMcpServer(create);

    CreateMcpServer update =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-update-display"))
            .withServerType(McpServerType.Custom)
            .withTransportType(McpTransportType.Streamable)
            .withDisplayName("Updated Display Name")
            .withDescription("Test server");

    McpServer updated = updateMcpServer(update);

    assertNotNull(updated);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void testUpdateMcpServerAddTools(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-add-tools"))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Server without tools initially");

    createMcpServer(create);

    McpTool tool =
        new McpTool()
            .withName("new_tool")
            .withDescription("Newly added tool")
            .withToolCategory(McpToolCategory.DataOperation)
            .withRiskLevel(McpRiskLevel.Low);

    CreateMcpServer update =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-add-tools"))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Server without tools initially")
            .withTools(List.of(tool));

    McpServer updated = updateMcpServer(update);

    assertNotNull(updated);
    assertNotNull(updated.getTools());
    assertEquals(1, updated.getTools().size());
    assertEquals("new_tool", updated.getTools().get(0).getName());
  }

  @Test
  void testDeleteMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-delete"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Server to delete");

    McpServer created = createMcpServer(create);
    deleteMcpServer(created.getId().toString(), false);

    assertThrows(
        Exception.class,
        () -> getMcpServer(created.getId().toString()),
        "Deleted server should not be retrievable");
  }

  @Test
  void testHardDeleteMcpServer(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-hard-delete"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Server to hard delete");

    McpServer created = createMcpServer(create);
    deleteMcpServer(created.getId().toString(), true);

    assertThrows(
        Exception.class,
        () -> getMcpServer(created.getId().toString()),
        "Hard deleted server should not be retrievable");
  }

  @Test
  void testMcpServerVersioning(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-version"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Initial version");

    McpServer created = createMcpServer(create);
    assertEquals(0.1, created.getVersion(), 0.001);

    CreateMcpServer update =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-version"))
            .withServerType(McpServerType.DataAccess)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Updated version");

    McpServer updated = updateMcpServer(update);
    assertEquals(0.2, updated.getVersion(), 0.001);
  }

  @Test
  void testMcpServerGovernanceMetadata(TestNamespace ns) throws Exception {
    McpGovernanceMetadata governance =
        new McpGovernanceMetadata()
            .withRegistrationStatus(McpGovernanceMetadata.RegistrationStatus.PENDING_APPROVAL)
            .withIntakeNotes("Pending security review");

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-governance"))
            .withServerType(McpServerType.Security)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Server with governance metadata")
            .withGovernanceMetadata(governance);

    McpServer created = createMcpServer(create);

    assertNotNull(created.getGovernanceMetadata());
    assertEquals(
        McpGovernanceMetadata.RegistrationStatus.PENDING_APPROVAL,
        created.getGovernanceMetadata().getRegistrationStatus());
    assertEquals("Pending security review", created.getGovernanceMetadata().getIntakeNotes());
  }

  @Test
  void testMcpServerShadowAIDetection(TestNamespace ns) throws Exception {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-shadow-ai"))
            .withServerType(McpServerType.Custom)
            .withTransportType(McpTransportType.Stdio)
            .withDevelopmentStage(McpDevelopmentStage.Unauthorized)
            .withDescription("Unauthorized/Shadow AI server");

    McpServer created = createMcpServer(create);

    assertNotNull(created);
    assertEquals(
        McpDevelopmentStage.Unauthorized,
        created.getDevelopmentStage(),
        "Should mark server as unauthorized for shadow AI detection");
  }

  @Test
  void testMcpServerWithMultipleTools(TestNamespace ns) throws Exception {
    McpTool tool1 =
        new McpTool()
            .withName("read_data")
            .withDescription("Read data from source")
            .withToolCategory(McpToolCategory.DataOperation)
            .withRiskLevel(McpRiskLevel.Low)
            .withSideEffects(false);

    McpTool tool2 =
        new McpTool()
            .withName("write_data")
            .withDescription("Write data to destination")
            .withToolCategory(McpToolCategory.DataOperation)
            .withRiskLevel(McpRiskLevel.High)
            .withSideEffects(true);

    McpTool tool3 =
        new McpTool()
            .withName("delete_data")
            .withDescription("Delete data from source")
            .withToolCategory(McpToolCategory.DataOperation)
            .withRiskLevel(McpRiskLevel.Critical)
            .withSideEffects(true)
            .withReversible(false);

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("mcp-multi-tools"))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Server with multiple tools")
            .withTools(List.of(tool1, tool2, tool3));

    McpServer created = createMcpServer(create);

    assertNotNull(created.getTools());
    assertEquals(3, created.getTools().size());
  }

  private McpServer createMcpServer(CreateMcpServer create) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/mcpServers", create, RequestOptions.builder().build());
    return MAPPER.readValue(response, McpServer.class);
  }

  private McpServer updateMcpServer(CreateMcpServer update) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT, "/v1/mcpServers", update, RequestOptions.builder().build());
    return MAPPER.readValue(response, McpServer.class);
  }

  private McpServer getMcpServer(String id) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/mcpServers/" + id, null, RequestOptions.builder().build());
    return MAPPER.readValue(response, McpServer.class);
  }

  private McpServer getMcpServerByName(String fqn) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/mcpServers/name/" + fqn,
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, McpServer.class);
  }

  private McpServerList listMcpServers(int limit) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/mcpServers",
                null,
                RequestOptions.builder().queryParam("limit", String.valueOf(limit)).build());
    return MAPPER.readValue(response, McpServerList.class);
  }

  private void deleteMcpServer(String id, boolean hardDelete) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/mcpServers/" + id,
            null,
            RequestOptions.builder().queryParam("hardDelete", String.valueOf(hardDelete)).build());
  }

  public static class McpServerList {
    private List<McpServer> data;
    private Paging paging;

    public List<McpServer> getData() {
      return data;
    }

    public void setData(List<McpServer> data) {
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
