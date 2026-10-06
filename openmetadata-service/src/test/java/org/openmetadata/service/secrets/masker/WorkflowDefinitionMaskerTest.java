package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.core.JsonPointer;
import jakarta.json.Json;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.GitSinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.SigningKey;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.sinkConfig.WebhookSinkConfig;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

class WorkflowDefinitionMaskerTest {
  private static final String GIT_TOKEN = "ghp_rawGitToken123";
  private static final String SIGNING_KEY =
      "-----BEGIN PGP PRIVATE KEY BLOCK-----\nrawKeyMaterial\n-----END PGP PRIVATE KEY BLOCK-----";
  private static final String SIGNING_PASSPHRASE = "rawSigningPassphrase";
  private static final String WEBHOOK_TOKEN = "rawBearerToken456";
  private static final String WEBHOOK_PASSWORD = "rawBasicPassword789";
  private static final String GIT_NODE = "gitSink";
  private static final String WEBHOOK_NODE = "webhookSink";
  private static final String STORED_CIPHERTEXT = "fernet:storedForThisNode";
  private static final String PASTED_CIPHERTEXT = "fernet:copiedFromAnotherWorkflow";
  private static final String ENCRYPTED_REJECTION = "encrypted values cannot be supplied";
  private static final String GIT_TOKEN_PATH = "/nodes/1/config/sinkConfig/credentials/token";
  private static final String EDGES_JSON = "[{\"from\":\"start\",\"to\":\"gitSink\"}]";

  @Test
  void passwordPointersAreDerivedFromTheSinkConfigSchemas() {
    assertEquals(
        pointers("/credentials/token", "/signingKey/privateKey", "/signingKey/passphrase"),
        Set.copyOf(WorkflowDefinitionMasker.GIT_SECRET_POINTERS));
    assertEquals(
        pointers("/authentication/token", "/authentication/password", "/authentication/apiKey"),
        Set.copyOf(WorkflowDefinitionMasker.WEBHOOK_SECRET_POINTERS));
  }

  @Test
  void maskHidesSinkSecretsInNodesAndChangeDescriptions() {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);
    String nodesJson = JsonUtils.pojoToJson(definition.getNodes());
    definition.setChangeDescription(nodesChange(nodesJson));
    definition.setIncrementalChangeDescription(nodesChange(nodesJson));

    String maskedJson = JsonUtils.pojoToJson(WorkflowDefinitionMasker.mask(definition));

    assertFalse(maskedJson.contains(GIT_TOKEN));
    assertFalse(maskedJson.contains(WEBHOOK_TOKEN));
    assertFalse(maskedJson.contains(WEBHOOK_PASSWORD));
    assertTrue(maskedJson.contains(PASSWORD_MASK));
    assertTrue(maskedJson.contains("https://github.com/org/repo.git"));
    assertTrue(maskedJson.contains("webhookUser"));
    assertEquals(GIT_TOKEN, gitToken(definition), "mask must not mutate the stored definition");
  }

  @Test
  void maskToleratesEdgeObjectsRecordedUnderTheNodesField() {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);
    definition.setChangeDescription(
        new ChangeDescription()
            .withFieldsAdded(List.of(new FieldChange().withName("nodes").withNewValue(EDGES_JSON)))
            .withFieldsUpdated(List.of())
            .withFieldsDeleted(List.of()));

    WorkflowDefinition masked = assertDoesNotThrow(() -> WorkflowDefinitionMasker.mask(definition));

    assertEquals(
        JsonUtils.readTree(EDGES_JSON),
        JsonUtils.readTree(
            (String) masked.getChangeDescription().getFieldsAdded().getFirst().getNewValue()));
  }

  @Test
  void maskHidesSinkSecretsInEveryHistoryVersion() {
    EntityHistory history =
        new EntityHistory()
            .withEntityType("workflowDefinition")
            .withVersions(
                List.of(
                    JsonUtils.pojoToJson(definitionWithSinks(GIT_TOKEN)),
                    JsonUtils.pojoToJson(definitionWithSinks("olderRawToken"))));

    String maskedJson = JsonUtils.pojoToJson(WorkflowDefinitionMasker.mask(history));

    assertFalse(maskedJson.contains(GIT_TOKEN));
    assertFalse(maskedJson.contains("olderRawToken"));
    assertFalse(maskedJson.contains(WEBHOOK_PASSWORD));
  }

  @Test
  void restoreKeepsStoredSecretsWhenTheMaskIsSentBack() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    assertEquals(stored.getNodes(), incoming.getNodes());
  }

  @Test
  void restoreKeepsANewSecretValue() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);
    setGitToken(incoming, "ghp_rotatedToken");

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    assertEquals("ghp_rotatedToken", gitToken(incoming));
    assertEquals(WEBHOOK_PASSWORD, webhookConfig(incoming).getAuthentication().getPassword());
  }

  @Test
  void secretReferencesSurviveAMaskedRoundTrip() {
    WorkflowDefinition stored = definitionWithSinks("secret:/workflows/git/token");
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);

    assertEquals(PASSWORD_MASK, gitToken(incoming));
    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);
    assertEquals("secret:/workflows/git/token", gitToken(incoming));
  }

  @Test
  void aNewDefinitionSentWithTheMaskIsRejected() {
    WorkflowDefinition created = definitionWithSinks(PASSWORD_MASK);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireNoMaskedSecrets(created));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("'%s'".formatted(GIT_NODE)), rejected.getMessage());
    assertTrue(rejected.getMessage().contains("/credentials/token"), rejected.getMessage());
  }

  @Test
  void aMaskOnARenamedNodeCannotBeRestoredAndIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);
    sinkNode(incoming, GIT_NODE).setName("renamedGitSink");

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireNoMaskedSecrets(incoming));
    assertTrue(rejected.getMessage().contains("'renamedGitSink'"), rejected.getMessage());
  }

  @Test
  void aMaskRestoredFromTheStoredNodeIsAccepted() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    assertDoesNotThrow(() -> WorkflowDefinitionMasker.requireNoMaskedSecrets(incoming));
    assertEquals(GIT_TOKEN, gitToken(incoming));
  }

  @Test
  void signingKeyAndPassphraseAreMaskedAndTheStoredOnesKeptWhenTheMaskIsSentBack() {
    WorkflowDefinition stored = definitionWithSigningKey(SIGNING_KEY, SIGNING_PASSPHRASE);

    WorkflowDefinition masked = WorkflowDefinitionMasker.mask(stored);
    String maskedJson = JsonUtils.pojoToJson(masked);

    assertFalse(maskedJson.contains("rawKeyMaterial"));
    assertFalse(maskedJson.contains(SIGNING_PASSPHRASE));
    assertEquals(PASSWORD_MASK, gitConfig(masked).getSigningKey().getPrivateKey());
    assertEquals(PASSWORD_MASK, gitConfig(masked).getSigningKey().getPassphrase());
    assertEquals(Boolean.TRUE, gitConfig(masked).getAllowUnsignedFastPush());

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, masked);

    assertDoesNotThrow(() -> WorkflowDefinitionMasker.requireNoMaskedSecrets(masked));
    assertEquals(SIGNING_KEY, gitConfig(masked).getSigningKey().getPrivateKey());
    assertEquals(SIGNING_PASSPHRASE, gitConfig(masked).getSigningKey().getPassphrase());
    assertEquals(GIT_TOKEN, gitToken(masked));
  }

  @Test
  void aSigningKeySentWithTheMaskForANewNodeIsRejected() {
    WorkflowDefinition created = definitionWithSigningKey(PASSWORD_MASK, SIGNING_PASSPHRASE);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireNoMaskedSecrets(created));

    assertTrue(rejected.getMessage().contains("/signingKey/privateKey"), rejected.getMessage());
  }

  @Test
  void aNewDefinitionWithAnEncryptedSecretIsRejected() {
    WorkflowDefinition created = definitionWithSinks(PASTED_CIPHERTEXT);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireNoEncryptedSecrets(created));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains(ENCRYPTED_REJECTION), rejected.getMessage());
    assertTrue(rejected.getMessage().contains("'%s'".formatted(GIT_NODE)), rejected.getMessage());
    assertTrue(rejected.getMessage().contains("/credentials/token"), rejected.getMessage());
  }

  @Test
  void aNewDefinitionWithPlaintextSecretsAndSecretReferencesIsAccepted() {
    assertDoesNotThrow(
        () -> WorkflowDefinitionMasker.requireNoEncryptedSecrets(definitionWithSinks(GIT_TOKEN)));
    assertDoesNotThrow(
        () ->
            WorkflowDefinitionMasker.requireNoEncryptedSecrets(
                definitionWithSinks("secret:/workflows/git/token")));
  }

  @Test
  void theStoredCiphertextOfTheSameNodeIsAccepted() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition maskedUpdate = WorkflowDefinitionMasker.mask(stored);
    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, maskedUpdate);
    WorkflowDefinition unchangedCopy = definitionWithSinks(STORED_CIPHERTEXT);

    assertDoesNotThrow(
        () -> WorkflowDefinitionMasker.requireStoredEncryptedSecrets(stored, maskedUpdate));
    assertDoesNotThrow(
        () -> WorkflowDefinitionMasker.requireStoredEncryptedSecrets(stored, unchangedCopy));
  }

  @Test
  void ciphertextCopiedFromAnotherWorkflowIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition incoming = definitionWithSinks(PASTED_CIPHERTEXT);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireStoredEncryptedSecrets(stored, incoming));

    assertTrue(rejected.getMessage().contains(ENCRYPTED_REJECTION), rejected.getMessage());
  }

  @Test
  void theStoredCiphertextUnderARenamedNodeIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition incoming = definitionWithSinks(STORED_CIPHERTEXT);
    sinkNode(incoming, GIT_NODE).setName("renamedGitSink");

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireStoredEncryptedSecrets(stored, incoming));

    assertTrue(rejected.getMessage().contains("'renamedGitSink'"), rejected.getMessage());
  }

  @Test
  void ciphertextAtTheSecretFieldOfAnotherSinkTypeIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = definitionWithSinks(GIT_TOKEN);
    sinkNode(incoming, GIT_NODE)
        .getConfig()
        .getSinkConfig()
        .setAdditionalProperty("authentication", Map.of("token", PASTED_CIPHERTEXT));

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireStoredEncryptedSecrets(stored, incoming));

    assertTrue(rejected.getMessage().contains("/authentication/token"), rejected.getMessage());
  }

  @Test
  void aPatchCopyingTheTokenToTheDescriptionIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition patched =
        JsonUtils.applyPatch(
            stored,
            Json.createPatchBuilder().copy("/description", GIT_TOKEN_PATH).build(),
            WorkflowDefinition.class);

    assertSecretOutsideItsFieldRejected(stored, patched, "'/description'");
  }

  @Test
  void aPatchMovingTheTokenToTheDescriptionIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition patched =
        JsonUtils.applyPatch(
            stored,
            Json.createPatchBuilder().move("/description", GIT_TOKEN_PATH).build(),
            WorkflowDefinition.class);

    assertSecretOutsideItsFieldRejected(stored, patched, "'/description'");
  }

  @Test
  void aPatchCopyingTheCredentialsObjectIntoTheSinkConfigIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition patched =
        JsonUtils.applyPatch(
            stored,
            Json.createPatchBuilder()
                .copy("/nodes/1/config/sinkConfig/backup", "/nodes/1/config/sinkConfig/credentials")
                .build(),
            WorkflowDefinition.class);

    assertSecretOutsideItsFieldRejected(
        stored, patched, "'/nodes/1/config/sinkConfig/backup/token'");
  }

  @Test
  void aPatchCopyingANonSecretFieldOrAWholeSinkNodeIsAccepted() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition patched =
        JsonUtils.applyPatch(
            stored,
            Json.createPatchBuilder()
                .copy("/description", "/nodes/1/config/sinkConfig/repositoryUrl")
                .copy("/nodes/-", "/nodes/1")
                .build(),
            WorkflowDefinition.class);

    assertDoesNotThrow(
        () -> WorkflowDefinitionMasker.requireSecretsOnlyInSecretFields(stored, patched));
    assertEquals("https://github.com/org/repo.git", patched.getDescription());
  }

  @Test
  void aSecretRecordedInAnEarlierChangeDescriptionDoesNotBlockUpdates() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    stored.setChangeDescription(
        new ChangeDescription()
            .withFieldsAdded(List.of())
            .withFieldsUpdated(
                List.of(new FieldChange().withName("description").withNewValue(STORED_CIPHERTEXT)))
            .withFieldsDeleted(List.of()));
    WorkflowDefinition patched =
        JsonUtils.applyPatch(
            stored,
            Json.createPatchBuilder().add("/description", "cleaned up").build(),
            WorkflowDefinition.class);

    assertDoesNotThrow(
        () -> WorkflowDefinitionMasker.requireSecretsOnlyInSecretFields(stored, patched));
  }

  private static void assertSecretOutsideItsFieldRejected(
      WorkflowDefinition stored, WorkflowDefinition patched, String location) {
    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionMasker.requireSecretsOnlyInSecretFields(stored, patched));
    assertTrue(rejected.getMessage().contains(location), rejected.getMessage());
  }

  @Test
  void aDeployedSinkConfigWithAPlaintextSecretIsReported() {
    WorkflowDefinition definition = definitionWithSinks(STORED_CIPHERTEXT);
    String plaintextConfig = deployedGitConfig(GIT_TOKEN);

    assertTrue(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            definition, deployedConfigs(Map.of(GIT_NODE, plaintextConfig))));
  }

  @Test
  void aDeployedSinkConfigWithoutAPlaintextSecretIsNotReported() {
    WorkflowDefinition definition = definitionWithSinks(STORED_CIPHERTEXT);
    Map<String, String> deployed =
        Map.of(
            GIT_NODE,
            deployedGitConfig(STORED_CIPHERTEXT),
            WEBHOOK_NODE,
            "{\"authentication\": {\"token\": \"secret:/hooks/token\", \"password\": \"\"}}");

    assertFalse(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(definition, deployedConfigs(deployed)));
    assertFalse(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            definition, deployedConfigs(Map.of(GIT_NODE, "{}", WEBHOOK_NODE, ""))));
    assertFalse(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            definition, nodeName -> Optional.empty()),
        "a definition that is not deployed holds no deployed secret");
  }

  @Test
  void aValueAtAnotherSinkTypesSecretFieldIsNotReportedAsAPlaintextSecret() {
    WorkflowDefinition definition = definitionWithSinks(STORED_CIPHERTEXT);
    String gitConfigWithWebhookField =
        "{\"credentials\": {\"token\": \"%s\"}, \"authentication\": {\"token\": \"notASecret\"}}"
            .formatted(STORED_CIPHERTEXT);

    assertFalse(
        WorkflowDefinitionMasker.hasPlaintextDeployedSecret(
            definition, deployedConfigs(Map.of(GIT_NODE, gitConfigWithWebhookField))));
  }

  private static String deployedGitConfig(String token) {
    return "{\"repositoryUrl\": \"https://github.com/org/repo.git\", \"credentials\": {\"type\": \"token\", \"token\": \"%s\"}}"
        .formatted(token);
  }

  private static Function<String, Optional<String>> deployedConfigs(Map<String, String> configs) {
    return nodeName -> Optional.ofNullable(configs.get(nodeName));
  }

  private static WorkflowDefinition definitionWithSigningKey(String privateKey, String passphrase) {
    WorkflowDefinition definition = definitionWithSinks(GIT_TOKEN);
    GitSinkConfig config =
        gitConfig(definition)
            .withAllowUnsignedFastPush(true)
            .withSigningKey(new SigningKey().withPrivateKey(privateKey).withPassphrase(passphrase));
    sinkNode(definition, GIT_NODE)
        .getConfig()
        .setSinkConfig(JsonUtils.convertValue(config, SinkConfig.class));
    return definition;
  }

  private static WorkflowDefinition definitionWithSinks(String gitToken) {
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
              "name": "%s",
              "config": {
                "sinkType": "git",
                "sinkConfig": {
                  "repositoryUrl": "https://github.com/org/repo.git",
                  "credentials": {"type": "token", "token": "%s"}
                }
              }
            },
            {
              "type": "automatedTask",
              "subType": "sinkTask",
              "name": "%s",
              "config": {
                "sinkType": "webhook",
                "sinkConfig": {
                  "endpoint": "https://hooks.example.com/sink",
                  "authentication": {
                    "type": "basic",
                    "token": "%s",
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
            .formatted(GIT_NODE, gitToken, WEBHOOK_NODE, WEBHOOK_TOKEN, WEBHOOK_PASSWORD);
    return JsonUtils.readValue(json, WorkflowDefinition.class);
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

  private static SinkTaskDefinition sinkNode(WorkflowDefinition definition, String name) {
    return definition.getNodes().stream()
        .filter(node -> name.equals(node.getName()))
        .map(SinkTaskDefinition.class::cast)
        .findFirst()
        .orElseThrow();
  }

  private static GitSinkConfig gitConfig(WorkflowDefinition definition) {
    return JsonUtils.convertValue(
        sinkNode(definition, GIT_NODE).getConfig().getSinkConfig(), GitSinkConfig.class);
  }

  private static WebhookSinkConfig webhookConfig(WorkflowDefinition definition) {
    return JsonUtils.convertValue(
        sinkNode(definition, WEBHOOK_NODE).getConfig().getSinkConfig(), WebhookSinkConfig.class);
  }

  private static String gitToken(WorkflowDefinition definition) {
    return gitConfig(definition).getCredentials().getToken();
  }

  @SuppressWarnings("unchecked")
  private static void setGitToken(WorkflowDefinition definition, String token) {
    // SinkConfig is schema-less, so the generated class exposes its content only as a raw map.
    var credentials =
        (Map<String, Object>)
            sinkNode(definition, GIT_NODE)
                .getConfig()
                .getSinkConfig()
                .getAdditionalProperties()
                .get("credentials");
    credentials.put("token", token);
  }

  private static Set<JsonPointer> pointers(String... pointers) {
    return Stream.of(pointers).map(JsonPointer::compile).collect(Collectors.toSet());
  }
}
