package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;

public class McpIntegrationIT extends McpTestBase {

  private static Table testTable;

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
    testTable = createServiceDatabaseSchemaTable("mcp_it");
  }

  @Test
  void testMcpInitialization() throws Exception {
    Map<String, Object> initRequest = McpTestUtils.createInitializeRequest();
    JsonNode responseJson = executeMcpRequest(initRequest);

    assertThat(responseJson.has("jsonrpc")).isTrue();
    assertThat(responseJson.get("jsonrpc").asText()).isEqualTo("2.0");
    assertThat(responseJson.has("result")).isTrue();

    JsonNode result = responseJson.get("result");
    assertThat(result.has("protocolVersion")).isTrue();
    assertThat(result.has("capabilities")).isTrue();
    assertThat(result.has("serverInfo")).isTrue();
  }

  @Test
  void testMcpToolsList() throws Exception {
    Map<String, Object> toolsListRequest = new HashMap<>();
    toolsListRequest.put("jsonrpc", "2.0");
    toolsListRequest.put("id", UUID.randomUUID().toString());
    toolsListRequest.put("method", "tools/list");

    JsonNode responseJson = executeMcpRequest(toolsListRequest);
    assertThat(responseJson.has("result")).isTrue();

    JsonNode result = responseJson.get("result");
    assertThat(result.has("tools")).isTrue();
    assertThat(result.get("tools").isArray()).isTrue();
    assertThat(result.get("tools").size()).isGreaterThan(0);

    boolean hasSearchTool = false;
    boolean hasGetEntityTool = false;
    for (JsonNode tool : result.get("tools")) {
      String toolName = tool.get("name").asText();
      if ("search_metadata".equals(toolName)) {
        hasSearchTool = true;
      } else if ("get_entity_details".equals(toolName)) {
        hasGetEntityTool = true;
      }
    }
    assertThat(hasSearchTool).isTrue();
    assertThat(hasGetEntityTool).isTrue();
  }

  @Test
  void testMcpPromptsList() throws Exception {
    Map<String, Object> promptsListRequest = new HashMap<>();
    promptsListRequest.put("jsonrpc", "2.0");
    promptsListRequest.put("id", UUID.randomUUID().toString());
    promptsListRequest.put("method", "prompts/list");

    JsonNode responseJson = executeMcpRequest(promptsListRequest);
    assertThat(responseJson.has("result")).isTrue();

    JsonNode result = responseJson.get("result");
    assertThat(result.has("prompts")).isTrue();
    assertThat(result.get("prompts").isArray()).isTrue();
  }

  @Test
  void testGetEntityDetailsSurfacesCustomProperties() throws Exception {
    String propertyName = "mcpCustomProperty";
    String propertyValue = "mcp-value-" + UUID.randomUUID().toString().substring(0, 8);
    addStringCustomProperty(Entity.TABLE, propertyName);

    String jsonPatch =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/extension\",\"value\":{\"%s\":\"%s\"}}]",
            propertyName, propertyValue);
    patch("tables/" + testTable.getId(), jsonPatch);

    Map<String, Object> toolCallRequest =
        McpTestUtils.createGetEntityToolCall(Entity.TABLE, testTable.getFullyQualifiedName());
    JsonNode responseJson = executeMcpRequest(toolCallRequest);

    String responseText = responseJson.get("result").get("content").get(0).get("text").asText();
    assertThat(responseText).contains("extension");
    assertThat(responseText).contains(propertyValue);
  }

  private static void addStringCustomProperty(String entityType, String propertyName)
      throws Exception {
    JsonNode entityTypeNode =
        get("metadata/types/name/" + entityType + "?category=Field", JsonNode.class);
    JsonNode stringTypeNode = get("metadata/types/name/string", JsonNode.class);

    Map<String, Object> propertyType = new HashMap<>();
    propertyType.put("id", stringTypeNode.get("id").asText());
    propertyType.put("type", "type");

    Map<String, Object> customProperty = new HashMap<>();
    customProperty.put("name", propertyName);
    customProperty.put("description", "MCP custom property test");
    customProperty.put("propertyType", propertyType);

    put("metadata/types/" + entityTypeNode.get("id").asText(), customProperty, JsonNode.class);
  }

  @Test
  void testMcpToolCall() throws Exception {
    Map<String, Object> toolCallRequest =
        McpTestUtils.createSearchMetadataToolCall("test", 5, Entity.TABLE);

    JsonNode responseJson = executeMcpRequest(toolCallRequest);
    assertThat(responseJson.has("result")).isTrue();

    JsonNode result = responseJson.get("result");
    assertThat(result.has("content")).isTrue();
    assertThat(result.get("content").isArray()).isTrue();

    JsonNode content = result.get("content");
    assertThat(content.size()).isGreaterThanOrEqualTo(1);
    assertThat(content.get(0).has("type")).isTrue();
    assertThat(content.get(0).get("type").asText()).isEqualTo("text");
  }

  @Test
  @Tag("load")
  @Disabled("Load test - run manually")
  void testConcurrentToolCalls() throws Exception {
    int numberOfCalls = 100;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(numberOfCalls);
    AtomicReference<Exception> firstError = new AtomicReference<>();

    for (int i = 0; i < numberOfCalls; i++) {
      final int callId = i;
      Thread.ofVirtual()
          .start(
              () -> {
                try {
                  startLatch.await();

                  Map<String, Object> toolCallRequest =
                      McpTestUtils.createSearchMetadataToolCall("test" + callId, 5, Entity.TABLE);
                  String requestBody = OBJECT_MAPPER.writeValueAsString(toolCallRequest);

                  HttpRequest request =
                      HttpRequest.newBuilder()
                          .uri(URI.create(getMcpUrl("/mcp")))
                          .header("Content-Type", "application/json")
                          .header("Accept", "application/json, text/event-stream")
                          .header("Authorization", authToken)
                          .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                          .timeout(java.time.Duration.ofSeconds(30))
                          .build();

                  HttpResponse<String> response =
                      HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
                  if (response.statusCode() == 503) {
                    // Server limit reached, acceptable
                  } else if (response.statusCode() == 200) {
                    String jsonContent = extractJsonFromResponse(response.body());
                    JsonNode responseJson = OBJECT_MAPPER.readTree(jsonContent);
                    if (!responseJson.has("result")) {
                      throw new RuntimeException("Missing result in tool call response " + callId);
                    }
                  } else {
                    throw new RuntimeException(
                        "Unexpected response code "
                            + response.statusCode()
                            + " for tool call "
                            + callId);
                  }
                } catch (Exception e) {
                  firstError.compareAndSet(null, e);
                } finally {
                  completionLatch.countDown();
                }
              });
    }

    startLatch.countDown();
    boolean allCompleted = completionLatch.await(30, TimeUnit.SECONDS);
    assertThat(allCompleted).isTrue();

    if (firstError.get() != null) {
      String errorMessage = firstError.get().getMessage();
      boolean isExpectedError =
          errorMessage.contains("503")
              || errorMessage.contains("Service unavailable")
              || errorMessage.contains("timeout");
      assertThat(isExpectedError).isTrue();
    }
  }

  @Test
  @Tag("load")
  @Disabled("Load test - run manually")
  void testComprehensiveMcpToolsLoadTest() throws Exception {
    int totalRequests = 10000;
    int concurrentConnections = 500;
    int requestsPerConnection = totalRequests / concurrentConnections;

    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(concurrentConnections);

    AtomicReference<Exception> firstError = new AtomicReference<>();
    AtomicInteger successfulRequests = new AtomicInteger();
    AtomicInteger failedRequests = new AtomicInteger();

    for (int connectionId = 0; connectionId < concurrentConnections; connectionId++) {
      final int connId = connectionId;
      Thread.ofVirtual()
          .start(
              () -> {
                try {
                  startLatch.await();
                  for (int reqNum = 0; reqNum < requestsPerConnection; reqNum++) {
                    try {
                      Map<String, Object> toolCallRequest;
                      int toolIndex = (connId * requestsPerConnection + reqNum) % 3;
                      switch (toolIndex) {
                        case 0:
                          toolCallRequest =
                              McpTestUtils.createSearchMetadataToolCall("mcp_it", 3, Entity.TABLE);
                          break;
                        case 1:
                          toolCallRequest =
                              McpTestUtils.createGetEntityToolCall(
                                  "table", testTable.getFullyQualifiedName());
                          break;
                        default:
                          toolCallRequest =
                              McpTestUtils.createGetLineageToolCall(
                                  "table", testTable.getFullyQualifiedName(), 2, 2);
                          break;
                      }

                      String requestBody = OBJECT_MAPPER.writeValueAsString(toolCallRequest);
                      HttpRequest request =
                          HttpRequest.newBuilder()
                              .uri(URI.create(getMcpUrl("/mcp")))
                              .header("Content-Type", "application/json")
                              .header("Accept", "application/json, text/event-stream")
                              .header("Authorization", authToken)
                              .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                              .timeout(java.time.Duration.ofSeconds(60))
                              .build();

                      HttpResponse<String> response =
                          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
                      if (response.statusCode() == 200) {
                        successfulRequests.incrementAndGet();
                      } else {
                        failedRequests.incrementAndGet();
                      }
                      Thread.sleep(10);
                    } catch (Exception e) {
                      failedRequests.incrementAndGet();
                      firstError.compareAndSet(null, e);
                    }
                  }
                } catch (Exception e) {
                  failedRequests.addAndGet(requestsPerConnection);
                  firstError.compareAndSet(null, e);
                } finally {
                  completionLatch.countDown();
                }
              });
    }

    startLatch.countDown();
    boolean allCompleted = completionLatch.await(10, TimeUnit.MINUTES);

    assertThat(allCompleted).isTrue();
    assertThat(successfulRequests.get()).isGreaterThan(totalRequests / 2);
  }

  @Test
  void getEntityDetailsIsDeniedByTagBasedPolicy() throws Exception {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    String tagFqn = createRestrictedTag(suffix);
    Table restricted = createServiceDatabaseSchemaTable("mcp_authz_" + suffix);
    tagTable(restricted.getId().toString(), tagFqn);
    String deniedToken = createUserDeniedByTag(suffix, tagFqn);

    Map<String, Object> call =
        McpTestUtils.createGetEntityToolCall(Entity.TABLE, restricted.getFullyQualifiedName());

    // Admin bypasses the policy and sees the table — proves the denial below is real, not a fluke.
    assertThat(executeMcpRequest(call).toString()).contains("created_at");

    // The non-admin is hit by the tag Deny: no entity data must come back.
    assertThat(executeMcpRequest(call, deniedToken).toString()).doesNotContain("created_at");
  }

  /**
   * A Deny whose condition matches the asset's tag must deny lineage as well as details. An
   * unresolved ResourceContext reads the tag as absent, so the Deny never fires and the graph comes
   * back - the fail-open half of #31941.
   */
  @Test
  void lineageToolsHonourTagBasedDeny() throws Exception {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    String tagFqn = createRestrictedTag(suffix);
    Table denied = createServiceDatabaseSchemaTable("mcp_lin_deny_" + suffix);
    tagTable(denied.getId().toString(), tagFqn);
    String token = createUserDeniedByCondition(suffix, String.format("matchAnyTag('%s')", tagFqn));

    assertLineageDenied(denied, token);
  }

  /**
   * The reported case: a Deny on everything *outside* the tagged scope. The tagged asset must stay
   * readable. An unresolved ResourceContext reads every asset as untagged, so the Deny fires on all
   * of them and even the explicitly-allowed one 403s.
   */
  @Test
  void lineageToolsHonourNegatedTagPolicy() throws Exception {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    String tagFqn = createRestrictedTag(suffix);
    Table allowed = createServiceDatabaseSchemaTable("mcp_lin_allow_" + suffix);
    tagTable(allowed.getId().toString(), tagFqn);
    String token = createUserDeniedByCondition(suffix, String.format("!matchAnyTag('%s')", tagFqn));

    JsonNode lineage =
        executeMcpRequest(
            McpTestUtils.createGetLineageToolCall(
                Entity.TABLE, allowed.getFullyQualifiedName(), 1, 1),
            token);
    assertThat(lineage.toString())
        .as("the tagged asset is outside the deny, so its lineage must be readable")
        .doesNotContain("Authorization error")
        .contains(allowed.getFullyQualifiedName());
  }

  /**
   * Authorizing the root is not enough. Under a deny-everything-outside-the-tag policy the root is
   * readable but its neighbour is not, and the neighbour's FQN must not appear in the graph - that
   * identity is exactly what the policy hides.
   */
  @Test
  void lineageHidesNeighboursTheCallerCannotView() throws Exception {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    String tagFqn = createRestrictedTag(suffix);
    Table root = createServiceDatabaseSchemaTable("mcp_lin_root_" + suffix);
    Table upstream = createServiceDatabaseSchemaTable("mcp_lin_up_" + suffix);
    tagTable(root.getId().toString(), tagFqn);
    addLineageEdge(upstream, root);
    String token = createUserDeniedByCondition(suffix, String.format("!matchAnyTag('%s')", tagFqn));

    Map<String, Object> call =
        McpTestUtils.createGetLineageToolCall(Entity.TABLE, root.getFullyQualifiedName(), 1, 1);

    // Control: admin bypasses the policy and sees the neighbour, proving the edge really exists.
    assertThat(executeMcpRequest(call).toString())
        .as("admin must see the upstream neighbour")
        .contains(upstream.getFullyQualifiedName());

    JsonNode restrictedResponse = executeMcpRequest(call, token);
    String restricted = restrictedResponse.toString();
    assertThat(restricted)
        .as("the root is tagged, so the caller reaches the graph at all")
        .doesNotContain("Authorization error")
        .contains(root.getFullyQualifiedName());
    assertThat(restricted)
        .as("the untagged neighbour is denied and must not be named")
        .doesNotContain(upstream.getFullyQualifiedName());
    assertThat(hiddenNodeCount(restrictedResponse))
        .as("and the response must report the neighbour it removed, not read as complete")
        .isEqualTo(1);
  }

  /**
   * A pipeline is edge metadata, not a graph node, so the node filter never sees it. Both endpoint
   * tables are readable here and the edge survives; what must not survive is the denied pipeline's
   * identity. The relationship itself stays, so the caller still learns a pipeline joins these two.
   */
  @Test
  void lineageRedactsAPipelineTheCallerCannotView() throws Exception {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    String tagFqn = createRestrictedTag(suffix);
    Table root = createServiceDatabaseSchemaTable("mcp_pipe_root_" + suffix);
    Table upstream = createServiceDatabaseSchemaTable("mcp_pipe_up_" + suffix);
    // Both tables tagged so both stay visible and the edge is returned; the pipeline is not.
    tagTable(root.getId().toString(), tagFqn);
    tagTable(upstream.getId().toString(), tagFqn);
    String pipelineId = createPipeline(suffix);
    addLineageEdge(upstream, root, pipelineId);
    JsonNode pipeline = get("pipelines/" + pipelineId, JsonNode.class);
    String pipelineFqn = pipeline.get("fullyQualifiedName").asText();
    String token =
        createUserDeniedByCondition(
            suffix, String.format("!matchAnyTag('%s')", tagFqn), List.of("all"));

    Map<String, Object> call =
        McpTestUtils.createGetLineageToolCall(Entity.TABLE, root.getFullyQualifiedName(), 1, 1);

    // Control: admin sees the pipeline, proving it is really on the edge.
    assertThat(executeMcpRequest(call).toString())
        .as("admin must see the pipeline that joins the two tables")
        .contains(pipelineFqn);

    // Control: the policy must genuinely deny the pipeline, or the assertions below prove nothing.
    assertThat(
            executeMcpRequest(
                    McpTestUtils.createGetEntityToolCall(Entity.PIPELINE, pipelineFqn), token)
                .toString())
        .as("the restricted caller must not be able to read the pipeline directly")
        .contains("Authorization error");

    String restricted = executeMcpRequest(call, token).toString();
    assertThat(restricted)
        .as("both tables are tagged, so the edge itself must be returned")
        .contains(root.getFullyQualifiedName())
        .contains(upstream.getFullyQualifiedName());
    assertThat(restricted)
        .as("the denied pipeline must not be named")
        .doesNotContain(pipelineFqn)
        .doesNotContain("mcppipe_" + suffix);
    assertThat(restricted)
        .as("but the relationship must still say a pipeline connects them")
        .contains("\"relationshipType\":\"pipeline\"");
  }

  private void assertLineageDenied(Table table, String token) throws Exception {
    String lineage =
        executeMcpRequest(
                McpTestUtils.createGetLineageToolCall(
                    Entity.TABLE, table.getFullyQualifiedName(), 1, 1),
                token)
            .toString();
    assertThat(lineage)
        .as("get_entity_lineage must honour the tag deny")
        .contains("Authorization error");
    assertThat(lineage)
        .as("a denied lineage call must not name the asset")
        .doesNotContain(table.getFullyQualifiedName());
  }

  /** Reads {@code hiddenNodes} out of the tool payload carried in the JSON-RPC result envelope. */
  private int hiddenNodeCount(JsonNode response) throws Exception {
    JsonNode content = response.at("/result/content");
    assertThat(content.isArray()).as("tool result must carry content").isTrue();
    JsonNode payload = OBJECT_MAPPER.readTree(content.get(0).get("text").asText());
    assertThat(payload.has("hiddenNodes")).as("lineage must report hiddenNodes").isTrue();
    return payload.get("hiddenNodes").asInt();
  }

  /**
   * {@code PUT /v1/lineage} answers 200 with an empty body, so it cannot go through {@code put(...,
   * Class)} (which parses the body) or {@code putText} (which sends text/plain).
   */
  private void addLineageEdge(Table from, Table to) throws Exception {
    addLineageEdge(from, to, null);
  }

  private String createPipeline(String suffix) throws Exception {
    String prefix = "mcppipe_" + suffix;
    JsonNode service =
        post(
            "services/pipelineServices",
            Map.of(
                "name",
                prefix + "_svc",
                "serviceType",
                "Airflow",
                "connection",
                Map.of("config", Map.of("type", "Airflow", "hostPort", "http://localhost:8080"))),
            JsonNode.class);
    JsonNode pipeline =
        post(
            "pipelines",
            Map.of("name", prefix, "service", service.get("fullyQualifiedName").asText()),
            JsonNode.class);
    return pipeline.get("id").asText();
  }

  private void addLineageEdge(Table from, Table to, String pipelineId) throws Exception {
    Map<String, Object> edge =
        new java.util.HashMap<>(
            Map.of(
                "fromEntity", Map.of("id", from.getId().toString(), "type", Entity.TABLE),
                "toEntity", Map.of("id", to.getId().toString(), "type", Entity.TABLE)));
    if (pipelineId != null) {
      edge.put(
          "lineageDetails", Map.of("pipeline", Map.of("id", pipelineId, "type", Entity.PIPELINE)));
    }
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("edge", edge));
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(TestSuiteBootstrap.getBaseUrl() + "/api/v1/lineage"))
            .header("Content-Type", "application/json")
            .header("Authorization", authToken)
            .PUT(HttpRequest.BodyPublishers.ofString(body))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertThat(response.statusCode()).as("lineage edge must be created").isEqualTo(200);
  }

  private String createRestrictedTag(String suffix) throws Exception {
    String classification = "McpAuthz" + suffix;
    post(
        "classifications",
        Map.of("name", classification, "description", "mcp authz"),
        JsonNode.class);
    JsonNode tag =
        post(
            "tags",
            Map.of("classification", classification, "name", "Restricted", "description", "mcp"),
            JsonNode.class);
    return tag.get("fullyQualifiedName").asText();
  }

  private void tagTable(String tableId, String tagFqn) throws Exception {
    patch(
        "tables/" + tableId,
        String.format(
            "[{\"op\":\"add\",\"path\":\"/tags/0\",\"value\":{\"tagFQN\":\"%s\",\"source\":"
                + "\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}}]",
            tagFqn));
  }

  private String createUserDeniedByTag(String suffix, String tagFqn) throws Exception {
    return createUserDeniedByCondition(suffix, String.format("matchAnyTag('%s')", tagFqn));
  }

  /**
   * A DataConsumer whose extra role denies ViewAll on any table matching {@code condition}. Both
   * polarities matter: {@code matchAnyTag(x)} denies the tagged asset, {@code !matchAnyTag(x)}
   * denies everything else, and an unresolved ResourceContext gets the wrong answer for both.
   */
  private String createUserDeniedByCondition(String suffix, String condition) throws Exception {
    return createUserDeniedByCondition(suffix, condition, List.of("table"));
  }

  private String createUserDeniedByCondition(
      String suffix, String condition, List<String> resources) throws Exception {
    String prefix = "mcpauthz_" + suffix;
    JsonNode policy =
        post(
            "policies",
            Map.of(
                "name",
                prefix + "_policy",
                "rules",
                List.of(
                    Map.of(
                        "name",
                        prefix + "_rule",
                        "resources",
                        resources,
                        "operations",
                        List.of("ViewAll"),
                        "effect",
                        "deny",
                        "condition",
                        condition))),
            JsonNode.class);
    JsonNode role =
        post(
            "roles",
            Map.of(
                "name",
                prefix + "_role",
                "policies",
                List.of(policy.get("fullyQualifiedName").asText())),
            JsonNode.class);
    JsonNode dataConsumer = get("roles/name/DataConsumer", JsonNode.class);
    JsonNode team =
        post(
            "teams",
            Map.of(
                "name",
                prefix + "_team",
                "teamType",
                "Group",
                "defaultRoles",
                List.of(dataConsumer.get("id").asText(), role.get("id").asText())),
            JsonNode.class);
    String email = prefix + "_u@test.openmetadata.org";
    post(
        "users",
        Map.of("name", prefix + "_u", "email", email, "teams", List.of(team.get("id").asText())),
        JsonNode.class);
    return "Bearer " + JwtAuthProvider.tokenFor(email, email, new String[] {}, 3_600);
  }
}
