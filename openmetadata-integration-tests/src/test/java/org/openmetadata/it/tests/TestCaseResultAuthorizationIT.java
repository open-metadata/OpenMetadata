package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;

/**
 * Authorization integration tests for {@code TestCaseResultResource} mutating endpoints.
 *
 * <p>These tests exercise the non-admin authorization path for deleting a test case result, which
 * the admin-only {@code TestCaseResourceIT#test_deleteTestCaseResult} cannot observe (admin
 * short-circuits the authorizer). They assert the DELETE endpoint follows the same "either the
 * owning table's permissions <em>or</em> the test case's permissions suffice" model as POST/PATCH,
 * i.e. it is authorized under {@link
 * org.openmetadata.service.security.AuthorizationLogic#ANY} rather than {@code ALL}.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TestCaseResultAuthorizationIT {

  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  /**
   * A principal that holds {@code Delete} on {@code table} but NOT on {@code testCase} must be
   * able to delete a single test case result. The DELETE endpoint builds two auth requests -- one
   * for the owning table ({@code TABLE/DELETE}) and one for the test case ({@code
   * TEST_CASE/DELETE}) -- and evaluates them under {@code AuthorizationLogic.ANY}, so a single
   * matching grant is enough. If the endpoint ever regresses to {@code ALL} (which demands both),
   * this test fails with a 403, matching the original bug.
   */
  @Test
  void tableOnlyDeletePermissionIsSufficient(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Table table = createTable(ns);
    TestCase testCase =
        TestCaseBuilder.create(admin)
            .name(ns.shortPrefix("tc"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    long timestamp = System.currentTimeMillis();
    CreateTestCaseResult result = new CreateTestCaseResult();
    result.setTimestamp(timestamp);
    result.setTestCaseStatus(TestCaseStatus.Success);
    result.setResult("result to delete");
    admin.testCaseResults().create(testCase.getFullyQualifiedName(), result);

    // Grant Delete on `table` only -- deliberately NOT on `testCase`, so the two auth requests
    // built by deleteTestCaseResult split: TABLE/DELETE passes, TEST_CASE/DELETE fails.
    String id = ns.uniqueShortId();
    Policy tableDeletePolicy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("tcr_pol_" + id)
                    .withDescription("Allow Delete on table resources only")
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("allowTableDelete")
                                .withEffect(Rule.Effect.ALLOW)
                                .withOperations(List.of(MetadataOperation.DELETE))
                                .withResources(List.of("table")))));
    Role tableDeleteRole =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName("tcr_role_" + id)
                    .withPolicies(List.of(tableDeletePolicy.getFullyQualifiedName())));
    String userName = "tcr_u_" + id;
    String email = userName + "@test.openmetadata.org";
    User tableDeleteUser =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(email)
                    .withRoles(List.of(tableDeleteRole.getId())));

    HttpResponse<String> response;
    try {
      String token = JwtAuthProvider.tokenFor(email, email, new String[] {}, 3600);
      response = deleteResult(testCase.getFullyQualifiedName(), timestamp, token);
    } finally {
      admin.users().delete(tableDeleteUser.getId());
      admin.roles().delete(tableDeleteRole.getId());
      admin.policies().delete(tableDeletePolicy.getId());
    }

    assertNotNull(response, "DELETE request must have been issued");
    assertEquals(
        200,
        response.statusCode(),
        "A user with Delete on table (but not testCase) must be able to delete a test case result"
            + " under AuthorizationLogic.ANY. A 403 here means the endpoint regressed to ALL."
            + " Body: "
            + response.body());
  }

  /**
   * A principal with no {@code Delete} grant on either {@code table} or {@code testCase} must be
   * denied (403). This guards that loosening the combinator to {@code ANY} did not turn the
   * endpoint into an open delete.
   */
  @Test
  void noDeletePermissionReturns403(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Table table = createTable(ns);
    TestCase testCase =
        TestCaseBuilder.create(admin)
            .name(ns.shortPrefix("tc"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    long timestamp = System.currentTimeMillis();
    CreateTestCaseResult result = new CreateTestCaseResult();
    result.setTimestamp(timestamp);
    result.setTestCaseStatus(TestCaseStatus.Success);
    result.setResult("result to deny");
    admin.testCaseResults().create(testCase.getFullyQualifiedName(), result);

    // A user with no roles has neither TABLE/DELETE nor TEST_CASE/DELETE -- both auth requests
    // fail, so ANY (like ALL) must deny.
    String id = ns.uniqueShortId();
    String userName = "tcr_du_" + id;
    String email = userName + "@test.openmetadata.org";
    User denyUser =
        admin
            .users()
            .create(new CreateUser().withName(userName).withEmail(email).withRoles(List.of()));

    HttpResponse<String> response;
    try {
      String token = JwtAuthProvider.tokenFor(email, email, new String[] {}, 3600);
      response = deleteResult(testCase.getFullyQualifiedName(), timestamp, token);
    } finally {
      admin.users().delete(denyUser.getId());
    }

    assertNotNull(response, "DELETE request must have been issued");
    assertNotEquals(200, response.statusCode(), "A user without Delete must not delete a result");
    assertEquals(
        403,
        response.statusCode(),
        "A user without any Delete grant must be rejected with 403, not "
            + response.statusCode()
            + ". Body: "
            + response.body());
  }

  /**
   * Build a table with short (unique) names to stay well within the 256-char FQN limit, mirroring
   * the helper used by {@code TestCaseResourceIT}.
   */
  private Table createTable(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String id = ns.uniqueShortId();

    DatabaseService service =
        DatabaseServices.builder()
            .name("pg_" + id)
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .description("Test Postgres service")
            .create();

    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("db_" + id);
    dbReq.setService(service.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Database database = admin.databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("s_" + id);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = admin.databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName("t_" + id);
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));
    return admin.tables().create(tableRequest);
  }

  private static HttpResponse<String> deleteResult(String testCaseFqn, long timestamp, String token)
      throws Exception {
    String path = "/v1/dataQuality/testCases/testCaseResults/" + testCaseFqn + "/" + timestamp;
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token)
            .DELETE()
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
