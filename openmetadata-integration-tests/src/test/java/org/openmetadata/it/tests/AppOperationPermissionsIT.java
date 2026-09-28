package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for App operational endpoint permissions.
 *
 * <p>Verifies that trigger, stop, deploy, schedule, and configure endpoints enforce authorization:
 *
 * <ul>
 *   <li>Admin users can trigger/deploy/stop/schedule/configure apps
 *   <li>Unauthenticated requests are rejected with 401
 *   <li>Data consumers (read-only role) are denied with 403
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AppOperationPermissionsIT {

  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
  private static final String APP_NAME = "SearchIndexingApplication";

  // dataConsumer JWT tests hit SubjectCache.getUserContext during authorization; if that user
  // hasn't been created in this JVM session the lookup throws EntityNotFoundException (→404)
  // and short-circuits the authorizer before it can return the expected 403. Pin the user up
  // front so the result is deterministic regardless of suite ordering.
  @BeforeAll
  static void ensureDataConsumerUser() {
    UserTestFactory.getDataConsumer(null);
  }

  @Test
  void test_triggerApp_noAuth_returns401(TestNamespace ns) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/apps/trigger/" + APP_NAME))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{}"))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, response.statusCode(), "Request without auth should return 401");
  }

  @Test
  void test_triggerApp_dataConsumer_returns403(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        postWithToken("/v1/apps/trigger/" + APP_NAME, "{}", getDataConsumerToken());

    assertEquals(
        403, response.statusCode(), "DataConsumer should not be able to trigger applications");
  }

  @Test
  void test_deployApp_noAuth_returns401(TestNamespace ns) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/apps/deploy/" + APP_NAME))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, response.statusCode(), "Request without auth should return 401");
  }

  @Test
  void test_deployApp_dataConsumer_returns403(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        postWithToken("/v1/apps/deploy/" + APP_NAME, null, getDataConsumerToken());

    assertEquals(
        403, response.statusCode(), "DataConsumer should not be able to deploy applications");
  }

  @Test
  void test_stopApp_noAuth_returns401(TestNamespace ns) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/apps/stop/" + APP_NAME))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, response.statusCode(), "Request without auth should return 401");
  }

  @Test
  void test_stopApp_dataConsumer_returns403(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        postWithToken("/v1/apps/stop/" + APP_NAME, null, getDataConsumerToken());

    assertEquals(
        403, response.statusCode(), "DataConsumer should not be able to stop applications");
  }

  @Test
  void test_scheduleApp_noAuth_returns401(TestNamespace ns) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/apps/schedule/" + APP_NAME))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, response.statusCode(), "Request without auth should return 401");
  }

  @Test
  void test_scheduleApp_dataConsumer_returns403(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        postWithToken("/v1/apps/schedule/" + APP_NAME, null, getDataConsumerToken());

    assertEquals(
        403, response.statusCode(), "DataConsumer should not be able to schedule applications");
  }

  @Test
  void test_configureApp_noAuth_returns401(TestNamespace ns) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/apps/configure/" + APP_NAME))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, response.statusCode(), "Request without auth should return 401");
  }

  @Test
  void test_configureApp_dataConsumer_returns403(TestNamespace ns) throws Exception {
    HttpResponse<String> response =
        postWithToken("/v1/apps/configure/" + APP_NAME, null, getDataConsumerToken());

    assertEquals(
        403, response.statusCode(), "DataConsumer should not be able to configure applications");
  }

  @Test
  void test_readEndpoints_deniedViewAll_returns403(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String prefix = ns.shortPrefix() + "appread";

    Policy denyPolicy =
        adminClient
            .policies()
            .create(
                new CreatePolicy()
                    .withName(prefix + "_pol")
                    .withDescription("Deny ViewAll on applications")
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("denyAppViewAll")
                                .withEffect(Rule.Effect.DENY)
                                .withOperations(List.of(MetadataOperation.VIEW_ALL))
                                .withResources(List.of("app")))));
    try {
      Role denyRole =
          adminClient
              .roles()
              .create(
                  new CreateRole()
                      .withName(prefix + "_role")
                      .withPolicies(List.of(denyPolicy.getFullyQualifiedName())));
      try {
        String email = prefix + "_u@test.openmetadata.org";
        User user =
            adminClient
                .users()
                .create(
                    new CreateUser()
                        .withName(prefix + "_u")
                        .withEmail(email)
                        .withRoles(List.of(denyRole.getId())));
        try {
          String token = JwtAuthProvider.tokenFor(email, email, new String[] {}, 3600);

          for (String path :
              List.of(
                  "/v1/apps/installed",
                  "/v1/apps/name/" + APP_NAME + "/status",
                  "/v1/apps/name/" + APP_NAME + "/runs/latest",
                  "/v1/apps/name/" + APP_NAME + "/logs",
                  "/v1/apps/name/" + APP_NAME + "/extension",
                  "/v1/apps/name/" + APP_NAME + "/live-indexing-queue")) {
            HttpResponse<String> response = getWithToken(path, token);
            assertEquals(
                403,
                response.statusCode(),
                "a principal denied ViewAll on app must not read " + path);
          }
        } finally {
          adminClient.users().delete(user.getId());
        }
      } finally {
        adminClient.roles().delete(denyRole.getId());
      }
    } finally {
      adminClient.policies().delete(denyPolicy.getId());
    }
  }

  @Test
  void test_readEndpoints_noAuth_returns401(TestNamespace ns) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/apps/name/" + APP_NAME + "/logs"))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, response.statusCode(), "Request without auth should return 401");
  }

  @Test
  void test_readEndpoints_dataConsumer_stillAllowed(TestNamespace ns) throws Exception {
    // DataConsumer holds ViewAll on all resources, so the new gate must not change its access.
    // This is the regression guard for default installations, where every user inherits that role.
    HttpResponse<String> response =
        getWithToken("/v1/apps/name/" + APP_NAME + "/status", getDataConsumerToken());

    assertEquals(
        200, response.statusCode(), "DataConsumer holds ViewAll and must keep reading app runs");
  }

  @Test
  void test_patchApp_unauthorized_deniesBeforeDisclosingExistence(TestNamespace ns)
      throws Exception {
    // A DataConsumer holds EditDescription but not EditAll, so patching /enabled is denied.
    // The denial must come from the permission check rather than from the entity lookup, so a
    // caller who may not patch cannot learn whether an app exists. Same ordering the delete
    // endpoints use.
    HttpResponse<String> response =
        patchWithToken(
            "/v1/apps/name/ZZNonExistentAppForPermissionCheck",
            "[{\"op\":\"replace\",\"path\":\"/enabled\",\"value\":true}]",
            getDataConsumerToken());

    assertEquals(
        403,
        response.statusCode(),
        "an unauthorized patch must be rejected before the app lookup, not answered with 404");
  }

  private HttpResponse<String> patchWithToken(String path, String body, String token)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json-patch+json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(body))
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> getWithToken(String path, String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token)
            .GET()
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static String getDataConsumerToken() {
    return JwtAuthProvider.tokenFor(
        "data-consumer@open-metadata.org",
        "data-consumer@open-metadata.org",
        new String[] {"DataConsumer"},
        3600);
  }

  private HttpResponse<String> postWithToken(String path, String body, String token)
      throws Exception {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json");

    if (body != null) {
      builder.POST(HttpRequest.BodyPublishers.ofString(body));
    } else {
      builder.POST(HttpRequest.BodyPublishers.noBody());
    }

    return HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
  }
}
