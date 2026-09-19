package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.macasaet.fernet.Key;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.DBSecretsManager;
import org.openmetadata.service.secrets.SecretsManager;

class IngestionPipelineSecretsTest {
  private static final String SECRET = "test-secret-value";
  private static final String SOURCE_PATH = "/sourceConfig/config/storageMetadataConfigSource";
  private static final PasswordEntityMasker MASKER = new PasswordEntityMasker();
  private static DBSecretsManager secretsManager;
  private static String originalKey;

  @BeforeAll
  static void setup() {
    Fernet fernet = Fernet.getInstance();
    originalKey =
        fernet.isKeyDefined()
            ? fernet.getCachedKeys().stream().map(Key::serialise).collect(Collectors.joining(","))
            : null;
    fernet.setFernetKey(Key.generateKey().serialise());
    secretsManager =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("test", "test", List.of(), null));
  }

  @AfterAll
  static void cleanup() {
    Fernet.getInstance().setFernetKey(originalKey);
  }

  static Stream<Arguments> credentials() {
    return Stream.of(
        Arguments.of(Map.of("awsSecretAccessKey", SECRET), "/awsSecretAccessKey"),
        Arguments.of(
            Map.of("awsSecretAccessKey", SECRET, "awsSessionToken", "test-session-token"),
            "/awsSecretAccessKey"),
        Arguments.of(Map.of("clientSecret", SECRET), "/clientSecret"),
        Arguments.of(Map.of("gcpConfig", Map.of("privateKey", SECRET)), "/gcpConfig/privateKey"));
  }

  @ParameterizedTest
  @MethodSource("credentials")
  void encryptsStoredCredentialsAndDecryptsAfterJsonRoundTrip(
      Map<String, Object> credentials, String path) {
    IngestionPipeline pipeline = pipeline(credentials);
    secretsManager.encryptIngestionPipeline(pipeline);
    String stored = JsonUtils.pojoToJson(pipeline);
    String encrypted =
        JsonUtils.readTree(stored).at(SOURCE_PATH + "/securityConfig" + path).asText();
    assertTrue(Fernet.isTokenized(encrypted));
    assertFalse(stored.contains(SECRET));
    assertEquals(SECRET, Fernet.getInstance().decrypt(encrypted));

    IngestionPipeline loaded = JsonUtils.readValue(stored, IngestionPipeline.class);
    secretsManager.decryptIngestionPipeline(loaded);
    assertEquals(SECRET, secret(loaded, path));
  }

  @ParameterizedTest
  @MethodSource("credentials")
  void masksLegacyPlaintextAndRestoresMaskedUpdates(Map<String, Object> credentials, String path) {
    IngestionPipeline original = pipeline(credentials);
    IngestionPipeline masked = pipeline(credentials);
    MASKER.maskIngestionPipeline(masked);
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, secret(masked, path));
    assertEquals(SECRET, secret(original, path));

    IngestionPipeline update =
        JsonUtils.readValue(JsonUtils.pojoToJson(masked), IngestionPipeline.class);
    MASKER.unmaskIngestionPipeline(update, original);
    assertEquals(SECRET, secret(update, path));
  }

  private static IngestionPipeline pipeline(Map<String, Object> credentials) {
    return JsonUtils.readValue(
        JsonUtils.pojoToJson(
            new IngestionPipeline()
                .withName("test_pipeline")
                .withPipelineType(PipelineType.METADATA)
                .withSourceConfig(
                    new SourceConfig()
                        .withConfig(
                            Map.of(
                                "type",
                                "StorageMetadata",
                                "storageMetadataConfigSource",
                                Map.of(
                                    "securityConfig",
                                    credentials,
                                    "prefixConfig",
                                    Map.of("containerName", "my_container")))))),
        IngestionPipeline.class);
  }

  private static String secret(IngestionPipeline pipeline, String path) {
    return JsonUtils.valueToTree(pipeline).at(SOURCE_PATH + "/securityConfig" + path).asText();
  }

  static Stream<Map<String, Object>> nonSecretConfigs() {
    return Stream.of(
        Map.of("type", "DatabaseMetadata", "includeTables", false),
        Map.of("type", "StorageMetadata"),
        Map.of("type", "StorageMetadata", "storageMetadataConfigSource", Map.of()),
        Map.of(
            "type",
            "StorageMetadata",
            "storageMetadataConfigSource",
            Map.of("manifestFilePath", "/tmp/manifest.json")),
        Map.of(
            "type",
            "StorageMetadata",
            "storageMetadataConfigSource",
            Map.of("manifestHttpPath", "https://example.com/manifest.json")),
        Map.of(
            "type",
            "StorageMetadata",
            "storageMetadataConfigSource",
            Map.of(
                "securityConfig",
                Map.of("gcpConfig", "/tmp/credentials.json"),
                "prefixConfig",
                Map.of("containerName", "my_container"))));
  }

  @ParameterizedTest
  @MethodSource("nonSecretConfigs")
  void preservesNonSecretConfiguration(Map<String, Object> config) {
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("test_pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withSourceConfig(new SourceConfig().withConfig(config));
    secretsManager.encryptIngestionPipeline(pipeline);
    secretsManager.decryptIngestionPipeline(pipeline);
    MASKER.maskIngestionPipeline(pipeline);
    config.forEach(
        (field, value) ->
            assertEquals(
                JsonUtils.valueToTree(value),
                JsonUtils.valueToTree(pipeline.getSourceConfig().getConfig()).get(field)));
  }

  @Test
  void dbtSecretsStillEncryptAndDecrypt() {
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("test_pipeline")
            .withPipelineType(PipelineType.DBT)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        Map.of(
                            "type",
                            "DBT",
                            "dbtConfigSource",
                            Map.of("dbtSecurityConfig", Map.of("awsSecretAccessKey", SECRET)))));
    secretsManager.encryptIngestionPipeline(pipeline);
    String path = "/sourceConfig/config/dbtConfigSource/dbtSecurityConfig/awsSecretAccessKey";
    assertTrue(Fernet.isTokenized(JsonUtils.valueToTree(pipeline).at(path).asText()));
    secretsManager.decryptIngestionPipeline(pipeline);
    assertEquals(SECRET, JsonUtils.valueToTree(pipeline).at(path).asText());
  }

  @Test
  void allowsAbsentSourceConfig() {
    IngestionPipeline pipeline =
        new IngestionPipeline().withName("test_pipeline").withPipelineType(PipelineType.METADATA);
    secretsManager.encryptIngestionPipeline(pipeline);
    secretsManager.decryptIngestionPipeline(pipeline);
    MASKER.maskIngestionPipeline(pipeline);
  }

  @Test
  void removesLegacyApplicationPrivateConfigFromMaskedResponse() {
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("test_app")
            .withPipelineType(PipelineType.APPLICATION)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        Map.of(
                            "type",
                            "Application",
                            "sourcePythonClass",
                            "test.source",
                            "appConfig",
                            Map.of("enabled", true),
                            "appPrivateConfig",
                            Map.of("token", SECRET))));

    MASKER.maskIngestionPipeline(pipeline);

    assertTrue(
        JsonUtils.valueToTree(pipeline)
            .at("/sourceConfig/config/appPrivateConfig")
            .isMissingNode());
    assertFalse(JsonUtils.pojoToJson(pipeline).contains(SECRET));
    assertEquals(
        "test.source",
        JsonUtils.valueToTree(pipeline).at("/sourceConfig/config/sourcePythonClass").asText());
    assertTrue(
        JsonUtils.valueToTree(pipeline).at("/sourceConfig/config/appConfig/enabled").asBoolean());
  }
}
