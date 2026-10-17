package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.macasaet.fernet.Key;
import com.macasaet.fernet.Token;
import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.util.RestUtil;

@Execution(ExecutionMode.CONCURRENT)
@Isolated("Metadata service listing reports a global total that concurrent fixtures can change")
@ExtendWith(TestNamespaceExtension.class)
public class ServiceConnectionResilienceIT {
  private static final String TEST_PASSWORD = "synthetic-service-resilience-password";
  private static final String OTHER_KEY = "ZJNP0-FkaNPWmLsuhZq1dpQ5Cr2I8bG7vRlkjJjd25A=";
  private static final ServiceCase DATABASE =
      new ServiceCase(
          Entity.DATABASE_SERVICE,
          "databaseServices",
          "Postgres",
          """
          {"type":"Postgres","hostPort":"localhost:5432","username":"test",
           "authType":{"password":"synthetic-service-resilience-password"}}
          """);

  @AfterEach
  void removeFixtures(TestNamespace ns) {
    assertAll(
        ns.drainTrackedRoots().reversed().stream()
            .map(root -> (Executable) () -> removeFixture(root)));
  }

  private static void removeFixture(TestNamespace.EntityRoot root) {
    final String path =
        Entity.DOMAIN.equals(root.entityType())
            ? "/v1/domains"
            : serviceCases()
                .filter(serviceCase -> serviceCase.entityType().equals(root.entityType()))
                .findFirst()
                .orElseThrow()
                .path();
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            path + "/" + root.id(),
            null,
            Void.class,
            RequestOptions.builder()
                .queryParam("hardDelete", "true")
                .queryParam("recursive", "true")
                .build());
  }

  @ParameterizedTest
  @MethodSource("invalidTokens")
  void list_withUndecryptableConnection_keepsHealthyServices(
      String invalidToken, TestNamespace ns) {
    final ServicePage fixture = createPage(DATABASE, ns);
    final JsonNode baseline = list(fixture, SdkClients.adminClient());
    try (StoredConnection stored = snapshot(fixture)) {
      stored.changeConfig(
          config -> ((ObjectNode) config.path("authType")).put("password", invalidToken));
      assertMixedPage(fixture, baseline, list(fixture, SdkClients.adminClient()));
      assertHealthyBotSecrets(fixture);
      assertSingleEntityStillFails(fixture);
      assertCursorTraversal(fixture);
      stored.assertUnchangedAfterReads();
    }
    assertEquals(baseline, list(fixture, SdkClients.adminClient()));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("serviceCases")
  void list_withInvalidInnerConfig_keepsEveryServiceCategory(
      ServiceCase serviceCase, TestNamespace ns) {
    final ServicePage fixture = createPage(serviceCase, ns);
    final JsonNode baseline = list(fixture, SdkClients.adminClient());
    try (StoredConnection stored = snapshot(fixture)) {
      stored.changeConfig(config -> config.put("unsupportedConnectionField31887", true));
      assertMixedPage(fixture, baseline, list(fixture, SdkClients.adminClient()));
      assertSingleEntityStillFails(fixture);
      stored.assertUnchangedAfterReads();
    }
    assertEquals(baseline, list(fixture, SdkClients.adminClient()));
  }

  @Test
  void list_withInvalidNestedSslSecret_clearsEntireConnection(TestNamespace ns) {
    final ServicePage fixture = createPage(DATABASE, ns);
    final JsonNode baseline = list(fixture, SdkClients.adminClient());
    try (StoredConnection stored = snapshot(fixture)) {
      stored.changeConfig(
          config ->
              config.putObject("sslConfig").put("caCertificate", "fernet:invalid-certificate"));
      assertMixedPage(fixture, baseline, list(fixture, SdkClients.adminClient()));
      stored.assertUnchangedAfterReads();
    }
    assertEquals(baseline, list(fixture, SdkClients.adminClient()));
  }

  @ParameterizedTest
  @MethodSource("absentConnections")
  void list_withAbsentConnectionOrConfig_keepsService(
      Consumer<ObjectNode> change, TestNamespace ns) {
    final ServicePage fixture = createPage(DATABASE, ns);
    final JsonNode baseline = list(fixture, SdkClients.adminClient());
    try (StoredConnection stored = snapshot(fixture)) {
      stored.changeDocument(change);
      assertMixedPage(fixture, baseline, list(fixture, SdkClients.adminClient()));
      stored.assertUnchangedAfterReads();
    }
    assertEquals(baseline, list(fixture, SdkClients.adminClient()));
  }

  private static Stream<Consumer<ObjectNode>> absentConnections() {
    return Stream.of(
        document -> document.remove("connection"),
        document -> ((ObjectNode) document.path("connection")).putNull("config"));
  }

  @Test
  void writes_keepMaskingAndInvalidConnectionErrors(TestNamespace ns) {
    final ServicePage fixture = createPage(DATABASE, ns);
    final ObjectNode update =
        serviceRequest(
            DATABASE, fixture.domain(), fixture.services().getFirst().path("name").asText());
    ((ObjectNode) update.path("connection").path("config").path("authType"))
        .put("password", PasswordEntityMasker.PASSWORD_MASK);
    putService(update);
    assertHealthyPassword(fixture.services().getFirst());
    final ObjectNode invalid = update.deepCopy();
    ((ObjectNode) invalid.path("connection").path("config"))
        .put("unsupportedConnectionField31887", true);
    assertEquals(
        400, assertThrows(OpenMetadataException.class, () -> putService(invalid)).getStatusCode());
    assertHealthyPassword(fixture.services().getFirst());
    final JsonNode created =
        putService(serviceRequest(DATABASE, fixture.domain(), ns.prefix(ns.uniqueShortId())));
    ns.trackRoot(Entity.DATABASE_SERVICE, UUID.fromString(created.path("id").asText()));
    assertHealthyPassword(created);
  }

  private static JsonNode putService(ObjectNode request) {
    return JsonUtils.readTree(
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.PUT, DATABASE.path(), request));
  }

  private static void assertHealthyPassword(JsonNode service) {
    final JsonNode response =
        JsonUtils.readTree(
            SdkClients.ingestionBotClient()
                .getHttpClient()
                .executeForString(
                    HttpMethod.GET, DATABASE.path() + "/" + service.path("id").asText(), null));
    assertEquals(
        TEST_PASSWORD,
        response.path("connection").path("config").path("authType").path("password").asText());
  }

  private static Stream<String> invalidTokens() {
    return Stream.of(
        "fernet:"
            + Token.generate(new SecureRandom(), new Key(OTHER_KEY), TEST_PASSWORD).serialise(),
        "fernet:not-a-valid-token");
  }

  private static Stream<ServiceCase> serviceCases() {
    return Stream.of(
        DATABASE,
        new ServiceCase(
            Entity.DASHBOARD_SERVICE,
            "dashboardServices",
            "Metabase",
            "{\"type\":\"Metabase\",\"hostPort\":\"http://localhost:3000\",\"username\":\"test\"}"),
        new ServiceCase(
            Entity.MESSAGING_SERVICE,
            "messagingServices",
            "Kafka",
            "{\"type\":\"Kafka\",\"bootstrapServers\":\"localhost:9092\"}"),
        new ServiceCase(
            Entity.PIPELINE_SERVICE,
            "pipelineServices",
            "Airflow",
            "{\"type\":\"Airflow\",\"hostPort\":\"http://localhost:8080\"}"),
        new ServiceCase(
            Entity.MLMODEL_SERVICE,
            "mlmodelServices",
            "Mlflow",
            "{\"type\":\"Mlflow\",\"trackingUri\":\"http://localhost:5000\",\"registryUri\":\"http://localhost:5000\"}"),
        new ServiceCase(
            Entity.METADATA_SERVICE,
            "metadataServices",
            "Amundsen",
            "{\"type\":\"Amundsen\",\"hostPort\":\"bolt://localhost:7687\",\"username\":\"test\",\"password\":\"test\"}"),
        new ServiceCase(
            Entity.STORAGE_SERVICE,
            "storageServices",
            "S3",
            "{\"type\":\"S3\",\"awsConfig\":{\"awsRegion\":\"us-east-1\"}}"),
        new ServiceCase(
            Entity.SEARCH_SERVICE,
            "searchServices",
            "ElasticSearch",
            "{\"type\":\"ElasticSearch\",\"hostPort\":\"http://localhost:9200\"}"),
        new ServiceCase(
            Entity.API_SERVICE,
            "apiServices",
            "Rest",
            "{\"type\":\"Rest\",\"openAPISchemaConnection\":{\"openAPISchemaURL\":\"http://localhost:8585/swagger.json\"}}"),
        new ServiceCase(
            Entity.LLM_SERVICE,
            "llmServices",
            "CustomLLM",
            "{\"type\":\"CustomLLM\",\"baseURL\":\"http://localhost:8080\"}"),
        new ServiceCase(
            Entity.DRIVE_SERVICE,
            "driveServices",
            "GoogleDrive",
            """
            {"type":"GoogleDrive","driveId":"test-drive","credentials":{"gcpConfig":{
              "type":"service_account","projectId":"test-project","privateKeyId":"test-key-id",
              "privateKey":"test-private-key","clientEmail":"test@test-project.iam.gserviceaccount.com",
              "clientId":"123456789"}}}
            """),
        new ServiceCase(
            Entity.SECURITY_SERVICE,
            "securityServices",
            "Ranger",
            "{\"type\":\"Ranger\",\"hostPort\":\"http://localhost:6080\",\"authType\":{\"username\":\"test\",\"password\":\"test\"}}"),
        new ServiceCase(Entity.MCP_SERVICE, "mcpServices", "Mcp", "{\"type\":\"Mcp\"}"));
  }

  private static ServicePage createPage(ServiceCase serviceCase, TestNamespace ns) {
    final String fixtureId = ns.uniqueShortId();
    final Domain domain =
        ns.trackRoot(
            Entity.DOMAIN,
            SdkClients.adminClient()
                .domains()
                .create(
                    new CreateDomain()
                        .withName(ns.prefix(serviceCase.entityType() + fixtureId))
                        .withDescription("Service connection resilience isolation")
                        .withDomainType(CreateDomain.DomainType.AGGREGATE)));
    final List<JsonNode> services =
        Stream.of("a_healthy", "b_broken", "c_healthy")
            .map(name -> createService(serviceCase, domain, ns.prefix(fixtureId + "_" + name), ns))
            .toList();
    return new ServicePage(serviceCase, domain.getFullyQualifiedName(), services, fixtureId);
  }

  private static JsonNode createService(
      ServiceCase serviceCase, Domain domain, String name, TestNamespace ns) {
    final ObjectNode request = serviceRequest(serviceCase, domain.getFullyQualifiedName(), name);
    final JsonNode created =
        JsonUtils.readTree(
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(HttpMethod.POST, serviceCase.path(), request));
    ns.trackRoot(serviceCase.entityType(), UUID.fromString(created.path("id").asText()));
    return created;
  }

  private static ObjectNode serviceRequest(ServiceCase serviceCase, String domain, String name) {
    final ObjectNode request =
        JsonUtils.getObjectNode().put("name", name).put("serviceType", serviceCase.serviceType());
    request.putArray("domains").add(domain);
    request.putObject("connection").set("config", JsonUtils.readTree(serviceCase.config()));
    return request;
  }

  private static JsonNode list(ServicePage fixture, OpenMetadataClient client) {
    return list(fixture, client, options(fixture).queryParam("limit", "3").build());
  }

  private static JsonNode list(
      ServicePage fixture, OpenMetadataClient client, RequestOptions options) {
    return JsonUtils.readTree(
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, fixture.serviceCase().path(), null, options));
  }

  private static RequestOptions.Builder options(ServicePage fixture) {
    final RequestOptions.Builder options =
        RequestOptions.builder()
            .queryParam("domain", fixture.domain())
            .queryParam("fields", "owners,domains")
            .queryParam("includePermissions", "true");
    if (Entity.METADATA_SERVICE.equals(fixture.serviceCase().entityType())) {
      // Metadata service listing does not accept a domain filter, so isolate its ordered page.
      final String cursor =
          JsonUtils.getObjectNode()
              .put("name", fixture.namePrefix())
              .put("id", new UUID(0, 0).toString())
              .toString();
      options.queryParam("after", RestUtil.encodeCursor(cursor));
    }
    return options;
  }

  private static void assertMixedPage(ServicePage fixture, JsonNode baseline, JsonNode response) {
    assertEquals(3, response.path("data").size());
    assertTrue(baseline.path("entityPermissions").isObject());
    assertEquals(3, baseline.path("entityPermissions").size());
    assertEquals(baseline.path("paging"), response.path("paging"));
    assertEquals(baseline.path("entityPermissions"), response.path("entityPermissions"));
    for (int index = 0; index < fixture.services().size(); index++) {
      final JsonNode before = baseline.path("data").get(index);
      final JsonNode after = response.path("data").get(index);
      assertTrue(
          baseline
              .path("entityPermissions")
              .has(fixture.services().get(index).path("id").asText()));
      assertEquals(fixture.services().get(index).path("id"), after.path("id"));
      if (index == 1) {
        assertTrue(after.path("connection").isMissingNode() || after.path("connection").isNull());
        final ObjectNode expected = before.deepCopy();
        final ObjectNode actual = after.deepCopy();
        expected.remove("connection");
        actual.remove("connection");
        assertEquals(expected, actual);
      } else {
        assertEquals(before, after);
      }
    }
  }

  private static void assertHealthyBotSecrets(ServicePage fixture) {
    final JsonNode data = list(fixture, SdkClients.ingestionBotClient()).path("data");
    assertEquals(
        TEST_PASSWORD,
        data.get(0).path("connection").path("config").path("authType").path("password").asText());
    assertEquals(
        TEST_PASSWORD,
        data.get(2).path("connection").path("config").path("authType").path("password").asText());
    assertTrue(
        data.get(1).path("connection").isMissingNode() || data.get(1).path("connection").isNull());
    final JsonNode human = list(fixture, SdkClients.adminClient()).path("data").get(0);
    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK,
        human.path("connection").path("config").path("authType").path("password").asText());
  }

  private static void assertSingleEntityStillFails(ServicePage fixture) {
    final JsonNode broken = fixture.services().get(1);
    for (String suffix :
        List.of(broken.path("id").asText(), "name/" + broken.path("fullyQualifiedName").asText())) {
      final OpenMetadataException failure =
          assertThrows(
              OpenMetadataException.class,
              () ->
                  SdkClients.adminClient()
                      .getHttpClient()
                      .executeForString(
                          HttpMethod.GET, fixture.serviceCase().path() + "/" + suffix, null));
      assertEquals(400, failure.getStatusCode());
    }
  }

  private static void assertCursorTraversal(ServicePage fixture) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final JsonNode first = list(fixture, client, options(fixture).queryParam("limit", "1").build());
    final JsonNode middle =
        list(
            fixture,
            client,
            options(fixture)
                .queryParam("limit", "1")
                .queryParam("after", first.path("paging").path("after").asText())
                .build());
    final JsonNode last =
        list(
            fixture,
            client,
            options(fixture)
                .queryParam("limit", "1")
                .queryParam("after", middle.path("paging").path("after").asText())
                .build());
    assertEquals(fixture.services().get(0).path("id"), first.path("data").get(0).path("id"));
    assertEquals(fixture.services().get(1).path("id"), middle.path("data").get(0).path("id"));
    assertEquals(fixture.services().get(2).path("id"), last.path("data").get(0).path("id"));
    assertEquals(3, middle.path("paging").path("total").asInt());
    final JsonNode previous =
        list(
            fixture,
            client,
            options(fixture)
                .queryParam("limit", "1")
                .queryParam("before", middle.path("paging").path("before").asText())
                .build());
    assertEquals(first.path("data"), previous.path("data"));
  }

  private static StoredConnection snapshot(ServicePage fixture) {
    final JsonNode broken = fixture.services().get(1);
    final String entityType = fixture.serviceCase().entityType();
    final UUID id = UUID.fromString(broken.path("id").asText());
    final String json = storedJson(entityType, id);
    assertNotNull(JsonUtils.readTree(json).path("connection").get("config"));
    return new StoredConnection(entityType, id, broken.path("fullyQualifiedName").asText(), json);
  }

  private static String storedJson(String entityType, UUID id) {
    final EntityDAO<?> dao = Entity.getEntityRepository(entityType).getDao();
    return dao.findById(dao.getTableName(), id, dao.getCondition(Include.NON_DELETED));
  }

  private record ServiceCase(
      String entityType, String collection, String serviceType, String config) {
    private String path() {
      return "/v1/services/" + collection;
    }

    @Override
    public String toString() {
      return entityType;
    }
  }

  private record ServicePage(
      ServiceCase serviceCase, String domain, List<JsonNode> services, String namePrefix) {}

  private static final class StoredConnection implements AutoCloseable {
    private final String entityType;
    private final UUID id;
    private final String fqn;
    private final String original;
    private JsonNode corrupted;

    private StoredConnection(String entityType, UUID id, String fqn, String original) {
      this.entityType = entityType;
      this.id = id;
      this.fqn = fqn;
      this.original = original;
    }

    private void changeConfig(Consumer<ObjectNode> change) {
      changeDocument(
          document -> change.accept((ObjectNode) document.path("connection").path("config")));
    }

    private void changeDocument(Consumer<ObjectNode> change) {
      final ObjectNode document = (ObjectNode) JsonUtils.readTree(original);
      change.accept(document);
      write(document.toString());
      corrupted = document;
    }

    private void assertUnchangedAfterReads() {
      final String stored = storedJson(entityType, id);
      assertEquals(corrupted, JsonUtils.readTree(stored));
    }

    private void write(String json) {
      Entity.getEntityRepository(entityType).getDao().update(id, fqn, json);
      EntityRepository.invalidateCacheForEntity(entityType, id, fqn);
    }

    @Override
    public void close() {
      write(original);
    }
  }
}
