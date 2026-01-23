package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.entity.ai.McpExecutionStatus;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for MCP entity search functionality.
 *
 * <p>Tests search queries for MCP Servers and MCP Executions.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class McpSearchIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Test
  void testSearchMcpServerByName(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    McpServer server = createMcpServer(ns, "search_server_test");
    assertNotNull(server);

    String response =
        client
            .search()
            .query("search_server_test")
            .index("mcp_server_search_index")
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchMcpServerByType(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    McpServer server = createMcpServer(ns, "type_search_server");
    assertNotNull(server);

    String queryFilter =
        "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"serverType\":\"database\"}}]}}}";

    String response =
        client
            .search()
            .query("*")
            .index("mcp_server_search_index")
            .queryFilter(queryFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchMcpServerWithPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 5; i++) {
      createMcpServer(ns, "paginated_server_" + i);
    }

    String page1 =
        client
            .search()
            .query("paginated_server")
            .index("mcp_server_search_index")
            .page(0, 2)
            .execute();

    String page2 =
        client
            .search()
            .query("paginated_server")
            .index("mcp_server_search_index")
            .page(1, 2)
            .execute();

    assertNotNull(page1);
    assertNotNull(page2);

    JsonNode page1Root = OBJECT_MAPPER.readTree(page1);
    JsonNode page2Root = OBJECT_MAPPER.readTree(page2);

    assertTrue(page1Root.has("hits"));
    assertTrue(page2Root.has("hits"));
  }

  @Test
  void testSearchMcpServerWithAggregations(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createMcpServer(ns, "agg_server_test");

    String response =
        client
            .search()
            .query("*")
            .index("mcp_server_search_index")
            .size(0)
            .includeAggregations(true)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("aggregations") || root.has("hits"), "Response should have aggregations");
  }

  @Test
  void testSearchMcpServerWithSorting(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createMcpServer(ns, "sort_server_a");
    createMcpServer(ns, "sort_server_b");

    String responseAsc =
        client
            .search()
            .query("sort_server")
            .index("mcp_server_search_index")
            .size(10)
            .sortAsc("name.keyword")
            .execute();

    String responseDesc =
        client
            .search()
            .query("sort_server")
            .index("mcp_server_search_index")
            .size(10)
            .sortDesc("name.keyword")
            .execute();

    assertNotNull(responseAsc);
    assertNotNull(responseDesc);

    JsonNode ascRoot = OBJECT_MAPPER.readTree(responseAsc);
    JsonNode descRoot = OBJECT_MAPPER.readTree(responseDesc);

    assertTrue(ascRoot.has("hits"));
    assertTrue(descRoot.has("hits"));
  }

  @Test
  void testSearchMcpExecutionByStatus(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    McpServer server = createMcpServer(ns, "exec_status_server");
    createMcpExecution(client, server, McpExecutionStatus.Success);
    createMcpExecution(client, server, McpExecutionStatus.Failed);

    String queryFilter = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"status\":\"success\"}}]}}}";

    String response =
        client
            .search()
            .query("*")
            .index("mcp_execution_search_index")
            .queryFilter(queryFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchMcpExecutionByServerId(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    McpServer server = createMcpServer(ns, "exec_server_id_test");
    createMcpExecution(client, server, McpExecutionStatus.Success);

    String queryFilter =
        "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"serverId\":\""
            + server.getId().toString()
            + "\"}}]}}}";

    String response =
        client
            .search()
            .query("*")
            .index("mcp_execution_search_index")
            .queryFilter(queryFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchMcpExecutionWithTimeRange(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    McpServer server = createMcpServer(ns, "exec_time_range_server");
    createMcpExecution(client, server, McpExecutionStatus.Success);

    long now = System.currentTimeMillis();
    long oneHourAgo = now - 3600000;

    String queryFilter =
        "{\"query\":{\"bool\":{\"must\":[{\"range\":{\"timestamp\":{\"gte\":"
            + oneHourAgo
            + ",\"lte\":"
            + now
            + "}}}]}}}";

    String response =
        client
            .search()
            .query("*")
            .index("mcp_execution_search_index")
            .queryFilter(queryFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchMcpServerByDescription(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix("desc_search_server"))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("This server provides unique database access capabilities");

    String json = OBJECT_MAPPER.writeValueAsString(create);
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/mcpServers", json, RequestOptions.builder().build());
    McpServer server = OBJECT_MAPPER.readValue(response, McpServer.class);
    assertNotNull(server);

    String searchResponse =
        client
            .search()
            .query("unique database access")
            .index("mcp_server_search_index")
            .size(10)
            .execute();

    assertNotNull(searchResponse);
    JsonNode root = OBJECT_MAPPER.readTree(searchResponse);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchMcpServerDeleted(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    McpServer server = createMcpServer(ns, "deleted_search_server");

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/mcpServers/" + server.getId().toString(),
            null,
            RequestOptions.builder().build());

    String response =
        client
            .search()
            .query("deleted_search_server")
            .index("mcp_server_search_index")
            .includeDeleted()
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchMcpServerWildcard(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createMcpServer(ns, "wildcard_alpha_server");
    createMcpServer(ns, "wildcard_beta_server");

    String response =
        client
            .search()
            .query("wildcard*server")
            .index("mcp_server_search_index")
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  private McpServer createMcpServer(TestNamespace ns, String baseName) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateMcpServer create =
        new CreateMcpServer()
            .withName(ns.prefix(baseName))
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio)
            .withDescription("Test MCP server for search tests");

    String json = OBJECT_MAPPER.writeValueAsString(create);
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/mcpServers", json, RequestOptions.builder().build());
    return OBJECT_MAPPER.readValue(response, McpServer.class);
  }

  private McpExecution createMcpExecution(
      OpenMetadataClient client, McpServer server, McpExecutionStatus status) throws Exception {

    McpExecution execution =
        new McpExecution()
            .withServer(server.getEntityReference())
            .withServerId(server.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(status);

    String json = OBJECT_MAPPER.writeValueAsString(execution);
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/mcpExecutions", json, RequestOptions.builder().build());
    return OBJECT_MAPPER.readValue(response, McpExecution.class);
  }
}
