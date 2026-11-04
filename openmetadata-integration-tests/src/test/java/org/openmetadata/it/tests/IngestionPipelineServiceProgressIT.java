/*
 *  Copyright 2025 Collate
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IngestionPipelineServiceProgressIT {
  private static final String API_BASE = "/v1/services/ingestionPipelines";

  @ParameterizedTest
  @ValueSource(strings = {"table", "user", "testSuite", "unknownType"})
  void serviceStreamRequiresServiceType(String type, TestNamespace ns) throws IOException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    assertEquals(400, status(type, service.getFullyQualifiedName(), SdkClients.getAdminToken()));
  }

  @Test
  void serviceStreamRequiresExistingService(TestNamespace ns) throws IOException {
    assertEquals(
        404, status(Entity.DATABASE_SERVICE, ns.prefix("missing"), SdkClients.getAdminToken()));
  }

  @Test
  void serviceStreamRespectsServicePermissions(TestNamespace ns) throws IOException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    User viewer = createViewer(ns, Entity.DATABASE_SERVICE, null);
    String token = token(viewer);
    assertEquals(403, status(Entity.DATABASE_SERVICE, service.getFullyQualifiedName(), token));
    assertEquals(400, status(Entity.TABLE, service.getFullyQualifiedName(), token));
  }

  @Test
  void serviceStreamOmitsPipelinesTheViewerCannotRead(TestNamespace ns) throws IOException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    User viewer = createViewer(ns, Entity.INGESTION_PIPELINE, "!isOwner()");
    IngestionPipeline hidden = createPipeline(ns, service, "hidden", null);
    IngestionPipeline visible = createPipeline(ns, service, "visible", viewer);
    seedProgress(hidden, "DISCOVERY");
    seedProgress(visible, "DISCOVERY");
    String token = token(viewer);

    assertEquals(403, requestStatus(API_BASE + "/name/" + hidden.getFullyQualifiedName(), token));
    assertEquals(
        403,
        requestStatus(
            API_BASE
                + "/progress/"
                + hidden.getFullyQualifiedName()
                + "/stream/"
                + UUID.randomUUID(),
            token));

    HttpURLConnection connection =
        connection(servicePath(Entity.DATABASE_SERVICE, service.getFullyQualifiedName()), token);
    try {
      assertEquals(200, connection.getResponseCode());
      IngestionPipeline hiddenLive = createPipeline(ns, service, "hiddenLive", null);
      seedProgress(hiddenLive, "DISCOVERY");
      seedProgress(hidden, "PROCESSING");
      seedProgress(visible, "PROCESSING");
      List<String> events = readEvents(connection);
      assertFalse(events.isEmpty());
      assertTrue(
          events.stream().allMatch(event -> event.contains(visible.getFullyQualifiedName())),
          events.toString());
      assertTrue(events.stream().anyMatch(event -> event.contains("DISCOVERY")), events.toString());
      assertTrue(
          events.stream().anyMatch(event -> event.contains("PROCESSING")), events.toString());
    } finally {
      connection.disconnect();
    }
  }

  @Test
  void serviceStreamExcludesPreviousDiscovery(TestNamespace ns) throws IOException {
    assertPreviousPipelineInstanceOmitted("DISCOVERY", ns);
  }

  @Test
  void serviceStreamExcludesPreviousProcessing(TestNamespace ns) throws IOException {
    assertPreviousPipelineInstanceOmitted("PROCESSING", ns);
  }

  private void assertPreviousPipelineInstanceOmitted(String updateType, TestNamespace ns)
      throws IOException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    User viewer = createViewer(ns, Entity.INGESTION_PIPELINE, "!isOwner()");
    IngestionPipeline previous = createPipeline(ns, service, "reused", null);
    String token = token(viewer);
    assertEquals(403, requestStatus(API_BASE + "/name/" + previous.getFullyQualifiedName(), token));
    UUID previousRun = seedProgress(previous, updateType);
    SdkClients.adminClient()
        .ingestionPipelines()
        .delete(previous.getId().toString(), Map.of("hardDelete", "true", "force", "true"));
    IngestionPipeline replacement = createPipeline(ns, service, "reused", viewer);
    assertEquals(previous.getFullyQualifiedName(), replacement.getFullyQualifiedName());
    assertEquals(
        200, requestStatus(API_BASE + "/name/" + replacement.getFullyQualifiedName(), token));
    if ("PROCESSING".equals(updateType)) {
      seedProgress(previous, previousRun, "PROCESSING");
    }
    UUID currentRun = seedProgress(replacement, "PROCESSING");

    HttpURLConnection connection =
        connection(servicePath(Entity.DATABASE_SERVICE, service.getFullyQualifiedName()), token);
    try {
      assertEquals(200, connection.getResponseCode());
      List<ServiceProgressEvent> events =
          readEvents(connection).stream()
              .map(data -> JsonUtils.readValue(data, ServiceProgressEvent.class))
              .toList();
      assertFalse(
          events.stream().anyMatch(event -> previousRun.toString().equals(event.getRunId())));
      assertTrue(events.stream().anyMatch(event -> currentRun.toString().equals(event.getRunId())));
    } finally {
      connection.disconnect();
    }
  }

  @Test
  void serviceStreamAppliesPolicyChangesWithoutReconnecting(TestNamespace ns) throws IOException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    User viewer = createViewer(ns, Entity.INGESTION_PIPELINE, "false");
    IngestionPipeline pipeline = createPipeline(ns, service, "policyUpdates", null);
    UUID initialRun = seedProgress(pipeline, "DISCOVERY");
    String token = token(viewer);
    HttpURLConnection connection =
        connection(servicePath(Entity.DATABASE_SERVICE, service.getFullyQualifiedName()), token);
    try {
      assertEquals(200, connection.getResponseCode());
      setViewDenied(ns, true);
      assertEquals(
          403, requestStatus(API_BASE + "/name/" + pipeline.getFullyQualifiedName(), token));
      UUID deniedRun = seedProgress(pipeline, "PROCESSING");

      setViewDenied(ns, false);
      assertEquals(
          200, requestStatus(API_BASE + "/name/" + pipeline.getFullyQualifiedName(), token));
      UUID allowedRun = seedProgress(pipeline, "PROCESSING");
      List<ServiceProgressEvent> events =
          readEvents(connection).stream()
              .map(data -> JsonUtils.readValue(data, ServiceProgressEvent.class))
              .toList();
      assertTrue(events.stream().anyMatch(event -> initialRun.toString().equals(event.getRunId())));
      assertFalse(events.stream().anyMatch(event -> deniedRun.toString().equals(event.getRunId())));
      assertTrue(events.stream().anyMatch(event -> allowedRun.toString().equals(event.getRunId())));
    } finally {
      connection.disconnect();
    }
  }

  private void setViewDenied(TestNamespace ns, boolean denied) {
    Policy policy =
        SdkClients.adminClient().policies().getByName(ns.prefix("progressPolicy"), "rules");
    policy.getRules().getFirst().setCondition(Boolean.toString(denied));
    SdkClients.adminClient().policies().update(policy.getId(), policy);
  }

  @Test
  void livePipelineUsesTheSubscribersRequestContext(TestNamespace ns) throws IOException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    User viewer = createViewer(ns, Entity.INGESTION_PIPELINE, "isImpersonated() && !isOwner()");
    IngestionPipeline visible = createPipeline(ns, service, "visible", viewer);
    seedProgress(visible, "DISCOVERY");
    String botToken = createImpersonatingBot(ns);
    HttpURLConnection connection =
        connection(servicePath(Entity.DATABASE_SERVICE, service.getFullyQualifiedName()), botToken);
    connection.setRequestProperty("X-Impersonate-User", viewer.getName());
    try {
      assertEquals(200, connection.getResponseCode());
      IngestionPipeline hidden = createPipeline(ns, service, "hidden", null);
      HttpURLConnection denied =
          connection(API_BASE + "/name/" + hidden.getFullyQualifiedName(), botToken);
      denied.setRequestProperty("Accept", "application/json");
      denied.setRequestProperty("X-Impersonate-User", viewer.getName());
      try {
        assertEquals(403, denied.getResponseCode());
      } finally {
        denied.disconnect();
      }
      seedProgress(hidden, "DISCOVERY");
      List<String> events = readEvents(connection);
      assertFalse(events.isEmpty());
      assertTrue(
          events.stream().allMatch(event -> event.contains(visible.getFullyQualifiedName())),
          events.toString());
    } finally {
      connection.disconnect();
    }
  }

  private String createImpersonatingBot(TestNamespace ns) {
    String name = "progressbot" + ns.shortPrefix();
    User botUser =
        ns.trackRoot(
            Entity.USER,
            SdkClients.adminClient()
                .users()
                .create(
                    new CreateUser()
                        .withName(name)
                        .withEmail(name + "@test.com")
                        .withIsBot(true)
                        .withAuthenticationMechanism(
                            new AuthenticationMechanism()
                                .withAuthType(AuthenticationMechanism.AuthType.JWT)
                                .withConfig(
                                    new JWTAuthMechanism()
                                        .withJWTTokenExpiry(JWTTokenExpiry.Unlimited)))));
    ns.trackRoot(
        Entity.BOT,
        SdkClients.adminClient()
            .bots()
            .create(
                new CreateBot()
                    .withName(ns.prefix("progressBot"))
                    .withBotUser(botUser.getName())
                    .withAllowImpersonation(true)));
    return SdkClients.adminClient()
        .users()
        .generateToken(botUser.getId(), JWTTokenExpiry.Seven)
        .getJWTToken();
  }

  @Test
  void serviceStreamUsesServiceDomain(TestNamespace ns) throws IOException {
    Domain domain =
        ns.trackRoot(
            Entity.DOMAIN,
            SdkClients.adminClient()
                .domains()
                .create(
                    new CreateDomain()
                        .withName(ns.prefix("serviceDomain"))
                        .withDescription("Service progress test domain")
                        .withDomainType(CreateDomain.DomainType.AGGREGATE)));
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    service.withDomains(List.of(domain.getEntityReference()));
    SdkClients.adminClient().databaseServices().update(service.getId(), service);
    Role role = SdkClients.adminClient().roles().getByName("DomainOnlyAccessRole");
    String name = ns.shortPrefix("outsideDomain");
    User viewer =
        ns.trackRoot(
            Entity.USER,
            SdkClients.adminClient()
                .users()
                .create(
                    new CreateUser()
                        .withName(name)
                        .withEmail(name + "@test.openmetadata.org")
                        .withRoles(List.of(role.getId()))));
    String token = token(viewer);
    assertEquals(
        403,
        requestStatus(
            "/v1/services/databaseServices/name/" + service.getFullyQualifiedName(), token));
    assertEquals(403, status(Entity.DATABASE_SERVICE, service.getFullyQualifiedName(), token));
    assertEquals(400, status(Entity.TABLE, service.getFullyQualifiedName(), token));
    assertEquals(
        404,
        status(
            Entity.DASHBOARD_SERVICE, service.getFullyQualifiedName(), SdkClients.getAdminToken()));
  }

  @Test
  void discoveryPipelineMatchesRegularReadMasking(TestNamespace ns) throws IOException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    IngestionPipeline pipeline =
        SdkClients.adminClient()
            .ingestionPipelines()
            .create(
                new CreateIngestionPipeline()
                    .withName(ns.prefix("dbt"))
                    .withPipelineType(PipelineType.DBT)
                    .withService(service.getEntityReference())
                    .withAirflowConfig(new AirflowConfig())
                    .withSourceConfig(
                        new SourceConfig()
                            .withConfig(
                                new DbtPipeline()
                                    .withDbtConfigSource(
                                        new DbtS3Config()
                                            .withDbtSecurityConfig(
                                                new AWSCredentials()
                                                    .withAwsSecretAccessKey("dbt-secret"))))));
    User viewer = createViewer(ns, Entity.TABLE, null);
    IngestionPipeline regular =
        SdkClients.createClient(viewer.getName(), viewer.getEmail(), new String[] {})
            .ingestionPipelines()
            .getByName(pipeline.getFullyQualifiedName());
    seedProgress(pipeline, "DISCOVERY");
    HttpURLConnection connection =
        connection(
            servicePath(Entity.DATABASE_SERVICE, service.getFullyQualifiedName()), token(viewer));
    try {
      assertEquals(200, connection.getResponseCode());
      List<String> events = readEvents(connection);
      assertEquals(1, events.size());
      IngestionPipeline streamed =
          JsonUtils.readValue(events.getFirst(), ServiceProgressEvent.class).getIngestionPipeline();
      assertEquals(
          JsonUtils.pojoToJson(regular.getSourceConfig()),
          JsonUtils.pojoToJson(streamed.getSourceConfig()));
      assertFalse(events.getFirst().contains("fernet:"));
      assertFalse(events.getFirst().contains("dbt-secret"));
      assertNull(streamed.getOpenMetadataServerConnection());
    } finally {
      connection.disconnect();
    }
  }

  private User createViewer(TestNamespace ns, String resource, String condition) {
    Policy policy =
        ns.trackRoot(
            Entity.POLICY,
            SdkClients.adminClient()
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(ns.prefix("progressPolicy"))
                        .withRules(
                            List.of(
                                new Rule()
                                    .withName("restrictedView")
                                    .withResources(List.of(resource))
                                    .withOperations(List.of(MetadataOperation.ALL))
                                    .withEffect(Rule.Effect.DENY)
                                    .withCondition(condition)))));
    Role role =
        ns.trackRoot(
            Entity.ROLE,
            SdkClients.adminClient()
                .roles()
                .create(
                    new CreateRole()
                        .withName(ns.prefix("progressRole"))
                        .withPolicies(List.of(policy.getFullyQualifiedName()))));
    String name = ns.shortPrefix("progressViewer");
    return ns.trackRoot(
        Entity.USER,
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.openmetadata.org")
                    .withRoles(List.of(role.getId()))));
  }

  private IngestionPipeline createPipeline(
      TestNamespace ns, DatabaseService service, String name, User owner) {
    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix(name))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new DatabaseServiceMetadataPipeline()
                            .withType(
                                DatabaseServiceMetadataPipeline.DatabaseMetadataConfigType
                                    .DATABASE_METADATA)))
            .withAirflowConfig(new AirflowConfig());
    if (owner != null) {
      request.withOwners(List.of(owner.getEntityReference()));
    }
    return SdkClients.adminClient().ingestionPipelines().create(request);
  }

  private UUID seedProgress(IngestionPipeline pipeline, String updateType) {
    UUID runId = UUID.randomUUID();
    seedProgress(pipeline, runId, updateType);
    return runId;
  }

  private void seedProgress(IngestionPipeline pipeline, UUID runId, String updateType) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            API_BASE + "/progress/" + pipeline.getFullyQualifiedName() + "/" + runId,
            Map.of(
                "runId",
                runId.toString(),
                "timestamp",
                System.currentTimeMillis(),
                "updateType",
                updateType,
                "currentEntity",
                pipeline.getFullyQualifiedName()),
            String.class);
  }

  private String token(User viewer) {
    return JwtAuthProvider.tokenFor(viewer.getName(), viewer.getEmail(), new String[] {}, 3600);
  }

  private String servicePath(String type, String fqn) {
    return API_BASE + "/progress/service/" + type + "/" + fqn + "/stream";
  }

  private int status(String type, String fqn, String token) throws IOException {
    return requestStatus(servicePath(type, fqn), token);
  }

  private int requestStatus(String path, String token) throws IOException {
    HttpURLConnection connection = connection(path, token);
    connection.setRequestProperty("Accept", "*/*");
    try {
      return connection.getResponseCode();
    } finally {
      connection.disconnect();
    }
  }

  private HttpURLConnection connection(String path, String token) throws IOException {
    HttpURLConnection connection =
        (HttpURLConnection) URI.create(SdkClients.getServerUrl() + path).toURL().openConnection();
    connection.setRequestProperty("Authorization", "Bearer " + token);
    connection.setRequestProperty("Accept", "text/event-stream");
    connection.setConnectTimeout(5000);
    connection.setReadTimeout(5000);
    return connection;
  }

  private List<String> readEvents(HttpURLConnection connection) throws IOException {
    List<String> events = new ArrayList<>();
    connection.setReadTimeout(2000);
    try (BufferedReader reader =
        new BufferedReader(
            new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.startsWith("data:")) {
          events.add(line.substring("data:".length()).trim());
        }
      }
    } catch (SocketTimeoutException ignored) {
      // The service stream stays open between runs; a quiet window ends this observation.
    }
    return events;
  }
}
