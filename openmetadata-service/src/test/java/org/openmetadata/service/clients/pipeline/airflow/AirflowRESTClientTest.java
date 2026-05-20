/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.clients.pipeline.airflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyStoreException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.service.clients.pipeline.PipelineServiceClient;
import org.openmetadata.service.exception.IngestionPipelineDeploymentException;

class AirflowRESTClientTest {

  @Test
  void buildUriDetectsPluginsV2EndpointsAndReportsHealthyStatus() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      String healthPath = basePath + "/pluginsv2/api/v2/openmetadata/health-auth";
      String version = PipelineServiceClient.getServerVersion();
      server.enqueue("GET", healthPath, 200, "{\"version\":\"" + version + "\"}");
      server.enqueue("GET", healthPath, 200, "{\"version\":\"" + version + "\"}");

      AirflowRESTClient client = newClient(server, basePath);

      assertEquals(
          server.url(basePath + "/pluginsv2/api/v2/openmetadata/deploy"),
          client.buildURI("deploy").build().toString());
      assertEquals(version, client.getAirflowVersion());
      assertEquals("v2 (pluginsv2)", client.getApiVersion());

      PipelineServiceClientResponse status = client.getServiceStatusInternal();

      assertEquals(200, status.getCode());
      assertEquals(version, status.getVersion());
      assertEquals("Airflow", status.getPlatform());
    }
  }

  @Test
  void buildUriFallsBackToV2EndpointsWhenPluginsV2IsUnavailable() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      server.enqueue("GET", basePath + "/pluginsv2/api/v2/openmetadata/health-auth", 404, "");
      server.enqueue(
          "GET", basePath + "/api/v2/openmetadata/health-auth", 200, "{\"version\":\"2.9.1\"}");

      AirflowRESTClient client = newClient(server, basePath);

      assertEquals(
          server.url(basePath + "/api/v2/openmetadata/status"),
          client.buildURI("status").build().toString());
      assertEquals("2.9.1", client.getAirflowVersion());
      assertEquals("v2", client.getApiVersion());
    }
  }

  @Test
  void buildUriFallsBackToV1EndpointsWhenNewerApisAreUnavailable() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      server.enqueue("GET", basePath + "/pluginsv2/api/v2/openmetadata/health-auth", 404, "");
      server.enqueue("GET", basePath + "/api/v2/openmetadata/health-auth", 404, "");
      server.enqueue(
          "GET", basePath + "/api/v1/openmetadata/health-auth", 200, "{\"version\":\"1.10.15\"}");

      AirflowRESTClient client = newClient(server, basePath);

      assertEquals(
          server.url(basePath + "/api/v1/openmetadata/status"),
          client.buildURI("status").build().toString());
      assertEquals("1.10.15", client.getAirflowVersion());
      assertEquals("v1", client.getApiVersion());
    }
  }

  @Test
  void buildUriRetriesDetectionAfterNoApiVersionResponds() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      server.enqueue("GET", basePath + "/pluginsv2/api/v2/openmetadata/health-auth", 404, "");
      server.enqueue("GET", basePath + "/api/v2/openmetadata/health-auth", 404, "");
      server.enqueue("GET", basePath + "/api/v1/openmetadata/health-auth", 404, "");

      AirflowRESTClient client = newClient(server, basePath);

      PipelineServiceClientException exception =
          assertThrows(PipelineServiceClientException.class, () -> client.buildURI("deploy"));
      assertTrue(exception.getMessage().contains("Unable to connect to Airflow APIs"));

      String version = PipelineServiceClient.getServerVersion();
      server.enqueue(
          "GET",
          basePath + "/pluginsv2/api/v2/openmetadata/health-auth",
          200,
          "{\"version\":\"" + version + "\"}");

      assertEquals(
          server.url(basePath + "/pluginsv2/api/v2/openmetadata/deploy"),
          client.buildURI("deploy").build().toString());
    }
  }

  @Test
  void deployPipelineRefreshesCsrfTokenAndRetriesExpiredPostRequests() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      String prefix = basePath + "/pluginsv2/api/v2/openmetadata";
      String version = PipelineServiceClient.getServerVersion();
      server.enqueue("GET", prefix + "/health-auth", 200, "{\"version\":\"" + version + "\"}");
      server.enqueue(
          "GET",
          prefix + "/csrf-token",
          200,
          "{\"csrf_token\":\"csrf-1\"}",
          cookieHeaders("session=session-1; Path=/", "csrf_token=cookie-1; Path=/"));
      server.enqueue("POST", prefix + "/deploy", 400, "CSRF token has expired");
      server.enqueue(
          "GET",
          prefix + "/csrf-token",
          200,
          "{\"csrf_token\":\"csrf-2\"}",
          cookieHeaders("session=session-2; Path=/", "csrf_token=cookie-2; Path=/"));
      server.enqueue("POST", prefix + "/deploy", 200, "{\"status\":\"ok\"}");

      AirflowRESTClient client = newClient(server, basePath);
      IngestionPipeline pipeline = ingestionPipeline("orders_metadata", true);

      PipelineServiceClientResponse response = client.deployPipeline(pipeline, null);

      assertEquals(200, response.getCode());
      assertTrue(pipeline.getDeployed());
      List<RequestRecord> deployRequests = server.requests("POST", prefix + "/deploy");
      assertEquals(2, deployRequests.size());
      assertEquals("csrf-1", deployRequests.get(0).header("X-CSRFToken"));
      assertTrue(deployRequests.get(0).header("Cookie").contains("session=session-1"));
      assertTrue(deployRequests.get(0).body().contains("\"name\":\"orders_metadata\""));
      assertEquals("csrf-2", deployRequests.get(1).header("X-CSRFToken"));
      assertTrue(deployRequests.get(1).header("Cookie").contains("session=session-2"));
    }
  }

  @Test
  void deletePipelineRefreshesCsrfTokenAndRetriesExpiredDeleteRequests() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      String prefix = basePath + "/pluginsv2/api/v2/openmetadata";
      String version = PipelineServiceClient.getServerVersion();
      server.enqueue("GET", prefix + "/health-auth", 200, "{\"version\":\"" + version + "\"}");
      server.enqueue(
          "GET",
          prefix + "/csrf-token",
          200,
          "{\"csrf_token\":\"delete-1\"}",
          cookieHeaders("session=session-delete-1; Path=/", "csrf_token=delete-cookie-1; Path=/"));
      server.enqueue("DELETE", prefix + "/delete", 400, "CSRF token has expired");
      server.enqueue(
          "GET",
          prefix + "/csrf-token",
          200,
          "{\"csrf_token\":\"delete-2\"}",
          cookieHeaders("session=session-delete-2; Path=/", "csrf_token=delete-cookie-2; Path=/"));
      server.enqueue("DELETE", prefix + "/delete", 200, "{\"status\":\"deleted\"}");

      AirflowRESTClient client = newClient(server, basePath);
      IngestionPipeline pipeline = ingestionPipeline("orders_metadata", true);

      PipelineServiceClientResponse response = client.deletePipeline(pipeline);

      assertEquals(200, response.getCode());
      List<RequestRecord> deleteRequests = server.requests("DELETE", prefix + "/delete");
      assertEquals(2, deleteRequests.size());
      assertTrue(deleteRequests.get(0).query().contains("dag_id=orders_metadata"));
      assertEquals("delete-1", deleteRequests.get(0).header("X-CSRFToken"));
      assertEquals("delete-2", deleteRequests.get(1).header("X-CSRFToken"));
    }
  }

  @Test
  void getServiceStatusReportsAuthFailuresAndMissingPlugins() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      String healthPath = basePath + "/pluginsv2/api/v2/openmetadata/health-auth";
      String version = PipelineServiceClient.getServerVersion();

      server.enqueue("GET", healthPath, 200, "{\"version\":\"" + version + "\"}");
      server.enqueue("GET", healthPath, 401, "{\"detail\":\"denied\"}");
      AirflowRESTClient authFailureClient = newClient(server, basePath);
      PipelineServiceClientResponse authFailure = authFailureClient.getServiceStatusInternal();
      assertEquals(500, authFailure.getCode());
      assertTrue(authFailure.getReason().contains("Authentication failed"));

      server.enqueue("GET", healthPath, 200, "{\"version\":\"" + version + "\"}");
      server.enqueue("GET", healthPath, 404, "{\"detail\":\"missing\"}");
      AirflowRESTClient missingPluginClient = newClient(server, basePath);
      PipelineServiceClientResponse missingPlugin = missingPluginClient.getServiceStatusInternal();
      assertEquals(500, missingPlugin.getCode());
      assertTrue(missingPlugin.getReason().contains("Airflow APIs not found"));
    }
  }

  @Test
  void getServiceStatusReportsVersionMismatch() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      String healthPath = basePath + "/pluginsv2/api/v2/openmetadata/health-auth";
      String mismatchVersion =
          PipelineServiceClient.getServerVersion().startsWith("9.9.") ? "1.0.0" : "9.9.9";
      server.enqueue("GET", healthPath, 200, "{\"version\":\"" + mismatchVersion + "\"}");
      server.enqueue("GET", healthPath, 200, "{\"version\":\"" + mismatchVersion + "\"}");

      AirflowRESTClient client = newClient(server, basePath);
      PipelineServiceClientResponse status = client.getServiceStatusInternal();

      assertEquals(500, status.getCode());
      assertTrue(
          status.getReason().contains("upgrade your server")
              || status.getReason().contains("upgrade your ingestion client"));
    }
  }

  @Test
  void pipelineOperationsAndUtilityEndpointsUseDetectedApi() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      String prefix = basePath + "/pluginsv2/api/v2/openmetadata";
      String version = PipelineServiceClient.getServerVersion();
      server.enqueue("GET", prefix + "/health-auth", 200, "{\"version\":\"" + version + "\"}");
      server.enqueue(
          "GET",
          prefix + "/csrf-token",
          200,
          "{\"csrf_token\":\"shared-token\"}",
          cookieHeaders("session=session-shared; Path=/", "csrf_token=cookie-shared; Path=/"));
      server.enqueue("POST", prefix + "/trigger", 200, "{\"status\":\"triggered\"}");
      server.enqueue("GET", prefix + "/status", 200, "[]");
      server.enqueue("GET", prefix + "/ip", 200, "{\"ip\":\"127.0.0.1\"}");
      server.enqueue("GET", prefix + "/last_dag_logs", 200, "{\"message\":\"done\"}");
      server.enqueue("POST", prefix + "/enable", 200, "{\"status\":\"enabled\"}");
      server.enqueue("POST", prefix + "/disable", 404, "{\"status\":\"missing\"}");
      server.enqueue("POST", prefix + "/kill", 200, "{\"status\":\"killed\"}");
      server.enqueue("POST", prefix + "/run_application", 200, "{\"status\":\"application\"}");
      server.enqueue("POST", prefix + "/run_automation", 200, "{\"status\":\"automation\"}");

      AirflowRESTClient client = newClient(server, basePath);
      IngestionPipeline pipeline = ingestionPipeline("orders_metadata", false);

      PipelineServiceClientResponse triggerResponse =
          client.runPipeline(pipeline, null, Map.of("retries", 2, "force", true));
      assertEquals(200, triggerResponse.getCode());
      RequestRecord triggerRequest = server.requests("POST", prefix + "/trigger").get(0);
      assertTrue(triggerRequest.body().contains("\"dag_id\":\"orders_metadata\""));
      assertTrue(triggerRequest.body().contains("\"appConfigOverride\""));
      assertTrue(triggerRequest.body().contains("\"retries\":2"));

      assertTrue(client.getQueuedPipelineStatusInternal(pipeline).isEmpty());
      assertEquals(Map.of("ip", "127.0.0.1"), client.requestGetHostIp());
      assertEquals(Map.of("message", "done"), client.getLastIngestionLogs(pipeline, "cursor-1"));

      PipelineServiceClientResponse enableResponse = client.toggleIngestion(pipeline);
      assertEquals(200, enableResponse.getCode());
      assertTrue(pipeline.getEnabled());

      IngestionPipeline missingPipeline = ingestionPipeline("missing_pipeline", true);
      missingPipeline.setDeployed(true);
      PipelineServiceClientResponse missingResponse = client.toggleIngestion(missingPipeline);
      assertEquals(404, missingResponse.getCode());
      assertFalse(missingPipeline.getDeployed());

      assertEquals(200, client.killIngestion(pipeline).getCode());
      assertEquals(200, client.runApplicationFlow(new App().withName("quality-app")).getCode());
      assertEquals(
          200, client.runAutomationsWorkflow(new Workflow().withName("nightly")).getCode());
      assertEquals(
          "Success", client.validateAppRegistration(new AppMarketPlaceDefinition()).getReason());

      RequestRecord logsRequest = server.requests("GET", prefix + "/last_dag_logs").get(0);
      assertTrue(logsRequest.query().contains("after=cursor-1"));
      assertTrue(logsRequest.query().contains("task_id=ingestion_task"));
      assertTrue(logsRequest.query().contains("dag_id=orders_metadata"));
    }
  }

  @Test
  void failurePathsSurfaceExpectedClientResponses() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      String prefix = basePath + "/pluginsv2/api/v2/openmetadata";
      String version = PipelineServiceClient.getServerVersion();
      server.enqueue("GET", prefix + "/health-auth", 200, "{\"version\":\"" + version + "\"}");
      server.enqueue(
          "GET",
          prefix + "/csrf-token",
          200,
          "{\"csrf_token\":\"shared-token\"}",
          cookieHeaders("session=session-shared; Path=/", "csrf_token=cookie-shared; Path=/"));
      server.enqueue("POST", prefix + "/deploy", 500, "{\"error\":\"deploy\"}");
      server.enqueue("DELETE", prefix + "/delete", 500, "{\"error\":\"delete\"}");
      server.enqueue("POST", prefix + "/trigger", 200, "{\"status\":\"triggered\"}");
      server.enqueue("POST", prefix + "/disable", 500, "{\"error\":\"toggle\"}");
      server.enqueue("GET", prefix + "/status", 500, "{\"error\":\"status\"}");
      server.enqueue("GET", prefix + "/health-auth", 500, "{\"error\":\"unexpected\"}");
      server.enqueue("POST", prefix + "/run_application", 500, "{\"error\":\"application\"}");
      server.enqueue("POST", prefix + "/run_automation", 500, "{\"error\":\"automation\"}");
      server.enqueue("POST", prefix + "/kill", 500, "{\"error\":\"kill\"}");
      server.enqueue("GET", prefix + "/ip", 500, "{\"error\":\"ip\"}");
      server.enqueue("GET", prefix + "/last_dag_logs", 500, "{\"error\":\"logs\"}");

      AirflowRESTClient client = newClient(server, basePath);
      IngestionPipeline pipeline = ingestionPipeline("orders_metadata", true);

      PipelineServiceClientException deployException =
          assertThrows(
              PipelineServiceClientException.class, () -> client.deployPipeline(pipeline, null));
      assertTrue(deployException.getMessage().contains("Failed to deploy Ingestion Pipeline"));

      PipelineServiceClientResponse deleteResponse = client.deletePipeline(pipeline);
      assertEquals(500, deleteResponse.getCode());
      assertTrue(deleteResponse.getReason().contains("Failed to delete Airflow Pipeline"));

      IngestionPipeline triggerPipeline = ingestionPipeline("orders_metadata", false);
      assertEquals(200, client.runPipeline(triggerPipeline, null).getCode());

      PipelineServiceClientException toggleException =
          assertThrows(
              PipelineServiceClientException.class,
              () -> client.toggleIngestion(ingestionPipeline("broken_pipeline", true)));
      assertTrue(
          toggleException.getMessage().contains("Failed to toggle ingestion pipeline state"));

      assertTrue(client.getQueuedPipelineStatusInternal(pipeline).isEmpty());

      PipelineServiceClientResponse unexpectedStatus = client.getServiceStatusInternal();
      assertEquals(500, unexpectedStatus.getCode());
      assertTrue(unexpectedStatus.getReason().contains("Unexpected status response"));

      assertThrows(
          PipelineServiceClientException.class,
          () -> client.runApplicationFlow(new App().withName("bad-app")));
      assertThrows(
          PipelineServiceClientException.class,
          () -> client.runAutomationsWorkflow(new Workflow().withName("bad-workflow")));
      assertThrows(PipelineServiceClientException.class, () -> client.killIngestion(pipeline));
      assertThrows(PipelineServiceClientException.class, client::requestGetHostIp);
      assertThrows(
          PipelineServiceClientException.class, () -> client.getLastIngestionLogs(pipeline, null));

      RequestRecord lastLogsRequest = server.requests("GET", prefix + "/last_dag_logs").get(0);
      assertFalse(lastLogsRequest.query().contains("after="));
    }
  }

  @Test
  void healthEndpointCsrfFetchStoresCookiesForSubsequentRequests() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      String prefix = basePath + "/pluginsv2/api/v2/openmetadata";
      String version = PipelineServiceClient.getServerVersion();
      server.enqueue("GET", prefix + "/health-auth", 200, "{\"version\":\"" + version + "\"}");
      server.enqueue(
          "GET",
          prefix + "/health",
          200,
          "{\"status\":\"ok\"}",
          cookieHeaders("session=health-session; Path=/", "csrf_token=health-token; Path=/"));
      server.enqueue("POST", prefix + "/run_application", 200, "{\"status\":\"application\"}");

      AirflowRESTClient client = newClient(server, basePath);
      invokePrivate(client, "fetchCsrfTokenFromHealthEndpoint");

      assertEquals(200, client.runApplicationFlow(new App().withName("quality-app")).getCode());

      RequestRecord request = server.requests("POST", prefix + "/run_application").get(0);
      assertEquals("health-token", request.header("X-CSRFToken"));
      assertTrue(request.header("Cookie").contains("session=health-session"));
    }
  }

  @Test
  void connectionFailuresAreTranslatedIntoStableClientErrors() throws Exception {
    AirflowTestServer server = new AirflowTestServer();
    String basePath = "/airflow";
    String prefix = basePath + "/pluginsv2/api/v2/openmetadata";
    String version = PipelineServiceClient.getServerVersion();
    server.enqueue("GET", prefix + "/health-auth", 200, "{\"version\":\"" + version + "\"}");

    AirflowRESTClient client = newClient(server, basePath);
    assertEquals("v2 (pluginsv2)", client.getApiVersion());
    server.close();

    IngestionPipeline pipeline = ingestionPipeline("orders_metadata", true);

    IngestionPipelineDeploymentException deployException =
        assertThrows(
            IngestionPipelineDeploymentException.class,
            () -> client.deployPipeline(pipeline, null));
    assertTrue(deployException.getMessage().contains("orders_metadata"));

    PipelineServiceClientResponse deleteResponse = client.deletePipeline(pipeline);
    assertEquals(500, deleteResponse.getCode());

    IngestionPipelineDeploymentException triggerException =
        assertThrows(
            IngestionPipelineDeploymentException.class,
            () -> client.runPipeline(pipeline, null, Map.of("force", true)));
    assertTrue(triggerException.getMessage().contains("orders_metadata"));

    PipelineServiceClientException toggleException =
        assertThrows(PipelineServiceClientException.class, () -> client.toggleIngestion(pipeline));
    assertTrue(toggleException.getMessage().contains("orders_metadata"));

    assertThrows(
        PipelineServiceClientException.class,
        () -> client.getQueuedPipelineStatusInternal(pipeline));

    PipelineServiceClientResponse status = client.getServiceStatusInternal();
    assertEquals(500, status.getCode());
    assertTrue(status.getReason().contains("Airflow"));

    IngestionPipelineDeploymentException workflowException =
        assertThrows(
            IngestionPipelineDeploymentException.class,
            () -> client.runAutomationsWorkflow(new Workflow().withName("nightly")));
    assertTrue(workflowException.getMessage().contains("No response from the test connection"));

    IngestionPipelineDeploymentException applicationException =
        assertThrows(
            IngestionPipelineDeploymentException.class,
            () -> client.runApplicationFlow(new App().withName("quality-app")));
    assertTrue(applicationException.getMessage().contains("quality-app"));

    assertThrows(PipelineServiceClientException.class, () -> client.killIngestion(pipeline));
    assertThrows(PipelineServiceClientException.class, client::requestGetHostIp);
    assertThrows(
        PipelineServiceClientException.class,
        () -> client.getLastIngestionLogs(pipeline, "cursor"));
  }

  @Test
  void runPipelineThrowsDeploymentExceptionWhenAirflowReturnsAnError() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      String basePath = "/airflow";
      String prefix = basePath + "/pluginsv2/api/v2/openmetadata";
      String version = PipelineServiceClient.getServerVersion();
      server.enqueue("GET", prefix + "/health-auth", 200, "{\"version\":\"" + version + "\"}");
      server.enqueue(
          "GET",
          prefix + "/csrf-token",
          200,
          "{\"csrf_token\":\"shared-token\"}",
          cookieHeaders("session=session-shared; Path=/", "csrf_token=cookie-shared; Path=/"));
      server.enqueue("POST", prefix + "/trigger", 500, "{\"error\":\"failed\"}");

      AirflowRESTClient client = newClient(server, basePath);
      IngestionPipeline pipeline = ingestionPipeline("orders_metadata", false);

      IngestionPipelineDeploymentException exception =
          assertThrows(
              IngestionPipelineDeploymentException.class,
              () -> client.runPipeline(pipeline, null, Map.of("force", true)));

      assertTrue(exception.getMessage().contains("Failed to trigger IngestionPipeline"));
    }
  }

  @Test
  void constructorHandlesStringTimeout() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      AirflowRESTClient client = newClient(server, "", "10");
      assertEquals("Airflow", client.getPlatform());
    }
  }

  @Test
  void constructorHandlesIntegerTimeout() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      AirflowRESTClient client = newClient(server, "", 10);
      assertEquals("Airflow", client.getPlatform());
    }
  }

  @Test
  void constructorHandlesLongTimeout() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      AirflowRESTClient client = newClient(server, "", 30L);
      assertEquals("Airflow", client.getPlatform());
    }
  }

  @Test
  void constructorHandlesNullParameters() {
    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setApiEndpoint("http://localhost:8080");
    config.setMetadataApiEndpoint("http://localhost:8585/api");
    config.setParameters(null);

    PipelineServiceClientException exception =
        assertThrows(PipelineServiceClientException.class, () -> new AirflowRESTClient(config));
    assertTrue(exception.getMessage().contains("Missing Airflow credentials"));
  }

  @Test
  void constructorHandlesNonNumericTimeout() throws Exception {
    try (AirflowTestServer server = new AirflowTestServer()) {
      AirflowRESTClient client = newClient(server, "", "abc");
      assertEquals("Airflow", client.getPlatform());
    }
  }

  @Test
  void constructorHandlesNullAdditionalProperties() throws Exception {
    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setApiEndpoint("http://localhost:8080");
    config.setMetadataApiEndpoint("http://localhost:8585/api");
    Parameters parameters = new Parameters();
    java.lang.reflect.Field field = Parameters.class.getDeclaredField("additionalProperties");
    field.setAccessible(true);
    field.set(parameters, null);
    config.setParameters(parameters);

    PipelineServiceClientException exception =
        assertThrows(PipelineServiceClientException.class, () -> new AirflowRESTClient(config));
    assertTrue(exception.getMessage().contains("Missing Airflow credentials"));
  }

  @Test
  void constructorHandlesMissingCredentials() {
    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setApiEndpoint("http://localhost:8080");
    config.setMetadataApiEndpoint("http://localhost:8585/api");
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("timeout", "10");
    config.setParameters(parameters);

    PipelineServiceClientException exception =
        assertThrows(PipelineServiceClientException.class, () -> new AirflowRESTClient(config));
    assertTrue(exception.getMessage().contains("Missing Airflow credentials"));
  }

  private static AirflowRESTClient newClient(AirflowTestServer server, String basePath)
      throws KeyStoreException {
    return newClient(server, basePath, 5);
  }

  private static AirflowRESTClient newClient(
      AirflowTestServer server, String basePath, Object timeout) throws KeyStoreException {
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("username", "airflow");
    parameters.setAdditionalProperty("password", "admin");
    parameters.setAdditionalProperty("timeout", timeout);

    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setApiEndpoint(server.url(basePath));
    config.setMetadataApiEndpoint("http://localhost:8585/api");
    config.setParameters(parameters);
    return new AirflowRESTClient(config);
  }

  private static IngestionPipeline ingestionPipeline(String name, boolean enabled) {
    return new IngestionPipeline()
        .withName(name)
        .withEnabled(enabled)
        .withPipelineType(PipelineType.METADATA);
  }

  private static Map<String, List<String>> cookieHeaders(String... values) {
    return Map.of("Set-Cookie", List.of(values));
  }

  private static void invokePrivate(Object target, String methodName) throws Exception {
    Method method = target.getClass().getDeclaredMethod(methodName);
    method.setAccessible(true);
    method.invoke(target);
  }

  private record RequestRecord(
      String method, String path, String query, Map<String, List<String>> headers, String body) {
    private String header(String name) {
      return headers.getOrDefault(name.toLowerCase(), List.of("")).stream().findFirst().orElse("");
    }
  }

  private record ResponseSpec(int statusCode, String body, Map<String, List<String>> headers) {}

  private static final class AirflowTestServer implements AutoCloseable {
    private final HttpServer server;
    private final Map<String, Deque<ResponseSpec>> responses = new HashMap<>();
    private final List<RequestRecord> requests = new CopyOnWriteArrayList<>();

    private AirflowTestServer() throws IOException {
      server = HttpServer.create(new InetSocketAddress(0), 0);
      server.createContext("/", this::handle);
      server.start();
    }

    private void enqueue(String method, String path, int statusCode, String body) {
      enqueue(method, path, statusCode, body, Map.of());
    }

    private void enqueue(
        String method,
        String path,
        int statusCode,
        String body,
        Map<String, List<String>> headers) {
      responses
          .computeIfAbsent(method + " " + path, ignored -> new ArrayDeque<>())
          .addLast(new ResponseSpec(statusCode, body, headers));
    }

    private List<RequestRecord> requests(String method, String path) {
      return requests.stream()
          .filter(record -> record.method().equals(method) && record.path().equals(path))
          .toList();
    }

    private String url(String path) {
      String normalizedPath = path == null || path.isBlank() ? "" : path;
      return "http://localhost:" + server.getAddress().getPort() + normalizedPath;
    }

    private void handle(HttpExchange exchange) throws IOException {
      String method = exchange.getRequestMethod();
      String path = exchange.getRequestURI().getPath();
      Map<String, List<String>> normalizedHeaders = new HashMap<>();
      exchange
          .getRequestHeaders()
          .forEach(
              (name, values) -> normalizedHeaders.put(name.toLowerCase(), new ArrayList<>(values)));
      String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
      requests.add(
          new RequestRecord(
              method,
              path,
              Objects.requireNonNullElse(exchange.getRequestURI().getRawQuery(), ""),
              normalizedHeaders,
              body));

      ResponseSpec response =
          responses.getOrDefault(method + " " + path, new ArrayDeque<>()).pollFirst();
      if (response == null) {
        response = new ResponseSpec(404, "", Map.of());
      }

      Headers responseHeaders = exchange.getResponseHeaders();
      response
          .headers()
          .forEach((name, values) -> responseHeaders.put(name, new ArrayList<>(values)));

      byte[] payload = response.body().getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(response.statusCode(), payload.length);
      try (OutputStream outputStream = exchange.getResponseBody()) {
        outputStream.write(payload);
      }
    }

    @Override
    public void close() {
      server.stop(0);
    }
  }
}
