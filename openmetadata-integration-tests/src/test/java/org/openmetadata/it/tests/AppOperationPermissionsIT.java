package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.services.teams.UserService;

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
  private static final String DATA_CONSUMER_NAME = "data-consumer";
  private static final String DATA_CONSUMER_EMAIL = "data-consumer@open-metadata.org";

  // Tests use a JWT for `data-consumer@open-metadata.org`. The authorizer's first step is
  // SubjectCache.getUserContext(...), which throws EntityNotFoundException (→404) if the user
  // hasn't been created in this JVM session yet. Whether that's true depends on test suite
  // ordering, so the asserts here previously accepted both 403 and 404. Force-create the user
  // up front so we can assert the real expected status (403) deterministically.
  @BeforeAll
  static void ensureDataConsumerUser() {
    UserService userService = new UserService(SdkClients.adminClient().getHttpClient());
    try {
      userService.getByName(DATA_CONSUMER_NAME, null);
    } catch (OpenMetadataException notFound) {
      try {
        userService.create(
            new CreateUser().withName(DATA_CONSUMER_NAME).withEmail(DATA_CONSUMER_EMAIL));
      } catch (OpenMetadataException conflict) {
        // Another test class's @BeforeAll created it between our get and create.
      }
    }
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
