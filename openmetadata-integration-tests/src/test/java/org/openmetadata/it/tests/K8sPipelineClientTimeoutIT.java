/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import io.kubernetes.client.openapi.Configuration;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.clients.pipeline.k8s.K8sPipelineClient;
import org.openmetadata.service.exception.IngestionPipelineDeploymentException;

@Isolated("Temporarily replaces the default Kubernetes API client")
class K8sPipelineClientTimeoutIT {
  @TempDir Path directory;

  @ParameterizedTest
  @CsvSource({
    "false,false,configmaps", "false,true,configmaps",
    "true,false,configmaps", "true,true,configmaps",
    "false,false,secrets", "false,true,secrets",
    "true,false,secrets", "true,true,secrets"
  })
  void timedOutDeploymentCleansUpAndCanBeRetried(
      boolean fileConfig, boolean partialBody, String stalledResource) throws Exception {
    final var originalClient = Configuration.getDefaultApiClient();
    final HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
    final AtomicInteger configRequests = new AtomicInteger();
    final AtomicBoolean stalled = new AtomicBoolean(true);
    final Set<String> resources = ConcurrentHashMap.newKeySet();
    server.createContext(
        "/",
        exchange -> {
          exchange.getRequestBody().readAllBytes();
          final String path = exchange.getRequestURI().getPath();
          if (stalled.get() && path.contains(stalledResource)) {
            configRequests.incrementAndGet();
            if (partialBody) {
              exchange.sendResponseHeaders(200, 100);
              exchange.getResponseBody().write('{');
              exchange.getResponseBody().flush();
            }
            return;
          }
          final String resource = path.contains("configmaps") ? "configmaps" : "secrets";
          final String method = exchange.getRequestMethod();
          if (method.equals("POST") && (path.contains("configmaps") || path.contains("secrets"))) {
            resources.add(resource);
          } else if (method.equals("DELETE")
              && (path.contains("configmaps") || path.contains("secrets"))) {
            resources.remove(resource);
          }
          final int status = method.equals("GET") && !path.endsWith("/namespaces/test") ? 404 : 200;
          final byte[] body = "{\"metadata\":{\"name\":\"test\"}}".getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(status, body.length);
          try (var output = exchange.getResponseBody()) {
            output.write(body);
          }
        });
    server.start();
    try {
      final K8sPipelineClient client = new K8sPipelineClient(config(server, fileConfig));
      final IngestionPipeline pipeline = pipeline();
      final DatabaseService service =
          new DatabaseService()
              .withName("test_service")
              .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql);

      assertTimeoutPreemptively(
          Duration.ofSeconds(5),
          () ->
              assertThrows(
                  IngestionPipelineDeploymentException.class,
                  () -> client.deployPipeline(pipeline, service)));
      assertTrue(configRequests.get() > 0);
      assertFalse(Boolean.TRUE.equals(pipeline.getDeployed()));
      assertTrue(resources.isEmpty());
      stalled.set(false);
      assertEquals(200, client.deployPipeline(pipeline, service).getCode());
      assertTrue(pipeline.getDeployed());
      assertEquals(Set.of("configmaps", "secrets"), resources);
    } finally {
      server.stop(0);
      Configuration.setDefaultApiClient(originalClient);
    }
  }

  private PipelineServiceClientConfiguration config(HttpServer server, boolean fileConfig)
      throws Exception {
    final String kubeConfig =
        """
        apiVersion: v1
        kind: Config
        clusters:
        - name: test
          cluster:
            server: http://localhost:%d
        contexts:
        - name: test
          context:
            cluster: test
            user: test
        current-context: test
        users:
        - name: test
          user: {}
        """
            .formatted(server.getAddress().getPort());
    final Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("namespace", "test");
    parameters.setAdditionalProperty("inCluster", "false");
    parameters.setAdditionalProperty("timeout", "1");
    if (fileConfig) {
      final Path path = directory.resolve("kubeconfig.yaml");
      Files.writeString(path, kubeConfig);
      parameters.setAdditionalProperty("kubeconfigPath", path.toString());
    } else {
      parameters.setAdditionalProperty("kubeConfigContent", kubeConfig);
    }
    return new PipelineServiceClientConfiguration()
        .withEnabled(true)
        .withMetadataApiEndpoint("http://localhost:8585/api")
        .withParameters(parameters);
  }

  private static IngestionPipeline pipeline() {
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("test_timeout")
        .withFullyQualifiedName("test_service.test_timeout")
        .withPipelineType(PipelineType.METADATA)
        .withAirflowConfig(new AirflowConfig())
        .withEnabled(true)
        .withService(new EntityReference().withName("test_service").withType("databaseService"))
        .withOpenMetadataServerConnection(
            new OpenMetadataConnection()
                .withHostPort("http://localhost:8585")
                .withAuthProvider(AuthProvider.OPENMETADATA)
                .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken("test-token")));
  }
}
