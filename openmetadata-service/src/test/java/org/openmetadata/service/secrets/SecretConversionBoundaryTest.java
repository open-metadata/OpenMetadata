package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;

class SecretConversionBoundaryTest {
  private DBSecretsManager manager;

  @BeforeEach
  void configureSecretsManager() {
    Fernet.getInstance().setFernetKey("GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=");
    manager =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    manager.setFernet(Fernet.getInstance());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void openStoredConfigMasksSecretsEvenWithoutBranchDiscriminators(boolean typed) {
    Map<String, Object> privateConfig = Map.of("token", "stored-token", "obsolete", true);
    Object config =
        typed
            ? new ApplicationPipeline().withAppPrivateConfig(privateConfig)
            : Map.of("type", "Application", "appPrivateConfig", privateConfig);
    IngestionPipeline pipeline =
        new IngestionPipeline().withSourceConfig(new SourceConfig().withConfig(config));
    EntityMaskerFactory.createEntityMasker().maskIngestionPipeline(pipeline);
    assertEquals(
        PASSWORD_MASK,
        JsonUtils.valueToTree(pipeline).at("/sourceConfig/config/appPrivateConfig/token").asText());
    assertTrue(
        JsonUtils.valueToTree(pipeline)
            .at("/sourceConfig/config/appPrivateConfig/obsolete")
            .asBoolean());
    assertFalse(JsonUtils.pojoToJson(pipeline).contains("stored-token"));
  }

  @Test
  void incompleteStoredCredentialStaysReadableAndMasked() {
    Object masked =
        EntityMaskerFactory.createEntityMasker()
            .maskServiceConnectionConfig(
                nats(Map.of("password", "stored-secret", "obsolete", true)),
                "Nats",
                ServiceType.MESSAGING);
    assertEquals(PASSWORD_MASK, JsonUtils.valueToTree(masked).at("/authType/password").asText());
    assertTrue(JsonUtils.valueToTree(masked).at("/authType/obsolete").asBoolean());
    assertFalse(JsonUtils.pojoToJson(masked).contains("stored-secret"));
  }

  @Test
  void newCredentialRejectsUnknownFieldsEvenWhenRequiredFieldsExist() {
    InvalidServiceConnectionException error =
        assertThrows(
            InvalidServiceConnectionException.class,
            () ->
                manager.encryptServiceConnectionConfig(
                    nats(Map.of("username", "u", "password", "secret", "obsolete", "typo")),
                    "Nats",
                    "nats",
                    ServiceType.MESSAGING));
    assertTrue(error.getMessage().contains("obsolete"), error.getMessage());
  }

  @Test
  void decryptingStoredCredentialPreservesObsoleteFields() {
    Object decrypted =
        manager.decryptServiceConnectionConfig(
            nats(
                Map.of(
                    "username",
                    "u",
                    "password",
                    Fernet.getInstance().encrypt("secret"),
                    "obsolete",
                    true)),
            "Nats",
            ServiceType.MESSAGING);
    assertEquals("secret", JsonUtils.valueToTree(decrypted).at("/authType/password").asText());
    assertTrue(JsonUtils.valueToTree(decrypted).at("/authType/obsolete").asBoolean());
  }

  @Test
  void everyBranchOfAMalformedStoredCredentialIsMasked() {
    Object masked =
        EntityMaskerFactory.createEntityMasker()
            .maskServiceConnectionConfig(
                nats(
                    Map.of(
                        "password", "password-secret",
                        "token", "token-secret",
                        "nkeySeed", "seed-secret",
                        "obsolete", Map.of("retained", true))),
                "Nats",
                ServiceType.MESSAGING);

    for (String field : List.of("password", "token", "nkeySeed")) {
      assertEquals(PASSWORD_MASK, JsonUtils.valueToTree(masked).at("/authType/" + field).asText());
    }
    assertTrue(JsonUtils.valueToTree(masked).at("/authType/obsolete/retained").asBoolean());
    assertFalse(JsonUtils.pojoToJson(masked).contains("-secret"));
  }

  @Test
  void anUnexpectedContainerAtAScalarPasswordIsMaskedAsOneSecret() {
    Object masked =
        EntityMaskerFactory.createEntityMasker()
            .maskServiceConnectionConfig(
                nats(Map.of("password", Map.of("nested", "container-secret"))),
                "Nats",
                ServiceType.MESSAGING);

    assertEquals(PASSWORD_MASK, JsonUtils.valueToTree(masked).at("/authType/password").asText());
    assertFalse(JsonUtils.pojoToJson(masked).contains("container-secret"));
  }

  @Test
  void aRepairedCredentialCanRestoreItsStoredSecret() {
    Object restored =
        EntityMaskerFactory.createEntityMasker()
            .unmaskServiceConnectionConfig(
                nats(Map.of("username", "repaired", "password", PASSWORD_MASK)),
                nats(
                    Map.of(
                        "password",
                        Fernet.getInstance().encrypt("retained-secret"),
                        "obsolete",
                        true)),
                "Nats",
                ServiceType.MESSAGING);

    assertEquals(
        "retained-secret", JsonUtils.valueToTree(restored).at("/authType/password").asText());
    assertFalse(JsonUtils.valueToTree(restored).at("/authType").has("obsolete"));
  }

  @Test
  void malformedRootRetainsUnknownFieldsAndDecryptsEverySecretBranch() {
    Map<String, Object> stored =
        new HashMap<>(
            nats(
                Map.of(
                    "password", Fernet.getInstance().encrypt("password-secret"),
                    "token", Fernet.getInstance().encrypt("token-secret"))));
    stored.put("legacyRoot", Map.of("retained", true));

    Object decrypted =
        manager.decryptServiceConnectionConfig(stored, "Nats", ServiceType.MESSAGING);

    assertEquals(
        "password-secret", JsonUtils.valueToTree(decrypted).at("/authType/password").asText());
    assertEquals("token-secret", JsonUtils.valueToTree(decrypted).at("/authType/token").asText());
    assertTrue(JsonUtils.valueToTree(decrypted).at("/legacyRoot/retained").asBoolean());
  }

  @Test
  void rawInventoryKeepsTypedScalarAndPasswordMapOwnership() {
    Map<String, Object> kafka =
        Map.of(
            "type",
            "Kafka",
            "bootstrapServers",
            "localhost:9092",
            "consumerConfig",
            Map.of("sasl.password", "map-secret", "fetch.min.bytes", 1));
    Map<String, Object> legacyKafka = new HashMap<>(kafka);
    legacyKafka.put("obsolete", true);
    String root = "/prefix/openmetadata/messaging/kafka";

    assertEquals(
        manager.secretInventory(
            SecretsUtil.convert(kafka, "Kafka", "kafka", ServiceType.MESSAGING), root),
        manager.secretInventory(
            SecretsUtil.convertForRead(legacyKafka, "Kafka", ServiceType.MESSAGING), root));
    Map<String, Object> valid = nats(Map.of("username", "u", "password", "scalar-secret"));
    Map<String, Object> legacy = new HashMap<>(valid);
    legacy.put("obsolete", true);
    assertEquals(
        manager.secretInventory(
            SecretsUtil.convert(valid, "Nats", "nats", ServiceType.MESSAGING), root),
        manager.secretInventory(
            SecretsUtil.convertForRead(legacy, "Nats", ServiceType.MESSAGING), root));
  }

  @Test
  void rawNamedCollectionInventoryPreservesTypedReferenceOwnership() {
    String root = "/prefix/openmetadata/mcp/service";
    for (String reference :
        List.of(root + "/apikey", root + "/servers/apikey", root + "/servers/named/apikey")) {
      Map<String, Object> config =
          Map.of(
              "type",
              "Mcp",
              "servers",
              List.of(
                  Map.of(
                      "name",
                      "named",
                      "url",
                      "https://server.example",
                      "apiKey",
                      "secret:" + reference)));
      Map<String, Object> legacy = new HashMap<>(config);
      legacy.put("obsolete", true);

      assertEquals(
          manager.secretInventory(
              SecretsUtil.convert(config, "Mcp", "service", ServiceType.MCP), root),
          manager.secretInventory(
              SecretsUtil.convertForRead(legacy, "Mcp", ServiceType.MCP), root));
    }
  }

  @Test
  void malformedStoredBotAuthenticationRemainsReadableAndMasked() {
    AuthenticationMechanism mechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(Map.of("JWTToken", "bot-secret", "legacy", true));

    EntityMaskerFactory.createEntityMasker().maskAuthenticationMechanism("bot", mechanism);

    assertEquals(PASSWORD_MASK, JsonUtils.valueToTree(mechanism).at("/config/JWTToken").asText());
    assertTrue(JsonUtils.valueToTree(mechanism).at("/config/legacy").asBoolean());
  }

  private static Map<String, Object> nats(Map<String, Object> auth) {
    return Map.of("type", "Nats", "natsServers", "nats://localhost:4222", "authType", auth);
  }
}
