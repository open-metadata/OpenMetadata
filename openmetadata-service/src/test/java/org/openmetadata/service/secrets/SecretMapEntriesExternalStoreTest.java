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
import org.openmetadata.schema.services.connections.mcp.McpConnection;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
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

  /**
   * A server's key is written once per server, so a server a later update drops from the list keeps
   * its key until the service is hard-deleted, and then goes with the others.
   */
  @Test
  void aServerDroppedFromAnMcpServiceLosesItsKeyWhenTheServiceIsHardDeleted() {
    McpConnection created =
        encryptMcp(
            List.of(mcpServer("first", "first-key"), mcpServer("second", "second-key")), null);
    assertEquals(2, secretsManager.getSecretsMap().size());

    McpConnection updated = encryptMcp(List.of(created.getServers().getFirst()), created);
    ownership.removeOwner(owner, secretsManager.secretInventory(updated, mcpRoot()));
    ownership.clean(mcpRoot());

    assertTrue(secretsManager.getSecretsMap().isEmpty());
  }

  /**
   * {@code Prod} and {@code prod} clean into one secret id, so each is stored under an id from its
   * exact name: swapping them and then replacing one key never writes over the other's secret.
   */
  @Test
  void reorderingServersThatShareACleanedNameThenReplacingOneKeyKeepsTheOther() {
    final McpConnection created =
        encryptMcp(
            List.of(mcpServer("Prod", "prod-upper-key"), mcpServer("prod", "prod-key")), null);

    final McpServerConfig upper = copy(created.getServers().getFirst()).withApiKey("replaced-key");
    final McpConnection updated =
        encryptMcp(List.of(copy(created.getServers().get(1)), upper), created);

    assertEquals("prod-key", storedKey(updated, "prod"));
    assertEquals("replaced-key", storedKey(updated, "Prod"));
  }

  /** Clearing one of two swapped keys removes that server's secret, not the other's. */
  @Test
  void reorderingServersThatShareACleanedNameThenClearingOneKeyKeepsTheOther() {
    final McpConnection created =
        encryptMcp(
            List.of(mcpServer("Prod", "prod-upper-key"), mcpServer("prod", "prod-key")), null);

    final McpServerConfig upper = copy(created.getServers().getFirst()).withApiKey("");
    final McpConnection updated =
        encryptMcp(List.of(copy(created.getServers().get(1)), upper), created);

    assertEquals("prod-key", storedKey(updated, "prod"));
  }

  /** Adding {@code prod} next to {@code Prod} and then editing a key keeps each server's own key. */
  @Test
  void addingAServerThatSharesACleanedNameThenEditingKeepsEachKey() {
    final McpConnection created = encryptMcp(List.of(mcpServer("Prod", "prod-upper-key")), null);
    final McpConnection added =
        encryptMcp(
            List.of(mcpServer("prod", "prod-key"), copy(created.getServers().getFirst())), created);

    final McpServerConfig lower = copy(added.getServers().getFirst()).withApiKey("replaced-key");
    final McpConnection updated =
        encryptMcp(List.of(copy(added.getServers().get(1)), lower), added);

    assertEquals("prod-upper-key", storedKey(updated, "Prod"));
    assertEquals("replaced-key", storedKey(updated, "prod"));
  }

  /**
   * A server renamed without touching its key keeps its reference until the next save, which moves
   * the key to the id of its new name: a server later added under the old name then gets an id that
   * no other server still reads.
   */
  @Test
  void aRenamedServerKeepsItsKeyWhenItsOldNameIsReusedLater() {
    final McpConnection created = encryptMcp(List.of(mcpServer("alpha", "alpha-key")), null);
    final McpConnection renamed =
        encryptMcp(List.of(copy(created.getServers().getFirst()).withName("beta")), created);

    final McpConnection reused =
        encryptMcp(
            List.of(copy(renamed.getServers().getFirst()), mcpServer("alpha", "new-alpha-key")),
            renamed);

    assertEquals("alpha-key", storedKey(reused, "beta"));
    assertEquals("new-alpha-key", storedKey(reused, "alpha"));
  }

  /** The secret a renamed server leaves under its old name goes when the service is hard-deleted. */
  @Test
  void aRenamedServerLeavesNoSecretBehindWhenTheServiceIsHardDeleted() {
    final McpConnection created = encryptMcp(List.of(mcpServer("alpha", "alpha-key")), null);
    final McpConnection renamed =
        encryptMcp(List.of(copy(created.getServers().getFirst()).withName("beta")), created);

    ownership.removeOwner(owner, secretsManager.secretInventory(renamed, mcpRoot()));
    ownership.clean(mcpRoot());

    assertTrue(secretsManager.getSecretsMap().isEmpty());
  }

  @Test
  void aRenamedServerKeepsItsKeyWhenItsOldNameIsReusedInTheSameSave() {
    final McpConnection created = encryptMcp(List.of(mcpServer("alpha", "alpha-key")), null);

    final McpConnection updated =
        encryptMcp(
            List.of(
                copy(created.getServers().getFirst()).withName("beta"),
                mcpServer("alpha", "new-alpha-key")),
            created);

    assertEquals("alpha-key", storedKey(updated, "beta"));
    assertEquals("new-alpha-key", storedKey(updated, "alpha"));
  }

  /** Swapping two names moves both keys before either is written, then an edit hits only one. */
  @Test
  void swappingServerNamesThenReplacingOneKeyKeepsTheOther() {
    final McpConnection created =
        encryptMcp(List.of(mcpServer("alpha", "alpha-key"), mcpServer("beta", "beta-key")), null);
    final McpConnection swapped =
        encryptMcp(
            List.of(
                copy(created.getServers().getFirst()).withName("beta"),
                copy(created.getServers().get(1)).withName("alpha")),
            created);

    final McpConnection edited =
        encryptMcp(
            List.of(
                copy(swapped.getServers().getFirst()),
                copy(swapped.getServers().get(1)).withApiKey("replaced-key")),
            swapped);

    assertEquals("alpha-key", storedKey(edited, "beta"));
    assertEquals("replaced-key", storedKey(edited, "alpha"));
  }

  /** Servers keyed by position keep their own keys through a reorder and a later edit. */
  @Test
  void reorderingServersKeyedByPositionThenReplacingOneKeyKeepsTheOther() {
    final McpServerConfig first = mcpServer("dup", "first-key").withUrl("https://first/mcp");
    final McpServerConfig second = mcpServer("dup", "second-key").withUrl("https://second/mcp");
    final McpConnection created = encryptMcp(List.of(first, second), null);
    final McpConnection reordered =
        encryptMcp(
            List.of(copy(created.getServers().get(1)), copy(created.getServers().getFirst())),
            created);

    final McpConnection edited =
        encryptMcp(
            List.of(
                copy(reordered.getServers().getFirst()).withApiKey("replaced-key"),
                copy(reordered.getServers().get(1))),
            reordered);

    assertEquals("replaced-key", storedKeyAt(edited, "https://second/mcp"));
    assertEquals("first-key", storedKeyAt(edited, "https://first/mcp"));
  }

  /** A reference a user gave to a secret outside the service is kept as it is. */
  @Test
  void aReferenceOutsideTheServiceIsNotMoved() {
    secretsManager.getSecretsMap().put("/shared/team/key", "shared-key");

    final McpConnection stored =
        encryptMcp(List.of(mcpServer("alpha", "secret:/shared/team/key")), null);

    assertEquals("secret:/shared/team/key", reference(stored.getServers().getFirst()));
    assertEquals("shared-key", storedKey(stored, "alpha"));
  }

  /** Preparing a change for approval moves nothing in the vault. */
  @Test
  void preparingARenameLeavesTheVaultUntouched() {
    final McpConnection created = encryptMcp(List.of(mcpServer("alpha", "alpha-key")), null);
    final Map<String, String> before = new HashMap<>(secretsManager.getSecretsMap());

    secretsManager.prepareServiceConnectionConfig(
        new McpConnection()
            .withServers(
                List.of(
                    copy(created.getServers().getFirst()).withName("beta"),
                    mcpServer("alpha", "new-alpha-key"))),
        "Mcp",
        SERVICE,
        ServiceType.MCP);

    assertEquals(before, secretsManager.getSecretsMap());
  }

  private String storedKeyAt(final McpConnection connection, final String url) {
    return secretsManager.getSecretValue(
        reference(
            connection.getServers().stream()
                .filter(server -> url.equals(server.getUrl()))
                .findFirst()
                .orElseThrow()));
  }

  private static String reference(final McpServerConfig server) {
    final String apiKey = server.getApiKey();
    return Fernet.isTokenized(apiKey) ? Fernet.getInstance().decrypt(apiKey) : apiKey;
  }

  private String storedKey(final McpConnection connection, final String name) {
    final String apiKey =
        connection.getServers().stream()
            .filter(server -> name.equals(server.getName()))
            .findFirst()
            .orElseThrow()
            .getApiKey();
    final String reference =
        Fernet.isTokenized(apiKey) ? Fernet.getInstance().decrypt(apiKey) : apiKey;
    return secretsManager.getSecretValue(reference);
  }

  private static McpServerConfig copy(final McpServerConfig server) {
    return JsonUtils.deepCopy(server, McpServerConfig.class);
  }

  private McpConnection encryptMcp(List<McpServerConfig> servers, McpConnection original) {
    McpConnection config = new McpConnection().withServers(servers);
    SecretInventory input = secretsManager.secretInventory(config, mcpRoot());
    McpConnection stored =
        (McpConnection)
            secretsManager.encryptServiceConnectionConfig(
                JsonUtils.deepCopy(config, McpConnection.class), "Mcp", SERVICE, ServiceType.MCP);
    ownership.recordWrite(
        owner,
        original == null ? null : secretsManager.secretInventory(original, mcpRoot()),
        input,
        secretsManager.secretInventory(stored, mcpRoot()));
    return stored;
  }

  private static McpServerConfig mcpServer(String name, String apiKey) {
    return new McpServerConfig()
        .withName(name)
        .withUrl("https://" + name + ".example.com/mcp")
        .withApiKey(apiKey);
  }

  private String mcpRoot() {
    return secretsManager.buildSecretId(true, ServiceType.MCP.value(), SERVICE);
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
