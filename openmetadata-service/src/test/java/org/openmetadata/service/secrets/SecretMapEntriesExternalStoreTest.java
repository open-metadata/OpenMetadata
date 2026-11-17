package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.openmetadata.schema.services.connections.llm.CustomLLMConnection;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.secrets.SecretsManager.SecretInventory;

/**
 * Password-map entries round-tripped through an external secrets manager, with a real Fernet key,
 * so each assertion reads the value the store and the entity actually hold.
 */
class SecretMapEntriesExternalStoreTest {
  private static final String FERNET_KEY = "-uvd2sz2yfe3XoJZnBk3Aw9o_CjL36hHv_yFJlZL3-g=";
  private static final String SERVICE = "map_entries_kafka";

  private InMemorySecretsManager secretsManager;
  private SecretMapOwnership ownership;
  private final UUID owner = UUID.randomUUID();
  private KafkaConnection storedConnection;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    secretsManager =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    secretsManager.setFernet(Fernet.getInstance());
    EntityExtensionDAO dao = mock(EntityExtensionDAO.class);
    Map<UUID, String> rows = new HashMap<>();
    when(dao.getExtensionForUpdate(any(), anyString()))
        .thenAnswer(call -> rows.get(call.getArgument(0)));
    doAnswer(
            call -> {
              rows.put(call.getArgument(0), call.getArgument(3));
              return null;
            })
        .when(dao)
        .insert(any(), anyString(), anyString(), anyString());
    doAnswer(
            call -> {
              rows.remove(call.getArgument(0));
              return null;
            })
        .when(dao)
        .delete(any(), anyString());
    ownership = new SecretMapOwnership(dao, secretsManager);
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

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void anEmptyEntryKeepsItsStoredSecretUntilReconciliation(boolean wrapped) {
    KafkaConnection original = encrypt(Map.of("X-Empty", "was-set"));
    String entryId =
        secretsManager.buildSecretId(
            false,
            secretsManager.buildSecretId(true, "messaging", SERVICE)
                + "/consumerconfig/additionalproperties",
            "x-empty");
    assertTrue(secretsManager.getSecretsMap().containsKey(entryId));

    KafkaConnection cleared =
        encrypt(Map.of("X-Empty", wrapped ? Fernet.getInstance().encrypt("") : ""));

    assertEquals("", cleared.getConsumerConfig().getAdditionalProperties().get("X-Empty"));
    assertEquals("was-set", secretsManager.getSecretsMap().get(entryId));
    ownership.clean(serviceSecretId());
    assertFalse(secretsManager.getSecretsMap().containsKey(entryId));
  }

  @Test
  void aFailedWriteAfterAnEmptyEntryKeepsTheOriginalCredential() {
    encrypt(Map.of("clear", "credential"));
    Map<String, Object> entries = new LinkedHashMap<>();
    entries.put("clear", "");
    entries.put("invalid", ExternalSecretsManager.NULL_SECRET_STRING);

    assertThrows(SecretsManagerException.class, () -> encrypt(entries));

    assertEquals("credential", secretsManager.getSecretsMap().get(entrySecretId("clear")));
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

    SecretInventory current = secretsManager.secretInventory(updated, serviceSecretId());
    ownership.recordWrite(
        owner, secretsManager.secretInventory(original, serviceSecretId()), current, current);
    ownership.clean(serviceSecretId());

    assertFalse(secretsManager.getSecretsMap().containsKey(entrySecretId("remove")));
    assertEquals("user-owned", secretsManager.getSecretsMap().get(userSecretId));
    if (updated.getConsumerConfig() != null) {
      assertEquals("kept", secretsManager.getSecretsMap().get(entrySecretId("keep")));
    }
    ownership.removeOwner(owner, secretsManager.secretInventory(updated, serviceSecretId()));
    ownership.clean(serviceSecretId());
    assertEquals(Map.of(userSecretId, "user-owned"), secretsManager.getSecretsMap());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aRemovedKeyStillReferencedByAnotherEntryKeepsItsSecret(boolean hardDelete) {
    KafkaConnection original = encrypt(Map.of("remove", "credential"));
    KafkaConnection updated = encrypt(Map.of("keep", "secret:" + entrySecretId("remove")));

    ownership.clean(serviceSecretId());

    assertEquals("credential", secretsManager.getSecretsMap().get(entrySecretId("remove")));
    if (hardDelete) {
      ownership.removeOwner(owner, secretsManager.secretInventory(updated, serviceSecretId()));
    } else {
      encrypt(Map.of());
    }
    ownership.clean(serviceSecretId());
    assertTrue(secretsManager.getSecretsMap().isEmpty());
  }

  @Test
  void aUserReferenceAtTheCanonicalPathNeverBecomesOwned() {
    String userId = entrySecretId("user");
    secretsManager.upsertSecret(userId, "user-owned");
    KafkaConnection stored = encrypt(Map.of("user", "secret:" + userId));
    ownership.removeOwner(owner, secretsManager.secretInventory(stored, serviceSecretId()));
    ownership.clean(serviceSecretId());
    assertEquals(Map.of(userId, "user-owned"), secretsManager.getSecretsMap());
  }

  @Test
  void anotherEntityInTheSameNamespaceKeepsItsReferencedCredential() {
    KafkaConnection original = encrypt(Map.of("credential", "value"));
    UUID second = UUID.randomUUID();
    KafkaConnection reference =
        JsonUtils.convertValue(
            Map.of("consumerConfig", Map.of("alias", "secret:" + entrySecretId("credential"))),
            KafkaConnection.class);
    SecretInventory shared = secretsManager.secretInventory(reference, serviceSecretId());
    ownership.recordWrite(second, null, shared, shared);
    ownership.removeOwner(owner, secretsManager.secretInventory(original, serviceSecretId()));
    ownership.clean(serviceSecretId());
    assertEquals("value", secretsManager.getSecretsMap().get(entrySecretId("credential")));
    ownership.removeOwner(second, shared);
    ownership.clean(serviceSecretId());
    assertTrue(secretsManager.getSecretsMap().isEmpty());
  }

  @Test
  void aLegacyCanonicalReferenceEstablishesOwnershipOnItsFirstUpdate() {
    KafkaConnection legacy =
        (KafkaConnection)
            secretsManager.encryptServiceConnectionConfig(
                Map.of(
                    "bootstrapServers",
                    "broker:9092",
                    "consumerConfig",
                    Map.of("credential", "legacy")),
                "Kafka",
                SERVICE,
                ServiceType.MESSAGING);
    KafkaConnection empty =
        JsonUtils.convertValue(Map.of("consumerConfig", Map.of()), KafkaConnection.class);
    SecretInventory cleared = secretsManager.secretInventory(empty, serviceSecretId());
    ownership.recordWrite(
        owner, secretsManager.secretInventory(legacy, serviceSecretId()), cleared, cleared);
    ownership.clean(serviceSecretId());
    assertTrue(secretsManager.getSecretsMap().isEmpty());
  }

  @Test
  void renamingAKeyToTheSameNormalizedIdKeepsTheReplacementSecret() {
    KafkaConnection original = encrypt(Map.of("X.Auth.Token", "old"));
    KafkaConnection updated = encrypt(Map.of("X_Auth_Token", "new"));

    ownership.clean(serviceSecretId());

    assertEquals(Map.of(entrySecretId("x_auth_token"), "new"), secretsManager.getSecretsMap());
  }

  @Test
  void scalarAndMapAliasesKeepEveryReferencedCredential() {
    String root = secretsManager.buildSecretId(true, "llm", SERVICE);
    String scalarId = root + "/apikey";
    String mapId = root + "/headers/additionalproperties/authorization";
    CustomLLMConnection original =
        encryptLlm(
            Map.of("apiKey", "scalar-token", "headers", Map.of("Authorization", "map-token")),
            null);
    CustomLLMConnection updated =
        encryptLlm(
            Map.of("apiKey", "secret:" + mapId, "headers", Map.of("apiKey", "secret:" + scalarId)),
            original);

    ownership.clean(root);

    assertEquals(
        Map.of(scalarId, "scalar-token", mapId, "map-token"), secretsManager.getSecretsMap());
    ownership.removeOwner(owner, secretsManager.secretInventory(updated, root));
    ownership.clean(root);
    assertTrue(secretsManager.getSecretsMap().isEmpty());
  }

  @Test
  void aMapReferenceDoesNotHideANewScalarWrite() {
    String root = secretsManager.buildSecretId(true, "llm", SERVICE);
    CustomLLMConnection stored =
        encryptLlm(
            Map.of(
                "apiKey",
                "scalar-token",
                "headers",
                Map.of("apiKey", "secret:" + root + "/apikey")),
            null);
    assertEquals(Map.of(root + "/apikey", "scalar-token"), secretsManager.getSecretsMap());

    ownership.removeOwner(owner, secretsManager.secretInventory(stored, root));
    ownership.clean(root);

    assertTrue(secretsManager.getSecretsMap().isEmpty());
  }

  private CustomLLMConnection encryptLlm(Map<String, Object> config, CustomLLMConnection original) {
    String root = secretsManager.buildSecretId(true, "llm", SERVICE);
    SecretInventory input =
        secretsManager.secretInventory(
            JsonUtils.convertValue(config, CustomLLMConnection.class), root);
    CustomLLMConnection stored =
        (CustomLLMConnection)
            secretsManager.encryptServiceConnectionConfig(
                config, "CustomLLM", SERVICE, ServiceType.LLM);
    ownership.recordWrite(
        owner,
        original == null ? null : secretsManager.secretInventory(original, root),
        input,
        secretsManager.secretInventory(stored, root));
    return stored;
  }

  @Test
  void clearingDbtHeadersDeletesTheirSecretsButKeepsUserReferences() {
    String userSecretId = "/user/dbt-token";
    secretsManager.upsertSecret(userSecretId, "user-owned");
    IngestionPipeline original =
        dbtPipeline(Map.of("Authorization", "token", "User", "secret:" + userSecretId));
    SecretInventory input = secretsManager.secretInventory(original);
    secretsManager.encryptIngestionPipeline(original);
    ownership.recordWrite(owner, null, input, secretsManager.secretInventory(original));
    IngestionPipeline updated = dbtPipeline(Map.of());
    SecretInventory updatedInput = secretsManager.secretInventory(updated);
    secretsManager.encryptIngestionPipeline(updated);
    ownership.recordWrite(
        owner,
        secretsManager.secretInventory(original),
        updatedInput,
        secretsManager.secretInventory(updated));
    assertEquals(2, secretsManager.getSecretsMap().size());

    ownership.clean(secretsManager.secretInventory(updated).root());

    assertEquals(Map.of(userSecretId, "user-owned"), secretsManager.getSecretsMap());
  }

  private IngestionPipeline dbtPipeline(Map<String, String> headers) {
    DbtHttpHeaders httpHeaders = new DbtHttpHeaders();
    headers.forEach(httpHeaders::setAdditionalProperty);
    return new IngestionPipeline()
        .withId(owner)
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
    KafkaConnection typed = JsonUtils.convertValue(connection, KafkaConnection.class);
    SecretInventory input = secretsManager.secretInventory(typed, serviceSecretId());
    KafkaConnection stored =
        (KafkaConnection)
            secretsManager.encryptServiceConnectionConfig(
                connection, "Kafka", SERVICE, ServiceType.MESSAGING);
    ownership.recordWrite(
        owner,
        storedConnection == null
            ? null
            : secretsManager.secretInventory(storedConnection, serviceSecretId()),
        input,
        secretsManager.secretInventory(stored, serviceSecretId()));
    storedConnection = stored;
    return stored;
  }
}
