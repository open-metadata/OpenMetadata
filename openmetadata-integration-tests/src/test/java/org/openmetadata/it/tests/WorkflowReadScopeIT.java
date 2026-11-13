package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.QueryRunnerRequest;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * A query runner workflow carries its requester's SQL, so reading it is limited to that requester,
 * admins and bots, on every read path of {@code /v1/automations/workflows}.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class WorkflowReadScopeIT {

  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
  private static final String WORKFLOWS_PATH = "/v1/automations/workflows";
  private static final String REQUESTER_EMAIL = "shared_user2@test.openmetadata.org";
  private static final String OTHER_USER_EMAIL = "data-consumer@open-metadata.org";
  private static final long TOKEN_TTL_SECONDS = 3600;

  @BeforeAll
  static void ensureOtherUser() {
    UserTestFactory.getDataConsumer(null);
  }

  @Test
  void anotherUserNeitherListsNorReadsAQueryTheyDidNotRun(TestNamespace ns) throws Exception {
    Workflow workflow = createQueryRunnerWorkflow(ns.prefix("qr-scope-other"));
    String otherToken = tokenFor(OTHER_USER_EMAIL, new String[] {"DataConsumer"});

    assertFalse(
        listQueryRunnerIds(otherToken).contains(workflow.getId().toString()),
        "another user's listing must leave out a query they did not run");
    assertEquals(403, get(byId(workflow), otherToken).statusCode());
    assertEquals(403, get(byName(workflow), otherToken).statusCode());
    assertEquals(403, get(byId(workflow) + "/versions", otherToken).statusCode());
    assertEquals(
        403, get(byId(workflow) + "/versions/" + workflow.getVersion(), otherToken).statusCode());
  }

  @Test
  void theHistoryListingLeavesOutAnotherUsersQueryInsteadOfRefusingThePage(TestNamespace ns)
      throws Exception {
    long startTs = System.currentTimeMillis() - 60_000;
    Workflow workflow = createQueryRunnerWorkflow(ns.prefix("qr-scope-history"));
    long endTs = System.currentTimeMillis() + 60_000;
    String range = "&startTs=" + startTs + "&endTs=" + endTs;

    String otherToken = tokenFor(OTHER_USER_EMAIL, new String[] {"DataConsumer"});
    assertFalse(historyIds(otherToken, range).contains(workflow.getId().toString()));
    String requesterToken = tokenFor(REQUESTER_EMAIL, new String[] {});
    assertTrue(historyIds(requesterToken, range).contains(workflow.getId().toString()));
  }

  @Test
  void theRequesterListsAndReadsTheirOwnQuery(TestNamespace ns) throws Exception {
    Workflow workflow = createQueryRunnerWorkflow(ns.prefix("qr-scope-own"));
    String requesterToken = tokenFor(REQUESTER_EMAIL, new String[] {});

    assertTrue(listQueryRunnerIds(requesterToken).contains(workflow.getId().toString()));
    HttpResponse<String> response = get(byId(workflow), requesterToken);
    assertEquals(200, response.statusCode());
    assertEquals(
        "SELECT 'qr-scope'",
        JsonUtils.readTree(response.body()).path("request").path("query").asText());
    assertEquals(200, get(byName(workflow), requesterToken).statusCode());
    assertEquals(200, get(byId(workflow) + "/versions", requesterToken).statusCode());
  }

  @Test
  void anAdminListsAndReadsEveryonesQueries(TestNamespace ns) throws Exception {
    Workflow workflow = createQueryRunnerWorkflow(ns.prefix("qr-scope-admin"));
    String adminToken = SdkClients.getAdminToken();

    assertTrue(listQueryRunnerIds(adminToken).contains(workflow.getId().toString()));
    assertEquals(200, get(byId(workflow), adminToken).statusCode());
  }

  @Test
  void otherWorkflowTypesStayReadableAsBefore(TestNamespace ns) throws Exception {
    Workflow workflow =
        SdkClients.adminClient().workflows().create(testConnectionWorkflow(ns.prefix("tc-scope")));
    String otherToken = tokenFor(OTHER_USER_EMAIL, new String[] {"DataConsumer"});

    assertTrue(
        listIds(otherToken, "TEST_CONNECTION").contains(workflow.getId().toString()),
        "the requester scope applies to query runner workflows only");
    assertEquals(200, get(byId(workflow), otherToken).statusCode());
  }

  private static Workflow createQueryRunnerWorkflow(String name) {
    QueryRunnerRequest request =
        new QueryRunnerRequest()
            .withConnectionType("Mysql")
            .withQuery("SELECT 'qr-scope'")
            .withUserId(SharedEntities.get().USER2_REF.getId());
    return SdkClients.adminClient()
        .workflows()
        .create(
            new CreateWorkflow()
                .withName(name)
                .withDescription(name)
                .withWorkflowType(WorkflowType.QUERY_RUNNER)
                .withRequest(request));
  }

  private static CreateWorkflow testConnectionWorkflow(String name) {
    TestServiceConnectionRequest request =
        new TestServiceConnectionRequest()
            .withServiceType(ServiceType.DATABASE)
            .withConnectionType("Mysql")
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection()
                            .withHostPort("mysql:3306")
                            .withUsername("openmetadata_user")
                            .withAuthType(new basicAuth().withPassword("openmetadata_password"))));
    return new CreateWorkflow()
        .withName(name)
        .withDescription(name)
        .withWorkflowType(WorkflowType.TEST_CONNECTION)
        .withRequest(request);
  }

  private static Set<String> listQueryRunnerIds(String token) throws Exception {
    return listIds(token, "QUERY_RUNNER");
  }

  /** Every id the caller's listing of a workflow type returns, across all pages. */
  private static Set<String> listIds(String token, String workflowType) throws Exception {
    return pagedIds(token, WORKFLOWS_PATH + "?limit=1000&workflowType=" + workflowType);
  }

  private static Set<String> pagedIds(String token, String firstPage) throws Exception {
    Set<String> ids = new HashSet<>();
    String after = null;
    do {
      String path = firstPage;
      if (after != null) {
        path += "&after=" + URLEncoder.encode(after, StandardCharsets.UTF_8);
      }
      HttpResponse<String> response = get(path, token);
      assertEquals(200, response.statusCode(), response.body());
      JsonNode page = JsonUtils.readTree(response.body());
      page.path("data").forEach(row -> ids.add(row.path("id").asText()));
      JsonNode next = page.path("paging").path("after");
      after = next.isMissingNode() || next.isNull() ? null : next.asText();
    } while (after != null);
    return ids;
  }

  /** Every workflow id in the caller's history listing of a time range, across all pages. */
  private static Set<String> historyIds(String token, String range) throws Exception {
    return pagedIds(token, WORKFLOWS_PATH + "/history?limit=500" + range);
  }

  private static String byId(Workflow workflow) {
    return WORKFLOWS_PATH + "/" + workflow.getId();
  }

  private static String byName(Workflow workflow) {
    return WORKFLOWS_PATH
        + "/name/"
        + URLEncoder.encode(workflow.getFullyQualifiedName(), StandardCharsets.UTF_8);
  }

  private static HttpResponse<String> get(String path, String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token)
            .GET()
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static String tokenFor(String email, String[] roles) {
    return JwtAuthProvider.tokenFor(email, email, roles, TOKEN_TTL_SECONDS);
  }
}
