package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;
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
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;

/**
 * Authorization of {@code PUT /v1/dataQuality/testCases} for a caller who is not an admin. Admins
 * skip the authorizer, so {@code TestCaseResourceIT} cannot see this path. The PUT is authorized
 * under {@code AuthorizationLogic.ANY}, which evaluates every request: a request whose context has
 * to load the test case must not be built for a test case the PUT is about to create.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TestCaseCreateOrUpdateAuthorizationIT {

  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
  private static final String TEST_CASES_PATH = "/v1/dataQuality/testCases";
  private static final String COLUMN_NAME = "id";

  /**
   * EditTests on the table alone is enough to create a table and a column test case with PUT, then
   * to update them.
   */
  @Test
  void tableEditTestsPermissionCreatesAndUpdatesTestCase(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Table table = createTable(ns);
    List<CreateTestCase> creates =
        List.of(
            createTestCaseRequest(ns, table),
            TestCaseBuilder.create(admin)
                .name(ns.shortPrefix("ctc"))
                .forColumn(table, COLUMN_NAME)
                .testDefinition("columnValuesToBeNotNull")
                .build());
    String id = ns.uniqueShortId();
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("tcput_pol_" + id)
                    .withDescription("Allow EditTests on table resources only")
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("allowTableEditTests")
                                .withEffect(Rule.Effect.ALLOW)
                                .withOperations(List.of(MetadataOperation.EDIT_TESTS))
                                .withResources(List.of("table")))));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName("tcput_role_" + id)
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    User user = createUser("tcput_u_" + id, List.of(role.getId()));
    try {
      String token = tokenFor(user);
      for (CreateTestCase create : creates) {
        HttpResponse<String> created = putTestCase(create, token);
        assertEquals(201, created.statusCode(), "Test case must be created: " + created.body());
        HttpResponse<String> updated = putTestCase(create.withDescription("updated"), token);
        assertEquals(200, updated.statusCode(), "Test case must be updated: " + updated.body());
      }
    } finally {
      admin.users().delete(user.getId());
      admin.roles().delete(role.getId());
      admin.policies().delete(policy.getId());
    }
  }

  /** A caller with no grant on the table or the test case is refused, not told it is missing. */
  @Test
  void noPermissionReturns403ForNewTestCase(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    CreateTestCase create = createTestCaseRequest(ns, createTable(ns));
    User user = createUser("tcput_du_" + ns.uniqueShortId(), List.of());
    try {
      HttpResponse<String> response = putTestCase(create, tokenFor(user));
      assertEquals(403, response.statusCode(), "PUT must be refused: " + response.body());
    } finally {
      admin.users().delete(user.getId());
    }
  }

  private static CreateTestCase createTestCaseRequest(TestNamespace ns, Table table) {
    return TestCaseBuilder.create(SdkClients.adminClient())
        .name(ns.shortPrefix("tc"))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .build();
  }

  private static User createUser(String userName, List<UUID> roles) {
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(userName)
                .withEmail(userName + "@test.openmetadata.org")
                .withRoles(roles));
  }

  private static String tokenFor(User user) {
    return JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 3600);
  }

  private static HttpResponse<String> putTestCase(CreateTestCase create, String token)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + TEST_CASES_PATH))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(create)))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static Table createTable(TestNamespace ns) {
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
    Database database =
        admin
            .databases()
            .create(
                new CreateDatabase()
                    .withName("db_" + id)
                    .withService(service.getFullyQualifiedName()));
    DatabaseSchema schema =
        admin
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName("s_" + id)
                    .withDatabase(database.getFullyQualifiedName()));
    return admin
        .tables()
        .create(
            new CreateTable()
                .withName("t_" + id)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName(COLUMN_NAME).withDataType(ColumnDataType.INT))));
  }
}
