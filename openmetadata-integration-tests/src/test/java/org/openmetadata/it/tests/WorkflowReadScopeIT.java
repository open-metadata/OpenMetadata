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
import java.util.List;
import java.util.Set;
import java.util.UUID;
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
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.QueryRunnerRequest;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

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
  void aUserWhoMayWriteWorkflowsCannotRewriteOrDeleteAnotherUsersQuery(TestNamespace ns)
      throws Exception {
    Workflow workflow = createQueryRunnerWorkflow(ns.prefix("qr-scope-write"));
    User editor = workflowEditor(ns);
    String editorToken = tokenFor(editor.getEmail(), new String[] {});
    String patch = requesterPatch(editor.getId());
    String put = JsonUtils.pojoToJson(queryRunnerWorkflow(workflow.getName(), editor.getId()));

    assertEquals(
        403,
        send("PATCH", byId(workflow), editorToken, patch, "application/json-patch+json")
            .statusCode());
    assertEquals(
        403,
        send("PATCH", byName(workflow), editorToken, patch, "application/json-patch+json")
            .statusCode());
    assertEquals(
        403, send("PUT", WORKFLOWS_PATH, editorToken, put, "application/json").statusCode());
    assertEquals(403, send("DELETE", byId(workflow), editorToken, null, null).statusCode());
    assertEquals(403, send("DELETE", byName(workflow), editorToken, null, null).statusCode());

    HttpResponse<String> stored = get(byId(workflow), SdkClients.getAdminToken());
    assertEquals(200, stored.statusCode());
    assertEquals(
        SharedEntities.get().USER2_REF.getId().toString(),
        JsonUtils.readTree(stored.body()).path("request").path("userId").asText());
  }

  /**
   * SQL Studio deletes a run as the user who ran it. A plain user holds no Delete on workflows, so
   * the requester's own run must be deletable without it, by id and by name.
   */
  @Test
  void aRequesterWithNoWorkflowPermissionDeletesTheirOwnQuery(TestNamespace ns) throws Exception {
    User requester = plainUser(ns);
    String requesterToken = tokenFor(requester.getEmail(), new String[] {});
    Workflow byIdRun = createQueryRunnerWorkflow(ns.prefix("qr-scope-own-id"), requester.getId());
    Workflow byNameRun =
        createQueryRunnerWorkflow(ns.prefix("qr-scope-own-name"), requester.getId());

    HttpResponse<String> deletedById =
        send("DELETE", byId(byIdRun) + "?hardDelete=true", requesterToken, null, null);
    HttpResponse<String> deletedByName =
        send("DELETE", byName(byNameRun) + "?hardDelete=true", requesterToken, null, null);

    assertEquals(200, deletedById.statusCode(), deletedById.body());
    assertEquals(200, deletedByName.statusCode(), deletedByName.body());
    assertEquals(404, get(byId(byIdRun), SdkClients.getAdminToken()).statusCode());
    assertEquals(404, get(byId(byNameRun), SdkClients.getAdminToken()).statusCode());
  }

  /** The requester's delete is for their own runs only: a plain user cannot delete another's. */
  @Test
  void aPlainUserCannotDeleteAnotherUsersQuery(TestNamespace ns) throws Exception {
    Workflow workflow = createQueryRunnerWorkflow(ns.prefix("qr-scope-other-delete"));
    String strangerToken = tokenFor(plainUser(ns).getEmail(), new String[] {});

    assertEquals(
        403,
        send("DELETE", byId(workflow) + "?hardDelete=true", strangerToken, null, null)
            .statusCode());
    assertEquals(200, get(byId(workflow), SdkClients.getAdminToken()).statusCode());
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
    return createQueryRunnerWorkflow(name, SharedEntities.get().USER2_REF.getId());
  }

  private static Workflow createQueryRunnerWorkflow(String name, UUID requesterId) {
    return SdkClients.adminClient().workflows().create(queryRunnerWorkflow(name, requesterId));
  }

  private static CreateWorkflow queryRunnerWorkflow(String name, UUID requesterId) {
    QueryRunnerRequest request =
        new QueryRunnerRequest()
            .withConnectionType("Mysql")
            .withQuery("SELECT 'qr-scope'")
            .withUserId(requesterId);
    return new CreateWorkflow()
        .withName(name)
        .withDescription(name)
        .withWorkflowType(WorkflowType.QUERY_RUNNER)
        .withRequest(request);
  }

  /** A user with no role, so no Delete or EditAll on workflows. */
  private static User plainUser(TestNamespace ns) {
    String name = "wfplain_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser user = new CreateUser().withName(name).withEmail(name + "@test.openmetadata.org");
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(user));
  }

  /** A user whose role may edit and delete every workflow, as an admin-granted custom role can. */
  private static User workflowEditor(TestNamespace ns) {
    Rule allow =
        new Rule()
            .withName("AllowWorkflowWrites")
            .withEffect(Rule.Effect.ALLOW)
            .withOperations(List.of(MetadataOperation.EDIT_ALL, MetadataOperation.DELETE))
            .withResources(List.of(Entity.WORKFLOW));
    Policy policy =
        SdkClients.adminClient()
            .policies()
            .create(new CreatePolicy().withName(ns.prefix("wf-editor")).withRules(List.of(allow)));
    Role role =
        SdkClients.adminClient()
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("wf-editor"))
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    String name = "wfedit_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser user =
        new CreateUser()
            .withName(name)
            .withEmail(name + "@test.openmetadata.org")
            .withRoles(List.of(role.getId()));
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(user));
  }

  private static String requesterPatch(UUID userId) {
    return "[{\"op\":\"replace\",\"path\":\"/request/userId\",\"value\":\"" + userId + "\"}]";
  }

  private static HttpResponse<String> send(
      String method, String path, String token, String body, String contentType) throws Exception {
    HttpRequest.Builder request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token);
    if (body == null) {
      request.method(method, HttpRequest.BodyPublishers.noBody());
    } else {
      request
          .header("Content-Type", contentType)
          .method(method, HttpRequest.BodyPublishers.ofString(body));
    }
    return HTTP_CLIENT.send(request.build(), HttpResponse.BodyHandlers.ofString());
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
