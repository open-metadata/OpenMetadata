package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.WorkflowDefinitionMasker;

class WorkflowSinkSecretsTest {
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String ROTATED_FERNET_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
  private static final String GIT_TOKEN = "ghp_rawGitToken123";
  private static final String PRIVATE_KEY = "rawPrivateKeyMaterial";
  private static final String PASSPHRASE = "rawSigningPassphrase";
  private static final String WEBHOOK_PASSWORD = "rawBasicPassword789";
  private static final String SECRET_REFERENCE = "secret:/workflows/git/token";
  private static final String GIT_NODE = "gitSink";
  private static final String WEBHOOK_NODE = "webhookSink";
  private static final String GIT_TOKEN_POINTER = "/config/sinkConfig/credentials/token";

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
  }

  @AfterEach
  void tearDown() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void encryptStoresEverySinkSecretAsFernetCiphertext() {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);

    WorkflowSinkSecrets.encrypt(definition);

    String storedJson = JsonUtils.pojoToJson(definition);
    List.of(GIT_TOKEN, PRIVATE_KEY, PASSPHRASE, WEBHOOK_PASSWORD)
        .forEach(secret -> assertFalse(storedJson.contains(secret), secret));
    JsonNode gitNode = node(definition, GIT_NODE);
    assertCiphertextOf(GIT_TOKEN, gitNode.at(GIT_TOKEN_POINTER).asText());
    assertCiphertextOf(
        PRIVATE_KEY, gitNode.at("/config/sinkConfig/signingKey/privateKey").asText());
    assertCiphertextOf(PASSPHRASE, gitNode.at("/config/sinkConfig/signingKey/passphrase").asText());
    assertCiphertextOf(
        WEBHOOK_PASSWORD,
        node(definition, "webhookSink").at("/config/sinkConfig/authentication/password").asText());
    assertEquals(
        "https://github.com/org/repo.git",
        gitNode.at("/config/sinkConfig/repositoryUrl").asText(),
        "non-secret fields are stored as sent");
  }

  @Test
  void encryptingTwiceKeepsTheFirstCiphertext() {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);
    WorkflowSinkSecrets.encrypt(definition);
    String encryptedOnce = JsonUtils.pojoToJson(definition);

    WorkflowSinkSecrets.encrypt(definition);

    assertEquals(encryptedOnce, JsonUtils.pojoToJson(definition));
  }

  @Test
  void theMaskAndEmptyValuesAreNotEncrypted() {
    assertEquals(PASSWORD_MASK, WorkflowSinkSecrets.encryptSecret(PASSWORD_MASK));
    assertEquals("", WorkflowSinkSecrets.encryptSecret(""));
  }

  @Test
  void withoutAFernetKeySecretsAreStoredAsSent() {
    Fernet.getInstance().setFernetKey((String) null);
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);

    WorkflowSinkSecrets.encrypt(definition);

    assertEquals(GIT_TOKEN, node(definition, GIT_NODE).at(GIT_TOKEN_POINTER).asText());
    assertFalse(WorkflowSinkSecrets.encrypt(JsonUtils.valueToTree(definitionWithSinks(GIT_TOKEN))));
  }

  @Test
  void decryptHandsThePlaintextToTheProvider() {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);
    WorkflowSinkSecrets.encrypt(definition);

    JsonNode providerConfig =
        JsonUtils.valueToTree(WorkflowSinkSecrets.decrypt(gitSinkConfig(definition)));

    assertEquals(GIT_TOKEN, providerConfig.at("/credentials/token").asText());
    assertEquals(PRIVATE_KEY, providerConfig.at("/signingKey/privateKey").asText());
    assertEquals(PASSPHRASE, providerConfig.at("/signingKey/passphrase").asText());
    assertEquals("https://github.com/org/repo.git", providerConfig.at("/repositoryUrl").asText());
  }

  @Test
  void decryptPassesPlaintextStoredBeforeEncryptionThrough() {
    Object storedPlaintext = gitSinkConfig(definitionWithSinks(GIT_TOKEN));

    JsonNode providerConfig = JsonUtils.valueToTree(WorkflowSinkSecrets.decrypt(storedPlaintext));

    assertEquals(GIT_TOKEN, providerConfig.at("/credentials/token").asText());
  }

  @Test
  void secretReferencesReachTheProviderUnchanged() {
    Object storedReference = gitSinkConfig(definitionWithSinks(SECRET_REFERENCE));
    WorkflowDefinition encrypted = definitionWithSinks(SECRET_REFERENCE);
    WorkflowSinkSecrets.encrypt(encrypted);

    assertEquals(
        SECRET_REFERENCE,
        JsonUtils.valueToTree(WorkflowSinkSecrets.decrypt(storedReference))
            .at("/credentials/token")
            .asText());
    assertEquals(
        SECRET_REFERENCE,
        JsonUtils.valueToTree(WorkflowSinkSecrets.decrypt(gitSinkConfig(encrypted)))
            .at("/credentials/token")
            .asText());
  }

  @Test
  void decryptOfAnAbsentConfigIsNull() {
    assertNull(WorkflowSinkSecrets.decrypt(null));
  }

  @Test
  void maskRoundTripKeepsTheStoredCiphertextAndEncryptsANewValue() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowSinkSecrets.encrypt(stored);
    String storedCiphertext = node(stored, GIT_NODE).at(GIT_TOKEN_POINTER).asText();

    WorkflowDefinition response = WorkflowDefinitionMasker.mask(stored);
    String responseJson = JsonUtils.pojoToJson(response);
    assertFalse(responseJson.contains(Fernet.FERNET_PREFIX));
    assertFalse(responseJson.contains(GIT_TOKEN));

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, response);
    WorkflowSinkSecrets.encrypt(response);
    assertEquals(storedCiphertext, node(response, GIT_NODE).at(GIT_TOKEN_POINTER).asText());

    WorkflowDefinition rotated = definitionWithSinks("ghp_rotatedToken");
    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, rotated);
    WorkflowSinkSecrets.encrypt(rotated);
    assertCiphertextOf("ghp_rotatedToken", node(rotated, GIT_NODE).at(GIT_TOKEN_POINTER).asText());
  }

  @Test
  void theSamePlaintextSentAgainKeepsTheStoredCiphertext() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowSinkSecrets.encrypt(stored);
    WorkflowDefinition sentAgain = definitionWithSinks(GIT_TOKEN);

    WorkflowSinkSecrets.encrypt(stored, sentAgain);

    assertEquals(stored.getNodes(), sentAgain.getNodes());
  }

  @Test
  void aChangedPlaintextIsEncryptedAndTheUnchangedOnesKeepTheirCiphertext() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowSinkSecrets.encrypt(stored);
    WorkflowDefinition rotated = definitionWithSinks("ghp_rotatedToken");

    WorkflowSinkSecrets.encrypt(stored, rotated);

    JsonNode storedGit = node(stored, GIT_NODE);
    JsonNode rotatedGit = node(rotated, GIT_NODE);
    assertCiphertextOf("ghp_rotatedToken", rotatedGit.at(GIT_TOKEN_POINTER).asText());
    assertEquals(
        storedGit.at("/config/sinkConfig/signingKey"),
        rotatedGit.at("/config/sinkConfig/signingKey"));
    assertEquals(node(stored, WEBHOOK_NODE), node(rotated, WEBHOOK_NODE));
  }

  @Test
  void ciphertextOfAnOlderRotationKeyIsReplacedByOneOfThePrimaryKey() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowSinkSecrets.encrypt(stored);
    String oldKeyCiphertext = node(stored, GIT_NODE).at(GIT_TOKEN_POINTER).asText();
    Fernet.getInstance().setFernetKey("%s,%s".formatted(ROTATED_FERNET_KEY, FERNET_KEY));
    WorkflowDefinition sentAgain = definitionWithSinks(GIT_TOKEN);

    WorkflowSinkSecrets.encrypt(stored, sentAgain);

    String reencrypted = node(sentAgain, GIT_NODE).at(GIT_TOKEN_POINTER).asText();
    assertNotEquals(oldKeyCiphertext, reencrypted);
    assertEquals(GIT_TOKEN, Fernet.getInstance().decryptWithPrimaryKey(reencrypted));
  }

  @Test
  void ciphertextTheCurrentKeyCannotDecryptIsReplacedByANewOne() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowSinkSecrets.encrypt(stored);
    String oldCiphertext = node(stored, GIT_NODE).at(GIT_TOKEN_POINTER).asText();
    Fernet.getInstance().setFernetKey(ROTATED_FERNET_KEY);
    WorkflowDefinition sentAgain = definitionWithSinks(GIT_TOKEN);

    WorkflowSinkSecrets.encrypt(stored, sentAgain);

    String newCiphertext = node(sentAgain, GIT_NODE).at(GIT_TOKEN_POINTER).asText();
    assertNotEquals(oldCiphertext, newCiphertext);
    assertCiphertextOf(GIT_TOKEN, newCiphertext);
  }

  @Test
  void withoutAFernetKeyAnUpdateIsStoredAsSent() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    Fernet.getInstance().setFernetKey((String) null);
    WorkflowDefinition sentAgain = definitionWithSinks(GIT_TOKEN);

    WorkflowSinkSecrets.encrypt(stored, sentAgain);

    assertEquals(GIT_TOKEN, node(sentAgain, GIT_NODE).at(GIT_TOKEN_POINTER).asText());
  }

  @Test
  void encryptOfAStoredJsonCoversChangeDescriptionsAndIsIdempotent() {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);
    String nodesJson = JsonUtils.pojoToJson(definition.getNodes());
    definition.setChangeDescription(nodesChange(nodesJson));
    definition.setIncrementalChangeDescription(nodesChange(nodesJson));
    JsonNode stored = JsonUtils.valueToTree(definition);

    assertTrue(WorkflowSinkSecrets.encrypt(stored));
    String encryptedJson = stored.toString();
    List.of(GIT_TOKEN, PRIVATE_KEY, PASSPHRASE, WEBHOOK_PASSWORD)
        .forEach(secret -> assertFalse(encryptedJson.contains(secret), secret));
    assertFalse(WorkflowSinkSecrets.encrypt(stored));
    assertEquals(encryptedJson, stored.toString());

    String newNodes = stored.at("/changeDescription/fieldsUpdated/0/newValue").asText();
    assertCiphertextOf(
        GIT_TOKEN, JsonUtils.readTree(newNodes).at("/1%s".formatted(GIT_TOKEN_POINTER)).asText());
  }

  private static void assertCiphertextOf(String plaintext, String stored) {
    assertTrue(Fernet.isTokenized(stored), stored);
    assertNotEquals(plaintext, stored);
    assertEquals(plaintext, Fernet.getInstance().decrypt(stored));
  }

  private static JsonNode node(WorkflowDefinition definition, String name) {
    return JsonUtils.valueToTree(
        definition.getNodes().stream()
            .filter(node -> name.equals(node.getName()))
            .findFirst()
            .orElseThrow());
  }

  private static Object gitSinkConfig(WorkflowDefinition definition) {
    SinkTaskDefinition gitNode =
        definition.getNodes().stream()
            .filter(node -> GIT_NODE.equals(node.getName()))
            .map(SinkTaskDefinition.class::cast)
            .findFirst()
            .orElseThrow();
    return JsonUtils.readOrConvertValue(
        JsonUtils.pojoToJson(gitNode.getConfig().getSinkConfig()), Object.class);
  }

  private static ChangeDescription nodesChange(String nodesJson) {
    return new ChangeDescription()
        .withFieldsAdded(List.of(new FieldChange().withName("nodes").withNewValue(nodesJson)))
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName("nodes")
                    .withOldValue(nodesJson)
                    .withNewValue(nodesJson)))
        .withFieldsDeleted(List.of(new FieldChange().withName("nodes").withOldValue(nodesJson)));
  }

  static WorkflowDefinition definitionWithSinks(String gitToken) {
    String json =
        """
        {
          "name": "sinkWorkflow",
          "fullyQualifiedName": "sinkWorkflow",
          "nodes": [
            {"type": "startEvent", "subType": "startEvent", "name": "start"},
            {
              "type": "automatedTask",
              "subType": "sinkTask",
              "name": "gitSink",
              "config": {
                "sinkType": "git",
                "sinkConfig": {
                  "repositoryUrl": "https://github.com/org/repo.git",
                  "credentials": {"type": "token", "token": "%s"},
                  "signingKey": {"privateKey": "%s", "passphrase": "%s"}
                }
              }
            },
            {
              "type": "automatedTask",
              "subType": "sinkTask",
              "name": "webhookSink",
              "config": {
                "sinkType": "webhook",
                "sinkConfig": {
                  "endpoint": "https://hooks.example.com/sink",
                  "authentication": {
                    "type": "basic",
                    "username": "webhookUser",
                    "password": "%s"
                  }
                }
              }
            },
            {"type": "endEvent", "subType": "endEvent", "name": "end"}
          ]
        }
        """
            .formatted(gitToken, PRIVATE_KEY, PASSPHRASE, WEBHOOK_PASSWORD);
    return JsonUtils.readValue(json, WorkflowDefinition.class);
  }
}
