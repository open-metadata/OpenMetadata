package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtHttpConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtHttpHeaders;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;

/**
 * Password-map entries round-tripped through an external secrets manager, with a real Fernet key,
 * so each assertion reads the value the store and the entity actually hold.
 */
class SecretMapEntriesExternalStoreTest {
  private static final String FERNET_KEY = "-uvd2sz2yfe3XoJZnBk3Aw9o_CjL36hHv_yFJlZL3-g=";
  private static final String SERVICE = "map_entries_kafka";

  private InMemorySecretsManager secretsManager;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    secretsManager =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    secretsManager.setFernet(Fernet.getInstance());
  }

  @Test
  void entryKeysThatShareASecretIdAreRefusedBeforeAnyIsStored() {
    Map<String, Object> consumerConfig = new LinkedHashMap<>();
    consumerConfig.put("X.Auth.Token", "first-token");
    consumerConfig.put("X_Auth_Token", "second-token");

    SecretsManagerException refused =
        assertThrows(SecretsManagerException.class, () -> encrypt(consumerConfig));

    assertEquals(400, refused.getResponse().getStatus());
    assertTrue(secretsManager.getSecretsMap().isEmpty());
  }

  @Test
  void distinctEntryKeysKeepTheirOwnValues() {
    KafkaConnection stored =
        encrypt(Map.of("X.Auth.Token", "first-token", "X-Other-Token", "second-token"));

    KafkaConnection read =
        (KafkaConnection)
            secretsManager.decryptServiceConnectionConfig(stored, "Kafka", ServiceType.MESSAGING);
    Map<String, Object> entries = read.getConsumerConfig().getAdditionalProperties();
    assertEquals(
        "first-token", secretsManager.getSecretValue((String) entries.get("X.Auth.Token")));
    assertEquals(
        "second-token", secretsManager.getSecretValue((String) entries.get("X-Other-Token")));
  }

  @Test
  void anEmptyEntryStaysAnEmptyStringAndDropsItsStoredSecret() {
    encrypt(Map.of("X-Empty", "was-set"));
    String entryId =
        secretsManager.buildSecretId(
            false,
            secretsManager.buildSecretId(true, "messaging", SERVICE)
                + "/consumerconfig/additionalproperties",
            "x-empty");
    assertTrue(secretsManager.getSecretsMap().containsKey(entryId));

    KafkaConnection cleared = encrypt(Map.of("X-Empty", ""));

    assertEquals("", cleared.getConsumerConfig().getAdditionalProperties().get("X-Empty"));
    assertFalse(secretsManager.getSecretsMap().containsKey(entryId));
  }

  @ParameterizedTest
  @ValueSource(strings = {"entry", "map", "number", "null"})
  void removedEntriesAreDeletedBeforeTheServiceIsHardDeleted(String removal) {
    String userSecretId = "/user/credential";
    secretsManager.upsertSecret(userSecretId, "user-owned");
    KafkaConnection original =
        encrypt(Map.of("remove", "credential", "user", "secret:" + userSecretId, "keep", "kept"));
    KafkaConnection updated = encrypt(Map.of("keep", "kept"));
    switch (removal) {
      case "map" -> updated.setConsumerConfig(null);
      case "number" -> updated.getConsumerConfig().setAdditionalProperty("remove", 42);
      case "null" -> updated.getConsumerConfig().setAdditionalProperty("remove", null);
      default -> {}
    }

    secretsManager.deleteRemovedMapSecrets(original, updated, serviceSecretId());

    assertFalse(secretsManager.getSecretsMap().containsKey(entrySecretId("remove")));
    assertEquals("user-owned", secretsManager.getSecretsMap().get(userSecretId));
    if (updated.getConsumerConfig() != null) {
      assertEquals("kept", secretsManager.getSecretsMap().get(entrySecretId("keep")));
    }
    secretsManager.deleteSecretsFromServiceConnectionConfig(
        updated, "Kafka", SERVICE, ServiceType.MESSAGING);
    assertEquals(Map.of(userSecretId, "user-owned"), secretsManager.getSecretsMap());
  }

  @Test
  void aRemovedKeyStillReferencedByAnotherEntryKeepsItsSecret() {
    KafkaConnection original = encrypt(Map.of("remove", "credential"));
    KafkaConnection updated = encrypt(Map.of("keep", "secret:" + entrySecretId("remove")));

    secretsManager.deleteRemovedMapSecrets(original, updated, serviceSecretId());

    assertEquals("credential", secretsManager.getSecretsMap().get(entrySecretId("remove")));
  }

  @Test
  void renamingAKeyToTheSameNormalizedIdKeepsTheReplacementSecret() {
    KafkaConnection original = encrypt(Map.of("X.Auth.Token", "old"));
    KafkaConnection updated = encrypt(Map.of("X_Auth_Token", "new"));

    secretsManager.deleteRemovedMapSecrets(original, updated, serviceSecretId());

    assertEquals(Map.of(entrySecretId("x_auth_token"), "new"), secretsManager.getSecretsMap());
  }

  @Test
  void clearingDbtHeadersDeletesTheirSecretsButKeepsUserReferences() {
    String userSecretId = "/user/dbt-token";
    secretsManager.upsertSecret(userSecretId, "user-owned");
    IngestionPipeline original =
        dbtPipeline(Map.of("Authorization", "token", "User", "secret:" + userSecretId));
    secretsManager.encryptIngestionPipeline(original);
    IngestionPipeline updated = dbtPipeline(Map.of());
    secretsManager.encryptIngestionPipeline(updated);
    assertEquals(2, secretsManager.getSecretsMap().size());

    secretsManager.deleteRemovedMapSecrets(
        JsonUtils.readValue(JsonUtils.pojoToJson(original), IngestionPipeline.class), updated);

    assertEquals(Map.of(userSecretId, "user-owned"), secretsManager.getSecretsMap());
  }

  private IngestionPipeline dbtPipeline(Map<String, String> headers) {
    DbtHttpHeaders httpHeaders = new DbtHttpHeaders();
    headers.forEach(httpHeaders::setAdditionalProperty);
    return new IngestionPipeline()
        .withName(SERVICE)
        .withPipelineType(PipelineType.DBT)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new DbtPipeline()
                        .withDbtConfigSource(new DbtHttpConfig().withDbtHttpHeaders(httpHeaders))));
  }

  private String serviceSecretId() {
    return secretsManager.buildSecretId(true, "messaging", SERVICE);
  }

  private String entrySecretId(String key) {
    return secretsManager.buildSecretId(
        false, serviceSecretId(), "consumerconfig", "additionalproperties", key);
  }

  private KafkaConnection encrypt(Map<String, Object> consumerConfig) {
    Map<String, Object> connection = new HashMap<>();
    connection.put("bootstrapServers", "broker:9092");
    connection.put("consumerConfig", new LinkedHashMap<>(consumerConfig));
    return (KafkaConnection)
        secretsManager.encryptServiceConnectionConfig(
            connection, "Kafka", SERVICE, ServiceType.MESSAGING);
  }
}
