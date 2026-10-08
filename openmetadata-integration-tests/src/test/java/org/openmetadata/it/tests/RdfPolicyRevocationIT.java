package org.openmetadata.it.tests;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.tests.mcp.McpTestBase;
import org.openmetadata.it.tests.mcp.McpTestUtils;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.rdf.AgentSparqlQuery;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfProjectionHealth;
import org.openmetadata.service.rdf.RdfRepository;

/**
 * An administrator removes the seeded Data Consumer SPARQL grant from a user whose policies were
 * warmed through MCP. The first REST or permission-API decision after the update response must
 * already honour it, whatever the cache provider (this class runs under both the default {@code
 * none} and the Redis profile). MCP-first revocation is covered by {@code
 * PolicyRevocationConcurrencyIT}, because {@code sparql_query} is admin-only over MCP.
 *
 * <p>Each scenario uses its own user because a user's compiled policies are cached per user: a
 * permission lookup between the edit and the first request under test would reload them fresh and
 * hide the defect. The seeded policy is global server state, so the class is {@code @Isolated} and
 * the rule is put back in {@code finally}.
 */
@Isolated
public class RdfPolicyRevocationIT extends McpTestBase {
  private static final String AGENT_PATH = "/v1/rdf/sparql/agent";
  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String DATA_CONSUMER_GRANT_RULE =
      "DataConsumerPolicy-ExecuteSparqlQuery-Rule";
  private static final String RDF_INDEX_APP = "RdfIndexApp";
  private static final String STATUS = AppExtension.ExtensionType.STATUS.toString();
  private static final String QUERY = "SELECT ?s WHERE { ?s ?p ?o } LIMIT 1";
  private static final long TOKEN_TTL_SECONDS = 3600;
  private static final Deque<Runnable> CLEANUP = new ArrayDeque<>();

  private static String suffix;

  @BeforeAll
  static void setUp() throws Exception {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Requires the RDF integration-test profile");
    initAuth();
    suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    RdfRepository repository = RdfRepository.getInstanceOrNull();
    assertThat(repository != null && repository.isEnabled())
        .as("The RDF test profile must start the server with RDF enabled")
        .isTrue();
    recordSuccessfulRdfIndexRun();
    RdfProjectionHealth.markReady();
  }

  @AfterAll
  static void tearDown() {
    while (!CLEANUP.isEmpty()) {
      CLEANUP.pop().run();
    }
  }

  @Test
  void restFirstRequestIsDeniedAfterMcpWarmUp() throws Exception {
    String token = newCaller("mcpwarm");
    warmThroughMcp(token);

    withoutGrant(EditMode.PUT, () -> assertAgentStatus(token, 403));

    assertAgentStatus(token, 200);
  }

  @Test
  void restFirstRequestIsDeniedAfterMcpAndRestWarmUp() throws Exception {
    String token = newCaller("bothwarm");
    warmThroughMcp(token);
    assertAgentStatus(token, 200);

    withoutGrant(EditMode.PUT, () -> assertAgentStatus(token, 403));
  }

  @Test
  void permissionViewsDenyAfterMcpWarmUp() throws Exception {
    String userName = newCallerName("permviews");
    String token = tokenFor(userName);
    warmThroughMcp(token);

    withoutGrant(
        EditMode.PUT,
        () -> {
          assertThat(ownSparqlAccess(token)).isNotEqualTo(Permission.Access.ALLOW);
          assertThat(adminViewOfSparqlAccess(userName)).isNotEqualTo(Permission.Access.ALLOW);
          assertAgentStatus(token, 403);
        });

    assertThat(ownSparqlAccess(token)).isEqualTo(Permission.Access.ALLOW);
    assertThat(adminViewOfSparqlAccess(userName)).isEqualTo(Permission.Access.ALLOW);
  }

  @Test
  void patchedRuleRemovalRevokesTheFirstRestRequest() throws Exception {
    String token = newCaller("patched");
    warmThroughMcp(token);

    withoutGrant(EditMode.PATCH, () -> assertAgentStatus(token, 403));

    assertAgentStatus(token, 200);
  }

  @Test
  void rejectedUpdateLeavesThePolicyAndTheGrantUntouched() throws Exception {
    String token = newCaller("rejected");
    warmThroughMcp(token);
    assertAgentStatus(token, 200);
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy = admin.policies().getByName(DATA_CONSUMER_POLICY, "rules");
    int ruleCount = policy.getRules().size();
    policy.getRules().add(duplicateOf(policy.getRules().getFirst()));

    assertThrows(RuntimeException.class, () -> admin.policies().update(policy.getId(), policy));

    assertThat(admin.policies().getByName(DATA_CONSUMER_POLICY, "rules").getRules())
        .hasSize(ruleCount);
    assertAgentStatus(token, 200);
  }

  private void withoutGrant(EditMode mode, ThrowingRunnable firstRequestsAfterTheEdit)
      throws Exception {
    Rule grant = removeGrant(mode);
    try {
      assertThat(grantIsStored()).as("the edit must have been persisted").isFalse();
      firstRequestsAfterTheEdit.run();
    } finally {
      restoreGrant(grant);
    }
  }

  private static Rule removeGrant(EditMode mode) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy = admin.policies().getByName(DATA_CONSUMER_POLICY, "rules");
    int index = indexOfGrant(policy);
    Rule grant = policy.getRules().get(index);
    if (mode == EditMode.PATCH) {
      patch(
          "policies/" + policy.getId(), "[{\"op\":\"remove\",\"path\":\"/rules/" + index + "\"}]");
    } else {
      policy.getRules().remove(index);
      admin.policies().update(policy.getId(), policy);
    }
    return grant;
  }

  private static void restoreGrant(Rule grant) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy current = admin.policies().getByName(DATA_CONSUMER_POLICY, "rules");
    if (current.getRules().stream().noneMatch(rule -> grant.getName().equals(rule.getName()))) {
      current.getRules().add(grant);
      admin.policies().update(current.getId(), current);
    }
  }

  private static boolean grantIsStored() {
    Policy policy = SdkClients.adminClient().policies().getByName(DATA_CONSUMER_POLICY, "rules");
    return policy.getRules().stream()
        .anyMatch(rule -> DATA_CONSUMER_GRANT_RULE.equals(rule.getName()));
  }

  private static int indexOfGrant(Policy policy) {
    for (int index = 0; index < policy.getRules().size(); index++) {
      if (DATA_CONSUMER_GRANT_RULE.equals(policy.getRules().get(index).getName())) {
        return index;
      }
    }
    throw new AssertionError(DATA_CONSUMER_GRANT_RULE + " must be seeded");
  }

  private static Rule duplicateOf(Rule rule) {
    return new Rule()
        .withName(rule.getName())
        .withOperations(rule.getOperations())
        .withResources(rule.getResources())
        .withEffect(rule.getEffect());
  }

  /**
   * Loads the caller's compiled policies through an MCP worker thread, which is where a request
   * cache can outlive the call. {@code sparql_query} itself is admin-only over MCP, so it cannot
   * stand in for the Data Consumer grant; any tool that evaluates the caller's policies warms the
   * same per-user entry.
   */
  private void warmThroughMcp(String token) throws Exception {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("query", "*");
    arguments.put("limit", 1);
    JsonNode result =
        executeMcpRequest(
                McpTestUtils.createToolCallRequest("search_metadata", arguments), "Bearer " + token)
            .path("result");
    assertThat(result.path("isError").asBoolean(false)).as("%s", result).isFalse();
  }

  private static void assertAgentStatus(String token, int expectedStatus) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + AGENT_PATH))
            .timeout(Duration.ofSeconds(60))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + token)
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    JsonUtils.pojoToJson(new AgentSparqlQuery().withQuery(QUERY))))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(expectedStatus, response.statusCode(), response.body());
  }

  private static Permission.Access ownSparqlAccess(String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/permissions/rdf"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + token)
            .GET()
            .build();
    try (HttpClient client = HttpClient.newHttpClient()) {
      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
      assertEquals(200, response.statusCode(), response.body());
      return sparqlAccessIn(response.body());
    }
  }

  private static Permission.Access adminViewOfSparqlAccess(String userName) throws Exception {
    String body =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/permissions/rdf?user=" + userName, null);
    return sparqlAccessIn(body);
  }

  private static Permission.Access sparqlAccessIn(String permissionJson) {
    return JsonUtils.readValue(permissionJson, ResourcePermission.class).getPermissions().stream()
        .filter(permission -> permission.getOperation() == MetadataOperation.EXECUTE_SPARQL_QUERY)
        .findFirst()
        .orElseThrow()
        .getAccess();
  }

  private static String newCaller(String label) {
    return tokenFor(newCallerName(label));
  }

  /** No roles of its own: the grant reaches the user through Organization's default role. */
  private static String newCallerName(String label) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String userName = ("rdfrevoke" + label + suffix).toLowerCase(Locale.ROOT);
    User user =
        admin
            .users()
            .create(
                new CreateUser().withName(userName).withEmail(userName + "@test.openmetadata.org"));
    CLEANUP.push(() -> admin.users().delete(user.getId()));
    return userName;
  }

  private static String tokenFor(String userName) {
    String email = userName + "@test.openmetadata.org";
    return JwtAuthProvider.tokenFor(email, email, new String[] {}, TOKEN_TTL_SECONDS);
  }

  private static void recordSuccessfulRdfIndexRun() {
    UUID appId = UUID.randomUUID();
    long now = System.currentTimeMillis();
    AppRunRecord run =
        new AppRunRecord()
            .withAppId(appId)
            .withAppName(RDF_INDEX_APP)
            .withStatus(AppRunRecord.Status.SUCCESS)
            .withTimestamp(now)
            .withStartTime(now)
            .withExtension(STATUS);
    Entity.getCollectionDAO().appExtensionTimeSeriesDao().insert(JsonUtils.pojoToJson(run), STATUS);
    CLEANUP.push(
        () ->
            Entity.getCollectionDAO().appExtensionTimeSeriesDao().delete(appId.toString(), STATUS));
  }

  private enum EditMode {
    PUT,
    PATCH
  }

  @FunctionalInterface
  private interface ThrowingRunnable {
    void run() throws Exception;
  }
}
