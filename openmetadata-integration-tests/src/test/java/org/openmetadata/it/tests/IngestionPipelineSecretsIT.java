package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpServer;
import java.lang.reflect.Field;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyStoreException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataBucketDetails;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataS3Config;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.secrets.InMemorySecretsManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;

@Isolated("Changes the pipeline runner and secrets-manager boundaries")
@ExtendWith(TestNamespaceExtension.class)
class IngestionPipelineSecretsIT {
  private static final String SECRET_PATH =
      "/sourceConfig/config/storageMetadataConfigSource/securityConfig/awsSecretAccessKey";
  private static final String INITIAL_SECRET = "initial-credential";
  private static final String ACCEPTED_SECRET = "accepted-credential";
  private static final String REJECTED_SECRET = "rejected-credential";
  private static final Duration TIMEOUT = Duration.ofSeconds(30);
  private final List<IngestionPipeline> deployments = new CopyOnWriteArrayList<>();
  private IngestionPipelineRepository repository;
  private PipelineServiceClientInterface originalRunner;
  private SecretsManager originalManager;
  private ControlledSecretsManager managed;
  private volatile boolean failDeployment;

  @BeforeEach
  void setup() throws Exception {
    repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    final Field runnerField =
        IngestionPipelineRepository.class.getDeclaredField("pipelineServiceClient");
    runnerField.setAccessible(true);
    originalRunner = (PipelineServiceClientInterface) runnerField.get(repository);
    originalManager = SecretsManagerFactory.getSecretsManager();
    managed = new ControlledSecretsManager();
    repository.setPipelineServiceClient(new CapturingPipelineClient());
  }

  @AfterEach
  void cleanup(TestNamespace namespace) {
    managed.release.countDown();
    try {
      NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
    } finally {
      SecretsManagerFactory.setSecretsManager(originalManager);
      repository.setPipelineServiceClient(originalRunner);
    }
  }

  @Test
  void consolidationDeploysOnlyRequestedChanges(TestNamespace namespace) throws Exception {
    final IngestionPipeline pipeline = createPipeline(namespace, INITIAL_SECRET);
    patchSuccessfully(pipeline, "/deployed", true);
    patchSuccessfully(pipeline, "/description", "Updated description");
    assertTrue(deployments.isEmpty());
    assertEncrypted(pipeline);
    assertSingleDeployment(pipeline, SECRET_PATH, ACCEPTED_SECRET);
    assertSingleDeployment(pipeline, "/airflowConfig/scheduleInterval", "0 * * * *");
    assertSingleDeployment(pipeline, "/loggerLevel", "DEBUG");
    assertSingleDeployment(pipeline, "/enabled", false);
    final JsonNode before = stored(pipeline);
    failDeployment = true;
    assertEquals(400, patch(pipeline, SECRET_PATH, REJECTED_SECRET, null).statusCode());
    assertEquals(before, stored(pipeline));
    assertMaskedHistory(pipeline);
  }

  @Test
  void timedOutDeploymentReleasesLockWithoutPersistingSecrets(TestNamespace namespace)
      throws Exception {
    final IngestionPipeline pipeline = createPipeline(namespace, INITIAL_SECRET);
    patchSuccessfully(pipeline, "/deployed", true);
    final JsonNode before = stored(pipeline);
    final HttpServer runner = stalledRunner();
    try {
      final PipelineServiceClientConfiguration config =
          capturingClientConfig()
              .withApiEndpoint("http://localhost:" + runner.getAddress().getPort());
      config.getParameters().setAdditionalProperty("timeout", 1);
      repository.setPipelineServiceClient(new AirflowRESTClient(config));
      assertTimeoutPreemptively(
          Duration.ofSeconds(10),
          () ->
              assertEquals(400, patch(pipeline, SECRET_PATH, REJECTED_SECRET, null).statusCode()));
      assertEquals(before, stored(pipeline));
    } finally {
      runner.stop(0);
      repository.setPipelineServiceClient(new CapturingPipelineClient());
    }
    assertTimeoutPreemptively(
        Duration.ofSeconds(10), () -> patchSuccessfully(pipeline, SECRET_PATH, ACCEPTED_SECRET));
    assertEncrypted(pipeline);
    assertMaskedHistory(pipeline);
  }

  private static HttpServer stalledRunner() throws Exception {
    final HttpServer runner = HttpServer.create(new InetSocketAddress(0), 0);
    runner.createContext(
        "/",
        exchange -> {
          exchange.getRequestBody().readAllBytes();
          if (exchange.getRequestURI().getPath().endsWith("/deploy")) {
            exchange.sendResponseHeaders(200, 100);
            exchange.getResponseBody().write('{');
            exchange.getResponseBody().flush();
            return;
          }
          final byte[] body =
              "{\"version\":\"3.0.0\",\"csrf_token\":\"test\"}".getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(200, body.length);
          try (var output = exchange.getResponseBody()) {
            output.write(body);
          }
        });
    runner.start();
    return runner;
  }

  @Test
  void identicalDisplayNamesKeepManagedCredentialsSeparate(TestNamespace namespace) {
    SecretsManagerFactory.setSecretsManager(managed);
    final IngestionPipeline first = createPipeline(namespace, INITIAL_SECRET);
    final IngestionPipeline second = createPipeline(namespace, ACCEPTED_SECRET);
    assertEquals(first.getDisplayName(), second.getDisplayName());
    assertNotEquals(first.getName(), second.getName());
    assertEquals(INITIAL_SECRET, activeSecret(first));
    assertEquals(ACCEPTED_SECRET, activeSecret(second));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void rejectedConcurrentSaveCannotChangeCredentialsOrDeployment(
      boolean deployed, TestNamespace namespace) throws Exception {
    SecretsManagerFactory.setSecretsManager(managed);
    IngestionPipeline pipeline = createPipeline(namespace, INITIAL_SECRET);
    if (deployed) {
      pipeline = patchSuccessfully(pipeline, "/deployed", true);
    }
    final IngestionPipeline original = pipeline;
    managed.writes.clear();
    final String etag = "W/\"" + original.getVersion() + "\"";
    managed.watchedPipeline = original.getId();
    managed.blockedValue = ACCEPTED_SECRET;
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      try {
        final var accepted =
            executor.submit(() -> patch(original, SECRET_PATH, ACCEPTED_SECRET, etag));
        assertTrue(managed.entered.await(TIMEOUT.toSeconds(), TimeUnit.SECONDS));
        final var rejected =
            executor.submit(() -> patch(original, SECRET_PATH, REJECTED_SECRET, etag));
        assertTrue(
            managed.concurrentRead.await(TIMEOUT.toSeconds(), TimeUnit.SECONDS),
            "The second writer must read the pipeline while the first writer is blocked");
        assertEquals(original.getVersion(), managed.concurrentVersion);
        managed.release.countDown();
        assertEquals(200, accepted.get(TIMEOUT.toSeconds(), TimeUnit.SECONDS).statusCode());
        assertEquals(412, rejected.get(TIMEOUT.toSeconds(), TimeUnit.SECONDS).statusCode());
        assertEquals(ACCEPTED_SECRET, activeSecret(original));
        assertEquals(List.of(ACCEPTED_SECRET), managed.writes);
        assertEquals(deployed ? 1 : 0, deployments.size());
        if (deployed) {
          assertEquals(
              ACCEPTED_SECRET,
              JsonUtils.valueToTree(deployments.getFirst()).at(SECRET_PATH).asText());
        }
        assertEncrypted(original);
        assertMaskedHistory(original);
      } finally {
        managed.release.countDown();
      }
    }
  }

  private IngestionPipeline createPipeline(TestNamespace namespace, String credential) {
    final StorageService service = StorageServiceTestFactory.createS3(namespace);
    final StorageMetadataS3Config manifest =
        new StorageMetadataS3Config()
            .withSecurityConfig(
                new AWSCredentials().withAwsRegion("us-east-1").withAwsSecretAccessKey(credential))
            .withPrefixConfig(new StorageMetadataBucketDetails().withContainerName("my_bucket"));
    return SdkClients.adminClient()
        .ingestionPipelines()
        .create(
            new CreateIngestionPipeline()
                .withName(UUID.randomUUID().toString())
                .withDisplayName("Metadata")
                .withPipelineType(PipelineType.METADATA)
                .withService(service.getEntityReference())
                .withAirflowConfig(new AirflowConfig())
                .withSourceConfig(
                    new SourceConfig()
                        .withConfig(
                            new StorageServiceMetadataPipeline()
                                .withStorageMetadataConfigSource(manifest))));
  }

  private void assertSingleDeployment(IngestionPipeline pipeline, String field, Object value)
      throws Exception {
    deployments.clear();
    patchSuccessfully(pipeline, field, value);
    assertEquals(1, deployments.size(), field);
    assertEquals(
        JsonUtils.valueToTree(value), JsonUtils.valueToTree(deployments.getFirst()).at(field));
  }

  private static IngestionPipeline patchSuccessfully(
      IngestionPipeline pipeline, String field, Object value) throws Exception {
    final HttpResponse<String> response = patch(pipeline, field, value, null);
    assertEquals(200, response.statusCode(), response.body());
    return JsonUtils.readValue(response.body(), IngestionPipeline.class);
  }

  private static HttpResponse<String> patch(
      IngestionPipeline pipeline, String field, Object value, String etag) throws Exception {
    final HttpRequest.Builder request =
        requestBuilder("/" + pipeline.getId())
            .header("Content-Type", "application/json-patch+json")
            .method(
                "PATCH",
                HttpRequest.BodyPublishers.ofString(
                    JsonUtils.pojoToJson(
                        List.of(Map.of("op", "add", "path", field, "value", value)))));
    if (etag != null) {
      request.header("If-Match", etag);
    }
    try (final HttpClient client = HttpClient.newHttpClient()) {
      return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
  }

  private static HttpRequest.Builder requestBuilder(String suffix) {
    return HttpRequest.newBuilder()
        .uri(URI.create(SdkClients.baseUrl() + "/v1/services/ingestionPipelines" + suffix))
        .header("Authorization", "Bearer " + SdkClients.getAdminToken())
        .timeout(TIMEOUT);
  }

  private static JsonNode stored(IngestionPipeline pipeline) {
    return JsonUtils.valueToTree(
        Entity.getCollectionDAO()
            .ingestionPipelineDAO()
            .findEntityById(pipeline.getId(), Include.NON_DELETED));
  }

  private static void assertEncrypted(IngestionPipeline pipeline) {
    assertTrue(Fernet.isTokenized(stored(pipeline).at(SECRET_PATH).asText()));
  }

  private String activeSecret(IngestionPipeline pipeline) {
    final IngestionPipeline decrypted =
        JsonUtils.treeToValue(stored(pipeline), IngestionPipeline.class);
    managed.decryptIngestionPipeline(decrypted);
    final String reference = JsonUtils.valueToTree(decrypted).at(SECRET_PATH).asText();
    assertTrue(reference.startsWith(SecretsManager.SECRET_FIELD_PREFIX));
    return managed.getSecretValue(reference);
  }

  private static void assertMaskedHistory(IngestionPipeline pipeline) throws Exception {
    for (final String suffix :
        List.of(
            "/" + pipeline.getId() + "/versions",
            "/" + pipeline.getId() + "/versions/0.1",
            "/history?startTs="
                + (pipeline.getUpdatedAt() - 1)
                + "&endTs="
                + System.currentTimeMillis()
                + "&limit=500")) {
      try (final HttpClient client = HttpClient.newHttpClient()) {
        final HttpResponse<String> response =
            client.send(requestBuilder(suffix).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains(pipeline.getId().toString()));
        assertFalse(response.body().contains(INITIAL_SECRET));
        assertFalse(response.body().contains(ACCEPTED_SECRET));
      }
    }
  }

  private class CapturingPipelineClient extends AirflowRESTClient {
    CapturingPipelineClient() throws KeyStoreException {
      super(capturingClientConfig());
    }

    @Override
    public PipelineServiceClientResponse deployPipeline(
        IngestionPipeline pipeline, ServiceEntityInterface service) {
      deployments.add(JsonUtils.deepCopy(pipeline, IngestionPipeline.class));
      return new PipelineServiceClientResponse()
          .withCode(failDeployment ? 500 : 200)
          .withReason(failDeployment ? "Deployment rejected" : "Deployed");
    }

    @Override
    public PipelineServiceClientResponse deletePipeline(IngestionPipeline pipeline) {
      return new PipelineServiceClientResponse().withCode(200);
    }
  }

  private static PipelineServiceClientConfiguration capturingClientConfig() {
    final Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("username", "test");
    parameters.setAdditionalProperty("password", "test");
    return new PipelineServiceClientConfiguration()
        .withEnabled(false)
        .withApiEndpoint("http://localhost:1")
        .withParameters(parameters);
  }

  private static class ControlledSecretsManager extends InMemorySecretsManager {
    private final List<String> writes = new CopyOnWriteArrayList<>();
    private final CountDownLatch entered = new CountDownLatch(1);
    private final CountDownLatch release = new CountDownLatch(1);
    private final CountDownLatch concurrentRead = new CountDownLatch(1);
    private volatile String blockedValue;
    private volatile UUID watchedPipeline;
    private Double concurrentVersion;

    ControlledSecretsManager() {
      super(new SecretsConfig("test", "", List.of(), null));
    }

    @Override
    public void decryptIngestionPipeline(IngestionPipeline pipeline) {
      super.decryptIngestionPipeline(pipeline);
      if (pipeline.getId().equals(watchedPipeline)
          && entered.getCount() == 0
          && release.getCount() != 0) {
        concurrentVersion = pipeline.getVersion();
        concurrentRead.countDown();
      }
    }

    @Override
    public void upsertSecret(String secretName, String secretValue) {
      if (secretValue.equals(blockedValue)) {
        entered.countDown();
        try {
          if (!release.await(TIMEOUT.toSeconds(), TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for the concurrent writer");
          }
        } catch (InterruptedException exception) {
          Thread.currentThread().interrupt();
          throw new IllegalStateException(exception);
        }
      }
      super.upsertSecret(secretName, secretValue);
      writes.add(secretValue);
    }
  }
}
