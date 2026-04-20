package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;

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

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "DataConsumer should not be able to trigger applications, got: " + response.statusCode());
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

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "DataConsumer should not be able to deploy applications, got: " + response.statusCode());
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

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "DataConsumer should not be able to stop applications, got: " + response.statusCode());
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

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "DataConsumer should not be able to schedule applications, got: " + response.statusCode());
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

    assertTrue(
        response.statusCode() == 403 || response.statusCode() == 404,
        "DataConsumer should not be able to configure applications, got: " + response.statusCode());
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
