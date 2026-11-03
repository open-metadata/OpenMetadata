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
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
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

  private KafkaConnection encrypt(Map<String, Object> consumerConfig) {
    Map<String, Object> connection = new HashMap<>();
    connection.put("bootstrapServers", "broker:9092");
    connection.put("consumerConfig", new LinkedHashMap<>(consumerConfig));
    return (KafkaConnection)
        secretsManager.encryptServiceConnectionConfig(
            connection, "Kafka", SERVICE, ServiceType.MESSAGING);
  }
}
