package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
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
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.QueryRunnerRequest;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for trigger-endpoint authorization on
 * {@code POST /v1/automations/workflows/trigger/{id}}.
 *
 * <p>Covers the authorization branches added in {@code WorkflowResource#authorizeWorkflowTrigger}:
 *
 * <ul>
 *   <li>TEST_CONNECTION with {@code serviceName} set — authorized via ANY of EDIT_ALL on the
 *       service OR CREATE on INGESTION_PIPELINE.
 *   <li>TEST_CONNECTION with no {@code serviceName} — authorized via CREATE on INGESTION_PIPELINE.
 *   <li>Other workflow types — intentionally NOT gated by this authorizer (scope limited to
 *       TEST_CONNECTION per issue #26760); they retain their prior trigger behavior.
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class WorkflowTriggerPermissionsIT {

  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
  private static final String TRIGGER_PATH = "/v1/automations/workflows/trigger/";
  private static final long TOKEN_TTL_SECONDS = 3600;

  // dataConsumer JWT tests hit SubjectCache.getUserContext during authorization; if that user
  // hasn't been created in this JVM session the lookup throws EntityNotFoundException (→404)
  // and short-circuits the authorizer before it can return the expected 403. Pin the user up
  // front so the result is deterministic regardless of suite ordering.
  @BeforeAll
  static void ensureDataConsumerUser() {
    UserTestFactory.getDataConsumer(null);
  }

  @Test
  void test_triggerWorkflow_noAuth_returns401(TestNamespace ns) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + TRIGGER_PATH + UUID.randomUUID()))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, response.statusCode(), "Trigger without auth header must return 401");
  }

  @Test
  void test_triggerTestConnection_admin_withServiceName_authPasses(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    DatabaseService service = createMysqlService(admin, ns.prefix("svc-admin-trig"), null);
    Workflow workflow =
        admin
            .workflows()
            .create(testConnectionRequest(ns.prefix("admin-with-svc"), service.getName()));

    HttpResponse<String> response = triggerWorkflow(workflow.getId(), SdkClients.getAdminToken());

    assertAuthPassed(response, "admin must pass auth on TEST_CONNECTION with serviceName");
  }

  @Test
  void test_triggerTestConnection_admin_withoutServiceName_authPasses(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Workflow workflow =
        admin.workflows().create(testConnectionRequest(ns.prefix("admin-no-svc"), null));

    HttpResponse<String> response = triggerWorkflow(workflow.getId(), SdkClients.getAdminToken());

    assertAuthPassed(response, "admin must pass auth on TEST_CONNECTION without serviceName");
  }

  @Test
  void test_triggerTestConnection_serviceOwner_authPasses(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    EntityReference owner = SharedEntities.get().USER2_REF;
    DatabaseService ownedService =
        createMysqlService(admin, ns.prefix("owned-svc"), List.of(owner));
    Workflow workflow =
        admin
            .workflows()
            .create(testConnectionRequest(ns.prefix("owner-trig"), ownedService.getName()));

    String ownerToken = tokenFor("shared_user2@test.openmetadata.org", new String[] {});
    HttpResponse<String> response = triggerWorkflow(workflow.getId(), ownerToken);

    assertAuthPassed(
        response,
        "service owner must pass auth via EDIT_ALL on owned service (got "
            + response.statusCode()
            + ")");
  }

  @Test
  void test_triggerTestConnection_nonOwner_returns403(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    EntityReference owner = SharedEntities.get().USER2_REF;
    DatabaseService ownedService =
        createMysqlService(admin, ns.prefix("user2-svc"), List.of(owner));
    Workflow workflow =
        admin
            .workflows()
            .create(testConnectionRequest(ns.prefix("nonowner-trig"), ownedService.getName()));

    String nonOwnerToken = tokenFor("shared_user3@test.openmetadata.org", new String[] {});
    HttpResponse<String> response = triggerWorkflow(workflow.getId(), nonOwnerToken);

    assertEquals(
        403,
        response.statusCode(),
        "user without service ownership or pipeline perms must be denied");
  }

  @Test
  void test_triggerTestConnection_dataConsumer_withServiceName_returns403(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    DatabaseService service = createMysqlService(admin, ns.prefix("svc-dc"), null);
    Workflow workflow =
        admin
            .workflows()
            .create(testConnectionRequest(ns.prefix("dc-with-svc"), service.getName()));

    HttpResponse<String> response = triggerWorkflow(workflow.getId(), dataConsumerToken());

    assertEquals(
        403, response.statusCode(), "DataConsumer must be denied on TEST_CONNECTION with service");
  }

  @Test
  void test_triggerTestConnection_dataConsumer_withoutServiceName_returns403(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Workflow workflow =
        admin.workflows().create(testConnectionRequest(ns.prefix("dc-no-svc"), null));

    HttpResponse<String> response = triggerWorkflow(workflow.getId(), dataConsumerToken());

    assertEquals(
        403,
        response.statusCode(),
        "DataConsumer must be denied on TEST_CONNECTION without serviceName "
            + "(falls back to INGESTION_PIPELINE CREATE)");
  }

  @Test
  void test_triggerNonTestConnection_admin_authPasses(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Workflow workflow = admin.workflows().create(queryRunnerRequest(ns.prefix("qr-admin")));

    HttpResponse<String> response = triggerWorkflow(workflow.getId(), SdkClients.getAdminToken());

    assertAuthPassed(response, "admin must pass auth on QUERY_RUNNER workflow");
  }

  @Test
  void test_triggerNonTestConnection_notGatedByTestConnectionAuth(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Workflow workflow = admin.workflows().create(queryRunnerRequest(ns.prefix("qr-dc")));

    HttpResponse<String> response = triggerWorkflow(workflow.getId(), dataConsumerToken());

    assertAuthPassed(
        response,
        "non-TEST_CONNECTION triggers are intentionally out of scope for the test-connection "
            + "authorizer (issue #26760) and must not be blocked by it");
  }

  private CreateWorkflow testConnectionRequest(String name, String serviceName) {
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
    if (serviceName != null) {
      request.setServiceName(serviceName);
    }
    return new CreateWorkflow()
        .withName(name)
        .withDescription(name)
        .withWorkflowType(WorkflowType.TEST_CONNECTION)
        .withRequest(request);
  }

  private CreateWorkflow queryRunnerRequest(String name) {
    QueryRunnerRequest request =
        new QueryRunnerRequest().withConnectionType("Mysql").withQuery("SELECT 1");
    return new CreateWorkflow()
        .withName(name)
        .withDescription(name)
        .withWorkflowType(WorkflowType.QUERY_RUNNER)
        .withRequest(request);
  }

  private DatabaseService createMysqlService(
      OpenMetadataClient client, String name, List<EntityReference> owners) {
    CreateDatabaseService create =
        new CreateDatabaseService()
            .withName(name)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection()
                            .withHostPort("mysql:3306")
                            .withUsername("openmetadata_user")
                            .withAuthType(new basicAuth().withPassword("openmetadata_password"))));
    if (owners != null && !owners.isEmpty()) {
      create.setOwners(owners);
    }
    return client.databaseServices().create(create);
  }

  private HttpResponse<String> triggerWorkflow(UUID workflowId, String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + TRIGGER_PATH + workflowId))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static void assertAuthPassed(HttpResponse<String> response, String message) {
    int code = response.statusCode();
    assertNotEquals(401, code, message + " (got 401 — unauthenticated)");
    assertNotEquals(403, code, message + " (got 403 — forbidden)");
  }

  private static String dataConsumerToken() {
    return JwtAuthProvider.tokenFor(
        "data-consumer@open-metadata.org",
        "data-consumer@open-metadata.org",
        new String[] {"DataConsumer"},
        TOKEN_TTL_SECONDS);
  }

  private static String tokenFor(String email, String[] roles) {
    return JwtAuthProvider.tokenFor(email, email, roles, TOKEN_TTL_SECONDS);
  }
}
