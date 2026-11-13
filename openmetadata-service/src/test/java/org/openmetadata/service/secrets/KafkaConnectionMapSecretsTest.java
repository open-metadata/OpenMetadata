package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

/**
 * The ANT-2026-INNF1N4V reproducer, run the maintainers' way. Plays the server's write and read
 * paths on a Kafka connection: encrypt on create (what {@code ServiceEntityRepository.prepare}
 * calls), then decrypt + mask on read (what {@code ServiceEntityResource.decryptOrNullify} calls
 * for every non-bot caller). On the vulnerable tree every map entry comes back as sent; with the
 * fix the string entries are stored as {@code fernet:} tokens and returned as {@code *********}.
 */
public class KafkaConnectionMapSecretsTest {

  @BeforeEach
  void freshFactories() {
    SecretsManagerFactory.setSecretsManager(null);
    EntityMaskerFactory.setEntityMasker(null);
  }

  @AfterEach
  void restoreFactories() {
    SecretsManagerFactory.setSecretsManager(null);
    EntityMaskerFactory.setEntityMasker(null);
  }

  @Test
  void mapSecretsAreEncryptedAtRestAndMaskedOnRead() {
    Fernet.getInstance().setFernetKey("-uvd2sz2yfe3XoJZnBk3Aw9o_CjL36hHv_yFJlZL3-g=");
    SecretsManager secretsManager =
        SecretsManagerFactory.createSecretsManager(
            new SecretsManagerConfiguration(), "openmetadata");

    Map<String, Object> sent =
        Map.of(
            "type", "Kafka",
            "bootstrapServers", "broker-1.corp.example:9093",
            "securityProtocol", "SASL_SSL",
            "saslMechanism", "OAUTHBEARER",
            "saslPassword", "sasl-password",
            "basicAuthUserInfo", "registry:registry-password",
            "consumerConfig",
                Map.of(
                    "sasl.oauthbearer.client.secret", "oauth-client-secret",
                    "ssl.key.password", "client-key-passphrase",
                    "custom.plugin.secret", "plugin-secret",
                    "session.timeout.ms", 6000),
            "schemaRegistryConfig", Map.of("basic.auth.user.info", "registry:registry-password"));

    KafkaConnection stored =
        (KafkaConnection)
            secretsManager.encryptServiceConnectionConfig(
                sent, "Kafka", "prod_kafka", ServiceType.MESSAGING);
    KafkaConnection decrypted =
        (KafkaConnection)
            secretsManager.decryptServiceConnectionConfig(stored, "Kafka", ServiceType.MESSAGING);
    KafkaConnection returned =
        (KafkaConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(decrypted, "Kafka", ServiceType.MESSAGING);

    System.out.println("SENT " + JsonUtils.pojoToJson(sent));
    System.out.println("STORED " + JsonUtils.pojoToJson(stored));
    System.out.println("RETURNED " + JsonUtils.pojoToJson(returned));

    // Assert on the JSON a client sees, so a key declared in the schema and a key that only lives
    // in
    // the map's additionalProperties are held to the same contract.
    JsonNode storedJson = JsonUtils.valueToTree(stored);
    for (String secret :
        List.of(
            "/consumerConfig/sasl.oauthbearer.client.secret",
            "/consumerConfig/ssl.key.password",
            "/consumerConfig/custom.plugin.secret",
            "/schemaRegistryConfig/basic.auth.user.info")) {
      assertTrue(
          Fernet.isTokenized(storedJson.at(secret).asText()),
          secret + " must be encrypted at rest");
    }
    assertEquals(6000, storedJson.at("/consumerConfig/session.timeout.ms").asInt());

    JsonNode returnedJson = JsonUtils.valueToTree(returned);
    for (String secret :
        List.of(
            "/consumerConfig/sasl.oauthbearer.client.secret",
            "/consumerConfig/ssl.key.password",
            "/consumerConfig/custom.plugin.secret",
            "/schemaRegistryConfig/basic.auth.user.info")) {
      assertEquals(
          PasswordEntityMasker.PASSWORD_MASK,
          returnedJson.at(secret).asText(),
          secret + " must be masked");
    }
    assertEquals(6000, returnedJson.at("/consumerConfig/session.timeout.ms").asInt());
  }
}
